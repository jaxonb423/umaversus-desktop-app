// ==UmaMod==
// @id          sil
// @name        Still in Love
// @version     1.0.0
// @author      jaxonb423
// @kind        fighter
// @build       48dacc
// @description Stun-lock charmer: her hits fill a three-heart Lovestruck meter on the opponent, then her Wink spends it on a stun. Blown Kiss, Heartbreaker, Can't Look Away and the Triple Tiara super.
// @tags        fighter stun charm lovestruck party-dash
// @homepage    https://github.com/jaxonb423/umaversus-mods/tree/main/mods/sil
// ==/UmaMod==
//
// Sprites: Umamusume Pretty Derby Party Dash rip (The Spriters Resource), sheets built by tools/build_sil_art.py.
// Hearts, the Lovestruck meter and the crowns are drawn in code. Every patch is plain text applied to the
// game's code when it starts (see README).
//
// Lovestruck lives on the opponent (p.lsCharm 0-300 = three hearts, p.lsStun, p.lsImm ...), all plain numbers
// on the fighter, so rollback snapshots carry it. Nothing here uses randomness for gameplay; Math.random only
// scatters cosmetic hearts.
uvmod({
  settings: {
    combos: { label: 'Lovestruck combos', type: 'select', default: 'normal', sync: true,
      options: [['normal', 'Normal (no charm on a stunned foe, short immunity after)'],
                ['infinite', 'Infinite, just for fun (hits on a stunned foe build charm, no combo limit)']] },
  },
  files: ['sil.png', 'sil_r.png'],
  patches: [
    { note: 'sprite sheet',
      find: String.raw`const ASSETS = {`,
      after: String.raw`"sil": {"img": "{{file:sil.png}}", "imgR": "{{file:sil_r.png}}", "anims": {"100": [0, 4], "101": [4, 6], "102": [10, 6], "110": [16, 2], "111": [18, 7], "112": [25, 2], "113": [27, 2], "120": [29, 2], "121": [31, 1], "130": [32, 1], "131": [33, 1], "132": [34, 1], "133": [35, 1], "138": [36, 4], "139": [40, 3], "150": [43, 1], "151": [44, 1], "152": [45, 1], "153": [46, 1], "160": [47, 4], "161": [51, 4], "162": [55, 6], "163": [61, 4], "164": [65, 2], "200": [67, 10], "202": [77, 3], "203": [80, 4], "210": [84, 4], "300": [88, 8], "310": [96, 2], "320": [98, 7], "330": [105, 3], "340": [108, 1], "341": [109, 1], "350": [110, 4], "360": [114, 13], "361": [127, 2], "362": [129, 2], "363": [131, 2], "500": [133, 4], "510": [137, 6], "520": [143, 3], "530": [146, 2], "540": [148, 2], "550": [150, 4], "600": [154, 8], "601": [162, 17], "602": [179, 3], "700": [182, 6], "701": [188, 8], "703": [196, 3], "704": [199, 3], "706": [202, 5], "707": [207, 3], "730": [210, 4], "800": [214, 4], "801": [218, 6], "802": [224, 4], "810": [228, 1], "811": [229, 1], "812": [230, 1], "813": [231, 1], "820": [232, 2], "821": [234, 2], "822": [236, 2], "823": [238, 2], "824": [240, 1], "830": [241, 3], "840": [244, 3], "850": [247, 4], "860": [251, 4], "870": [255, 2], "880": [257, 2], "900": [259, 6], "910": [265, 1], "911": [266, 1], "920": [267, 6], "930": [273, 6], "940": [279, 4], "950": [283, 5], "001A": [288, 3]}, "cols": 16}, ` },

    { note: 'fighter',
      re: String.raw`\bCHARS\s*=\s*\{`,
      replace: String.raw`CHARS = {
  // ---- Still in Love (stun-lock charmer)   [umaversus-mods: sil]
  // Her hits fill three hearts of Lovestruck on the opponent; Wink spends them on a stun (1 / 2 / 3 hearts =
  // short / combo-length / long). Charm fades if she stops landing hits. See silTick / silOnHit below.
  sil: {
    name: 'STILL IN LOVE', short: 'SIL', arch: 'STUN-LOCK CHARMER', color: '#e8344a', color2: '#ffd0da',
    blurb: 'Stun-lock charmer. Every hit fills a heart of Lovestruck on them; her Wink spends the hearts on a stun. Low damage alone, scary once she gets in.',
    hp: 9600, walk: 3.4, back: 3.0, dash: 9.4, jumpV: -15, jumpX: 4.4, grav: 0.76, dmgMul: 0.95,
    specialChain: true, lovestruck: true,
    throwAnim: '703', win: '600', winFrames: 8, intro: '940', ai: 'sil',
    look: {
      idleSpeed: 9, walkSpeed: 6, runSpeed: 4, idle2: '601', squash: 0.9,
      taunt: '706', tauntLine: 'Hard to get~', intros: ['940', '210'], wins: ['600', '210'],
      fxColor: '#ff5a7a', fxAlt: '#ffd36b', motif: 'hearts',
      fx: {
        '5S': [{ t: 10, type: 'motif', x: 40, y: -115, n: 4, spread: 18 }],
        '4S': [{ t: 5, type: 'ring', x: 30, y: -125, r: 34 }],
        '6S': [{ t: 2, type: 'motif', y: -90, n: 4, spread: 30 }],
        'SU': [{ t: 1, type: 'ring', y: -80, r: 150 }],
      },
    },
    silTaunt: { kind: 'taunt', name: 'Hard to Get', seq: [[0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 10]],
      ev: { 30: 'taunt' }, counter: { f: [4, 40], to: 'taunt~C', stun: 34 } },
    combos: [
      { name: 'Charm string', seq: '5L 5M 5H 623M', note: 'Three normals fill a heart, Wink stuns. Then do it again' },
      { name: 'Heartbreaker wink', seq: '2M 214M 623M', note: 'Special chain: Heartbreaker on hit, then Wink' },
      { name: 'Launcher air combo', seq: '2M 2H jc j.M j.H', note: 'Jump-cancel the launcher' },
      { name: 'Kiss confirm', seq: '5M 236M', note: 'Blown Kiss up close hits right away' },
    ],
    moves: baseNormals({
      '5S': { kind: 'special', name: 'Blown Kiss', input: 'S', motion: '236', cd: 70, note: 'A slow heart that leaves a lot of charm', vnote: 'L floats slowly · M faster',
        seq: [[0, 6, '210'], [1, 6, '210'], [2, 16, '210']], ev: { 10: 'proj' },
        proj: { style: 'silKiss', vx: 5.5, life: 110, x0: 46, y0: -112, box: [-22, -20, 44, 40], hit: H({ dmg: 420, hs: 20, bs: 10, lvl: 1, chip: 0.1, push: 3, charm: 75 }) },
        v: { L: { proj: { vx: 3.2, life: 170 } } },
        ex: { note: 'Fast two-hit kiss: over a heart of charm', proj: { vx: 7.5, hits: 2 }, hit: { charm: 65 } } },
      '4S': { kind: 'special', name: 'Wink', input: '← + S', motion: '623', cd: 60, note: 'Spends their hearts: Lovestruck stun (1 short · 2 combo · 3 long)', vnote: 'L faster, shorter reach',
        seq: [[0, 3, '520'], [1, 4, '520'], [2, 14, '520'], [0, 4, '800']],
        hits: [H({ f: [5, 8], box: [20, -150, 120, 80], dmg: 300, hs: 16, bs: 8, lvl: 1, push: 1, wink: true })],
        v: { L: { seq: [[1, 3, '520'], [2, 12, '520'], [0, 3, '800']], hits: [H({ f: [3, 6], box: [20, -150, 95, 80], dmg: 260, hs: 15, bs: 8, lvl: 1, push: 1, wink: true })] } },
        ex: { note: 'Reaches across half the screen, stuns 40% longer', hits: [H({ f: [5, 9], box: [20, -165, 260, 110], dmg: 260, hs: 16, bs: 8, lvl: 1, push: 1, wink: true, stunMul: 1.4 })] } },
      '6S': { kind: 'special', name: 'Heartbreaker', input: '→ + S', motion: '214', cd: 110, note: 'Lunge that leaves charm, chains into Wink', vnote: 'L shorter',
        seq: [[0, 3, '203'], [1, 3, '203'], [0, 3, '203'], [1, 3, '203'], [0, 5, '870'], [1, 16, '870']], vel: [[1, 14, 10]],
        hits: [H({ f: [10, 16], box: [10, -110, 95, 60], dmg: 650, hs: 20, bs: 12, lvl: 2, push: 3, charm: 90 })],
        v: { L: { vel: [[1, 10, 8.5]] } },
        ex: { note: 'Invincible start, two hits, carries farther', inv: [1, 10], vel: [[1, 18, 12]],
              seq: [[0, 3, '203'], [1, 3, '203'], [0, 3, '203'], [1, 3, '203'], [0, 3, '203'], [0, 5, '870'], [1, 18, '870']],
              hits: [H({ f: [8, 11], box: [10, -110, 90, 60], dmg: 420, hs: 20, bs: 12, lvl: 1, push: 1, charm: 55 }),
                     H({ f: [16, 20], box: [10, -110, 95, 60], dmg: 520, hs: 22, bs: 12, lvl: 2, push: 3, charm: 55 })] } },
      '2S': { kind: 'throw', special: true, name: 'Can\'t Look Away', input: '↓ + S', motion: '41236', cd: 120, note: 'Command grab: pulls them in, a full heart of charm · also grabs a Lovestruck foe', vnote: 'L shorter reach, recovers faster',
        anim: '820', seq: [[0, 5], [1, 22]], grab: [5, 6], range: 96, throwDmg: 700, noTech: true, throwVx: 2, throwAnim: '703', silCharm: 100, silGrab: true,
        v: { L: { seq: [[0, 5], [1, 16]], range: 82, throwDmg: 600 } },
        ex: { note: 'Invincible start, longer reach, more damage', inv: [1, 5], range: 122, throwDmg: 950 } },
      'jS': { kind: 'special', name: 'Air Kiss', input: 'S in the air', motion: '236', cd: 90, note: 'Kiss angled down, once per jump', vnote: 'L flatter · M steeper',
        air: true, seq: [[0, 4, '860'], [1, 4, '860'], [2, 12, '860']], ev: { 6: 'proj' }, landRec: 6,
        proj: { style: 'silKiss', vx: 5, vy: 4, x0: 30, y0: -80, life: 80, box: [-20, -20, 40, 40], hit: H({ dmg: 380, hs: 16, bs: 10, lvl: 1, guard: 'high', chip: 0.1, charm: 55 }) },
        v: { L: { proj: { vx: 6.5, vy: 2.5 } } },
        ex: { note: 'Two kisses', ev: { 6: 'proj', 12: 'proj2' },
              proj2: { style: 'silKiss', vx: 6.5, vy: 2.5, x0: 30, y0: -80, life: 80, box: [-20, -20, 40, 40], hit: H({ dmg: 380, hs: 16, bs: 10, lvl: 1, guard: 'high', chip: 0.1, charm: 55 }) } } },
      'taunt~C': { kind: 'special', followOf: 'taunt', name: 'Hard to Get', inv: [1, 22],
        seq: [[0, 3, '802'], [1, 3, '802'], [2, 3, '802'], [3, 3, '802'], [0, 3, '330'], [1, 3, '330'], [2, 10, '330']], vel: [[1, 12, -7]], ev: { 2: 'silHardToGet' } },
      'SU': superMove('Triple Tiara', ['341', 0],
        [['870', 0, 5, 300, 'silCrown'], ['870', 1, 6], ['920', 2, 5, 300, 'silCrown'], ['920', 3, 6], ['930', 3, 5, 350, 'silCrown'], ['930', 4, 8],
         ['210', 1, 8], ['210', 2, 10, 500, 'silWink'], ['703', 0, 6], ['703', 1, 6], ['703', 2, 14]]),
    }),
  },
` },

    { note: 'roster',
      re: String.raw`(const ROSTER = \[[^\]]*)\]`,
      replace: String.raw`$1, 'sil']` },

    { note: 'Lovestruck',
      find: String.raw`function doEvent(p, ev) {`,
      before: String.raw`/* >>> sil (Still in Love mod) */
const LS_INF = {{setting:combos}} === 'infinite';
const LS_MAX = 300, LS_HOLD = 180, LS_DECAY = 1, LS_IMM = 120;
const LS_STUN = [0, 48, 80, 120];        // frames of stun for 1 / 2 / 3 hearts
const LS_LVL = [25, 35, 50, 60];         // charm per hit by hit level, when a hit doesn't say
// infinite setting: once she has winked them, the combo limit and the repeat rule don't cut her combo until it drops
function silFree(a, d) { return LS_INF && !!a && !!a.c && !!a.c.lovestruck && (d.lsStun > 0 || d.lsChain > 0); }
function silHeartPath(x, y, r) {
  ctx.beginPath(); ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.7, y - r * 0.15, x - r * 0.75, y - r * 1.35, x, y - r * 0.42);
  ctx.bezierCurveTo(x + r * 0.75, y - r * 1.35, x + r * 1.7, y - r * 0.15, x, y + r * 0.9); ctx.closePath();
}
function silHearts(x, y, n, spread) {   // cosmetic only
  if (G.resim) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.5;
    G.fx.push({ type: 'mot', motif: 'hearts', color: Math.random() < 0.6 ? '#ff5a7a' : '#ffd0da', x: x + Math.cos(a) * spread * 0.3, y: y + Math.sin(a) * spread * 0.3,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, rot: 0, vr: 0, t: 0, life: 24 + Math.random() * 14, size: 5 + Math.random() * 3 });
  }
}
function silAddCharm(a, d, amt) {
  if (!LS_INF && (d.lsStun > 0 || d.lsImm > 0)) return;
  const was = Math.floor(d.lsCharm / 100);
  d.lsCharm = Math.min(LS_MAX, d.lsCharm + amt); d.lsIdle = 0;
  const now = Math.floor(d.lsCharm / 100);
  if (now > was) { addText(now >= 3 ? 'HEAD OVER HEELS' : 'CHARMED ' + now + '/3', d.x, GY - 228, '#ff8fa8', now >= 3 ? 17 : 14, 28); silHearts(d.x, GY - 205, 3 + now, 20); }
}
// Wink: spends the hearts. forced = stun as if this many hearts (the super)
function silWink(a, d, mul, forced) {
  const pips = forced || Math.floor(d.lsCharm / 100);
  if (!pips) { addText('...NOT INTERESTED?', d.x, GY - 215, '#ffb3cb', 14, 30); return; }
  const st = Math.round(LS_STUN[Math.min(3, pips)] * (mul || 1));
  d.lsCharm = 0; d.lsIdle = 0; d.lsImm = 0; if (LS_INF) d.lsChain = 1;
  if (d.hp <= 0) return;
  if (forced) { d.y = GY; d.vy = 0; }   // the super: they're pulled to the floor in the cinematic
  if (!forced && (d.airborne || d.state === 'airHit')) { d.lsPend = st; d.vx = 0; d.vy = Math.max(d.vy, 4); d.kd = false; d.hardKd = false; d.bounce = null; }   // falls, then stands there charmed
  else { d.setState('hit'); d.hs = st; d.lsStun = st; d.crouchHit = false; d.vx = 0; }
  G.freeze = Math.max(G.freeze, 14); d.flash = 10;
  addText(pips >= 3 ? 'HEAD OVER HEELS!' : 'LOVESTRUCK!', d.x, GY - 235, '#ff5a7a', pips >= 3 ? 26 : 22, 44);
  callout(a, 'LOVESTRUCK', 'spurt'); silHearts(d.x, GY - 150, 6 + pips * 3, 50); Sfx.play('power');
}
// after every hit that lands (resolveHit wrapper)
function silOnHit(a, d, h, stunned) {
  if (h.wink) { silWink(a, d, h.stunMul || 1); return; }
  if (stunned && !LS_INF) return;   // normal: a stunned foe gains no charm, so a stun can't chain into another
  silAddCharm(a, d, h.charm !== undefined ? h.charm : (LS_LVL[h.lvl] || 28));
}
// per frame, every fighter (start of updateFighter)
function silTick(p) {
  if (p.lsPend > 0) {
    if (p.state === 'down' && p.hp > 0) { p.setState('hit'); p.hs = p.lsStun = p.lsPend; p.lsPend = 0; p.crouchHit = false; p.hitLvl = 0; p.kd = false; p.hardKd = false; }
    else if (p.state !== 'airHit') p.lsPend = 0;
  }
  if (p.lsStun > 0) {
    if (p.state === 'hit' && p.hp > 0) { p.lsStun--; if (p.hs < p.lsStun + 1) p.hs = p.lsStun + 1; }
    else p.lsStun = 0;   // launched, thrown or knocked out of it: the stun is over
    if (p.lsStun === 0) p.lsImm = LS_INF ? 0 : LS_IMM;
  } else if (p.lsImm > 0) p.lsImm--;
  if (p.lsChain && p.combo === 0 && !(p.lsStun > 0) && !(p.lsPend > 0)) p.lsChain = 0;   // infinite: the combo dropped
  if (p.lsCharm > 0 && !(p.lsStun > 0) && ++p.lsIdle > LS_HOLD) p.lsCharm = Math.max(0, p.lsCharm - LS_DECAY);
}
function silEvent(p, ev) {
  const o = opp(p);
  if (ev === 'silHardToGet') {   // her counter: the one who swung at her is the one who's charmed
    const imm = o.lsImm; o.lsImm = 0; silAddCharm(p, o, 100); o.lsImm = imm;
    addText('HARD TO GET~', p.x, GY - 210, '#ff8fa8', 18, 32); silHearts(p.x, GY - 120, 6, 30);
  }
}
// the super: each crown is a heart, the last step winks for a full stun
function silCrown(p, o) { o.lsImm = 0; o.lsStun = 0; o.lsCharm = Math.min(LS_MAX, Math.floor(o.lsCharm / 100) * 100 + 100); o.lsIdle = 0; addText('TIARA ' + Math.floor(o.lsCharm / 100), o.x, GY - 228, '#ffd36b', 18, 26); }
// drawing ---------------------------------------------------------------------------------
function silDrawKiss(q, x) {
  const y = q.y + Math.sin(q.t * 0.18) * 4, r = 15 + Math.sin(q.t * 0.3);
  ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffd0da'; silHeartPath(x - q.vx * 2.5, y - (q.vy || 0) * 2.5, r * 0.8); ctx.fill();
  ctx.globalAlpha = 1; ctx.fillStyle = '#ff4d6d'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; silHeartPath(x, y, r); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(x - r * 0.45, y - r * 0.45, r * 0.22, r * 0.14, -0.6, 0, 7); ctx.fill();
  if (!G.resim && q.t % 5 === 0) G.fx.push({ type: 'mot', motif: 'hearts', color: '#ffd0da', x: q.x, y, vx: -q.vx * 0.2, vy: -0.8, rot: 0, vr: 0, t: 0, life: 20, size: 4 });
}
// over each fighter that faces her: the three hearts, the stun hearts circling their head, immunity
function silOverlay(left) {
  for (const p of G.p) {
    const o = opp(p);
    if (!o || !o.c.lovestruck) continue;
    const stun = p.lsStun > 0 || p.lsPend > 0;
    if (!(p.lsCharm > 0 || stun || p.lsImm > 0)) continue;
    const x = p.x - left, y = p.y - 212;
    if (!stun) {
      for (let i = 0; i < 3; i++) {
        const hx = x + (i - 1) * 22, f = Math.max(0, Math.min(1, (p.lsCharm - i * 100) / 100));
        ctx.fillStyle = 'rgba(40,10,20,.55)'; silHeartPath(hx, y, 9); ctx.fill();
        if (f > 0) {
          ctx.save(); ctx.beginPath(); ctx.rect(hx - 20, y + 9 - 20 * f, 40, 20 * f); ctx.clip();
          ctx.fillStyle = p.lsImm > 0 ? '#9a8a90' : f >= 1 ? '#ff4d6d' : '#ff9fb2'; silHeartPath(hx, y, 9); ctx.fill(); ctx.restore();
        }
        ctx.strokeStyle = p.lsImm > 0 ? '#c9c0c4' : '#ffffff'; ctx.lineWidth = 2; silHeartPath(hx, y, 9); ctx.stroke();
      }
      if (p.lsImm > 0) { ctx.globalAlpha = 0.8; ctx.fillStyle = '#d8d0d4'; ctx.font = '700 11px ' + FD; ctx.textAlign = 'center'; ctx.fillText('IMMUNE', x, y - 14); ctx.globalAlpha = 1; }
      continue;
    }
    // Lovestruck: hearts circling their head
    const n = 4, hy = p.y - 175;
    for (let i = 0; i < n; i++) {
      const a = G.frameCount * 0.09 + i * Math.PI * 2 / n, hx = x + Math.cos(a) * 40, yy = hy + Math.sin(a) * 10;
      ctx.globalAlpha = Math.sin(a) > 0 ? 1 : 0.6; ctx.fillStyle = i % 2 ? '#ffd0da' : '#ff4d6d'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; silHeartPath(hx, yy, 10); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (p.lsStun > 0 && G.frameCount % 18 === 0 && !G.resim) G.fx.push({ type: 'mot', motif: 'hearts', color: '#ff8fa8', x: p.x + (Math.random() - .5) * 40, y: p.y - 150, vx: 0, vy: -1.2, rot: 0, vr: 0, t: 0, life: 26, size: 5 });
  }
}
/* <<< sil */
` },
    { note: 'events',
      find: String.raw`function doEvent(p, ev) {`,
      after: String.raw`
  if (typeof ev === 'string' && ev.startsWith('sil')) { silEvent(p, ev); return; }   // [umaversus-mods: sil]` },

    { note: 'every landed hit: charm, Wink, stun keeps them locked',
      find: String.raw`function resolveHit(a, d, h, srcX, fromAir, proj) {`,
      replace: String.raw`function resolveHit(a, d, h, srcX, fromAir, proj) {   // [sil] wrapper
  const stunned = d.lsStun > 0;
  const r = silResolveHit0(a, d, h, srcX, fromAir, proj);
  if (r === 'hit' && a.c.lovestruck) silOnHit(a, d, h, stunned);
  if (r === 'hit' && stunned && d.state === 'hit') d.vx *= 0.25;   // a Lovestruck foe barely slides away
  if (d.lsStun > 0 && d.state === 'hit' && d.hs < d.lsStun) d.hs = d.lsStun;
  return r;
}
function silResolveHit0(a, d, h, srcX, fromAir, proj) {` },
    { note: 'infinite: no combo limit while Lovestruck',
      find: String.raw`(d.combo >= COMBO_HITS || d.comboT >= COMBO_TIME)`,
      replace: String.raw`(d.combo >= COMBO_HITS || d.comboT >= COMBO_TIME) && !silFree(a, d)` },
    { note: 'infinite: no repeat rule while Lovestruck',
      find: String.raw`d.combo > 0 && ipsRepeat(d, src)`,
      replace: String.raw`d.combo > 0 && !silFree(a, d) && ipsRepeat(d, src)` },
    { note: 'infinite: no hitstun decay while Lovestruck',
      find: String.raw`const decay = d.comboT > DECAY_AT ?`,
      replace: String.raw`const decay = d.comboT > DECAY_AT && !silFree(a, d) ?` },
    { note: "Can't Look Away grabs a Lovestruck foe",
      find: String.raw`const stun = m.grabStun && o.state === 'hit';`,
      replace: String.raw`const stun = (m.grabStun || (m.silGrab && o.lsStun > 0)) && o.state === 'hit';` },
    { note: 'grab charm: remember it',
      find: String.raw`p.throwDmg = m.throwDmg || 1300;`,
      before: String.raw`p.silTC = m.silCharm || 0; ` },
    { note: 'grab charm: give it as the throw lands',
      find: String.raw`if (p.t >= 40) p.setState('idle');`,
      before: String.raw`if (p.t === 26 && p.silTC) { silAddCharm(p, o, p.silTC); p.silTC = 0; }   // [sil]
      ` },
    { note: 'per frame',
      find: String.raw`function updateFighter(p) {`,
      after: String.raw`
  silTick(p);   // [umaversus-mods: sil]` },
    { note: 'Lovestruck pose',
      find: String.raw`if (p.crouchHit && A['110']) return ['110', p.t < 6 ? 0 : 1];`,
      before: String.raw`if (p.lsStun > 0 && p.t > 10 && A['800']) return ['800', Math.floor(p.frame / 14) % n('800')];   // [sil] standing there, charmed
      ` },
    { note: 'per-round state',
      find: String.raw`this.throwT = 0; this.throwBack = false; this.ai = null;`,
      after: String.raw` this.lsCharm = 0; this.lsIdle = 0; this.lsStun = 0; this.lsPend = 0; this.lsImm = 0; this.lsChain = 0; this.silTC = 0;` },
    { note: 'super: crowns and the final wink',
      find: String.raw`Sfx.play(fin ? 'heavy' : 'hit');`,
      after: String.raw`
      if (step[4] === 'silCrown') silCrown(p, o);   // [sil]
      if (step[4] === 'silWink') silWink(p, o, 1, 3);` },
    { note: 'her taunt is a counter stance',
      find: String.raw`c.moves.taunt = { kind: 'taunt', name: 'Taunt', anim: c.look.taunt, seq, ev: { 30: 'taunt' } };`,
      after: String.raw` if (c.silTaunt) c.moves.taunt = { ...c.silTaunt, anim: c.look.taunt };   // [sil]` },
    { note: 'heart motif',
      find: String.raw`if (motif === 'stars') star(x, y, size, rot);`,
      before: String.raw`if (motif === 'hearts') { silHeartPath(x, y, size); ctx.fill(); return; }   // [sil]
  ` },
    { note: 'draw: kiss',
      find: String.raw`function drawProj(q, left) {`,
      after: String.raw`
  if (q.style === 'silKiss') { silDrawKiss(q, q.x - left); return; }   // [sil]` },
    { note: 'draw: hearts over their head',
      find: String.raw`  drawFx(left);
  drawStageFront(G.cam);`,
      before: String.raw`  silOverlay(left);   // [sil]
` },
    { note: 'move list',
      find: String.raw`if (c.ai === 'footsies') rows.push(`,
      before: String.raw`if (c.lovestruck) rows.push(['Lovestruck (' + c.short + ')', 'her hits fill 3 hearts', 'Wink (←S) spends them on a stun · fades if she stops hitting · ' + (LS_INF ? 'INFINITE: hits on a stunned foe build charm' : 'no charm on a stunned foe, 2 s immunity after')],
    ['Can\'t Look Away (' + c.short + ')', '↓ + S  ·  ' + arrows('41236') + '+atk', 'Command grab: can\'t be blocked or teched · a full heart of charm · also grabs a Lovestruck foe'],
    ['Hard to Get (' + c.short + ')', 'L + H (her taunt)', 'Counter stance: catches a strike, gives them a heart and she spins away']);
  ` },
    { note: 'CPU habits',
      find: String.raw`  // set-play: keep potions on the floor`,
      before: String.raw`  // [sil] kiss from range, wink when they have a heart, grab them when they don't, combo a stunned foe
  if (me.c.ai === 'sil') {
    const pips = Math.floor((o.lsCharm || 0) / 100), grounded = !o.airborne && !['hit', 'airHit', 'down', 'wake', 'thrown', 'cineHit', 'block'].includes(o.state);
    if (o.lsStun > 12) {
      if (dist > 105) { out[fwdK] = 1; return out; }
      if (lv.combo > 0 && aiTryCombo(me, o, lv, dist, null, Math.min(24, o.lsStun))) return aiRunInput(me, o, lv) || out;
    }
    if (pips >= 1 && dist < 130 && (grounded || o.state === 'hit') && r < 0.1 * L && skillReady(me, '4S')) return motion('623' + (pips >= 2 && exOK(me, lv) && rnd() < 0.3 ? 'H' : 'M'));
    if (pips === 0 && dist > 220 && r < 0.04 * L && skillReady(me, '5S') && !G.projs.some(q => q.owner === me.side)) return motion(dist > 360 ? '236M' : '236L');
    if (grounded && dist < 90 && r < 0.03 * L && skillReady(me, '2S')) return motion('41236M');
    if (grounded && dist > 160 && dist < 280 && r < 0.02 * L && skillReady(me, '6S')) return motion('214M');
  }
` },
    { note: 'CPU spacing',
      find: String.raw`const PREF = {`,
      after: String.raw` sil: 160,` },
    { note: 'combo trials',
      find: String.raw`const TRIAL_EXTRA = {`,
      after: String.raw`
  sil: [
    { name: "Lovestruck loop", seq: "5L 5M 5H 623M , 5M 5H 214M", note: "A heart, Wink, then a full combo on the stunned foe" },
    { name: "Two-heart launcher", seq: "5L 5M 5H 214M 623M , 2M 2H jc j.M j.H", note: "The full string plus Heartbreaker fills two hearts: the longer stun fits a launcher air combo" }],` },

    { note: 'RIVAL',
      find: String.raw`const RIVAL = {`,
      after: String.raw` sil: 'ds',` },
    { note: 'LINES',
      find: String.raw`const LINES = {`,
      after: String.raw`
  sil: { intro: ['Look at me. Only at me.', 'You\'ll fall for me before the final turn~'],
    win: ['Lovestruck? It happens to everyone.', 'Three crowns, and your heart too.', 'Don\'t look away now~'] },` },
    { note: 'RIVAL_LINE',
      find: String.raw`const RIVAL_LINE = {`,
      after: String.raw`
  sil: 'Still in Love-san... you won\'t win me over that easily. Show me your real run!',` },
    { note: 'ENDINGS',
      find: String.raw`const ENDINGS = {`,
      after: String.raw`
  sil: ['The last race is over, and the whole stand is looking at one runner.',
    'Still in Love waves once, blows a kiss to the crowd, and three tiaras catch the light on the podium.',
    'Her trainer sighs. Everyone fell for her again. ...They always do.'],` },
    { note: 'SKIN',
      find: String.raw`const SKIN = {`,
      after: String.raw` sil: ['#ffecce', '#ffeadc', '#ffc3b0', '#ffafa6', '#ffa58b', '#e3c3a9', '#d7c5b7'],` },
    { note: 'RATING',
      find: String.raw`const RATING = {`,
      after: String.raw` sil: [3, 3, 3, 4],` },
  ],
});
