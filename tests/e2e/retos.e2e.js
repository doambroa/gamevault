// E2E de los Retos Switcherino (playlist por días y porra de los Game Awards) sobre la versión web con PHP.
//   GV_SEED=/ruta/datos GV_RETOS=/ruta/retos.json node tests/e2e/retos.e2e.js
// GV_RETOS (opcional): retos de partida (p. ej. las playlists de verano y otoño importadas de los documentos).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), { spawn, execFileSync } = require('child_process');

const APP = path.join(__dirname, '../..');
const OUT = path.join(__dirname, 'shots-retos');
fs.mkdirSync(OUT, { recursive: true });
const SRV = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-retos-'));
const PORT = 8600 + Math.floor(Math.random() * 300);
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
const DATA = path.join(SRV, 'gamevault/data');
fs.mkdirSync(DATA, { recursive: true });
if (process.env.GV_SEED) for (const f of fs.readdirSync(process.env.GV_SEED)) fs.copyFileSync(path.join(process.env.GV_SEED, f), path.join(DATA, f));
if (process.env.GV_RETOS) fs.copyFileSync(process.env.GV_RETOS, path.join(DATA, 'retos.json'));
fs.mkdirSync(path.join(SRV, 'creditos/data'), { recursive: true });
fs.writeFileSync(path.join(SRV, 'creditos/api.php'), '<?php // Créditos Finales (simulada)');
execFileSync('php', ['-r', `
$h = password_hash('prueba1', PASSWORD_DEFAULT);
$u = []; foreach (['soiber'=>'soiber','daconstenla'=>'daconstenla','zlotny'=>'Zlotny','adriex86'=>'AdriEx86'] as $k=>$d) $u[$k] = ['hash'=>$h,'display'=>$d,'created'=>'2026-10-31','public'=>false];
file_put_contents($argv[1].'/users.json', json_encode($u));`, path.join(SRV, 'creditos/data')]);
const php = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SRV], { stdio: 'ignore' });
const server = file => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
const hoyISO = (d = 0) => { const f = new Date(); f.setDate(f.getDate() + d); const p = n => String(n).padStart(2, '0'); return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`; };

(async () => {
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const nuevo = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', ...opts });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|401|403|409|429|400|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    page.on('dialog', d => d.accept(CUR.prompt || undefined));
    return page;
  };
  const entrar = async (page, user) => {
    await page.goto(URL0);
    await page.locator('.gv-gate').waitFor({ timeout: 20000 });
    await page.locator('.gv-gate input[autocomplete=username]').fill(user);
    await page.locator('.gv-gate input[type=password]').fill('prueba1');
    await page.locator('.gv-gate form button[type=submit]').click();
    // sin colección sale la bienvenida: «Ahora no» lleva a la app
    // (la bienvenida puede asomar un instante mientras se baja la colección: se espera a que se asiente)
    try { await page.locator('h1.page-title').first().waitFor({ timeout: 8000 }); }
    catch { await page.locator('.ob-cuenta').click(); await page.locator('h1.page-title').first().waitFor({ timeout: 30000 }); }
  };
  const api = (page, action, body) => page.evaluate(async ([a, b]) => {
    const r = await fetch('api.php?action=' + a, { method: b ? 'POST' : 'GET', headers: { 'X-GV': '1', 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    return { status: r.status, j: await r.json() };
  }, [action, body]);

  let page = await nuevo(); CUR.page = page;
  const shot = (n, p = page) => p.screenshot({ path: path.join(OUT, `${String(step).padStart(2, '0')}-${n}.png`), fullPage: false });

  await check('Menú: apartado «Retos Switcherino» con Playlist y Porra', async () => {
    await entrar(page, 'soiber');
    await page.locator('.nav-sep', { hasText: 'Retos Switcherino' }).waitFor();
    await page.locator('.nav-item', { hasText: 'Playlist' }).click();
    await page.getByRole('heading', { name: 'Retos Switcherino' }).waitFor();
  });

  if (process.env.GV_RETOS) {
    await check('Playlists de antes importadas: Otoño marrón con sus 31 días y 186 temas; los apodos con cuenta salen con su nombre', async () => {
      await page.locator('.retos-chip', { hasText: 'Otoño marrón' }).click();
      await page.locator('.pl-dia').first().waitFor();
      assert(await page.locator('.pl-dia').count() === 31, 'días: ' + await page.locator('.pl-dia').count());
      assert(await page.locator('.pl-tema').count() === 186, 'temas: ' + await page.locator('.pl-tema').count());
      await page.locator('.pl-persona', { hasText: 'AdriEx86' }).waitFor();            // @AdriExposito → adriex86 (unidos)
      await page.locator('.pl-persona', { hasText: 'Zlotny' }).waitFor();              // @zlotny → zlotny (mismo nombre)
      assert(await page.locator('.pl-tema .pl-quien i', { hasText: 'sin cuenta' }).count() > 0, 'apodos sin cuenta');
      const listas = page.locator('.pl-hero-acc a', { hasText: 'Escuchar' });
      assert(await listas.count() === 4, 'trozos de 50: ' + await listas.count());
      const h = await listas.first().getAttribute('href');
      assert(/watch_videos\?video_ids=([A-Za-z0-9_-]{11},){49}[A-Za-z0-9_-]{11}$/.test(h), h);
      const v = page.locator('.pl-hero .pl-video');                   // el vídeo final, destacado con su miniatura
      await v.getByText('El vídeo final').waitFor();
      assert((await v.locator('img').getAttribute('src')).includes('KLF-PIrw5yk'), 'miniatura del vídeo');
      assert((await v.getAttribute('href')).includes('KLF-PIrw5yk'), 'enlace del vídeo');
      await v.getByText(/Retro and not so retro grooves for autumn/).waitFor();
      await page.locator('.pl-intro-box').getByText(/Los 31 días de octubre/).waitFor();
      await page.waitForTimeout(500);
      await shot('otono');
    });
    await check('Copiar como documento: el texto sale con el formato del Drive', async () => {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.getByRole('button', { name: /Copiar como documento/ }).click();
      await page.getByRole('button', { name: /Copiado/ }).waitFor();
      const t = await page.evaluate(() => navigator.clipboard.readText());
      assert(t.includes('# Día 1 - Un amanecer frío con neblina en el campo.') && t.includes('@soiber: [Field - Day'), t.slice(0, 200));
    });
  }

  await check('Nueva playlist (admin): pegar las frases del documento, poner que empezó hace 2 días y arrancarla', async () => {
    await page.locator('.retos-chip.nuevo').click();
    const m = page.locator('.modal-box');
    await m.locator('input').first().fill('Invierno de prueba');
    await m.locator('select').first().selectOption('invierno');
    await m.locator('input[type=date]').fill(hoyISO(-2));
    await m.locator('textarea.rt-frases').fill('1. Inicio del invierno, entra el frío\n2. Día de termas con lluvia fina\nDía 3 - Decorar el árbol\n4. Compras de última hora\n5. Mercado navideño');
    await m.getByText(/5 días · del/).waitFor();
    await m.getByRole('button', { name: 'Guardar y arrancar' }).click();
    await page.locator('.pl-hero h2', { hasText: 'Invierno de prueba' }).waitFor();
    await page.getByText('En marcha · día 3 de 5').first().waitFor();
    const d = server('retos.json');
    const pl = Object.values(d.playlists).find(p => p.titulo === 'Invierno de prueba');
    assert(pl && pl.estado === 'activo' && pl.dias[2].t === 'Decorar el árbol', JSON.stringify(pl?.dias));
    CUR.pid = pl.id;
  });

  await check('Hoy es el día 3: tarjeta resaltada con la frase y el hueco para el enlace', async () => {
    const hoy = page.locator('.pl-dia.t-hoy');
    await hoy.getByText('Decorar el árbol').waitFor();
    await hoy.locator('.pl-tag.hoy').waitFor();
    await hoy.getByPlaceholder(/Pega aquí el enlace de YouTube/).waitFor();
    await shot('hoy-admin');
  });

  await check('Enlace que no es de YouTube → aviso; enlace bueno → se añade con su miniatura', async () => {
    const hoy = page.locator('.pl-dia.t-hoy');
    await hoy.getByPlaceholder(/Pega aquí/).fill('https://vimeo.com/12345');
    await hoy.getByRole('button', { name: 'Añadir mi tema' }).click();
    await hoy.getByText(/Pega un enlace de YouTube/).waitFor();
    await hoy.getByPlaceholder(/Pega aquí/).fill('https://youtu.be/xGi23M_5lXg?si=abc');
    await hoy.locator('.pl-form-prev[src*="xGi23M_5lXg"]').waitFor();
    await hoy.getByText('Añadir título o comentario').click();
    await hoy.getByPlaceholder(/Título/).fill('Field - Day (Zelda: Breath of the Wild)');
    await hoy.getByRole('button', { name: 'Añadir mi tema' }).click();
    await hoy.locator('.pl-tema.mio', { hasText: 'Field - Day' }).waitFor();
    const ap = server('retos.json').playlists[CUR.pid].aportes['3'].soiber;
    assert(ap.yt === 'xGi23M_5lXg' && ap.titulo.startsWith('Field'), JSON.stringify(ap));
  });

  await check('El admin añade el tema de alguien sin cuenta (@mario64) en un día anterior', async () => {
    const d2 = page.locator('#dia-2');
    await d2.getByRole('button', { name: /Añadir el de otra persona/ }).click();
    await d2.locator('select').selectOption('@');
    await d2.getByPlaceholder(/Su apodo/).fill('mario64');
    await d2.getByPlaceholder('Enlace de YouTube').fill('https://www.youtube.com/watch?v=FH8Lb1Lk-1M&list=PL2');
    await d2.getByRole('button', { name: 'Añadir', exact: true }).click();
    await d2.locator('.pl-tema', { hasText: 'mario64' }).getByText('sin cuenta').waitFor();
    assert(server('retos.json').playlists[CUR.pid].aportes['2']['@mario64'].yt === 'FH8Lb1Lk-1M', 'guardado como @mario64');
  });

  await check('Quién es quién: unir «mario64» con una cuenta → sus temas salen con su nombre', async () => {
    await page.getByRole('button', { name: /Quién es quién/ }).click();
    const m = page.locator('.modal-box');
    await m.locator('.rt-alias-row', { hasText: '@mario64' }).locator('select').selectOption('daconstenla');
    await page.waitForTimeout(600);
    await m.getByRole('button', { name: 'Hecho' }).click();
    await page.locator('#dia-2 .pl-tema', { hasText: 'daconstenla' }).waitFor();
    assert(server('retos.json').alias.mario64 === 'daconstenla', 'alias');
  });

  // ── Otra persona: zlotny ──
  const p2 = await nuevo(); CUR.page = p2;
  await check('Zlotny: aviso «Día 3 de …» en la campana y número en el menú', async () => {
    await entrar(p2, 'zlotny');
    await p2.locator('.nav-item', { hasText: 'Playlist' }).locator('.nav-badge').waitFor({ timeout: 15000 });
    await p2.locator('.gv-bell').click();
    await p2.locator('.gv-aviso.t-reto', { hasText: 'Día 3 de «Invierno de prueba»: Decorar el árbol' }).waitFor();
    await shot('aviso', p2);
    await p2.locator('.gv-aviso.t-reto').first().click();
    await p2.locator('.pl-dia.t-hoy').waitFor();
  });

  await check('Antes de poner su tema: no ve la frase de mañana («Quedan 2 días por descubrir»)', async () => {
    assert(await p2.locator('.pl-dia.t-manana').count() === 0, 'mañana no debería verse');
    await p2.getByText(/Quedan 2 días por descubrir · pon el tema de hoy y verás la frase de mañana/).waitFor();
    assert(!(await p2.content()).includes('Compras de última hora'), 'la frase de mañana no debe llegar a la página');
    await p2.locator('#dia-1').waitFor(); await p2.locator('#dia-2').waitFor();
    await shot('zlotny-hoy', p2);
  });

  await check('No puede poner tema en un día que aún no llegó (lo rechaza el servidor)', async () => {
    const r = await api(p2, 'reto_aporte', { pid: CUR.pid, dia: 5, url: 'https://youtu.be/xGi23M_5lXg' });
    assert(r.status === 400 && /todavía no ha llegado/.test(r.j.error), JSON.stringify(r));
    const r2 = await api(p2, 'reto_aporte', { pid: CUR.pid, dia: 3, url: 'https://youtu.be/xGi23M_5lXg', para: '@otro' });
    assert(r2.status === 403, 'no puede añadir por otros');
  });

  await check('Pone su tema → aparece «Mañana» sombreado con la frase para ir pensando', async () => {
    const hoy = p2.locator('.pl-dia.t-hoy');
    await hoy.getByPlaceholder(/Pega aquí/).fill('https://www.youtube.com/watch?v=Bwt4JA2rGsI');
    await hoy.getByRole('button', { name: 'Añadir mi tema' }).click();
    await hoy.locator('.pl-tema.mio').waitFor();
    const man = p2.locator('.pl-dia.t-manana');
    await man.getByText('Compras de última hora').waitFor();
    await man.getByText(/Ve pensando en tu tema/).waitFor();
    await p2.getByText(/Queda 1 día por descubrir/).waitFor();
    assert(await man.locator('input').count() === 0, 'mañana aún no deja poner tema');
    await shot('manana', p2);
  });

  await check('El aviso de hoy queda leído y desaparece el número del menú', async () => {
    await p2.reload();
    await p2.locator('.pl-dia.t-hoy').waitFor({ timeout: 20000 });
    await p2.waitForTimeout(1500);
    assert(await p2.locator('.nav-item', { hasText: 'Playlist' }).locator('.nav-badge').count() === 0, 'badge');
  });

  await check('Cambiar y quitar su propio tema; no puede tocar el de otros', async () => {
    const mio = p2.locator('.pl-dia.t-hoy .pl-tema.mio');
    await mio.getByTitle('Cambiar').click();
    const f = p2.locator('.pl-dia.t-hoy .pl-form');
    await f.getByPlaceholder(/Título/).fill('Snowpeak – Twilight Princess');
    await f.getByRole('button', { name: 'Guardar' }).click();
    await p2.locator('.pl-dia.t-hoy .pl-tema.mio', { hasText: 'Snowpeak' }).waitFor();
    const otro = p2.locator('.pl-dia.t-hoy .pl-tema', { hasText: 'Field - Day' });
    assert(await otro.getByTitle('Quitar').count() === 0, 'no debe poder quitar el de soiber');
    await p2.locator('.pl-dia.t-hoy .pl-tema.mio').getByTitle('Quitar').click();
    await p2.locator('.pl-dia.t-hoy .pl-form').waitFor();
    assert(!server('retos.json').playlists[CUR.pid].aportes['3'].zlotny, 'quitado');
    const hoy = p2.locator('.pl-dia.t-hoy');
    await hoy.getByPlaceholder(/Pega aquí/).fill('https://www.youtube.com/watch?v=Bwt4JA2rGsI');
    await hoy.getByRole('button', { name: 'Añadir mi tema' }).click();
    await hoy.locator('.pl-tema.mio').waitFor();
  });

  await check('Día anterior: «¿Se te pasó? Pon el tuyo»', async () => {
    const d1 = p2.locator('#dia-1');
    await d1.getByRole('button', { name: /Se te pasó/ }).click();
    await d1.getByPlaceholder('Enlace de YouTube').fill('youtube.com/shorts/idOmc35hlhU');
    await d1.getByRole('button', { name: 'Añadir mi tema' }).click();
    await d1.locator('.pl-tema.mio').waitFor();
  });

  await check('Borradores: la playlist de invierno en borrador no la ve nadie más', async () => {
    const r = await api(p2, 'retos');
    assert(r.j.playlists.every(p => p.estado !== 'borrador'), 've un borrador');
    assert(!r.j.gente && !r.j.alias, 'datos de admin a quien no lo es');
  });

  // ── Porra ──
  CUR.page = page;
  await check('Nueva porra (admin): ya vienen las 30 categorías de los Game Awards 2026 con portadas', async () => {
    await page.locator('.nav-item', { hasText: 'Porra' }).click();
    await page.locator('.retos-chip.nuevo').click();
    const m = page.locator('.modal-box');
    await m.getByText(/30 categorías · 155 nominados/).waitFor();
    await m.locator('.rt-cat').first().locator('.rt-cat-h input').first().waitFor();
    assert(await m.locator('.rt-cat').first().locator('.rt-cat-h input').first().inputValue() === 'Juego del año', 'primera categoría');
    assert(await m.locator('input[type=datetime-local]').inputValue() === '2026-12-11T02:30', 'cierre');
    await m.locator('.rt-cat').first().locator('.icon-btn').first().click();
    await m.locator('.rt-nom').first().waitFor();
    await shot('editor-porra');
    await m.getByRole('button', { name: 'Guardar y abrir para votar' }).click();
    await page.locator('.po-hero h2', { hasText: 'Porra Game Awards 2026' }).waitFor();
    const po = Object.values(server('retos.json').porras)[0];
    assert(po.estado === 'abierta' && po.categorias.length === 30 && po.categorias[0].puntos === 3, 'porra');
    CUR.po = po.id;
  });

  await check('Votar: tarjetas de la categoría; al pulsar se guarda y pasa sola a la siguiente', async () => {
    await page.locator('.po-cat-h h3', { hasText: 'Juego del año' }).waitFor();
    assert(await page.locator('.po-card').count() === 6, 'nominados GOTY');
    await page.locator('.po-cat-h').getByText('vale 3 puntos').waitFor();
    await shot('porra-goty');
    await page.locator('.po-card', { hasText: 'Grand Theft Auto VI' }).click();
    await page.locator('.po-card.sel', { hasText: 'Grand Theft Auto VI' }).waitFor();
    await page.locator('.po-cat-h h3', { hasText: 'Mejor dirección' }).waitFor({ timeout: 4000 });
    assert(server('retos.json').porras[CUR.po].votos.soiber.goty === 'grand-theft-auto-vi', 'voto guardado');
    await page.locator('.po-card', { hasText: 'PRAGMATA' }).click();
    await page.locator('.po-cat-h h3', { hasText: 'Mejor narrativa' }).waitFor({ timeout: 4000 });
  });

  await check('Volver atrás y cambiar el voto; las flechas del teclado también mueven', async () => {
    await page.getByRole('button', { name: /Anterior/ }).click();
    await page.locator('.po-card.sel', { hasText: 'PRAGMATA' }).waitFor();
    await page.locator('.po-card', { hasText: 'Resident Evil Requiem' }).click();
    await page.locator('.po-card.sel', { hasText: 'Resident Evil Requiem' }).waitFor();          // al cambiar un voto se queda para que lo veas
    await page.waitForTimeout(500);
    assert(server('retos.json').porras[CUR.po].votos.soiber.direccion === 'resident-evil-requiem', 'cambiado');
    assert(await page.locator('.po-card.sel').count() === 1, 'solo uno elegido');
    await page.getByRole('button', { name: /Siguiente/ }).click();
    await page.locator('.po-cat-h h3', { hasText: 'Mejor narrativa' }).waitFor({ timeout: 4000 });
    await page.keyboard.press('ArrowLeft');
    await page.locator('.po-card.sel', { hasText: 'Resident Evil Requiem' }).waitFor();
    await page.keyboard.press('ArrowRight');
    await page.locator('.po-cat-h h3', { hasText: 'Mejor narrativa' }).waitFor();
  });

  await check('Resumen: lo elegido en cada categoría, lo que falta, y se puede ir a cambiarlo', async () => {
    await page.getByRole('button', { name: /Ver el resumen/ }).click();
    await page.locator('.po-resumen').getByText(/Llevas 2 de 30/).waitFor();
    await page.locator('.po-res-item', { hasText: 'Juego del año' }).getByText('Grand Theft Auto VI').waitFor();
    assert(await page.locator('.po-res-item.falta').count() === 28, 'faltan');
    await shot('resumen');
    await page.locator('.po-res-item', { hasText: 'Mejor banda sonora' }).click();
    await page.locator('.po-cat-h h3', { hasText: 'Mejor banda sonora' }).waitFor();
    await page.locator('.po-card', { hasText: 'Ocarina of Time' }).click();
    await page.waitForTimeout(600);
  });

  await check('Se guarda en el servidor: al recargar sigue todo y continúa en el resumen', async () => {
    await page.reload();
    await page.locator('.po-resumen').getByText(/Llevas 3 de 30/).waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: /Seguir donde lo dejé/ }).click();
    await page.locator('.po-cat-h h3', { hasText: 'Mejor narrativa' }).waitFor();
  });

  CUR.page = p2;
  await check('Zlotny: aviso de la porra; ve que soiber lleva 3/30 pero NO lo que eligió', async () => {
    await p2.locator('.gv-bell').click();
    await p2.locator('.gv-aviso.t-porra', { hasText: '¡Ya puedes hacer tu porra' }).click();
    await p2.locator('.po-cat-h h3', { hasText: 'Juego del año' }).waitFor();
    await p2.locator('.po-gente .pl-persona', { hasText: 'soiber' }).getByText('3/30').waitFor();
    const r = await api(p2, 'retos');
    const po = r.j.porras[0];
    assert(po.participantes.every(x => !x.votos), 'no debe ver votos ajenos');
    await p2.locator('.po-card', { hasText: '007 First Light' }).click();
    await p2.locator('.po-cat-h h3', { hasText: 'Mejor dirección' }).waitFor({ timeout: 4000 });
    await p2.locator('.po-card', { hasText: 'Resident Evil Requiem' }).click();
    await p2.waitForTimeout(600);
  });

  await check('El admin vota por alguien sin cuenta (@mario64)', async () => {
    CUR.page = page; CUR.prompt = 'mario64';
    await page.getByRole('button', { name: /otra persona sin cuenta/ }).click();
    CUR.prompt = null;
    await page.locator('.po-cat-h h3', { hasText: 'Juego del año' }).waitFor();
    await page.locator('.po-card', { hasText: 'Grand Theft Auto VI' }).click();
    await page.waitForTimeout(700);
    assert(server('retos.json').porras[CUR.po].votos['@mario64'].goty === 'grand-theft-auto-vi', 'voto por otro');
    assert(server('retos.json').porras[CUR.po].votos.soiber.goty === 'grand-theft-auto-vi', 'el suyo intacto');
    await page.locator('.po-para select').selectOption('');
  });

  await check('Cerrada: ya no se puede votar; todos ven lo que eligió cada uno', async () => {
    const r0 = await api(page, 'porra_guardar', { ...server('retos.json').porras[CUR.po], cierre: new Date(Date.now() - 60000).toISOString() });
    assert(r0.status === 200, JSON.stringify(r0.j).slice(0, 200));
    const r = await api(p2, 'porra_voto', { id: CUR.po, cat: 'goty', nom: 'grand-theft-auto-vi' });
    assert(r.status === 400 && /cerrada/.test(r.j.error), JSON.stringify(r));
    const v = await api(p2, 'retos');
    assert(v.j.porras[0].participantes.find(x => x.quien.user === 'soiber').votos.goty === 'grand-theft-auto-vi', 'ahora sí se ven');
  });

  await check('Gala (admin): marcar ganadores → clasificación con puntos (Juego del año vale 3)', async () => {
    await page.reload();
    await page.locator('.po-rank').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: /Marcar ganadores/ }).click();
    const goty = page.locator('.po-cat-res', { has: page.locator('h4', { hasText: 'Juego del año' }) });
    await goty.locator('.po-card', { hasText: 'Grand Theft Auto VI' }).click();
    await goty.locator('.po-card.win', { hasText: 'Grand Theft Auto VI' }).waitFor();
    const dir = page.locator('.po-cat-res', { has: page.locator('h4', { hasText: 'Mejor dirección' }) });
    await dir.locator('.po-card', { hasText: 'Resident Evil Requiem' }).click();
    await dir.locator('.po-card.win').waitFor();
    await page.waitForTimeout(800);
    const fila = n => page.locator('.po-rank li', { hasText: n });
    await fila('soiber').locator('.po-pts-n').getByText('4').waitFor();          // 3 + 1
    await fila('daconstenla').locator('.po-pts-n').getByText('3').waitFor();     // @mario64 → daconstenla (quién es quién)
    await fila('Zlotny').locator('.po-pts-n').getByText('1').waitFor();
    assert((await page.locator('.po-rank li').first().textContent()).includes('soiber'), 'soiber primero');
    await goty.locator('.po-card-votos .gv-avatar').first().waitFor();
    await shot('resultados');
  });

  await check('Zlotny ve la clasificación (sin poder marcar ganadores)', async () => {
    await p2.reload();
    await p2.locator('.po-rank li', { hasText: 'soiber' }).waitFor({ timeout: 20000 });
    assert(await p2.getByRole('button', { name: /Marcar ganadores/ }).count() === 0, 'botón de admin');
    const r = await api(p2, 'porra_ganador', { id: CUR.po, cat: 'goty', nom: '' });
    assert(r.status === 403, 'no admin');
  });

  await check('Reclamar un perfil: sus temas y votos pasan a la cuenta nueva', async () => {
    const pend = server('pending.json'); const id = Object.keys(pend)[0];
    if (!id) return;
    await api(page, 'reto_aporte', { pid: CUR.pid, dia: 1, url: 'https://youtu.be/xGi23M_5lXg', para: id });
    const p3 = await nuevo(); CUR.page = p3;
    await entrar(p3, 'adriex86');
    const r = await api(p3, 'claim', { id, code: pend[id].code });
    assert(r.status === 200, JSON.stringify(r.j));
    const ap = server('retos.json').playlists[CUR.pid].aportes['1'];
    assert(ap.adriex86 && !ap[id], JSON.stringify(Object.keys(ap)));
    CUR.page = page;
  });

  await check('Móvil: playlist y porra se ven bien en pantalla estrecha', async () => {
    const pm = await nuevo({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); CUR.page = pm;
    await pm.goto(URL0 + '#/retos');
    await pm.locator('.gv-gate').waitFor({ timeout: 20000 });
    await pm.locator('.gv-gate input[autocomplete=username]').fill('daconstenla');
    await pm.locator('.gv-gate input[type=password]').fill('prueba1');
    await pm.locator('.gv-gate form button[type=submit]').click();
    await pm.locator('.ob-cuenta', { hasText: 'ir a los retos de Switcherino' }).click();   // enlace del grupo, sin colección
    await pm.locator('.pl-dia.t-hoy').waitFor({ timeout: 20000 });
    const ancho = await pm.evaluate(() => document.documentElement.scrollWidth);
    assert(ancho <= 392, 'scroll horizontal: ' + ancho);
    await shot('movil-playlist', pm);
    await pm.goto(URL0 + '#/retos/porra');
    await pm.locator('.po-rank').waitFor({ timeout: 20000 });
    await shot('movil-porra', pm);
  });

  console.log(results.join('\n'));
  console.log('\nErrores de consola/JS:', errors.length ? '\n  ' + [...new Set(errors)].join('\n  ') : 'ninguno');
  await browser.close();
  php.kill();
  process.exit(0);
})().catch(e => { console.log(results.join('\n')); console.error('FATAL', e); php.kill(); process.exit(1); });
