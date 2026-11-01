// Pruebas del núcleo de datos: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { createCore } = require('../src/core/gvCore');
const { createHltb } = require('../src/core/hltb');
const { createVentas } = require('../src/core/ventas');
const text = require('../src/core/text');

const FIX = p => fs.readFileSync(path.join(__dirname, 'fixtures', p), 'utf8');
const INITIAL = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'coleccion-ejemplo.json'), 'utf8'));
let SQL;
test.before(async () => { SQL = await initSqlJs(); });

const mk = (opts = {}) => createCore({ SQL, bytes: null, ...opts });

// ── HLTB simulado (respuestas con la forma real capturada el 18-10-2026) ─────
function fakeHltb({ endpoint = 'search/site', games = {}, failFirstToken = false, hp = false } = {}) {
  const calls = [];
  let tokenN = 0;
  const http = async (url, opts) => {
    calls.push({ url, method: opts.method, headers: opts.headers, body: opts.body });
    const u = new URL(url);
    if (u.pathname === '/') return { status: 200, text: '<html><script src="/_next/static/chunks/a1.js"></script><script src="/_next/static/chunks/b2.js"></script></html>' };
    if (u.pathname === '/_next/static/chunks/a1.js') return { status: 200, text: 'fetch("/api/login",{method:"POST"})' };
    if (u.pathname === '/_next/static/chunks/b2.js') return { status: 200, text: 'let e=await fetch(`/api/' + endpoint + '/init?t=${Date.now()}`);' };
    if (u.pathname === `/api/${endpoint}/init`) { tokenN++; return { status: 200, text: JSON.stringify(hp ? { token: 'tok' + tokenN, hpKey: 'abc', hpVal: 'xyz' } : { token: 'tok' + tokenN }) }; }
    if (u.pathname === `/api/${endpoint}` && opts.method === 'POST') {
      if (opts.headers['x-auth-token'] !== 'tok' + tokenN) return { status: 403, text: '<html>forbidden</html>' };
      if (failFirstToken && tokenN === 1) return { status: 403, text: '<html>expired</html>' };
      const b = JSON.parse(opts.body);
      if (hp && b.abc !== 'xyz') return { status: 404, text: '<html>nope</html>' };
      const q = b.searchTerms.join(' ').toLowerCase();
      const data = Object.entries(games).filter(([k]) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase().split(':')[0])).map(([, g]) => g);
      return { status: 200, text: JSON.stringify({ count: data.length, data }) };
    }
    return { status: 404, text: 'not found' };
  };
  return { http, calls };
}
const GTA = { game_id: 4073, game_name: 'Grand Theft Auto: San Andreas', game_alias: 'Grand Theft Auto: San Andreas HD, GTA SA', comp_main: 108349, comp_plus: 159341, comp_100: 249044, release_world: 2004 };
const GTA_DE = { game_id: 9, game_name: 'Grand Theft Auto: San Andreas - The Definitive Edition', game_alias: '', comp_main: 100000, comp_plus: 150000, comp_100: 240000, release_world: 2021 };

// ═════════════════════════════════════════════════════════════════════════════
test('esquema nuevo: tablas y columnas nuevas (unidades, HLTB, ventas)', () => {
  const c = mk();
  const jc = c.all('PRAGMA table_info(juegos)').map(r => r.name);
  const pc = c.all('PRAGMA table_info(plataformas)').map(r => r.name);
  for (const k of ['unidades', 'hltbMain', 'hltbExtra', 'hltbComplete', 'ventasTotal', 'ventasJson']) assert.ok(jc.includes(k), k);
  assert.ok(pc.includes('unidades'));
});

test('migración de una BD antigua (v13 sin unidades) conserva datos y pone unidades=1', () => {
  const old = new SQL.Database();
  old.run(`CREATE TABLE plataformas (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, marca TEXT, imagenes TEXT DEFAULT '[]');
    CREATE TABLE juegos (id INTEGER PRIMARY KEY AUTOINCREMENT, plataformaId INTEGER NOT NULL, nombre TEXT NOT NULL, imagenes TEXT DEFAULT '[]');
    INSERT INTO plataformas (nombre) VALUES ('PS2'); INSERT INTO juegos (plataformaId,nombre) VALUES (1,'GTA SA');
    INSERT INTO juegos (plataformaId,nombre) VALUES (99,'Huérfano');`);
  const c = createCore({ SQL, bytes: old.export() });
  const j = c.handlers['j:all']();
  assert.equal(j.length, 1, 'el juego huérfano se limpia');
  assert.equal(j[0].unidades, 1);
  assert.equal(c.handlers['p:one'](1).unidades, 1);
});

