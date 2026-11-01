// Copia a public/ lo que necesita la versión web/Android (sql.js)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
require('./gen-keys');   // src/core/keys.js desde .env.local
const pub = path.join(root, 'public');
const copies = [
  ['node_modules/sql.js/dist/sql-wasm.js', 'sql-wasm.js'],
  ['node_modules/sql.js/dist/sql-wasm.wasm', 'sql-wasm.wasm'],
];
for (const [from, to] of copies) {
  fs.copyFileSync(path.join(root, from), path.join(pub, to));
}
console.log('Recursos web copiados a public/');

// La colección ya no se distribuye: quitar copias antiguas
try { fs.unlinkSync(path.join(pub, 'coleccion-inicial.json')); } catch {}

// Lista de imágenes de consola incluidas (public/consolas) → src/data/consolas-disponibles.json
const imgs = fs.readdirSync(path.join(pub, 'consolas')).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)).sort();
fs.writeFileSync(path.join(root, 'src', 'data', 'consolas-disponibles.json'), JSON.stringify(imgs, null, 1) + '\n');
console.log(`Imágenes de consola: ${imgs.length}`);
