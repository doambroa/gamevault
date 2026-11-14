// E2E de accesorios en la app de escritorio (Electron).
//   xvfb-run -a node tests/e2e/accesorios.e2e.js      (necesita playwright y `npm run build`)
const { _electron: electron } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const APP = path.join(__dirname, '../..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-acc-'));
const OUT = path.join(os.tmpdir(), 'gv-acc-shots'); fs.mkdirSync(OUT, { recursive: true });
const results = []; const errors = []; let step = 0; let page;
const assert = (c, m) => { if (!c) throw new Error(m || 'assert'); };
async function check(name, fn) {
  step++;
  try { await fn(); results.push(`✔ ${step}. ${name}`); }
  catch (e) { results.push(`✘ ${step}. ${name}\n     → ${e.message.split('\n')[0]}`); try { await page.screenshot({ path: path.join(OUT, `FAIL-${step}.png`) }); } catch {} }
}
const shot = n => page.screenshot({ path: path.join(OUT, `${String(step).padStart(2, '0')}-${n}.png`) });

(async () => {
  const app = await electron.launch({
    executablePath: path.join(APP, 'node_modules/electron/dist/electron'), args: [APP, '--no-sandbox'],
    env: { ...process.env, GV_PROD: '1', GV_DATA_DIR: DATA, GV_FAKE_HTTP: path.join(APP, 'tests/fakeHttp.js') },
  });
  page = await app.firstWindow();
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1366, height: 860 }).catch(() => {});

  await check('Crear la consola Wii desde el asistente', async () => {
    await page.getByText('Empezar desde cero').click();
    await page.locator('.ob-consola').filter({ has: page.locator('.ob-consola-nombre', { hasText: /^Wii$/ }) }).click();
    await page.getByRole('button', { name: /Añadir 1 consola/ }).click();
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 15000 });
  });
  await check('El detalle de la consola tiene la sección «Accesorios», vacía', async () => {
    await page.locator('.nav-item', { hasText: 'Plataformas' }).click();
    await page.locator('.plat-card', { hasText: 'Wii' }).first().click();
    await page.locator('.acc-section').getByText('Accesorios (0)').waitFor({ timeout: 8000 });
    await page.locator('.acc-vacio').waitFor();
  });
  await check('Añadir «Disco de limpieza» (tipo Limpieza) y un mando ×4 con precio', async () => {
    const sec = page.locator('.acc-section');
    await sec.getByRole('button', { name: /Añadir accesorio/ }).click();
    const m = page.locator('.modal-box');
    await m.getByRole('button', { name: 'Añadir' }).click();
    await m.getByText('Ponle un nombre').waitFor();                     // validación
    await m.getByPlaceholder(/Mando oficial/).fill('Disco de limpieza');
    await m.locator('select').first().selectOption('Limpieza');
    await m.getByRole('button', { name: 'Añadir' }).click();
    await sec.getByText('Accesorios (1)').waitFor();
    await sec.getByRole('button', { name: /Añadir accesorio/ }).click();
    await m.getByPlaceholder(/Mando oficial/).fill('Wii Remote');
    await m.locator('select').first().selectOption('Mando');
    await m.locator('input[type=number]').first().fill('4');
    await m.locator('input[type=number]').nth(1).fill('25');
    await m.getByRole('button', { name: 'Añadir' }).click();
    await sec.getByText('Accesorios (2 · 5 unidades)').waitFor();
    await sec.locator('.acc-card', { hasText: 'Wii Remote' }).getByText('×4').waitFor();
    await sec.locator('.acc-card', { hasText: 'Wii Remote' }).getByText('25.00 €').waitFor();
    await shot('accesorios');
  });
  await check('Editar: comentario en el disco de limpieza', async () => {
    await page.locator('.acc-card', { hasText: 'Disco de limpieza' }).click();
    const m = page.locator('.modal-box');
    await m.getByRole('heading', { name: 'Editar accesorio' }).waitFor();
    await m.locator('textarea').fill('Con su caja original');
    await m.getByRole('button', { name: 'Guardar' }).click();
    await page.locator('.acc-card', { hasText: 'Disco de limpieza' }).getByText('Con su caja original').waitFor();
  });
  await check('La tarjeta de la consola muestra «2 accesorios»', async () => {
    await page.locator('.nav-item', { hasText: 'Plataformas' }).click();
    await page.locator('.plat-card', { hasText: 'Wii' }).getByText('2 accesorios').waitFor({ timeout: 8000 });
  });
  await check('Tema claro: la sección se ve bien', async () => {
    await page.locator('.plat-card', { hasText: 'Wii' }).first().click();
    await page.locator('.titlebar .theme-icon').click(); await page.waitForTimeout(600);
    await shot('accesorios-claro');
    await page.locator('.titlebar .theme-icon').click(); await page.waitForTimeout(400);
  });
  await check('Eliminar un accesorio con confirmación', async () => {
    await page.locator('.acc-card', { hasText: 'Wii Remote' }).getByRole('button', { name: 'Eliminar accesorio' }).click();
    await page.locator('.modal-box').getByText('¿Eliminar «Wii Remote»?').waitFor();
    await page.locator('.modal-box').getByRole('button', { name: 'Eliminar' }).click();
    await page.locator('.acc-section').getByText('Accesorios (1)').waitFor();
  });
  await check('Recuento de accesorios en la base de datos', async () => {
    const n = await page.evaluate(() => window.api.io.counts());
    assert(n.accesorios === 1 && n.plataformas === 1, JSON.stringify(n));
  });
  console.log(results.join('\n'));
  console.log('Errores JS:', errors.length ? errors.join(' | ') : 'ninguno');
  console.log('Capturas en', OUT);
  await app.close();
  process.exit(results.some(r => r.startsWith('✘')) ? 1 : 0);
})().catch(e => { console.log(results.join('\n')); console.error('FATAL', e); process.exit(1); });
