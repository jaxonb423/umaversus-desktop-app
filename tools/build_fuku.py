#!/usr/bin/env python3
"""Build mods/fuku/fuku.uvmod.js from the pieces of the standalone Fuku installer (v4).

    python tools/build_fuku.py <path to the standalone fuku install.py> mods/fuku/fuku.uvmod.js

Changes from the standalone version, for online play:
  * gameplay rolls (Omikuji, Prayer luck, Dice Shot) use the game's own seeded rnd(), so
    rollback netplay replays them identically on both screens (cosmetic sparks keep Math.random)
  * Classic / Expanded is a mod setting (baked in at start, part of the online fingerprint)
  * Divine Lightning on a Carnage fighter (Nixon mod) lands as his own strong hit;
    Fate Swap keeps a Carnage fighter's HP on his 1/12 steps
"""
import importlib.util, json, sys

spec = importlib.util.spec_from_file_location("fukuinst", sys.argv[1])
F = importlib.util.module_from_spec(spec); sys.argv_backup = sys.argv; spec.loader.exec_module(F)
out = sys.argv[2]


def must_replace(s, old, new, n=1):
    c = s.count(old)
    if c != n:
        sys.exit(f"expected {n}x {old[:70]!r}, found {c}")
    return s.replace(old, new)


assets = F.FUKU_ASSETS.replace("assets/sprites/fuku_r.png", "{{file:fuku_r.png}}").replace("assets/sprites/fuku.png", "{{file:fuku.png}}")

ev = F.FUKU_DOEVENT
ev = must_replace(ev, "var FUKU_EXP = p.cid === 'fuku' && !(typeof SET !== 'undefined' && SET.fukuClassic);",
                  "var FUKU_EXP = p.cid === 'fuku' && FUKU_MODE_EXP;")
ev = must_replace(ev, "  // Fukukitaru mod. SET.fukuClassic = true -> the original 5 slips only (Options / pause menu toggle).\n",
                  "  // Fukukitaru mod. Omikuji setting (Mods > Edit): Expanded or Classic (the original 5 slips).\n"
                  "  // Gameplay rolls use the game's seeded rnd() so online rollback stays in sync.\n")
ev = must_replace(ev, "var die = 1 + Math.floor(Math.random() * 6)", "var die = 1 + Math.floor(rnd() * 6)")
ev = must_replace(ev, "var r = Math.random(); return r < 0.12", "var r = rnd(); return r < 0.12")
ev = must_replace(ev, "var r = Math.random(); return r < 0.15", "var r = rnd(); return r < 0.15")
ev = must_replace(ev, "Math.random() < (p.fukuLuck || 0)", "rnd() < (p.fukuLuck || 0)")
# lightning on a Carnage fighter: his own strong hit (freeze, fly-back, 1/12 of the bar)
ev = must_replace(ev, "          if (hurtboxOK(o) && !invulnerable(o, false)) {\n            var dmg = 1800;",
                  "          if (o.c.ec && typeof ecStrongHit === 'function') {\n"
                  "            if (hurtboxOK(o) && !invulnerable(o, false) && !o.ecLaunch) ecStrongHit(p, o, p.x); else addText('MISS', o.x, GY - 200, '#cfe3ff', 22, 40);\n"
                  "          } else if (hurtboxOK(o) && !invulnerable(o, false)) {\n            var dmg = 1800;")
# Fate Swap: a Carnage fighter's HP stays on whole twelfths
ev = must_replace(ev, "          p.hp = Math.max(1, Math.round(theirs * p.c.hp)); o.hp = Math.max(1, Math.round(mine * o.c.hp));",
                  "          var snap = function (d, pct) { return d.c.ec ? Math.max(1, Math.round(Math.max(1, Math.round(pct * 12)) * d.c.hp / 12)) : Math.max(1, Math.round(pct * d.c.hp)); };\n"
                  "          p.hp = snap(p, theirs); o.hp = snap(o, mine);")
assert "Math.random()" not in ev.replace("Math.random() - .5) * 50", "").replace("Math.random() * 220", "").replace("Math.random() * 6", ""), "a gameplay Math.random is left"

