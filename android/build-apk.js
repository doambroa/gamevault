#!/usr/bin/env node
/*
 * Compila GameVault.apk SIN Android Studio ni Gradle.
 *   Requisitos: Java (JDK 17+) y haber ejecutado antes `npm run build`.
 *   Uso:        node android/build-apk.js        (o  npm run pack-android)
 *
 * Herramientas (se descargan solas desde GitHub a android/.tools la primera vez):
 *   · android.jar (API 34)      → compilar el Java          (github.com/Sable/android-platforms)
 *   · aapt2 (dentro de apktool) → recursos y manifiesto     (github.com/iBotPeaches/Apktool)
 *   · dx (dentro de dex2jar)    → .class → classes.dex      (github.com/pxb1988/dex2jar)
 *   · uber-apk-signer           → zipalign + firma v1/v2/v3 (github.com/patrickfav/uber-apk-signer)
 * La firma usa android/gamevault-release.jks (se crea la primera vez). GUÁRDALO: las
 * actualizaciones del APK tienen que firmarse con la misma clave.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const AND = __dirname;
const TOOLS = process.env.GV_ANDROID_TOOLS || path.join(AND, '.tools');
const OUT = path.join(AND, 'out');
const VERSION = require(path.join(ROOT, 'package.json')).version;
const VERSION_CODE = String(VERSION.split('.').reduce((a, n) => a * 100 + Number(n), 0));   // 1.4.0 → 10400
const KS = path.join(AND, 'gamevault-release.jks');
const KS_PASS = process.env.GV_KS_PASS || 'gamevault';
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], ...opts }).toString();
const step = m => console.log('▸ ' + m);

const DL = {
  'android.jar': 'https://github.com/Sable/android-platforms/raw/master/android-34/android.jar',
  'apktool.jar': 'https://github.com/iBotPeaches/Apktool/releases/download/v2.12.1/apktool_2.12.1.jar',
  'dex-tools.zip': 'https://github.com/pxb1988/dex2jar/releases/download/v2.4/dex-tools-v2.4.zip',
  'uber-signer.jar': 'https://github.com/patrickfav/uber-apk-signer/releases/download/v1.3.0/uber-apk-signer-1.3.0.jar',
};

function tools() {
  fs.mkdirSync(TOOLS, { recursive: true });
  for (const [f, url] of Object.entries(DL)) {
    const p = path.join(TOOLS, f);
    // Todas son .jar/.zip: si un fichero guardado no empieza por "PK" es una descarga
    // cortada o una página de error → se borra y se vuelve a bajar (con -f, curl falla ante errores HTTP)
    const valido = () => { try { const b = Buffer.alloc(2); const fd = fs.openSync(p, 'r'); fs.readSync(fd, b, 0, 2, 0); fs.closeSync(fd); return b.toString() === 'PK'; } catch { return false; } };
    if (fs.existsSync(p) && !valido()) { step(f + ' está dañado: se descarga de nuevo'); fs.unlinkSync(p); }
    if (!fs.existsSync(p)) {
      step('descargando ' + f);
      sh('curl', ['-fsSL', '--retry', '3', '-o', p, url]);
      if (!valido()) { fs.rmSync(p, { force: true }); throw new Error(`La descarga de ${f} no es válida (${url}). Revisa la conexión y vuelve a intentarlo.`); }
    }
  }
  const aapt2 = path.join(TOOLS, process.platform === 'win32' ? 'aapt2.exe' : 'aapt2');
  if (!fs.existsSync(aapt2)) {
    const inner = process.platform === 'win32' ? 'prebuilt/windows/aapt2_64.exe' : process.platform === 'darwin' ? 'prebuilt/macosx/aapt2_64' : 'prebuilt/linux/aapt2_64';
    sh('unzip', ['-o', '-q', '-j', path.join(TOOLS, 'apktool.jar'), inner, '-d', TOOLS]);
    fs.renameSync(path.join(TOOLS, path.basename(inner)), aapt2);
    fs.chmodSync(aapt2, 0o755);
  }
  const dx = path.join(TOOLS, 'dx.jar');
  if (!fs.existsSync(dx)) {
    sh('unzip', ['-o', '-q', '-j', path.join(TOOLS, 'dex-tools.zip'), '*/lib/dx-*.jar', '-d', TOOLS]);
    const found = fs.readdirSync(TOOLS).find(f => /^dx-.*\.jar$/.test(f));
    fs.renameSync(path.join(TOOLS, found), dx);
  }
  return { androidJar: path.join(TOOLS, 'android.jar'), aapt2, dx, signer: path.join(TOOLS, 'uber-signer.jar') };
}

