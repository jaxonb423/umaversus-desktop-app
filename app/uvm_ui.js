// ================================================================ Uma Versus Mod Manager: the MODS tab
// Screens: 'mods' (your mods), 'modcat' (the catalog), 'modedit' (one mod's info + settings).
// Drawn with the game's own helpers so it looks like the rest of the menus. Mouse, keyboard and pads all work.
// Mods are code. The mod loader installs them into the game right here: every install, update, removal,
// on/off switch or setting change makes the modded game again (UVM.commit) and saves it, and the game
// runs that saved copy when it starts. The new game runs after RESTART.
const UVMUI = { recs: null, loading: false, cat: null, catErr: '', catLoading: false, focus: 0, scroll: 0, catFocus: 0, catScroll: 0,
  editId: null, editIdx: 0, dirty: false, busy: {}, msg: '', msgT: 0, removeArm: null, removeT: 0, query: '', hot: [], imgs: {}, defs: {} };

const UVM_SCREENS = ['mods', 'modcat', 'modedit'];
let uvmBroken = null;   // set when drawing the MODS screens failed (a game update renamed something): use the simple panel
function uvmSafe(f, quiet) {
  try { return f(); }
  catch (e) {
    console.error('[uvm]', e);
    if (!quiet) { uvmBroken = (e && e.message) || String(e); if (UVM_SCREENS.includes(UI.screen)) UI.screen = 'mode'; uvmFallback(uvmBroken); }
  }
}
function uvmOpen() {
  if (uvmBroken || !UVM.hooks.tick || !UVM.hooks.renderScreen) { uvmFallback(uvmBroken); return; }
  UI.screen = 'mods'; UVMUI.focus = UVMUI.focus || 0; uvmRefresh(); if (!UVMUI.cat) uvmLoadCatalog();
}
function uvmSay(s) { UVMUI.msg = s; UVMUI.msgT = 240; }
function uvmFmtSize(n) { return !n ? '' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B'; }
function uvmCmpVer(a, b) {   // -1 / 0 / 1, numeric dotted versions
  const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}
function uvmRunning(id) { return UVM.mods.some(m => m.id === id); }
function uvmOn(id) { return !!UVM.state.enabled[id]; }

// ---------------------------------------------------------------- data
async function uvmRefresh() {
  UVMUI.loading = true;
  try {
    const list = (await UVM.all()) || [];
    list.sort((a, b) => (a.meta.name || a.id).localeCompare(b.meta.name || b.id));
    UVMUI.recs = list;
    for (const r of list) {
      if (!UVMUI.defs[r.id]) { try { UVMUI.defs[r.id] = UVM.evalMod(r.src); } catch (e) { UVMUI.defs[r.id] = { settings: {}, patches: [], err: e.message }; } }
      for (const k of ['icon', 'banner']) if (r.art && r.art[k]) uvmImg(r.id + ':' + k, r.art[k]);
    }
  } catch (e) { UVMUI.recs = []; uvmSay('Mod storage is not available: ' + (e.message || e)); }
  UVMUI.loading = false;
}
function uvmImg(key, src) {   // src: Blob (stored art) or URL; blobs keep the canvas same-origin
  if (UVMUI.imgs[key]) return UVMUI.imgs[key];
  const im = new Image(); im.src = typeof src === 'string' ? src : URL.createObjectURL(src);
  return (UVMUI.imgs[key] = im);
}
async function uvmBlob(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status + ' for ' + url); return r.blob(); }
async function uvmLoadCatalog() {
  UVMUI.catLoading = true; UVMUI.catErr = '';
  try {
    const r = await fetch(UVM.catalogUrl, { cache: 'no-cache' });
    if (!r.ok) throw new Error('catalog answered ' + r.status);
    const j = await r.json();
    UVMUI.cat = (j.mods || []).filter(m => m && /^[a-z0-9-]+$/.test(m.id) && m.url);
    for (const m of UVMUI.cat) for (const k of ['icon', 'banner']) if (m[k]) uvmBlob(new URL(m[k], UVM.catalogUrl).href).then(b => uvmImg('cat:' + m.id + ':' + k, b), () => { });
  } catch (e) { UVMUI.catErr = "Couldn't load the catalog: " + (e.message || e); }
  UVMUI.catLoading = false;
}
function uvmCatEntry(id) { return (UVMUI.cat || []).find(m => m.id === id); }