test('importar la colección inicial completa (24 plataformas, 182 juegos)', () => {
  const c = mk();
  c.importColeccion(INITIAL, { replace: true });
  assert.equal(c.handlers['p:all']().length, INITIAL.plataformas.length);
  assert.equal(c.handlers['j:all']().length, INITIAL.juegos.length);
  assert.ok(c.handlers['j:all']().every(j => j.unidades === 1));
  const s = c.handlers.stats();
  assert.equal(s.totalJuegos, INITIAL.juegos.length);
  assert.ok(s.porPlataforma.length > 0 && 'imagenes' in s.porPlataforma[0]);
});

test('importar JSON en modo reemplazo borra lo anterior (como avisa la UI)', () => {
  const c = mk();
  const p = c.handlers['p:create']({ nombre: 'Temporal' });
  c.handlers['j:create']({ plataformaId: p.id, nombre: 'Juego temporal', autoEnrich: false });
  c.handlers['data:import'](INITIAL);
  assert.ok(!c.handlers['p:all']().some(x => x.nombre === 'Temporal'));
});

test('importar no aborta por un juego huérfano y no borra en cascada', () => {
  const c = mk();
  c.importColeccion({ plataformas: [{ id: 1, nombre: 'A' }], juegos: [{ id: 1, plataformaId: 1, nombre: 'ok' }, { id: 2, plataformaId: 7, nombre: 'huérfano' }] });
  c.importColeccion({ plataformas: [{ id: 1, nombre: 'A renombrada' }] });   // REPLACE de la plataforma
  assert.equal(c.handlers['j:all']().length, 1);
  assert.equal(c.handlers['p:one'](1).nombre, 'A renombrada');
});

test('exportar → importar es reversible (incluye unidades, HLTB y ventas)', () => {
  const c = mk();
  const p = c.handlers['p:create']({ nombre: 'NES', unidades: 2 });
  const j = c.handlers['j:create']({ plataformaId: p.id, nombre: 'Zelda', unidades: 3, autoEnrich: false });
  c.run('UPDATE juegos SET hltbMain=12.5, ventasTotal=6500000 WHERE id=?', [j.id]);
  const data = JSON.parse(JSON.stringify(c.exportData()));
  const c2 = mk();
  c2.handlers['data:import'](data);
  const j2 = c2.handlers['j:one'](j.id);
  assert.equal(j2.unidades, 3); assert.equal(j2.hltbMain, 12.5); assert.equal(j2.ventasTotal, 6500000);
  assert.equal(c2.handlers['p:one'](p.id).unidades, 2);
});

test('CRUD plataformas: unidades por defecto 1, valores vacíos → NULL, imágenes como array', () => {
  const c = mk();
  const p = c.handlers['p:create']({ nombre: '  Mega Drive ', marca: '', precio: '', imagenes: ['a.png'] });
  assert.equal(p.nombre, 'Mega Drive');
  assert.equal(p.unidades, 1);
  assert.equal(p.marca, null); assert.equal(p.precio, null);
  assert.equal(p.imagenes, '["a.png"]');
  const u = c.handlers['p:update']({ ...p, imagenes: p.imagenes, unidades: '2', precio: '59,90' });
  assert.equal(u.unidades, 2); assert.equal(u.precio, 59.9);
  assert.equal(u.imagenes, '["a.png"]', 'no se doble-codifica el JSON de imágenes');
  assert.throws(() => c.handlers['p:create']({ nombre: '' }));
  const bad = c.handlers['p:update']({ ...u, unidades: 0 });
  assert.equal(bad.unidades, 1, 'unidades < 1 se corrige a 1');
});

test('borrar plataforma borra sus juegos (antes quedaban huérfanos)', () => {
  const c = mk();
  const p = c.handlers['p:create']({ nombre: 'SNES' });
  c.handlers['j:create']({ plataformaId: p.id, nombre: 'Mario World', autoEnrich: false });
  c.handlers['p:delete'](p.id);
  assert.equal(c.all('SELECT * FROM juegos').length, 0);
});

