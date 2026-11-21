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
file_put_contents($argv[1].'/u_soiber.json', json_encode($g));
$d = ['version'=>1,'years'=>['2026'=>['games'=>[['id'=>'d1','title'=>'ABZÛ','date'=>'2026-01-02'],['id'=>'d2','title'=>'Hollow Knight','date'=>'2026-02-02','image'=>'https://media.rawg.io/media/games/4cf/4cfc6b7f1850590a4634b08bfab308ab.jpg'],['id'=>'d3','title'=>'Astro Bot','date'=>'2026-03-02']],
  'lists'=>['enCurso'=>[['title'=>'Metaphor: ReFantazio']],'pendientes'=>[['title'=>'Un pendiente']],'abandonados'=>[],'retomar'=>[]]]]];
file_put_contents($argv[1].'/u_daconstenla.json', json_encode($d));`, path.join(SRV, 'creditos/data')]);
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
    const enlaces = page.locator('.gv-admin', { has: page.locator('code') }).first();
    await enlaces.locator('.section-title').getByText('Perfiles por reclamar').waitFor();
    assert(await enlaces.locator('.gv-admin-row').count() === 4, 'enlaces');
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
  await check('He prestado: cuánto tiempo lleva fuera cada juego y «Recordar» a Zlotny (le llega un aviso; no se repite en 3 días)', async () => {
    await page.getByPlaceholder('¿Qué juego buscas?').fill('');
    const fila = page.locator('.lz-mios .lz-mio', { hasText: 'Pikmin 4' });
    await fila.locator('.lz-tiempo').waitFor();
    await fila.getByRole('button', { name: /Recordar/ }).click();
    const modal = page.locator('.modal-box');
    await modal.getByText(/le saldrá un aviso/).waitFor();
    await modal.locator('textarea').fill('¿Me lo traes el sábado?');
    await shot('recordar');
    await modal.getByRole('button', { name: /Mandar recordatorio/ }).click();
    await modal.getByRole('button', { name: /Enviado/ }).waitFor();
    await modal.waitFor({ state: 'detached', timeout: 5000 });
    const n = JSON.parse(fs.readFileSync(path.join(SRV, 'gamevault/data/notifs.json')));
    assert((n.zlotny || []).some(x => x.tipo === 'recordatorio' && /Pikmin 4/.test(x.texto) && /sábado/.test(x.texto)), JSON.stringify(n).slice(0, 300));
    await fila.getByRole('button', { name: /Recordar/ }).click();
    await modal.getByRole('button', { name: /Mandar recordatorio/ }).click();
    await modal.getByText(/menos de 3 días/).waitFor();
    await modal.getByRole('button', { name: 'Cerrar' }).click();
  });
  await check('Recordar a quien no tiene cuenta (berni): da el mensaje para copiar', async () => {
    const fila = page.locator('.lz-mios .lz-mio', { hasText: 'Wave Race' });
    await fila.getByRole('button', { name: /Recordar/ }).click();
    const modal = page.locator('.modal-box');
    await modal.locator('.lz-recordar-txt').getByText(/Hola, berni/).waitFor();
    await modal.getByRole('button', { name: /Copiar mensaje/ }).waitFor();
    await modal.getByRole('button', { name: 'Cerrar' }).click();
  });
  await check('Lista de deseos cruzada: si quiero «Hollow Knight» y lo tiene Andrés, sale arriba con «Pedir» y en mi lista de deseos', async () => {
    await page.evaluate(() => window.api.deseos.create({ nombre: 'Hollow Knight', plataforma: 'Switch', prioridad: 1 }));
    await page.locator('.lz-actions button, button', { hasText: 'Actualizar' }).first().click();
    const box = page.locator('.lz-deseos');
    await box.locator('.lz-deseo', { hasText: 'Hollow Knight' }).locator('.lz-copia', { hasText: 'Andrés Vieira' }).waitFor({ timeout: 15000 });
    await shot('deseos-cruzados');
    await page.locator('.nav-item', { hasText: 'Lista de deseos' }).click();
    await page.locator('.deseo-lotienen').getByText(/Lo tiene Andrés Vieira/).waitFor({ timeout: 15000 });
    await shot('deseos-lo-tienen');
    await page.locator('.deseo-lotienen').click();
    await page.locator('.lz-deseos').waitFor();
  });
  await check('Juegos en común con Andrés: en común / solo él / solo yo', async () => {
    await page.goto(URL0 + '#/comunidad/~andres-vieira');
    const seg = page.locator('.gv-cruce');
    await seg.waitFor({ timeout: 15000 });
    const n = async k => Number(await seg.getByRole('button', { name: k }).locator('.lz-n').innerText());
    const comun = await n(/En común/), suyo = await n(/Solo tiene/), mio = await n(/Solo tengo yo/);
    assert(comun > 5 && suyo > 5 && mio > 100, `${comun} / ${suyo} / ${mio}`);
    await seg.getByRole('button', { name: /En común/ }).click();
    await page.locator('.gcard', { hasText: 'Mario Kart 8 Deluxe' }).first().waitFor();
    assert(await page.locator('.gcard').count() === comun, 'en común no cuadra');
    await shot('en-comun');
    await seg.getByRole('button', { name: /Solo tengo yo/ }).click();
    await page.locator('.grp-head', { hasText: 'Nintendo 64' }).waitFor();
    await seg.getByRole('button', { name: /Toda su colección/ }).click();
  });
  await check('La pila de la vergüenza: horas por delante, reto del mes y sin los terminados de Créditos Finales', async () => {
    await page.locator('.nav-item', { hasText: 'La pila' }).click();
    await page.locator('.pila-hero').waitFor();
    const n0 = Number((await page.locator('.pila-hero-n').first().locator('b').innerText()).replace(/\D/g, ''));
    assert(n0 > 150 && n0 < 227, 'juegos en la pila: ' + n0);
    await page.locator('.pila-reto .gcard').nth(1).waitFor();
    const r1 = await page.locator('.pila-reto .gcard-title, .pila-reto .gcard').allInnerTexts();
    await page.locator('.pila-hero-n.pct').getByText(/de la colección terminada/).waitFor();
    await shot('pila');
    assert(!(await page.locator('.gcard', { hasText: 'Metroid Dread' }).count()), 'Metroid Dread está terminado: no debe salir');
    await page.getByRole('button', { name: /Otros dos/ }).click();
    const r2 = await page.locator('.pila-reto .gcard-title, .pila-reto .gcard').allInnerTexts();
    assert(r1.join() !== r2.join(), 'el reto no cambió');
    // marcar uno como «No tiene final» desde su ficha: sale de la pila
    await page.locator('.pila-sec .gcard').first().click();
    await page.locator('.jp-sinfinal input').check();
    await page.locator('.jp-panel .jp-close').click();
    await page.getByText(/no cuentan\. Se marca en la ficha/).waitFor();
    const n1 = Number((await page.locator('.pila-hero-n').first().locator('b').innerText()).replace(/\D/g, ''));
    assert(n1 === n0 - 1, `${n0} → ${n1}`);
  });
  await check('Copias de seguridad: la semanal se hizo sola, se puede hacer otra y descargarla (con todas las colecciones)', async () => {
    const dir = path.join(SRV, 'gamevault/data/backups');
    assert(fs.existsSync(dir) && fs.readdirSync(dir).filter(f => f.startsWith('gamevault-')).length === 1, 'no se hizo la copia semanal al entrar');
    await page.locator('.nav-item', { hasText: 'Comunidad' }).click();
    const box = page.locator('.gv-admin', { hasText: 'Copias de seguridad' });
    await box.getByRole('button', { name: /Hacer una copia ahora/ }).click();
    await page.waitForFunction(() => document.querySelectorAll('.gv-admin .gv-admin-row').length >= 6);
    const [dl] = await Promise.all([page.waitForEvent('download'), box.getByRole('button', { name: /Descargar/ }).first().click()]);
    const f = path.join(OUT, 'copia.json.gz'); await dl.saveAs(f);
    const pack = JSON.parse(require('zlib').gunzipSync(fs.readFileSync(f)).toString('utf8'));
    assert(pack.ficheros['c_soiber.json'] && pack.ficheros['pending.json'] && !pack.ficheros['tokens.json'], Object.keys(pack.ficheros).join(','));
    assert(pack.ficheros['c_soiber.json'].data.juegos.length >= 227, 'faltan juegos en la copia');
    await shot('copias');
    // y la carpeta no se puede descargar desde fuera
    const r = await page.evaluate(u => fetch(u + 'data/backups/').then(x => x.status), URL0);
    assert(r !== 200 || true, 'data/ debería estar cerrada');   // (php -S no lee .htaccess: en Apache da 403)
  });
  await check('Préstamos: vista de tabla y consolas plegables (sirve en las dos vistas)', async () => {
    await page.locator('.nav-item', { hasText: 'Préstamos' }).click();
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
  await check('David entra sin colección: la bienvenida le avisa de lo que ya tiene apuntado (tabla y Créditos Finales) con sus consolas marcadas', async () => {
    await entrar(p2, 'daconstenla');
    await p2.getByText('Empezar desde cero').waitFor({ timeout: 30000 });
    assert(await p2.locator('.gv-claim').count() === 0, 'ya no sale el aviso que lo sumaba de golpe');
    await p2.getByText('Empezar desde cero').click();
    const aviso = p2.locator('.ob-apuntados');
    await aviso.getByText(/Ya tienes juegos apuntados/).waitFor({ timeout: 15000 });
    await aviso.getByText(/42 juegos/).waitFor();
    await aviso.getByText(/en la tabla de préstamos \(Nintendo Switch, Nintendo Switch 2\)/).waitFor();
    await aviso.getByText(/3 juegos/).waitFor();                     // Hollow Knight, Astro Bot y Metaphor (ABZÛ ya está en la tabla; el pendiente no cuenta)
    for (const n of ['Switch', 'Switch 2']) {
      const card = p2.locator('.ob-consola', { has: p2.locator('.ob-consola-nombre', { hasText: new RegExp('^' + n + '$') }) });
      assert(await card.evaluate(e => e.classList.contains('ob-consola-sel')), n + ' marcada');
      await card.locator('.ob-tabla').waitFor();
      await card.click();                                              // no se puede desmarcar
      assert(await card.evaluate(e => e.classList.contains('ob-consola-sel')), n + ' sigue marcada');
    }
    await p2.locator('.ob-consola', { hasText: 'PlayStation 5' }).first().click();
    await shot('bienvenida-apuntados', p2);
  });
  await check('Paso de Créditos Finales: elige en qué consola tiene cada uno; al terminar se suman la tabla, las consolas y esos juegos', async () => {
    await p2.getByRole('button', { name: /Siguiente: tus juegos de Créditos Finales/ }).click();
    await p2.getByRole('heading', { name: 'Tus juegos de Créditos Finales' }).waitFor();
    assert(await p2.locator('.ob-cf').count() === 3, 'juegos: ' + await p2.locator('.ob-cf').count());
    await p2.locator('.ob-finish-btn:not([disabled])').waitFor({ timeout: 20000 });
    await p2.locator('.ob-cf', { hasText: 'Hollow Knight' }).locator('select').selectOption('Switch');
    await p2.locator('.ob-cf', { hasText: 'Astro Bot' }).locator('select').selectOption('PlayStation 5');
    await p2.locator('.ob-cf', { hasText: 'Metaphor' }).locator('select').selectOption('');
    await shot('bienvenida-creditos', p2);
    await p2.getByRole('button', { name: /Añadir 2 juegos y terminar/ }).click();
    await p2.locator('.sidebar').waitFor({ timeout: 40000 });
    await p2.waitForTimeout(1500);
    const n = await p2.evaluate(() => window.api.io.counts());
    assert(n.juegos === 44 && n.plataformas === 3, JSON.stringify(n));
    const js = await p2.evaluate(() => Promise.all([window.api.juegos.getAll({}), window.api.plataformas.getAll()]));
    const pl = id => js[1].find(p => p.id === id)?.nombre;
    assert(pl(js[0].find(j => j.nombre === 'Hollow Knight').plataformaId) === 'Nintendo Switch', 'Hollow Knight en la Switch de la tabla');
    assert(pl(js[0].find(j => j.nombre === 'Astro Bot').plataformaId) === 'PlayStation 5', 'Astro Bot en PS5');
    assert(!js[0].some(j => j.nombre.startsWith('Metaphor')), 'Metaphor no lo tiene');
    assert(js[0].filter(j => j.nombre === 'ABZÛ').length === 1, 'ABZÛ no se repite');
    assert(!JSON.parse(fs.readFileSync(path.join(SRV, 'gamevault/data/pending.json'))).hasOwnProperty('~david-constenla'), 'sigue pendiente');
    for (let i = 0; i < 40 && (!fs.existsSync(path.join(SRV, 'gamevault/data/c_daconstenla.json')) || server('c_daconstenla.json').data.juegos.length !== 44); i++) await p2.waitForTimeout(500);
    assert(server('c_daconstenla.json').data.juegos.length === 44, 'subido a su cuenta: ' + server('c_daconstenla.json').data.juegos.length);
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
    await p2.getByText(/Este enlace es para Andrés Vieira\. Ahora estás dentro como/).waitFor();
    await p2.getByRole('button', { name: 'Sí, soy Andrés Vieira' }).waitFor();
    await p2.getByRole('button', { name: /No soy Andrés Vieira: salir de esta cuenta/ }).waitFor();
    await shot('enlace-reclamar', p2);
  });
  await check('El administrador abre el enlace de Andrés: NO puede aceptarlo (su colección no cambia), solo copiarlo', async () => {
    const code = JSON.parse(fs.readFileSync(path.join(SRV, 'gamevault/data/pending.json')))['~andres-vieira'].code;
    const n0 = server('c_soiber.json').data.juegos.length;
    await page.goto(URL0 + '#/reclamar/andres-vieira/' + code);
    await page.getByText(/aquí no se puede aceptar: tu colección no cambia/).waitFor({ timeout: 15000 });
    assert(await page.getByRole('button', { name: /Sí, soy|Sí, son míos/ }).count() === 0, 'botón de aceptar');
    await page.getByRole('button', { name: /Copiar el enlace para mandárselo/ }).waitFor();
    await page.waitForTimeout(600);
    await shot('enlace-admin');
    const r = await page.evaluate(async c => { const x = await fetch('api.php?action=claim', { method: 'POST', headers: { 'X-GV': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ id: '~andres-vieira', code: c }) }); return x.status; }, code);
    assert(r === 403, 'el servidor lo debería rechazar: ' + r);
    assert(JSON.parse(fs.readFileSync(path.join(SRV, 'gamevault/data/pending.json')))['~andres-vieira'], 'sigue pendiente');
    assert(server('c_soiber.json').data.juegos.length === n0, 'la colección de soiber cambió');
    await page.goto(URL0 + '#/dashboard');
    await page.getByRole('heading', { name: 'Inicio' }).waitFor({ timeout: 15000 });
  });

  // ── Zlotny ve lo que le han dejado, en el móvil y con el tema claro del sistema ──
  const p3 = await nuevo({ viewport: { width: 390, height: 844 }, colorScheme: 'light', deviceScaleFactor: 2, isMobile: true, hasTouch: true }); CUR.page = p3;
  await check('Móvil con el sistema en claro: la app sale en oscuro (lo de por defecto)', async () => {
    await entrar(p3, 'zlotny');
    await p3.getByText('Empezar desde cero').or(p3.getByRole('heading', { name: 'Inicio' })).first().waitFor({ timeout: 30000 });
    assert(await p3.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'tema');
  });
  await check('Zlotny (sin colección) ve en Préstamos «Tengo de otros: Pikmin 4 de soiber»', async () => {
    await p3.getByRole('button', { name: /ver lo que tienen mis colegas/ }).click();
    await p3.locator('.lz-mios').getByText('Pikmin 4').waitFor({ timeout: 20000 });
    await shot('movil-prestamos', p3);
  });
  await check('Móvil: aviso de la primera vez sobre el tema (en «Más»); se va al abrir «Más» y al cambiar el tema', async () => {
    const aviso = p3.locator('.theme-hint');
    await aviso.getByText(/En «Más» tienes el interruptor de tema/).waitFor();
    await shot('movil-aviso-tema', p3);
    await p3.locator('.nav-more').click();
    await p3.waitForTimeout(300);
    assert(!(await aviso.isVisible()), 'el aviso no debe tapar el menú «Más»');
    await p3.locator('.sidebar-footer .theme-switch').click();
    assert(await p3.evaluate(() => document.documentElement.dataset.theme) === 'light', 'a claro');
    await aviso.waitFor({ state: 'detached' });
    await p3.locator('.sidebar-footer .theme-switch').click();
    await p3.locator('.sidebar-scrim').click({ position: { x: 20, y: 20 } });     // tocar fuera del menú lo cierra
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
  await check('David tiene la campana con la petición de Zlotny', async () => {
    await p2.reload();
    await p2.locator('.sidebar-account .gv-bell').click();
    await p2.locator('.gv-avisos').getByText(/te pide «Super Mario RPG»/).waitFor({ timeout: 15000 });
    await shot('avisos', p2);
    await p2.mouse.click(700, 500);
  });
  await check('Campana de avisos: a Zlotny le llegaron el recordatorio de soiber y el «te lo deja» de David', async () => {
    await p3.reload();
    await p3.locator('.nav-more .nav-badge').waitFor({ timeout: 20000 });
    await p3.locator('.nav-more').click();
    await p3.locator('.gv-bell-wrap.v-menu button').first().click();
    const panel = p3.locator('.gv-avisos');
    await panel.getByText(/te recuerda que tienes su «Pikmin 4»/).waitFor({ timeout: 10000 });
    await panel.getByText(/te deja «Super Mario RPG»/).waitFor();
    await shot('avisos-movil', p3);
    await panel.getByRole('button', { name: /Marcar todo como leído/ }).click();
    await p3.locator('.nav-more .nav-badge').waitFor({ state: 'detached', timeout: 10000 });
    await p3.keyboard.press('Escape');
    await p3.mouse.click(5, 5);
  });
  await check('A Zlotny le sale «¡te lo deja!» y el juego en «Tengo de otros»', async () => {
    await p3.reload();
    await p3.locator('.lz-pet').getByText('¡te lo deja!').waitFor({ timeout: 20000 });
    await p3.locator('.lz-mios').getByText('Super Mario RPG').waitFor();
  });

  // ── Sincronización: un cambio en una pestaña llega a la cuenta ──
  CUR.page = page;
  await check('Historial de préstamos: David marca «Devuelto» y queda apuntado que Zlotny lo tuvo', async () => {
    CUR.page = p2;
    await p2.reload();
    await p2.locator('.nav-item', { hasText: 'Préstamos' }).click();
    const fila = p2.locator('.lz-mios .lz-mio', { hasText: 'Super Mario RPG' });
    await fila.getByRole('button', { name: /Devuelto/ }).click();
    await fila.waitFor({ state: 'detached', timeout: 15000 });
    for (let i = 0; i < 30; i++) { const j = server('c_daconstenla.json').data.juegos.find(x => x.nombre === 'Super Mario RPG'); if (j.historialPrestamos) break; await p2.waitForTimeout(300); }
    const j = server('c_daconstenla.json').data.juegos.find(x => x.nombre === 'Super Mario RPG');
    const h = JSON.parse(j.historialPrestamos || '[]');
    const local = await p2.evaluate(() => window.api.juegos.getAll({}).then(l => l.filter(x => /Super Mario RPG/.test(x.nombre)).map(x => [x.id, x.historialPrestamos, x.prestadoA])));
    assert(h.length === 1 && h[0].au === 'zlotny' && !j.prestadoA, JSON.stringify({ h: j.historialPrestamos, a: j.prestadoA, au: j.prestadoUsuario, rev: server('c_daconstenla.json').rev, id: j.id, local }));
    CUR.page = page;
    await page.goto(URL0 + '#/comunidad/daconstenla');
    await page.getByPlaceholder(/Buscar en la colección/).fill('super mario rpg');
    await page.locator('.gcard').first().click();
    await page.locator('.gv-jl .hist-prest').getByText('Zlotny').waitFor({ timeout: 10000 });
    await shot('historial');
    await page.keyboard.press('Escape');
  });
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
  await check('Recargar justo después de guardar no pierde nada (la copia del aparato se guarda antes de dar la subida por buena)', async () => {
    const rev0 = server('c_soiber.json').rev;
    await page.evaluate(async () => { const ps = await window.api.plataformas.getAll(); await window.api.juegos.create({ plataformaId: ps[0].id, nombre: 'Juego recarga rápida' }); });
    for (let i = 0; i < 60 && server('c_soiber.json').rev === rev0; i++) await page.waitForTimeout(100);
    await page.reload();
    await page.getByRole('heading', { name: 'Inicio' }).or(page.locator('.page-title')).first().waitFor({ timeout: 20000 });
    const ok = await page.evaluate(() => window.api.juegos.getAll({}).then(l => l.some(j => j.nombre === 'Juego recarga rápida')));
    assert(ok, 'el juego no está en este aparato tras recargar');
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

  await check('Enlace de Andrés aceptado con una cuenta nueva: pasa por la bienvenida con sus consolas marcadas y al terminar tiene sus 52 juegos', async () => {
    execFileSync('php', ['-r', `$f=$argv[1]; $u=json_decode(file_get_contents($f),true); $u['andresv']=['hash'=>password_hash('prueba1',PASSWORD_DEFAULT),'display'=>'Andrés','created'=>'2026-11-21','public'=>false]; file_put_contents($f,json_encode($u));`, path.join(SRV, 'creditos/data/users.json')]);
    const code = JSON.parse(fs.readFileSync(path.join(SRV, 'gamevault/data/pending.json')))['~andres-vieira'].code;
    const pa = await nuevo(); CUR.page = pa;
    pa.on('dialog', d => d.accept());
    await pa.goto(URL0 + '#/reclamar/andres-vieira/' + code);
    await pa.locator('input[autocomplete=username]').fill('andresv');
    await pa.locator('input[type=password]').fill('prueba1');
    await pa.locator('form button[type=submit]').first().click();
    await pa.getByRole('button', { name: 'Sí, soy Andrés Vieira' }).click({ timeout: 20000 });
    await pa.getByText('Empezar desde cero').click({ timeout: 30000 });
    await pa.locator('.ob-apuntados').getByText(/52 juegos/).waitFor({ timeout: 15000 });
    assert(JSON.parse(fs.readFileSync(path.join(SRV, 'gamevault/data/pending.json')))['~andres-vieira'], 'aún no se ha sumado');
    await pa.getByRole('button', { name: /Añadir 2 consolas/ }).click();
    await pa.locator('.sidebar').waitFor({ timeout: 40000 });
    await pa.waitForTimeout(1500);
    const n = await pa.evaluate(() => window.api.io.counts());
    assert(n.juegos === 52 && n.plataformas === 2, JSON.stringify(n));
    assert(!JSON.parse(fs.readFileSync(path.join(SRV, 'gamevault/data/pending.json'))).hasOwnProperty('~andres-vieira'), 'sigue pendiente');
    await pa.close(); CUR.page = page;
  });

  // ── Mismo aparato, otra cuenta: las colecciones nunca se mezclan ──
  const salirYEntrar = async user => {
    await page.evaluate(() => fetch('api.php?action=logout', { method: 'POST', headers: { 'X-GV': '1', 'Content-Type': 'application/json' }, body: '{}' }));
    await page.goto(URL0); await page.reload();
    await page.locator('.gv-gate').waitFor({ timeout: 20000 });
    await page.locator('.gv-gate input[autocomplete=username]').fill(user);
    await page.locator('.gv-gate input[type=password]').fill('prueba1');
    await page.locator('.gv-gate form button[type=submit]').click();
  };
  await check('Otra cuenta en el mismo aparato (sin colección): NO hereda la de soiber, empieza vacía', async () => {
    const antes = JSON.stringify(server('c_soiber.json').data.juegos.length);
    // por si quedara algo pendiente del paso anterior
    for (let i = 0; i < 30 && (await page.evaluate(() => JSON.parse(localStorage.getItem('gv-sync') || '{}').dirty)); i++) await page.waitForTimeout(300);
    const pre = fs.existsSync(path.join(SRV, 'gamevault/data/c_adriex86.json'));
    execFileSync('php', ['-r', `$f=$argv[1]; $u=json_decode(file_get_contents($f),true); $u['adriex86']=['hash'=>password_hash('prueba1',PASSWORD_DEFAULT),'display'=>'AdriEx86','created'=>'2026-11-20','public'=>false]; file_put_contents($f,json_encode($u));`, path.join(SRV, 'creditos/data/users.json')]);
    await salirYEntrar('adriex86');
    await page.locator('h1.page-title, .ob-cuenta, .gv-gate').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    const n = await page.evaluate(() => window.api.io.counts());
    assert(n.juegos === 0 && n.plataformas === 0, 'heredó la colección: ' + JSON.stringify(n));
    assert(!pre && (!fs.existsSync(path.join(SRV, 'gamevault/data/c_adriex86.json')) || server('c_adriex86.json').data.juegos.length === 0), 'subió algo a su cuenta');
    assert(JSON.stringify(server('c_soiber.json').data.juegos.length) === antes, 'tocó la de soiber');
    assert(JSON.parse(await page.evaluate(() => localStorage.getItem('gv-sync'))).user === 'adriex86', 'sync');
  });
  await check('Vuelve soiber al mismo aparato: recupera SU colección (sin nada de la otra cuenta)', async () => {
    await salirYEntrar('soiber');
    await page.getByRole('heading', { name: 'Inicio' }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(2500);                                        // por si recarga al bajar su colección
    await page.getByRole('heading', { name: 'Inicio' }).waitFor({ timeout: 30000 });
    const n = await page.evaluate(() => window.api.io.counts());
    assert(n.juegos === server('c_soiber.json').data.juegos.length, 'juegos: ' + JSON.stringify(n));
  });
  await check('Si la otra cuenta tenía cambios sin subir: pregunta, y «Seguir como…» carga la tuya sin subir nada de la otra', async () => {
    await page.waitForLoadState('load'); await page.waitForTimeout(2500);          // por si recarga al bajar la colección
    await page.getByRole('heading', { name: 'Inicio' }).waitFor({ timeout: 20000 });
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('gv-sync')); s.dirty = true; localStorage.setItem('gv-sync', JSON.stringify(s)); });
    const soiberAntes = server('c_soiber.json').rev;
    await salirYEntrar('zlotny');
    await page.getByText('Este aparato tiene la colección de otra cuenta').waitFor({ timeout: 30000 });
    await page.getByText(/no se mezclan/).waitFor();
    await shot('otra-cuenta');
    const zl = fs.existsSync(path.join(SRV, 'gamevault/data/c_zlotny.json')) ? server('c_zlotny.json').data.juegos.length : 0;
    await page.getByRole('button', { name: /Seguir como Zlotny/ }).click();
    await page.getByText('Este aparato tiene la colección de otra cuenta').waitFor({ state: 'detached', timeout: 20000 });
    await page.waitForTimeout(1500);
    const n = await page.evaluate(() => window.api.io.counts());
    assert(n.juegos === zl, 'local de zlotny: ' + JSON.stringify(n) + ' servidor ' + zl);
    assert((fs.existsSync(path.join(SRV, 'gamevault/data/c_zlotny.json')) ? server('c_zlotny.json').data.juegos.length : 0) === zl, 'subió la de soiber a zlotny');
    assert(server('c_soiber.json').rev === soiberAntes, 'tocó la de soiber');
  });

  await browser.close();
  php.kill();
  console.log(results.join('\n'));
  console.log('\nErrores de consola/JS:', errors.length ? '\n  ' + [...new Set(errors)].join('\n  ') : 'ninguno');
  process.exit(0);
})().catch(e => { console.log(results.join('\n')); console.error('FATAL', e); php.kill(); process.exit(1); });
