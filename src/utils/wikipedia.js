/**
 * wikipedia.js — busca consolas en Wikipedia y extrae imagen + metadatos
 *
 * Usa la API pública de Wikipedia (sin key).
 * Los fetches van por IPC (window.api.wiki.fetch) desde el main process
 * para incluir el User-Agent que Wikimedia exige.
 */

// Lista de consolas conocidas para el autocompletado local
export const CONSOLAS_CONOCIDAS = [
  // ── Nintendo ──────────────────────────────────────────────────────────────
  { nombre:'Nintendo Entertainment System',  alias:['NES','Famicom'],          marca:'Nintendo', tipo:'Sobremesa', anioEU:'1986', modelo:'NES-001' },
  { nombre:'Super Nintendo',                  alias:['SNES','Super Famicom'],   marca:'Nintendo', tipo:'Sobremesa', anioEU:'1992', modelo:'SNS-001' },
  { nombre:'Nintendo 64',                     alias:['N64'],                    marca:'Nintendo', tipo:'Sobremesa', anioEU:'1997', modelo:'NUS-001' },
  { nombre:'Nintendo GameCube',               alias:['GCN','GC'],              marca:'Nintendo', tipo:'Sobremesa', anioEU:'2002', modelo:'DOL-001' },
  { nombre:'Nintendo Wii',                    alias:['Wii'],                   marca:'Nintendo', tipo:'Sobremesa', anioEU:'2006', modelo:'RVL-001' },
  { nombre:'Nintendo Wii U',                  alias:['Wii U'],                 marca:'Nintendo', tipo:'Sobremesa', anioEU:'2013', modelo:'WUP-010' },
  { nombre:'Nintendo Switch',                 alias:['Switch','NS'],           marca:'Nintendo', tipo:'Híbrida',   anioEU:'2017', modelo:'HAC-001' },
  { nombre:'Nintendo Switch OLED',            alias:['Switch OLED'],           marca:'Nintendo', tipo:'Híbrida',   anioEU:'2021', modelo:'HEG-001' },
  { nombre:'Nintendo Switch Lite',            alias:['Switch Lite'],           marca:'Nintendo', tipo:'Portátil',  anioEU:'2019', modelo:'HDH-001' },
  { nombre:'Game Boy',                        alias:['GB'],                    marca:'Nintendo', tipo:'Portátil',  anioEU:'1990', modelo:'DMG-001' },
  { nombre:'Game Boy Color',                  alias:['GBC'],                   marca:'Nintendo', tipo:'Portátil',  anioEU:'1998', modelo:'CGB-001' },
  { nombre:'Game Boy Advance',                alias:['GBA'],                   marca:'Nintendo', tipo:'Portátil',  anioEU:'2001', modelo:'AGB-001' },
  { nombre:'Game Boy Advance SP',             alias:['GBA SP'],                marca:'Nintendo', tipo:'Portátil',  anioEU:'2003', modelo:'AGS-001' },
  { nombre:'Nintendo DS',                     alias:['DS'],                    marca:'Nintendo', tipo:'Portátil',  anioEU:'2005', modelo:'NTR-001' },
  { nombre:'Nintendo DS Lite',                alias:['DS Lite'],               marca:'Nintendo', tipo:'Portátil',  anioEU:'2006', modelo:'USG-001' },
  { nombre:'Nintendo DSi',                    alias:['DSi'],                   marca:'Nintendo', tipo:'Portátil',  anioEU:'2009', modelo:'TWL-001' },
  { nombre:'Nintendo 3DS',                    alias:['3DS'],                   marca:'Nintendo', tipo:'Portátil',  anioEU:'2011', modelo:'CTR-001' },
  { nombre:'Nintendo 3DS XL',                 alias:['3DS XL'],                marca:'Nintendo', tipo:'Portátil',  anioEU:'2012', modelo:'SPR-001' },
  { nombre:'Nintendo 2DS',                    alias:['2DS'],                   marca:'Nintendo', tipo:'Portátil',  anioEU:'2013', modelo:'FTR-001' },
  { nombre:'New Nintendo 3DS',                alias:['New 3DS'],               marca:'Nintendo', tipo:'Portátil',  anioEU:'2015', modelo:'KTR-001' },
  { nombre:'Virtual Boy',                     alias:['VB'],                    marca:'Nintendo', tipo:'Sobremesa', anioEU:'1995', modelo:'VUE-001' },
  // ── Sony ──────────────────────────────────────────────────────────────────
  { nombre:'PlayStation',                     alias:['PS1','PSX'],             marca:'Sony', tipo:'Sobremesa', anioEU:'1995', modelo:'SCPH-1002' },
  { nombre:'PlayStation 2',                   alias:['PS2'],                   marca:'Sony', tipo:'Sobremesa', anioEU:'2000', modelo:'SCPH-30004' },
  { nombre:'PlayStation 3',                   alias:['PS3'],                   marca:'Sony', tipo:'Sobremesa', anioEU:'2007', modelo:'CECH-A' },
  { nombre:'PlayStation 4',                   alias:['PS4'],                   marca:'Sony', tipo:'Sobremesa', anioEU:'2013', modelo:'CUH-1200' },
  { nombre:'PlayStation 4 Pro',               alias:['PS4 Pro'],               marca:'Sony', tipo:'Sobremesa', anioEU:'2016', modelo:'CUH-7200' },
  { nombre:'PlayStation 5',                   alias:['PS5'],                   marca:'Sony', tipo:'Sobremesa', anioEU:'2020', modelo:'CFI-1216A' },
  { nombre:'PlayStation 5 Digital',           alias:['PS5 Digital'],           marca:'Sony', tipo:'Sobremesa', anioEU:'2020', modelo:'CFI-1216B' },
  { nombre:'PlayStation Portable',            alias:['PSP'],                   marca:'Sony', tipo:'Portátil',  anioEU:'2005', modelo:'PSP-1004' },
  { nombre:'PlayStation Vita',                alias:['PS Vita','PSVita'],      marca:'Sony', tipo:'Portátil',  anioEU:'2012', modelo:'PCH-1004' },
  // ── Sega ──────────────────────────────────────────────────────────────────
  { nombre:'Sega Master System',              alias:['SMS','Master System'],   marca:'Sega', tipo:'Sobremesa', anioEU:'1987', modelo:'3010-06' },
  { nombre:'Sega Mega Drive',                 alias:['Genesis','Mega Drive'],  marca:'Sega', tipo:'Sobremesa', anioEU:'1990', modelo:'MK-1601-50' },
  { nombre:'Sega Saturn',                     alias:['Saturn'],               marca:'Sega', tipo:'Sobremesa', anioEU:'1995', modelo:'MK-80200A-50' },
  { nombre:'Sega Dreamcast',                  alias:['Dreamcast','DC'],        marca:'Sega', tipo:'Sobremesa', anioEU:'1999', modelo:'HKT-3030' },
  { nombre:'Sega Game Gear',                  alias:['Game Gear','GG'],        marca:'Sega', tipo:'Portátil',  anioEU:'1991', modelo:'GG-2110' },
  { nombre:'Sega 32X',                        alias:['32X'],                   marca:'Sega', tipo:'Sobremesa', anioEU:'1995', modelo:'MK-84501' },
  { nombre:'Sega CD',                         alias:['Mega CD'],               marca:'Sega', tipo:'Sobremesa', anioEU:'1993', modelo:'MK-4102A-50' },
  // ── Microsoft ─────────────────────────────────────────────────────────────
  { nombre:'Xbox',                            alias:['Xbox Original'],         marca:'Microsoft', tipo:'Sobremesa', anioEU:'2002', modelo:'Xbox' },
  { nombre:'Xbox 360',                        alias:['360'],                   marca:'Microsoft', tipo:'Sobremesa', anioEU:'2005', modelo:'Xbox 360' },
  { nombre:'Xbox One',                        alias:['One'],                   marca:'Microsoft', tipo:'Sobremesa', anioEU:'2013', modelo:'Xbox One' },
  { nombre:'Xbox One X',                      alias:['One X'],                 marca:'Microsoft', tipo:'Sobremesa', anioEU:'2017', modelo:'Xbox One X' },
  { nombre:'Xbox Series X',                   alias:['Series X'],              marca:'Microsoft', tipo:'Sobremesa', anioEU:'2020', modelo:'Xbox Series X' },
  { nombre:'Xbox Series S',                   alias:['Series S'],              marca:'Microsoft', tipo:'Sobremesa', anioEU:'2020', modelo:'Xbox Series S' },
  // ── Atari ─────────────────────────────────────────────────────────────────
  { nombre:'Atari 2600',                      alias:['2600','VCS'],            marca:'Atari', tipo:'Sobremesa', anioEU:'1980', modelo:'CX-2600' },
  { nombre:'Atari 5200',                      alias:['5200'],                  marca:'Atari', tipo:'Sobremesa', anioEU:'1982', modelo:'CX-5200' },
  { nombre:'Atari Jaguar',                    alias:['Jaguar'],                marca:'Atari', tipo:'Sobremesa', anioEU:'1994', modelo:'J8001' },
  // ── SNK ───────────────────────────────────────────────────────────────────
  { nombre:'Neo Geo AES',                     alias:['Neo Geo','AES'],         marca:'SNK', tipo:'Sobremesa', anioEU:'1991', modelo:'NGH-001' },
  { nombre:'Neo Geo Pocket Color',            alias:['NGPC'],                  marca:'SNK', tipo:'Portátil',  anioEU:'1999', modelo:'NGPC' },
  // ── NEC ───────────────────────────────────────────────────────────────────
  { nombre:'PC Engine',                       alias:['TurboGrafx-16','TG16'], marca:'NEC', tipo:'Sobremesa', anioEU:'1990', modelo:'PI-TG6' },
  { nombre:'PC-FX',                           alias:['PCFX'],                  marca:'NEC', tipo:'Sobremesa', anioEU:'1994', modelo:'FX-001' },
  // ── Panasonic / 3DO ───────────────────────────────────────────────────────
  { nombre:'3DO',                             alias:['3DO Interactive'],       marca:'Panasonic', tipo:'Sobremesa', anioEU:'1994', modelo:'FZ-1' },
  // ── Bandai ────────────────────────────────────────────────────────────────
  { nombre:'WonderSwan',                      alias:['Wonder Swan','WS'],     marca:'Bandai', tipo:'Portátil',  anioEU:'2000', modelo:'SWJ-001' },
  { nombre:'WonderSwan Color',                alias:['WSC'],                   marca:'Bandai', tipo:'Portátil',  anioEU:'2000', modelo:'SWJ-002' },
  // ── Commodore ─────────────────────────────────────────────────────────────
  { nombre:'Commodore 64',                    alias:['C64','C=64'],            marca:'Commodore', tipo:'Sobremesa', anioEU:'1983', modelo:'C64' },
  { nombre:'Commodore Amiga',                 alias:['Amiga','Amiga 500'],     marca:'Commodore', tipo:'Sobremesa', anioEU:'1985', modelo:'A500' },
  { nombre:'Amiga 1200',                      alias:['A1200'],                 marca:'Commodore', tipo:'Sobremesa', anioEU:'1992', modelo:'A1200' },
  // ── Sinclair / Amstrad ────────────────────────────────────────────────────
  { nombre:'ZX Spectrum',                     alias:['Spectrum'],              marca:'Sinclair', tipo:'Sobremesa', anioEU:'1982', modelo:'ZX Spectrum' },
  { nombre:'Amstrad CPC',                     alias:['CPC','CPC 464'],         marca:'Amstrad', tipo:'Sobremesa', anioEU:'1984', modelo:'CPC464' },
];