// install or update from a .uvmod.js link (catalog entries pass themselves for the art)
async function uvmInstall(url, entry) {
  const key = entry ? entry.id : url;
  if (UVMUI.busy[key]) return;
  UVMUI.busy[key] = 'downloading';
  try {
    const src = await (await fetch(url, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status + ' for ' + url); return r; })).text();
    const meta = UVM.parseHeader(src), def = UVM.evalMod(src);
    if (entry && entry.id !== meta.id) throw new Error('catalog says ' + entry.id + ' but the file is ' + meta.id);
    const files = {}; let size = src.length;
    const names = Array.isArray(def.files) ? def.files : Object.keys(def.files);
    for (const n of names) {
      UVMUI.busy[key] = 'downloading ' + n;
      const where = Array.isArray(def.files) ? n : def.files[n];
      files[n] = await uvmBlob(new URL(where, url).href); size += files[n].size;
    }
    const art = {};
    for (const k of ['icon', 'banner']) {
      const a = (entry && entry[k]) || meta[k];
      if (a) { try { art[k] = await uvmBlob(new URL(a, entry ? UVM.catalogUrl : url).href); } catch (e) { } }
    }
    const old = await UVM.get(meta.id);
    UVMUI.busy[key] = 'installing';
    await UVM.put({ id: meta.id, meta, src, url, files, art, size, installedAt: Date.now() });
    // install it into this game version now: if it doesn't fit, put things back the way they were
    const check = await UVM.commit({ try: { [meta.id]: true } }).catch(e => ({ errors: { [meta.id]: e.message || String(e) } }));
    if (check.errors[meta.id]) {
      if (old) await UVM.put(old); else await UVM.del(meta.id);
      throw new Error(meta.name + " doesn't work on this game version (" + check.errors[meta.id] + ')');
    }
    if (!old) UVM.state.enabled[meta.id] = true;
    UVM.saveState();
    await UVM.commit();
    delete UVMUI.defs[meta.id]; delete UVMUI.imgs[meta.id + ':icon']; delete UVMUI.imgs[meta.id + ':banner'];
    UVMUI.dirty = true; uvmSay((old ? 'Updated ' : 'Installed ') + meta.name + ' ' + meta.version + '. Restart to play with it.');
    Sfx.play('stamp');
    await uvmRefresh();
  } catch (e) { uvmSay('Install failed: ' + (e.message || e)); Sfx.play('back'); }
  delete UVMUI.busy[key];
}
async function uvmRemove(id) {
  await UVM.del(id);
  delete UVM.state.enabled[id]; delete UVM.state.settings[id]; UVM.saveState();
  await uvmCommit();
  UVMUI.dirty = true; uvmSay('Removed. Restart to finish.'); await uvmRefresh();
  UVMUI.focus = Math.min(UVMUI.focus, Math.max(0, uvmFiltered().length - 1));
}
// make + save the modded game for the current mods and settings (shows a message if that fails)
async function uvmCommit() {
  try { const b = await UVM.commit(); UVMUI.lastErrors = b.errors; return b; }
  catch (e) { uvmSay("Couldn't save the modded game: " + (e.message || e)); return null; }
}
let uvmCommitT = null;
function uvmCommitSoon() { clearTimeout(uvmCommitT); uvmCommitT = setTimeout(uvmCommit, 300); }   // settings: once the cycling stops
async function uvmToggle(id) {
  const on = !uvmOn(id);
  UVM.state.enabled[id] = on; UVM.saveState(); UVMUI.dirty = true; Sfx.play('menu');
  const b = await uvmCommit();
  if (on && b && b.errors[id]) {   // it can't go into this game version: leave it off
    UVM.state.enabled[id] = false; UVM.saveState(); await uvmCommit();
    const r = (UVMUI.recs || []).find(x => x.id === id);
    uvmSay((r ? r.meta.name : id) + " can't be turned on: " + b.errors[id]); Sfx.play('back');
  }
}
async function uvmRestart() {
  Sfx.play('ok');
  if (uvmCommitT) { clearTimeout(uvmCommitT); uvmCommitT = null; await uvmCommit(); }
  await UVM.pending;
  setTimeout(() => location.reload(), 120);
}
async function uvmInstallLink() {
  const u = prompt('Link to a mod file (.uvmod.js):', 'https://');
  if (!u || !/^https?:\/\//.test(u.trim())) return;
  await uvmInstall(u.trim(), null);
}

function uvmFiltered() {
  const q = UVMUI.query.trim().toLowerCase(), list = UVMUI.recs || [];
  if (!q) return list;
  return list.filter(r => {
    const m = r.meta;
    if (q.startsWith('#')) return (m.tags || []).some(t => t.toLowerCase().startsWith(q.slice(1)));
    return [m.name, m.author, m.id, m.description, ...(m.tags || []).map(t => '#' + t)].join(' ').toLowerCase().includes(q);
  });
}

// ---------------------------------------------------------------- search box (a real text field over the canvas)
let uvmSearchEl = null;
function uvmSearchFocus(on) {
  if (!uvmSearchEl) {
    uvmSearchEl = document.createElement('input');
    Object.assign(uvmSearchEl, { type: 'text', placeholder: 'Search creators, names or #tags', spellcheck: false });
    Object.assign(uvmSearchEl.style, { position: 'fixed', zIndex: 50, border: '0', outline: 'none', background: 'transparent', color: '#fff',
      font: '600 16px "Barlow Condensed", sans-serif', padding: '0 6px', display: 'none' });
    uvmSearchEl.addEventListener('input', () => { UVMUI.query = uvmSearchEl.value; UVMUI.focus = 0; UVMUI.scroll = 0; });
    uvmSearchEl.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'ArrowDown') { uvmSearchEl.blur(); } });
    uvmSearchEl.addEventListener('blur', () => { uvmSearchEl.style.display = 'none'; });
    document.body.appendChild(uvmSearchEl);
  }
  if (!on) { uvmSearchEl.blur(); return; }
  const r = cv.getBoundingClientRect(), k = r.width / W;
  Object.assign(uvmSearchEl.style, { display: 'block', left: (r.left + 40 * k) + 'px', top: (r.top + 52 * k) + 'px', width: (628 * k) + 'px', height: (32 * k) + 'px', fontSize: Math.round(16 * k) + 'px' });
  uvmSearchEl.value = UVMUI.query; setTimeout(() => uvmSearchEl.focus(), 0);
}
function uvmTyping() { return uvmSearchEl && document.activeElement === uvmSearchEl; }