test('CRUD juegos + filtros + préstamos', () => {
  const c = mk();
  const p = c.handlers['p:create']({ nombre: 'PS2' });
  const p2 = c.handlers['p:create']({ nombre: 'GameCube' });
  const a = c.handlers['j:create']({ plataformaId: String(p.id), nombre: 'GTA SA', genero: 'Acción', fechaLanzamiento: '2004-10-26', estado: 'Usado', autoEnrich: false });
  c.handlers['j:create']({ plataformaId: p2.id, nombre: 'Metroid Prime', genero: 'Aventura', fechaLanzamiento: '2002-11-17', autoEnrich: false });
  assert.equal(a.plataformaId, p.id);
  assert.equal(a.unidades, 1);
  assert.equal(c.handlers['j:all']({ genero: 'Acción' }).length, 1);
  assert.equal(c.handlers['j:all']({ anio: '2002' }).length, 1);
  assert.equal(c.handlers['j:all']({ plataformaId: String(p2.id) }).length, 1);
  assert.equal(c.handlers['j:all']({ busqueda: 'gta' }).length, 1);
  c.handlers['j:prestar']({ id: a.id, prestadoA: 'Ana', fechaPrestamo: '2026-10-01' });
  assert.equal(c.handlers['j:all']({ prestado: '1' }).length, 1);
  assert.equal(c.handlers.stats().totalPrestados, 1);
  c.handlers['j:devolver'](a.id);
  assert.equal(c.handlers.stats().totalPrestados, 0);
  assert.throws(() => c.handlers['j:create']({ plataformaId: 999, nombre: 'x' }), /Plataforma/);
  const up = c.handlers['j:update']({ ...a, unidades: 2, valoracion: 9, imagenes: '["x.jpg"]' });
  assert.equal(up.unidades, 2); assert.equal(up.valoracion, 9); assert.equal(up.imagenes, '["x.jpg"]');
  c.handlers['j:delete'](a.id);
  assert.equal(c.handlers['j:all']().length, 1);
});

test('deseos: crear, mover a colección (con unidades=1) y borrar', () => {
  const c = mk();
  const p = c.handlers['p:create']({ nombre: 'N64' });
  const d = c.handlers['d:create']({ nombre: 'Banjo-Kazooie', precioEstimado: '40', imagenes: ['u.jpg'] });
  assert.equal(d.prioridad, 2);
  const r = c.handlers['d:move']({ id: d.id, plataformaId: p.id });
  assert.ok(r.ok);
  const j = c.handlers['j:one'](r.juegoId);
  assert.equal(j.nombre, 'Banjo-Kazooie'); assert.equal(j.unidades, 1); assert.equal(j.precio, 40);
  assert.equal(c.handlers['d:all']().length, 0);
  assert.equal(c.handlers['d:move']({ id: 123, plataformaId: p.id }).error, 'not found');
});

test('config y onboarding', () => {
  const c = mk();
  assert.equal(c.handlers['app:isFirstRun'](), true);
  c.handlers['app:completeOnboarding']();
  assert.equal(c.handlers['app:isFirstRun'](), false);
  c.handlers['cfg:set']('rawg_api_key', 'k1');
  assert.equal(c.handlers['cfg:get']('rawg_api_key'), 'k1');
});

test('la BD se persiste en cada cambio (y una sola vez por lote de importación)', () => {
  let saves = 0;
  const c = mk({ persist: () => saves++ });
  const before = saves;
  c.handlers['p:create']({ nombre: 'X' });
  assert.equal(saves, before + 1);
  const b2 = saves;
  c.importColeccion(INITIAL, { replace: true });
  assert.ok(saves - b2 <= 3, 'importación en lote: ' + (saves - b2) + ' guardados');
});

