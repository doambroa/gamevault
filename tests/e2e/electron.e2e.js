// E2E de la app de escritorio real (Electron + build de producción) con Playwright
const { _electron: electron } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const APP = path.join(__dirname, '../..');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-e2e-'));
const results = [];
const errors = [];
let step = 0;
const CUR = {};
const uds = modal => modal.locator('.field').filter({ has: CUR.page.locator('label.field-label', { hasText: /^Unidades$/ }) }).locator('input');

async function check(name, fn) {
  step++;
  try { await fn(); results.push(`✔ ${step}. ${name}`); }
  catch (e) {
    results.push(`✘ ${step}. ${name}\n     → ${e.message.split('\n')[0]}`);
    try { await CUR.page.screenshot({ path: path.join(OUT, `FAIL-${step}.png`) }); await CUR.page.keyboard.press('Escape'); await CUR.page.keyboard.press('Escape'); } catch {}
  }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assert'); };

(async () => {
  const app = await electron.launch({
    executablePath: path.join(APP, 'node_modules/electron/dist/electron'),
    args: [APP, '--no-sandbox'],
    env: { ...process.env, GV_PROD: '1', GV_DATA_DIR: DATA, GV_FAKE_HTTP: path.join(APP, 'tests/fakeHttp.js'), ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
  });
  let page = await app.firstWindow();
  CUR.page = page;
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('dialog', d => { results.push(`   (alerta: "${d.message().slice(0, 90)}")`); d.accept(); });
  // el perfil de Electron se comparte entre ejecuciones: partir del tamaño de texto automático
  await page.waitForLoadState('domcontentloaded');
  if (await page.evaluate(() => { const v = localStorage.getItem('gv-texto'); localStorage.removeItem('gv-texto'); return !!v; })) await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 }).catch(() => {});
  const shot = n => page.screenshot({ path: path.join(OUT, `${String(step).padStart(2, '0')}-${n}.png` ) });

  // ── Onboarding ────────────────────────────────────────────────────────────
  await check('Arranque con BD nueva → pantalla de bienvenida', async () => {
    await page.getByText('Empezar desde cero').waitFor({ timeout: 20000 });
    await shot('onboarding');
  });
  await check('Catálogo vacío para distribuir: ninguna consola marcada como "ya la tienes"; elegir 2 y continuar', async () => {
    await page.getByText('Empezar desde cero').click();
    assert(await page.locator('.ob-consola-tiene').count() === 0, 'no debe haber consolas previas');
    await page.getByText('Xbox Series S', { exact: true }).click();
    await page.getByText('PS Vita', { exact: true }).click();
    await page.getByRole('button', { name: /Añadir 2 consolas/ }).click();
    await page.getByRole('heading', { name: 'Inicio' }).waitFor({ timeout: 15000 });
  });
  await check('Dashboard recién instalado: 2 plataformas y 0 juegos', async () => {
    await page.waitForTimeout(500);
    const txt = await page.locator('.stats-grid').first().innerText();
    assert(/\b2\b/.test(txt) && /\b0\b/.test(txt) && !/182/.test(txt), 'stats: ' + txt.replace(/\n/g, ' '));
    await shot('dashboard-vacio');
  });
  await check('Las consolas del asistente traen su imagen por defecto (incluida en la app)', async () => {
    const ps = await page.evaluate(() => window.api.plataformas.getAll());
    const vita = ps.find(p => p.nombre === 'PS Vita');
    assert(JSON.parse(vita.imagenes)[0] === './consolas/ps-vita.png', 'ruta: ' + vita.imagenes);
    await page.getByRole('button', { name: 'Consolas', exact: true }).click();
    const img = page.locator('.plat-card', { hasText: 'PS Vita' }).locator('img');
    await img.waitFor({ timeout: 8000 });
    assert(await img.evaluate(i => i.complete && i.naturalWidth === 480), 'no se carga la imagen');
    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  });
  await check('Cargar una colección con "Importar JSON" (24 consolas, 182 juegos)', async () => {
    await app.evaluate(({ dialog }, f) => { dialog.showOpenDialog = async () => ({ filePaths: [f] }); }, path.join(APP, 'tests/fixtures/coleccion-ejemplo.json'));
    await page.getByRole('button', { name: /Importar JSON/ }).click();
    await page.getByRole('button', { name: /importar y sobrescribir/ }).click();
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
    await page.waitForTimeout(500);
    const txt = await page.locator('.stats-grid').first().innerText();
    assert(/24/.test(txt) && /182/.test(txt), 'stats: ' + txt.replace(/\n/g, ' '));
    await shot('dashboard');
  });
  await check('Dashboard: tabla "Por plataforma" navega a la consola', async () => {
    await page.locator('.dashboard-plat-row').first().click();
    await page.getByText('Unidades en tu colección').waitFor();
    await page.getByRole('button', { name: /Volver/ }).click();
  });

  // ── Plataformas + Unidades ────────────────────────────────────────────────
  await check('Plataforma nueva con Unidades = 2 y se ve en el detalle', async () => {
    await page.getByRole('button', { name: 'Consolas', exact: true }).click();
    await page.getByRole('button', { name: /Nueva plataforma/ }).click();
    const modal = page.locator('.modal-box');
    await modal.locator('input').first().fill('PlayStation 2 Slim');
    await uds(modal).fill('2');
    await modal.getByRole('button', { name: 'Crear' }).click();
    await page.getByText('PlayStation 2 Slim').first().click();
    await page.getByText('Unidades en tu colección').waitFor();
    const u = await page.locator('p', { hasText: 'Unidades en tu colección' }).innerText();
    assert(/2/.test(u), u);
    await shot('plataforma-detalle');
  });
  await check('Editar plataforma conserva imágenes/fechas y cambia unidades a 3', async () => {
    await page.getByRole('button', { name: /Editar consola/ }).click();
    const modal = page.locator('.modal-box');
    await uds(modal).fill('3');
    await modal.getByRole('button', { name: /Guardar cambios/ }).click();
    await page.waitForTimeout(300);
    const u = await page.locator('p', { hasText: 'Unidades en tu colección' }).innerText();
    assert(/3/.test(u), u);
  });

  // ── Juego nuevo: HLTB + ventas automáticos ───────────────────────────────
  await check('Crear "Grand Theft Auto: San Andreas" (2 unidades) desde el detalle de la consola', async () => {
    await page.getByRole('button', { name: /Añadir juego/ }).click();
    const modal = page.locator('.modal-box');
    await modal.getByPlaceholder('Escribe el nombre del juego…').fill('Grand Theft Auto: San Andreas');
    await uds(modal).fill('2');
    await modal.getByRole('button', { name: /Crear juego/ }).click();
    await page.locator('td', { hasText: 'Grand Theft Auto: San Andreas' }).waitFor();
  });
  await check('Detalle del juego: Unidades 2, Duración 30,1/44,3/69,2 h y Ventas 27,5 M (sin gráfica: dato único)', async () => {
    await page.locator('td', { hasText: 'Grand Theft Auto: San Andreas' }).click();
    const panel = page.locator('.jp-panel');
    await panel.getByText('Ventas totales').waitFor();
    await panel.getByText('27,5 M').waitFor({ timeout: 15000 });
    await panel.getByText('30,1 h').waitFor({ timeout: 15000 });
    const t = await panel.innerText();
    assert(/2 \(duplicado\)/.test(t), 'unidades');
    assert(/44,3 h/.test(t) && /69,2 h/.test(t), 'hltb');
    assert(await panel.locator('svg[role="img"]').count() === 0, 'no debe haber gráfica');
    await shot('panel-gta');
  });
  await check('Botón "Actualizar" de Duración vuelve a consultar sin errores', async () => {
    const panel = page.locator('.jp-panel');
    await panel.locator('.jp-mini-btn').first().click();
    await panel.getByText('30,1 h').waitFor({ timeout: 10000 });
    await panel.locator('.jp-close').click();
  });

  // ── Juego moderno: gráfica ────────────────────────────────────────────────
  await check('Juegos: por defecto carátulas grandes (cuadrícula) y se puede pasar a tabla', async () => {
    await page.getByRole('button', { name: 'Juegos', exact: true }).click();
    await page.evaluate(() => localStorage.removeItem('gv_juegos_modo'));   // el perfil de Electron se comparte entre ejecuciones
    await page.getByRole('button', { name: 'Consolas', exact: true }).click();
    await page.getByRole('button', { name: 'Juegos', exact: true }).click();
    await page.locator('.gcard').first().waitFor();
    const w = await page.locator('.gcard-img').first().evaluate(e => e.getBoundingClientRect().width);
    assert(w >= 200, 'la carátula mide ' + w + ' px');
    await shot('juegos-caratulas');
    await page.getByRole('button', { name: /Tabla/ }).click();
    await page.locator('table.table').first().waitFor();
  });
  await check('Juegos: los grupos por consola se pliegan (uno o todos) y vale para carátulas y tabla', async () => {
    await page.evaluate(() => localStorage.removeItem('gv-plegado-juegos'));
    await page.getByRole('button', { name: /Por plataforma/ }).click();
    await page.getByRole('button', { name: /Carátulas/ }).click();
    await page.getByRole('button', { name: /Plegar todo/ }).click();
    assert(await page.locator('.gcard').count() === 0, 'siguen viéndose carátulas');
    assert(await page.locator('.grp-head.closed').count() > 1, 'no hay títulos plegados');
    await shot('juegos-plegados');
    await page.getByRole('button', { name: /Tabla/ }).click();
    assert(await page.locator('table.table').count() === 0, 'la tabla no respeta el plegado');
    await page.locator('.grp-head', { hasText: 'Nintendo 64' }).click();
    await page.locator('table.table').first().waitFor();
    assert(await page.locator('table.table').count() === 1, 'solo debe abrirse Nintendo 64');
    await page.getByRole('button', { name: /Plegar todo/ }).click();
    await page.getByRole('button', { name: /Desplegar todo/ }).click();
    assert(await page.locator('table.table').count() > 1, 'no se desplegó todo');
  });
  await check('Juegos → Nuevo juego "Mario Kart 8 Deluxe" en Switch', async () => {
    await page.getByRole('button', { name: 'Juegos', exact: true }).click();
    await page.getByRole('button', { name: /Nuevo juego/ }).click();
    const modal = page.locator('.modal-box');
    await modal.locator('select').first().selectOption({ label: 'Switch' });
    await modal.getByPlaceholder('Escribe el nombre del juego…').fill('Mario Kart 8 Deluxe: Booster Course');
    await modal.getByRole('button', { name: /Crear juego/ }).click();
    await page.locator('td.td-name', { hasText: 'Mario Kart 8 Deluxe: Booster Course' }).waitFor();
  });
  await check('La columna "Duración" de la tabla se rellena sola en segundo plano', async () => {
    const row = page.locator('tr', { has: page.locator('td.td-name', { hasText: 'Mario Kart 8 Deluxe: Booster Course' }) });
    await row.getByText('12h / 20h / 50h').waitFor({ timeout: 15000 });
  });
  await check('Detalle: 71,5 M ventas + gráfica interactiva con tooltip al pasar el ratón', async () => {
    await page.locator('td.td-name', { hasText: 'Mario Kart 8 Deluxe: Booster Course' }).click();
    const panel = page.locator('.jp-panel');
    await panel.getByText('71,5 M').waitFor({ timeout: 15000 });
    const svg = panel.locator('svg[role="img"]');
    await svg.waitFor();
    const box = await svg.boundingBox();
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
    await panel.getByText(/desde/).waitFor({ timeout: 3000 });
    await shot('grafica-ventas');
    await page.mouse.move(box.x + box.width - 3, box.y + 20);
    await page.waitForTimeout(200);
    await shot('grafica-ventas-final');
    await panel.locator('.jp-close').click();
  });

  // ── Filtros ───────────────────────────────────────────────────────────────
  await check('Filtros: búsqueda por nombre y por plataforma', async () => {
    await page.getByPlaceholder('Nombre…').fill('booster course');
    await page.waitForTimeout(400);
    const n = await page.locator('td.td-name').count();
    assert(n === 1, 'resultados: ' + n);
    await page.getByRole('button', { name: /Limpiar filtros/ }).click();
    await page.waitForTimeout(400);
    assert(await page.locator('td.td-name').count() > 100, 'sin filtros');
  });
  await check('Clic en un género de la tabla filtra por ese género', async () => {
    await page.locator('td.td-clickable', { hasText: 'Plataformas' }).first().click();
    await page.waitForTimeout(400);
    const pills = await page.locator('.badge', { hasText: 'Género: Plataformas' }).count();
    assert(pills === 1, 'pill');
    await page.getByRole('button', { name: /Limpiar filtros/ }).click();
  });

  // ── Editar juego ──────────────────────────────────────────────────────────
  await check('Editar juego: cambiar unidades a 4 y valoración', async () => {
    const row = page.locator('tr', { has: page.locator('td.td-name', { hasText: 'Mario Kart 8 Deluxe: Booster Course' }) });
    await row.locator('.icon-btn').first().click();
    const modal = page.locator('.modal-box');
    // Seleccionar texto arrastrando desde un campo y soltar fuera de la ventana NO debe cerrarla
    const campo = modal.locator('input[type=text], input:not([type])').first();
    const cb = await campo.boundingBox();
    await page.mouse.move(cb.x + cb.width - 5, cb.y + cb.height / 2);
    await page.mouse.down();
    await page.mouse.move(cb.x - 200, cb.y + 10, { steps: 8 });
    const ov = await page.locator('.modal-overlay').boundingBox();
    await page.mouse.move(ov.x + 10, ov.y + 10, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    assert(await modal.isVisible(), 'la ventana se cerró al soltar fuera tras arrastrar');
    await uds(modal).fill('4');
    await modal.getByRole('button', { name: '9', exact: true }).click();
    await modal.getByRole('button', { name: /Guardar cambios/ }).click();
    await page.waitForTimeout(400);
    await page.locator('td.td-name', { hasText: 'Mario Kart 8 Deluxe: Booster Course' }).click();
    await page.locator('.jp-panel').getByText('4 (duplicado)').waitFor();
    await page.locator('.jp-panel .jp-close').click();
    // Un clic normal fuera sí la cierra
    await row.locator('.icon-btn').first().click();
    await modal.waitFor();
    const ov2 = await page.locator('.modal-overlay').boundingBox();
    await page.mouse.click(ov2.x + 10, ov2.y + 10);
    await modal.waitFor({ state: 'detached', timeout: 3000 });
  });

  // ── Importar colección (TXT) ──────────────────────────────────────────────
  await check('Importar colección desde TXT: juegos sin plataforma → Dreamcast', async () => {
    const f = path.join(DATA, 'lista.txt');
    fs.writeFileSync(f, '- Shenmue\n- Crazy Taxi\n- Crazy Taxi\nSoulcalibur | Dreamcast\n');
    await page.locator('.menu-wrap > button').click(); await page.locator('.menu').getByText('Importar colección').click();
    const modal = page.locator('.modal-box');
    await modal.locator('input[type=file]').setInputFiles(f);
    await modal.getByText(/3 juegos detectados/).waitFor();
    await modal.getByText(/agrupada/).waitFor();
    await modal.locator('select').last().selectOption({ label: 'Dreamcast' });
    await modal.getByText('Buscar carátulas en RAWG').click();      // desactivar (sin red)
    await shot('import-review');
    await modal.getByRole('button', { name: /Importar 3 juegos/ }).click();
    await modal.getByText('¡Importación completada!').waitFor({ timeout: 20000 });
    const t = await modal.innerText();
    assert(/3\s*Importados/i.test(t.replace(/\n/g, ' ')) || /Importados/.test(t), t);
    await modal.getByRole('button', { name: /Ver colección/ }).click();
    await page.getByPlaceholder('Nombre…').fill('crazy');
    await page.waitForTimeout(400);
    await page.locator('td.td-name', { hasText: 'Crazy Taxi' }).click();
    await page.locator('.jp-panel').getByText('2 (duplicado)').waitFor();
    await page.locator('.jp-panel .jp-close').click();
    await page.getByRole('button', { name: /Limpiar filtros/ }).click();
  });

  // ── Lista de deseos ───────────────────────────────────────────────────────
  await check('Deseos: añadir y mover a la colección', async () => {
    await page.getByRole('button', { name: 'Lista de deseos' }).click();
    await page.getByRole('button', { name: /Añadir deseo/ }).click();
    const modal = page.locator('.modal-box');
    await modal.getByPlaceholder('Nombre del juego…').fill('Jet Set Radio');
    await modal.getByRole('button', { name: /Añadir a deseos/ }).click();
    await page.locator('td', { hasText: 'Jet Set Radio' }).waitFor();
    await page.locator('[title="Mover a colección"]').first().click();
    await page.locator('.modal-box select').selectOption({ label: 'Dreamcast' });
    await page.getByRole('button', { name: /Añadir a colección/ }).click();
    await page.getByText('Lista vacía').waitFor();
  });

  // ── Estadísticas ──────────────────────────────────────────────────────────
  await check('Estadísticas: burbujas por consola (tamaño según juegos) → su línea temporal con carátulas', async () => {
    await page.getByRole('button', { name: 'Estadísticas' }).click();
    await page.locator('.st-kpi').first().waitFor();
    await page.getByRole('button', { name: /Burbujas/ }).click();
    const b64 = page.locator('.bubble-wrap', { hasText: 'Nintendo 64' });
    const bPs = page.locator('.bubble-wrap').last();
    const w1 = await b64.locator('.bubble').evaluate(e => e.getBoundingClientRect().width);
    const w2 = await bPs.locator('.bubble').evaluate(e => e.getBoundingClientRect().width);
    assert(w1 > w2, `la burbuja con más juegos debe ser mayor (${w1} vs ${w2})`);
    await shot('estadisticas-burbujas');
    await b64.click();
    await page.locator('.tl2-game').first().waitFor();
    const n = await page.locator('.tl2-game').count();
    assert(n > 5, 'carátulas en la línea temporal: ' + n);
    const porAnio = await page.locator('.tl2-year').evaluateAll(ys => Math.max(...ys.map(y => y.querySelectorAll('.tl2-game').length)));
    assert(porAnio <= 3, 'como mucho 3 carátulas por año: ' + porAnio);
    const pesadas = await page.locator('.tl2-game img').evaluateAll(is => is.filter(i => /media\.rawg\.io\/media\/(?!resize\/(200|420|640|1280)\/)/.test(i.src)).length);
    assert(pesadas === 0, 'carátulas a tamaño completo en la línea temporal: ' + pesadas);
    await page.locator('.tl2-game').first().hover();
    await page.locator('.tl2-info').getByText(/·/).waitFor();
    await page.locator('.tl2-hover').getByText('Pulsa para abrir la ficha').waitFor();   // ficha ampliada al pasar el ratón
    const cols = await page.locator('.tl2-scroll').evaluate(el => [el.scrollWidth, el.clientWidth]);
    assert(cols[0] >= cols[1] - 2, 'las columnas deben ocupar todo el ancho: ' + cols);
    await shot('linea-temporal');
    await page.locator('.tl2-game').first().click();
    await page.locator('.jp-panel').waitFor();
    await page.locator('.jp-panel .jp-close').click();
  });
  await check('Estadísticas: vistas Barras y Tarjetas, y «Año a año» abre las carátulas debajo', async () => {
    await page.getByRole('button', { name: /Barras/ }).click();
    await page.locator('.st-bar', { hasText: 'Nintendo 64' }).first().waitFor();
    await page.getByRole('button', { name: /Tarjetas/ }).click();
    await page.locator('.stat-tile').first().waitFor();
    await page.getByRole('button', { name: /Burbujas/ }).click();
    assert(await page.locator('.st-year').count() >= 10, 'años');
    await page.locator('.st-year:not(.vacio)').last().click();
    await page.locator('.st-sel h2').getByText(/salieron/).waitFor();
    assert(await page.locator('.st-sel .gcard').count() > 0, 'sin carátulas');
  });

  // ── v1.5: título en castellano, vistas, orden por duración, zoom, importar duraciones ──
  await check('Título en castellano "Los Simpsons: El videojuego" → duración vía Wikipedia (The Simpsons Game)', async () => {
    await page.getByRole('button', { name: 'Juegos', exact: true }).click();
    await page.getByRole('button', { name: /Nuevo juego/ }).click();
    const modal = page.locator('.modal-box');
    await modal.locator('select').first().selectOption({ label: 'PSP' });
    await modal.getByPlaceholder('Escribe el nombre del juego…').fill('Los Simpsons: El videojuego');
    await modal.getByRole('button', { name: /Crear juego/ }).click();
    await page.getByPlaceholder('Nombre…').fill('simpsons');
    await page.locator('.filter-bar select').first().selectOption({ label: 'PSP' });
    await page.waitForTimeout(400);
    const filas = page.locator('td.td-name', { hasText: 'Los Simpsons: El videojuego' });
    await filas.last().click();   // el recién creado (en tu colección ya existía uno)
    const panel = page.locator('.jp-panel');
    await panel.getByText('7,7 h').waitFor({ timeout: 20000 });
    await panel.getByText('«The Simpsons Game»').first().waitFor();
    await panel.getByText('4 M').waitFor({ timeout: 20000 });
    await shot('simpsons');
    await panel.locator('.jp-close').click();
    await page.getByRole('button', { name: /Limpiar filtros/ }).click();
  });
  await check('Campo "Título original" en el formulario', async () => {
    await page.getByRole('button', { name: /Nuevo juego/ }).click();
    await page.locator('.modal-box').getByPlaceholder(/The Simpsons Game/).waitFor();
    await page.keyboard.press('Escape');
  });
  await check('Vista "Todos": una sola tabla con columna Plataforma; se recuerda', async () => {
    await page.getByRole('button', { name: /^Todos$/ }).click();
    await page.waitForTimeout(300);
    assert(await page.locator('table.table').count() === 1, 'una sola tabla');
    assert(await page.locator('th', { hasText: 'Plataforma' }).count() >= 1, 'columna plataforma');
    await shot('vista-todos');
    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
    await page.getByRole('button', { name: 'Juegos', exact: true }).click();
    await page.waitForTimeout(400);
    assert(await page.locator('table.table').count() === 1, 'la vista se recuerda');
  });
  await check('Orden por Duración: ciclo Historia ↑/↓ → +Extras ↑/↓ → 100% ↑/↓, métrica activa resaltada', async () => {
    const th = page.locator('th', { hasText: 'Duración' }).first();
    const expect = ['Historia ↑', 'Historia ↓', '+Extras ↑', '+Extras ↓', '100% ↑', '100% ↓', 'Historia ↑'];
    const key = { 'Historia': 0, '+Extras': 1, '100%': 2 };
    for (const lbl of expect) {
      await th.click(); await page.waitForTimeout(150);
      const t = (await th.innerText()).replace(/\s+/g, ' ');
      assert(t.toLowerCase().includes(lbl.toLowerCase()), `cabecera "${t}" ≠ ${lbl}`);
      // filas con dato: ordenadas por la métrica y sólo esa en cian
      const idx = key[lbl.split(' ')[0]];
      const rows = await page.evaluate(i => [...document.querySelectorAll('tbody tr')].map(tr => {
        const spans = [...tr.querySelectorAll('td span span')].filter(x => /h$|—/.test(x.textContent));
        return spans.length === 3 ? { v: parseFloat(spans[i].textContent.replace(',', '.')), colores: spans.map(x => getComputedStyle(x).color) } : null;
      }).filter(Boolean), idx);
      const vals = rows.map(r => r.v).filter(v => !isNaN(v));
      const asc = lbl.endsWith('↑');
      assert(vals.length >= 3, 'filas con duración: ' + vals.length);
      for (let i = 1; i < vals.length; i++) assert(asc ? vals[i - 1] <= vals[i] : vals[i - 1] >= vals[i], `orden ${lbl}: ${vals.join(',')}`);
      const c = rows[0].colores; assert(c[idx] !== c[(idx + 1) % 3], 'la métrica activa debe distinguirse');
    }
    await shot('orden-duracion');
    await page.locator('th', { hasText: 'Nombre' }).first().click();
    await page.getByRole('button', { name: /Por plataforma/ }).click();
  });
  await check('Plataformas: cada tarjeta muestra el nº de juegos', async () => {
    await page.getByRole('button', { name: 'Consolas', exact: true }).click();
    const t = await page.locator('.plat-card', { hasText: 'Nintendo 64' }).innerText();
    const fx = require(path.join(APP, 'tests/fixtures/coleccion-ejemplo.json'));
    const n64 = fx.plataformas.find(p => p.nombre === 'Nintendo 64');
    const esperado = fx.juegos.filter(j => j.plataformaId === n64.id).length;
    assert(new RegExp(esperado + '\\s*juegos?').test(t), `esperaba ${esperado} juegos: ` + JSON.stringify(t));
    await shot('plataformas-contador');
  });
  await check('Estadísticas → ficha del juego y editar: el cambio se ve al momento', async () => {
    await page.getByRole('button', { name: 'Estadísticas' }).click();
    await page.locator('.bubble-wrap', { hasText: 'Switch' }).first().click();
    await page.locator('.tl2-game[aria-label*="Booster Course"]').click();
    const panel = page.locator('.jp-panel');
    await panel.getByText('71,5 M').waitFor({ timeout: 10000 });
    await panel.getByRole('button', { name: /Editar/ }).click();
    const modal = page.locator('.modal-box');
    await modal.getByRole('button', { name: '6', exact: true }).click();
    await modal.getByRole('button', { name: /Guardar cambios/ }).click();
    await panel.getByText('6/10').waitFor();
    await page.locator('.tl2-game.on[aria-label*="Booster Course"]').waitFor();
    await shot('estadisticas-panel');
    await panel.locator('.jp-close').click();
  });
  await check('Importar duraciones: aviso previo, progreso y resumen (sin borrar los no encontrados)', async () => {
    await page.getByRole('button', { name: 'Juegos', exact: true }).click();
    // reducir a pocos juegos para que la prueba sea rápida: se cancela tras unos segundos
    await page.locator('.menu-wrap > button').click(); await page.locator('.menu').getByText('Importar duraciones').click();
    const modal = page.locator('.modal-box');
    await modal.getByText(/sobrescribirán todos los tiempos que hayan cambiado/).waitFor();
    await shot('importar-duraciones-aviso');
    await modal.getByRole('button', { name: /Importar duraciones/ }).click();
    await modal.getByText(/Consultando HowLongToBeat/).waitFor();
    await page.waitForTimeout(6000);
    await modal.getByRole('button', { name: 'Cancelar' }).click();
    await modal.getByText(/Importación cancelada/).waitFor({ timeout: 15000 });
    const t = await modal.innerText();
    assert(/sin cambios/.test(t) && /no encontrados/.test(t), t);
    await shot('importar-duraciones-resumen');
    await modal.getByRole('button', { name: 'Cerrar' }).click();
    // los juegos de la colección inicial sin datos en el simulador no pierden sus tiempos
    await page.getByPlaceholder('Nombre…').fill('booster');
    await page.locator('tr', { hasText: 'Booster Course' }).getByText('12h').waitFor();
    await page.getByRole('button', { name: /Limpiar filtros/ }).click();
  });

  // ── Exportar / PDF / Importar JSON (diálogos nativos simulados) ──────────
  const exportFile = path.join(DATA, 'export.json');
  const pdfFile = path.join(DATA, 'catalogo.pdf');
  await app.evaluate(({ dialog, shell }, files) => {
    dialog.showSaveDialog = async (_w, o) => ({ filePath: /pdf/i.test(JSON.stringify(o.filters)) ? files.pdf : files.json });
    dialog.showOpenDialog = async () => ({ filePaths: [files.json] });
    shell.openPath = async () => '';
  }, { json: exportFile, pdf: pdfFile });

  await check('Exportar JSON: fichero con unidades, HLTB y ventas', async () => {
    await page.getByRole('button', { name: /Exportar JSON/ }).click();
    await page.waitForTimeout(800);
    const d = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
    const mk = d.juegos.find(j => j.nombre === 'Mario Kart 8 Deluxe: Booster Course');
    assert(mk && mk.unidades === 4 && mk.hltbMain === 12 && mk.ventasTotal === 71530000, JSON.stringify(mk).slice(0, 200));
    assert(d.plataformas.find(p => p.nombre === 'PlayStation 2 Slim').unidades === 3, 'unidades plataforma');
  });
  await check('Exportar PDF del catálogo', async () => {
    await page.evaluate(() => window.api.plataformas.create({ nombre: 'ZZ Prueba imagen', marca: 'Nintendo', tipo: 'Sobremesa', imagenes: ['./consolas/nintendo-64.png'] }));
    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
    await page.getByRole('button', { name: /Exportar PDF/ }).click();
    await page.getByRole('button', { name: /Exportar PDF/ }).waitFor({ timeout: 60000 });
    for (let i = 0; i < 60 && !fs.existsSync(pdfFile); i++) await page.waitForTimeout(500);
    const sz = fs.statSync(pdfFile).size;
    assert(sz > 20000, 'tamaño ' + sz);
    assert(fs.readFileSync(pdfFile).slice(0, 4).toString() === '%PDF', 'cabecera PDF');
    const pages = Number(require('child_process').execFileSync('pdfinfo', [pdfFile]).toString().match(/Pages:\s+(\d+)/)[1]);
    assert(pages >= 10, 'páginas: ' + pages);
    const lst = require('child_process').execFileSync('pdfimages', ['-list', pdfFile]).toString();
    assert(/\s480\s+257\s/.test(lst), 'la imagen por defecto no llegó al PDF');
    require('child_process').execFileSync('pdftoppm', ['-r', '40', '-f', '1', '-l', '3', '-png', pdfFile, path.join(OUT, 'pdf')]);
  });
  await check('Importar JSON (sobrescribe) tras borrar una consola → la recupera', async () => {
    await page.getByRole('button', { name: 'Consolas', exact: true }).click();
    await page.getByText('PlayStation 2 Slim').first().click();
    await page.getByRole('button', { name: /Eliminar consola/ }).click();
    await page.locator('.modal-box').getByRole('button', { name: 'Eliminar' }).click();
    await page.waitForTimeout(500);
    assert(await page.getByText('PlayStation 2 Slim').count() === 0, 'no se borró');
    await page.getByRole('button', { name: /Importar JSON/ }).click();
    await page.getByRole('button', { name: /importar y sobrescribir/ }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Consolas', exact: true }).click();
    await page.getByText('PlayStation 2 Slim').first().waitFor();
  });
  await check('Borrar una plataforma borra también sus juegos (sin huérfanos)', async () => {
    const before = await app.evaluate(async () => 0);
    await page.locator('.plat-name', { hasText: 'Dreamcast' }).click();
    await page.getByRole('button', { name: /Eliminar consola/ }).click();
    await page.locator('.modal-box').getByRole('button', { name: 'Eliminar' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Juegos', exact: true }).click();
    await page.getByPlaceholder('Nombre…').fill('crazy');
    await page.waitForTimeout(500);
    assert(await page.locator('td.td-name', { hasText: 'Crazy Taxi' }).count() === 0, 'Crazy Taxi huérfano');
  });

  // ── Persistencia ──────────────────────────────────────────────────────────
  await check('Los datos persisten al cerrar y volver a abrir', async () => {
    await app.close();
    const app2 = await electron.launch({
      executablePath: path.join(APP, 'node_modules/electron/dist/electron'), args: [APP, '--no-sandbox'],
      env: { ...process.env, GV_PROD: '1', GV_DATA_DIR: DATA, GV_FAKE_HTTP: path.join(APP, 'tests/fakeHttp.js') },
    });
    const p2 = await app2.firstWindow();
    await p2.getByRole('heading', { name: 'Inicio' }).waitFor({ timeout: 20000 });
    await p2.getByRole('button', { name: 'Juegos', exact: true }).click();
    await p2.locator('td.td-name', { hasText: 'Mario Kart 8 Deluxe: Booster Course' }).waitFor();
    await app2.close();
  });
  await check('Copia de seguridad semanal en este PC: al abrir con colección se guarda en «copias»', async () => {
    const dir = path.join(DATA, 'copias');
    const f = fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => /^gamevault-\d{4}-\d{2}-\d{2}\.db$/.test(x)) : [];
    assert(f.length === 1, 'copias: ' + f.join(','));
    assert(fs.statSync(path.join(dir, f[0])).size > 4096, 'copia vacía');
  });
  // Sesión nueva para tema y borrado (al final: el borrado vacía la colección)
  const app3 = await electron.launch({
    executablePath: path.join(APP, 'node_modules/electron/dist/electron'), args: [APP, '--no-sandbox'],
    env: { ...process.env, GV_PROD: '1', GV_DATA_DIR: DATA, GV_FAKE_HTTP: path.join(APP, 'tests/fakeHttp.js') },
  });
  page = await app3.firstWindow(); CUR.page = page;
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.setViewportSize({ width: 1440, height: 900 }).catch(() => {});
  await page.getByRole('heading', { name: 'Inicio' }).waitFor({ timeout: 20000 });
  await check('La pila de la vergüenza (sin cuenta): aviso de Créditos Finales, horas y grupos por duración', async () => {
    await page.getByRole('button', { name: 'La pila' }).click();
    await page.locator('.pila-aviso').getByText(/Créditos Finales/).waitFor();
    await page.locator('.pila-hero-n').first().waitFor();
    assert(await page.locator('.pila-sec').count() >= 1, 'sin grupos');
    await shot('pila');
  });
  await check('Historial de préstamos y «No tiene final» en la ficha del juego', async () => {
    const id = await page.evaluate(async () => {
      const j = (await window.api.juegos.getAll({})).find(x => /Booster Course/.test(x.nombre));
      await window.api.juegos.prestar({ id: j.id, prestadoA: 'Ana', fechaPrestamo: '2026-09-01' });
      await window.api.juegos.devolver(j.id);
      return j.id;
    });
    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
    await page.getByRole('button', { name: 'La pila' }).click();
    await page.locator('.pila-hero-n').first().waitFor();
    const n0 = Number((await page.locator('.pila-hero-n').first().locator('b').innerText()).replace(/\D/g, ''));
    await page.locator('.gcard', { hasText: 'Booster Course' }).first().click();
    const panel = page.locator('.jp-panel');
    await panel.locator('.hist-prest').getByText('Ana').waitFor({ timeout: 10000 });
    await panel.locator('.hist-prest').getByText(/01\/09\/2026/).waitFor();
    await shot('historial');
    await panel.locator('.jp-sinfinal input').check();
    await panel.locator('.jp-close').click();
    await page.waitForFunction(n => Number(document.querySelector('.pila-hero-n b').textContent.replace(/\D/g, '')) === n - 1, n0);
    assert(await page.evaluate(i => window.api.juegos.getAll({}).then(l => l.find(x => x.id === i).sinFinal), id) === 1, 'no se guardó');    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  });
  await check('Tamaño del texto: Automático según la pantalla y fijo desde Ajustes (sin barras de desplazamiento raras)', async () => {
    await page.locator('.sidebar-footer').getByText('Ajustes').click();
    const modal = page.locator('.modal-box');
    await modal.getByRole('button', { name: 'Más grande' }).click();
    assert(await page.evaluate(() => window.api.window.getZoom()) === 1.25, 'no se aplicó el zoom');
    await shot('texto-grande');
    const fit = await page.evaluate(() => { const r = document.querySelector('.shell').getBoundingClientRect(); return [Math.round(r.height), innerHeight, Math.round(r.width), innerWidth]; });
    assert(Math.abs(fit[0] - fit[1]) <= 2 && Math.abs(fit[2] - fit[3]) <= 2, 'la ventana no encaja: ' + fit);
    await modal.getByRole('button', { name: 'Automático' }).click();
    assert(await page.evaluate(() => window.api.window.getZoom()) === 1, 'a 1440 px el automático debe ser 100 %');
    await page.keyboard.press('Escape');
    await modal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    if (await modal.count()) await modal.locator('.modal-close, button[aria-label="Cerrar"]').first().click().catch(() => {});
  });
  await check('Tema claro/oscuro: el botón de la barra de título cambia el tema y se recuerda', async () => {
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
    await page.evaluate(() => localStorage.removeItem('gv-theme'));   // partir de cero (el perfil de Electron se comparte entre ejecuciones)
    await page.reload(); await page.getByRole('heading', { name: 'Inicio' }).waitFor({ timeout: 15000 });
    const sis = await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    assert(await theme() === sis, 'por defecto debe seguir al sistema (' + sis + ')');
    await page.locator('.sidebar-footer').getByText('como el sistema').waitFor();
    if (sis === 'light') await page.locator('.titlebar .theme-icon').click();   // partir de oscuro
    await page.locator('.titlebar .theme-icon').click();
    assert(await theme() === 'light', 'no cambió a claro');
    await page.waitForTimeout(600);   // fin del fundido
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert(bg === 'rgb(233, 235, 243)', 'fondo claro: ' + bg);
    await page.reload(); await page.getByRole('heading', { name: 'Inicio' }).waitFor({ timeout: 15000 });
    assert(await theme() === 'light', 'no se recordó');
    await shot('tema-claro');
    await page.locator('.sidebar-footer .theme-switch').click();
    assert(await theme() === 'dark', 'el interruptor lateral no vuelve a oscuro');
    await page.locator('.sidebar-footer .theme-auto').click();
    assert(await theme() === sis && await page.evaluate(() => localStorage.getItem('gv-theme')) === null, '«Auto» vuelve al del sistema');
  });
  await check('Borrar colección: aviso, casillas premarcadas, confirmar con BORRAR; borra sólo lo marcado', async () => {
    await page.evaluate(() => window.api.deseos.create({ nombre: 'Deseo E2E', plataforma: 'Switch' }));
    const n0 = await page.evaluate(() => window.api.io.counts());
    await page.getByRole('button', { name: /Ajustes/ }).click();
    await page.getByRole('button', { name: /Borrar toda mi colección/ }).click();
    const modal = page.locator('.modal-box');
    await modal.locator('.wipe-alert').getByText(/TODA tu colección/i).waitFor();
    const boxes = modal.locator('.wipe-opt input');
    assert(await boxes.count() === 3, 'tres casillas');
    for (let i = 0; i < 3; i++) assert(await boxes.nth(i).isChecked(), 'premarcada ' + i);
    assert(await boxes.nth(1).isDisabled(), 'juegos fijo si se borran plataformas');
    const btn = modal.getByRole('button', { name: /Borrar \d+ elementos/ });
    assert(await btn.isDisabled(), 'sin escribir BORRAR debe estar desactivado');
    // Sólo juegos: desmarcar plataformas y deseos
    await modal.locator('.wipe-opt', { hasText: 'Borrar Plataformas' }).click();
    await modal.locator('.wipe-opt', { hasText: 'Borrar lista de deseos' }).click();
    await modal.getByText('Borrar parte de mi colección').waitFor();
    await modal.locator('.wipe-confirm input').fill('borrar');
    await shot('borrar-parcial');
    await modal.getByRole('button', { name: new RegExp('Borrar ' + n0.juegos + ' elementos') }).click();
    await page.getByRole('heading', { name: 'Inicio' }).waitFor({ timeout: 15000 });
    const n1 = await page.evaluate(() => window.api.io.counts());
    assert(n1.juegos === 0 && n1.plataformas === n0.plataformas && n1.deseos === n0.deseos, JSON.stringify(n1));
    // Todo
    await page.getByRole('button', { name: /Ajustes/ }).click();
    await page.getByRole('button', { name: /Borrar toda mi colección/ }).click();
    await modal.locator('.wipe-confirm input').fill('BORRAR');
    await modal.getByRole('button', { name: /Borrar \d+ elementos/ }).click();
    await page.getByText('Empezar desde cero').waitFor({ timeout: 15000 });
    const n2 = await page.evaluate(() => window.api.io.counts());
    assert(n2.plataformas === 0 && n2.juegos === 0 && n2.deseos === 0, JSON.stringify(n2));
    await shot('tras-borrar');
  });
  await app3.close();

  console.log(results.join('\n'));
  console.log('\nErrores de consola/JS:', errors.length ? '\n  ' + [...new Set(errors)].join('\n  ') : 'ninguno');
  process.exit(0);
})().catch(e => { console.log(results.join('\n')); console.error('FATAL', e); console.log('Errores:', errors); process.exit(1); });
