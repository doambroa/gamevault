const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');
const path = require('path');
const fs   = require('fs');
const { createCore } = require('../src/core/gvCore');

// ─── Dev vs Producción ────────────────────────────────────────────────────────
// DEV  = npm run electron-dev   → carga http://localhost:3000
// PROD = app instalada o .exe   → carga build/index.html local
const DEV = !app.isPackaged && process.env.GV_PROD !== '1';

let win, core;

// ─── Rutas ────────────────────────────────────────────────────────────────────
function dbDir() {
  // Dev  → carpeta db/ del proyecto
  // Prod → %APPDATA%\GameVault  (p.ej. C:\Users\usuario\AppData\Roaming\GameVault)
  const d = process.env.GV_DATA_DIR || (DEV ? path.join(__dirname, '..', 'db') : app.getPath('userData'));
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}
const dbPath      = () => path.join(dbDir(), 'gamevault.db');
const imagesDir   = () => { const d = path.join(dbDir(),'images'); if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true}); return d; };
const wasmPath    = () => app.isPackaged
  ? path.join(process.resourcesPath,'sql-wasm.wasm')
  : path.join(__dirname,'..','node_modules','sql.js','dist','sql-wasm.wasm');

// ─── Log visible también en la consola de DevTools del renderer ───────────────
// (las peticiones a HLTB/VGChartz salen del proceso principal, por eso no aparecen
//  en la pestaña "Red" de DevTools; las mostramos aquí como mensajes de consola)
function log(...args) {
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log(msg);
  try { if (win && !win.isDestroyed()) win.webContents.send('gv:log', msg); } catch {}
}

// ─── HTTP para HLTB / VGChartz / RAWG ─────────────────────────────────────────
// 1º net.fetch (pila de red de Chromium: mismo TLS, proxy y cookies que un navegador)
// 2º si el sitio bloquea (Cloudflare) o falla, se repite la petición DESDE DENTRO de
//    una ventana oculta con la web cargada — exactamente igual que hace el navegador.
const PAGE_ORIGINS = ['https://howlongtobeat.com', 'https://www.vgchartz.com'];
const pageWins = {};
const pageMode = {};   // origin → true cuando la vía directa ha fallado en esta sesión

