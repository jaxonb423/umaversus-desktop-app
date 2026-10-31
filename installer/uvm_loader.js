/* Uma Versus Mod Manager -- loader.
 *
 * Runs before the game. The installer moved the game's code into an inert
 * <script type="text/x-uv-game" id="uv-game"> block; this loader reads it, applies the
 * text patches of every enabled mod (in id order, so two players with the same mods get
 * byte-identical code), then runs the result as a normal script.
 *
 *   ?mods=off   start with every mod off (safe mode)
 *
 * Storage (per browser, per http://localhost:PORT):
 *   IndexedDB "uvm" / "mods"  -> { id, meta, src, url, files: {name: Blob}, art: {icon, banner}, size, installedAt }
 *   localStorage "uvm.state"  -> { enabled: {id: true}, settings: {id: {key: value}} }
 */
(function () {
  'use strict';
  var STATE_KEY = 'uvm.state';
  var CATALOG_URL = 'https://raw.githubusercontent.com/jaxonb423/umaversus-mods/main/catalog.json';

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
  // header:  // ==UmaMod== ... // @key value ... // ==/UmaMod==
  function parseHeader(src) {
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
  // the body calls uvmod({ settings, files, patches })
  function evalMod(src) {
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
      var s = def.settings[k];
      var v = k in mine ? mine[k] : s.default;
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
  function applyPatches(code, patches, ctx) {
    patches.forEach(function (p, i) {
      var want = p.count === undefined ? 1 : p.count, label = 'patch ' + (i + 1) + (p.note ? ' (' + p.note + ')' : '');
      if (p.re) {
        var all = code.match(new RegExp(p.re, (p.flags || '').replace('g', '') + 'g')) || [];
        if (all.length !== want) throw new Error(label + ': pattern found ' + all.length + 'x, needs ' + want + 'x');
        var rep = fill(p.replace, ctx);
        code = code.replace(new RegExp(p.re, (p.flags || '').replace('g', '') + 'g'), function () {
          var g = arguments;
          return rep.replace(/\$(\d)/g, function (_, d) { return g[+d] === undefined ? '' : g[+d]; });
        });
        return;
      }
      var n = count(code, p.find);
      if (n !== want) throw new Error(label + ': "' + p.find.slice(0, 60).replace(/\n/g, '\\n') + '" found ' + n + 'x, needs ' + want + 'x');
      var by;
      if ('after' in p) by = p.find + fill(p.after, ctx);
      else if ('before' in p) by = fill(p.before, ctx) + p.find;
      else by = fill(p.replace, ctx);
      code = code.split(p.find).join(by);
    });
    return code;
  }

  // ---------------------------------------------------------------- public object (the game and the Mods tab use it)
  var UVM = window.UVM = {
    version: '1.0.0',
    catalogUrl: (function () { try { return localStorage.getItem('uvm.catalog') || CATALOG_URL; } catch (e) { return CATALOG_URL; } })(),
    safe: /[?&]mods=off\b/.test(location.search),
    active: false,        // at least one mod is running this session
    mods: [],             // running mods: { id, version, meta, hash, settings }
    errors: {},           // id -> why it isn't running
    installed: [],        // every installed mod's record (without blobs' contents)
    tag: '',              // appended to the game's BUILD, so only identical mod sets meet online
    state: loadState(),
    fnv: fnv, hex: hex, parseHeader: parseHeader, evalMod: evalMod, applyPatches: applyPatches, settingValues: settingValues,
    saveState: function () { try { localStorage.setItem(STATE_KEY, JSON.stringify(UVM.state)); } catch (e) { } },
    all: function () { return tx('readonly', function (st) { return st.getAll(); }); },
    get: function (id) { return tx('readonly', function (st) { return st.get(id); }); },
    put: function (rec) { return tx('readwrite', function (st) { return st.put(rec); }); },
    del: function (id) { return tx('readwrite', function (st) { return st.delete(id); }); },
    // match seed: online from the room's shared match key (both players agree), otherwise random.
    // Only used while mods run; with no mods the game keeps its own fixed seed (rs = 7), exactly like vanilla.
    seed: function (mode) {
      if (mode === 'online' || mode === 'spectate') {
        var k = (typeof Net !== 'undefined' && Net && (Net.matchKey + ':' + Net.matchId)) || 'x';
        return fnv('uvm:' + k) || 7;
      }
      if (mode === 'replay') return 7;
      return ((Math.random() * 4294967296) >>> 0) || 7;
    },
  };

  function runGame(code) {
    var s = document.createElement('script');
    s.textContent = code + '\n//# sourceURL=umaversus-game.js';
    document.body.appendChild(s);
  }

  function boot() {
    var tpl = document.getElementById('uv-game');
    if (!tpl) { console.error('[uvm] game template missing'); return; }
    var base = tpl.textContent, code = base;
    var running = [];
    return UVM.all().then(function (list) {
      list = (list || []).slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
      UVM.installed = list.map(function (r) { return { id: r.id, meta: r.meta, url: r.url, size: r.size, installedAt: r.installedAt, art: r.art || {}, fileNames: Object.keys(r.files || {}) }; });
      list.forEach(function (rec) {
        if (UVM.safe || !UVM.state.enabled[rec.id]) return;
        try {
          var def = evalMod(rec.src);
          var settings = settingValues(rec.id, def, UVM.state);
          var urls = {};
          Object.keys(rec.files || {}).forEach(function (n) { urls[n] = URL.createObjectURL(rec.files[n]); });
          var next = applyPatches(code, def.patches, { urls: urls, settings: settings });
          new Function(next);   // compile check: a mod must never leave the game unable to start
          code = next;
          var synced = {};
          Object.keys(def.settings).forEach(function (k) { if (def.settings[k].sync !== false) synced[k] = settings[k]; });
          running.push({ id: rec.id, version: rec.meta.version, meta: rec.meta, hash: hex(fnv(rec.src)), settings: settings, synced: synced });
        } catch (e) {
          UVM.errors[rec.id] = (e && e.message) || String(e);
          console.warn('[uvm] mod "' + rec.id + '" not loaded:', e);
        }
      });
    }).catch(function (e) {
      console.warn('[uvm] mod storage unavailable, starting without mods:', e);
      UVM.storageError = (e && e.message) || String(e);
    }).then(function () {
      UVM.mods = running;
      UVM.active = running.length > 0;
      UVM.tag = UVM.active ? '+m' + hex(fnv(JSON.stringify(running.map(function (m) { return [m.id, m.version, m.hash, m.synced]; }))), 6) : '';
      try { runGame(code); }
      catch (e) { console.error('[uvm] game failed with mods, starting vanilla', e); UVM.mods = []; UVM.active = false; UVM.tag = ''; runGame(base); }
    });
  }
  boot();
})();