/**
 * Busca consolas que coinciden con el texto escrito (nombre o alias).
 */
export function buscarConsolaLocal(texto, max=6) {
  if (!texto || texto.length < 2) return [];
  const q = texto.toLowerCase().trim();
  return CONSOLAS_CONOCIDAS.filter(c =>
    c.nombre.toLowerCase().includes(q) ||
    (c.alias||[]).some(a => a.toLowerCase().includes(q))
  ).slice(0, max);
}

/**
 * Helper: hace fetch a través del main process (IPC) para incluir User-Agent.
 * Devuelve { ok, json?, b64?, contentType?, status?, error? }
 */
async function wikiFetch(url) {
  if (window.api?.wiki?.fetch) {
    return window.api.wiki.fetch(url);
  }
  // Fallback web (browser normal, sin Electron)
  const r = await fetch(url);
  if (!r.ok) return { ok: false, status: r.status };
  return { ok: true, json: await r.json() };
}

/**
 * Busca imagen de una consola en Wikipedia (API Mediawiki).
 * Devuelve { imageUrl } donde imageUrl es una data URI base64 o null.
 *
 * Estrategia:
 *  1. pageimages API → thumbnail URL
 *  2. Descargar la imagen a través de IPC → devolver como data:image/...;base64,...
 *     (evita que el renderer intente cargar una URL de Wikimedia con 400)
 */
