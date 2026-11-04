#!/usr/bin/env python3
"""
Uma Versus Desktop -- the desktop app for Uma Versus, with the mod loader built in.

Double-click "Uma Versus Desktop.exe" (or the desktop shortcut it makes). This:
  1. updates the app's own files from github.com/jaxonb423/umaversus-mods,
  2. checks umaversus.lol for the current game and, when it changed, downloads it and builds
     the modded copy (sprites and music included; only changed files are downloaded again),
  3. opens the game in its own window, served from http://localhost:8777 on this computer only,
  4. keeps the previous game version too: if a game update breaks one of your mods, the game
     starts on the last version they work on until the mod is updated,
  5. quits by itself when the game window closes.

Works offline with the last downloaded version. Logs: data/launcher.log.
Only the Python standard library is used (it runs on the bundled Windows Python).
"""
import hashlib, http.server, json, os, re, shutil, socket, subprocess, sys, threading, time, urllib.error, urllib.request, webbrowser
from functools import partial

APP = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(APP)
DATA = os.environ.get("UVM_DATA") or os.path.join(ROOT, "data")
BUILDS = os.path.join(DATA, "builds")
SITE = os.environ.get("UVM_SITE", "https://umaversus.lol").rstrip("/")
REPO = os.environ.get("UVM_REPO", "https://raw.githubusercontent.com/jaxonb423/umaversus-mods/main").rstrip("/")
PORT = int(os.environ.get("UVM_PORT", "8777"))
KEEP = 2                     # game versions kept: the newest + the previous one (the fallback)
LAUNCHER_FORMAT = 4          # bump when the way builds are made changes (forces a rebuild)
NO_WINDOW = os.environ.get("UVM_NO_WINDOW") == "1"
APP_NAME = "Uma Versus Desktop"
UA = {"User-Agent": "Mozilla/5.0 (Uma Versus Desktop)"}
os.makedirs(BUILDS, exist_ok=True)

# ---------------------------------------------------------------- logging (pythonw has no console)
LOG = os.path.join(DATA, "launcher.log")
try:
    if os.path.exists(LOG) and os.path.getsize(LOG) > 400_000:
        os.replace(LOG, LOG + ".old")
except OSError:
    pass
_logf = open(LOG, "a", encoding="utf-8", buffering=1)
if sys.stderr is None or not hasattr(sys.stderr, "write"):
    sys.stderr = _logf
if sys.stdout is None or not hasattr(sys.stdout, "write"):
    sys.stdout = _logf


def log(*a):
    line = time.strftime("%Y-%m-%d %H:%M:%S ") + " ".join(str(x) for x in a)
    _logf.write(line + "\n")
    if sys.stdout is not _logf:
        try:
            print(line, flush=True)
        except Exception:
            pass


def alert(msg):
    log("ALERT:", msg)
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, msg, APP_NAME, 0x10)
            return
        except Exception:
            pass
    print(msg, file=sys.stderr)


# ---------------------------------------------------------------- network
def fetch(url, timeout=30, headers=None):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), r


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def file_sha(p):
    try:
        with open(p, "rb") as f:
            return sha256(f.read())
    except OSError:
        return None


# ---------------------------------------------------------------- status shared with the start page
STATUS = {"state": "starting", "msg": "Starting", "progress": 0.0, "builds": [], "latest": None, "error": None, "offline": False, "notes": []}
SLOCK = threading.Lock()


def status(**kw):
    with SLOCK:
        STATUS.update(kw)


# ---------------------------------------------------------------- 1. self-update from the repo
def self_update():
    """Update app/* from the repo's manifest.json. Returns True if launcher.py itself changed."""
    if os.environ.get("UVM_NO_SELF_UPDATE") == "1":
        return False
    try:
        data, _ = fetch(REPO + "/manifest.json", timeout=8)
        man = json.loads(data)
    except Exception as e:
        log("self-update: manifest not reachable:", e)
        return False
    changed = []
    for rel, digest in man.get("files", {}).items():
        if not re.match(r"^app/[A-Za-z0-9_.\-]+$", rel):
            continue
        dest = os.path.join(ROOT, *rel.split("/"))
        if file_sha(dest) == digest:
            continue
        try:
            body, _ = fetch(REPO + "/" + rel, timeout=30)
            if sha256(body) != digest:
                log("self-update: checksum mismatch, skipped", rel)
                continue
            with open(dest + ".new", "wb") as f:
                f.write(body)
            os.replace(dest + ".new", dest)
            changed.append(rel)
        except Exception as e:
            log("self-update: failed", rel, e)
    if changed:
        log("self-update: updated", ", ".join(changed), "->", man.get("version"))
        STATUS["notes"].append("App updated to " + str(man.get("version")))
    return "app/launcher.py" in changed