// ── Texto ────────────────────────────────────────────────────────────────────
test('normalización, siglas y romanos', () => {
  assert.equal(text.normalize('Pokémon: Edición Oro™'), 'pokemon edicion oro');
  assert.ok(text.similarity('GTA San Andreas', 'Grand Theft Auto: San Andreas') > 0.9);
  assert.equal(text.similarity('Final Fantasy VII', 'Final Fantasy 7'), 1);
  assert.ok(text.similarity('Zelda', 'Super Mario 64') < 0.3);
  assert.deepEqual(text.searchVariants('Grand Theft Auto: San Andreas (PAL)').slice(0, 2), ['Grand Theft Auto: San Andreas (PAL)', 'Grand Theft Auto: San Andreas']);
  assert.equal(text.parseVgcDate('26th Oct 04'), '2004-10-26');
  assert.equal(text.parseVgcDate('06th Aug 2026'), '2026-08-06');
  assert.equal(text.parseUnits('27.50m'), 27500000);
  assert.equal(text.parseUnits('17,300,000'), 17300000);
  assert.equal(text.parseUnits('N/A'), null);
});

// ── HLTB ─────────────────────────────────────────────────────────────────────
test('HLTB: GTA San Andreas → 30.1h / 44.3h / 69.2h (protocolo real token + /api/search/site)', async () => {
  const { http, calls } = fakeHltb({ games: { 'Grand Theft Auto: San Andreas': GTA, 'Grand Theft Auto: San Andreas - The Definitive Edition': GTA_DE } });
  const h = createHltb(http);
  const r = await h.lookup('Grand Theft Auto: San Andreas', { year: 2004 });
  assert.deepEqual([r.hltbMain, r.hltbExtra, r.hltbComplete], [30.1, 44.3, 69.2]);
  assert.equal(r.hltbId, 4073);
  const post = calls.find(c => c.method === 'POST');
  assert.equal(post.url, 'https://howlongtobeat.com/api/search/site');
  assert.ok(post.headers['x-auth-token']);
});

test('HLTB: sigue funcionando si renombran el endpoint (se redescubre del JS)', async () => {
  const { http } = fakeHltb({ endpoint: 'locate/v3', games: { 'Grand Theft Auto: San Andreas': GTA } });
  const r = await createHltb(http).lookup('Grand Theft Auto: San Andreas');
  assert.equal(r.hltbMain, 30.1);
});

test('HLTB: renueva el token caducado (403) y soporta hpKey/hpVal', async () => {
  const a = fakeHltb({ failFirstToken: true, games: { 'Grand Theft Auto: San Andreas': GTA } });
  assert.equal((await createHltb(a.http).lookup('Grand Theft Auto: San Andreas')).hltbMain, 30.1);
  const b = fakeHltb({ hp: true, games: { 'Grand Theft Auto: San Andreas': GTA } });
  assert.equal((await createHltb(b.http).lookup('Grand Theft Auto: San Andreas')).hltbMain, 30.1);
});

test('HLTB: nombre con región/paréntesis y con siglas', async () => {
  const { http } = fakeHltb({ games: { 'Grand Theft Auto: San Andreas': GTA } });
  const h = createHltb(http);
  assert.equal((await h.lookup('Grand Theft Auto: San Andreas (PAL)')).hltbId, 4073);
});

test('HLTB: sin coincidencia razonable → null (no inventa)', async () => {
  const { http } = fakeHltb({ games: { 'Grand Theft Auto: San Andreas': GTA } });
  assert.equal(await createHltb(http).lookup('Tetris'), null);
});

test('HLTB vía núcleo: j:hltbFetch guarda en BD y usa RAWG como nombre alternativo', async () => {
  const fake = fakeHltb({ games: { 'Grand Theft Auto: San Andreas': GTA } });
  const http = async (url, o) => {
    if (url.startsWith('https://api.rawg.io/')) return { status: 200, text: JSON.stringify({ results: [{ name: 'Grand Theft Auto: San Andreas' }] }) };
    return fake.http(url, o);
  };
  const c = mk({ http });
  const p = c.handlers['p:create']({ nombre: 'PS2' });
  const j = c.handlers['j:create']({ plataformaId: p.id, nombre: 'GTA: San Andreas (Edición España)', autoEnrich: false });
  const r = await c.handlers['j:hltbFetch']({ id: j.id, nombre: j.nombre });
  assert.ok(r.ok, r.error);
  assert.equal(c.handlers['j:one'](j.id).hltbMain, 30.1);
});

