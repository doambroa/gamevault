/**
 * importParser.js — Convierte distintos formatos de colección al JSON interno de GameVault
 *
 * Formatos soportados:
 *   - CSV de "Mi Colección" (cabecera con "Id";"Juego";"Plataforma";…)
 *   - CSV genérico (detección heurística de columnas)
 *   - TXT (un juego por línea, con o sin plataforma separada por | o /)
 *   - JSON (array de objetos con estructura desconocida)
 *   - XLSX/XLS — se convierte a CSV en el handler de Electron antes de llegar aquí
 */

// ── Mapeo de plataformas de "Mi Colección" → nombre normalizado ──────────────
const PLAT_MAP = {
  'N64':'Nintendo 64','GB':'Game Boy','GBA':'Game Boy Advance','GBC':'Game Boy Color',
  'GC':'GameCube','NES':'NES','SNES':'Super Nintendo','WII':'Wii','WIIU':'Wii U',
  'DS':'Nintendo DS','3DS':'Nintendo 3DS','NSW':'Nintendo Switch','NSW2':'Nintendo Switch 2',
  'PS1':'PlayStation','PS2':'PlayStation 2','PS3':'PlayStation 3','PS4':'PlayStation 4',
  'PS5':'PlayStation 5','PSP':'PSP','VITA':'PS Vita',
  'XBOX':'Xbox','X360':'Xbox 360','XONE':'Xbox One','XSX':'Xbox Series X',
  'DC':'Dreamcast','SMS':'Master System','SMD':'Mega Drive / Genesis','SAT':'Saturn',
  'GG':'Game Gear','MS2':'Master System 2',
  'PCE':'PC Engine','NGC':'NeoGeo Color','NGA':'Neo Geo AES','NGP':'Neo Geo Pocket',
  'WIN':'PC (Windows)','MAC':'Mac','LNX':'Linux','AND':'Android','IOS':'iOS',
  'ARC':'Arcade',
};

// ── Mapeo de géneros de "Mi Colección" → géneros de GameVault ────────────────
const GENRE_MAP = {
  'Conducción':'Carreras','Carreras':'Carreras','Racing':'Carreras',
  'Acción':'Acción','Action':'Acción','Adventure':'Aventura','Aventura':'Aventura',
  'RPG':'RPG','Role-Playing':'RPG','Estrategia':'Estrategia','Strategy':'Estrategia',
  'Deportes':'Deportes','Sports':'Deportes','Plataformas':'Plataformas','Platform':'Plataformas',
  'Shooter':'Shooter','Lucha':'Lucha','Fighting':'Lucha','Puzzle':'Puzzle',
  'Terror':'Terror','Horror':'Terror','Simulación':'Simulación','Simulation':'Simulación',
  'MMORPG':'MMORPG','Indie':'Indie','Música':'Música','Music':'Música',
};

// ── Estado de conservación ────────────────────────────────────────────────────
const ESTADO_MAP = {
  'Nuevo':'Nuevo','New':'Nuevo','Usado':'Usado','Used':'Usado',
  'Digital':'Digital','Dañado':'Dañado','Damaged':'Dañado',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizePlat(raw) {
  if (!raw) return '';
  const key = raw.trim().toUpperCase().replace(/\s+/g,'');
  return PLAT_MAP[key] || raw.trim();
}

function normalizeGenre(raw) {
  if (!raw) return '';
  return GENRE_MAP[raw.trim()] || raw.trim();
}

function normalizeEstado(raw) {
  if (!raw || raw === '-') return '';
  return ESTADO_MAP[raw.trim()] || '';
}

function normalizeDate(raw) {
  if (!raw || raw === '-') return '';
  // "15/10/2026" → "2026-10-15"
  raw = String(raw).trim();
  const m = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  const y = raw.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (y) return `${y[1]}-${y[2].padStart(2,'0')}-${y[3].padStart(2,'0')}`;
  if (/^\d{4}$/.test(raw)) return `${raw}-01-01`;
  // "2026-10-15" — ya correcto
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return '';
}

function normalizePrice(raw) {
  if (raw == null || raw === '-' || raw === '') return '';
  let s = String(raw).replace(/[^\d.,]/g, '');
  if (!s) return '';
  // "1.234,56" → 1234.56 · "1,234.56" → 1234.56 · "12,5" → 12.5
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? '' : String(n);
}

function normalizeUnidades(raw) {
  const n = parseInt(String(raw || '').replace(/[^\d]/g, ''), 10);
  return n >= 1 ? n : 1;
}

function normalizeValoracion(raw) {
  if (!raw || raw === '-') return '';
  const n = Number(raw);
  if (!isNaN(n) && n >= 1 && n <= 10) return n;
  return '';
}

// Parsear CSV respetando comillas (incluidos saltos de línea dentro de un campo)
// y distintos separadores (; , \t)
function parseCSV(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const count = c => (firstLine.match(new RegExp('\\' + c, 'g')) || []).length;
  const sep = [';', '\t', ','].sort((a, b) => count(b) - count(a))[0];
  const records = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) { row.push(cur.trim()); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur.trim()); cur = '';
      if (row.some(v => v !== '')) records.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur.trim());
  if (row.some(v => v !== '')) records.push(row);
  if (!records.length) return { headers: [], rows: [] };
  return { headers: records[0], rows: records.slice(1) };
}

