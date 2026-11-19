/* Empaqueta el instalador de Windows desde Linux SIN wine.
 * electron-builder usa wine para dos cosas: (1) poner icono y versión al .exe con rcedit y
 * (2) extraer el desinstalador ejecutando el instalador. Aquí: (1) se hace en JS con «resedit»
 * en afterPack y (2) con el lector de desinstaladores que electron-builder ya trae para macOS.
 * Uso: node scripts/pack-win-nowine.js  (tras npm run build) */
const path = require('path');
const fs = require('fs');
const macos = require('app-builder-lib/out/util/macosVersion');
macos.isMacOsCatalina = () => true;          // → usa UninstallerReader (JS puro) en vez de wine

const builder = require('electron-builder');
const ResEdit = require('resedit');
const pkg = require('../package.json');

async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const exe = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.exe`);
  const data = fs.readFileSync(exe);
  const pe = ResEdit.NtExecutable.from(data, { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(pe);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, '..', 'buildres', 'icon.ico')));
  const grupos = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const id = grupos.length ? grupos[0].id : 1, lang = grupos.length ? grupos[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, lang, ico.icons.map(i => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] || ResEdit.Resource.VersionInfo.createEmpty();
  const [a, b, c] = pkg.version.split('.').map(Number);
  vi.setFileVersion(a, b, c, 0, 1033); vi.setProductVersion(a, b, c, 0, 1033);
  const nombre = pkg.build.productName || 'GameVault';
  for (const l of vi.getAllLanguagesForStringValues()) {
    vi.setStringValues(l, {
      FileDescription: nombre, ProductName: nombre, InternalName: nombre,
      OriginalFilename: `${nombre}.exe`, CompanyName: nombre,
      FileVersion: pkg.version, ProductVersion: pkg.version,
      LegalCopyright: `© ${new Date().getFullYear()} ${nombre}`,
    });
  }
  vi.outputToResourceEntries(res.entries);
  res.outputResource(pe);
  fs.writeFileSync(exe, Buffer.from(pe.generate()));
  console.log('  • icono y versión puestos con resedit en', path.basename(exe));
}

builder.build({
  targets: builder.Platform.WINDOWS.createTarget('nsis', builder.Arch.x64),
  publish: 'never',
  config: { ...pkg.build, afterPack, win: { ...pkg.build.win, signAndEditExecutable: false } },
}).then(r => console.log('OK', r.join('\n'))).catch(e => { console.error(e); process.exit(1); });
