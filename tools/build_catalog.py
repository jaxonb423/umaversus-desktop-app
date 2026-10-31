#!/usr/bin/env python3
"""Rebuild catalog.json from the @headers of every mods/<id>/<id>.uvmod.js (+ its files' sizes)."""
import json, os, re, sys
root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mods = []
for mid in sorted(os.listdir(os.path.join(root, 'mods'))):
    d = os.path.join(root, 'mods', mid); f = os.path.join(d, mid + '.uvmod.js')
    if not os.path.isfile(f):
        continue
    src = open(f, encoding='utf-8').read()
    h = re.search(r'==UmaMod==([\s\S]*?)==/UmaMod==', src).group(1)
    m = {k: v.strip() for k, v in re.findall(r'//\s*@(\w+)\s+(.*)', h)}
    files = re.search(r'files:\s*\[([^\]]*)\]', src); names = re.findall(r"'([^']+)'", files.group(1)) if files else []
    n = os.path.getsize(f) + sum(os.path.getsize(os.path.join(d, x)) for x in names)
    e = {"id": m['id'], "name": m['name'], "version": m['version'], "author": m['author'], "kind": m.get('kind', ''), "build": m.get('build', ''),
         "description": m['description'], "tags": m.get('tags', '').split(), "url": f"mods/{mid}/{mid}.uvmod.js",
         "homepage": m.get('homepage', ''), "size": f"{n / 1048576:.1f} MB" if n >= 1048576 else f"{round(n / 1024)} KB"}
    for k in ('icon', 'banner'):
        if os.path.isfile(os.path.join(d, k + '.png')):
            e[k] = f"mods/{mid}/{k}.png"
    mods.append(e)
json.dump({"version": 1, "name": "Uma Versus mods", "mods": mods}, open(os.path.join(root, 'catalog.json'), 'w'), indent=2, ensure_ascii=False)
print('catalog:', ', '.join(f"{e['id']} {e['version']} ({e['size']})" for e in mods))
