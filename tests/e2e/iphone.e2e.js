// E2E de la versión web/iPhone: dist/web servida por PHP (proxy.php real para el "ping");
// las peticiones a HLTB/VGChartz que el proxy reenviaría se simulan con respuestas grabadas.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const fakeHttp = require(path.join(__dirname, '../../') + 'tests/fakeHttp.js');
const OUT = path.join(__dirname, 'shots-iphone'); fs.mkdirSync(OUT, { recursive: true });
const results = [], errors = [], proxied = []; let step = 0; const CUR = {};
const assert = (c, m) => { if (!c) throw new Error(m || 'assert'); };
async function check(name, fn) { step++; try { await fn(); results.push(`✔ ${step}. ${name}`); } catch (e) { results.push(`✘ ${step}. ${name}\n     → ${e.message.split('\n')[0]}`); try { await CUR.page.screenshot({ path: path.join(OUT, `FAIL-${step}.png`) }); await CUR.page.keyboard.press('Escape'); } catch {} } }
(async () => {
  const php = spawn('php', ['-S', '127.0.0.1:5088', '-t', path.join(__dirname, '../../') + 'dist/web'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'es-ES', acceptDownloads: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' });
  await ctx.route('**/proxy.php', async route => {
    if (route.request().method() !== 'POST') return route.continue();          // el ping lo contesta el PHP real
    const q = JSON.parse(route.request().postData());
    proxied.push(`${q.method} ${new URL(q.url).hostname}`);
    const r = await fakeHttp(q.url, { method: q.method, headers: q.headers, body: q.body || undefined });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: r.status, text: r.text }) });
  });
  await ctx.route(/rawg\.io|wikimedia/, r => r.abort());
  const page = await ctx.newPage(); CUR.page = page;
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  const shot = n => page.screenshot({ path: path.join(OUT, `${String(step).padStart(2, '0')}-${n}.png`) });
  await page.goto('http://127.0.0.1:5088/');

  await check('Abre en iPhone: bienvenida, catálogo vacío, icono y manifiesto de la app', async () => {
    await page.getByText('Empezar desde cero').waitFor({ timeout: 20000 });
    const m = await page.evaluate(() => fetch(document.querySelector('link[rel=manifest]').href).then(r => r.json()));
    assert(m.display === 'standalone' && m.icons.length >= 2, 'manifiesto');
    assert(await page.evaluate(() => !!document.querySelector('link[rel=apple-touch-icon]') && document.querySelector('meta[name=apple-mobile-web-app-capable]').content === 'yes'), 'meta iOS');
    assert(await page.evaluate(() => fetch('./apple-touch-icon.png').then(r => r.ok)), 'icono iOS');
    assert(await page.evaluate(() => window.api.platform) === 'ios', 'plataforma ios');
    await shot('bienvenida');
  });
  await check('Safari muestra la guía «Añadir a pantalla de inicio»; al cerrarla no vuelve a salir', async () => {
    await page.locator('.ios-hint').getByText('Añadir a pantalla de inicio').waitFor({ timeout: 5000 });
    await page.locator('.ios-hint-x').click();
    await page.reload(); await page.getByText('Empezar desde cero').waitFor({ timeout: 20000 });
    assert(await page.locator('.ios-hint').count() === 0, 'vuelve a salir');
  });
  await check('Detecta el proxy.php del servidor (ping real a PHP)', async () => {
    const ping = await page.evaluate(() => fetch('./proxy.php?ping=1').then(r => r.json()));
    assert(ping.gamevault === true, JSON.stringify(ping));
  });
  await check('Asistente → 2 consolas, con su imagen por defecto', async () => {
    await page.getByText('Empezar desde cero').click();
    await page.locator('.ob-consola').first().waitFor();
    const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    assert(sw <= w + 1, 'desborde ' + sw);
    const bb = await page.getByRole('button', { name: /Continuar sin consolas/ }).boundingBox();
    assert(bb.x >= 0 && bb.x + bb.width <= w + 1, 'botón fuera de pantalla');
    await shot('asistente');
    await page.locator('.ob-consola', { hasText: 'PlayStation 2' }).click();
    await page.locator('.ob-consola', { hasText: 'Switch' }).first().click();
    await page.getByRole('button', { name: /Añadir 2 consolas/ }).click();
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 15000 });
    const ps = await page.evaluate(() => window.api.plataformas.getAll());
    const imgs = ps.map(p => JSON.parse(p.imagenes || '[]')[0]).sort();
    assert(imgs.join() === './consolas/playstation-2.png,./consolas/switch.png', 'imágenes por defecto: ' + imgs.join());
    assert(await page.evaluate(src => fetch(src).then(r => r.ok && r.headers.get('content-type').includes('png')), imgs[0]), 'imagen servida');
  });
  await check('Nuevo juego → duración y ventas a través de proxy.php', async () => {
    await page.locator('.nav-item', { hasText: 'Juegos' }).click();
    await page.getByRole('button', { name: /Nuevo juego/ }).click();
    const modal = page.locator('.modal-box');
    await modal.locator('select').first().selectOption({ label: 'PlayStation 2' });
    await modal.getByPlaceholder('Escribe el nombre del juego…').fill('Grand Theft Auto: San Andreas');
    await modal.getByRole('button', { name: /Crear juego/ }).click();
    await page.locator('td.td-name', { hasText: 'San Andreas' }).click();
    const panel = page.locator('.jp-panel');
    await panel.getByText('30,1 h').waitFor({ timeout: 20000 });
    await panel.getByText('27,5 M').waitFor({ timeout: 20000 });
    assert(proxied.some(p => p.startsWith('POST howlongtobeat')) && proxied.some(p => p.includes('vgchartz')), proxied.join(','));
    await shot('panel');
    await panel.locator('.jp-close').click();
  });
  await check('Gráfica táctil (Mario Kart 8 Deluxe)', async () => {
    await page.getByRole('button', { name: /Nuevo juego/ }).click();
    const modal = page.locator('.modal-box');
    await modal.locator('select').first().selectOption({ label: 'Switch' });
    await modal.getByPlaceholder('Escribe el nombre del juego…').fill('Mario Kart 8 Deluxe');
    await modal.getByRole('button', { name: /Crear juego/ }).click();
    await page.locator('td.td-name', { hasText: 'Mario Kart' }).click();
    const svg = page.locator('.jp-panel svg[role="img"]');
    await svg.waitFor({ timeout: 20000 }); await svg.scrollIntoViewIfNeeded();
    const b = await svg.boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.locator('.jp-panel').getByText(/desde/).waitFor();
    await shot('grafica');
    await page.locator('.jp-panel .jp-close').click();
  });
  await check('Exportar JSON desde el iPhone (descarga / hoja de compartir)', async () => {
    await page.locator('.nav-more').click();
    const dl = page.waitForEvent('download', { timeout: 8000 });
    await page.getByRole('button', { name: /Exportar JSON/ }).click();
    const d = await dl;
    const f = path.join(OUT, 'export.json'); await d.saveAs(f);
    assert(JSON.parse(fs.readFileSync(f, 'utf8')).juegos.length === 2, 'contenido');
  });
  await check('Los datos siguen ahí al volver a abrir', async () => {
    await page.waitForTimeout(600);
    await page.goto('http://127.0.0.1:5088/#/juegos'); await page.reload();
    await page.locator('td.td-name', { hasText: 'Mario Kart' }).waitFor({ timeout: 20000 });
    const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    assert(sw <= w + 1, 'desborde ' + sw);
    await shot('juegos');
  });
  console.log(results.join('\n'));
  console.log('Errores JS:', errors.length ? errors.join(' | ') : 'ninguno');
  await browser.close(); php.kill(); process.exit(0);
})().catch(e => { console.log(results.join('\n')); console.error('FATAL', e); process.exit(1); });
