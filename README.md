# Uma Versus mods

A mod manager for [Uma Versus](https://umaversus.lol), plus the mod catalog it reads.
It adds a **MODS** tab to the game: your mods as cards with a banner, tags and an on/off
switch, a search box (names, creators or `#tags`), **+ ADD MOD** to browse this catalog or
install from a link, and **EDIT** for each mod's settings and updates.

Mods also work **online**: two players with the same mods can play modded 1v1s through
normal room codes.

> **Mods are code.** They change the game's code when it starts. Only install mods from
> people you trust. Mods in this catalog are reviewed before they're listed.

## Install (Windows)

You need [Python 3.8+](https://www.python.org/downloads/) (tick **Add Python to PATH**).

1. Download this repo: **Code → Download ZIP**, then unzip it.
2. Open the `installer` folder, Shift + right-click → **Open in Terminal**, and run:
   ```
   py install.py
   ```
   It downloads the current game from umaversus.lol (about 50 MB the first time), builds
   `installer\umaversus_modded`, and opens the game on `http://localhost:8777`.
   Already have a local copy (for example the old Nixon `umaversus_local` folder)? Reuse its
   sprites and music to skip the download:
   ```
   py install.py --from "C:\path\to\umaversus_local"
   ```
3. Next time: double-click **`PLAY.bat`** in `umaversus_modded`. Keep its window open while
   you play.

The port is always 8777. Your mods and settings are saved in the browser for
`http://localhost:8777`, so always start the game with `PLAY.bat`, never by double-clicking
`index.html` (opened as a file, the browser blocks the game's colour palettes and the
character select crashes).

**Something broken after adding a mod?** Open `http://localhost:8777/?mods=off` to start
with every mod off, then turn the culprit off or remove it.

## Using the MODS tab

Main menu → **MODS** (bottom bar, next to Options).

| | Keyboard / pad | Mouse |
|---|---|---|
| Move | arrows / stick | |
| Turn a mod on or off | **F** / Enter / Ⓐ | the switch |
| Settings, update, re-download | **G** (Edit) | **EDIT** |
| Remove | **Delete** twice | **REMOVE**, then **SURE?** |
| Search | **/** | the search box |
| Catalog | **+ ADD MOD** | |
| Back | **H** / Esc | |

Every change applies after a restart: press **RESTART** (top right). A card that failed to
load shows why in red (for example a game update moved something the mod patches); the game
starts without that mod.

## Modded online 1v1s

1. Both players install the manager and the **same mods**, with the **same settings**
   (settings marked *both players must match* on the Edit screen).
2. **Online** → make or join a room with a code, exactly as usual.

How it stays fair and in sync:

- **Fingerprint.** While mods run, the game's build reads like `48dacc+m7213c4`: the game
  build plus a fingerprint of your mods (ids, versions, code and synced settings). The
  game's own version check only lets identical setups into the same room, and the lobby
  tells you if your mods differ. Vanilla players can never end up in a modded match.
- **Deterministic.** Each match gets a random seed that both players derive from the room's
  shared match key, so gambles (Fukukitaru's Omikuji, Nixon's stone order) differ every match
  but come out identical on both screens. Rollback netcode replays them exactly.
- **Off the official services.** While mods run, match results are **not** sent to the
  leaderboard and rooms are **not** listed in the public room browser — join by code.
  With every mod off the game is the normal game, online and leaderboard included.
- Replays recorded with mods remember the seed and play back exactly (with the same mods).

## The catalog

| Mod | What it is |
|---|---|
| **Matikanefukukitaru** (`fuku`) | Fortune-teller runner: Dice Shot, Spirit Spin, Charm Tackle and the Omikuji gamble (divine lightning, Fate Swap, Double Draw, curses). Setting: *Expanded* or *Classic* Omikuji. Sprites: the Umamusume: Pretty Derby Party Dash rip from The Spriters Resource. |
| **Nixon (Electoral Carnage)** (`nixon`) | Nixon with his full Electoral Carnage kit and Carnage rules: stars, lightning, slam, float, Dream Stones and the Not A Crook super. Art and sounds from Electoral Carnage. |

Both were tested together on build `48dacc`: offline modes, Arcade, CPU, and a two-player
online match with forced rollbacks (no desyncs).

---

## Writing a mod

A mod is one `.js` file. It starts with a header and calls `uvmod({...})`:

```js
// ==UmaMod==
// @id          my-mod              (lowercase letters, numbers, dashes)
// @name        My Mod
// @version     1.0.0
// @author      you
// @kind        fighter             (anything: fighter, stage, tweak...)
// @build       48dacc              (the game build you tested on)
// @description One sentence about what it does.
// @tags        fighter fun         (space-separated, used by search)
// ==/UmaMod==
uvmod({
  settings: {
    speed: { label: 'Speed', type: 'select', default: 'normal', sync: true,
      options: [['normal', 'Normal'], ['fast', 'Fast']] },
  },
  files: ['mychar.png', 'mychar_r.png'],      // downloaded next to the .js, stored with the mod
  patches: [
    { find: 'const ASSETS = {', after: '"mychar": {"img": "{{file:mychar.png}}", ...}, ' },
    { re: String.raw`(const ROSTER = \[[^\]]*)\]`, replace: "$1, 'mychar']" },
    { find: 'function doEvent(p, ev) {', after: "\n  if (ev === 'myEvent') { ... return; }", note: 'my event' },
  ],
});
```

**Patches** are plain text edits to the game's code, applied in order when the game starts:

| Field | Meaning |
|---|---|
| `find` + `after` / `before` / `replace` | Exact text, and what to put after it, before it, or instead of it. |
| `re` + `replace` | A regular expression; `$1`…`$9` in `replace` are its groups. |
| `count` | How many times the text must appear (default 1). Anything else and the **whole mod** is skipped, with the reason shown on its card. |
| `note` | A label for error messages. |

Inside patch text, `{{file:name}}` becomes a link to one of the mod's files, and
`{{setting:key}}` becomes that setting's current value as a JS literal
(e.g. `const FAST = {{setting:speed}} === 'fast';`). Settings are baked in at start;
changing one needs a restart.

Mods load in **id order**. Two mods can patch the same place as long as each one's anchor
text still exists after the mods before it (inserting with `after` / `before` keeps the
anchor). The manager compiles the result before running it, so a mod that would break the
game is skipped instead.

### Rules for online-safe mods

Online play is rollback netcode: the game re-runs recent frames whenever a late input
arrives, and compares checksums with the other player. So anything that changes gameplay
must come out the same on both computers, every time it's re-run:

- Use the game's **`rnd()`** for any gameplay randomness, never `Math.random()`.
  (`Math.random()` is fine for purely cosmetic sparks and particles.)
- Keep gameplay state on the fighter (`p.myThing = ...`, numbers/strings/arrays),
  on projectiles, or in a `G` key that the snapshot saves. Don't keep fighter or projectile
  *objects* in other places: rollback restores copies, so references go stale.
- Don't read the clock (`Date.now()`, `performance.now()`) in gameplay code.
- Guard effects that shouldn't repeat during a rollback re-run with `if (!G.resim)`.
- Settings that change gameplay should be `sync: true` (the default), so they're part of the
  fingerprint.

### Adding to the catalog

Put your mod in `mods/<id>/<id>.uvmod.js` with its files (and optional `icon.png`
128×128 and `banner.png` 600×260), run `python tools/build_catalog.py`, and open a pull
request. `tools/` also holds the scripts that generated the two included mods.

---

Fan project, not affiliated with Uma Versus, Cygames or Electoral Carnage. This repo does
not contain the game: the installer downloads it from umaversus.lol.
