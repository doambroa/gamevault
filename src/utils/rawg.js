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

export const searchGames = (q, n=12, plataformaRawg=null) =>
  fetchRAWG('games', {search:q, page_size:n, ...(plataformaRawg ? {platforms: plataformaRawg} : {})}).then(d => d.results||[]);

// Plataformas de RAWG (api.rawg.io/api/platforms) para cada consola del catálogo (clave = imagen de data/consolas).
// RAWG no tiene «Switch 2»: sus juegos están dentro de «Nintendo Switch», así que se busca ahí.
export const PLATAFORMA_RAWG = {
  'pc': 4, 'playstation-5': 187, 'playstation-4': 18, 'playstation-3': 16, 'playstation-2': 15, 'playstation': 27,
  'ps-vita': 19, 'psp': 17, 'xbox-one': 1, 'xbox-series-x': 186, 'xbox-series-s': 186, 'xbox-360': 14, 'xbox': 80,
  'switch': 7, 'switch-2': 7, 'wii-u': 10, 'wii': 11, 'gamecube': 105, 'nintendo-64': 83, 'snes': 79, 'nes': 49,
  'nintendo-3ds': 8, 'nintendo-ds': 9, 'game-boy-advance': 24, 'game-boy-color': 43, 'game-boy': 26,
  'mega-drive': 167, 'saturn': 107, 'mega-cd': 119, '32x': 117, 'master-system': 74, 'dreamcast': 106, 'game-gear': 77,
  '3do': 111, 'atari-jaguar': 112, 'atari-lynx': 46, 'atari-2600': 23, 'amiga': 166, 'amiga-cd32': 166, 'commodore-64': 166,
  'neo-geo-aes': 12, 'neo-geo-cd': 12,
};

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