// ---------------------------------------------------------------- drawing pieces
function uvmHot(x, y, w, h, fn, hover) { UVMUI.hot.push({ x, y, w, h, fn, hover }); }
function uvmBtn(x, y, w, h, text, sel, fn, col) {
  if (sel) glow(col || ACCENT, 14, () => slant(x + 4, y + 3, w, h, 7, col || ACCENT));
  slant(x, y, w, h, 7, sel ? '#fff' : 'rgba(255,255,255,.1)');
  label(text, x + w / 2 + 3, y + h / 2 + 1, Math.min(15, h - 6), sel ? PAL.ink : '#fff', 'center', 900, true);
  if (fn) uvmHot(x, y, w, h, fn);
}
function uvmSwitch(x, y, on, fn) {
  rrect(x, y, 40, 20, 10, on ? PAL.turf : 'rgba(255,255,255,.18)', 'rgba(255,255,255,.35)', 1.5);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(on ? x + 30 : x + 10, y + 10, 7.5, 0, 7); ctx.fill();
  if (fn) uvmHot(x - 4, y - 4, 48, 28, fn);
}
function uvmDrawArt(img, x, y, w, h, seedText, r) {
  ctx.save(); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r || 0) : ctx.rect(x, y, w, h); ctx.clip();
  if (img && img.complete && img.naturalWidth) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * s, ih = img.naturalHeight * s;
    ctx.imageSmoothingEnabled = true; ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  } else {   // no art: a colour band with the first letter, like the Fister plugin manager
    const hue = (UVM.fnv(seedText || '?') % 360);
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, `hsl(${hue},62%,42%)`); g.addColorStop(1, `hsl(${(hue + 40) % 360},70%,28%)`);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    label((seedText || '?')[0].toUpperCase(), x + w / 2, y + h / 2 + 2, Math.min(h * 0.75, 64), 'rgba(255,255,255,.85)', 'center', 900, true);
  }
  ctx.restore();
}
function uvmTags(tags, x, y, maxX) {
  ctx.font = font(12, 700, false);
  for (const t of tags || []) {
    const s = '#' + t, w = ctx.measureText(s).width + 14;
    if (x + w > maxX) break;
    rrect(x, y, w, 17, 8.5, 'rgba(255,255,255,.1)', 'rgba(255,255,255,.28)', 1);
    label(s, x + w / 2, y + 9, 12, '#e8e0f6', 'center', 700);
    x += w + 5;
  }
}
function uvmClipLines(s, maxW, n) {
  const words = String(s || '').split(' '), out = []; let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; if (out.length === n) break; } else line = t;
  }
  if (out.length < n && line) out.push(line);
  if (out.length === n && words.join(' ') !== out.join(' ')) { let l = out[n - 1]; while (l && ctx.measureText(l + '…').width > maxW) l = l.slice(0, -1); out[n - 1] = l + '…'; }
  return out;
}

const UVM_CW = 296, UVM_CH = 184, UVM_GX = 24, UVM_GY = 104, UVM_GAP = 12;
function uvmCard(x, y, o) {   // o: { meta, art, sel, artKey, bottom(x, y) }
  const m = o.meta;
  if (o.sel) glow(ACCENT, 18, () => rrect(x - 2, y - 2, UVM_CW + 4, UVM_CH + 4, 12, null, ACCENT, 3));
  rrect(x, y, UVM_CW, UVM_CH, 10, 'rgba(34,17,60,.94)', o.sel ? '#fff' : 'rgba(255,255,255,.16)', o.sel ? 2 : 1.5);
  uvmDrawArt(UVMUI.imgs[o.artKey + ':banner'], x + 1, y + 1, UVM_CW - 2, 58, m.name, 9);
  ctx.fillStyle = 'rgba(34,17,60,.94)'; ctx.fillRect(x + 1, y + 50, UVM_CW - 2, 9);
  rrect(x + 10, y + 36, 42, 42, 8, '#fff');
  uvmDrawArt(UVMUI.imgs[o.artKey + ':icon'], x + 12, y + 38, 38, 38, m.name, 6);
  label(m.name, x + 60, y + 70, 17, '#fff', 'left', 900, true);
  label(['v' + m.version, m.author ? 'by ' + m.author : '', m.kind || '', o.size || ''].filter(Boolean).join(' · '), x + 60, y + 88, 12.5, PAL.dim, 'left', 600);
  ctx.font = font(13.5, 600, false);
  uvmClipLines(m.description, UVM_CW - 24, 2).forEach((l, i) => label(l, x + 12, y + 106 + i * 15, 13.5, '#e8e0f6', 'left', 600));
  uvmTags(m.tags, x + 12, y + 134, x + UVM_CW - 10);
  o.bottom(x, y + UVM_CH - 30);
}

// ---------------------------------------------------------------- screens
function uvmDraw() {
  UVMUI.hot = [];
  if (UVMUI.msgT > 0) UVMUI.msgT--;
  if (UI.screen === 'mods') uvmDrawMods();
  else if (UI.screen === 'modcat') uvmDrawCat();
  else uvmDrawEdit();
  if (UVMUI.msgT > 0 && UVMUI.msg) {
    ctx.globalAlpha = Math.min(1, UVMUI.msgT / 30);
    rrect(W / 2 - 300, HGT - 88, 600, 28, 8, 'rgba(23,12,40,.95)', PAL.gold, 1.5);
    label(UVMUI.msg, W / 2, HGT - 73, 14, '#fff', 'center', 700);
    ctx.globalAlpha = 1;
  }
}
function uvmTopRow(items, focusIdx) {   // search field + buttons along the top
  const x0 = 24, y = 52;
  rrect(x0, y, 660, 34, 8, 'rgba(255,255,255,.08)', focusIdx === 0 ? '#fff' : 'rgba(255,255,255,.3)', focusIdx === 0 ? 2 : 1.5);
  ctx.strokeStyle = PAL.dim; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x0 + 18, y + 15, 6, 0, 7); ctx.moveTo(x0 + 22, y + 20); ctx.lineTo(x0 + 27, y + 25); ctx.stroke();
  if (!uvmTyping()) label(UVMUI.query || 'Search creators, names or #tags', x0 + 36, y + 18, 16, UVMUI.query ? '#fff' : PAL.dim, 'left', 600);
  uvmHot(x0, y, 660, 34, () => { UVMUI.focus = -1; uvmSearchFocus(true); });
  let bx = 696;
  const bw = items.length > 1 ? (240 - (items.length - 1) * 8) / items.length : 240;
  items.forEach((it, i) => { uvmBtn(bx, y + 2, bw, 30, it.text, focusIdx === i + 1, it.fn, it.col); bx += bw + 8; });
}
function uvmFooter(text) {
  const y = HGT - 44;
  if (UVMUI.dirty) {
    glow(PAL.gold, 10, () => rrect(24, y - 10, W - 48, 22, 6, 'rgba(246,195,67,.18)', PAL.gold, 1.5));
    label(UI.screen === 'modedit' ? 'Changes apply after a restart — choose "Restart now" above' : 'Changes apply after a restart — press RESTART (top right)', W / 2, y + 1, 13.5, PAL.gold, 'center', 800);
  } else if (UVM.safe) label('SAFE MODE (?mods=off): every mod is off this session', W / 2, y + 1, 13.5, PAL.gold, 'center', 800);
  else if (UVM.notice && UI.screen === 'mods') label(UVM.notice, W / 2, y + 1, 13, PAL.gold, 'center', 700);
  else label(text, W / 2, y + 1, 13, PAL.dim, 'center', 600);
}