// ── Detectar si es CSV de "Mi Colección" ─────────────────────────────────────
function isMiColeccion(headers) {
  // Tiene "Juego" y "Plataforma" como columnas (puede venir con comillas)
  return headers.some(h => h.replace(/"/g,'').trim() === 'Juego') &&
         headers.some(h => h.replace(/"/g,'').trim() === 'Plataforma');
}

// ── Convertir fila de "Mi Colección" → juego GameVault ───────────────────────
function miColeccionRowToJuego(headers, row) {
  const get = (name) => {
    const idx = headers.findIndex(h => h.replace(/"/g,'').trim() === name);
    return idx >= 0 ? (row[idx] || '').trim() : '';
  };
  const nombre    = get('Juego');
  const plataforma = normalizePlat(get('Plataforma'));
  const estado    = normalizeEstado(get('EstadoConservación') || get('EstadoConservacion'));
  const generos   = get('Generos') || get('Géneros');
  const fecha     = normalizeDate(get('Fecha'));
  const formato   = get('Formato') || '';
  const precio    = normalizePrice(get('Precio'));
  const valoracion = normalizeValoracion(get('Valoracion') || get('Valoración'));
  const notas     = get('ObservacionesPrivadas') || get('Analisis') || '';
  const prestamo  = get('Prestamo') || get('Préstamo');

  // Región desde Formato: "PAL/ES" → "PAL", "NTSC-J" → "NTSC-J"
  let region = '';
  if (formato.startsWith('PAL')) region = 'PAL';
  else if (formato.startsWith('NTSC-J')) region = 'NTSC-J';
  else if (formato.startsWith('NTSC')) region = 'NTSC';

  return {
    nombre,
    plataformaNombre: plataforma,
    genero: normalizeGenre(generos.split('/')[0].trim()),
    estado,
    region,
    precio,
    valoracion,
    fechaAdquisicion: fecha,
    idiomas: formato.includes('/') ? formato.split('/').slice(1).join(',') : '',
    comentarios: notas && notas !== '-' ? notas : '',
    prestadoA: prestamo && prestamo !== '-' ? prestamo : '',
    unidades: 1,
    imagenes: [],
  };
}

// ── CSV genérico: intentar mapear columnas heurísticamente ───────────────────
const GENERIC_MAP = {
  nombre:       ['nombre','name','title','titulo','título','juego','game','jeu','spiel'],
  plataforma:   ['plataforma','platform','consola','console','sistema','system','plat'],
  genero:       ['genero','género','genre','gênero'],
  estado:       ['estado','estado de conservacion','condition','estado conservacion'],
  precio:       ['precio','price','coste','cost','precio compra','valor'],
  valoracion:   ['valoracion','valoración','rating','nota','puntuacion','puntuación','score'],
  fechaAdquisicion: ['fecha adquisicion','fecha adquisición','fecha compra','acquired','purchase date','fecha'],
  fechaLanzamiento: ['fecha lanzamiento','lanzamiento','release date','released','release','año','anio','year'],
  region:       ['region','región','formato'],
  unidades:     ['unidades','cantidad','copias','quantity','qty','units','copies'],
  comentarios:  ['comentarios','notas','notes','observations','observaciones','analisis','análisis'],
};

const normH = h => String(h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
function detectColumn(headers, aliases, taken = []) {
  const H = headers.map(normH);
  const A = aliases.map(normH);
  let i = H.findIndex((h, k) => !taken.includes(k) && A.includes(h));
  if (i < 0) i = H.findIndex((h, k) => !taken.includes(k) && A.some(a => a.length > 3 && h.includes(a)));
  return i;
}

function genericCSVToJuegos(headers, rows) {
  const idx = {};
  const taken = [];
  // Orden importante: las columnas más específicas se reservan primero
  for (const field of ['nombre','plataforma','valoracion','fechaLanzamiento','fechaAdquisicion','unidades','genero','estado','precio','region','comentarios']) {
    idx[field] = detectColumn(headers, GENERIC_MAP[field], taken);
    if (idx[field] >= 0) taken.push(idx[field]);
  }
  return rows.map(row => {
    const get = (field) => idx[field] >= 0 ? (row[idx[field]] || '').trim() : '';
    return {
      nombre:           get('nombre'),
      plataformaNombre: normalizePlat(get('plataforma')),
      genero:           normalizeGenre(get('genero')),
      estado:           normalizeEstado(get('estado')),
      precio:           normalizePrice(get('precio')),
      valoracion:       normalizeValoracion(get('valoracion')),
      fechaAdquisicion: normalizeDate(get('fechaAdquisicion')),
      fechaLanzamiento: normalizeDate(get('fechaLanzamiento')),
      region:           normalizeRegion(get('region')),
      unidades:         normalizeUnidades(get('unidades')),
      comentarios:      get('comentarios'),
      imagenes:         [],
    };
  }).filter(j => j.nombre);
}

function normalizeRegion(raw) {
  const r = String(raw || '').toUpperCase();
  if (r.startsWith('PAL')) return 'PAL';
  if (r.startsWith('NTSC-J') || r === 'JAP' || r === 'JP') return 'NTSC-J';
  if (r.startsWith('NTSC')) return 'NTSC';
  if (r.startsWith('UNI')) return 'Universal';
  return '';
}

// ── TXT: un juego por línea ──────────────────────────────────────────────────
// Formatos: "Nombre", "Nombre | Plataforma", "Nombre / Plataforma"
function parseTXT(text) {
  return text.trim().split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !line.startsWith('//'))
    .map(line => {
      line = String(line).replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, '');   // viñetas y listas numeradas
      const sep = ['\t', ' | ', '|', ' / ', ';'].find(x => line.includes(x));
      if (sep) {
        const [nombre, plat] = line.split(sep);
        return { nombre: nombre.trim(), plataformaNombre: normalizePlat(plat || ''), imagenes: [] };
      }
      return { nombre: line, plataformaNombre: '', imagenes: [] };
    });
}

// ── JSON genérico ─────────────────────────────────────────────────────────────
function parseJSONCollection(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('JSON inválido'); }
  // Export propio de GameVault: { plataformas:[…], juegos:[…plataformaId] }
  if (data && Array.isArray(data.plataformas) && Array.isArray(data.juegos)) {
    const byId = Object.fromEntries(data.plataformas.map(p => [p.id, p.nombre]));
    data = { juegos: data.juegos.map(j => ({ ...j, plataforma: j.plataforma || byId[j.plataformaId] || '' })) };
  }
  // Puede ser array directo o { games: [], juegos: [], items: [] }
  const arr = Array.isArray(data) ? data
    : data.games || data.juegos || data.items || data.collection || [];
  if (!Array.isArray(arr)) throw new Error('No se encontró un array de juegos en el JSON');

  return arr.map(item => {
    // Intentar los nombres de campo más comunes
    const nombre = item.nombre || item.name || item.title || item.titulo || '';
    const plat   = item.plataforma || item.platform || item.consola || item.console || item.sistema || '';
    const genero = item.genero || item.género || item.genre || '';
    const precio = item.precio || item.price || '';
    const valoracion = item.valoracion || item.rating || item.nota || item.score || '';
    const fecha  = item.fechaAdquisicion || item.fecha || item.acquired || '';
    const coment = item.comentarios || item.notas || item.notes || '';
    const unidades = item.unidades || item.cantidad || item.quantity || item.copies || 1;
    return {
      nombre,
      plataformaNombre: normalizePlat(plat),
      genero:           normalizeGenre(genero),
      precio:           normalizePrice(String(precio)),
      valoracion:       normalizeValoracion(String(valoracion)),
      fechaAdquisicion: normalizeDate(fecha),
      fechaLanzamiento: normalizeDate(item.fechaLanzamiento || item.released || item.release || ''),
      estado:           normalizeEstado(item.estado || item.condition || ''),
      region:           normalizeRegion(item.region || ''),
      unidades:         normalizeUnidades(unidades),
      comentarios:      coment,
      imagenes:         Array.isArray(item.imagenes) ? item.imagenes : (() => { try { return JSON.parse(item.imagenes || '[]'); } catch { return []; } })(),
    };
  }).filter(j => j.nombre);
}

// Agrupar filas repetidas (mismo juego + misma plataforma) como unidades
function mergeDuplicates(juegos) {
  const key = j => `${String(j.nombre).toLowerCase().trim()}|${String(j.plataformaNombre || '').toLowerCase().trim()}`;
  const map = new Map();
  let merged = 0;
  for (const j of juegos) {
    const k = key(j);
    if (map.has(k)) { map.get(k).unidades = (map.get(k).unidades || 1) + (j.unidades || 1); merged++; }
    else map.set(k, { ...j, unidades: j.unidades || 1 });
  }
  return { juegos: [...map.values()], merged };
}

// ── Función principal de parsing ──────────────────────────────────────────────
/**
 * @param {string} text  — contenido del fichero (texto plano, CSV, JSON, etc.)
 * @param {string} ext   — extensión del fichero: 'csv', 'txt', 'json', 'xlsx' (ya pre-convertido a CSV por Electron)
 * @returns {{ juegos: Array, plataformasNecesarias: string[], warnings: string[] }}
 */
export { parseCSV, normalizePrice, normalizeDate };

export function parseImportFile(text, ext) {
  const warnings = [];
  let juegos = [];

  if (ext === 'json') {
    juegos = parseJSONCollection(text);
  } else if (ext === 'txt') {
    juegos = parseTXT(text);
  } else {
    // csv o xlsx (ya convertido a CSV)
    const { headers, rows } = parseCSV(text);
    if (!headers.length) throw new Error('El fichero no tiene cabecera o está vacío');

    if (isMiColeccion(headers)) {
      juegos = rows.map(row => miColeccionRowToJuego(headers, row)).filter(j => j.nombre);
    } else {
      const hasNameCol = detectColumn(headers, GENERIC_MAP.nombre) >= 0;
      if (hasNameCol) juegos = genericCSVToJuegos(headers, rows);
      // Sin cabecera reconocible: 1ª columna = nombre, 2ª (opcional) = plataforma
      if (!hasNameCol || !juegos.length) {
        juegos = [headers, ...rows]
          .filter(r => r[0] && r[0].trim())
          .map(r => ({ nombre: r[0].trim(), plataformaNombre: normalizePlat(r[1] || ''), unidades: 1, imagenes: [] }));
        if (juegos.length) warnings.push('No se encontró una cabecera con "Nombre"/"Juego": se ha usado la 1ª columna como nombre y la 2ª como plataforma.');
        else warnings.push('No se detectaron columnas de nombre/juego. Asegúrate de que la cabecera tenga "Nombre", "Title" o similar.');
      }
    }
  }

  // Duplicados → unidades
  const md = mergeDuplicates(juegos);
  juegos = md.juegos;
  if (md.merged > 0) warnings.push(`${md.merged} fila(s) repetida(s) agrupada(s) como unidades del mismo juego.`);

  // Plataformas únicas referenciadas
  const plataformasNecesarias = [...new Set(juegos.map(j => j.plataformaNombre).filter(Boolean))];

  // Avisos útiles
  const sinPlat = juegos.filter(j => !j.plataformaNombre).length;
  if (sinPlat > 0) warnings.push(`${sinPlat} juego(s) sin plataforma asignada — elige abajo en qué plataforma guardarlos.`);

  return { juegos, plataformasNecesarias, warnings };
}
