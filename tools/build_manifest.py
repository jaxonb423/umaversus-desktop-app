#!/usr/bin/env python3
"""Write manifest.json: the files the launcher keeps up to date from this repo (sha256 each)."""
import hashlib, json, os, sys, time
root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = {}
for n in sorted(os.listdir(os.path.join(root, "app"))):
    p = os.path.join(root, "app", n)
    if os.path.isfile(p) and not n.endswith((".pyc", ".log")):
        files["app/" + n] = hashlib.sha256(open(p, "rb").read()).hexdigest()
ver = hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()[:8]
json.dump({"version": time.strftime("%Y.%m.%d-") + ver, "files": files}, open(os.path.join(root, "manifest.json"), "w"), indent=1)
print("manifest:", len(files), "files, version", ver)
