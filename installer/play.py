#!/usr/bin/env python3
"""
Serve the modded Uma Versus folder on http://localhost:8777 and open it in the browser.

    py play.py                  (serves the folder this file is in)
    py play.py C:\\path\\to\\umaversus_modded

The port never changes: your mods and settings are saved per http://localhost:PORT, so a
different port would look like an empty mod list. If the game is already running, this just
opens the browser to it. Only this computer can reach the server (127.0.0.1).
Close this window (or press Ctrl+C) to stop it.
"""
import os, sys, socket, threading, webbrowser, functools, urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PORT = 8777


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")   # always the current files
        super().end_headers()

    def log_message(self, *a):
        pass


def already_running(url):
    try:
        with urllib.request.urlopen(url, timeout=2) as r:
            return b'id="uv-game"' in r.read(400000)
    except Exception:
        return False


def main():
    root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__)))
    if not os.path.isfile(os.path.join(root, "index.html")):
        raise SystemExit("index.html not found in " + root)
    url = "http://localhost:%d/index.html" % PORT
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Handler, directory=root))
    except OSError:
        if already_running(url):
            print("Uma Versus is already running at", url, "- opening it.")
            webbrowser.open(url)
            return
        raise SystemExit("Port %d is in use by another program. Close it and try again." % PORT)
    print("Uma Versus (modded) running at", url)
    print("Serving", root)
    print("Leave this window open while you play. Close it or press Ctrl+C to stop.")
    print("Something broken after adding a mod? Open %s?mods=off to start with every mod off." % url)
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


if __name__ == "__main__":
    main()