function uvmDrawMods() {
  menuBg(0.8, PAL.rose);
  topBar('MODS', UVMUI.dirty ? '' : UVM.active ? `${UVM.mods.length} running · build ${BUILD}` : 'no mods running');
  if (UVMUI.dirty) uvmBtn(W - 150, 8, 132, 26, 'RESTART', UVMUI.focus === -4, uvmRestart, PAL.gold);
  const list = uvmFiltered();
  uvmTopRow([{ text: '+ ADD MOD', fn: () => { UI.screen = 'modcat'; if (!UVMUI.cat) uvmLoadCatalog(); Sfx.play('ok'); } }], UVMUI.focus === -1 ? 0 : UVMUI.focus === -2 ? 1 : -9);
  if (UVMUI.recs === null || UVMUI.loading && !UVMUI.recs) label('Loading…', W / 2, 250, 18, '#fff', 'center', 700);
  else if (!list.length) {
    panel(W / 2 - 300, 170, 600, 130, PAL.rose);
    txt(UVMUI.query ? 'NO MATCHES' : 'NO MODS YET', W / 2, 214, 30, '#fff');
    label(UVMUI.query ? 'Try another name, creator or #tag.' : 'Press + ADD MOD to browse the catalog: new runners, new moves and more.', W / 2, 254, 15, '#e8e0f6', 'center', 600);
    label('Mods are code. They change the game once you install them. Only add mods from people you trust.', W / 2, 278, 13, PAL.dim, 'center', 600);
  } else {
    const rows = Math.ceil(list.length / 3), sel = UVMUI.focus;
    if (sel >= 0) { const r = Math.floor(sel / 3); if (r < UVMUI.scroll) UVMUI.scroll = r; if (r > UVMUI.scroll + 1) UVMUI.scroll = r - 1; }
    UVMUI.scroll = Math.max(0, Math.min(UVMUI.scroll, rows - 2));
    list.forEach((rec, i) => {
      const r = Math.floor(i / 3) - UVMUI.scroll; if (r < 0 || r > 1) return;
      const x = UVM_GX + (i % 3) * (UVM_CW + UVM_GAP), y = UVM_GY + r * (UVM_CH + UVM_GAP), id = rec.id;
      const err = (UVMUI.lastErrors || UVM.errors)[id] || (UVMUI.defs[id] && UVMUI.defs[id].err), on = uvmOn(id), run = uvmRunning(id), arm = UVMUI.removeArm === id && UVMUI.removeT > 0;
      const upd = uvmCatEntry(id) && uvmCmpVer(uvmCatEntry(id).version, rec.meta.version) > 0;
      uvmCard(x, y, { meta: rec.meta, artKey: id, sel: sel === i, size: uvmFmtSize(rec.size), bottom: (bx, by) => {
        uvmSwitch(bx + 12, by + 4, on, () => { UVMUI.focus = i; uvmToggle(id); });
        const st = err && on ? ['ERROR', PAL.p2] : on !== run ? ['RESTART', PAL.gold] : on ? ['ON', PAL.turf] : ['OFF', PAL.dim];
        label(st[0], bx + 60, by + 15, 13, st[1], 'left', 900, true);
        if (upd) { const ux = bx + 60 + (st[0].length * 9) + 8; label(UVMUI.busy[id] ? '…' : 'UPDATE', ux, by + 15, 12, PAL.gold, 'left', 900, true);
          uvmHot(ux - 4, by + 3, 58, 24, () => { UVMUI.focus = i; const c = uvmCatEntry(id); uvmInstall(new URL(c.url, UVM.catalogUrl).href, c); }); }
        uvmBtn(bx + 140, by + 2, 66, 24, 'EDIT', false, () => { UVMUI.focus = i; uvmEdit(id); });
        uvmBtn(bx + 214, by + 2, 72, 24, arm ? 'SURE?' : 'REMOVE', arm, () => { UVMUI.focus = i; uvmRemoveAsk(id); }, PAL.p2);
      } });
      uvmHot(x, y, UVM_CW, UVM_CH - 32, () => { UVMUI.focus = i; }, true);
      if (err && on) { rrect(x + 8, y + 6, UVM_CW - 16, 22, 6, 'rgba(255,90,90,.92)'); ctx.font = font(12, 700, false); label(uvmClipLines('Not loaded: ' + err, UVM_CW - 30, 1)[0], x + 16, y + 17, 12, '#fff', 'left', 700); }
    });
    if (rows > 2) label(`${UVMUI.scroll * 3 + 1}–${Math.min(list.length, UVMUI.scroll * 3 + 6)} of ${list.length}  ·  ↑ ↓ / wheel to scroll`, W - 24, UVM_GY - 9, 12, PAL.dim, 'right', 600);
  }
  uvmFooter(UVM.active ? 'Online with mods: room codes only · your friend needs these exact mods + settings · leaderboard and public rooms are off'
                       : 'Mods are off: the game is exactly the normal version (online, leaderboard and all).');
  hintBar('← → ↑ ↓ choose  ·  F toggle  ·  G edit  ·  Del remove  ·  / search  ·  Esc back');
}

