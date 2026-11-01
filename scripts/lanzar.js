/* Arranque con un doble clic (GameVault.bat).
 *  1. La primera vez —o si cambian las dependencias— instala lo necesario (npm ci).
 *  2. Si el código ha cambiado desde la última vez, prepara la app (npm run build).
 *  3. Abre GameVault y cierra esta ventana. La colección se guarda en la carpeta db\.
 *
 *   node scripts/lanzar.js              → todo lo anterior
 *   node scripts/lanzar.js --solo-deps  → sólo el paso 1 (lo usan las herramientas)
 *   node scripts/lanzar.js --sin-abrir  → pasos 1 y 2, sin abrir la app (pruebas)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, spawn } = require('child_process');

const root = path.join(__dirname, '..');
const arg = new Set(process.argv.slice(2));
const WIN = process.platform === 'win32';
process.chdir(root);

function npm(args, aviso) {
  console.log('\n' + aviso + '\n');
  const r = spawnSync(WIN ? 'npm.cmd' : 'npm', args, { stdio: 'inherit', shell: WIN, env: { ...process.env, CI: 'false' } });
  if (r.status !== 0) {
    console.error(`\n✘ No se pudo completar «npm ${args.join(' ')}». Revisa los mensajes de arriba` +
      ' (suele ser la conexión a Internet) y vuelve a abrir GameVault.bat.');
    process.exit(1);
  }
}
const sha1 = f => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');

// 1) Dependencias: se reinstalan sólo si cambia package-lock.json
const marcaDeps = path.join(root, 'node_modules', '.gamevault-deps');
const huellaDeps = sha1(path.join(root, 'package-lock.json'));
const leer = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
if (leer(marcaDeps) !== huellaDeps || !fs.existsSync(path.join(root, 'node_modules', 'electron'))) {
  npm(['ci', '--no-audit', '--no-fund', '--loglevel=error'],
    '⏳ Instalando lo necesario. Sólo pasa la primera vez y tarda unos minutos…');
  fs.writeFileSync(marcaDeps, huellaDeps);
}
if (arg.has('--solo-deps')) process.exit(0);

// 2) Compilar la interfaz si algo ha cambiado desde la última compilación
const marcaBuild = path.join(root, 'build', '.gamevault-build');
const GENERADOS = new Set(['sql-wasm.js', 'sql-wasm.wasm', 'keys.js', 'consolas-disponibles.json']);
function masReciente(p) {
  let t = 0;
  let st; try { st = fs.statSync(p); } catch { return 0; }
  if (!st.isDirectory()) return GENERADOS.has(path.basename(p)) ? 0 : st.mtimeMs;
  for (const f of fs.readdirSync(p)) t = Math.max(t, masReciente(path.join(p, f)));
  return t;
}
const ultimoCambio = Math.max(...['src', 'public', 'package.json', '.env', '.env.local'].map(p => masReciente(path.join(root, p))));
let compilado = 0; try { compilado = fs.statSync(marcaBuild).mtimeMs; } catch {}
if (!fs.existsSync(path.join(root, 'build', 'index.html')) || ultimoCambio > compilado) {
  npm(['run', 'build', '--silent'], compilado
    ? '⏳ Has actualizado GameVault: preparando la nueva versión (alrededor de un minuto)…'
    : '⏳ Preparando GameVault para el primer arranque (alrededor de un minuto)…');
  fs.writeFileSync(marcaBuild, new Date().toISOString());
}
if (arg.has('--sin-abrir')) { console.log('✔ GameVault está listo'); process.exit(0); }

// 3) Abrir la app (independiente de esta ventana, que se cierra al terminar)
const electron = require(path.join(root, 'node_modules', 'electron'));
const extra = (process.env.GV_ELECTRON_ARGS || '').split(' ').filter(Boolean);   // sólo para pruebas automáticas
const hijo = spawn(electron, ['.', ...extra], {
  cwd: root, detached: true, stdio: 'ignore',
  env: { ...process.env, GV_PROD: '1', GV_DATA_DIR: process.env.GV_DATA_DIR || path.join(root, 'db') },
});
hijo.unref();
console.log('✔ Abriendo GameVault…');
