/* Catálogo de consolas que se ofrecen al crear una colección nueva,
 * con su imagen por defecto (public/consolas/<img>.png, optimizadas ≤ 480 px).
 *
 * Las imágenes se guardan en la BD como ruta relativa "./consolas/<img>.png":
 * vienen dentro de la app (Windows, Android y web), así que la colección exportada
 * sigue mostrando la imagen en cualquier dispositivo y la BD no crece.
 */

import DISPONIBLES from './consolas-disponibles.json';

export const CONSOLAS = [
  // ── Nintendo ──
  { nombre:'Color TV-Game',    marca:'Nintendo',  tipo:'Sobremesa', img:'color-tv-game', unidadesVendidas:'3 millones (Japón)' },
  { nombre:'NES',              marca:'Nintendo',  tipo:'Sobremesa', img:'nes', fechaLanzamientoEuropa:'1986-09-01', unidadesVendidas:'61.91 millones' },
  { nombre:'SNES',             marca:'Nintendo',  tipo:'Sobremesa', img:'snes', fechaLanzamientoEuropa:'1992-06-11', unidadesVendidas:'49.1 millones' },
  { nombre:'Virtual Boy',      marca:'Nintendo',  tipo:'Sobremesa', img:'virtual-boy', unidadesVendidas:'770.000' },
  { nombre:'Nintendo 64',      marca:'Nintendo',  tipo:'Sobremesa', img:'nintendo-64', fechaLanzamientoEuropa:'1997-03-01', unidadesVendidas:'32.93 millones' },
  { nombre:'GameCube',         marca:'Nintendo',  tipo:'Sobremesa', img:'gamecube', fechaLanzamientoEuropa:'2002-05-03', unidadesVendidas:'21.74 millones' },
  { nombre:'Wii',              marca:'Nintendo',  tipo:'Sobremesa', img:'wii', fechaLanzamientoEuropa:'2006-12-08', unidadesVendidas:'101.63 millones' },
  { nombre:'Wii U',            marca:'Nintendo',  tipo:'Sobremesa', img:'wii-u', fechaLanzamientoEuropa:'2012-11-30', unidadesVendidas:'13.56 millones' },
  { nombre:'Switch',           marca:'Nintendo',  tipo:'Híbrida',   img:'switch', fechaLanzamientoEuropa:'2017-03-03', precioSalida:329.99, unidadesVendidas:'146+ millones' },
  { nombre:'Switch 2',         marca:'Nintendo',  tipo:'Híbrida',   img:'switch-2', fechaLanzamientoEuropa:'2025-06-05', precioSalida:499.99 },
  { nombre:'Game Boy',         marca:'Nintendo',  tipo:'Portátil',  img:'game-boy', fechaLanzamientoEuropa:'1990-09-28', unidadesVendidas:'118.69 millones' },
  { nombre:'Game Boy Color',   marca:'Nintendo',  tipo:'Portátil',  img:'game-boy-color', fechaLanzamientoEuropa:'1998-11-23' },
  { nombre:'Game Boy Advance', marca:'Nintendo',  tipo:'Portátil',  img:'game-boy-advance', fechaLanzamientoEuropa:'2001-06-22', unidadesVendidas:'81.51 millones' },
  { nombre:'Nintendo DS',      marca:'Nintendo',  tipo:'Portátil',  img:'nintendo-ds', fechaLanzamientoEuropa:'2005-03-11', unidadesVendidas:'154.02 millones' },
  { nombre:'Nintendo 3DS',     marca:'Nintendo',  tipo:'Portátil',  img:'nintendo-3ds', fechaLanzamientoEuropa:'2011-03-25', unidadesVendidas:'75.94 millones' },
  // ── Sony ──
  { nombre:'PlayStation',      marca:'Sony',      tipo:'Sobremesa', img:'playstation', fechaLanzamientoEuropa:'1995-09-29', unidadesVendidas:'102.49 millones' },
  { nombre:'PlayStation 2',    marca:'Sony',      tipo:'Sobremesa', img:'playstation-2', fechaLanzamientoEuropa:'2000-11-24', unidadesVendidas:'155 millones' },
  { nombre:'PlayStation 3',    marca:'Sony',      tipo:'Sobremesa', img:'playstation-3', fechaLanzamientoEuropa:'2007-03-23', unidadesVendidas:'87.4 millones' },
  { nombre:'PlayStation 4',    marca:'Sony',      tipo:'Sobremesa', img:'playstation-4', fechaLanzamientoEuropa:'2013-11-29', precioSalida:399.99, unidadesVendidas:'117.2 millones' },
  { nombre:'PlayStation 5',    marca:'Sony',      tipo:'Sobremesa', img:'playstation-5', fechaLanzamientoEuropa:'2020-11-19', precioSalida:499.99, unidadesVendidas:'59+ millones' },
  { nombre:'PSP',              marca:'Sony',      tipo:'Portátil',  img:'psp', fechaLanzamientoEuropa:'2005-09-01', unidadesVendidas:'80 millones' },
  { nombre:'PS Vita',          marca:'Sony',      tipo:'Portátil',  img:'ps-vita', fechaLanzamientoEuropa:'2012-02-22', unidadesVendidas:'16 millones' },
  // ── Sega ──
  { nombre:'Master System',    marca:'Sega',      tipo:'Sobremesa', img:'master-system', fechaLanzamientoEuropa:'1987-06-15', unidadesVendidas:'13 millones' },
  { nombre:'Mega Drive',       marca:'Sega',      tipo:'Sobremesa', img:'mega-drive', fechaLanzamientoEuropa:'1990-11-30', unidadesVendidas:'30.75 millones' },
  { nombre:'Mega-CD',          marca:'Sega',      tipo:'Sobremesa', img:'mega-cd', fechaLanzamientoEuropa:'1993-04-02', unidadesVendidas:'2.24 millones' },
  { nombre:'32X',              marca:'Sega',      tipo:'Sobremesa', img:'32x', unidadesVendidas:'665.000' },
  { nombre:'Saturn',           marca:'Sega',      tipo:'Sobremesa', img:'saturn', fechaLanzamientoEuropa:'1995-07-08', unidadesVendidas:'9.5 millones' },
  { nombre:'Dreamcast',        marca:'Sega',      tipo:'Sobremesa', img:'dreamcast', fechaLanzamientoEuropa:'1999-10-14', unidadesVendidas:'9.13 millones' },
  { nombre:'Game Gear',        marca:'Sega',      tipo:'Portátil',  img:'game-gear', fechaLanzamientoEuropa:'1991-04-26', unidadesVendidas:'10.62 millones' },
  // ── Microsoft ──
  { nombre:'Xbox',             marca:'Microsoft', tipo:'Sobremesa', img:'xbox', fechaLanzamientoEuropa:'2002-03-14', unidadesVendidas:'24 millones' },
  { nombre:'Xbox 360',         marca:'Microsoft', tipo:'Sobremesa', img:'xbox-360', fechaLanzamientoEuropa:'2005-12-02', unidadesVendidas:'84 millones' },
  { nombre:'Xbox One',         marca:'Microsoft', tipo:'Sobremesa', img:'xbox-one', fechaLanzamientoEuropa:'2013-11-22', unidadesVendidas:'50+ millones' },
  { nombre:'Xbox Series X',    marca:'Microsoft', tipo:'Sobremesa', img:'xbox-series-x', fechaLanzamientoEuropa:'2020-11-10', precioSalida:499.99 },
  { nombre:'Xbox Series S',    marca:'Microsoft', tipo:'Sobremesa', img:'xbox-series-s', fechaLanzamientoEuropa:'2020-11-10', precioSalida:299.99 },
  { nombre:'PC (Windows)',     marca:'Microsoft', tipo:'PC',        img:'pc' },
  // ── SNK ──
  { nombre:'Neo Geo AES',      marca:'SNK',       tipo:'Sobremesa', img:'neo-geo-aes' },
  { nombre:'Neo Geo CD',       marca:'SNK',       tipo:'Sobremesa', img:'neo-geo-cd', unidadesVendidas:'570.000' },
  { nombre:'Neo Geo Pocket Color', marca:'SNK',   tipo:'Portátil',  img:'neo-geo-pocket-color', unidadesVendidas:'2 millones' },
  // ── Atari ──
  { nombre:'Atari 2600',       marca:'Atari',     tipo:'Sobremesa', img:'atari-2600', unidadesVendidas:'30 millones' },
  { nombre:'Atari Lynx',       marca:'Atari',     tipo:'Portátil',  img:'atari-lynx', unidadesVendidas:'3 millones' },
  { nombre:'Atari Jaguar',     marca:'Atari',     tipo:'Sobremesa', img:'atari-jaguar', unidadesVendidas:'150.000' },
  // ── Ordenadores ──
  { nombre:'Commodore 64',     marca:'Commodore', tipo:'Ordenador', img:'commodore-64', unidadesVendidas:'12.5–17 millones' },
  { nombre:'Amiga',            marca:'Commodore', tipo:'Ordenador', img:'amiga' },
  { nombre:'Amiga CD32',       marca:'Commodore', tipo:'Sobremesa', img:'amiga-cd32' },
  { nombre:'ZX Spectrum',      marca:'Sinclair',  tipo:'Ordenador', img:'zx-spectrum', unidadesVendidas:'5 millones' },
  { nombre:'Amstrad CPC',      marca:'Amstrad',   tipo:'Ordenador', img:'amstrad-cpc', unidadesVendidas:'3 millones' },
  { nombre:'MSX',              marca:'MSX',       tipo:'Ordenador', img:'msx', unidadesVendidas:'5 millones' },
  // ── Otras ──
  { nombre:'PC Engine',        marca:'NEC',       tipo:'Sobremesa', img:'pc-engine', unidadesVendidas:'10 millones' },
  { nombre:'WonderSwan',       marca:'Bandai',    tipo:'Portátil',  img:'wonderswan' },
  { nombre:'WonderSwan Color', marca:'Bandai',    tipo:'Portátil',  img:'wonderswan-color' },
  { nombre:'3DO',              marca:'Panasonic', tipo:'Sobremesa', img:'3do', unidadesVendidas:'2 millones' },
  { nombre:'CD-i',             marca:'Philips',   tipo:'Sobremesa', img:'cd-i', unidadesVendidas:'1 millón' },
  { nombre:'Arcade',           marca:'Varias',    tipo:'Arcade',    img:'arcade' },
];