def manager_version():
    h = hashlib.sha256(str(LAUNCHER_FORMAT).encode())
    for n in ("uvm_loader.js", "uvm_ui.js", "uvm_bridge.js"):
        with open(os.path.join(APP, n), "rb") as f:
            h.update(f.read())
    return h.hexdigest()[:16]


# ---------------------------------------------------------------- 2. game versions
def builds_index():
    try:
        with open(os.path.join(BUILDS, "builds.json"), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_index(lst):
    tmp = os.path.join(BUILDS, "builds.json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(lst, f, indent=1)
    os.replace(tmp, os.path.join(BUILDS, "builds.json"))


def game_script_span(page):
    """(start, end) of the game's main <script> body: the plain script that defines BUILD and tick."""
    for m in re.finditer(r"<script>", page):
        end = page.find("</script>", m.end())
        body = page[m.end():end]
        if re.search(r"const\s+BUILD\s*=", body) and "function tick" in body:
            return m.end(), end
    raise RuntimeError("couldn't find the game's code in the page")


def build_id_of(page):
    m = re.search(r"const\s+BUILD\s*=\s*['\"]([A-Za-z0-9._-]+)['\"]", page)
    if m:
        return m.group(1)
    # the game wrote its build some other way: name this version after the page itself, so updates are still picked up
    return "page-" + sha256(page.encode("utf-8"))[:8]


def asset_list(page):
    """Every file the page loads from assets/: sprite sheets (needed) and music (optional)."""
    need = sorted(set(re.findall(r"""["'](assets/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif))["']""", page)))
    music = set()
    mu = re.search(r"MUSIC_URL\s*=\s*['\"]([^'\"]+)['\"]", page)
    if mu:
        base = mu.group(1)
        ids = set()
        for name in ("THEME_IDS", "ROSTER"):
            m = re.search(r"const\s+" + name + r"\s*=\s*\[([^\]]*)\]", page)
            if m:
                ids.update(re.findall(r"['\"]([a-z0-9_]+)['\"]", m.group(1)))
        for call in re.findall(r"Music\.\w+\(([^;\n]{0,160})", page):     # any track name inside a Music.*(...) call
            ids.update(re.findall(r"'([a-z0-9_]+)'", call))
        for line in re.findall(r"TRACK_TITLE\s*=[^\n]+", page):          # tracks with their own titles (menu, round3 ...)
            ids.update(re.findall(r"id === '([a-z0-9_]+)'", line))
        music = {base + i + ".mp3" for i in ids}
    other = set(re.findall(r"""["'](assets/[A-Za-z0-9_./-]+\.(?:mp3|ogg|wav|json))["']""", page))
    return need, sorted(music | other)


def same_remote(url, local):
    """True if the server's file is the one we already have (size + first 64 KB match)."""
    try:
        size = os.path.getsize(local)
        body, r = fetch(url, timeout=20, headers={"Range": "bytes=0-65535"})
        cr = r.headers.get("Content-Range", "")
        total = int(cr.rsplit("/", 1)[1]) if "/" in cr else int(r.headers.get("Content-Length", -1))
        if total != size:
            return False
        with open(local, "rb") as f:
            return f.read(len(body)) == body
    except Exception:
        return False


def make_page(page, bid):
    """The modded page: game code made inert + MODS screens + hooks, and the loader in front."""
    s, e = game_script_span(page)
    game = page[s:e]
    m = re.search(r"const\s+BUILD\s*=\s*(['\"])([^'\"]+)\1\s*;", game)
    notes = []
    if m:
        game = game[:m.start()] + "const BUILD = '" + m.group(2) + "' + ((typeof UVM !== 'undefined' && UVM.tag) || '') /*uvm:build*/;" + game[m.end():]
    else:
        notes.append("build tag not found: mods stay off on this version until the app is updated")
    ui = open(os.path.join(APP, "uvm_ui.js"), encoding="utf-8").read()
    bridge = open(os.path.join(APP, "uvm_bridge.js"), encoding="utf-8").read()
    loader = open(os.path.join(APP, "uvm_loader.js"), encoding="utf-8").read()
    code = game + "\n;\n" + ui + "\n;\n" + bridge + "\n"
    if "</script" in code.lower():
        raise RuntimeError("game code contains a closing script tag")
    out = (page[:s - len("<script>")] + '<script type="text/x-uv-game" id="uv-game">' + code + "</script>\n<script>\n" + loader + "\n</script>" + page[e + len("</script>"):])
    return out, notes


def download_build(page, bid, prev_dir):
    """Download a game version's files into builds/<bid> (reusing unchanged ones from prev_dir)."""
    tmp = os.path.join(BUILDS, bid + ".part")
    os.makedirs(tmp, exist_ok=True)
    need, optional = asset_list(page)
    files = [(p, True) for p in need] + [(p, False) for p in optional]
    for i, (rel, required) in enumerate(files, 1):
        status(state="downloading", msg=f"Downloading the game ({i}/{len(files)}): {rel.split('/')[-1]}", progress=i / len(files))
        dest = os.path.join(tmp, *rel.split("/"))
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        old = os.path.join(prev_dir, *rel.split("/")) if prev_dir else None
        url = SITE + "/" + rel
        if old and os.path.exists(old) and same_remote(url, old):
            shutil.copy2(old, dest)
            continue
        try:
            body, _ = fetch(url, timeout=90)
            with open(dest + ".part", "wb") as f:
                f.write(body)
            os.replace(dest + ".part", dest)
        except urllib.error.HTTPError as e:
            if required:
                raise RuntimeError(f"the game's file {rel} is missing on the site ({e.code})")
            log("optional file not on the site:", rel, e.code)
        except Exception:
            if required:
                raise
            log("optional file failed:", rel)
    with open(os.path.join(tmp, "page.html"), "w", encoding="utf-8") as f:
        f.write(page)
    return tmp


def finish_build(d, bid, mv):
    page = open(os.path.join(d, "page.html"), encoding="utf-8").read()
    out, notes = make_page(page, bid)
    with open(os.path.join(d, "index.html.new"), "w", encoding="utf-8") as f:
        f.write(out)
    os.replace(os.path.join(d, "index.html.new"), os.path.join(d, "index.html"))
    meta = {"id": bid, "manager": mv, "built": time.strftime("%Y-%m-%d %H:%M"), "notes": notes}
    with open(os.path.join(d, "build.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f)
    return meta


def update_game():
    status(state="checking", msg="Checking for game updates", progress=0)
    mv = manager_version()
    idx = builds_index()
    idx = [b for b in idx if os.path.isfile(os.path.join(BUILDS, b["id"], "page.html"))]
    page = None
    try:
        body, _ = fetch(SITE + "/", timeout=15)
        page = body.decode("utf-8")
        bid = build_id_of(page)
        game_script_span(page)
    except Exception as e:
        log("game check failed:", e)
        status(offline=True)
        if not idx:
            raise RuntimeError("Couldn't download the game from " + SITE + " (" + str(e) + "). Connect to the internet for the first start.")
        bid = None
    if page and bid and not any(b["id"] == bid for b in idx):
        log("new game version:", bid)
        prev = os.path.join(BUILDS, idx[0]["id"]) if idx else None
        tmp = download_build(page, bid, prev)
        status(state="building", msg="Getting the game ready", progress=1)
        finish_build(tmp, bid, mv)
        final = os.path.join(BUILDS, bid)
        if os.path.exists(final):
            shutil.rmtree(final, ignore_errors=True)
        os.replace(tmp, final)
        idx.insert(0, {"id": bid, "first_seen": time.strftime("%Y-%m-%d %H:%M")})
        if len(idx) > 1:
            STATUS["notes"].append(f"Game updated: {idx[1]['id']} -> {bid}")
    # rebuild versions made by an older version of the app (no download needed), and fetch any file they lack
    for b in idx[:KEEP]:
        d = os.path.join(BUILDS, b["id"])
        if not STATUS["offline"]:
            try:
                kept = open(os.path.join(d, "page.html"), encoding="utf-8").read()
                need, optional = asset_list(kept)
                for rel in need + optional:
                    dest = os.path.join(d, *rel.split("/"))
                    if os.path.exists(dest) and os.path.getsize(dest) > 0:
                        continue
                    status(state="downloading", msg="Fetching a missing file: " + rel.split("/")[-1], progress=1)
                    try:
                        body, _ = fetch(SITE + "/" + rel, timeout=90)
                        os.makedirs(os.path.dirname(dest), exist_ok=True)
                        with open(dest + ".part", "wb") as f:
                            f.write(body)
                        os.replace(dest + ".part", dest)
                        log("repaired", b["id"], rel)
                    except Exception as e:
                        log("repair skipped", rel, e)
            except Exception as e:
                log("repair check failed", b["id"], e)
        try:
            meta = json.load(open(os.path.join(d, "build.json"), encoding="utf-8"))
        except Exception:
            meta = {}
        if meta.get("manager") != mv or not os.path.isfile(os.path.join(d, "index.html")):
            status(state="building", msg=f"Updating game version {b['id']} for the app update", progress=1)
            finish_build(d, b["id"], mv)
    # keep the newest + one previous version
    for b in idx[KEEP:]:
        shutil.rmtree(os.path.join(BUILDS, b["id"]), ignore_errors=True)
        log("removed old game version", b["id"])
    idx = idx[:KEEP]
    save_index(idx)
    out = []
    for b in idx:
        try:
            meta = json.load(open(os.path.join(BUILDS, b["id"], "build.json"), encoding="utf-8"))
        except Exception:
            meta = {}
        out.append({"id": b["id"], "first_seen": b.get("first_seen"), "notes": meta.get("notes", [])})
    status(state="ready", msg="Ready", progress=1, builds=out, latest=idx[0]["id"] if idx else None)


def worker():
    try:
        update_game()
    except Exception as e:
        log("update failed:", repr(e))
        idx = builds_index()
        if idx and all(os.path.isfile(os.path.join(BUILDS, b["id"], "index.html")) for b in idx):
            status(state="ready", msg="Ready (couldn't update: " + str(e) + ")", builds=[{"id": b["id"], "notes": []} for b in idx], latest=idx[0]["id"], error=str(e))
        else:
            status(state="error", msg=str(e), error=str(e))


# ---------------------------------------------------------------- 3. local web server (this computer only)
LAST_PING = [0.0]
STARTED = time.time()
SERVER = [None]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=BUILDS, **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _send(self, code, body, ctype):
        b = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/__uvm/ping":
            LAST_PING[0] = time.time()
            return self._send(200, "ok", "text/plain")
        if path == "/__uvm/status":
            with SLOCK:
                return self._send(200, json.dumps({**STATUS, "app": "uvm", "port": PORT}), "application/json")
        if path in ("/", "/index.html"):
            return self._send(200, open(os.path.join(APP, "boot.html"), "rb").read(), "text/html; charset=utf-8")
        if path == "/uvm_loader.js":
            return self._send(200, open(os.path.join(APP, "uvm_loader.js"), "rb").read(), "application/javascript")
        if path == "/favicon.ico" and os.path.isfile(os.path.join(APP, "icon.ico")):
            return self._send(200, open(os.path.join(APP, "icon.ico"), "rb").read(), "image/x-icon")
        if path.startswith("/builds/"):
            self.path = self.path[len("/builds"):]
            rel = os.path.normpath(self.path.split("?", 1)[0].lstrip("/"))
            if rel.startswith("..") or os.path.isabs(rel) or rel.endswith("page.html"):
                return self._send(404, "not found", "text/plain")
            return super().do_GET()
        return self._send(404, "not found", "text/plain")

    def do_POST(self):
        if self.path.split("?", 1)[0] == "/__uvm/retry":
            with SLOCK:
                busy = STATUS["state"] in ("checking", "downloading", "building")
            if not busy:
                threading.Thread(target=worker, daemon=True).start()
            return self._send(200, "ok", "text/plain")
        return self._send(404, "not found", "text/plain")


def ours_running():
    try:
        body, _ = fetch(f"http://127.0.0.1:{PORT}/__uvm/status", timeout=2)
        return json.loads(body).get("app") == "uvm"
    except Exception:
        return False


# ---------------------------------------------------------------- 4. the game window
def browser_path():
    if os.name != "nt":
        for n in ("microsoft-edge", "google-chrome", "chromium", "chromium-browser"):
            p = shutil.which(n)
            if p:
                return p
        return None
    cands = []
    for base in (os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles"), os.environ.get("LOCALAPPDATA")):
        if base:
            cands += [os.path.join(base, "Microsoft", "Edge", "Application", "msedge.exe"),
                      os.path.join(base, "Google", "Chrome", "Application", "chrome.exe")]
    return next((c for c in cands if os.path.isfile(c)), None)


BROWSER = [None]


def open_window(url):
    if NO_WINDOW:
        return
    exe = browser_path()
    if exe:
        profile = os.path.join(DATA, "browser-profile")   # its own profile: your mods and settings live here
        args = [exe, "--app=" + url, "--user-data-dir=" + profile, "--no-first-run", "--no-default-browser-check",
                "--window-size=1280,760", "--autoplay-policy=no-user-gesture-required", "--disable-features=Translate"]
        try:
            flags = 0x08000000 if os.name == "nt" else 0   # CREATE_NO_WINDOW
            BROWSER[0] = subprocess.Popen(args, creationflags=flags)
            log("window:", exe)
            return
        except Exception as e:
            log("app window failed, using the default browser:", e)
    webbrowser.open(url)


def watchdog():
    """Quit when the game window has closed (its browser exited, or no page has pinged for a while)."""
    while True:
        time.sleep(3)
        now = time.time()
        proc = BROWSER[0]
        if proc is not None and proc.poll() is None:
            continue
        idle = now - (LAST_PING[0] or STARTED)
        if (proc is not None and idle > 6) or idle > (150 if LAST_PING[0] else 300):   # background tabs only run timers about once a minute
            log("game window closed; stopping")
            if SERVER[0]:
                threading.Thread(target=SERVER[0].shutdown, daemon=True).start()
            return


# ---------------------------------------------------------------- 5. shortcuts (first start from the bundled Python)
def make_shortcuts():
    """Desktop + Start menu shortcuts. Also replaces the old "Uma Versus (Modded)" ones from before the rename."""
    if os.name != "nt":
        return
    flag = os.path.join(DATA, "shortcuts-desktop.done")
    pyw = os.path.join(ROOT, "runtime", "pythonw.exe")
    exe = next((p for p in (os.path.join(ROOT, n) for n in ("Uma Versus Desktop.exe", "Uma Versus Modded.exe")) if os.path.isfile(p)), None)
    if os.path.exists(flag) or not os.path.isfile(pyw):
        return
    q = lambda p: p.replace("'", "''")   # PowerShell single-quoted string
    icon = os.path.join(APP, "icon.ico")
    lnk, old = APP_NAME + ".lnk", "Uma Versus (Modded).lnk"
    ps = []
    for folder in ("([Environment]::GetFolderPath('Desktop'))", "([Environment]::GetFolderPath('Programs'))"):
        ps.append(
            "Remove-Item -LiteralPath (Join-Path " + folder + " '" + old + "') -ErrorAction SilentlyContinue;"
            "$s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path " + folder + " '" + lnk + "'));"
            + (f"$s.TargetPath='{q(exe)}';$s.Arguments='';" if exe else f"$s.TargetPath='{q(pyw)}';$s.Arguments='\"{q(os.path.join(APP, 'launcher.py'))}\"';") +
            f"$s.WorkingDirectory='{q(ROOT)}';"
            f"$s.IconLocation='{q(icon)}';$s.Description='Uma Versus desktop app (mod loader included)';$s.Save();")
    check = ("$d=[Environment]::GetFolderPath('Desktop');$p=[Environment]::GetFolderPath('Programs');"
             "if ((Test-Path (Join-Path $d '" + lnk + "')) -and (Test-Path (Join-Path $p '" + lnk + "'))) { 'UVM-SHORTCUTS-OK' }")
    try:
        r = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "".join(ps) + check],
                           creationflags=0x08000000, timeout=30, check=False, capture_output=True, text=True)
        if "UVM-SHORTCUTS-OK" in (r.stdout or ""):
            open(flag, "w").write(time.strftime("%Y-%m-%d"))
            log("shortcuts made")
        else:
            log("shortcuts not made (will try again next start):", r.returncode, (r.stderr or "")[:200])
    except Exception as e:
        log("shortcuts failed (will try again next start):", e)


# ---------------------------------------------------------------- main
def main():
    log("---- start", sys.version.split()[0], "root", ROOT)
    url = f"http://localhost:{PORT}/"
    if ours_running():
        log("already running: opening a window")
        open_window(url)
        return
    if self_update() and os.environ.get("UVM_REEXEC") != "1":
        log("launcher updated: restarting it")
        os.environ["UVM_REEXEC"] = "1"
        os.execv(sys.executable, [sys.executable, os.path.abspath(__file__)] + sys.argv[1:])
    try:
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        alert(f"Port {PORT} is used by another program, so the game can't start.\nClose that program and try again.")
        return
    SERVER[0] = srv
    threading.Thread(target=worker, daemon=True).start()
    threading.Thread(target=make_shortcuts, daemon=True).start()
    open_window(url)
    threading.Thread(target=watchdog, daemon=True).start()
    log("serving", url)
    try:
        srv.serve_forever()
    finally:
        srv.server_close()
        log("---- stopped")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        log(traceback.format_exc())
        alert(APP_NAME + " couldn't start:\n" + str(e) + "\n\nDetails are in data\\launcher.log")
