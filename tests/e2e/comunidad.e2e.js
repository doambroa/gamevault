// E2E de cuentas, comunidad, zona de préstamos y Créditos Finales sobre la versión web servida por PHP.
// Prepara un servidor de pruebas con: dist/web + api.php, una «creditos» falsa al lado (cuentas compartidas)
// y los datos de partida que se le pasen en GV_SEED (carpeta con c_*.json y pending.json).
//   GV_SEED=/ruta/datos node tests/e2e/comunidad.e2e.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), { spawn, execFileSync } = require('child_process');

const APP = path.join(__dirname, '../..');
const OUT = path.join(__dirname, 'shots-comunidad');
fs.mkdirSync(OUT, { recursive: true });
const SRV = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-srv-'));
const PORT = 8090 + Math.floor(Math.random() * 500);
const URL0 = `http://127.0.0.1:${PORT}/gamevault/`;
const results = [], errors = [];
let step = 0;
const CUR = {};
async function check(name, fn) {
  step++;
  try { await fn(); results.push(`✔ ${step}. ${name}`); }
  catch (e) { results.push(`✘ ${step}. ${name}\n     → ${e.message.split('\n')[0]}`); try { await CUR.page.screenshot({ path: path.join(OUT, `FAIL-${step}.png`) }); } catch {} }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assert'); };

// ── Servidor de pruebas ──────────────────────────────────────────────────────
fs.cpSync(path.join(APP, 'dist/web'), path.join(SRV, 'gamevault'), { recursive: true });
fs.mkdirSync(path.join(SRV, 'gamevault/data'), { recursive: true });
if (process.env.GV_SEED) for (const f of fs.readdirSync(process.env.GV_SEED)) fs.copyFileSync(path.join(process.env.GV_SEED, f), path.join(SRV, 'gamevault/data', f));
fs.mkdirSync(path.join(SRV, 'creditos/data'), { recursive: true });
fs.writeFileSync(path.join(SRV, 'creditos/api.php'), '<?php // Créditos Finales (simulada)');
execFileSync('php', ['-r', `
$h = password_hash('prueba1', PASSWORD_DEFAULT);
$u = []; foreach (['soiber'=>'soiber','daconstenla'=>'daconstenla','zlotny'=>'Zlotny'] as $k=>$d) $u[$k] = ['hash'=>$h,'display'=>$d,'created'=>'2026-10-31','public'=>false];
file_put_contents($argv[1].'/users.json', json_encode($u));
$g = ['version'=>1,'years'=>[
  '2025'=>['games'=>[['id'=>'a','title'=>'Metroid Dread','rating'=>5,'hours'=>11,'comment'=>'Una joya','date'=>'2025-03-02','song'=>['title'=>'Theme']]],'lists'=>['enCurso'=>[],'pendientes'=>[],'abandonados'=>[],'retomar'=>[]]],
  date('Y')=>['games'=>[['id'=>'b','title'=>'Super Mario Bros. Wonder','rating'=>4.5,'hours'=>14,'date'=>date('Y').'-01-10'],['id'=>'c','title'=>'Pikmin 4','rating'=>4,'hours'=>20,'date'=>date('Y').'-02-10']],'lists'=>['enCurso'=>[['title'=>'Sea of Stars']],'pendientes'=>[],'abandonados'=>[],'retomar'=>[]]]]];
file_put_contents($argv[1].'/u_soiber.json', json_encode($g));`, path.join(SRV, 'creditos/data')]);
const php = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SRV], { stdio: 'ignore' });
const server = file => JSON.parse(fs.readFileSync(path.join(SRV, 'gamevault/data', file), 'utf8'));