test('HLTB vía núcleo: error de red → mensaje claro, no excepción', async () => {
  const c = mk({ http: async () => { throw new Error('getaddrinfo ENOTFOUND'); } });
  const p = c.handlers['p:create']({ nombre: 'PS2' });
  const j = c.handlers['j:create']({ plataformaId: p.id, nombre: 'GTA', autoEnrich: false });
  const r = await c.handlers['j:hltbFetch']({ id: j.id });
  assert.equal(r.ok, false); assert.ok(r.error);
});

// ── Ventas ───────────────────────────────────────────────────────────────────
function fakeVgc() {
  return async url => {
    const u = new URL(url);
    if (u.pathname === '/games/games.php') {
      const n = u.searchParams.get('name').toLowerCase();
      if (n.includes('san andreas')) return { status: 200, text: FIX('vgc_s1.html') };
      if (n.includes('mario 64')) return { status: 200, text: FIX('vgc_s2.html') };
      if (n.includes('mario kart 8')) return { status: 200, text: `<table><tr><td>1</td><td></td><td><a href="https://www.vgchartz.com/game/153114/mario-kart-8-deluxe/?region=All">Mario Kart 8 Deluxe</a></td><td><img src="/images/consoles/NS_b.png" alt="NS"></td><td>71.53m</td><td>N/A</td><td>28th Apr 17</td></tr></table>` };
      return { status: 200, text: '<table></table>' };
    }
    if (u.pathname === '/game/227491/grand-theft-auto-san-andreas/sales') return { status: 200, text: FIX('vgc_p1.html') };
    if (u.pathname === '/game/153114/mario-kart-8-deluxe/sales') return { status: 200, text: FIX('vgc_p2.html') };
    if (u.pathname.endsWith('/sales')) return { status: 200, text: '<h1>Latest Sales Updates</h1><table></table>' };
    return { status: 404, text: '' };
  };
}

test('Ventas: GTA San Andreas → 27,5 M globales (fila "All"), historial de 1 punto', async () => {
  const r = await createVentas(fakeVgc()).lookup('Grand Theft Auto: San Andreas');
  assert.equal(r.total, 27500000);
  assert.equal(r.history.length, 1);
  assert.ok(r.porConsola.some(x => x.consola === 'PS2' && x.total === 17300000));
});

test('Ventas: sin fila "All" se suman las consolas (Super Mario 64)', async () => {
  const r = await createVentas(fakeVgc()).lookup('Super Mario 64');
  assert.equal(r.total, 11910000);
  assert.equal(r.nombre, 'Super Mario 64');
});

test('Ventas: juego moderno con serie temporal (Mario Kart 8 Deluxe, 10 puntos)', async () => {
  const r = await createVentas(fakeVgc()).lookup('Mario Kart 8 Deluxe');
  assert.equal(r.total, 71530000);
  assert.equal(r.history.length, 10);
  assert.ok(r.history.every((p, i, a) => i === 0 || a[i - 1].date <= p.date));
});

test('Ventas: no encontrado → null', async () => {
  assert.equal(await createVentas(fakeVgc()).lookup('Juego Inexistente XYZ'), null);
});

test('Ventas vía núcleo: j:ventasFetch guarda total e historial', async () => {
  const c = mk({ http: fakeVgc() });
  const p = c.handlers['p:create']({ nombre: 'PS2' });
  const j = c.handlers['j:create']({ plataformaId: p.id, nombre: 'Grand Theft Auto: San Andreas', autoEnrich: false });
  const r = await c.handlers['j:ventasFetch']({ id: j.id });
  assert.ok(r.ok);
  const row = c.handlers['j:one'](j.id);
  assert.equal(row.ventasTotal, 27500000);
  assert.equal(JSON.parse(row.ventasJson).history.length, 1);
});

test('auto-enriquecimiento al crear (cola en segundo plano) y aviso a la UI', async () => {
  const fake = fakeHltb({ games: { 'Grand Theft Auto: San Andreas': GTA } });
  const vgc = fakeVgc();
  const events = [];
  const c = mk({ http: (u, o) => (u.includes('vgchartz') ? vgc(u, o) : fake.http(u, o)), onChange: e => events.push(e) });
  const p = c.handlers['p:create']({ nombre: 'PS2' });
  const j = c.handlers['j:create']({ plataformaId: p.id, nombre: 'Grand Theft Auto: San Andreas' });
  assert.equal(j.hltbMain, null, 'la creación no espera a la red');
  for (let i = 0; i < 50 && events.length < 2; i++) await new Promise(r => setTimeout(r, 100));
  const row = c.handlers['j:one'](j.id);
  assert.equal(row.hltbMain, 30.1);
  assert.equal(row.ventasTotal, 27500000);
  assert.ok(events.length >= 2);
});