function uvmDrawCat() {
  menuBg(0.8, PAL.rose);
  topBar('MOD CATALOG', UVM.catalogUrl.replace(/^https:\/\/raw\.githubusercontent\.com\//, 'github: ').replace(/\/main\/catalog\.json$/, ''));
  const list = (UVMUI.cat || []).filter(m => !UVMUI.query || [m.name, m.author, m.description, ...(m.tags || []).map(t => '#' + t)].join(' ').toLowerCase().includes(UVMUI.query.toLowerCase().trim()));
  uvmTopRow([{ text: 'LINK', fn: uvmInstallLink }, { text: 'BACK', fn: () => { UI.screen = 'mods'; Sfx.play('back'); } }], UVMUI.catFocus === -1 ? 0 : UVMUI.catFocus === -2 ? 1 : UVMUI.catFocus === -3 ? 2 : -9);
  if (UVMUI.catLoading) label('Loading the catalog…', W / 2, 250, 18, '#fff', 'center', 700);
  else if (UVMUI.catErr) { panel(W / 2 - 320, 170, 640, 110, PAL.p2); label(UVMUI.catErr, W / 2, 210, 15, '#fff', 'center', 700); label('Check your internet, then press F to try again.', W / 2, 240, 14, PAL.dim, 'center', 600); }
  else {
    const rows = Math.ceil(list.length / 3), sel = UVMUI.catFocus;
    if (sel >= 0) { const r = Math.floor(sel / 3); if (r < UVMUI.catScroll) UVMUI.catScroll = r; if (r > UVMUI.catScroll + 1) UVMUI.catScroll = r - 1; }
    UVMUI.catScroll = Math.max(0, Math.min(UVMUI.catScroll, rows - 2));
    list.forEach((m, i) => {
      const r = Math.floor(i / 3) - UVMUI.catScroll; if (r < 0 || r > 1) return;
      const x = UVM_GX + (i % 3) * (UVM_CW + UVM_GAP), y = UVM_GY + r * (UVM_CH + UVM_GAP);
      const have = (UVMUI.recs || []).find(rc => rc.id === m.id), newer = have && uvmCmpVer(m.version, have.meta.version) > 0, busy = UVMUI.busy[m.id];
      uvmCard(x, y, { meta: m, artKey: 'cat:' + m.id, sel: sel === i, size: m.size, bottom: (bx, by) => {
        if (busy) label(busy + '…', bx + 12, by + 15, 13, PAL.gold, 'left', 800);
        else if (have && !newer) label('INSTALLED  v' + have.meta.version, bx + 12, by + 15, 13, PAL.turf, 'left', 900, true);
        else uvmBtn(bx + 12, by + 2, 120, 24, newer ? 'UPDATE' : 'INSTALL', sel === i, () => { UVMUI.catFocus = i; uvmInstall(new URL(m.url, UVM.catalogUrl).href, m); }, PAL.turf);
        if (m.build && typeof BUILD === 'string' && !BUILD.startsWith(m.build)) label('made for build ' + m.build, bx + UVM_CW - 12, by + 15, 12, PAL.gold, 'right', 700);
      } });
      uvmHot(x, y, UVM_CW, UVM_CH - 32, () => { UVMUI.catFocus = i; }, true);
    });
    if (!list.length) label('Nothing in the catalog matches.', W / 2, 250, 16, '#fff', 'center', 700);
  }
  uvmFooter('LINK installs a mod from any .uvmod.js link. Mods are code: only install mods from people you trust.');
  hintBar('← → ↑ ↓ choose  ·  F install / update  ·  / search  ·  Esc back to your mods');
}

function uvmEdit(id) { UVMUI.editId = id; UVMUI.editIdx = 0; UI.screen = 'modedit'; Sfx.play('ok'); }
function uvmEditRows() {
  const id = UVMUI.editId, def = UVMUI.defs[id] || { settings: {} }, rows = [];
  for (const [k, s] of Object.entries(def.settings || {})) rows.push({ k: 'set', key: k, s });
  rows.push({ k: 'toggle' });
  const ce = uvmCatEntry(id), rec = (UVMUI.recs || []).find(r => r.id === id);
  if (ce && rec && uvmCmpVer(ce.version, rec.meta.version) > 0) rows.push({ k: 'update', ce });
  if (rec && rec.url) rows.push({ k: 'reinstall' });
  if (UVMUI.dirty) rows.push({ k: 'restart' });
  rows.push({ k: 'remove' }, { k: 'back' });
  return rows;
}
function uvmSetCycle(key, s, dir) {
  const id = UVMUI.editId, cur = (UVM.state.settings[id] || {})[key] ?? s.default;
  const i = s.options.findIndex(o => o[0] === cur), n = s.options.length;
  (UVM.state.settings[id] = UVM.state.settings[id] || {})[key] = s.options[((i < 0 ? 0 : i) + dir + n) % n][0];
  UVM.saveState(); UVMUI.dirty = true; Sfx.play('menu'); uvmCommitSoon();
}
function uvmEditDo(row, dir) {
  const id = UVMUI.editId, rec = (UVMUI.recs || []).find(r => r.id === id);
  if (row.k === 'set') uvmSetCycle(row.key, row.s, dir || 1);
  else if (row.k === 'toggle') uvmToggle(id);
  else if (row.k === 'update') uvmInstall(new URL(row.ce.url, UVM.catalogUrl).href, row.ce);
  else if (row.k === 'reinstall' && rec) uvmInstall(rec.url, uvmCatEntry(id) || null);
  else if (row.k === 'remove') { if (UVMUI.removeArm === id && UVMUI.removeT > 0) { uvmRemove(id); UI.screen = 'mods'; } else uvmRemoveAsk(id); }
  else if (row.k === 'restart') uvmRestart();
  else if (row.k === 'back') { UI.screen = 'mods'; Sfx.play('back'); }
}
function uvmDrawEdit() {
  menuBg(0.82, PAL.rose);
  const id = UVMUI.editId, rec = (UVMUI.recs || []).find(r => r.id === id);
  if (!rec) { UI.screen = 'mods'; return; }
  const m = rec.meta, def = UVMUI.defs[id] || {}, err = UVM.errors[id] || def.err;
  topBar('MOD', m.name);
  // left: the card, bigger
  uvmCard(24, 60, { meta: m, artKey: id, sel: false, size: uvmFmtSize(rec.size), bottom: () => { } });
  const info = [['Id', id], ['Version', m.version], ['Made for build', m.build || '—'], ['Status', uvmRunning(id) ? 'running' : uvmOn(id) ? 'on after restart' : 'off'],
    ['Source', (rec.url || 'file').replace(/^https:\/\/raw\.githubusercontent\.com\//, '')], ['Installed', new Date(rec.installedAt).toLocaleString()]];
  info.forEach(([k, v], i) => { label(k, 30, 268 + i * 22, 13, PAL.dim, 'left', 700); ctx.font = font(13, 600, false); label(uvmClipLines(v, 200, 1)[0] || '', 130, 268 + i * 22, 13, '#fff', 'left', 600); });
  if (err) { rrect(24, 400, UVM_CW, 66, 8, 'rgba(255,90,90,.2)', PAL.p2, 1.5); ctx.font = font(12.5, 600, false); uvmClipLines('Not loaded: ' + err, UVM_CW - 20, 3).forEach((l, i) => label(l, 34, 416 + i * 16, 12.5, '#ffd6dc', 'left', 600)); }
  // right: settings + actions
  const rows = uvmEditRows(), X = 350, Y0 = 92, RH = 40;
  panel(X, 60, W - X - 24, Math.max(rows.length * RH + 40, 200), PAL.rose);
  label('SETTINGS', X + 20, 76, 13, PAL.gold, 'left', 900, true);
  if (!Object.keys(def.settings || {}).length) label('This mod has no settings.', X + 120, 76, 13, PAL.dim, 'left', 600);
  UVMUI.editIdx = Math.min(UVMUI.editIdx, rows.length - 1);
  rows.forEach((r, i) => {
    const y = Y0 + i * RH + 6, sel = i === UVMUI.editIdx, col = sel ? PAL.ink : '#efe8fb';
    if (sel) rowSlant(X + 12, y - 15, W - X - 60, 30, 8, true);
    let left = '', right = '';
    if (r.k === 'set') { const v = (UVM.state.settings[id] || {})[r.key] ?? r.s.default, o = r.s.options.find(q => q[0] === v) || r.s.options[0]; left = r.s.label || r.key; right = (sel ? '◀ ' : '') + o[1].toUpperCase() + (sel ? ' ▶' : ''); }
    else if (r.k === 'toggle') { left = 'Mod'; right = uvmOn(id) ? 'ON' : 'OFF'; }
    else if (r.k === 'update') { left = 'Update to v' + r.ce.version; right = UVMUI.busy[id] ? UVMUI.busy[id] + '…' : 'GET IT'; }
    else if (r.k === 'reinstall') { left = 'Download again from its link'; right = UVMUI.busy[id] ? UVMUI.busy[id] + '…' : ''; }
    else if (r.k === 'remove') { left = UVMUI.removeArm === id && UVMUI.removeT > 0 ? 'Press again to remove' : 'Remove this mod'; }
    else if (r.k === 'restart') left = 'Restart now to apply changes';
    else left = 'Back';
    label(left, X + 30, y, 17, r.k === 'remove' && !sel ? PAL.p2 : (r.k === 'back' || r.k === 'restart') && !sel ? PAL.gold : col, 'left', 800, true);
    if (right) label(right, W - 52, y, 15, col, 'right', 900, true);
    if (r.k === 'set' && r.s.sync !== false && !sel) label('both players must match', W - 52, y + 13, 10.5, PAL.dim, 'right', 600);
    uvmHot(X + 12, y - 15, W - X - 60, 30, () => { if (UVMUI.editIdx === i) uvmEditDo(r, 1); else UVMUI.editIdx = i; });
  });
  uvmFooter('Settings marked "both players must match" change the build tag: online, your friend needs the same values.');
  hintBar('↑ ↓ choose  ·  ← → change  ·  F select  ·  Esc back');
}
function uvmRemoveAsk(id) { UVMUI.removeArm = id; UVMUI.removeT = 150; Sfx.play('menu'); }

// ---------------------------------------------------------------- input
function uvmTick(e, enter, esc) {
  if (UVMUI.removeT > 0) UVMUI.removeT--;
  if (uvmTyping()) return;   // the search field has the keyboard
  const scr = UI.screen;
  if (scr === 'mods') {
    const n = uvmFiltered().length, f = UVMUI.focus;
    if (esc || e.H) { uvmSearchFocus(false); UI.screen = 'mode'; Sfx.play('back'); return; }
    if (f >= 0) {
      if (e.l && f % 3 > 0) UVMUI.focus--; else if (e.r && f + 1 < n && f % 3 < 2) UVMUI.focus++;
      else if (e.u) UVMUI.focus = f >= 3 ? f - 3 : -2; else if (e.d && f + 3 < n) UVMUI.focus = f + 3;
      const rec = uvmFiltered()[UVMUI.focus];
      if (rec && UVMUI.focus === f) {
        if (e.L || e.S || enter) uvmToggle(rec.id);
        else if (e.M) uvmEdit(rec.id);
      }
      if (e.u || e.d || e.l || e.r) Sfx.play('menu');
    } else {   // top row: -1 search, -2 add, -4 restart
      const top = UVMUI.dirty ? [-1, -2, -4] : [-1, -2], k = top.indexOf(f);
      if (e.l && k > 0) UVMUI.focus = top[k - 1]; else if (e.r && k < top.length - 1) UVMUI.focus = top[k + 1];
      else if (e.d && n) UVMUI.focus = 0;
      if (e.L || e.S || enter) {
        if (f === -1) uvmSearchFocus(true);
        else if (f === -2) { UI.screen = 'modcat'; if (!UVMUI.cat) uvmLoadCatalog(); Sfx.play('ok'); }
        else if (f === -4) uvmRestart();
      }
      if (e.u || e.d || e.l || e.r) Sfx.play('menu');
    }
  } else if (scr === 'modcat') {
    const list = (UVMUI.cat || []), n = list.length, f = UVMUI.catFocus;
    if (esc || e.H) { UI.screen = 'mods'; Sfx.play('back'); return; }
    if (UVMUI.catErr && (e.L || e.S || enter)) { uvmLoadCatalog(); return; }
    if (f >= 0) {
      if (e.l && f % 3 > 0) UVMUI.catFocus--; else if (e.r && f + 1 < n && f % 3 < 2) UVMUI.catFocus++;
      else if (e.u) UVMUI.catFocus = f >= 3 ? f - 3 : -2; else if (e.d && f + 3 < n) UVMUI.catFocus = f + 3;
      else if ((e.L || e.S || enter) && list[f]) uvmInstall(new URL(list[f].url, UVM.catalogUrl).href, list[f]);
      if (e.u || e.d || e.l || e.r) Sfx.play('menu');
    } else {
      const top = [-1, -2, -3], k = top.indexOf(f);
      if (e.l && k > 0) UVMUI.catFocus = top[k - 1]; else if (e.r && k < 2) UVMUI.catFocus = top[k + 1];
      else if (e.d && n) UVMUI.catFocus = 0;
      if (e.L || e.S || enter) { if (f === -1) uvmSearchFocus(true); else if (f === -2) uvmInstallLink(); else { UI.screen = 'mods'; Sfx.play('back'); } }
      if (e.u || e.d || e.l || e.r) Sfx.play('menu');
    }
  } else if (scr === 'modedit') {
    const rows = uvmEditRows();
    if (esc || e.H) { UI.screen = 'mods'; Sfx.play('back'); return; }
    if (e.u) { UVMUI.editIdx = (UVMUI.editIdx + rows.length - 1) % rows.length; Sfx.play('menu'); }
    if (e.d) { UVMUI.editIdx = (UVMUI.editIdx + 1) % rows.length; Sfx.play('menu'); }
    const r = rows[UVMUI.editIdx];
    if (r && r.k === 'set' && (e.l || e.r)) uvmSetCycle(r.key, r.s, e.l ? -1 : 1);
    else if (r && (e.L || e.S || enter)) uvmEditDo(r, 1);
  }
}
try { addEventListener('keydown', ev => {
  if (!['mods', 'modcat', 'modedit'].includes(UI.screen) || uvmTyping()) return;
  if (ev.key === '/') { ev.preventDefault(); if (UI.screen !== 'modedit') { UVMUI.focus = -1; uvmSearchFocus(true); } }
  else if (ev.key === 'Delete' && UI.screen === 'mods') { const rec = uvmFiltered()[UVMUI.focus]; if (rec) { if (UVMUI.removeArm === rec.id && UVMUI.removeT > 0) uvmRemove(rec.id); else uvmRemoveAsk(rec.id); } }
}); } catch (e) { }
function uvmPointer(ev) {
  if (!['mods', 'modcat', 'modedit'].includes(UI.screen)) return null;
  const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * W / r.width, y = (ev.clientY - r.top) * HGT / r.height;
  for (let i = UVMUI.hot.length - 1; i >= 0; i--) { const h = UVMUI.hot[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; }
  return null;
}
if (typeof cv !== 'undefined' && cv && cv.addEventListener) {
cv.addEventListener('pointerdown', ev => { const h = uvmPointer(ev); if (h && h.fn) { ev.preventDefault(); if (!h.hover) Sfx.play('menu'); h.fn(); } });
cv.addEventListener('pointermove', ev => { if (['mods', 'modcat', 'modedit'].includes(UI.screen)) { const h = uvmPointer(ev); cv.style.cursor = h && (h.fn && !h.hover) ? 'pointer' : ''; } });
cv.addEventListener('wheel', ev => {
  if (UI.screen === 'mods') { UVMUI.scroll = Math.max(0, UVMUI.scroll + Math.sign(ev.deltaY)); UVMUI.focus = Math.min(Math.max(0, UVMUI.scroll * 3), Math.max(0, uvmFiltered().length - 1)); }
  else if (UI.screen === 'modcat') { UVMUI.catScroll = Math.max(0, UVMUI.catScroll + Math.sign(ev.deltaY)); UVMUI.catFocus = Math.max(0, UVMUI.catScroll * 3); }
}, { passive: true });
}

// ---------------------------------------------------------------- online lobby: say why modded players can't ready up
function uvmNetHint() {
  if (!Net.theirBuild || Net.theirBuild === BUILD || !(BUILD + Net.theirBuild).includes('+m')) return;
  rrect(W / 2 - 330, 322, 660, 26, 6, 'rgba(23,12,40,.92)', PAL.gold, 1.5);
  label(Net.theirBuild.includes('+m') && BUILD.includes('+m')
    ? 'Modded: you both need the same mods, mod versions and mod settings (MODS tab).'
    : 'One of you has mods on: both need the same mods, or both turn them off.', W / 2, 335, 14, '#fff', 'center', 700);
}

// ---------------------------------------------------------------- mod updates: only say they're out. Nothing is installed until you press UPDATE in MODS.
async function uvmCheckUpdates() {
  if (UVM.safe) return;
  await uvmRefresh(); await uvmLoadCatalog();
  const updates = (UVMUI.recs || []).filter(r => { const c = uvmCatEntry(r.id); return c && uvmCmpVer(c.version, r.meta.version) > 0; });
  if (!updates.length) return;
  const names = updates.map(r => r.meta.name).join(', ');
  uvmSay(`Update available: ${names}. Press UPDATE on ${updates.length > 1 ? 'their cards' : 'its card'} to install it.`);
  if (typeof toast === 'function') toast('Mod update available: ' + names + ' (MODS tab)');
}

// ---------------------------------------------------------------- simple panel (plain HTML). Used if a game update breaks the MODS screens.
let uvmFbEl = null;
function uvmFallback(reason) {
  if (!uvmFbEl) {
    uvmFbEl = document.createElement('div');
    uvmFbEl.id = 'uvm-fallback';
    uvmFbEl.style.cssText = 'position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;background:rgba(14,6,28,.78);font:600 16px "Barlow Condensed",Arial,sans-serif;color:#efe8fb';
    uvmFbEl.addEventListener('keydown', e => e.stopPropagation(), true);
    document.body.appendChild(uvmFbEl);
  }
  const box = document.createElement('div');
  box.style.cssText = 'width:min(640px,92vw);max-height:86vh;overflow:auto;background:#22113c;border:1.5px solid rgba(255,255,255,.2);border-top:4px solid #ff4f8b;border-radius:10px;padding:18px 22px';
  const h = (tag, text, css) => { const e = document.createElement(tag); e.textContent = text; if (css) e.style.cssText = css; return e; };
  const btn = (text, fn, col) => { const b = h('button', text, `font:800 italic 15px "Barlow Condensed",Arial;padding:5px 14px;margin:0 6px 0 0;border:0;border-radius:4px;cursor:pointer;background:${col || '#fff'};color:#170c28`); b.onclick = fn; return b; };
  box.appendChild(h('div', 'MODS', 'font:24px "Dela Gothic One",Arial;color:#fff;margin-bottom:4px'));
  box.appendChild(h('div', reason ? 'Simple view: the full MODS screen hit a problem (' + reason + '), probably after a game update. Your mods still work from here.' : 'Simple view.', 'color:#b3a6d4;font-size:14px;margin-bottom:12px'));
  const list = h('div', ''); box.appendChild(list);
  UVM.all().then(recs => {
    if (!recs || !recs.length) { list.appendChild(h('div', 'No mods installed.', 'color:#b3a6d4')); return; }
    for (const r of recs) {
      const row = h('div', '', 'display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,.1)');
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!UVM.state.enabled[r.id]; cb.style.cssText = 'width:20px;height:20px';
      cb.onchange = () => { UVM.state.enabled[r.id] = cb.checked; UVM.saveState(); UVM.commit().catch(() => { }); };
      row.appendChild(cb);
      row.appendChild(h('div', `${r.meta.name}  v${r.meta.version}` + (UVM.errors[r.id] ? '  —  not loaded: ' + UVM.errors[r.id] : ''), 'flex:1;color:' + (UVM.errors[r.id] ? '#ffb4b4' : '#fff')));
      row.appendChild(btn('Remove', async () => { if (!confirm('Remove ' + r.meta.name + '?')) return; await UVM.del(r.id); delete UVM.state.enabled[r.id]; UVM.saveState(); UVM.commit().catch(() => { }); row.remove(); }, '#ff8a8a'));
      list.appendChild(row);
    }
  });
  const bar = h('div', '', 'margin-top:14px');
  bar.appendChild(btn('Restart', () => UVM.pending.then(() => location.reload()), '#f6c343'));
  bar.appendChild(btn('Start with all mods off', () => { location.search = '?mods=off'; }));
  bar.appendChild(btn('Close', () => { uvmFbEl.style.display = 'none'; }));
  box.appendChild(bar);
  uvmFbEl.replaceChildren(box); uvmFbEl.style.display = 'flex';
}
function uvmFallbackButton() {   // a small MODS button on the menus, only if the menu entry couldn't be added
  try {
    const b = document.createElement('button'); b.textContent = 'MODS';
    b.style.cssText = 'position:fixed;right:14px;bottom:40px;z-index:40;font:800 italic 15px "Barlow Condensed",Arial;padding:6px 16px;border:0;border-radius:4px;background:#ff4f8b;color:#fff;cursor:pointer;display:none';
    b.onclick = () => uvmOpen(); document.body.appendChild(b);
    setInterval(() => { b.style.display = ['title', 'mode'].includes(UI.screen) ? 'block' : 'none'; }, 300);
  } catch (e) { }
}
// ================================================================ /Mod Manager