function main() {
  const build = path.join(ROOT, 'build');
  if (!fs.existsSync(path.join(build, 'index.html'))) throw new Error('Falta build/: ejecuta antes "npm run build"');
  const T = tools();
  fs.rmSync(OUT, { recursive: true, force: true });
  const W = d => { const p = path.join(OUT, d); fs.mkdirSync(p, { recursive: true }); return p; };
  const classes = W('classes'), compiled = W('compiled'), assets = W('assets/www'), gen = W('gen');

  step('copiando la interfaz web a assets/www');
  fs.cpSync(build, assets, { recursive: true, filter: s => !s.endsWith('.map') });

  step('compilando recursos (aapt2)');
  sh(T.aapt2, ['compile', '--dir', path.join(AND, 'res'), '-o', path.join(compiled, 'res.zip')]);
  const unsigned = path.join(OUT, 'GameVault-unsigned.apk');
  sh(T.aapt2, ['link', '-o', unsigned, '-I', T.androidJar,
    '--manifest', path.join(AND, 'AndroidManifest.xml'),
    '--min-sdk-version', '24', '--target-sdk-version', '34',
    '--version-code', VERSION_CODE, '--version-name', VERSION,
    '-A', path.join(OUT, 'assets'), '--java', gen, '--auto-add-overlay',
    '-0', 'wasm',                                   // .wasm sin comprimir
    path.join(compiled, 'res.zip')]);

  step('compilando Java');
  const srcs = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : p.endsWith('.java') && srcs.push(p); });
  walk(path.join(AND, 'src')); walk(gen);
  sh('javac', ['--release', '8', '-nowarn', '-encoding', 'UTF-8', '-cp', T.androidJar, '-d', classes, ...srcs]);

  step('convirtiendo a DEX');
  sh('java', ['-cp', T.dx, 'com.android.dx.command.Main', '--dex', '--min-sdk-version=24', `--output=${path.join(OUT, 'classes.dex')}`, classes]);
  sh('zip', ['-j', '-q', unsigned, path.join(OUT, 'classes.dex')]);

  if (!fs.existsSync(KS)) {
    step('creando la clave de firma ' + path.basename(KS));
    sh('keytool', ['-genkeypair', '-keystore', KS, '-storepass', KS_PASS, '-keypass', KS_PASS, '-alias', 'gamevault',
      '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=GameVault, OU=Personal, O=GameVault, C=ES']);
  }
  step('alineando y firmando');
  sh('java', ['-jar', T.signer, '-a', unsigned, '-o', path.join(OUT, 'signed'), '--ks', KS, '--ksAlias', 'gamevault',
    '--ksPass', KS_PASS, '--ksKeyPass', KS_PASS, '--allowResign']);
  const signed = fs.readdirSync(path.join(OUT, 'signed')).find(f => f.endsWith('.apk'));
  const final = path.join(ROOT, 'dist', `GameVault-${VERSION}.apk`);
  fs.mkdirSync(path.dirname(final), { recursive: true });
  fs.copyFileSync(path.join(OUT, 'signed', signed), final);
  console.log(`\n✔ APK listo: ${path.relative(ROOT, final)} (${(fs.statSync(final).size / 1048576).toFixed(1)} MB)`);
}

try { main(); } catch (e) { console.error('\n✘ ' + e.message); process.exit(1); }
