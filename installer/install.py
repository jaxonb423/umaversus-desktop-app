#!/usr/bin/env python3
"""
Uma Versus Mod Manager -- installer.

Builds a local copy of Uma Versus (umaversus.lol) with a MODS tab. Mods come from the
catalog at github.com/jaxonb423/umaversus-mods and are turned on and off inside the game.

    py install.py                          first run: downloads the game (~50 MB) and starts it
    py install.py --from "C:\\...\\umaversus_local"   reuse sprites/music you already have
    py install.py --no-play                build only, don't start it

Afterwards just double-click PLAY.bat in the umaversus_modded folder.

What the game gets (only while at least one mod is running):
  * its build string gets a fingerprint of your mods, so the game's own version check only lets
    players with the exact same mods + settings into the same room,
  * each match gets a random seed (online: from the room's shared match key) so gambles differ
    every match but stay identical on both screens,
  * online results are not sent to the official leaderboard, and rooms are not listed publicly.
With every mod off, the game is the normal game.
"""
import argparse, os, re, shutil, sys, urllib.request

SITE = "https://umaversus.lol"
HERE = os.path.dirname(os.path.abspath(__file__))
RUNNERS = "spe suz gs vo ds mm tt kb jp at mc df".split()
SPRITES = [f"{c}{s}.png" for c in RUNNERS for s in ("", "_r")]
MUSIC = [f"{c}.mp3" for c in ["menu"] + RUNNERS]
TESTED_BUILD = "48dacc"


def die(msg):
    print("ERROR:", msg)
    sys.exit(1)


def fetch(url, dest=None):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (uvm installer)"})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = r.read()
    if dest:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest + ".part", "wb") as f:
            f.write(data)
        os.replace(dest + ".part", dest)
    return data


# ---------------------------------------------------------------- core patches (exact anchors, each must appear once)
def core_patches(ui_js):
    G = "(typeof UVM !== 'undefined' && UVM.active)"
    return [
        # build fingerprint: only identical mod sets meet online (the game's own version check does the rest)
        ("re", r"const BUILD = '([a-z0-9]+)';", r"const BUILD = '\1' + ((typeof UVM !== 'undefined' && UVM.tag) || '');"),
        # per-match seed for the game's own RNG (rnd); vanilla keeps rs = 7 when no mod runs
        ("after", "G.mode = mode; rs = 7;", f" if {G} rs = UVM.seed(mode); G.seed = rs;"),
        # replays remember the seed, so modded replays play back exactly
        ("after", "nframes: frames.length / 2,", " seed: G.seed,"),
        ("after", "startMatch('replay', r.c[0], r.c[1], r.pal);", " rs = r.seed !== undefined ? r.seed : 7; G.seed = rs;"),
        # official backend: no leaderboard results and no public room listing while mods run
        ("after", "async function acctRecord() {", f"\n  if {G} return;   // mods: keep modded matches off the official leaderboard"),
        ("after", "function roomBeat(first) {", f"\n  if {G} return;   // mods: modded rooms are not listed publicly (join by code)"),
        # never send a vanilla game ids it doesn't have (its lobby would crash showing them) until both builds match
        ("after", "function netSend(obj) {",
         f"\n  if ({G} && obj && obj.t === 'lobby' && Net.theirBuild !== BUILD) obj = {{ ...obj, pick: obj.pick >= 0 && obj.pick < THEME_IDS.length ? obj.pick : 0, music: THEME_IDS.includes(obj.music) ? obj.music : null }};"),
        ("replace", "'You both need the same version. Grab the latest copy and try again.'",
         "((BUILD + Net.theirBuild).includes('+m') ? 'Modded: you both need the same mods and mod settings (MODS tab), same game build.' : 'You both need the same version. Grab the latest copy and try again.')"),
        # the MODS tab
        ("before", "['OPTIONS', 'sound', 'Volume and display settings']", "['MODS', 'mods', 'Add runners and changes from the mod catalog'], "),
        ("replace", "if (m === 'moves') { UI.screen = 'moves'; UI.back = 'mode'; }",
         "if (m === 'mods') uvmOpen();\n        else if (m === 'moves') { UI.screen = 'moves'; UI.back = 'mode'; }"),
        ("after", "case 'sound': drawSound(); break;", "\n    case 'mods': case 'modcat': case 'modedit': uvmDraw(); break;"),
        ("before", "  if (UI.screen === 'sound') {",
         "  if (UI.screen === 'mods' || UI.screen === 'modcat' || UI.screen === 'modedit') { uvmTick(orEdges(me[0], me[1]), enter, esc); return; }\n"),
        ("replace", "'sound', 'account'];", "'sound', 'account', 'mods', 'modcat', 'modedit'];"),
        ("after", "const GHOST = { ", "mods: 'MODS', modcat: 'CATALOG', modedit: 'MOD', "),
        ("before", "function renderScreen() {", ui_js + "\n"),
    ]