const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what}: tiempo agotado`)), ms))]);
const looksBlocked = (status, text) => (status === 403 || status === 503 || status === 429) &&
  /cf-chl|challenge-platform|Just a moment|Attention Required|cloudflare/i.test(text || '');

async function getPageWin(origin) {
  let w = pageWins[origin];
  if (w && !w.isDestroyed()) return w;
  w = new BrowserWindow({ show: false, width: 1024, height: 768,
    webPreferences: { contextIsolation: true, sandbox: true, images: false, backgroundThrottling: false } });
  w.webContents.setAudioMuted(true);
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  pageWins[origin] = w;
  log(`[red] cargando ${origin} en ventana oculta…`);
  await withTimeout(w.loadURL(origin + '/').catch(() => {}), 25000, origin);
  return w;
}

async function pageFetch(origin, url, opts) {
  const w = await getPageWin(origin);
  const headers = { ...(opts.headers || {}) };
  for (const h of ['User-Agent', 'Origin', 'Referer', 'Accept-Language']) delete headers[h];
  const init = { method: opts.method || 'GET', headers, body: opts.body, credentials: 'include' };
  const code = `(async()=>{const r=await fetch(${JSON.stringify(url)},${JSON.stringify(init)});return {status:r.status,text:await r.text()};})()`;
  return withTimeout(w.webContents.executeJavaScript(code, true), 20000, url);
}

async function electronHttp(url, opts = {}) {
  const origin = PAGE_ORIGINS.find(o => url.startsWith(o));
  const short = url.replace(/\?.*$/, '');
  if (origin && pageMode[origin]) {
    const r = await pageFetch(origin, url, opts);
    log(`[red] ${opts.method || 'GET'} ${short} → ${r.status} (vía página)`);
    return r;
  }
  try {
    let r;
    try {
      r = await withTimeout(net.fetch(url, { method: opts.method || 'GET', headers: opts.headers, body: opts.body }), 15000, url);
    } catch (e) {
      // Chromium puede rechazar cabeceras como Origin/Referer: reintento sin ellas
      if (!/header|unsafe/i.test(e.message)) throw e;
      const h = { ...(opts.headers || {}) }; delete h.Origin; delete h.Referer;
      r = await withTimeout(net.fetch(url, { method: opts.method || 'GET', headers: h, body: opts.body }), 15000, url);
    }
    const text = await r.text();
    log(`[red] ${opts.method || 'GET'} ${short} → ${r.status}`);
    if (origin && looksBlocked(r.status, text)) throw new Error('bloqueado por protección anti-bots');
    return { status: r.status, text };
  } catch (e) {
    if (!origin) throw e;
    log(`[red] ${short}: ${e.message} — reintentando desde la propia web`);
    pageMode[origin] = true;
    const r = await pageFetch(origin, url, opts);
    log(`[red] ${opts.method || 'GET'} ${short} → ${r.status} (vía página)`);
    return r;
  }
}

// ─── BD ───────────────────────────────────────────────────────────────────────
async function initDb() {
  const SQL = await require('sql.js')({ wasmBinary: fs.readFileSync(wasmPath()) });
  const file = dbPath();
  const bytes = fs.existsSync(file) ? fs.readFileSync(file) : null;
  core = createCore({
    SQL, bytes,
    persist: data => { const tmp = file + '.tmp'; fs.writeFileSync(tmp, Buffer.from(data)); fs.renameSync(tmp, file); },
    // GV_FAKE_HTTP sólo se usa en las pruebas automáticas (respuestas grabadas)
    http: process.env.GV_FAKE_HTTP ? require(process.env.GV_FAKE_HTTP) : electronHttp,
    onChange: e => { try { if (win && !win.isDestroyed()) win.webContents.send('gv:changed', e); } catch {} },
    log,
  });
  // BD nueva → catálogo vacío: el usuario empieza desde cero (asistente inicial)
  console.log('BD lista:', file);
}
const all = (sql, p) => core.all(sql, p);

// ─── Ventana ──────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width:1440, height:900, minWidth:1024, minHeight:700,
    backgroundColor:'#080810', frame:false,
    icon: path.join(__dirname, '..', app.isPackaged ? 'build' : 'public', 'icon-192.png'),
    webPreferences:{
      nodeIntegration:false, contextIsolation:true,
      preload: path.join(__dirname,'preload.js'),
    },
  });
  if (DEV) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname,'..','build','index.html'));
  }
  // F12 / Ctrl+Shift+I abren DevTools también en la versión instalada
  win.webContents.on('before-input-event', (_, input) => {
    if (input.type === 'keyDown' && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')))
      win.webContents.toggleDevTools();
  });
  win.on('close', () => {
    for (const w of Object.values(pageWins)) { try { if (!w.isDestroyed()) w.destroy(); } catch {} }
  });
}

// ─── Protocolo local para imágenes ───────────────────────────────────────────
// Interfaz y formatos de fecha en español (dd/mm/aaaa en los selectores de fecha)
app.commandLine.appendSwitch('lang', 'es-ES');

protocol.registerSchemesAsPrivileged([{
  scheme: 'localimg',
  privileges: { secure: true, supportFetchAPI: true, bypassCSP: true }
}]);

app.whenReady().then(async () => {
  // localimg://local/?p=<base64(ruta)>
  protocol.handle('localimg', req => {
    try {
      const url = new URL(req.url);
      const b64 = url.searchParams.get('p');
      if (!b64) return new Response('bad request', { status: 400 });
      const p = path.normalize(Buffer.from(b64, 'base64').toString('utf8'));
      if (!fs.existsSync(p)) return new Response('not found', { status: 404 });
      const ext  = p.split('.').pop().toLowerCase();
      const mime = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png',
                     gif:'image/gif', webp:'image/webp', svg:'image/svg+xml' }[ext] || 'image/jpeg';
      return new Response(fs.readFileSync(p), { status: 200, headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000' } });
    } catch(e) {
      return new Response('error', { status: 500 });
    }
  });
  await initDb();
  registerCoreHandlers();
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ─── IPC: todas las operaciones de datos vienen del núcleo compartido ─────────
function registerCoreHandlers() {
  for (const ch of Object.keys(core.handlers)) {
    ipcMain.handle(ch, (_, ...args) => core.handle(ch, ...args));
  }
}

// ─── IPC exclusivos de escritorio ─────────────────────────────────────────────
ipcMain.handle('io:export', async () => {
  const {filePath}=await dialog.showSaveDialog(win,{
    title:'Exportar colección GameVault',
    defaultPath:`gamevault-${new Date().toISOString().split('T')[0]}.json`,
    filters:[{name:'JSON',extensions:['json']}],
  });
  if(!filePath) return {cancelled:true};
  fs.writeFileSync(filePath, JSON.stringify(core.exportData(), null, 2));
  return {ok:true,filePath};
});
ipcMain.handle('io:import', async () => {
  const {filePaths}=await dialog.showOpenDialog(win,{
    title:'Importar colección GameVault',
    filters:[{name:'JSON',extensions:['json']}],
    properties:['openFile'],
  });
  if(!filePaths?.length) return {cancelled:true};
  return {needsConfirm:true, filePath:filePaths[0]};
});
ipcMain.handle('io:importConfirm', async (_,filePath) => {
  try {
    const r = core.importColeccion(JSON.parse(fs.readFileSync(filePath,'utf-8')), { replace: true });
    return {ok:true, ...r};
  } catch(e) {
    return {error: e.message};
  }
});
ipcMain.handle('io:openFolder', () => shell.openPath(dbDir()));
ipcMain.handle('io:dbPath',     () => dbPath());

// ─── PDF Export ────────────────────────────────────────────────────────────────
ipcMain.handle('io:exportPdf', async () => {
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Exportar catálogo PDF',
    defaultPath: `gamevault-catalogo-${new Date().toISOString().split('T')[0]}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (!filePath) return { cancelled: true };
  try {
    await writeCatalogPdf(filePath);
    shell.openPath(filePath);
    return { ok: true, filePath };
  } catch (e) {
    return { error: 'No se pudo generar el PDF: ' + e.message };
  }
});

