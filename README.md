# Uma Versus Desktop

The desktop app for [Uma Versus](https://umaversus.lol), with a **mod loader included**.
It plays the game in its own window, keeps it up to date by itself and works offline, and
this repo also holds the mod catalog the app reads.

The built-in mod loader adds a **MODS** tab to the game: your mods as cards with a banner, tags and an on/off
switch, a search box (names, creators or `#tags`), **+ ADD MOD** to browse this catalog or
install from a link, and **EDIT** for each mod's settings and updates.

Mods also work **online**: two players with the same mods can play modded 1v1s through
normal room codes.

> **Mods are code.** They change the game's code when it starts. Only install mods from
> people you trust. Mods in this catalog are reviewed before they're listed.

## Install (Windows) — no setup

1. Download this repo: green **Code** button → **Download ZIP**.
2. Right-click the zip → **Extract All**.
3. Open the folder and double-click **`Uma Versus Desktop.exe`**.

That's it. Python comes bundled (in `runtime`), nothing gets installed. The first start
downloads the game from umaversus.lol (about 55 MB), puts an **Uma Versus Desktop**
shortcut on your desktop and in the Start menu, and opens the game in its own window.
From then on, use the shortcut. Closing the game window closes everything.

- The exe isn't code-signed (that costs money), so Windows may warn the first time
  ("Windows protected your PC"): **More info → Run anyway**. If an antivirus blocks it,
  `app\start.bat` starts the same thing.
- Mac/Linux: run `python3 app/launcher.py` from the folder (needs Python 3.8+).
- Your mods and settings live in the `data` folder next to the app. Keep the folder where it is.
- Had it from before, when it was called **Uma Versus (Modded)**? Nothing to do: on its next
  start the app updates itself and swaps the old shortcuts for **Uma Versus Desktop** ones.
  Your mods and settings stay. (The old `Uma Versus Modded.exe` in your folder keeps working.)

## When the game updates

Every start, the app checks umaversus.lol. When the game changed, it downloads the new
version (only the files that changed) and gets it ready, and it keeps the previous
version too:

- **Mods still work on the new version** (the usual case): you're on the new version.
- **A game update broke one of your mods:** you keep playing the previous version with your
  mods, and the start screen says so, until the mod gets an update. Mods update themselves.
- **No internet:** you play the last downloaded version.

The mod loader hooks into the game while it runs instead of editing fixed lines of its code, so
game updates rarely touch it. If one ever does, MODS opens a simple panel instead (also
**Ctrl+Shift+M**), and the app updates its own files from this repo at every start, so a
fix pushed here reaches everyone on their next start.

**Something broken after adding a mod?** On the start screen choose **Start with mods off**,
or open `http://localhost:8777/?mods=off`.

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

Every change applies after a restart: press **RESTART** (top right). Installed mods update
themselves in the background (you'll see "Mods updated: restart"). A card that failed to load
shows why in red; the game starts without that mod.

## Modded online 1v1s

1. Both players use Uma Versus Desktop with the **same mods**, with the **same settings**
   (settings marked *both players must match* on the Edit screen). Mods update themselves,
   so after a mod update just restart both games.
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
- Both players should be on the same game version. The app always uses the newest one your
  mods work on, so restarting both games lines that up.

## The catalog

| Mod | What it is |
|---|---|
| **Matikanefukukitaru** (`fuku`) | Fortune-teller runner: Dice Shot, Spirit Spin, Charm Tackle and the Omikuji gamble (divine lightning, Fate Swap, Double Draw, curses). Setting: *Expanded* or *Classic* Omikuji. Sprites: the Umamusume: Pretty Derby Party Dash rip from The Spriters Resource. |
| **Happy Meek** (`meek`) | Set-play movement: plants one flower, then warps to it (Petal Step), springs off it (Sprout Slide) and makes it bloom from anywhere (Bloom). Flying through it in the air gives her air dash back; the Vroom, Vroom super fires a second fan of beams from it. Setting: *Pollen* on or off. Sprites: the Party Dash rip from The Spriters Resource; the flower is drawn by `tools/build_meek_art.py`. |
| **Still in Love** (`sil`) | Stun-lock charmer: her hits fill a three-heart **Lovestruck** meter on the opponent, and her Wink spends the hearts on a stun (1 heart short, 2 a full combo, 3 long). Blown Kiss, Heartbreaker, the Can't Look Away command grab, a counter taunt (Hard to Get) and the Triple Tiara super, which ends in a full stun. Setting: *Lovestruck combos* Normal or *Infinite* (just for fun: hits on a stunned foe build charm, so Winks loop forever). Sprites: the Party Dash rip from The Spriters Resource; hearts are drawn in code (`tools/build_sil_art.py` builds the sheets). |
| **Nixon (Electoral Carnage)** (`nixon`) | Nixon with his full Electoral Carnage kit and Carnage rules: stars, lightning, slam, float, Dream Stones and the Not A Crook super. Art and sounds from Electoral Carnage. |

Fukukitaru, Happy Meek and Nixon were tested together on build `48dacc`: offline modes, Arcade, CPU, and a two-player
online match with forced rollbacks (no desyncs). Still in Love was tested with all three on the same build: CPU matches
against every runner, all her combo trials, both settings, and rollback re-simulation (identical state).

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
| `count` | How many times the text must appear (default 1). Anything else and the **whole mod** is skipped, with the reason shown on its card. (If the exact text isn't found, the same text with different spacing/line breaks is accepted, so a game update that only re-indents doesn't break mods.) |
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

### Keeping things working after a game update (maintainers)

The app tells players when a mod doesn't work on the newest game version, and keeps them
on the previous one meanwhile. To fix it:

1. Get the new page (`curl https://umaversus.lol/ -o page.html`) and see which patch fails
   (the error on the mod's card names it).
2. Update the mod's patch text, bump its `@version`, run `python tools/build_catalog.py`, push.
   Everyone's app picks up the new version on its next start.
3. If the app itself needs a change, edit `app/`, run `python tools/build_manifest.py`, push.
   Every app updates its own files from `manifest.json` (checked against the file hashes)
   at its next start.

### Adding to the catalog

Put your mod in `mods/<id>/<id>.uvmod.js` with its files (and optional `icon.png`
128×128 and `banner.png` 600×260), run `python tools/build_catalog.py`, and open a pull
request. `tools/` also holds the scripts that generated the included mods.

---

Fan project, not affiliated with Uma Versus, Cygames or Electoral Carnage. This repo does
not contain the game: the app downloads it from umaversus.lol. `runtime/` is the official
Windows embeddable Python 3.12.10 from python.org (PSF license, see `runtime/LICENSE.txt`).
`Uma Versus Desktop.exe` is a tiny starter for it, built from `tools/exe/` (`build_exe.sh`,
needs `pip install ziglang`); all it does is run `runtime\pythonw.exe app\launcher.py`.
