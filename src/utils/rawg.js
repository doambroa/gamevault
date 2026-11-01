import keys from '../core/keys';
const BASE = 'https://api.rawg.io/api';
const DEFAULT_KEY = keys.RAWG_KEY || '';   // viene de .env.local al compilar (scripts/gen-keys.js)

export const getKey  = () => localStorage.getItem('rawg_api_key') || DEFAULT_KEY;
export const saveKey = k  => localStorage.setItem('rawg_api_key', k.trim());

const GENRE_MAP = {
  'action':'Acción','shooter':'Shooter','adventure':'Aventura',
  'role-playing-games-rpg':'RPG','strategy':'Estrategia','puzzle':'Puzzle',
  'sports':'Deportes','racing':'Carreras','fighting':'Lucha',
  'platformer':'Plataformas','simulation':'Simulación','indie':'Indie',
  'massively-multiplayer':'MMORPG','family':'Plataformas','arcade':'Acción',
};

async function fetchRAWG(ep, params={}) {
  const url = new URL(`${BASE}/${ep}`);
  url.searchParams.set('key', getKey());
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`RAWG ${r.status}`);
  return r.json();
}

export const searchGames = (q, n=12) =>
  fetchRAWG('games', {search:q, page_size:n}).then(d => d.results||[]);

export const getGameDetails     = id => fetchRAWG(`games/${id}`);
export const getGameScreenshots = id => fetchRAWG(`games/${id}/screenshots`).then(d=>(d.results||[]).map(s=>s.image));

export function rawgToJuego(g) {
  return {
    nombre: g.name,
    genero: GENRE_MAP[g.genres?.[0]?.slug] || null,
    desarrolladora: g.developers?.[0]?.name || null,
    fechaLanzamiento: g.released || null,
    imagenes: g.background_image ? [g.background_image] : [],
    _rawgId: g.id,
    _description: g.description_raw?.slice(0,400) || null,
  };
}

export async function getCoversForGame(name) {
  const results = await searchGames(name, 16);
  return results.filter(g=>g.background_image).map(g=>({
    rawgId: g.id, title: g.name,
    coverUrl: g.background_image,
    released: g.released, rating: g.rating,
  }));
}

export async function autofillJuego(name) {
  const results = await searchGames(name, 5);
  if (!results.length) return null;
  const [details, screenshots] = await Promise.all([
    getGameDetails(results[0].id),
    getGameScreenshots(results[0].id),
  ]);
  const base = rawgToJuego(details);
  base.imagenes = [
    ...(details.background_image ? [details.background_image] : []),
    ...screenshots.slice(0,3),
  ];
  return base;
}