test('HLTB: "El Rey León" (nombre en español) → usa el título inglés y elige "Disney\'s The Lion King" (1994), no "Lion and the King 2"', async () => {
  // Lista real devuelta por HLTB para "The Lion King" (18-10-2026)
  const lion = [
    { game_id: 1, game_name: 'Disney Classic Games: Aladdin and The Lion King', game_alias: '', comp_main: 15315, comp_plus: 0, comp_100: 0, release_world: 2019 },
    { game_id: 2, game_name: "Disney's The Lion King", game_alias: '', comp_main: 7675, comp_plus: 9000, comp_100: 12000, release_world: 1994 },
    { game_id: 3, game_name: "The Lion King: Simba's Mighty Adventure", game_alias: '', comp_main: 4393, comp_plus: 0, comp_100: 0, release_world: 2000 },
    { game_id: 4, game_name: 'Lion and the King 2', game_alias: 'Son of the Lion King', comp_main: 0, comp_plus: 2900, comp_100: 0, release_world: 2003 },
  ];
  const http = async (url, o) => {
    const u = new URL(url);
    if (u.pathname === '/') return { status: 200, text: '' };
    if (u.pathname.endsWith('/init')) return { status: 200, text: '{"token":"t"}' };
    const terms = JSON.parse(o.body).searchTerms.join(' ').toLowerCase();
    return { status: 200, text: JSON.stringify({ data: terms.includes('lion') ? lion : [] }) };
  };
  const r = await createHltb(http).lookup('El Rey León', { year: 1994, altNames: ['The Lion King'] });
  assert.equal(r.hltbId, 2);
  const r2 = await createHltb(http).lookup('El Rey León', { altNames: ['The Lion King'] });
  assert.equal(r2.hltbId, 2, 'también sin año');
  assert.equal(await createHltb(http).lookup('El Rey León'), null, 'sin nombre alternativo no inventa');
});

