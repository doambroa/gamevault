/* eslint-disable */
// ─── Título en inglés a partir del título en castellano ──────────────────────
// Busca el juego en la Wikipedia en español y sigue el enlace a su artículo en inglés.
// Comprobado en vivo (18-10-2026):
//   "Qué preparamos hoy? Cocina conmigo" → "¡Cocina conmigo!: ¿Qué preparamos hoy?" → "Cooking Guide: Can't Decide What to Eat?"
//   "Los Simpsons: El videojuego"       → "Los Simpson: el videojuego"             → "The Simpsons Game"
//   "El Rey León"                       → "El rey león"                            → "The Lion King"

const { similarity } = require('./text');

const WP = 'https://es.wikipedia.org/w/api.php';
const UA = 'GameVault/1.5 (coleccion personal de videojuegos)';
const MIN_SCORE = 0.6;

// "The Simpsons (video game)" → "The Simpsons" ; "Doom (videojuego de 1993)" → "Doom"
const stripQualifier = t => String(t || '').replace(/\s*\((?:[^)]*(?:video ?game|videojuego|game|juego)[^)]*)\)\s*$/i, '').trim();

async function englishTitlesFromWikipedia(http, nombre) {
  const get = async url => {
    const r = await http(url, { method: 'GET', headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (r.status !== 200) throw new Error('Wikipedia respondió ' + r.status);
    return JSON.parse(r.text);
  };
  const s = await get(`${WP}?action=query&list=search&srsearch=${encodeURIComponent(nombre)}&srlimit=6&srnamespace=0&format=json`);
  const hits = (s.query?.search || [])
    .map(h => ({ title: h.title, score: similarity(nombre, stripQualifier(h.title)), videojuego: /videojuego|video ?game|consola|nintendo|playstation|xbox|sega/i.test(h.snippet || '') }))
    .filter(h => h.score >= MIN_SCORE)
    .sort((a, b) => (b.score + (b.videojuego ? 0.05 : 0)) - (a.score + (a.videojuego ? 0.05 : 0)));
  if (!hits.length) return [];
  const ll = await get(`${WP}?action=query&titles=${encodeURIComponent(hits.slice(0, 3).map(h => h.title).join('|'))}&prop=langlinks&lllang=en&redirects=1&format=json`);
  const pages = Object.values(ll.query?.pages || {});
  const out = [];
  for (const h of hits.slice(0, 3)) {
    const p = pages.find(x => x.title === h.title) || pages.find(x => similarity(x.title, h.title) > 0.9);
    const en = p?.langlinks?.[0]?.['*'];
    if (en) out.push(stripQualifier(en));
  }
  return [...new Set(out)];
}

module.exports = { englishTitlesFromWikipedia, stripQualifier };