export async function buscarImagenWikipedia(nombre) {
  const WIKI = 'https://en.wikipedia.org/w/api.php';

  const getPageImage = async (title) => {
    const url = `${WIKI}?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&piprop=thumbnail&pithumbsize=400&format=json&origin=*`;
    const res = await wikiFetch(url);
    if (!res.ok || !res.json) return null;
    const pages = res.json?.query?.pages || {};
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) return null;
    const thumbUrl = page?.thumbnail?.source;
    if (!thumbUrl) return null;

    // Descargar la imagen desde main process y devolver como data URI
    const imgRes = await wikiFetch(thumbUrl);
    if (!imgRes.ok || !imgRes.b64) return null;
    const ct = imgRes.contentType || 'image/jpeg';
    return `data:${ct};base64,${imgRes.b64}`;
  };

  // Intento directo
  let result = await getPageImage(nombre);
  if (result) return result;

  // Fallback: opensearch
  try {
    const searchUrl = `${WIKI}?action=opensearch&search=${encodeURIComponent(nombre)}&limit=3&format=json&origin=*`;
    const sr = await wikiFetch(searchUrl);
    if (!sr.ok || !sr.json) return null;
    const [, titles] = sr.json;
    for (const title of (titles||[])) {
      const r2 = await getPageImage(title);
      if (r2) return r2;
    }
  } catch { /* ignorar */ }

  return null;
}