// Imagen (ruta local, localimg:// o URL) → data URI, para que el PDF no dependa de nada externo
async function imageToDataUri(src) {
  try {
    if (!src) return null;
    if (src.startsWith('data:')) return src;
    const mimeOf = p => ({ png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }[path.extname(p).slice(1).toLowerCase()] || 'image/jpeg');
    if (/^https?:\/\//.test(src)) {
      const r = await withTimeout(net.fetch(src), 12000, src);
      if (!r.ok) return null;
      const ct = r.headers.get('content-type') || 'image/jpeg';
      return `data:${ct};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
    }
    let p = src;
    if (src.startsWith('./consolas/')) {          // imagen por defecto incluida en la app
      const rel = src.slice(2);
      p = [path.join(__dirname, '..', 'build', rel), path.join(__dirname, '..', 'public', rel)].find(f => fs.existsSync(f)) || '';
    }
    if (src.startsWith('localimg://')) p = Buffer.from(new URL(src).searchParams.get('p') || '', 'base64').toString('utf8');
    p = path.normalize(p);
    if (!fs.existsSync(p)) return null;
    return `data:${mimeOf(p)};base64,${fs.readFileSync(p).toString('base64')}`;
  } catch { return null; }
}

async function writeCatalogPdf(filePath) {
  const { buildCatalogHtml } = require('./pdfCatalog');
  const plataformas = all('SELECT * FROM plataformas ORDER BY nombre COLLATE NOCASE');
  const juegos = all('SELECT * FROM juegos');
  // Precargar todas las imágenes (de 6 en 6)
  const srcs = new Set();
  const first = raw => { try { return (JSON.parse(raw || '[]') || [])[0]; } catch { return null; } };
  for (const x of [...plataformas, ...juegos]) { const f = first(x.imagenes); if (f) srcs.add(f); }
  const cache = new Map(), list = [...srcs];
  for (let i = 0; i < list.length; i += 6) {
    await Promise.all(list.slice(i, i + 6).map(async s => cache.set(s, await imageToDataUri(s))));
  }
  const html = buildCatalogHtml({ plataformas, juegos, imgFor: s => (s ? cache.get(s) || null : null) });
  const tmp = path.join(app.getPath('temp'), `gamevault-catalogo-${Date.now()}.html`);
  fs.writeFileSync(tmp, html);
  const pdfWin = new BrowserWindow({ show: false, width: 1240, height: 1754,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  try {
    await pdfWin.loadFile(tmp);
    // Esperar a que todas las imágenes y fuentes estén listas
    await pdfWin.webContents.executeJavaScript(`Promise.all([document.fonts.ready,
      ...[...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))]).then(() => true)`);
    const data = await pdfWin.webContents.printToPDF({
      printBackground: true, preferCSSPageSize: true, pageSize: 'A4',
      margins: { marginType: 'none' },
    });
    fs.writeFileSync(filePath, data);
  } finally {
    pdfWin.destroy();
    fs.unlink(tmp, () => {});
  }
}

// Wikipedia fetch desde main process (para incluir User-Agent y evitar bloqueos CORS/Wikimedia)
ipcMain.handle('wiki:fetch', async (_, urlStr) => {
  try {
    const r = await fetch(urlStr, {
      headers: {
        'User-Agent': 'GameVault/1.4 (coleccion personal de videojuegos)',
        'Accept': 'application/json, image/*, */*',
      }
    });
    if (!r.ok) return { ok: false, status: r.status };
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return { ok: true, json: await r.json() };
    } else {
      const buf = Buffer.from(await r.arrayBuffer());
      return { ok: true, b64: buf.toString('base64'), contentType: ct };
    }
  } catch(e) {
    return { ok: false, error: e.message };
  }
});

// Imágenes
ipcMain.handle('img:select', async () => {
  const {filePaths}=await dialog.showOpenDialog(win,{
    title:'Seleccionar imágenes',
    filters:[{name:'Imágenes',extensions:['jpg','jpeg','png','gif','webp']}],
    properties:['openFile','multiSelections'],
  });
  if(!filePaths?.length) return [];
  return filePaths.map(src=>{
    const dest=path.join(imagesDir(),`img_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(src)}`);
    fs.copyFileSync(src,dest);
    return dest;
  });
});

// Controles de ventana
ipcMain.on('win:min',   () => win?.minimize());
ipcMain.on('win:max',   () => win && (win.isMaximized()?win.restore():win.maximize()));
ipcMain.on('win:close', () => win?.close());