// ── Títulos en castellano → inglés (Wikipedia) ───────────────────────────────
function fakeWorld() {
  const H = (id, name, m, p, c, y, alias = '') => ({ game_id: id, game_name: name, game_alias: alias, comp_main: m, comp_plus: p, comp_100: c, release_world: y });
  const hltbDb = [
    H(1, 'Personal Trainer: Cooking', 37760, 0, 0, 2008, "Cooking Guide: Can't Decide What to Eat?"),
    H(2, 'The Simpsons Game', 27758, 43251, 62925, 2007),
    H(3, 'The Simpsons Arcade Game', 2999, 4794, 5031, 1991),
  ];
  const wiki = {   // respuestas reales de es.wikipedia (18-10-2026)
    search: { 'cocina': ['Touch! Generations', '¡Cocina conmigo!: ¿Qué preparamos hoy?', 'Indieszero'],
              'simpsons': ['The Simpsons Hit & Run', 'Los Simpson: el videojuego', 'The Simpsons (videojuego)'] },
    en: { '¡Cocina conmigo!: ¿Qué preparamos hoy?': "Cooking Guide: Can't Decide What to Eat?", 'Los Simpson: el videojuego': 'The Simpsons Game',
          'The Simpsons Hit & Run': 'The Simpsons: Hit & Run', 'Touch! Generations': 'Touch! Generations', 'Indieszero': 'Indieszero', 'The Simpsons (videojuego)': 'The Simpsons (video game)' },
  };
  const vgc = { 'personal trainer cooking': '<tr><td>1</td><td></td><td><a href="https://www.vgchartz.com/game/1/personal-trainer-cooking/?region=All">Personal Trainer: Cooking</a></td><td><img src="/images/consoles/DS_b.png" alt="DS"></td><td>3.18m</td><td>N/A</td><td>23rd Jun 08</td></tr>',
                'the simpsons game': '<tr><td>1</td><td></td><td><a href="https://www.vgchartz.com/game/2/the-simpsons-game/?region=All">The Simpsons Game</a></td><td><img src="/images/consoles/All_b.png" alt="All"></td><td>4.00m</td><td>N/A</td><td>30th Oct 07</td></tr>' };
  const calls = [];
  const http = async (url, o) => {
    const u = new URL(url); calls.push(u.hostname + u.pathname);
    if (u.hostname === 'es.wikipedia.org') {
      if (u.searchParams.get('list') === 'search') {
        const q = u.searchParams.get('srsearch').toLowerCase();
        const k = Object.keys(wiki.search).find(k => q.includes(k));
        return { status: 200, text: JSON.stringify({ query: { search: (wiki.search[k] || []).map(t => ({ title: t, snippet: 'videojuego para Nintendo DS' })) } }) };
      }
      const titles = u.searchParams.get('titles').split('|');
      return { status: 200, text: JSON.stringify({ query: { pages: Object.fromEntries(titles.map((t, i) => [i, { title: t, langlinks: [{ '*': wiki.en[t] }] }])) } }) };
    }
    if (u.hostname === 'howlongtobeat.com') {
      if (u.pathname === '/') return { status: 200, text: '' };
      if (u.pathname.endsWith('/init')) return { status: 200, text: '{"token":"t"}' };
      const terms = JSON.parse(o.body).searchTerms.join(' ').toLowerCase();
      const data = hltbDb.filter(g => (g.game_name + ' ' + g.game_alias).toLowerCase().replace(/[^a-z0-9 ]/g, '').includes(terms.replace(/[^a-z0-9 ]/g, '')));
      return { status: 200, text: JSON.stringify({ data }) };
    }
    if (u.hostname === 'www.vgchartz.com') {
      if (u.pathname.endsWith('/sales')) return { status: 200, text: '' };
      const n = u.searchParams.get('name').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
      return { status: 200, text: `<table>${vgc[n] || ''}</table>` };
    }
    if (u.hostname === 'api.rawg.io') return { status: 200, text: '{"results":[]}' };
    return { status: 404, text: '' };
  };
  return { http, calls };
}

test('Título en castellano "Qué preparamos hoy? Cocina conmigo" → Wikipedia → HLTB "Personal Trainer: Cooking" → ventas 3,18 M', async () => {
  const w = fakeWorld();
  const c = mk({ http: w.http });
  const p = c.handlers['p:create']({ nombre: 'Nintendo DS' });
  const j = c.handlers['j:create']({ plataformaId: p.id, nombre: 'Qué preparamos hoy? Cocina conmigo', autoEnrich: false });
  const h = await c.handlers['j:hltbFetch']({ id: j.id });
  assert.ok(h.ok, h.error);
  assert.equal(h.hltbMain, 10.5);
  const v = await c.handlers['j:ventasFetch']({ id: j.id });
  assert.ok(v.ok, v.error);
  assert.equal(v.total, 3180000);
  const row = c.handlers['j:one'](j.id);
  assert.equal(row.hltbName, 'Personal Trainer: Cooking');
  assert.ok(JSON.parse(row.tituloIngles).includes("Cooking Guide: Can't Decide What to Eat?"));
  // la traducción se guarda: una segunda consulta no vuelve a preguntar a Wikipedia
  const nWiki = w.calls.filter(x => x.startsWith('es.wikipedia')).length;
  await c.handlers['j:hltbFetch']({ id: j.id });
  assert.equal(w.calls.filter(x => x.startsWith('es.wikipedia')).length, nWiki);
});

test('"Los Simpsons: El videojuego" (PSP) → "The Simpsons Game" (no "Hit & Run" ni "Arcade")', async () => {
  const c = mk({ http: fakeWorld().http });
  const p = c.handlers['p:create']({ nombre: 'PSP' });
  const j = c.handlers['j:create']({ plataformaId: p.id, nombre: 'Los Simpsons: El videojuego', autoEnrich: false });
  const h = await c.handlers['j:hltbFetch']({ id: j.id });
  assert.equal(h.hltbName, 'The Simpsons Game');
  assert.equal(h.hltbMain, 7.7);
  assert.equal((await c.handlers['j:ventasFetch']({ id: j.id })).total, 4000000);
});

