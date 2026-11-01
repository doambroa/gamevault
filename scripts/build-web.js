// Prepara dist/web: la versión web/iPhone lista para copiar a tu servidor (XAMPP: htdocs/gamevault)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'dist', 'web');
if (!fs.existsSync(path.join(root, 'build', 'index.html'))) { console.error('✘ Falta build/index.html: ejecuta antes "npm run build"'); process.exit(1); }
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'build'), out, { recursive: true, filter: s => !s.endsWith('.map') });
for (const f of ['proxy.php', '.htaccess']) fs.copyFileSync(path.join(root, 'web', f), path.join(out, f));
console.log('✔ Versión web lista en dist/web — cópiala a tu servidor (p. ej. C:\\xampp\\htdocs\\gamevault)');