mode = """
/* >>> fuku mode */
// Fukukitaru mod: Omikuji setting, baked in when the game starts (changing it needs a restart).
const FUKU_MODE_EXP = {{setting:omikuji}} === 'expanded';
function fukuApplyMode() {
  var c = typeof CHARS !== 'undefined' && CHARS.fuku; if (!c) return;
  ['5S', '5S.L', '5SX'].forEach(function (k) { if (c.moves[k]) c.moves[k].name = FUKU_MODE_EXP ? 'Dice Shot' : 'Fortune Shot'; });
  if (c.moves['5S']) c.moves['5S'].note = FUKU_MODE_EXP ? 'Charm projectile, damage rolled on a die (1-6)' : 'Charm projectile';
  if (c.moves['4S']) c.moves['4S'].note = FUKU_MODE_EXP ? 'Draw a fortune slip -- 7 slips; taunt first for luck' : 'Draw a fortune slip -- blessing or curse';
  if (typeof Music !== 'undefined' && typeof MUSIC_URL === 'string' && !Music.urls.fuku) Music.urls.fuku = MUSIC_URL + 'spe.mp3';   // her stage plays Special Week's theme
}
setTimeout(function () { try { fukuApplyMode(); } catch (e) {} }, 0);
/* <<< fuku mode */
"""

patches = [
    {"note": "sprite sheet", "find": "const ASSETS = {", "after": assets},
    {"note": "fighter", "re": r"\bCHARS\s*=\s*\{", "replace": "CHARS = {" + F.FUKU_CHARS.replace("[MOD - offline only]", "[umaversus-mods: fuku]")},
    {"note": "roster", "re": r"(const ROSTER = \[[^\]]*)\]", "replace": "$1, 'fuku']"},
    {"note": "Omikuji mode + music", "find": "function doEvent(p, ev) {", "before": mode.lstrip("\n")},
    {"note": "Omikuji, Dice Shot, Prayer", "find": "function doEvent(p, ev) {", "after": ev},
    {"note": "select-screen name", "find": "const DISPLAY = {", "after": " fuku: 'MATIKANE FUKUKITARU',"},
]
for name, payload in F.FUKU_TABLES:
    patches.append({"note": name, "find": f"const {name} = {{", "after": payload})
# the BLURB fix etc. are already in FUKU_CHARS

header = """// ==UmaMod==
// @id          fuku
// @name        Matikanefukukitaru
// @version     1.0.0
// @author      jaxonb423
// @kind        fighter
// @build       48dacc
// @description Fortune-teller runner: Dice Shot, Spirit Spin, Charm Tackle and the Omikuji gamble -- divine lightning, Fate Swap, curses and all.
// @tags        fighter gamble omikuji party-dash
// @homepage    https://github.com/jaxonb423/umaversus-mods/tree/main/mods/fuku
// ==/UmaMod==
//
// Generated by tools/build_fuku.py. Sprites: Umamusume Pretty Derby Party Dash rip (The Spriters Resource).
// Every patch is plain text applied to the game's code when it starts; see the README for the format.
"""


def js_str(s):
    if "`" in s or "${" in s:
        return json.dumps(s)
    return "String.raw`" + s + "`"


F.FUKU_CHARS = must_replace(F.FUKU_CHARS, "[MOD - offline only]", "[umaversus-mods: fuku]")
body = ["uvmod({",
        "  settings: {",
        "    omikuji: { label: 'Omikuji', type: 'select', default: 'expanded', sync: true,",
        "      options: [['expanded', 'Expanded (7 slips, Dice Shot, Prayer)'], ['classic', 'Classic (the original 5 slips)']] },",
        "  },",
        "  files: ['fuku.png', 'fuku_r.png'],",
        "  patches: ["]
for p in patches:
    parts = []
    for k, v in p.items():
        parts.append(f"{k}: {js_str(v) if isinstance(v, str) and k not in ('note',) else json.dumps(v)}")
    body.append("    { " + ",\n      ".join(parts) + " },")
body += ["  ],", "});", ""]
open(out, "w", encoding="utf-8").write(header + "\n".join(body))
print("wrote", out)
