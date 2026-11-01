// Genera src/core/keys.js con las claves de servicios externos SIN guardarlas en el repo.
// Lee .env.local (o variables de entorno). Si no hay clave, la app pide una en Ajustes.
//   .env.local →  RAWG_KEY=tu_clave
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const env = {};
for (const f of ['.env', '.env.local']) {
  try {
    for (const line of fs.readFileSync(path.join(root, f), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
const RAWG_KEY = process.env.RAWG_KEY || env.RAWG_KEY || '';
fs.writeFileSync(path.join(root, 'src', 'core', 'keys.js'),
  '// Generado por scripts/gen-keys.js a partir de .env.local — no se sube al repo\n' +
  `module.exports = { RAWG_KEY: ${JSON.stringify(RAWG_KEY)} };\n`);
console.log(RAWG_KEY ? 'Clave de RAWG incluida en la compilación' : 'AVISO: sin RAWG_KEY en .env.local (la app pedirá una en Ajustes)');
