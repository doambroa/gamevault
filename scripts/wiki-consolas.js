/* Descarga de Wikipedia la imagen principal (PNG transparente) de las consolas que no
 * tienen imagen propia en public/consolas y la deja en buildres/consolas-wiki/<slug>.<ext>
 * para optimizarla después con scripts/optimizar-consolas.sh.
 *   node scripts/wiki-consolas.js
 */
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'buildres', 'consolas-wiki');
const ARTICULOS = {
  'game-gear': 'Game Gear', 'game-and-watch': 'Game & Watch',
  'virtual-boy': 'Virtual Boy', '32x': '32X', 'xbox-series-s': 'Xbox Series X and Series S',
  'neo-geo-aes': 'Neo Geo (system)', 'neo-geo-cd': 'Neo Geo CD', 'neo-geo-pocket-color': 'Neo Geo Pocket Color',
  'atari-2600': 'Atari 2600', 'atari-lynx': 'Atari Lynx', 'atari-jaguar': 'Atari Jaguar',
  'amiga': 'Amiga 500', 'zx-spectrum': 'ZX Spectrum', 'amstrad-cpc': 'Amstrad CPC', 'msx': 'MSX',
  'pc-engine': 'TurboGrafx-16', '3do': '3DO Interactive Multiplayer', 'cd-i': 'CD-i',
};
// curl (respeta el proxy del sistema) con un User-Agent descriptivo, como pide Wikimedia
const { execFileSync } = require('child_process');
const UA = 'GameVault/1.7 (personal game collection catalogue; build script) curl';
const sleep = s => execFileSync('sleep', [String(s)]);
// Wikimedia limita la frecuencia (429): pausa entre peticiones y reintentos cada vez más largos
const get = url => { for (let i = 0; i < 5; i++) { sleep(i ? 10 * i : 2); try { return execFileSync('curl', ['-sSfL', '-m', '60', '-A', UA, url], { maxBuffer: 1 << 28 }); } catch (e) {} } throw new Error('no se pudo descargar ' + url); };
// Ficheros concretos de Commons cuando la imagen principal del artículo no sirve (logotipos, fotos de grupo)
const FICHEROS = { 'game-and-watch': process.env.GW_FILE, 'xbox-series-s': process.env.XSS_FILE };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [slug, titulo] of Object.entries(ARTICULOS)) {
    try {
      if (fs.readdirSync(OUT).some(f => f.startsWith(slug + '.'))) { console.log('·', slug, 'ya descargada'); continue; }
      const api = FICHEROS[slug]
        ? 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=1000&titles=' + encodeURIComponent('File:' + FICHEROS[slug])
        : 'https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&pithumbsize=1000&redirects=1&titles=' + encodeURIComponent(titulo);
      const j = JSON.parse(get(api).toString());
      const pg = Object.values(j.query.pages)[0];
      const src = pg.thumbnail?.source || pg.imageinfo?.[0]?.thumburl;
      if (!src) { console.log('✘', slug, 'sin imagen'); continue; }
      const buf = get(src);
      const f = path.join(OUT, slug + path.extname(new URL(src).pathname).toLowerCase());
      fs.writeFileSync(f, buf);
      console.log('✔', slug.padEnd(22), Math.round(buf.length / 1024) + ' KB', decodeURIComponent(src.split('/').pop().split('?')[0]));
    } catch (e) { console.log('✘', slug, e.message); }
  }
})();