def apply_core(code, patches):
    for kind, find, text in patches:
        if kind == "re":
            n = len(re.findall(find, code))
            if n != 1:
                die(f"game layout changed: pattern {find!r} found {n}x")
            code = re.sub(find, text, code)
            continue
        n = code.count(find)
        if n != 1:
            die(f"game layout changed: {find[:60]!r} found {n}x (this installer was made for build {TESTED_BUILD})")
        code = code.replace(find, find + text if kind == "after" else text + find if kind == "before" else text)
    return code


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="src", help="an existing local Uma Versus folder to copy sprites/music from")
    ap.add_argument("--dir", default=os.path.join(HERE, "umaversus_modded"), help="where to build the game")
    ap.add_argument("--no-play", action="store_true")
    a = ap.parse_args()
    root = os.path.abspath(a.dir)
    os.makedirs(root, exist_ok=True)

    print("Downloading the current game page from", SITE)
    html = fetch(SITE + "/").decode("utf-8")
    m = re.search(r"const BUILD = '([a-z0-9]+)';", html)
    if not m:
        die("couldn't read the game's build from umaversus.lol")
    build = m.group(1)
    if "uv-game" in html or "ROSTER = ['nixon'" in html:
        die("that page is already modded?")
    print("Game build:", build, "" if build == TESTED_BUILD else f"(this installer was tested on {TESTED_BUILD}; mods may need updates)")

    # ---- wrap the game script so the loader can patch it before it runs
    start = html.find("const ASSETS = {")
    open_tag = html.rfind("<script>", 0, start)
    close_tag = html.find("</script>", start)
    if start < 0 or open_tag < 0 or close_tag < 0 or html[open_tag + 8:start].strip():
        die("couldn't find the game script")
    game = html[open_tag + 8:close_tag]
    ui = open(os.path.join(HERE, "uvm_ui.js"), encoding="utf-8").read()
    loader = open(os.path.join(HERE, "uvm_loader.js"), encoding="utf-8").read()
    game = apply_core(game, core_patches(ui))
    if "</script" in game.lower():
        die("game code contains a closing script tag")
    out = (html[:open_tag] + '<script type="text/x-uv-game" id="uv-game">' + game + "</script>\n<script>\n" + loader + "\n</script>"
           + html[close_tag + len("</script>"):])
    with open(os.path.join(root, "index.html"), "w", encoding="utf-8") as f:
        f.write(out)
    print("Built", os.path.join(root, "index.html"))

    # ---- sprites + music (copied from --from when possible, else downloaded once)
    files = [("sprites", n) for n in SPRITES] + [("music", n) for n in MUSIC]
    for i, (kind, n) in enumerate(files, 1):
        dest = os.path.join(root, "assets", kind, n)
        if os.path.exists(dest) and os.path.getsize(dest) > 1000:
            continue
        if a.src:
            src = os.path.join(a.src, "assets", kind, n)
            if os.path.exists(src) and os.path.getsize(src) > 1000:
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.copy2(src, dest)
                continue
        print(f"  [{i}/{len(files)}] downloading assets/{kind}/{n}", end="\r", flush=True)
        try:
            fetch(f"{SITE}/assets/{kind}/{n}", dest)
        except Exception as e:
            die(f"\ncould not download assets/{kind}/{n}: {e}\nCheck your internet and run again (finished files are kept).")
    print("Assets ready." + " " * 40)

    for f in ("play.py", "PLAY.bat"):
        shutil.copy2(os.path.join(HERE, f), os.path.join(root, f))
    print("Launcher:", os.path.join(root, "PLAY.bat"), " (double-click it next time)")
    if a.no_play:
        return
    sys.path.insert(0, HERE)
    import play
    sys.argv = [sys.argv[0], root]
    play.main()


if __name__ == "__main__":
    main()
