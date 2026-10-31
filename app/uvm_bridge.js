// ================================================================ Uma Versus Mod Manager: runtime hooks
// Appended after the game's own code. Everything here hooks in by wrapping the game's functions
// at runtime (by name), not by matching lines of its code, so a game update that moves code
// around doesn't break it. Each hook checks the function exists first; a missing one is
// reported in UVM.hooks and the manager falls back (simple MODS panel, Ctrl+Shift+M).
(function uvmBridge() {
  const H = UVM.hooks;
  const ok = n => { H[n] = true; }, miss = n => { H[n] = false; console.warn('[uvm] hook not available after a game update:', n); };
  const SCR = UVM_SCREENS;
  const fn = name => { try { return typeof (0, eval)(name) === 'function'; } catch (e) { return false; } };

  // ---- MODS entry on the main menu (just before OPTIONS)
  try {
    if (Array.isArray(MODES) && !MODES.some(m => m[1] === 'mods')) {
      const i = MODES.findIndex(m => m[1] === 'sound');
      MODES.splice(i < 0 ? MODES.length : i, 0, ['MODS', 'mods', 'Add runners and changes from the mod catalog']);
    }
    ok('menu');
  } catch (e) { miss('menu'); }
  try { MENU_SCREENS.push(...SCR); } catch (e) { }
  try { Object.assign(GHOST, { mods: 'MODS', modcat: 'CATALOG', modedit: 'MOD' }); } catch (e) { }

  // ---- input: keep the menu edges the game computes each frame, plus Enter / Esc
  const IN = { me: [{}, {}], enter: false, esc: false };
  if (fn('menuEdges')) {
    const f = menuEdges;
    menuEdges = function (i, cur) { const e = f.apply(this, arguments); IN.me[i] = e || {}; return e; };
    ok('menuEdges');
  } else miss('menuEdges');
  addEventListener('keydown', ev => {
    if (!SCR.includes(UI.screen)) return;
    if (ev.code === 'Enter' || ev.code === 'Space') IN.enter = true;
    if (ev.code === 'Escape') IN.esc = true;
  }, true);

  // ---- frame logic: run the MODS screens; send the menu's MODS choice here
  if (fn('tick')) {
    const f = tick;
    tick = function () {
      const pickedMods = UI.screen === 'mode' && MODES[UI.modeIdx] && MODES[UI.modeIdx][1] === 'mods';
      const r = f.apply(this, arguments);
      // the game treats an unknown mode as "go to runner select with that mode": catch it
      if (pickedMods && UI.screen !== 'mode' && UI.pendingMode === 'mods') { UI.pendingMode = null; UI.screen = 'mode'; uvmOpen(); }
      if (SCR.includes(UI.screen)) {
        const e = (typeof orEdges === 'function' ? orEdges(IN.me[0], IN.me[1]) : IN.me[0]) || {};
        uvmSafe(() => uvmTick(e, IN.enter, IN.esc));
      }
      IN.enter = IN.esc = false;
      return r;
    };
    ok('tick');
  } else miss('tick');

  // ---- drawing
  if (fn('renderScreen')) {
    const f = renderScreen;
    renderScreen = function () {
      if (SCR.includes(UI.screen)) { uvmSafe(uvmDraw); return; }
      const r = f.apply(this, arguments);
      if (UI.screen === 'netselect') uvmSafe(uvmNetHint, true);
      return r;
    };
    ok('renderScreen');
  } else miss('renderScreen');

  // ---- per-match seed for the game's own RNG (rnd / rs). Vanilla play keeps rs = 7.
  if (fn('startMatch')) {
    const f = startMatch;
    startMatch = function (mode) {
      const r = f.apply(this, arguments);
      if (UVM.active) {
        try { rs = mode === 'replay' ? (UVM.replaySeed !== undefined && UVM.replaySeed !== null ? UVM.replaySeed : 7) : UVM.seed(mode); G.seed = rs; }
        catch (e) { console.warn('[uvm] seed', e); }
      }
      return r;
    };
    ok('seed');
  } else miss('seed');
  if (fn('makeReplay')) {   // modded replays remember their seed so they play back exactly
    const f = makeReplay;
    makeReplay = function () { const r = f.apply(this, arguments); if (UVM.active && r && G.seed !== undefined) { r.seed = G.seed; r.mods = UVM.tag; } return r; };
  }
  if (fn('playReplay')) {
    const f = playReplay;
    playReplay = function (r) { UVM.replaySeed = r && r.seed; return f.apply(this, arguments); };
  }

  // ---- official services: no leaderboard results and no public room listing while mods run.
  // (The loader also blocks those requests at the network level, whatever the game calls them.)
  if (fn('acctRecord')) { const f = acctRecord; acctRecord = function () { if (UVM.active) return Promise.resolve(); return f.apply(this, arguments); }; }
  if (fn('roomBeat')) { const f = roomBeat; roomBeat = function () { if (UVM.active) return; return f.apply(this, arguments); }; }

  // ---- never send a game without these mods ids it doesn't have (its lobby would crash showing them)
  if (fn('netSend')) {
    const f = netSend;
    netSend = function (obj) {
      try {
        if (UVM.active && obj && obj.t === 'lobby' && Net.theirBuild !== BUILD && Array.isArray(UVM.baseRoster)) {
          const n = UVM.baseRoster.length, base = UVM.baseThemes || [];
          obj = { ...obj, pick: obj.pick >= 0 && obj.pick < n ? obj.pick : 0, music: base.includes(obj.music) ? obj.music : null };
        }
      } catch (e) { }
      return f.call(this, obj);
    };
    ok('netSend');
  } else miss('netSend');

  // ---- fallback ways in, in case the menu hook ever stops working: Ctrl+Shift+M, and a small button
  addEventListener('keydown', ev => { if (ev.ctrlKey && ev.shiftKey && ev.code === 'KeyM') { ev.preventDefault(); uvmOpen(); } }, true);
  if (!H.menu || !H.tick || !H.renderScreen) uvmFallbackButton();

  UVM.bridge = true;
  setTimeout(() => uvmSafe(uvmAutoUpdate, true), 5000);
})();
// ================================================================ /runtime hooks
