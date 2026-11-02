// ==UmaMod==
// @id          meek
// @name        Happy Meek
// @version     1.0.0
// @author      jaxonb423
// @kind        fighter
// @build       48dacc
// @description Set-play movement: plants one flower, then warps to it, springs off it and makes it bloom from anywhere. Air dash, B-Barrier and the Vroom, Vroom super.
// @tags        fighter setplay movement flower party-dash
// @homepage    https://github.com/jaxonb423/umaversus-mods/tree/main/mods/meek
// ==/UmaMod==
//
// Sprites: Umamusume Pretty Derby Party Dash rip (The Spriters Resource), sheets built by tools/build_meek_art.py,
// which also draws the flower. Every patch is plain text applied to the game's code when it starts (see README).
//
// The flower is a projectile in G.projs (flower: true), so rollback snapshots carry it like any other shot.
// It never hits anyone itself; Bloom turns it into a burst projectile (bloom: true). Nothing here uses
// randomness for gameplay; Math.random only picks petal sparkles.
uvmod({
  settings: {
    pollen: { label: 'Pollen (slows them near the flower)', type: 'select', default: 'on', sync: true,
      options: [['on', 'On'], ['off', 'Off']] },
  },
  files: ['meek.png', 'meek_r.png', 'flower.png'],
  patches: [
    { note: 'sprite sheet',
      find: String.raw`const ASSETS = {`,
      after: String.raw`"meek": {"img": "{{file:meek.png}}", "imgR": "{{file:meek_r.png}}", "anims": {"100": [0, 4], "101": [4, 6], "102": [10, 6], "110": [16, 2], "111": [18, 7], "112": [25, 2], "113": [27, 2], "120": [29, 2], "121": [31, 1], "130": [32, 1], "131": [33, 1], "132": [34, 1], "133": [35, 1], "138": [36, 4], "139": [40, 3], "150": [43, 1], "151": [44, 1], "152": [45, 1], "153": [46, 1], "160": [47, 4], "161": [51, 4], "162": [55, 6], "163": [61, 4], "164": [65, 2], "200": [67, 10], "202": [77, 3], "203": [80, 4], "210": [84, 4], "300": [88, 8], "310": [96, 2], "320": [98, 7], "330": [105, 3], "340": [108, 1], "341": [109, 1], "350": [110, 4], "360": [114, 13], "361": [127, 2], "362": [129, 2], "363": [131, 2], "500": [133, 4], "510": [137, 6], "520": [143, 3], "530": [146, 2], "540": [148, 2], "550": [150, 4], "600": [154, 8], "601": [162, 17], "602": [179, 3], "700": [182, 6], "701": [188, 8], "703": [196, 3], "704": [199, 3], "706": [202, 5], "707": [207, 3], "730": [210, 4], "800": [214, 4], "801": [218, 6], "802": [224, 4], "810": [228, 1], "811": [229, 1], "812": [230, 1], "813": [231, 1], "820": [232, 2], "821": [234, 2], "822": [236, 2], "823": [238, 2], "824": [240, 1], "830": [241, 3], "840": [244, 3], "850": [247, 4], "860": [251, 4], "870": [255, 2], "880": [257, 2], "900": [259, 6], "910": [265, 1], "911": [266, 1], "920": [267, 6], "930": [273, 6], "940": [279, 4], "001A": [283, 3]}, "cols": 16}, ` },

    { note: 'fighter',
      re: String.raw`\bCHARS\s*=\s*\{`,
      replace: String.raw`CHARS = {
  // ---- Happy Meek (set-play movement)   [umaversus-mods: meek]
  // One flower at a time. Petal Step warps to it, Sprout Slide springs off it, Bloom sets it off from anywhere,
  // and passing through it in the air gives her air dash back.
  meek: {
    name: 'HAPPY MEEK', short: 'MEK', arch: 'SET-PLAY MOVEMENT', color: '#8f9ad8', color2: '#ffe2ec',
    blurb: 'Set-play movement. Plants one flower, then warps to it, springs off it and makes it bloom from anywhere. Light hits, hard to pin down.',
    hp: 9500, walk: 3.6, back: 3.2, dash: 10, jumpV: -15, jumpX: 4.4, grav: 0.76, airDash: true, backdash: { vx: 9, vy: -5.5, total: 21 }, dmgMul: 0.95,
    meekFlower: true, meekBarrier: true,
    throwAnim: '840', win: '600', winFrames: 8, intro: '940', ai: 'meek',
    look: {
      idleSpeed: 10, walkSpeed: 6, runSpeed: 4, idle2: '601', squash: 0.9,
      taunt: '510', tauntLine: '...Yay.', intros: ['940', '520'], wins: ['600', '510'],
      fxColor: '#c9c3ff', fxAlt: '#ffb3cb', motif: 'petals',
      fx: {
        '5S': [{ t: 9, type: 'motif', x: 30, y: -110, n: 5, spread: 20 }],
        '4S': [{ t: 3, type: 'ring', y: -120, r: 36 }],
        'SU': [{ t: 1, type: 'ring', y: -80, r: 150 }],
      },
    },
    combos: [
      { name: 'Starter', seq: '5L 5M 5H 41236M', note: 'Chain into Sprout Slide (low knockdown)' },
      { name: 'Low sweep', seq: '2L 2M 41236L', note: 'Lows into the short slide' },
      { name: 'Launcher air combo', seq: '2M 2H jc j.M j.H', note: 'Jump-cancel the launcher' },
      { name: 'Bloom launch', seq: '5M 5H 623M', note: 'Needs her flower near them: Bloom launches' },
    ],
    moves: baseNormals({
      '5S': { kind: 'special', name: 'Plant', input: 'S', motion: '236', cd: 80, note: 'Tosses a seed that grows into her flower (one at a time)', vnote: 'L near · M far',
        seq: [[0, 4, '920'], [1, 4, '920'], [2, 3, '920'], [3, 16, '920']], ev: { 10: 'meekPlant' },
        seed: { vx: 6.5, vy: -7, grav: 0.45, x0: 30, y0: -110 },
        v: { L: { seed: { vx: 3.2, vy: -6, grav: 0.45, x0: 30, y0: -110 } } },
        ex: { note: 'Blooms the moment it lands', seed: { vx: 6.5, vy: -7, grav: 0.45, x0: 30, y0: -110, bloom: true } } },
      '6S': { kind: 'special', name: 'Petal Step', input: '→ + S', motion: '214', cd: 90, note: 'Warps to her flower (no flower: a quick dash)', vnote: 'L lands beside it · M appears in the air above it',
        seq: [[0, 3, '830'], [1, 3, '830'], [2, 3, '830'],                          // t 1-9   curls up and vanishes
              [0, 3, '701'], [1, 3, '701'], [2, 3, '701'], [3, 3, '701'],             // t 10-21 no flower: a dash
              [0, 10, '800'],                                                         // t 22-31 dash recovery (ends at 31)
              [1, 4, '830'], [2, 6, '802'], [3, 8, '802']],                          // t 32-49 arriving beside the flower
        ev: { 9: 'meekStep', 31: 'meekStepEnd' }, vel: [[10, 21, 10]], arriveT: 31, step: { air: true },
        v: { L: { step: { air: false } } },
        ex: { note: 'Invincible, and the flower bursts as she arrives', inv: [1, 44], step: { air: false, burst: true } } },
      '4S': { kind: 'special', name: 'Bloom', input: '← + S', motion: '623', cd: 120, note: 'Her flower bursts into a launching pillar, wherever it is', vnote: 'L comes out faster',
        seq: [[0, 4, '840'], [1, 3, '840'], [2, 18, '840']], ev: { 7: 'meekBloom' },
        bloomHit: H({ dmg: 900, hs: 26, bs: 16, lvl: 3, kd: true, launch: [1, -12.5], chip: 0.1, push: 2 }), bloomHits: 1,
        v: { L: { seq: [[0, 3, '840'], [1, 2, '840'], [2, 16, '840']], ev: { 5: 'meekBloom' },
                  bloomHit: H({ dmg: 780, hs: 26, bs: 14, lvl: 3, kd: true, launch: [1, -12], chip: 0.1, push: 2 }) } },
        ex: { note: 'Bigger pillar that hits twice', bloomHits: 2, bloomBox: [-72, -205, 144, 205],
              bloomHit: H({ dmg: 640, hs: 26, bs: 16, lvl: 3, kd: true, launch: [1, -13.5], chip: 0.1, push: 2 }) } },
      '2S': { kind: 'special', name: 'Sprout Slide', input: '↓ + S', motion: '41236', cd: 110, note: 'Low slide. Through her flower it springs her into the air', vnote: 'L shorter',
        seq: [[2, 4, '300'], [3, 3, '300'], [4, 3, '300'], [5, 3, '300'], [3, 3, '300'], [4, 3, '300'], [5, 3, '300'], [6, 6, '300'], [7, 8, '300']],
        vel: [[4, 22, 9.5]], hurtFrom: 4, hurtTo: 30, hurt: [-35, -50, 95, 50], slide: [4, 22],
        hits: [H({ f: [6, 20], box: [10, -50, 90, 45], dmg: 700, hs: 20, bs: 12, lvl: 2, guard: 'low', kd: true, launch: [3, -6], chip: 0.1, push: 3 })],
        v: { L: { vel: [[4, 15, 9]] } },
        ex: { note: 'Faster and farther, hard knockdown', vel: [[3, 24, 11.5]], hit: { hard: true } } },
      'jS': { kind: 'special', name: 'Seed Drop', input: 'S in the air', motion: '236', cd: 80, note: 'Throws a seed down from the air, once per jump', vnote: 'L straight down · M forward',
        air: true, seq: [[0, 4, '850'], [1, 14, '850']], ev: { 5: 'meekPlant' }, landRec: 6,
        seed: { vx: 4.5, vy: 5, grav: 0.3, x0: 20, y0: -60 },
        v: { L: { seed: { vx: 1, vy: 6, grav: 0.3, x0: 15, y0: -60 } } },
        ex: { note: 'Blooms the moment it lands, and she hangs in the air', seed: { vx: 4.5, vy: 5, grav: 0.3, x0: 20, y0: -60, bloom: true }, vel: [[5, 14, 0, -1.2]] } },
      'SU': { kind: 'super', name: 'Vroom, Vroom', input: 'S + H (full Spurt)', note: 'Five stunning beams in a fan, and four more from her flower', inv: [1, 44],
        seq: [[0, 12, '341'], [0, 4, '920'], [1, 4, '920'], [2, 4, '920'], [3, 26, '920'], [3, 16, '800']], ev: { 25: 'meekBeams' },
        beam: H({ dmg: 800, hs: 46, bs: 14, lvl: 2, push: 1, chip: 0.08 }), fbeam: H({ dmg: 560, hs: 40, bs: 12, lvl: 2, push: 1, chip: 0.08 }) },
    }),
  },
` },

    { note: 'roster',
      re: String.raw`(const ROSTER = \[[^\]]*)\]`,
      replace: String.raw`$1, 'meek']` },

    { note: 'flower + events',
      find: String.raw`function doEvent(p, ev) {`,
      before: String.raw`/* >>> meek (Happy Meek mod) */
const MEEK_POLLEN = {{setting:pollen}} === 'on';
const MEEK_LIFE = 480, MEEK_BUD = 30, MEEK_SEED_BOX = [-8, -8, 16, 16], MEEK_FLOWER_BOX = [-22, -92, 44, 92], MEEK_BLOOM_BOX = [-56, -178, 112, 178];
const MEEK_IMG = typeof Image !== 'undefined' ? Object.assign(new Image(), { src: "{{file:flower.png}}" }) : null;
function meekFlowerOf(side) { for (const q of G.projs) if (q.flower && q.owner === side && !q.dead) return q; return null; }
function meekRooted(side) { const f = meekFlowerOf(side); return f && f.phase !== 'fly' ? f : null; }
function meekPetals(x, y, n, spread) {   // cosmetic only
  if (G.resim) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
    G.fx.push({ type: 'mot', motif: 'petals', color: Math.random() < 0.6 ? '#ffffff' : '#ffb3cb', x: x + Math.cos(a) * spread * 0.3, y: y + Math.sin(a) * spread * 0.3,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2, rot: Math.random() * 6, vr: (Math.random() - .5) * 0.4, t: 0, life: 22 + Math.random() * 14, size: 4 + Math.random() * 3 });
  }
}
function meekWilt(q) { q.dead = true; meekPetals(q.x, q.y - (q.phase === 'fly' ? 0 : 40), 8, 30); }
function meekPlant(p) {
  const sd = p.move.seed;
  for (const q of G.projs) if (q.flower && q.owner === p.side && !q.dead) meekWilt(q);   // one flower at a time
  G.projs.push({ owner: p.side, simple: p.simple, style: 'meekFlower', flower: true, phase: 'fly', quick: !!sd.bloom, hitsLeft: 0, cool: 0,
    x: Math.max(30, Math.min(STAGE_W - 30, p.x + p.facing * sd.x0)), y: p.y + sd.y0, facing: p.facing, vx: sd.vx * p.facing, vy: sd.vy, grav: sd.grav,
    life: 999, box: MEEK_SEED_BOX, hit: null, t: 0, dead: false, sup: false, size: 1, roll: 0, trap: null, src: baseId(p.move.id), inst: p.frame - p.t });
  Sfx.play('wind');
}
function meekBloomAt(p, f, hit, n, box, src) {
  f.dead = true; meekPetals(f.x, GY - 50, 16, 50);
  G.projs.push({ owner: p.side, simple: p.simple, style: 'meekBloom', bloom: true, phase: 'boom', hitsLeft: n || 1, cool: 0,
    x: f.x, y: GY, facing: p.facing, vx: 0, vy: 0, grav: 0, life: 16 + ((n || 1) - 1) * 9, box: box || MEEK_BLOOM_BOX, hit, t: 0, dead: false,
    sup: false, size: 1, roll: 0, trap: null, src: src, inst: p.frame - p.t });
  G.shake = Math.max(G.shake, 4); Sfx.play('heavy');
}
function meekBeam(p, x, y, dir, a, sp, hit, k) {
  G.projs.push({ owner: p.side, simple: false, style: 'meekBeam', hitsLeft: 1, cool: 0, x, y, facing: dir, vx: Math.cos(a) * sp * dir, vy: Math.sin(a) * sp,
    life: 70, box: [-17, -17, 34, 34], hit, t: 0, dead: false, sup: true, size: 1, grav: 0, roll: 0, trap: null, phase: null, src: 'SU', inst: p.frame - p.t + k });
}
// per frame, from updateProjs: the flower grows, wilts, refreshes her air dash, springs her off a slide, slows them
function meekFlowerTick(q) {
  const me = G.p[q.owner], o = opp(me);
  q.t++;
  if (q.phase === 'fly') {
    q.vy += q.grav; q.x += q.vx; q.y += q.vy;
    if (q.x < 30 || q.x > STAGE_W - 30) { q.x = Math.max(30, Math.min(STAGE_W - 30, q.x)); q.vx = 0; }   // the stage edge: drops straight down
    if (q.vy > 0 && q.y >= GY) {
      q.y = GY; q.vx = q.vy = 0; q.grav = 0; q.t = 0; q.life = MEEK_LIFE; q.box = MEEK_FLOWER_BOX; q.phase = q.quick ? 'bloom' : 'bud';
      dust(q.x, GY, 1); dust(q.x, GY, -1); if (q.quick) meekPetals(q.x, GY - 45, 6, 24);
    }
    return;
  }
  if (q.phase === 'bud' && q.t >= MEEK_BUD) { q.phase = 'bloom'; meekPetals(q.x, GY - 50, 5, 20); }
  if (--q.life <= 0) { meekWilt(q); return; }
  // Sprout Slide through her own flower: springs her up, air dash back
  const m = me.state === 'attack' && me.move;
  if (m && m.slide && me.t >= m.slide[0] && me.t <= m.slide[1] && Math.abs(me.x - q.x) < 30) {
    me.setState('air'); me.vy = -12.5; me.vx = me.facing * 4.5; me.jx = 1; me.airAct = 1; me.airS = false; me.meekRef = 1; me.y = Math.min(me.y, GY - 1);
    addText('SPRING!', me.x, GY - 190, '#ffe671', 16, 26); meekPetals(q.x, GY - 40, 8, 30); dust(me.x, GY, me.facing);
    return;
  }
  // Refresh: passing through it in the air gives Meek her air dash back, once per jump
  if (me.c.airDash && me.airAct === 0 && !me.meekRef && ['air', 'airdash', 'attack'].includes(me.state) && me.airborne && me.y > GY - 125 && Math.abs(me.x - q.x) < 42) {
    me.airAct = 1; me.meekRef = 1;
    addText('REFRESH', me.x, me.y - 150, '#c9c3ff', 14, 22); meekPetals(q.x, GY - 50, 5, 20);
  }
  // Pollen: walking or dashing near the open flower is 25% slower
  if (MEEK_POLLEN && q.phase === 'bloom' && !o.airborne && (o.state === 'walk' || o.state === 'dash') && Math.abs(o.x - q.x) < 110) o.x -= o.vx * 0.25;
}
function meekEvent(p, ev) {
  const m = p.move || {};
  if (ev === 'meekPlant') { meekPlant(p); return; }
  if (ev === 'meekStep') {
    const f = meekRooted(p.side), st = m.step || {};
    if (!f) return;   // no flower: the dash part of the move plays out
    const o = opp(p);
    meekPetals(p.x, p.y - 70, 8, 40);
    if (!G.resim) G.fx.push({ type: 'vfx', kind: 'vanish', x: p.x, y: p.y - 70, ox: 0, oy: 0, facing: p.facing, t: 0, life: 14, color: '#c9c3ff', alt: '#ffb3cb', seed: G.frameCount });
    p.x = Math.max(40, Math.min(STAGE_W - 40, f.x));
    if (o.x !== p.x) p.facing = o.x > p.x ? 1 : -1;
    if (st.air) { p.setState('air'); p.y = GY - 150; p.vy = -3; p.vx = 0; p.jx = 0; p.airAct = 1; p.airS = false; p.meekRef = 1; }
    else { p.y = GY; p.vx = 0; p.t = m.arriveT; }
    if (st.burst) meekBloomAt(p, f, CHARS.meek.moves['4SX'].bloomHit, 2, CHARS.meek.moves['4SX'].bloomBox, '6S');
    meekPetals(p.x, p.y - 70, 8, 40);
    if (!G.resim) G.fx.push({ type: 'vfx', kind: 'vanish', x: p.x, y: p.y - 70, ox: 0, oy: 0, facing: p.facing, t: 0, life: 14, color: '#ffb3cb', alt: '#c9c3ff', seed: G.frameCount + 1 });
    return;
  }
  if (ev === 'meekStepEnd') { if (p.state === 'attack') p.setState('idle'); return; }
  if (ev === 'meekBloom') {
    const f = meekRooted(p.side);
    if (!f) { addText('NO FLOWER', p.x, GY - 175, '#cfd6ff', 13, 22); return; }
    meekBloomAt(p, f, m.bloomHit, m.bloomHits || 1, m.bloomBox, '4S');
    addText('BLOOM!', f.x, GY - 200, '#ffb3cb', 18, 26);
    return;
  }
  if (ev === 'meekBeams') {
    const d = p.facing, x0 = p.x + d * 42, y0 = p.y - 104;
    [-0.42, -0.21, 0, 0.21, 0.42].forEach((a, k) => meekBeam(p, x0, y0, d, a, 15, m.beam, k));
    const f = meekRooted(p.side);
    if (f) {
      const o = opp(p), fd = o.x >= f.x ? 1 : -1;
      [-0.75, -0.5, -0.25, 0].forEach((a, k) => meekBeam(p, f.x + fd * 10, GY - 70, fd, a, 14, m.fbeam, 5 + k));
      meekPetals(f.x, GY - 60, 10, 30);
    }
    G.shake = Math.max(G.shake, 6); Sfx.play('heavy');
  }
}
// drawing: the flower (behind the fighters), its bloom pillar, the super's beams
function meekDraw(q, x) {
  const own = G.p[q.owner];
  if (q.style === 'meekFlower') {
    const ok = MEEK_IMG && MEEK_IMG.complete && MEEK_IMG.naturalWidth;
    if (q.phase === 'fly') {
      if (ok) { ctx.save(); ctx.translate(Math.round(x), Math.round(q.y)); ctx.rotate(q.t * 0.25); ctx.drawImage(MEEK_IMG, 0, 24, 24, 8, -36, -12, 72, 24); ctx.restore(); }
      return;
    }
    if (MEEK_POLLEN && q.phase === 'bloom') {   // the pollen ring on the floor
      ctx.globalAlpha = 0.22 + 0.08 * Math.sin(q.t * 0.12); ctx.strokeStyle = '#ffe671'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, GY - 2, 110, 9, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      if (!G.resim && Math.random() < 0.08) G.fx.push({ type: 'mot', motif: 'sparkle', color: '#ffe671', x: q.x + (Math.random() - .5) * 180, y: GY - 10 - Math.random() * 40, vx: 0, vy: -0.6, rot: 0, vr: 0, t: 0, life: 30, size: 3 });
    }
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, GY - 1, 18, 4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    if (q.life < 60 && Math.floor(q.life / 4) % 2) ctx.globalAlpha = 0.45;   // about to wilt: blinks
    const cell = q.phase === 'bud' ? (q.t < 10 ? 1 : 2) : 3 + [0, 1, 0, 2][Math.floor(q.t / 18) % 4];
    if (ok) ctx.drawImage(MEEK_IMG, cell * 24, 0, 24, 32, Math.round(x) - 36, GY - 96, 72, 96);
    else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, GY - 60, 14, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    return;
  }
  if (q.style === 'meekBloom') {
    const life = q.life + q.t, k = Math.min(1, q.t / Math.max(1, life)), h = 205 * Math.min(1, 0.4 + q.t * 0.15), w = 64 * (1 - k * 0.6);
    const g = ctx.createLinearGradient(0, GY - h, 0, GY); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, '#ffb3cb'); g.addColorStop(1, '#ffffff');
    ctx.globalAlpha = 0.8 * (1 - k); ctx.fillStyle = g; ctx.fillRect(x - w / 2, GY - h, w, h);
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 1 - k; ctx.fillRect(x - w / 6, GY - h, w / 3, h);
    ctx.strokeStyle = '#c9c3ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, GY - 4, 40 + q.t * 4, 8 + q.t * 0.6, 0, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
    if (q.t % 2 === 0 && q.t < 12 && !G.resim) meekPetals(q.x, GY - 40 - q.t * 10, 2, 30);
    return;
  }
  if (q.style === 'meekBeam') {
    const y = q.y, tx = x - q.vx * 4, ty = y - q.vy * 4;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.35; ctx.strokeStyle = '#c9c3ff'; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffb3cb'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 8 + Math.sin(q.t * 0.8) * 2, 0, 7); ctx.fill();
    ctx.lineCap = 'butt';
  }
}
/* <<< meek */
` },
    { note: 'events',
      find: String.raw`function doEvent(p, ev) {`,
      after: String.raw`
  if (typeof ev === 'string' && ev.startsWith('meek')) { meekEvent(p, ev); return; }   // [umaversus-mods: meek]` },

    { note: 'flower update',
      find: String.raw`if (q.grav) q.vy += q.grav;`,
      before: String.raw`if (q.flower) { meekFlowerTick(q); continue; }   // [meek]
    ` },
    { note: 'flower never hits',
      find: String.raw`if (q.dead || q.cool > 0) continue;`,
      after: String.raw` if (q.flower) continue;   // [meek]` },
    { note: 'flower vs projectiles',
      find: String.raw`if (A.sup !== B.sup) (A.sup ? B : A).dead = true; else A.dead = B.dead = true;`,
      before: String.raw`if (A.flower || B.flower) { if (A.flower) meekWilt(A); if (B.flower) meekWilt(B); } else ` },
    { note: 'flower vs reflectors',
      find: String.raw`!q.sup && !q.trap && overlap(projRect(q), r)`,
      replace: String.raw`!q.sup && !q.trap && !q.flower && overlap(projRect(q), r)` },
    { note: 'strikes pop the flower',
      find: String.raw`if (q.trap && q.owner !== a.side && q.phase !== 'boom'`,
      replace: String.raw`if ((q.trap || q.flower) && q.owner !== a.side && q.phase !== 'boom'` },
    { note: 'popped flower wilts',
      find: String.raw`q.dead = true; spark(q.x, q.y - 10, 'block', 1, 0); addText('POP'`,
      before: String.raw`if (q.flower) meekWilt(q); ` },
    { note: 'flower stays when she is hit',
      find: String.raw`!q.sup && !q.pup && q.phase !== 'boom')`,
      replace: String.raw`!q.sup && !q.pup && !q.flower && q.phase !== 'boom')` },
    { note: 'Bloom is blocked facing Meek',
      find: String.raw`q.trap ? G.p[q.owner].x : d.x - dir * 40`,
      replace: String.raw`(q.trap || q.bloom) ? G.p[q.owner].x : d.x - dir * 40` },
    { note: 'B-Barrier',
      find: String.raw`if (invulnerable(d, fromAir)) return null;`,
      after: String.raw`
  if (proj && d.c.meekBarrier && !d.meekBar && !proj.pup && !proj.sup) {   // [meek] B-Barrier: the first projectile each round is absorbed
    d.meekBar = 1; d.flash = 8; spark(proj.x, proj.y, 'block', 2, 0); callout(d, 'B-BARRIER', 'def'); Sfx.play('block'); return 'block';
  }` },
    { note: 'per-round state',
      find: String.raw`this.throwT = 0; this.throwBack = false; this.ai = null;`,
      after: String.raw` this.meekBar = 0; this.meekRef = 0;` },
    { note: 'refresh resets on each jump',
      find: String.raw`p.airAct = (c.airDash || c.doubleJump) ? 1 : 0; p.adLand = false;`,
      after: String.raw` p.meekRef = 0;` },
    { note: 'draw: flower behind the fighters',
      find: String.raw`for (const p of G.p) drawShadow(p, left);`,
      after: String.raw`
  for (const q of G.projs) if (q.flower) meekDraw(q, q.x - left);   // [meek]
  for (const p of G.p) if (p.c.meekBarrier && !p.meekBar && G.phase === 'fight') { ctx.globalAlpha = 0.3; ctx.strokeStyle = '#c9c3ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x - left, p.y - 2, 30, 6, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }` },
    { note: 'draw: bloom and beams',
      find: String.raw`function drawProj(q, left) {`,
      after: String.raw`
  if (q.flower) return;   // [meek] drawn behind the fighters
  if (q.style === 'meekBloom' || q.style === 'meekBeam') { meekDraw(q, q.x - left); return; }` },
    { note: 'move list',
      find: String.raw`if (c.ai === 'footsies') rows.push(`,
      before: String.raw`if (c.meekFlower) rows.push(['Flower (' + c.short + ')', 'one at a time', 'Lasts 8 s · any hit or shot wilts it · stays when she is hit · fly through it: air dash back'],
    ['Pollen · B-Barrier (' + c.short + ')', 'passive', (MEEK_POLLEN ? 'They walk 25% slower near the open flower · ' : '') + 'the first projectile each round is absorbed']);
  ` },
    { note: 'CPU habits',
      find: String.raw`  // set-play: keep potions on the floor`,
      before: String.raw`  // [meek] plant from range, bloom it when they stand on it, step to it to escape or to cross up a rising opponent
  if (me.c.ai === 'meek') {
    const f = meekRooted(me.side);
    if (f && f.phase === 'bloom' && Math.abs(f.x - o.x) < 70 && r < 0.12 * L && skillReady(me, '4S')) return motion('623M');
    if (!f && dist > 200 && r < 0.04 * L && skillReady(me, '5S')) return motion(dist > 320 ? '236M' : '236L');
    if (f && (o.state === 'down' || o.state === 'wake') && Math.abs(f.x - o.x) < 160 && r < 0.2 && skillReady(me, '6S')) return motion('214L');
    if (f && dist < 140 && Math.abs(f.x - me.x) > 260 && r < 0.02 * L && skillReady(me, '6S')) return motion('214M');
    if (f && Math.abs(f.x - me.x) < 220 && Math.sign(f.x - me.x) === Math.sign(o.x - me.x) && dist > 150 && dist < 260 && !o.airborne && r < 0.02 * L && skillReady(me, '2S')) return motion('41236M');
    if (dist < 130 && r < 0.02 * L) { ai.seq = [{ b: 1 }, {}, { b: 1 }]; return out; }
  }
` },
    { note: 'CPU: Bloom is not an anti-air',
      find: String.raw`aa && !aa.pup && skillReady(me, '4S')`,
      replace: String.raw`aa && !aa.pup && !me.c.meekFlower && skillReady(me, '4S')` },
    { note: 'CPU spacing',
      find: String.raw`const PREF = {`,
      after: String.raw` meek: 210,` },

    { note: 'RIVAL',
      find: String.raw`const RIVAL = {`,
      after: String.raw` meek: 'spe',` },
    { note: 'LINES',
      find: String.raw`const LINES = {`,
      after: String.raw`
  meek: { intro: ['...Let\'s run. Lots.', 'Trainer said... do my best. Okay.'],
    win: ['...I won. Yay.', '...Flowers are nice. Winning is nicer.', 'Ah... the race is over? ...Yay.'] },` },
    { note: 'RIVAL_LINE',
      find: String.raw`const RIVAL_LINE = {`,
      after: String.raw`
  meek: 'Meek-chan... you can run any race at all, can\'t you? Then let\'s make this one the best!',` },
    { note: 'ENDINGS',
      find: String.raw`const ENDINGS = {`,
      after: String.raw`
  meek: ['The last race is over. Happy Meek looks at the finish line for a long time, then at the trophy, then at the finish line again.',
    'Her trainer is crying a little. Meek pats her on the head, the way Aoi usually does for her.',
    'That evening she plants the trophy\'s ribbon next to a white flower behind the dorm. ...Yay.'],` },
    { note: 'SKIN',
      find: String.raw`const SKIN = {`,
      after: String.raw` meek: ['#f8decc', '#febebc', '#e79ea8', '#eca0b1', '#ffb3cb'],` },
    { note: 'RATING',
      find: String.raw`const RATING = {`,
      after: String.raw` meek: [4, 2, 4, 5],` },
  ],
});
