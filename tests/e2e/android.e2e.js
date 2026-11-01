// E2E de la versión Android/web: build de producción + window.api web (sql.js + IndexedDB)
// en Chromium con viewport de móvil. El proxy nativo del APK (/__proxy) se simula con
// page.route usando exactamente el mismo protocolo de cabeceras X-GV-*.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '../../') + 'node_modules/xlsx');
const fakeHttp = require(path.join(__dirname, '../../') + 'tests/fakeHttp.js');

const BUILD = path.join(__dirname, '../../') + 'build';
const OUT = path.join(__dirname, 'shots-android');
fs.mkdirSync(OUT, { recursive: true });
const TMP = fs.mkdtempSync('/tmp/gv-android-');
const results = [], errors = [], proxyCalls = [], saved = [];
let step = 0; const CUR = {};
const assert = (c, m) => { if (!c) throw new Error(m || 'assert'); };
async function check(name, fn) {
  step++;
  try { await fn(); results.push(`✔ ${step}. ${name}`); }
  catch (e) {
    results.push(`✘ ${step}. ${name}\n     → ${e.message.split('\n')[0]}`);
    try { await CUR.page.screenshot({ path: path.join(OUT, `FAIL-${step}.png`) }); await CUR.page.keyboard.press('Escape'); } catch {}
  }
}
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(BUILD, p);
  if (!f.startsWith(BUILD) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const unb64 = s => Buffer.from(s, 'base64').toString('utf8');

(async () => {
  await new Promise(r => server.listen(5077, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES',
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36 GameVaultAndroid/1.4',
  });
  await ctx.addInitScript(() => {
    window.GVAndroid = { saveFile: (name, text, mime) => { (window.__saved = window.__saved || []).push({ name, text, mime }); return '/storage/emulated/0/Download/' + name; } };
  });
  // Proxy nativo simulado: mismo contrato que MainActivity.java
  await ctx.route('**/__proxy*', async route => {
    const h = route.request().headers();
    const url = h['x-gv-url'], method = h['x-gv-method'];
    const headers = JSON.parse(unb64(h['x-gv-headers'] || 'e30='));
    const body = h['x-gv-body'] ? unb64(h['x-gv-body']) : undefined;
    proxyCalls.push(`${method} ${url.replace(/\?.*/, '')}`);
    const r = await fakeHttp(url, { method, headers, body });
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-GV-Status': String(r.status) }, body: r.text });
  });
  await ctx.route(/rawg\.io|wikipedia|wikimedia/, r => r.abort());   // sin red externa en las pruebas
  const page = await ctx.newPage(); CUR.page = page;
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('dialog', d => { results.push(`   (alerta: "${d.message().slice(0, 100)}")`); d.accept(); });
  const shot = n => page.screenshot({ path: path.join(OUT, `${String(step).padStart(2, '0')}-${n}.png`) });
  const noHScroll = async () => { const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert(sw <= w + 1, `desbordamiento horizontal: ${sw} > ${w}`); };

  await page.goto('http://localhost:5077/');

  await check('Arranca sin Electron: BD SQLite en el móvil + colección inicial, bienvenida adaptada', async () => {
    await page.getByText('Empezar desde cero').waitFor({ timeout: 20000 });
    assert(await page.locator('.titlebar').count() === 0, 'no debe haber barra de ventana de escritorio');
    await noHScroll(); await shot('bienvenida');
  });
  await check('Catálogo vacío: el asistente no tiene consolas previas; continuar sin consolas', async () => {
    await page.getByText('Empezar desde cero').click();
    await page.locator('.ob-consola').first().waitFor();
    if (await page.locator('.ob-consola-tiene').count() !== 0) throw new Error('no debería haber consolas previas');
    await page.getByRole('button', { name: /Continuar sin consolas/ }).click();
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 15000 });
  });
  await check('Cargar una colección desde el móvil (Más → Importar JSON)', async () => {
    await page.locator('.nav-more').click();
    const fc = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /Importar JSON/ }).click();
    await (await fc).setFiles(path.join(__dirname, '../../') + 'tests/fixtures/coleccion-ejemplo.json');
    await page.getByRole('button', { name: /importar y sobrescribir/ }).click();
    await page.waitForTimeout(2500);
    await page.locator('.nav-item', { hasText: 'Dashboard' }).click();
    const t = await page.locator('.stats-grid').first().innerText();
    if (!/182/.test(t)) throw new Error('stats: ' + t);
  });
  await check('Dashboard en móvil: barra de navegación inferior, sin scroll horizontal', async () => {
    await page.waitForTimeout(300);
    await page.locator('.stats-grid').first().waitFor();
    const nav = await page.locator('.sidebar').boundingBox();
    assert(nav.y > 700, 'la navegación debe estar abajo, y=' + nav.y);
    await noHScroll(); await shot('dashboard');
  });
  await check('Crear juego en móvil (formulario a pantalla completa) con 3 unidades', async () => {
    await page.locator('.nav-item', { hasText: 'Juegos' }).click();
    await noHScroll();
    await page.getByRole('button', { name: /Nuevo juego/ }).click();
    const modal = page.locator('.modal-box');
    const mb = await modal.boundingBox();
    assert(mb.width >= 385, 'modal a pantalla completa: ' + mb.width);
    await modal.locator('select').first().selectOption({ label: 'PS3' });
    await modal.getByPlaceholder('Escribe el nombre del juego…').fill('Grand Theft Auto: San Andreas');
    await modal.locator('.field').filter({ has: page.locator('label.field-label', { hasText: /^Unidades$/ }) }).locator('input').fill('3');
    await shot('form-movil');
    await modal.getByRole('button', { name: /Crear juego/ }).click();
    await page.getByPlaceholder('Nombre…').fill('san andreas');
    await page.locator('.filter-bar select').first().selectOption({ label: 'PS3' });
    await page.locator('td.td-name', { hasText: 'Grand Theft Auto: San Andreas' }).first().waitFor();
  });
  await check('HLTB y ventas a través del proxy nativo (protocolo X-GV-*)', async () => {
    await page.locator('td.td-name', { hasText: 'Grand Theft Auto: San Andreas' }).first().click();
    const panel = page.locator('.jp-panel');
    await panel.getByText('30,1 h').waitFor({ timeout: 20000 });
    await panel.getByText('27,5 M').waitFor({ timeout: 20000 });
    await panel.getByText('3 (duplicado)').waitFor();
    assert(proxyCalls.some(c => c.startsWith('POST https://howlongtobeat.com/api/search/site')), 'POST HLTB por el proxy');
    assert(proxyCalls.some(c => c.includes('vgchartz.com/games/games.php')), 'VGChartz por el proxy');
    const pb = await panel.boundingBox(); assert(pb.width >= 385, 'panel a pantalla completa');
    await shot('panel-movil');
    await panel.locator('.jp-close').click();
    await page.getByRole('button', { name: /Limpiar filtros/ }).click();
  });
  await check('Gráfica de ventas táctil (Mario Kart 8 Deluxe)', async () => {
    await page.getByRole('button', { name: /Nuevo juego/ }).click();
    const modal = page.locator('.modal-box');
    await modal.locator('select').first().selectOption({ label: 'Switch' });
    await modal.getByPlaceholder('Escribe el nombre del juego…').fill('Mario Kart 8 Deluxe: Booster Course');
    await modal.getByRole('button', { name: /Crear juego/ }).click();
    await page.getByPlaceholder('Nombre…').fill('booster');
    await page.locator('td.td-name', { hasText: 'Booster' }).click();
    const panel = page.locator('.jp-panel');
    const svg = panel.locator('svg[role="img"]');
    await svg.waitFor({ timeout: 20000 });
    await svg.scrollIntoViewIfNeeded();
    const b = await svg.boundingBox();
    await page.touchscreen.tap(b.x + b.width * 0.5, b.y + b.height * 0.5);
    await panel.getByText(/desde/).waitFor({ timeout: 3000 });
    await shot('grafica-movil');
    await panel.locator('.jp-close').click();
    await page.getByPlaceholder('Nombre…').fill('');
  });
  await check('Añadir imagen desde la galería del móvil (se guarda reducida dentro de la BD)', async () => {
    const png = path.join(TMP, 'foto.png');
    const { PNG } = { PNG: null };
    fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8DwnwEJMDHgAkwMAAAiOgH/zZ6+uQAAAABJRU5ErkJggg==', 'base64'));
    await page.getByRole('button', { name: /Nuevo juego/ }).click();
    const modal = page.locator('.modal-box');
    const fc = page.waitForEvent('filechooser');
    await modal.locator('.img-add-btn').click();
    await (await fc).setFiles(png);
    await modal.locator('.img-thumb img').first().waitFor();
    const src = await modal.locator('.img-thumb img').first().getAttribute('src');
    assert(src.startsWith('data:image/jpeg'), src.slice(0, 30));
    await modal.locator('.modal-close').click();
  });
  await check('Importar colección desde Excel en el móvil', async () => {
    const ws = XLSX.utils.aoa_to_sheet([['Juego', 'Consola', 'Cantidad'], ['Ecco the Dolphin', 'Mega Drive', 1], ['Columns', 'SMD', 2]]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'A');
    const f = path.join(TMP, 'lista.xlsx'); XLSX.writeFile(wb, f);
    await page.getByRole('button', { name: /Importar colección/ }).click();
    const modal = page.locator('.modal-box');
    await modal.locator('input[type=file]').setInputFiles(f);
    await modal.getByText(/2 juegos detectados/).waitFor();
    await modal.getByText(/Emparejadas con tus plataformas/).waitFor();
    await modal.getByText('Buscar carátulas en RAWG').click();
    await modal.getByRole('button', { name: /Importar 2 juegos/ }).click();
    await modal.getByText('¡Importación completada!').waitFor({ timeout: 20000 });
    await modal.getByRole('button', { name: /Ver colección/ }).click();
    await page.getByPlaceholder('Nombre…').fill('columns');
    const sec = await page.locator('.section-title').first().innerText();
    assert(/MEGA DRIVE|Mega Drive/i.test(sec), 'emparejado con Mega Drive: ' + sec);
    await page.getByPlaceholder('Nombre…').fill('');
  });
  await check('Menú "Más" → Exportar JSON guarda en Descargas (GVAndroid.saveFile)', async () => {
    await page.locator('.nav-more').click();
    await page.getByRole('button', { name: /Exportar JSON/ }).click();
    await page.waitForTimeout(500);
    const s = await page.evaluate(() => window.__saved || []);
    assert(s.length === 1 && /gamevault-.*\.json/.test(s[0].name), JSON.stringify(s.map(x => x.name)));
    const d = JSON.parse(s[0].text);
    assert(d.juegos.find(j => j.nombre === 'Grand Theft Auto: San Andreas' && j.unidades === 3), 'contenido');
    fs.writeFileSync(path.join(TMP, 'export.json'), s[0].text);
  });
  await check('Los datos persisten tras cerrar y reabrir la app (IndexedDB)', async () => {
    await page.waitForTimeout(600);
    await page.goto('http://localhost:5077/#/juegos');
    await page.reload();
    await page.getByRole('heading', { name: 'Juegos' }).waitFor({ timeout: 20000 });
    await page.getByPlaceholder('Nombre…').fill('columns');
    await page.locator('td.td-name', { hasText: 'Columns' }).waitFor();
  });
  await check('Importar JSON desde el móvil (selector de archivos) sobrescribe la colección', async () => {
    await page.locator('.nav-more').click();
    const fc = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /Importar JSON/ }).click();
    await (await fc).setFiles(path.join(TMP, 'export.json'));
    await page.getByRole('button', { name: /importar y sobrescribir/ }).click();
    await page.waitForTimeout(2500);
    await page.locator('.nav-item', { hasText: 'Juegos' }).click();
    await page.getByPlaceholder('Nombre…').fill('columns');
    await page.locator('td.td-name', { hasText: 'Columns' }).waitFor();
    await page.getByPlaceholder('Nombre…').fill('');
  });
  await check('Plataformas, detalle de consola y estadísticas en móvil sin desbordes', async () => {
    await page.locator('.nav-item', { hasText: 'Plataformas' }).click();
    await page.locator('.plat-card').first().waitFor(); await noHScroll(); await shot('plataformas');
    await page.locator('.plat-card').first().click();
    await page.getByText('Unidades en tu colección').waitFor(); await shot('plataforma-detalle');
    await page.locator('.nav-item', { hasText: 'Estad' }).click();
    await page.locator('.bubble-wrap').first().waitFor(); await shot('stats');
  });
  await check('PDF en móvil: mensaje claro (sólo escritorio)', async () => {
    await page.locator('.nav-item', { hasText: 'Dashboard' }).click();
    await page.getByRole('button', { name: /Exportar PDF/ }).click();
    await page.waitForTimeout(300);
  });

  await check('Móvil: Más → interruptor de tema claro', async () => {
    await page.locator('.nav-more').click();
    await page.locator('.sidebar-footer .theme-switch').click();
    assert(await page.evaluate(() => document.documentElement.dataset.theme) === 'light', 'no cambió');
    await page.waitForTimeout(500); await page.screenshot({ path: path.join(OUT, 'tema-claro-movil.png') });
    await page.locator('.sidebar-scrim').click().catch(() => {});
  });
  await check('Móvil: borrar toda la colección y que siga borrada al recargar', async () => {
    await page.locator('.nav-more').click();
    await page.getByRole('button', { name: /Ajustes/ }).click();
    await page.getByRole('button', { name: /Borrar toda mi colección/ }).click();
    const modal = page.locator('.modal-box');
    await modal.locator('.wipe-confirm input').fill('BORRAR');
    await page.screenshot({ path: path.join(OUT, 'borrar-movil.png') });
    await modal.getByRole('button', { name: /Borrar \d+ elementos/ }).click();
    await page.getByText('Empezar desde cero').waitFor({ timeout: 15000 });
    await page.reload(); await page.getByText('Empezar desde cero').waitFor({ timeout: 15000 });
    const n = await page.evaluate(() => window.api.io.counts());
    assert(n.plataformas === 0 && n.juegos === 0, JSON.stringify(n));
  });

  console.log(results.join('\n'));
  console.log('\nLlamadas al proxy nativo:', proxyCalls.length, [...new Set(proxyCalls.map(c => c.split(' ')[0] + ' ' + new URL(c.split(' ')[1]).hostname))].join(', '));
  console.log('Errores de consola/JS:', errors.length ? '\n  ' + [...new Set(errors)].join('\n  ') : 'ninguno');
  await browser.close(); server.close(); process.exit(0);
})().catch(e => { console.log(results.join('\n')); console.error('FATAL', e); process.exit(1); });
