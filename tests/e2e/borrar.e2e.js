// E2E: borrar consolas y juegos en la versión web con cuenta (lo que se da de alta se puede borrar y no vuelve).
//   GV_SEED=/ruta/datos node tests/e2e/borrar.e2e.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), { spawn, execFileSync } = require('child_process');
const APP = path.join(__dirname, '../..');
const OUT = path.join(__dirname, 'shots-borrar'); fs.mkdirSync(OUT, { recursive: true });
const SRV = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-borrar-'));
const PORT = 8900 + Math.floor(Math.random() * 300);
const URL0 = `http://127.0.0.1:${PORT}/gamevault/`;
const results = [], errors = []; let step = 0; const CUR = {};
async function check(name, fn) { step++; try { await fn(); results.push(`✔ ${step}. ${name}`); } catch (e) { results.push(`✘ ${step}. ${name}\n     → ${e.message.split('\n')[0]}`); try { await CUR.page.screenshot({ path: path.join(OUT, `FAIL-${step}.png`) }); } catch {} } }
const assert = (c, m) => { if (!c) throw new Error(m || 'assert'); };
fs.cpSync(path.join(APP, 'dist/web'), path.join(SRV, 'gamevault'), { recursive: true });
fs.mkdirSync(path.join(SRV, 'gamevault/data'), { recursive: true });
if (process.env.GV_SEED) for (const f of fs.readdirSync(process.env.GV_SEED)) fs.copyFileSync(path.join(process.env.GV_SEED, f), path.join(SRV, 'gamevault/data', f));
fs.mkdirSync(path.join(SRV, 'creditos/data'), { recursive: true });
fs.writeFileSync(path.join(SRV, 'creditos/api.php'), '<?php');
execFileSync('php', ['-r', `$h=password_hash('prueba1',PASSWORD_DEFAULT); file_put_contents($argv[1].'/users.json', json_encode(['soiber'=>['hash'=>$h,'display'=>'soiber','created'=>'2026-10-31','public'=>false]]));`, path.join(SRV, 'creditos/data')]);
const php = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SRV], { stdio: 'ignore' });
const server = () => JSON.parse(fs.readFileSync(path.join(SRV, 'gamevault/data/c_soiber.json'), 'utf8'));
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const page = await ctx.newPage(); CUR.page = page;
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|401|409|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const shot = n => page.screenshot({ path: path.join(OUT, `${String(step).padStart(2, '0')}-${n}.png`) });
  const counts = () => page.evaluate(() => window.api.io.counts());
  const subido = async () => { for (let i = 0; i < 40; i++) { if (!JSON.parse(await page.evaluate(() => localStorage.getItem('gv-sync') || '{}')).dirty) return; await page.waitForTimeout(400); } throw new Error('no se subió'); };

  await page.goto(URL0);
  await page.locator('.gv-gate input[autocomplete=username]').fill('soiber');
  await page.locator('.gv-gate input[type=password]').fill('prueba1');
  await page.locator('.gv-gate form button[type=submit]').click();
  await page.getByRole('heading', { name: 'Inicio' }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.getByRole('heading', { name: 'Inicio' }).waitFor({ timeout: 30000 });
  const c0 = await counts();

  await page.locator('.theme-hint button', { hasText: 'Entendido' }).click().catch(() => {});
  await check('Añadir una consola nueva (Xbox) y borrarla desde su ficha', async () => {
    await page.getByRole('button', { name: 'Consolas', exact: true }).click();
    await page.getByRole('button', { name: /Nueva plataforma/ }).click();
    const m = page.locator('.modal-box');
    await m.locator('.ob-consola', { has: page.locator('.ob-consola-nombre', { hasText: /^Xbox$/ }) }).click();
    await m.getByRole('button', { name: 'Añadir 1 consola' }).click();
    await m.waitFor({ state: 'detached' });
    await page.locator('.plat-name', { hasText: /^Xbox$/ }).click();
    await page.getByRole('button', { name: /Eliminar consola/ }).click();
    await shot('confirmar-consola');
    await page.locator('.modal-box').getByRole('button', { name: /Eliminar|Sí|Borrar/ }).last().click();
    await page.waitForTimeout(800);
    const l = await page.evaluate(() => window.api.plataformas.getAll());
    assert(!l.some(p => p.nombre === 'Xbox'), 'sigue la Xbox');
  });
  await check('Formulario: «Formato» Físico / Digital a la vista; un juego digital se guarda como tal', async () => {
    await page.getByRole('button', { name: 'Juegos', exact: true }).click();
    await page.getByRole('button', { name: /Nuevo juego/ }).click();
    const m = page.locator('.modal-box');
    await m.locator('select').first().selectOption({ index: 1 });
    await m.getByPlaceholder('Escribe el nombre del juego…').fill('Juego para borrar');
    const f = m.locator('.jf-formato');
    assert(await f.getByRole('radio', { name: 'Físico' }).getAttribute('aria-checked') === 'true', 'por defecto físico');
    await m.getByText('Estado', { exact: true }).waitFor();
    await f.getByRole('radio', { name: 'Digital' }).click();
    assert(await m.getByText('Estado', { exact: true }).count() === 0, 'en digital no pide estado');
    assert(await f.getByRole('radio', { name: 'Digital' }).getAttribute('aria-checked') === 'true', 'digital marcado');
    await page.mouse.move(10, 10);
    await page.waitForTimeout(300);
    await shot('formato-digital');
    await m.getByRole('button', { name: /Crear|Guardar|Añadir/ }).last().click();
    await m.waitFor({ state: 'detached' });
    const j = (await page.evaluate(() => window.api.juegos.getAll({}))).find(x => x.nombre === 'Juego para borrar');
    assert(j && j.estado === 'Digital', JSON.stringify(j && j.estado));
  });
  await check('Tabla: la columna de borrar se ve sin desplazarse y borra el juego', async () => {
    await page.getByRole('button', { name: 'Tabla' }).click();
    await page.getByPlaceholder('Nombre…').fill('Juego para borrar');
    await page.waitForTimeout(500);
    const b = page.locator('tr', { hasText: 'Juego para borrar' }).getByTitle('Eliminar');
    const box = await b.boundingBox();
    assert(box && box.x + box.width <= 1440, 'fuera de la pantalla: ' + JSON.stringify(box));
    await shot('tabla');
    await b.click();
    await page.locator('.modal-box').getByText('«Juego para borrar»').waitFor();
    await page.locator('.modal-box').getByRole('button', { name: /Eliminar|Sí|Borrar/ }).last().click();
    await page.waitForTimeout(800);
    const l = await page.evaluate(() => window.api.juegos.getAll({}));
    assert(!l.some(j => j.nombre === 'Juego para borrar'), 'sigue el juego');
  });
  await check('Ficha del juego: botón «Eliminar» junto a «Editar»', async () => {
    const l0 = await page.evaluate(() => window.api.juegos.getAll({}));
    await page.getByPlaceholder('Nombre…').fill(l0[0].nombre);
    await page.waitForTimeout(500);
    await page.locator('tr', { hasText: l0[0].nombre }).first().locator('.td-name').click();
    await page.locator('.jp-header-actions').getByRole('button', { name: 'Eliminar' }).click();
    await page.locator('.modal-box').getByRole('button', { name: /Eliminar|Sí|Borrar/ }).last().click();
    await page.waitForTimeout(800);
    const l = await page.evaluate(() => window.api.juegos.getAll({}));
    assert(l.length === l0.length - 1 && !l.some(x => x.id === l0[0].id), `${l0.length} → ${l.length}`);
    CUR.borrado = l0[0].id;
  });
  await check('Consola con juegos: se borra desde su tarjeta (icono de la papelera) con sus juegos', async () => {
    await page.getByRole('button', { name: 'Consolas', exact: true }).click();
    const pl = (await page.evaluate(() => window.api.plataformas.getAll())).find(p => p.numJuegos > 0 && p.numJuegos < 6);
    CUR.platBorrada = pl;
    const card = page.locator('.plat-card', { has: page.locator('.plat-name', { hasText: new RegExp('^' + pl.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) });
    await card.hover();
    await card.getByTitle('Eliminar consola').click();
    await page.locator('.modal-box').getByRole('button', { name: /Eliminar|Sí|Borrar/ }).last().click();
    await page.waitForTimeout(800);
    const l = await page.evaluate(() => window.api.plataformas.getAll());
    assert(!l.some(p => p.id === pl.id), 'sigue la consola');
  });
  await check('Se sube al servidor y al recargar no vuelven', async () => {
    await subido();
    const s = server();
    const siguen = [s.data.plataformas.some(p => p.nombre === 'Xbox') && 'Xbox', s.data.juegos.some(j => j.nombre === 'Juego para borrar') && 'juego nuevo', s.data.juegos.some(j => j.id === CUR.borrado) && 'juego viejo',
      s.data.plataformas.some(p => p.id === CUR.platBorrada.id) && 'consola con juegos', s.data.juegos.some(j => j.plataformaId === CUR.platBorrada.id) && 'juegos de esa consola'].filter(Boolean);
    assert(!siguen.length, 'en el servidor siguen: ' + siguen.join(', ') + ' · rev ' + s.rev + ' · ' + await page.evaluate(() => localStorage.getItem('gv-sync')));
    await page.reload(); await page.getByRole('heading').first().waitFor({ timeout: 30000 }); await page.waitForTimeout(3000);
    const c = await counts();
    assert(c.juegos === c0.juegos - 1 - CUR.platBorrada.numJuegos && c.plataformas === c0.plataformas - 1, JSON.stringify([c0, c, CUR.platBorrada.numJuegos]));
  });
  console.log(results.join('\n'));
  console.log('\nErrores de consola/JS:', errors.length ? '\n  ' + [...new Set(errors)].join('\n  ') : 'ninguno');
  await browser.close(); php.kill(); process.exit(0);
})().catch(e => { console.log(results.join('\n')); console.error('FATAL', e); php.kill(); process.exit(1); });