(async () => {
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const nuevo = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', ...opts });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|401|409|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    return page;
  };
  const entrar = async (page, user) => {
    await page.goto(URL0);
    await page.locator('.gv-gate').waitFor({ timeout: 20000 });
    await page.locator('.gv-gate input[autocomplete=username]').fill(user);
    await page.locator('.gv-gate input[type=password]').fill('prueba1');
    await page.locator('.gv-gate form button[type=submit]').click();
  };
  let page = await nuevo(); CUR.page = page;
  const shot = (n, p = page) => p.screenshot({ path: path.join(OUT, `${String(step).padStart(2, '0')}-${n}.png`) });

  await check('Web nueva: pantalla para entrar o crear cuenta (avisa de que es la de Créditos Finales)', async () => {
    await page.goto(URL0);
    await page.locator('.gv-gate').waitFor({ timeout: 20000 });
    await page.getByText(/misma cuenta que usas en/).waitFor();
    await shot('entrar');
  });
  await check('Entrar como soiber: se baja su colección (227 juegos) y el Inicio muestra Créditos Finales', async () => {
    await entrar(page, 'soiber');
    await page.getByRole('heading', { name: 'Inicio' }).waitFor({ timeout: 30000 });
    const n = await page.evaluate(() => window.api.io.counts());
    assert(n.juegos === 227, 'juegos: ' + JSON.stringify(n));
    await page.getByText(/en Créditos Finales/).waitFor({ timeout: 10000 });
    await page.locator('.dash-cf-nums').getByText('2').first().waitFor();
    await page.locator('.gv-accbtn').getByText('soiber').waitFor();
    await page.waitForTimeout(800);
    await shot('inicio');
  });
  await check('Juegos: carátulas grandes y la etiqueta «Terminado» sale en los que están en Créditos Finales', async () => {
    await page.locator('.nav-item', { hasText: 'Juegos' }).click();
    await page.locator('.gcard').first().waitFor();
    await page.getByPlaceholder('Nombre…').fill('metroid dread');
    await page.locator('.gcard', { hasText: 'Metroid Dread' }).locator('.gcard-tag-done').waitFor();
    await page.getByPlaceholder('Nombre…').fill('');
    await page.waitForTimeout(600);
    await shot('juegos');
  });
  await check('Ficha: bloque de Créditos Finales (nota, horas, comentario) y foto en grande', async () => {
    await page.getByPlaceholder('Nombre…').fill('metroid dread');
    await page.locator('.gcard', { hasText: 'Metroid Dread' }).first().click();
    const panel = page.locator('.jp-panel');
    await panel.locator('.jp-cf').getByText('Terminado en 2025').waitFor();
    await panel.getByText('Una joya').waitFor();
    await shot('ficha-cf');
    await panel.locator('.jp-main-img').click();
    await page.locator('.jp-lightbox').waitFor();
    await page.locator('.jp-lightbox').click();
    await panel.locator('.jp-close').click();
    await page.getByPlaceholder('Nombre…').fill('');
  });
  await check('Comunidad: la gente con su número de juegos; los de la tabla salen «sin cuenta»; el admin ve los enlaces', async () => {
    await page.locator('.nav-item', { hasText: 'Comunidad' }).click();
    await page.locator('.gv-person', { hasText: 'Andrés Vieira' }).getByText('sin cuenta').waitFor();
    await page.locator('.gv-admin').getByText('Perfiles por reclamar').waitFor();
    assert(await page.locator('.gv-admin-row').count() === 4, 'enlaces');
    await shot('comunidad');
  });
  await check('Colección de otra persona: solo lectura, con buscador', async () => {
    await page.locator('.gv-person', { hasText: 'Andrés Vieira' }).click();
    await page.getByPlaceholder(/Buscar en la colección de Andrés/).fill('pokemon');
    await page.waitForTimeout(300);
    const n = await page.locator('.gcard').count();
    assert(n >= 8, 'pokémon: ' + n);
    await page.locator('.gcard', { hasText: 'Metroid' }).count();
    await page.getByPlaceholder(/Buscar en la colección/).fill('metroid');
    await page.locator('.gcard').first().click();
    await page.locator('.gv-jl').getByText(/ahora lo tiene/).waitFor();
    assert(await page.locator('.gv-jl').getByRole('button', { name: /Editar|Prestar|Eliminar/ }).count() === 0, 'no debe poder tocar nada');
    await shot('perfil-ajeno');
    await page.keyboard.press('Escape');
  });
  await check('Zona de préstamos: cada juego una vez, con todas las personas que lo tienen y quién tiene el de quién', async () => {
    await page.locator('.nav-item', { hasText: 'Préstamos' }).click();
    await page.getByPlaceholder('¿Qué juego buscas?').fill('metroid');
    const md = page.locator('.lz-juego', { hasText: 'Metroid Dread' });
    await md.first().waitFor({ timeout: 15000 });
    assert(await md.count() === 1, 'Metroid Dread repetido: ' + await md.count());
    const t = await md.innerText();
    assert(/Andrés Vieira/.test(t) && /David Constenla/.test(t) && /Tú/.test(t) && /Mariña Vieira/.test(t), t.replace(/\n/g, ' | '));
    await page.locator('.lz-mios').getByText('Mario Party Superstars').waitFor();   // «Tengo de otros»
    await page.waitForTimeout(2500);
    const rotas = await page.locator('.lz-cover img, .lz-mios img').evaluateAll(is => is.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src));
    assert(rotas.length === 0, 'carátulas rotas: ' + rotas.slice(0, 3).join(' '));
    await shot('prestamos');
    await page.getByPlaceholder('¿Qué juego buscas?').fill('');
  });
  await check('«Préstamos en curso»: la tabla de quién tiene el juego de quién', async () => {
    await page.getByRole('button', { name: /Préstamos en curso/ }).click();
    const n = await page.locator('.lz-mov-row').count();
    assert(n === 10, 'préstamos: ' + n);   // 8 de Andrés + 1 de David + 1 tuyo (Wave Race)
    await shot('prestamos-en-curso');
    await page.getByRole('button', { name: /Quién tiene cada juego/ }).click();
  });
  await check('Pedir también a quien aún no tiene cuenta (Andrés): queda guardado para cuando se una', async () => {
    await page.getByPlaceholder('¿Qué juego buscas?').fill('hollow knight');
    const copia = page.locator('.lz-juego', { hasText: 'Hollow Knight' }).locator('.lz-copia', { hasText: 'Andrés Vieira' });
    await copia.getByRole('button', { name: /Pedir/ }).click();
    await page.locator('.modal-box').getByText(/Aún no tiene cuenta/).waitFor();
    await page.locator('.modal-box').getByRole('button', { name: /Pedírselo/ }).click();
    await copia.getByRole('button', { name: /Pedido/ }).waitFor({ timeout: 10000 });
    const r = JSON.parse(fs.readFileSync(path.join(SRV, 'gamevault/data/requests.json')));
    assert(r.some(x => x.to === '~andres-vieira' && x.from === 'soiber'), JSON.stringify(r));
    await shot('pedir-sin-cuenta');
  });
  await check('Prestar uno de mis juegos a Zlotny desde la zona de préstamos (se sube solo a la cuenta)', async () => {
    await page.getByPlaceholder('¿Qué juego buscas?').fill('pikmin 4');
    const copia = page.locator('.lz-juego', { hasText: 'Pikmin 4' }).locator('.lz-copia.mia');
    await copia.getByRole('button', { name: 'Prestar' }).click();
    const modal = page.locator('.modal-box');
    await modal.locator('.gv-pick-item', { hasText: 'Zlotny' }).click();
    await shot('prestar');
    await modal.getByRole('button', { name: /Marcar como prestado/ }).click();
    await page.locator('.lz-juego', { hasText: 'Pikmin 4' }).locator('.lz-copia.mia.fuera').waitFor({ timeout: 15000 });
    const pk = server('c_soiber.json').data.juegos.find(j => j.nombre === 'Pikmin 4');
    assert(pk.prestadoUsuario === 'zlotny' && pk.prestadoA === 'Zlotny', JSON.stringify(pk).slice(0, 200));
  });
  await check('Préstamos: vista de tabla y consolas plegables (sirve en las dos vistas)', async () => {
    await page.getByPlaceholder('¿Qué juego buscas?').fill('');
    await page.getByRole('button', { name: /^Tabla/ }).click();
    await page.locator('.lz-tabla').first().waitFor();
    await shot('prestamos-tabla');
    await page.getByRole('button', { name: /Plegar todo/ }).click();
    assert(await page.locator('.lz-tabla').count() === 0, 'la tabla sigue a la vista');
    await page.getByRole('button', { name: /Fichas/ }).click();
    assert(await page.locator('.lz-juego').count() === 0, 'las fichas no respetan el plegado');
    await shot('prestamos-plegado');
    await page.getByRole('button', { name: /Desplegar todo/ }).click();
    await page.locator('.lz-juego').first().waitFor();
  });
  await check('Botón a Créditos Finales en el menú', async () => {
    const href = await page.locator('a.nav-ext').getAttribute('href');
    assert(/\/creditos\/$/.test(href), href);
  });
  await check('Exportar PDF en la web: abre el catálogo listo para «Guardar como PDF»', async () => {
    await page.locator('.nav-item', { hasText: 'Inicio' }).click();
    const [pop] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('button', { name: /Exportar PDF/ }).click()]);
    await pop.getByText('Catálogo listo').waitFor({ timeout: 20000 });
    const n = await pop.locator('.pg').count();
    assert(n > 5, 'páginas: ' + n);
    await pop.screenshot({ path: path.join(OUT, 'pdf-web.png') });
    await pop.close();
  });
  await check('Estadísticas: cifras con terminados, consolas con parte verde y «año a año» por cuándo me los pasé', async () => {
    await page.locator('.nav-item', { hasText: 'Estadísticas' }).click();
    await page.locator('.st-kpi.green').getByText('3').waitFor();
    await page.getByRole('button', { name: 'Cuándo me los pasé' }).click();
    await page.locator('.st-year:not(.vacio)').first().click();
    await page.locator('.st-sel .gcard').first().waitFor();
    await shot('estadisticas');
  });

  // ── Otra persona: David reclama lo suyo ──
  const p2 = await nuevo(); CUR.page = p2;
  await check('daconstenla entra y le sale «¿Eres David Constenla?»; al aceptar, los 42 juegos pasan a ser suyos', async () => {
    await entrar(p2, 'daconstenla');
    await p2.getByRole('heading', { name: 'Inicio' }).or(p2.getByText('Empezar desde cero')).first().waitFor({ timeout: 30000 });
    await p2.locator('.gv-claim').getByText('¿Eres David Constenla?').waitFor({ timeout: 15000 });
    await shot('reclamar', p2);
    await p2.locator('.gv-claim').getByRole('button', { name: /Sí, son míos/ }).click();
    await p2.locator('.gcard').first().waitFor({ timeout: 30000 });
    const n = await p2.evaluate(() => window.api.io.counts());
    assert(n.juegos === 42, JSON.stringify(n));
    assert(!JSON.parse(fs.readFileSync(path.join(SRV, 'gamevault/data/pending.json'))).hasOwnProperty('~david-constenla'), 'sigue pendiente');
  });
  await check('David ve en «He prestado» su Mario Party Superstars que tiene soiber', async () => {
    await p2.locator('.nav-item', { hasText: 'Préstamos' }).click();
    await p2.locator('.lz-mios').getByText('Mario Party Superstars').waitFor({ timeout: 15000 });
    await shot('prestamos-david', p2);
  });
  await check('Enlace de reclamar (Andrés) con código erróneo → no deja', async () => {
    await p2.goto(URL0 + '#/reclamar/andres-vieira/codigo-malo');
    await p2.getByText('El enlace no es válido').waitFor({ timeout: 15000 });
  });
  await check('Enlace de reclamar bueno: muestra a quién corresponde', async () => {
    const code = JSON.parse(fs.readFileSync(path.join(SRV, 'gamevault/data/pending.json')))['~andres-vieira'].code;
    await p2.goto(URL0 + '#/reclamar/andres-vieira/' + code);
    await p2.locator('.gv-claim-who').getByText('Andrés Vieira').waitFor({ timeout: 15000 });
    await shot('enlace-reclamar', p2);
  });

  // ── Zlotny ve lo que le han dejado, en el móvil y con el tema claro del sistema ──
  const p3 = await nuevo({ viewport: { width: 390, height: 844 }, colorScheme: 'light', deviceScaleFactor: 2, isMobile: true, hasTouch: true }); CUR.page = p3;
  await check('Móvil con tema claro del sistema: la app sale en claro sin tocar nada', async () => {
    await entrar(p3, 'zlotny');
    await p3.getByText('Empezar desde cero').or(p3.getByRole('heading', { name: 'Inicio' })).first().waitFor({ timeout: 30000 });
    assert(await p3.evaluate(() => document.documentElement.dataset.theme) === 'light', 'tema');
  });
  await check('Zlotny (sin colección) ve en Préstamos «Tengo de otros: Pikmin 4 de soiber»', async () => {
    await p3.getByRole('button', { name: /ver lo que tienen mis colegas/ }).click();
    await p3.locator('.lz-mios').getByText('Pikmin 4').waitFor({ timeout: 20000 });
    await shot('movil-prestamos', p3);
  });
  await check('Pedir: Zlotny pide a David «Super Mario RPG» desde la ficha del juego en Préstamos', async () => {
    await p3.getByPlaceholder('¿Qué juego buscas?').fill('super mario rpg');
    const copia = p3.locator('.lz-juego', { hasText: 'Super Mario RPG' }).locator('.lz-copia', { hasText: 'daconstenla' });
    await copia.getByRole('button', { name: /Pedir/ }).click();
    const modal = p3.locator('.modal-box');
    await modal.locator('textarea').fill('¿Me lo dejas el finde?');
    await shot('pedir', p3);
    await modal.getByRole('button', { name: /Pedírselo/ }).click();
    await copia.getByRole('button', { name: /Pedido/ }).waitFor({ timeout: 10000 });
    await p3.locator('.lz-pet').getByText('esperando respuesta').waitFor();
    const r = JSON.parse(fs.readFileSync(path.join(SRV, 'gamevault/data/requests.json')));
    assert(r.some(x => x.from === 'zlotny' && x.to === 'daconstenla' && x.nombre === 'Super Mario RPG'), JSON.stringify(r));
  });
  await check('David ve «Te piden» (con aviso en el menú) y al prestárselo queda apuntado en su colección', async () => {
    CUR.page = p2;
    await p2.reload();
    await p2.locator('.nav-item', { hasText: 'Préstamos' }).locator('.nav-badge').getByText('1').waitFor({ timeout: 20000 });
    await shot('aviso-menu', p2);
    await p2.locator('.nav-item', { hasText: 'Préstamos' }).click();
    await p2.locator('.lz-pet.recibidas, .lz-pet-col.recibidas').getByText('¿Me lo dejas el finde?').waitFor({ timeout: 20000 });
    await shot('te-piden', p2);
    await p2.getByRole('button', { name: /Prestárselo/ }).click();
    await p2.locator('.lz-pet-col.recibidas').waitFor({ state: 'detached', timeout: 15000 });
    const j = server('c_daconstenla.json').data.juegos.find(x => x.nombre === 'Super Mario RPG');
    assert(j.prestadoUsuario === 'zlotny', JSON.stringify(j).slice(0, 200));
    CUR.page = p3;
  });
  await check('A Zlotny le sale «¡te lo deja!» y el juego en «Tengo de otros»', async () => {
    await p3.reload();
    await p3.locator('.lz-pet').getByText('¡te lo deja!').waitFor({ timeout: 20000 });
    await p3.locator('.lz-mios').getByText('Super Mario RPG').waitFor();
  });

  // ── Sincronización: un cambio en una pestaña llega a la cuenta ──
  CUR.page = page;
  await check('Tamaño del texto en la web (zoom 125 %): la app sigue encajando en la ventana', async () => {
    await page.locator('.sidebar-footer').getByText('Ajustes').click();
    await page.locator('.modal-box').getByRole('button', { name: 'Más grande' }).click();
    await page.keyboard.press('Escape');
    await page.locator('.nav-item', { hasText: 'Estadísticas' }).click();
    await page.locator('.st-kpi').first().waitFor();
    const m = await page.evaluate(() => { const r = document.querySelector('.shell').getBoundingClientRect(); return { h: r.height, w: r.width, ih: innerHeight, iw: innerWidth, sh: document.documentElement.scrollHeight, z: document.documentElement.style.zoom }; });
    assert(m.z === '1.25' && Math.abs(m.h - m.ih) < 3 && Math.abs(m.w - m.iw) < 3, JSON.stringify(m));
    await shot('texto-grande-web');
    await page.locator('.sidebar-footer').getByText('Ajustes').click();
    await page.locator('.modal-box').getByRole('button', { name: 'Automático' }).click();
    await page.keyboard.press('Escape');
  });
  await check('Sincronización: crear un juego en la web lo sube a la cuenta en unos segundos', async () => {
    const rev0 = server('c_soiber.json').rev;
    await page.evaluate(async () => { const ps = await window.api.plataformas.getAll(); await window.api.juegos.create({ plataformaId: ps[0].id, nombre: 'Juego de prueba sync' }); });
    for (let i = 0; i < 40 && server('c_soiber.json').rev === rev0; i++) await page.waitForTimeout(300);
    const c = server('c_soiber.json');
    assert(c.rev > rev0 && c.data.juegos.some(j => j.nombre === 'Juego de prueba sync'), 'no subió');
  });
  await check('Conflicto: si otro dispositivo guardó mientras aquí había cambios, pregunta cuál conservar', async () => {
    const f = path.join(SRV, 'gamevault/data/c_soiber.json');
    const c = server('c_soiber.json'); c.rev += 5; c.device = 'Windows'; fs.writeFileSync(f, JSON.stringify(c));
    await page.evaluate(async () => { const ps = await window.api.plataformas.getAll(); await window.api.juegos.create({ plataformaId: ps[0].id, nombre: 'Otro juego' }); });
    await page.getByText('¿Qué colección te quedas?').waitFor({ timeout: 20000 });
    await shot('conflicto');
    await page.getByRole('button', { name: /La de este dispositivo/ }).click();
    await page.getByText('¿Qué colección te quedas?').waitFor({ state: 'hidden', timeout: 15000 });
    assert(server('c_soiber.json').data.juegos.some(j => j.nombre === 'Otro juego'), 'no se subió la de este dispositivo');
  });

  await browser.close();
  php.kill();
  console.log(results.join('\n'));
  console.log('\nErrores de consola/JS:', errors.length ? '\n  ' + [...new Set(errors)].join('\n  ') : 'ninguno');
  process.exit(0);
})().catch(e => { console.log(results.join('\n')); console.error('FATAL', e); php.kill(); process.exit(1); });
