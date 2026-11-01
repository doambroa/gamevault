/* eslint-disable */
// Utilidades de texto compartidas por Electron (main) y la versión web/Android.
// CommonJS puro: lo cargan tanto Node (require) como webpack.

const ROMAN = { i:1, ii:2, iii:3, iv:4, v:5, vi:6, vii:7, viii:8, ix:9, x:10, xi:11, xii:12, xiii:13 };
const ARABIC_TO_ROMAN = Object.fromEntries(Object.entries(ROMAN).map(([r, n]) => [String(n), r]));

/** minúsculas, sin acentos, sin símbolos, espacios simples */
function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[™®©]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** normaliza y unifica números romanos → arábigos ("final fantasy vii" → "final fantasy 7") */
function canon(str) {
  return normalize(str).split(' ').map(w => (ROMAN[w] && w !== 'i' ? String(ROMAN[w]) : w)).join(' ');
}

/** Coeficiente de Dice sobre bigramas (0..1) */
function dice(a, b) {
  a = canon(a).replace(/ /g, ''); b = canon(b).replace(/ /g, '');
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = grams(a), B = grams(b);
  let inter = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) || 0);
  return (2 * inter) / (a.length - 1 + b.length - 1);
}

/** Expande siglas del query usando el candidato: "gta san andreas" + "grand theft auto…" → "grand theft auto san andreas" */
function expandAcronyms(query, candidate) {
  const cw = canon(candidate).split(' ');
  return canon(query).split(' ').map(t => {
    if (t.length < 2 || t.length > 5 || /\d/.test(t)) return t;
    for (let i = 0; i + t.length <= cw.length; i++) {
      const run = cw.slice(i, i + t.length);
      if (run.map(w => w[0]).join('') === t) return run.join(' ');
    }
    return t;
  }).join(' ');
}

/** F1 sobre palabras (multiconjunto): penaliza palabras de más o de menos */
function wordF1(a, b) {
  const A = canon(a).split(' ').filter(Boolean), B = canon(b).split(' ').filter(Boolean);
  if (!A.length || !B.length) return 0;
  const pool = new Map(); for (const w of B) pool.set(w, (pool.get(w) || 0) + 1);
  let inter = 0; for (const w of A) if (pool.get(w) > 0) { inter++; pool.set(w, pool.get(w) - 1); }
  if (!inter) return 0;
  const P = inter / B.length, R = inter / A.length;
  return (2 * P * R) / (P + R);
}

function pairScore(q, c) {
  const cq = canon(q), cc = canon(c);
  if (!cq || !cc) return 0;
  if (cq === cc || cq.replace(/ /g, '') === cc.replace(/ /g, '')) return 1;
  let s = 0.5 * dice(q, c) + 0.5 * wordF1(q, c);
  // "Disney's The Lion King" contiene la frase completa "the lion king"
  // (cuanto menos texto extra tenga el candidato, mejor: desempata entre ediciones/secuelas)
  if (cq.includes(' ') && (' ' + cc + ' ').includes(' ' + cq + ' ')) {
    s = Math.max(s, 0.8 + 0.1 * (cq.split(' ').length / cc.split(' ').length));
  }
  return s;
}

/** Similitud entre el título buscado y un candidato (y sus alias), 0..1 */
function similarity(query, candidate, aliases) {
  const list = [candidate].concat(
    Array.isArray(aliases) ? aliases : String(aliases || '').split(',').map(s => s.trim()).filter(Boolean)
  );
  let best = 0;
  for (const c of list) best = Math.max(best, pairScore(query, c), pairScore(expandAcronyms(query, c), c));
  return best;
}

/**
 * Variantes de búsqueda para un nombre de juego, de más a menos literal.
 * "Grand Theft Auto: San Andreas (PAL)" → ["Grand Theft Auto: San Andreas (PAL)",
 *   "Grand Theft Auto San Andreas", "Grand Theft Auto", ...]
 */
function searchVariants(name) {
  const out = [];
  const push = s => { s = String(s || '').replace(/\s+/g, ' ').trim(); if (s.length >= 2 && !out.some(o => o.toLowerCase() === s.toLowerCase())) out.push(s); };
  const raw = String(name || '').trim();
  push(raw);
  // Quitar paréntesis/corchetes (región, edición, plataforma…)
  const noParen = raw.replace(/[([{][^)\]}]*[)\]}]/g, ' ');
  push(noParen);
  // Quitar símbolos de marca y signos de puntuación
  const clean = noParen.replace(/[™®©]/g, '').replace(/[:;!?¡¿.,_/\\|"]+/g, ' ').replace(/\s-\s/g, ' ');
  push(clean);
  // Romanos ↔ arábigos
  const words = clean.split(/\s+/);
  push(words.map(w => (ROMAN[w.toLowerCase()] && w.toLowerCase() !== 'i' ? ROMAN[w.toLowerCase()] : w)).join(' '));
  push(words.map(w => (ARABIC_TO_ROMAN[w] ? ARABIC_TO_ROMAN[w].toUpperCase() : w)).join(' '));
  // Quitar artículos/ediciones típicas
  push(clean.replace(/\b(the|edition|edicion|edición|remastered|remaster|hd|definitive|goty|game of the year|platinum|classics|essentials|player'?s choice|nintendo selects)\b/gi, ' '));
  // Sólo la parte antes de ':' o ' - ' (título principal)
  const main = raw.split(/:| - /)[0];
  if (main && main.length >= 4 && main !== raw) push(main);
  return out;
}

/** Parsea "06th Aug 2026" | "26th Oct 04" | "09th Jan 2019" → "2026-08-06" */
const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
function parseVgcDate(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*\s+(\d{2,4})$/);
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return null;
  let y = Number(m[3]);
  if (y < 100) y += y > 50 ? 1900 : 2000;
  return `${y}-${String(mon).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
}

/** "27.50m" → 27500000 ; "17,300,000" → 17300000 ; "N/A" → null */
function parseUnits(s) {
  s = String(s || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!s || s === 'n/a' || s === '-') return null;
  const m = s.match(/^([\d.,]+)(m|k)?$/);
  if (!m) return null;
  if (m[2]) {
    const n = parseFloat(m[1].replace(/,/g, ''));
    if (isNaN(n)) return null;
    return Math.round(n * (m[2] === 'm' ? 1e6 : 1e3));
  }
  const n = Number(m[1].replace(/[.,]/g, ''));
  return isNaN(n) ? null : n;
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
const stripTags = s => decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

module.exports = { normalize, canon, dice, wordF1, similarity, searchVariants, parseVgcDate, parseUnits, stripTags, decodeEntities };