test('Campo manual "Título original": tiene prioridad y al cambiarlo se vuelven a buscar los datos', async () => {
  const c = mk({ http: fakeWorld().http });
  const p = c.handlers['p:create']({ nombre: 'Nintendo DS' });
  const j = c.handlers['j:create']({ plataformaId: p.id, nombre: 'Mi juego de cocina', tituloOriginal: 'Personal Trainer: Cooking', autoEnrich: false });
  assert.equal(c.handlers['j:one'](j.id).tituloOriginal, 'Personal Trainer: Cooking');
  assert.equal((await c.handlers['j:hltbFetch']({ id: j.id })).hltbName, 'Personal Trainer: Cooking');
  const u = c.handlers['j:update']({ ...c.handlers['j:one'](j.id), tituloOriginal: 'The Simpsons Game' });
  assert.equal(u.hltbMain, null, 'al cambiar el título original se limpian los datos para re-buscarlos');
});

test('Importar duraciones: si no se encuentra, keepOnMiss conserva los tiempos; informa si cambió', async () => {
  const c = mk({ http: fakeWorld().http });
  const p = c.handlers['p:create']({ nombre: 'X' });
  const j = c.handlers['j:create']({ plataformaId: p.id, nombre: 'Juego Que No Existe', autoEnrich: false });
  c.run('UPDATE juegos SET hltbMain=5, tituloIngles=? WHERE id=?', ['[]', j.id]);
  const r = await c.handlers['j:hltbFetch']({ id: j.id, keepOnMiss: true });
  assert.equal(r.notFound, true);
  assert.equal(c.handlers['j:one'](j.id).hltbMain, 5);
  const j2 = c.handlers['j:create']({ plataformaId: p.id, nombre: 'The Simpsons Game', autoEnrich: false });
  assert.equal((await c.handlers['j:hltbFetch']({ id: j2.id, keepOnMiss: true })).changed, true);
  assert.equal((await c.handlers['j:hltbFetch']({ id: j2.id, keepOnMiss: true })).changed, false);
});

test('p:all incluye nº de juegos y unidades por plataforma', () => {
  const c = mk();
  const p = c.handlers['p:create']({ nombre: 'GB' });
  c.handlers['j:create']({ plataformaId: p.id, nombre: 'Tetris', unidades: 3, autoEnrich: false });
  c.handlers['j:create']({ plataformaId: p.id, nombre: 'Zelda', autoEnrich: false });
  const row = c.handlers['p:all']().find(x => x.id === p.id);
  assert.equal(row.numJuegos, 2); assert.equal(row.unidadesJuegos, 4);
});

test('Borrar colección: por partes y completo (plataformas arrastra juegos y vuelve el asistente)', async () => {
  const c = mk({ persist: () => {} });
  c.importColeccion(INITIAL, { replace: true });
  await c.handle('d:create', { nombre: 'Deseo de prueba', plataforma: 'Switch' });
  await c.handle('app:completeOnboarding');
  await c.handle('cfg:set', 'rawg_api_key', 'k123');
  const n0 = await c.handle('data:counts');
  assert.ok(n0.plataformas > 0 && n0.juegos > 0 && n0.deseos > 0);
  // Solo la lista de deseos
  let r = await c.handle('data:wipe', { deseos: true });
  assert.deepEqual(await c.handle('data:counts'), { ...n0, deseos: 0 });
  assert.equal(r.borrados.deseos, n0.deseos);
  // Solo juegos: las consolas se quedan
  r = await c.handle('data:wipe', { juegos: true });
  assert.deepEqual(await c.handle('data:counts'), { plataformas: n0.plataformas, juegos: 0, deseos: 0 });
  assert.equal(await c.handle('app:isFirstRun'), false);
  // Plataformas sin marcar juegos: se borran igualmente (los juegos pertenecen a la consola)
  await c.importColeccion(INITIAL, { replace: true });
  r = await c.handle('data:wipe', { plataformas: true, juegos: false });
  assert.deepEqual(await c.handle('data:counts'), { plataformas: 0, juegos: 0, deseos: 0 });
  assert.equal(r.borrados.juegos, n0.juegos);
  assert.equal(await c.handle('app:isFirstRun'), true, 'sin consolas vuelve el asistente');
  assert.equal(await c.handle('cfg:get', 'rawg_api_key'), 'k123', 'los ajustes se conservan');
});
