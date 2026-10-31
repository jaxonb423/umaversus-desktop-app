#!/usr/bin/env python3
"""Build mods/nixon/nixon.uvmod.js from the Nixon v5 package.

    python tools/build_nixon.py <nixon_v5 folder> mods/nixon/nixon.uvmod.js

Takes the exact text patches of dev/add_nixon_ec4.py, plus Nixon's data (sprites, Carnage
animation data, engine, effects, sounds) lifted from the finished index.nixon.html, so the mod
builds him exactly the way his installer does. Then four changes for online play:
  1. the stone order is shuffled with the game's seeded rnd() (was Math.random: each player
     would get a different order)
  2. his super's state (G.ecSup) is saved/restored by the rollback snapshots
  3. "same hit" detection uses a stable key instead of an object reference (references go
     stale when a rollback restores copies)
  4. online, the shoulder-button shortcuts check your own side, not always player 1
Plus Arcade data (rival, lines, ending): v5 had none, so Arcade crashed whenever he was the
player or showed up as an opponent. His only line is his own well-known quote.
"""
import ast, json, os, sys

src_dir, out = sys.argv[1], sys.argv[2]
script = open(os.path.join(src_dir, "dev", "add_nixon_ec4.py"), encoding="utf-8").read()
built = open(os.path.join(src_dir, "index.nixon.html"), encoding="utf-8").read()
char_js = open(os.path.join(src_dir, "dev", "nixon_ec_char.js"), encoding="utf-8").read().rstrip() + "\n"

# ---- the static sub(old, new) calls, in order
subs = []
for node in ast.walk(ast.parse(script)):
    if isinstance(node, ast.Call) and getattr(node.func, "id", None) == "sub":
        try:
            subs.append((node.lineno, ast.literal_eval(node.args[0]), ast.literal_eval(node.args[1])))
        except Exception:
            subs.append((node.lineno, None, None))   # the data subs, rebuilt below
subs.sort()

# ---- the data subs, from the finished page
i0 = built.find("const NIXON_EC = "); i1 = built.find("const CHARS = {\n", i0)
pre_chars = built[i0:i1]
assert built[i1 + len("const CHARS = {\n"):].startswith(char_js), "char block differs from dev/nixon_ec_char.js"
a0 = built.find('const ASSETS = {"nixon": ') + len('const ASSETS = {"nixon": ')
a1 = built.find(', "spe": {', a0)
nixon_assets = json.loads(built[a0:a1])

patches = []
for line, old, new in subs:
    if old is None:
        continue
    patches.append({"note": f"add_nixon_ec4.py:{line}", "find": old, "replace": new})
# data (same order as the script: CHARS, ASSETS; ROSTER is a static sub above)
patches.append({"note": "engine + data", "find": "const CHARS = {\n", "replace": pre_chars + "const CHARS = {\n" + char_js})
patches.append({"note": "sprite sheet", "find": "const ASSETS = {", "replace": 'const ASSETS = {"nixon": ' + json.dumps(nixon_assets, separators=(",", ":")) + ", "})


def fix(note_line, old, new):
    for p in patches:
        if p["note"] == f"add_nixon_ec4.py:{note_line}":
            assert p["replace"].count(old) == 1, (note_line, old)
            p["replace"] = p["replace"].replace(old, new); return
    sys.exit(f"no patch from line {note_line}")


# 1. stones: seeded shuffle
fix(106, "stoneScramble(Math.floor(Math.random() * 10000000))", "stoneScramble(Math.floor(rnd() * 10000000))")
# 3. stable "same hit" key
fix(149, "const key = proj || (a.move ?", "const key = proj ? (proj.uvk || (proj.uvk = 'q' + G.frameCount + '/' + G.projs.indexOf(proj))) : (a.move ?")
# 4. online: your own side
for p in patches:
    if "if (!(G.p && G.p[i] && G.p[i].c.ec)) {" in p["replace"]:
        p["replace"] = p["replace"].replace("if (!(G.p && G.p[i] && G.p[i].c.ec)) {",
                                            "if (!(G.p && G.p[G.mode === 'online' ? Net.side : i] && G.p[G.mode === 'online' ? Net.side : i].c.ec)) {")
# 2. super state in rollback snapshots (G.ecSup holds fighter references: save sides, re-link on restore)
patches.append({"note": "online: snapshot super", "find": "  for (const k of G_KEYS) s[k] = G[k];\n  return s;",
                "replace": "  for (const k of G_KEYS) s[k] = G[k];\n  s.ecSup = G.ecSup ? { ...G.ecSup, p: G.ecSup.p.side, o: G.ecSup.o.side } : null;\n  return s;"})
patches.append({"note": "online: restore super", "find": "  for (const k of G_KEYS) G[k] = s[k];\n",
                "after": "  G.ecSup = s.ecSup ? { ...s.ecSup, p: G.p[s.ecSup.p], o: G.p[s.ecSup.o] } : null;\n"})

# 5. Arcade tables (missing in v5: LINES[...] / RIVAL[...] are read with no fallback)
arcade = [
    ("RIVAL", " nixon: 'spe',"),
    ("LINES", "\n  nixon: { intro: ['I am not a crook.', 'I am not a crook.'], win: ['I am not a crook.'] },"),
    ("RIVAL_LINE", "\n  nixon: 'A runner from another game? A race is a race, and I\\'m not losing this one!',"),
    ("ENDINGS", "\n  nixon: ['ARCADE CLEAR: Nixon, straight out of Electoral Carnage.',\n    'Carnage rules all the way: twelve hits a bar, Dream Stones for meter, no blocking.',\n    'Mod: umaversus-mods / nixon. Art and sounds from Electoral Carnage. Thanks for playing!'],"),
]
for name, payload in arcade:
    patches.append({"note": f"arcade: {name}", "find": f"const {name} = {{", "after": payload})

header = """// ==UmaMod==
// @id          nixon
// @name        Nixon (Electoral Carnage)
// @version     5.1.0
// @author      jaxonb423
// @kind        fighter
// @build       48dacc
// @description Richard Nixon with his full Electoral Carnage kit: stars, lightning, slam, float, Dream Stones and the Not A Crook super. Carnage rules, 12-hit health.
// @tags        fighter carnage electoral-carnage nixon
// @homepage    https://github.com/jaxonb423/umaversus-mods/tree/main/mods/nixon
// ==/UmaMod==
//
// Generated by tools/build_nixon.py from Nixon v5 (dev/add_nixon_ec4.py + index.nixon.html),
// with four changes so he stays in sync online (see the tool). Art and sounds: Electoral Carnage.
"""
body = "uvmod({\n  settings: {},\n  files: [],\n  patches: [\n" + ",\n".join("    " + json.dumps(p, ensure_ascii=False) for p in patches) + "\n  ],\n});\n"
open(out, "w", encoding="utf-8").write(header + body)
print(f"wrote {out}: {len(patches)} patches, {os.path.getsize(out) // 1024} KB")