// Imágenes que existen de verdad en public/consolas (lista generada por scripts/copy-web-assets.js);
// las consolas sin imagen muestran sus iniciales
export const IMAGENES_DISPONIBLES = new Set(DISPONIBLES);

export const MARCAS_PRINCIPALES = ['Nintendo', 'Sony', 'Sega', 'Microsoft', 'SNK', 'Atari'];

const rutaImg = slug => (slug && IMAGENES_DISPONIBLES.has(slug) ? `./consolas/${slug}.png` : null);
export const imagenDeConsola = c => rutaImg(c?.img);

// Nombres alternativos (formulario de consola, colecciones importadas) → imagen
// Quita la marca delante ("Sega Saturn" → "saturn"), salvo si sólo queda un número ("Nintendo 64", "Commodore 64")
const norm = s => {
  const t = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const sin = t.replace(/^(sega|nintendo|sony|microsoft|snk|atari|commodore|sinclair|nec|bandai|panasonic|philips)\s+/, '');
  return (/^\d+$/.test(sin.trim()) ? t : sin).replace(/[^a-z0-9]+/g, '');
};
const ALIAS = {
  famicom:'nes', mastersystem2:'master-system', mastersystemii:'master-system', nintendoentertainmentsystem:'nes', entertainmentsystem:'nes',
  supernintendo:'snes', superfamicom:'snes', supernes:'snes',
  n64:'nintendo-64', gc:'gamecube', ngc:'gamecube', wii:'wii', wiiu:'wii-u',
  switcholed:'switch', switchlite:'switch',
  gb:'game-boy', gbc:'game-boy-color', gba:'game-boy-advance', gameboyadvancesp:'game-boy-advance',
  ds:'nintendo-ds', dslite:'nintendo-ds', dsi:'nintendo-ds', '3ds':'nintendo-3ds', '3dsxl':'nintendo-3ds', '2ds':'nintendo-3ds', new3ds:'nintendo-3ds',
  playstation1:'playstation', psx:'playstation', ps1:'playstation', psone:'playstation',
  ps2:'playstation-2', ps3:'playstation-3', ps4:'playstation-4', playstation4pro:'playstation-4', ps4pro:'playstation-4',
  ps5:'playstation-5', playstation5digital:'playstation-5', playstationportable:'psp', playstationvita:'ps-vita', vita:'ps-vita',
  genesis:'mega-drive', megadrivegenesis:'mega-drive', cd:'mega-cd', segacd:'mega-cd', megacd:'mega-cd',
  xboxonex:'xbox-one', xboxones:'xbox-one', xboxseriesxs:'xbox-series-x',
  pc:'pc', windows:'pc', amiga500:'amiga', amiga1200:'amiga', commodoreamiga:'amiga', cd32:'amiga-cd32',
  spectrum:'zx-spectrum', cpc:'amstrad-cpc', turbografx16:'pc-engine', turbografx:'pc-engine',
  neogeo:'neo-geo-aes', aes:'neo-geo-aes', ngpc:'neo-geo-pocket-color',
  '2600':'atari-2600', vcs:'atari-2600', lynx:'atari-lynx', jaguar:'atari-jaguar', cdi:'cd-i', ws:'wonderswan', wsc:'wonderswan-color',
};
const POR_NOMBRE = Object.fromEntries(CONSOLAS.map(c => [norm(c.nombre), c.img]));
/** Imagen por defecto para un nombre de consola cualquiera ("Super Nintendo", "PS2"…), o null */
export function imagenPorNombre(nombre) {
  const n = norm(nombre);
  if (!n) return null;
  return rutaImg(POR_NOMBRE[n] || ALIAS[n]);
}
