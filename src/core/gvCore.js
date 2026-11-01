/* eslint-disable */
// ─── Núcleo de datos de GameVault ─────────────────────────────────────────────
// Lo usan tanto Electron (electron/main.js) como la versión web/Android
// (src/platform/webApi.js). No depende de Node ni del navegador: recibe
//   SQL      → módulo sql.js ya inicializado
//   bytes    → Uint8Array con la BD existente (o null para crear una nueva)
//   persist  → (Uint8Array) => void   guarda la BD
//   http     → (url, {method, headers, body}) => Promise<{status, text}>
//   onChange → (evento) => void        avisa a la UI de cambios en segundo plano

const { createHltb } = require('./hltb');
const { createVentas } = require('./ventas');
const { englishTitlesFromWikipedia } = require('./titulos');

let RAWG_DEFAULT_KEY = '';   // viene de .env.local al compilar (scripts/gen-keys.js)
try { RAWG_DEFAULT_KEY = require('./keys').RAWG_KEY || ''; } catch {}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS plataformas (
    id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL,
    marca TEXT, modelo TEXT, tipo TEXT, fechaAdquisicion TEXT,
    fechaLanzamientoEuropa TEXT, fechaLanzamientoAmerica TEXT, fechaLanzamientoAsia TEXT,
    precio REAL, precioSalida REAL, precioAmerica REAL, precioAsia REAL,
    unidadesVendidas TEXT, comentarios TEXT, imagenes TEXT DEFAULT '[]',
    unidades INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS juegos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, plataformaId INTEGER NOT NULL,
    nombre TEXT NOT NULL, precio REAL, genero TEXT, numeroDeJugadores INTEGER,
    modoDeJuego TEXT, desarrolladora TEXT, fechaAdquisicion TEXT, fechaLanzamiento TEXT,
    region TEXT, idiomas TEXT, estado TEXT, comentarios TEXT, imagenes TEXT DEFAULT '[]',
    valoracion INTEGER, prestadoA TEXT, fechaPrestamo TEXT,
    unidades INTEGER DEFAULT 1, tituloOriginal TEXT, tituloIngles TEXT, hltbName TEXT,
    hltbMain REAL, hltbExtra REAL, hltbComplete REAL, hltbFetched TEXT,
    ventasTotal REAL, ventasJson TEXT, ventasFetched TEXT,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (plataformaId) REFERENCES plataformas(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS deseos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL,
    plataforma TEXT, genero TEXT, desarrolladora TEXT, fechaLanzamiento TEXT,
    precioEstimado REAL, prioridad INTEGER DEFAULT 2, url TEXT, notas TEXT,
    imagenes TEXT DEFAULT '[]', rawgId TEXT,
    createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT);
`;

// Columnas añadidas en versiones posteriores (migración automática)
const MIGRATIONS = {
  plataformas: [['unidades', 'INTEGER DEFAULT 1']],
  juegos: [
    ['valoracion', 'INTEGER'], ['prestadoA', 'TEXT'], ['fechaPrestamo', 'TEXT'],
    ['unidades', 'INTEGER DEFAULT 1'],
    ['hltbMain', 'REAL'], ['hltbExtra', 'REAL'], ['hltbComplete', 'REAL'], ['hltbFetched', 'TEXT'],
    ['ventasTotal', 'REAL'], ['ventasJson', 'TEXT'], ['ventasFetched', 'TEXT'],
    ['tituloOriginal', 'TEXT'], ['tituloIngles', 'TEXT'], ['hltbName', 'TEXT'],
  ],
  deseos: [],
};

const PLAT_FIELDS = ['nombre', 'marca', 'modelo', 'tipo', 'fechaAdquisicion', 'fechaLanzamientoEuropa',
  'fechaLanzamientoAmerica', 'fechaLanzamientoAsia', 'precio', 'precioSalida', 'precioAmerica', 'precioAsia',
  'unidadesVendidas', 'comentarios', 'imagenes', 'unidades'];
const JUEGO_FIELDS = ['plataformaId', 'nombre', 'precio', 'genero', 'numeroDeJugadores', 'modoDeJuego',
  'desarrolladora', 'fechaAdquisicion', 'fechaLanzamiento', 'region', 'idiomas', 'estado', 'comentarios',
  'imagenes', 'valoracion', 'prestadoA', 'fechaPrestamo', 'unidades', 'tituloOriginal'];
const DESEO_FIELDS = ['nombre', 'plataforma', 'genero', 'desarrolladora', 'fechaLanzamiento', 'precioEstimado',
  'prioridad', 'url', 'notas', 'imagenes', 'rawgId'];
const NUMERIC = new Set(['precio', 'precioSalida', 'precioAmerica', 'precioAsia', 'numeroDeJugadores',
  'valoracion', 'plataformaId', 'precioEstimado', 'prioridad', 'unidades']);

// Normaliza un valor de formulario para la BD
function clean(field, v) {
  if (field === 'imagenes') {
    if (Array.isArray(v)) return JSON.stringify(v);
    if (typeof v === 'string') { try { const a = JSON.parse(v); return JSON.stringify(Array.isArray(a) ? a : []); } catch { return '[]'; } }
    return '[]';
  }
  if (field === 'unidades') {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') v = v.trim();
  if (v === '') return null;
  if (NUMERIC.has(field)) {
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return v;
}

function createCore({ SQL, bytes, persist = () => {}, http = null, onChange = () => {}, log = () => {} }) {
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  const isNew = !bytes;

  // ── helpers SQL ──────────────────────────────────────────────────────────
  let batchDepth = 0;
  const save = () => { if (batchDepth === 0) { try { persist(db.export()); } catch (e) { log('Error guardando BD:', e.message); } } };
  function all(sql, p = []) {
    const s = db.prepare(sql); s.bind(p);
    const rows = []; while (s.step()) rows.push(s.getAsObject()); s.free(); return rows;
  }
  const one = (sql, p = []) => all(sql, p)[0] || null;
  function run(sql, p = []) {
    db.run(sql, p);
    const id = db.exec('SELECT last_insert_rowid() id')[0]?.values[0][0];
    save();
    return id;
  }
  function batch(fn) {
    batchDepth++;
    db.run('BEGIN');
    try { const r = fn(); db.run('COMMIT'); return r; }
    catch (e) { try { db.run('ROLLBACK'); } catch {} throw e; }
    finally { batchDepth--; save(); }
  }
  const cols = t => all(`PRAGMA table_info(${t})`).map(r => r.name);

  // ── Esquema y migraciones ────────────────────────────────────────────────
  db.run(SCHEMA);
  for (const [table, list] of Object.entries(MIGRATIONS)) {
    const have = cols(table);
    for (const [c, type] of list) if (!have.includes(c)) db.run(`ALTER TABLE ${table} ADD COLUMN ${c} ${type}`);
  }
  // Filas antiguas sin unidades → 1
  db.run('UPDATE juegos SET unidades=1 WHERE unidades IS NULL OR unidades<1');
  db.run('UPDATE plataformas SET unidades=1 WHERE unidades IS NULL OR unidades<1');
  // Limpiar juegos huérfanos (antes no se activaban las claves foráneas)
  db.run('DELETE FROM juegos WHERE plataformaId NOT IN (SELECT id FROM plataformas)');
  db.run('PRAGMA foreign_keys = ON');
  save();

  // ── Importar / exportar colección ────────────────────────────────────────
  function importColeccion(data, { replace = false } = {}) {
    if (!data || typeof data !== 'object') throw new Error('Fichero no válido');
    const plats = Array.isArray(data.plataformas) ? data.plataformas : [];
    const juegos = Array.isArray(data.juegos) ? data.juegos : [];
    const deseos = Array.isArray(data.deseos) ? data.deseos : [];
    if (!plats.length && !juegos.length && !deseos.length) throw new Error('El fichero no contiene plataformas, juegos ni deseos');
    // Sin claves foráneas durante la importación: INSERT OR REPLACE en una plataforma
    // borraría en cascada sus juegos, y un juego huérfano abortaría todo el fichero.
    db.run('PRAGMA foreign_keys = OFF');
    try { return importBody(plats, juegos, deseos, replace); }
    finally {
      db.run('DELETE FROM juegos WHERE plataformaId NOT IN (SELECT id FROM plataformas)');
      db.run('PRAGMA foreign_keys = ON');
      save();
    }
  }
  function importBody(plats, juegos, deseos, replace) {
    return batch(() => {
      if (replace) { db.run('DELETE FROM juegos'); db.run('DELETE FROM plataformas'); if (deseos.length) db.run('DELETE FROM deseos'); }
      const ins = (table, row) => {
        const valid = cols(table);
        const keys = Object.keys(row).filter(k => valid.includes(k));
        if (!keys.length) return;
        const vals = keys.map(k => {
          let v = row[k];
          if (k === 'imagenes') return clean('imagenes', v);
          if (k === 'unidades') return clean('unidades', v);
          if (v !== null && typeof v === 'object') v = JSON.stringify(v);
          return v === undefined ? null : v;
        });
        db.run(`INSERT OR REPLACE INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, vals);
      };
      plats.forEach(p => ins('plataformas', p));
      juegos.forEach(j => ins('juegos', j));
      deseos.forEach(d => ins('deseos', d));
      db.run('UPDATE juegos SET unidades=1 WHERE unidades IS NULL OR unidades<1');
      db.run('UPDATE plataformas SET unidades=1 WHERE unidades IS NULL OR unidades<1');
      return { plataformas: plats.length, juegos: juegos.length, deseos: deseos.length };
    });
  }
  const exportData = () => ({
    version: '1.8', app: 'GameVault', exportedAt: new Date().toISOString(),
    plataformas: all('SELECT * FROM plataformas'),
    juegos: all('SELECT * FROM juegos'),
    deseos: all('SELECT * FROM deseos'),
  });

  // ── Servicios externos (HLTB / ventas / RAWG) ────────────────────────────
  const hltb = http ? createHltb(http, log) : null;
  const ventas = http ? createVentas(http, log) : null;

  async function rawgNames(nombre) {
    if (!http) return [];
    try {
      const key = (one("SELECT value FROM config WHERE key='rawg_api_key'") || {}).value || RAWG_DEFAULT_KEY;
      const r = await http(`https://api.rawg.io/api/games?key=${encodeURIComponent(key)}&search=${encodeURIComponent(nombre)}&page_size=3`, { method: 'GET', headers: { Accept: 'application/json' } });
      if (r.status !== 200) return [];
      const j = JSON.parse(r.text);
      return (j.results || []).map(g => g.name).filter(Boolean);
    } catch { return []; }
  }

  /**
   * Nombres alternativos (normalmente el título en inglés) para un juego cuyo título
   * está en otro idioma: Wikipedia en español → artículo inglés, y RAWG.
   * Se guardan en juegos.tituloIngles para no repetir la consulta.
   */
  async function altNamesFor(juego) {
    if (juego.tituloIngles != null) { try { return JSON.parse(juego.tituloIngles) || []; } catch { return []; } }
    let names = [];
    try { names = await englishTitlesFromWikipedia(http, juego.nombre); } catch (e) { log('[Títulos] Wikipedia:', e.message); }
    try { names = names.concat(await rawgNames(juego.nombre)); } catch {}
    names = [...new Set(names.filter(n => n && n.toLowerCase() !== String(juego.nombre).toLowerCase()))].slice(0, 4);
    log(`[Títulos] "${juego.nombre}" → ${names.length ? names.join(' | ') : '(sin alternativas)'}`);
    if (juego.id) { juego.tituloIngles = JSON.stringify(names); run('UPDATE juegos SET tituloIngles=? WHERE id=?', [juego.tituloIngles, juego.id]); }
    return names;
  }
  // El título "de búsqueda": el que haya escrito el usuario en Título original, si no el nombre
  const searchName = j => String(j.tituloOriginal || '').trim() || j.nombre;

  async function fetchHltbFor(juego) {
    if (!hltb) throw new Error('Sin conexión a internet en esta plataforma');
    const year = (juego.fechaLanzamiento || '').slice(0, 4) || null;
    const main = searchName(juego);
    let res = await hltb.lookup(main, { year, altNames: main !== juego.nombre ? [juego.nombre] : [] });
    if (!res) {
      const alt = await altNamesFor(juego);   // título traducido/canónico en inglés
      if (alt.length) res = await hltb.lookup(alt[0], { year, altNames: [...alt.slice(1), main] });
    }
    return res;
  }

  async function fetchVentasFor(juego) {
    if (!ventas) throw new Error('Sin conexión a internet en esta plataforma');
    const main = searchName(juego);
    // El nombre canónico que devolvió HLTB suele ser el de VGChartz (p.ej. "Personal Trainer: Cooking")
    const extra = [juego.hltbName].filter(n => n && n !== main);
    let res = await ventas.lookup(main, { altNames: [...extra, ...(main !== juego.nombre ? [juego.nombre] : [])] });
    if (!res) {
      const alt = await altNamesFor(juego);
      if (alt.length || extra.length) res = await ventas.lookup(alt[0] || extra[0], { altNames: [...alt.slice(1), ...extra, main] });
    }
    return res;
  }

  const netMsg = (site, e) => (/fetch|ENOTFOUND|ECONN|ERR_|network|tiempo agotado|timeout/i.test(e.message || '')
    ? `No se pudo conectar con ${site}. Comprueba la conexión a internet.`
    : e.message);

  function saveHltb(id, r) {
    run(`UPDATE juegos SET hltbMain=?,hltbExtra=?,hltbComplete=?,hltbName=?,hltbFetched=datetime('now') WHERE id=?`,
      [r ? r.hltbMain : null, r ? r.hltbExtra : null, r ? r.hltbComplete : null, r ? r.hltbName : null, id]);
  }
  function saveVentas(id, r) {
    run(`UPDATE juegos SET ventasTotal=?,ventasJson=?,ventasFetched=datetime('now') WHERE id=?`,
      [r ? r.total : null, r ? JSON.stringify(r) : null, id]);
  }

  // Cola en segundo plano: una petición cada ~1,2 s para no saturar HLTB/VGChartz
  const queue = [];
  let working = false;
  function enqueue(task) {
    queue.push(task);
    if (!working) pump();
  }
  async function pump() {
    working = true;
    while (queue.length) {
      const t = queue.shift();
      try { await t(); } catch (e) { log('[cola] tarea falló:', e.message); }
      await new Promise(r => setTimeout(r, 1200));
    }
    working = false;
  }
  function scheduleEnrich(id, { hltb: doH = true, ventas: doV = true } = {}) {
    if (!http) return;
    enqueue(async () => {
      const j = one('SELECT * FROM juegos WHERE id=?', [id]);
      if (!j) return;
      if (doH) { try { saveHltb(id, await fetchHltbFor(j)); onChange({ type: 'juego', id }); } catch (e) { log('[HLTB] auto:', e.message); } }
      if (doV) { try { saveVentas(id, await fetchVentasFor(j)); onChange({ type: 'juego', id }); } catch (e) { log('[Ventas] auto:', e.message); } }
    });
  }

  // ── Operaciones ──────────────────────────────────────────────────────────
  const insertRow = (table, fields, d) => run(
    `INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
    fields.map(f => clean(f, d[f])));
  const updateRow = (table, fields, d) => run(
    `UPDATE ${table} SET ${fields.map(f => f + '=?').join(',')},updatedAt=datetime('now') WHERE id=?`,
    [...fields.map(f => clean(f, d[f])), d.id]);

  const handlers = {
    // Plataformas
    'p:all': () => all(`SELECT p.*,
        (SELECT COUNT(*) FROM juegos j WHERE j.plataformaId=p.id) numJuegos,
        (SELECT COALESCE(SUM(COALESCE(j.unidades,1)),0) FROM juegos j WHERE j.plataformaId=p.id) unidadesJuegos
      FROM plataformas p ORDER BY p.nombre COLLATE NOCASE`),
    'p:one': id => one('SELECT * FROM plataformas WHERE id=?', [Number(id)]),
    'p:create': d => {
      if (!d || !String(d.nombre || '').trim()) throw new Error('El nombre es obligatorio');
      const id = insertRow('plataformas', PLAT_FIELDS, d);
      return one('SELECT * FROM plataformas WHERE id=?', [id]);
    },
    'p:update': d => {
      if (!d || !d.id) throw new Error('Falta el id');
      updateRow('plataformas', PLAT_FIELDS, d);
      return one('SELECT * FROM plataformas WHERE id=?', [d.id]);
    },
    'p:delete': id => {
      batch(() => { db.run('DELETE FROM juegos WHERE plataformaId=?', [Number(id)]); db.run('DELETE FROM plataformas WHERE id=?', [Number(id)]); });
      return { ok: true };
    },

    // Juegos
    'j:all': (f = {}) => {
      f = f || {};
      let q = `SELECT j.*,p.nombre plataformaNombre,p.marca plataformaMarca
        FROM juegos j LEFT JOIN plataformas p ON j.plataformaId=p.id WHERE 1=1`;
      const p = [];
      if (f.plataformaId) { q += ' AND j.plataformaId=?'; p.push(Number(f.plataformaId)); }
      if (f.genero) { q += ' AND j.genero=?'; p.push(f.genero); }
      if (f.estado) { q += ' AND j.estado=?'; p.push(f.estado); }
      if (f.region) { q += ' AND j.region=?'; p.push(f.region); }
      if (f.anio) { q += " AND substr(j.fechaLanzamiento,1,4)=?"; p.push(String(f.anio)); }
      if (f.busqueda) { q += ' AND j.nombre LIKE ?'; p.push('%' + f.busqueda + '%'); }
      if (f.desarrolladora) { q += ' AND j.desarrolladora=?'; p.push(f.desarrolladora); }
      if (f.prestado) { q += " AND j.prestadoA IS NOT NULL AND j.prestadoA!=''"; }
      return all(q + ' ORDER BY p.nombre COLLATE NOCASE, j.nombre COLLATE NOCASE', p);
    },
    'j:byPlat': id => all('SELECT * FROM juegos WHERE plataformaId=? ORDER BY nombre COLLATE NOCASE', [Number(id)]),
    'j:one': id => one('SELECT * FROM juegos WHERE id=?', [Number(id)]),
    'j:create': d => {
      if (!d || !String(d.nombre || '').trim()) throw new Error('El nombre es obligatorio');
      if (!d.plataformaId || !one('SELECT id FROM plataformas WHERE id=?', [Number(d.plataformaId)])) throw new Error('Plataforma no válida');
      const id = insertRow('juegos', JUEGO_FIELDS, d);
      if (d.autoEnrich !== false) scheduleEnrich(id);
      return one('SELECT * FROM juegos WHERE id=?', [id]);
    },
    'j:update': d => {
      if (!d || !d.id) throw new Error('Falta el id');
      const before = one('SELECT nombre, tituloOriginal FROM juegos WHERE id=?', [d.id]);
      updateRow('juegos', JUEGO_FIELDS, d);
      // Si cambia el nombre o el título original, los datos de duración/ventas ya no valen
      if (before && (clean('nombre', d.nombre) !== before.nombre || clean('tituloOriginal', d.tituloOriginal) !== (before.tituloOriginal ?? null))) {
        run('UPDATE juegos SET hltbMain=NULL,hltbExtra=NULL,hltbComplete=NULL,hltbName=NULL,hltbFetched=NULL,ventasTotal=NULL,ventasJson=NULL,ventasFetched=NULL,tituloIngles=NULL WHERE id=?', [d.id]);
        scheduleEnrich(d.id);
      }
      return one('SELECT * FROM juegos WHERE id=?', [d.id]);
    },
    'j:delete': id => { run('DELETE FROM juegos WHERE id=?', [Number(id)]); return { ok: true }; },
    'j:needsCovers': () => all("SELECT id, nombre, plataformaId FROM juegos WHERE imagenes='[]' OR imagenes IS NULL OR imagenes=''"),
    'j:updateCovers': ({ id, imagenes }) => { run(`UPDATE juegos SET imagenes=?, updatedAt=datetime('now') WHERE id=?`, [clean('imagenes', imagenes), id]); return { ok: true }; },
    'j:prestados': () => all(`SELECT j.*,p.nombre plataformaNombre FROM juegos j LEFT JOIN plataformas p ON j.plataformaId=p.id
      WHERE j.prestadoA IS NOT NULL AND j.prestadoA != '' ORDER BY j.fechaPrestamo DESC`),
    'j:prestar': ({ id, prestadoA, fechaPrestamo }) => {
      run(`UPDATE juegos SET prestadoA=?,fechaPrestamo=?,updatedAt=datetime('now') WHERE id=?`, [clean('prestadoA', prestadoA), clean('fechaPrestamo', fechaPrestamo), id]);
      return one('SELECT * FROM juegos WHERE id=?', [id]);
    },
    'j:devolver': id => {
      run(`UPDATE juegos SET prestadoA=NULL,fechaPrestamo=NULL,updatedAt=datetime('now') WHERE id=?`, [id]);
      return one('SELECT * FROM juegos WHERE id=?', [id]);
    },
    // keepOnMiss: si no se encuentra, conservar los tiempos que hubiera (importación masiva)
    'j:hltbFetch': async ({ id, nombre, keepOnMiss = false } = {}) => {
      const j = one('SELECT * FROM juegos WHERE id=?', [Number(id)]) || { id, nombre };
      if (nombre) j.nombre = nombre;
      const before = [j.hltbMain, j.hltbExtra, j.hltbComplete].map(v => v ?? null);
      try {
        const r = await fetchHltbFor(j);
        if (!r) {
          if (j.id && !keepOnMiss) saveHltb(j.id, null);
          return { ok: false, notFound: true, error: `"${j.nombre}" no aparece en HowLongToBeat` };
        }
        if (j.id) saveHltb(j.id, r);
        const changed = [r.hltbMain, r.hltbExtra, r.hltbComplete].some((v, i) => (v ?? null) !== before[i]);
        return { ok: true, changed, ...r };
      } catch (e) { return { ok: false, error: netMsg('HowLongToBeat', e) }; }
    },
    'j:ventasFetch': async ({ id, nombre } = {}) => {
      const j = one('SELECT * FROM juegos WHERE id=?', [Number(id)]) || { id, nombre };
      if (nombre) j.nombre = nombre;
      try {
        const r = await fetchVentasFor(j);
        if (j.id) saveVentas(j.id, r);
        if (!r) return { ok: false, notFound: true, error: `"${j.nombre}" no aparece en VGChartz` };
        return { ok: true, ...r };
      } catch (e) { return { ok: false, error: netMsg('VGChartz', e) }; }
    },

    // Deseos
    'd:all': () => all('SELECT * FROM deseos ORDER BY prioridad, nombre COLLATE NOCASE'),
    'd:create': d => {
      if (!d || !String(d.nombre || '').trim()) throw new Error('El nombre es obligatorio');
      const id = insertRow('deseos', DESEO_FIELDS, { prioridad: 2, ...d });
      return one('SELECT * FROM deseos WHERE id=?', [id]);
    },
    'd:update': d => { updateRow('deseos', DESEO_FIELDS, d); return one('SELECT * FROM deseos WHERE id=?', [d.id]); },
    'd:delete': id => { run('DELETE FROM deseos WHERE id=?', [Number(id)]); return { ok: true }; },
    'd:move': ({ id, plataformaId }) => {
      const d = one('SELECT * FROM deseos WHERE id=?', [Number(id)]);
      if (!d) return { error: 'not found' };
      if (!one('SELECT id FROM plataformas WHERE id=?', [Number(plataformaId)])) return { error: 'Plataforma no válida' };
      const jid = batch(() => {
        db.run(`INSERT INTO juegos (plataformaId,nombre,genero,desarrolladora,fechaLanzamiento,imagenes,precio,unidades,comentarios)
          VALUES (?,?,?,?,?,?,?,1,?)`, [Number(plataformaId), d.nombre, d.genero, d.desarrolladora, d.fechaLanzamiento,
          clean('imagenes', d.imagenes), d.precioEstimado, d.notas]);
        const newId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        db.run('DELETE FROM deseos WHERE id=?', [Number(id)]);
        return newId;
      });
      scheduleEnrich(jid);
      return { ok: true, juegoId: jid };
    },

    // Estadísticas
    'stats': () => ({
      totalPlataformas: one('SELECT COUNT(*) n FROM plataformas').n,
      totalJuegos: one('SELECT COUNT(*) n FROM juegos').n,
      totalDeseos: one('SELECT COUNT(*) n FROM deseos').n,
      totalPrestados: one("SELECT COUNT(*) n FROM juegos WHERE prestadoA IS NOT NULL AND prestadoA != ''").n,
      valorJuegos: one('SELECT COALESCE(SUM(precio),0) v FROM juegos').v,
      valorConsolas: one('SELECT COALESCE(SUM(precio),0) v FROM plataformas').v,
      valorColeccion: one('SELECT COALESCE(SUM(precio),0) v FROM juegos').v,
      porPlataforma: all(`SELECT p.id,p.nombre,p.marca,p.imagenes,p.precio precioConsola,
        COUNT(j.id) numJuegos,COALESCE(SUM(j.precio),0) valorJuegos,
        COALESCE(p.precio,0)+COALESCE(SUM(j.precio),0) valorTotal
        FROM plataformas p LEFT JOIN juegos j ON p.id=j.plataformaId GROUP BY p.id ORDER BY numJuegos DESC, p.nombre`),
      porGenero: all(`SELECT genero,COUNT(*) n FROM juegos WHERE genero IS NOT NULL AND genero!='' GROUP BY genero ORDER BY n DESC LIMIT 10`),
      mediaValoracion: one('SELECT ROUND(AVG(valoracion),1) v FROM juegos WHERE valoracion IS NOT NULL').v,
    }),

    // Config
    'cfg:get': k => (one('SELECT value FROM config WHERE key=?', [k]) || {}).value || null,
    'cfg:set': (k, v) => { run('INSERT OR REPLACE INTO config(key,value) VALUES(?,?)', [k, v == null ? null : String(v)]); return { ok: true }; },

    // Onboarding
    'app:isFirstRun': () => !one("SELECT value FROM config WHERE key='onboardingDone'"),
    'app:completeOnboarding': () => { run("INSERT OR REPLACE INTO config(key,value) VALUES('onboardingDone','1')"); return { ok: true }; },

    // Datos
    'data:export': () => exportData(),
    'data:import': (obj, opts) => ({ ok: true, ...importColeccion(obj, opts || { replace: true }) }),
    // Borrar la colección (todo o por partes). Los juegos pertenecen a una plataforma:
    // borrar plataformas implica borrar también sus juegos. Los ajustes se conservan.
    'data:counts': () => ({
      plataformas: one('SELECT COUNT(*) n FROM plataformas').n,
      juegos: one('SELECT COUNT(*) n FROM juegos').n,
      deseos: one('SELECT COUNT(*) n FROM deseos').n,
    }),
    'data:wipe': (opts = {}) => {
      const o = { plataformas: !!opts.plataformas, juegos: !!opts.juegos || !!opts.plataformas, deseos: !!opts.deseos };
      const antes = handlers['data:counts']();
      queue.length = 0;                                   // descartar búsquedas pendientes de HLTB/ventas
      batch(() => {
        if (o.juegos) db.run('DELETE FROM juegos');
        if (o.plataformas) db.run('DELETE FROM plataformas');
        if (o.deseos) db.run('DELETE FROM deseos');
        // Sin consolas → al volver a abrir, el asistente de bienvenida
        if (o.plataformas) db.run("DELETE FROM config WHERE key='onboardingDone'");
      });
      onChange({ type: 'wipe' });
      return { ok: true, borrados: { plataformas: o.plataformas ? antes.plataformas : 0, juegos: o.juegos ? antes.juegos : 0, deseos: o.deseos ? antes.deseos : 0 } };
    },
  };

  async function handle(channel, ...args) {
    const fn = handlers[channel];
    if (!fn) throw new Error('Operación desconocida: ' + channel);
    return fn(...args);
  }

  return { db, isNew, all, one, run, handle, handlers, importColeccion, exportData, scheduleEnrich, _queue: queue };
}

module.exports = { createCore, clean, SCHEMA };
