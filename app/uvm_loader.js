/* Uma Versus Mod Manager -- loader.
 *
 * Runs before the game. The game's code sits in an inert
 * <script type="text/x-uv-game" id="uv-game"> block (the launcher put it there, with the MODS
 * screens and runtime hooks appended). This loader applies the text patches of every enabled
 * mod, in id order (so two players with the same mods get byte-identical code), then runs it.
 *
 *   ?mods=off   start with every mod off (safe mode)
 *
 * Storage (per browser profile, per http://localhost:PORT):
 *   IndexedDB "uvm" / "mods"  -> { id, meta, src, url, files: {name: Blob}, art: {icon, banner}, size, installedAt }
 *   localStorage "uvm.state"  -> { enabled: {id: true}, settings: {id: {key: value}}, autoUpdate }
 *
 * With window.UVM_LIB = true (the start page), it only defines UVM and doesn't start a game.
 */
(function () {
  'use strict';
  var STATE_KEY = 'uvm.state';
  var CATALOG_URL = 'https://raw.githubusercontent.com/jaxonb423/umaversus-mods/main/catalog.json';
  var BUILD_MARK = '/*uvm:build*/';

  function fnv(str) {   // 32-bit FNV-1a
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function hex(n, len) { return ('00000000' + (n >>> 0).toString(16)).slice(-(len || 8)); }
  function loadState() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {}; } catch (e) { s = {}; }
    s.enabled = s.enabled || {}; s.settings = s.settings || {};
    return s;
  }

  // ---------------------------------------------------------------- IndexedDB
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok, fail) {
      if (!window.indexedDB) { fail(new Error('This browser has no IndexedDB')); return; }
      var r = indexedDB.open('uvm', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('mods', { keyPath: 'id' }); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { fail(r.error); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, fail) {
        var t = d.transaction('mods', mode), st = t.objectStore('mods'), res;
        var req = fn(st);
        if (req) req.onsuccess = function () { res = req.result; };
        t.oncomplete = function () { ok(res); };
        t.onerror = function () { fail(t.error); };
        t.onabort = function () { fail(t.error || new Error('Storage aborted')); };
      });
    });
  }

  // ---------------------------------------------------------------- mod files
  function parseHeader(src) {   // // ==UmaMod== ... // @key value ... // ==/UmaMod==
    var m = /\/\/\s*==UmaMod==([\s\S]*?)\/\/\s*==\/UmaMod==/.exec(src);
    if (!m) throw new Error('Not an Uma Versus mod (no ==UmaMod== header)');
    var meta = {};
    m[1].split('\n').forEach(function (line) {
      var k = /^\s*\/\/\s*@(\w+)\s+(.*?)\s*$/.exec(line);
      if (k) meta[k[1]] = k[2];
    });
    if (!meta.id || !/^[a-z0-9-]+$/.test(meta.id)) throw new Error('Mod header needs an @id (lowercase letters, numbers, dashes)');
    meta.name = meta.name || meta.id; meta.version = meta.version || '0.0.0';
    meta.tags = (meta.tags || '').split(/\s+/).filter(Boolean);
    return meta;
  }
  function evalMod(src) {   // the body calls uvmod({ settings, files, patches })
    var def = null;
    new Function('uvmod', src)(function (d) { def = d; });
    if (!def || !Array.isArray(def.patches)) throw new Error('Mod did not call uvmod({ patches: [...] })');
    def.settings = def.settings || {};
    def.files = def.files || [];
    return def;
  }
  function settingValues(id, def, state) {
    var mine = state.settings[id] || {}, out = {};
    Object.keys(def.settings).forEach(function (k) {
      var s = def.settings[k], v = k in mine ? mine[k] : s.default;
      if (s.type === 'select' && !s.options.some(function (o) { return o[0] === v; })) v = s.default;
      out[k] = v;
    });
    return out;
  }

  // ---------------------------------------------------------------- patching
  function fill(text, ctx) {
    return String(text).replace(/\{\{(file|setting):([^}\s]+)\}\}/g, function (all, kind, name) {
      if (kind === 'file') { if (!(name in ctx.urls)) throw new Error('missing file ' + name); return ctx.urls[name]; }
      if (!(name in ctx.settings)) throw new Error('unknown setting ' + name);
      return JSON.stringify(ctx.settings[name]);
    });
  }
  function count(hay, needle) { var n = 0, i = 0; while ((i = hay.indexOf(needle, i)) >= 0) { n++; i += needle.length; } return n; }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // same text, but any run of spaces / tabs / newlines may differ (a game update that only re-indents)
  function looseRe(find) { return new RegExp(find.trim().split(/\s+/).map(escRe).join('\\s+'), 'g'); }
  function applyPatches(code, patches, ctx) {
    patches.forEach(function (p, i) {
      var want = p.count === undefined ? 1 : p.count, label = 'patch ' + (i + 1) + (p.note ? ' (' + p.note + ')' : '');
      if (p.re) {
        var re = new RegExp(p.re, (p.flags || '').replace('g', '') + 'g');
        var all = code.match(re) || [];
        if (all.length !== want) throw new Error(label + ': pattern found ' + all.length + 'x, needs ' + want + 'x');
        var rep = fill(p.replace, ctx);
        code = code.replace(re, function () {
          var g = arguments;
          return rep.replace(/\$(\d)/g, function (_, d) { return g[+d] === undefined ? '' : g[+d]; });
        });
        return;
      }
      var add = function (hit) { return 'after' in p ? hit + fill(p.after, ctx) : 'before' in p ? fill(p.before, ctx) + hit : fill(p.replace, ctx); };
      var n = count(code, p.find);
      if (n === want) { var by = add(p.find); code = code.split(p.find).join(by); return; }
      var lr = looseRe(p.find), hits = code.match(lr) || [];
      if (hits.length !== want || !/\s/.test(p.find.trim()))
        throw new Error(label + ': "' + p.find.slice(0, 60).replace(/\n/g, '\\n') + '" found ' + n + 'x, needs ' + want + 'x (probably a game update; the mod needs updating)');
      code = code.replace(lr, function (hit) { return add(hit); });
    });
    return code;
  }
  // apply every enabled mod to a game template; returns { code, running, errors }
  function applyMods(base, recs, state, makeUrls) {
    var code = base, running = [], errors = {};
    if (base.indexOf(BUILD_MARK) < 0) {   // the build tag keeps modded players apart online; without it, no mods
      recs.forEach(function (r) { if (state.enabled[r.id]) errors[r.id] = "this game version couldn't be tagged as modded, so mods are off (wait for a manager update)"; });
      return { code: code, running: running, errors: errors };
    }
    recs.slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }).forEach(function (rec) {
      if (!state.enabled[rec.id]) return;
      try {
        var def = evalMod(rec.src);
        var settings = settingValues(rec.id, def, state);
        var next = applyPatches(code, def.patches, { urls: makeUrls(rec), settings: settings });
        new Function(next);   // compile check: a mod must never leave the game unable to start
        code = next;
        var synced = {};
        Object.keys(def.settings).forEach(function (k) { if (def.settings[k].sync !== false) synced[k] = settings[k]; });
        running.push({ id: rec.id, version: rec.meta.version, meta: rec.meta, hash: hex(fnv(rec.src)), settings: settings, synced: synced });
      } catch (e) { errors[rec.id] = (e && e.message) || String(e); }
    });
    return { code: code, running: running, errors: errors };
  }
  function listOf(code, name) {   // const NAME = ['a', 'b'];  ->  ['a', 'b']
    var m = new RegExp('const\\s+' + name + '\\s*=\\s*\\[([^\\]]*)\\]').exec(code);
    return m ? (m[1].match(/['"]([^'"]+)['"]/g) || []).map(function (s) { return s.slice(1, -1); }) : null;
  }

  // ---------------------------------------------------------------- the official services stay vanilla-only
  // While mods run, block writes to the game's backend (leaderboard results, public room list ...),
  // whatever the game's code calls them. Sign-in, profile, friends and settings sync still work.
  var ALLOW = /\/rest\/v1\/(rpc\/(add_friend|name_available|room_close)|presence|settings|profiles|friends|invites)\b/;
  if (window.fetch) {
    var realFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        if (window.UVM && UVM.active) {
          var url = typeof input === 'string' ? input : input && input.url || '';
          var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
          if (method !== 'GET' && method !== 'HEAD' && /\/(rest|functions)\/v1\//.test(url) && !ALLOW.test(url)) {
            console.info('[uvm] mods are on: not sent to the official service ->', method, url.split('?')[0]);
            return Promise.resolve(new Response(JSON.stringify({ message: 'Mods are on: not sent' }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
          }
        }
      } catch (e) { }
      return realFetch.apply(this, arguments);
    };
  }

  // ---------------------------------------------------------------- public object
  var UVM = window.UVM = {
    version: '2.0.0',
    catalogUrl: (function () { try { return localStorage.getItem('uvm.catalog') || CATALOG_URL; } catch (e) { return CATALOG_URL; } })(),
    safe: /[?&]mods=off\b/.test(location.search),
    active: false, mods: [], errors: {}, installed: [], tag: '', hooks: {},
    state: loadState(),
    notice: (function () { try { return sessionStorage.getItem('uvm.notice') || ''; } catch (e) { return ''; } })(),
    fnv: fnv, hex: hex, parseHeader: parseHeader, evalMod: evalMod, applyPatches: applyPatches, applyMods: applyMods,
    settingValues: settingValues, listOf: listOf, BUILD_MARK: BUILD_MARK,
    saveState: function () { try { localStorage.setItem(STATE_KEY, JSON.stringify(UVM.state)); } catch (e) { } },
    all: function () { return tx('readonly', function (st) { return st.getAll(); }); },
    get: function (id) { return tx('readonly', function (st) { return st.get(id); }); },
    put: function (rec) { return tx('readwrite', function (st) { return st.put(rec); }); },
    del: function (id) { return tx('readwrite', function (st) { return st.delete(id); }); },
    // match seed: online from the room's shared match key (both players agree), otherwise random
    seed: function (mode) {
      if (mode === 'online' || mode === 'spectate') {
        var k = (typeof Net !== 'undefined' && Net && (Net.matchKey + ':' + Net.matchId)) || 'x';
        return fnv('uvm:' + k) || 7;
      }
      return ((Math.random() * 4294967296) >>> 0) || 7;
    },
  };

  // the desktop app quits by itself a little while after its window closes
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    var ping = function () { try { realFetch && realFetch('/__uvm/ping', { cache: 'no-store' }).catch(function () { }); } catch (e) { } };
    ping(); setInterval(ping, 5000);
  }

  if (window.UVM_LIB) return;

  function runGame(code) {
    var s = document.createElement('script');
    s.textContent = code + '\n//# sourceURL=umaversus-game.js';
    document.body.appendChild(s);
  }
  function boot() {
    var tpl = document.getElementById('uv-game');
    if (!tpl) { console.error('[uvm] game template missing'); return; }
    var base = tpl.textContent;
    UVM.baseRoster = listOf(base, 'ROSTER'); UVM.baseThemes = listOf(base, 'THEME_IDS');
    var res = { code: base, running: [], errors: {} };
    return UVM.all().then(function (list) {
      list = list || [];
      UVM.installed = list.map(function (r) { return { id: r.id, meta: r.meta, url: r.url, size: r.size }; });
      if (!UVM.safe) res = applyMods(base, list, UVM.state, function (rec) {
        var urls = {}; Object.keys(rec.files || {}).forEach(function (n) { urls[n] = URL.createObjectURL(rec.files[n]); }); return urls;
      });
    }).catch(function (e) {
      console.warn('[uvm] mod storage unavailable, starting without mods:', e);
      UVM.storageError = (e && e.message) || String(e);
    }).then(function () {
      UVM.mods = res.running; UVM.errors = res.errors; UVM.active = res.running.length > 0;
      UVM.tag = UVM.active ? '+m' + hex(fnv(JSON.stringify(res.running.map(function (m) { return [m.id, m.version, m.hash, m.synced]; }))), 6) : '';
      Object.keys(res.errors).forEach(function (id) { console.warn('[uvm] mod "' + id + '" not loaded:', res.errors[id]); });
      try { runGame(res.code); }
      catch (e) { console.error('[uvm] game failed with mods, starting vanilla', e); UVM.mods = []; UVM.active = false; UVM.tag = ''; runGame(base); }
    });
  }
  boot();
})();
