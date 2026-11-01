/* Versión web / Android de window.api
 * ────────────────────────────────────────────────────────────────────────────
 * En Electron, window.api lo crea electron/preload.js (IPC con el proceso principal).
 * En el APK de Android (y en un navegador normal) no hay Electron: aquí creamos el mismo
 * objeto con la misma forma, usando el núcleo compartido (src/core/gvCore.js) + sql.js
 * en el propio dispositivo. La BD se guarda en IndexedDB.
 *
 * Android: la app nativa (android/…/MainActivity.java) sirve la web desde
 * https://app.gamevault/ y ofrece un proxy en /__proxy para llamar a HLTB/VGChartz
 * sin restricciones CORS, más window.GVAndroid.saveFile() para exportar.
 */
import { createCore } from '../core/gvCore';

const IS_ANDROID = typeof navigator !== 'undefined' && /GameVaultAndroid/.test(navigator.userAgent);
const IS_IOS = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const DB_NAME = 'gamevault', STORE = 'kv', KEY = 'db';

// ── IndexedDB mínimo ──────────────────────────────────────────────────────────
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(k) {
  const d = await idb();
  return new Promise((res, rej) => { const t = d.transaction(STORE).objectStore(STORE).get(k); t.onsuccess = () => res(t.result || null); t.onerror = () => rej(t.error); });
}
async function idbSet(k, v) {
  const d = await idb();
  return new Promise((res, rej) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

// ── sql.js (se sirve desde /sql-wasm.js y /sql-wasm.wasm en public/) ─────────
function loadSqlJs() {
  return new Promise((resolve, reject) => {
    if (window.initSqlJs) return resolve(window.initSqlJs);
    const s = document.createElement('script');
    s.src = './sql-wasm.js';
    s.onload = () => resolve(window.initSqlJs);
    s.onerror = () => reject(new Error('No se pudo cargar sql-wasm.js'));
    document.head.appendChild(s);
  });
}

// ── HTTP ──────────────────────────────────────────────────────────────────────
const b64 = s => btoa(unescape(encodeURIComponent(s)));
// proxy.php (versión web/iPhone): se detecta una vez
const PROXY_URL = './proxy.php';
let proxyCheck = null;
function hasWebProxy() {
  if (!proxyCheck) {
    proxyCheck = /^https?:$/.test(window.location.protocol)
      ? fetch(PROXY_URL + '?ping=1', { cache: 'no-store' }).then(r => r.ok && r.json()).then(j => !!j?.gamevault).catch(() => false)
      : Promise.resolve(false);
  }
  return proxyCheck;
}

async function http(url, opts = {}) {
  if (IS_ANDROID) {
    // El proxy nativo no ve el cuerpo de la petición: lo mandamos en cabeceras
    const headers = {
      'X-GV-Url': url,
      'X-GV-Method': opts.method || 'GET',
      'X-GV-Headers': b64(JSON.stringify(opts.headers || {})),
    };
    if (opts.body) headers['X-GV-Body'] = b64(opts.body);
    const r = await fetch('/__proxy?t=' + Date.now(), { method: 'GET', headers, cache: 'no-store' });
    return { status: Number(r.headers.get('X-GV-Status')) || r.status, text: await r.text() };
  }
  // Web (iPhone u otro navegador) servida desde tu servidor: proxy.php junto a la app
  if (await hasWebProxy()) {
    const r = await fetch(PROXY_URL, {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body || null }),
    });
    if (!r.ok) throw new Error('El proxy del servidor respondió ' + r.status);
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return { status: j.status, text: j.text };
  }
  // Sin proxy: sólo funcionará con sitios que permitan CORS (RAWG, Wikipedia)
  const h = { ...(opts.headers || {}) };
  for (const k of ['User-Agent', 'Origin', 'Referer', 'Accept-Language']) delete h[k];
  const r = await fetch(url, { method: opts.method || 'GET', headers: h, body: opts.body });
  return { status: r.status, text: await r.text() };
}

// ── Ficheros ──────────────────────────────────────────────────────────────────
function pickFile(accept, multiple = false) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept; input.multiple = multiple;
    input.style.display = 'none';
    input.onchange = () => { resolve([...(input.files || [])]); input.remove(); };
    document.body.appendChild(input);
    input.click();
  });
}
function downloadText(name, text, mime = 'application/json') {
  if (IS_ANDROID && window.GVAndroid?.saveFile) {
    const where = window.GVAndroid.saveFile(name, text, mime);
    return { ok: !!where, filePath: where || '' };
  }
  // iPhone/iPad: hoja de compartir (Guardar en Archivos, AirDrop, Mail…)
  const file = typeof File !== 'undefined' ? new File([text], name, { type: mime }) : null;
  if (IS_IOS && file && navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: name }).catch(() => {});
    return { ok: true, filePath: '' };
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return { ok: true, filePath: name };
}
// Reduce la imagen a ≤ 900 px y la devuelve como data URI (se guarda dentro de la BD)
function imageToDataUri(file, max = 900) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ── Arranque ──────────────────────────────────────────────────────────────────
let corePromise = null;
const listeners = new Set();
let pendingImport = null;
let flushNow = () => Promise.resolve();   // se asigna al arrancar el núcleo

function getCore() {
  if (!corePromise) corePromise = (async () => {
    const initSqlJs = await loadSqlJs();
    const SQL = await initSqlJs({ locateFile: f => './' + f });
    let bytes = null;
    try { bytes = await idbGet(KEY); } catch (e) { console.warn('IndexedDB no disponible', e); }
    let timer = null, latest = null;
    // Devuelve una promesa que se cumple cuando IndexedDB ha guardado de verdad
    let pending = Promise.resolve();
    const flush = () => {
      clearTimeout(timer);
      if (latest) { const d = latest; latest = null; pending = pending.then(() => idbSet(KEY, d)).catch(e => console.error('Error guardando', e)); }
      return pending;
    };
    flushNow = flush;
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    const core = createCore({
      SQL, bytes: bytes ? new Uint8Array(bytes) : null,
      persist: data => { latest = data; clearTimeout(timer); timer = setTimeout(flush, 250); },
      http,
      onChange: e => listeners.forEach(fn => { try { fn(e); } catch {} }),
      log: (...a) => console.info('[GameVault]', ...a),
    });
    // BD nueva → catálogo vacío (el asistente inicial guía al usuario)
    return core;
  })();
  return corePromise;
}
const call = (ch, ...args) => getCore().then(c => c.handle(ch, ...args));

export function createWebApi() {
  return {
    platform: IS_ANDROID ? 'android' : IS_IOS ? 'ios' : 'web',
    plataformas: {
      getAll: () => call('p:all'), getById: id => call('p:one', id),
      create: d => call('p:create', d), update: d => call('p:update', d), delete: id => call('p:delete', id),
    },
    juegos: {
      getAll: f => call('j:all', f), getById: id => call('j:one', id), getByPlataforma: id => call('j:byPlat', id),
      create: d => call('j:create', d), update: d => call('j:update', d), delete: id => call('j:delete', id),
      needsCovers: () => call('j:needsCovers'), updateCovers: d => call('j:updateCovers', d),
      prestados: () => call('j:prestados'), prestar: d => call('j:prestar', d), devolver: id => call('j:devolver', id),
      hltbFetch: d => call('j:hltbFetch', d), ventasFetch: d => call('j:ventasFetch', d),
    },
    deseos: {
      getAll: () => call('d:all'), create: d => call('d:create', d), update: d => call('d:update', d),
      delete: id => call('d:delete', id), moveToCollection: d => call('d:move', d),
    },
    stats: { get: () => call('stats') },
    config: { get: k => call('cfg:get', k), set: (k, v) => call('cfg:set', k, v) },
    io: {
      export: async () => {
        const data = await call('data:export');
        return downloadText(`gamevault-${new Date().toISOString().split('T')[0]}.json`, JSON.stringify(data, null, 2));
      },
      exportPdf: async () => ({ error: 'La exportación a PDF está disponible en la versión de escritorio (Windows).' }),
      import: async () => {
        const [f] = await pickFile('.json,application/json');
        if (!f) return { cancelled: true };
        pendingImport = { name: f.name, text: await f.text() };
        return { needsConfirm: true, filePath: f.name };
      },
      importConfirm: async () => {
        if (!pendingImport) return { error: 'No hay fichero seleccionado' };
        try {
          const r = await call('data:import', JSON.parse(pendingImport.text), { replace: true });
          pendingImport = null;
          await flushNow();      // la interfaz recarga la página justo después: guardar antes
          return r;
        }
        catch (e) { return { error: e.message }; }
      },
      counts: () => call('data:counts'),
      wipe: async o => { const r = await call('data:wipe', o); await flushNow(); return r; },
      openFolder: async () => null,
      getDbPath: async () => '',
    },
    images: {
      select: async () => {
        const files = await pickFile('image/*', true);
        const out = [];
        for (const f of files) { try { out.push(await imageToDataUri(f)); } catch {} }
        return out;
      },
    },
    wiki: {
      // Wikipedia y upload.wikimedia.org permiten CORS: petición directa
      fetch: async url => {
        try {
          const r = await fetch(url);
          if (!r.ok) return { ok: false, status: r.status };
          const ct = r.headers.get('content-type') || '';
          if (ct.includes('json')) return { ok: true, json: await r.json() };
          const buf = new Uint8Array(await r.arrayBuffer());
          let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
          return { ok: true, b64: btoa(bin), contentType: ct };
        } catch (e) { return { ok: false, error: e.message }; }
      },
    },
    window: { minimize() {}, maximize() {}, close() {} },
    app: { isFirstRun: () => call('app:isFirstRun'), completeOnboarding: () => call('app:completeOnboarding') },
    onChanged: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    _core: getCore,
  };
}
