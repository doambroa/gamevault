// Pruebas del importador de colecciones (CSV, Excel, Word, TXT, JSON)
const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { zipSync, strToU8 } = require('fflate');

let P, R, M, PARSER;
test.before(async () => {
  P = await import('../src/utils/importParser.js');
  R = await import('../src/utils/fileReaders.js');
  M = await import('../src/utils/platformMatch.js');
  PARSER = P.parseImportFile;
});

const MI_COLECCION = `"Id";"Juego";"Plataforma";"EstadoConservación";"Generos";"Fecha";"Formato";"Precio";"Valoracion";"ObservacionesPrivadas";"Prestamo"
"1";"Super Mario 64";"N64";"Usado";"Plataformas/Aventura";"15/10/2020";"PAL/ES";"35,50 €";"9";"Con caja
y manual";"-"
"2";"GoldenEye 007";"N64";"Nuevo";"Shooter";"01/02/2021";"PAL";"1.234,00";"10";"-";"Ana"
"3";"Super Mario 64";"N64";"Usado";"Plataformas";"-";"PAL";"-";"-";"-";"-"
"4";"Halo";"XBOX";"-";"Shooter";"-";"NTSC-J";"-";"-";"-";"-"`;

test('CSV de "Mi Colección": campos con salto de línea, precios, fechas, región y préstamo', () => {
  const r = PARSER(MI_COLECCION, 'csv');
  const mario = r.juegos.find(j => j.nombre === 'Super Mario 64');
  assert.equal(mario.plataformaNombre, 'Nintendo 64');
  assert.equal(mario.precio, '35.5');
  assert.equal(mario.fechaAdquisicion, '2020-10-15');
  assert.equal(mario.region, 'PAL');
  assert.equal(mario.comentarios, 'Con caja\ny manual');
  assert.equal(mario.unidades, 2, 'la fila repetida se agrupa como 2 unidades');
  const golden = r.juegos.find(j => j.nombre === 'GoldenEye 007');
  assert.equal(golden.precio, '1234', 'separador de miles');
  assert.equal(golden.prestadoA, 'Ana');
  assert.equal(r.juegos.find(j => j.nombre === 'Halo').region, 'NTSC-J');
  assert.equal(r.juegos.length, 3);
  assert.ok(r.warnings.some(w => /agrupada/.test(w)));
});

test('CSV genérico: "Valoración" no se confunde con "Precio" y se detectan unidades', () => {
  const csv = 'Título,Valoración,Precio,Consola,Cantidad,Fecha lanzamiento\nZelda,9,"49,99",SNES,2,1992\nMetroid,8,30,SNES,,1994-03-19';
  const r = PARSER(csv, 'csv');
  assert.equal(r.juegos[0].nombre, 'Zelda');
  assert.equal(r.juegos[0].valoracion, 9);
  assert.equal(r.juegos[0].precio, '49.99');
  assert.equal(r.juegos[0].plataformaNombre, 'Super Nintendo');
  assert.equal(r.juegos[0].unidades, 2);
  assert.equal(r.juegos[0].fechaLanzamiento, '1992-01-01');
  assert.equal(r.juegos[1].unidades, 1);
  assert.equal(r.juegos[1].fechaLanzamiento, '1994-03-19');
});

test('CSV sin cabecera reconocible: 1ª columna = nombre, 2ª = plataforma', () => {
  const r = PARSER('Tetris;GB\nPokemon Rojo;GB', 'csv');
  assert.deepEqual(r.juegos.map(j => j.nombre), ['Tetris', 'Pokemon Rojo']);
  assert.equal(r.juegos[0].plataformaNombre, 'Game Boy');
});

test('TXT: viñetas, numeración, separadores | / ; y tabulador, comentarios', () => {
  const txt = '# mi lista\n- Sonic | Mega Drive\n2. Streets of Rage / SMD\nCastlevania\tNES\n• Doom;PC\nChrono Trigger\n';
  const r = PARSER(txt, 'txt');
  assert.deepEqual(r.juegos.map(j => j.nombre), ['Sonic', 'Streets of Rage', 'Castlevania', 'Doom', 'Chrono Trigger']);
  assert.equal(r.juegos[1].plataformaNombre, 'Mega Drive / Genesis');
  assert.equal(r.juegos[4].plataformaNombre, '');
  assert.ok(r.warnings.some(w => /sin plataforma/.test(w)));
});

test('JSON: export de GameVault (plataformaId → nombre) y array genérico', () => {
  const gv = { plataformas: [{ id: 3, nombre: 'PS2' }], juegos: [{ id: 1, plataformaId: 3, nombre: 'GTA SA', unidades: 2, imagenes: '["a.jpg"]' }] };
  const r = PARSER(JSON.stringify(gv), 'json');
  assert.equal(r.juegos[0].plataformaNombre, 'PlayStation 2');
  assert.equal(r.juegos[0].unidades, 2);
  assert.deepEqual(r.juegos[0].imagenes, ['a.jpg']);
  const r2 = PARSER(JSON.stringify([{ title: 'Ico', platform: 'PS2', rating: 10 }]), 'json');
  assert.equal(r2.juegos[0].nombre, 'Ico'); assert.equal(r2.juegos[0].valoracion, 10);
  assert.throws(() => PARSER('{no es json', 'json'), /JSON/);
});

test('Excel (.xlsx) generado de verdad → CSV → juegos (fechas reales incluidas)', () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Nombre', 'Plataforma', 'Precio', 'Fecha compra'],
    ['Final Fantasy VII', 'PS1', 25.5, new Date(Date.UTC(2019, 4, 3))],
    ['Silent Hill', 'PS1', 40, ''],
  ], { cellDates: true });
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const csv = R.excelToCsv(buf);
  const r = PARSER(csv, 'csv');
  assert.equal(r.juegos.length, 2);
  assert.equal(r.juegos[0].plataformaNombre, 'PlayStation');
  assert.equal(r.juegos[0].precio, '25.5');
  assert.equal(r.juegos[0].fechaAdquisicion, '2019-05-03');
});

function makeDocx(bodyXml) {
  const doc = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`;
  return zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8(doc) }).buffer;
}
const p = t => `<w:p w:rsidR="00A1"><w:pPr><w:pStyle w:val="List"/></w:pPr><w:r><w:t>${t}</w:t></w:r></w:p>`;

test('Word (.docx) con lista de párrafos → un juego por línea', () => {
  const r = R.docxToText(makeDocx(p('Mis juegos de SNES') + p('Super Metroid | SNES') + p('Donkey Kong Country &amp; amigos')));
  assert.equal(r.kind, 'txt');
  const j = PARSER(r.text, 'txt').juegos;
  assert.deepEqual(j.map(x => x.nombre), ['Mis juegos de SNES', 'Super Metroid', 'Donkey Kong Country & amigos']);
});

test('Word (.docx) con tabla Juego/Plataforma → CSV', () => {
  const cell = t => `<w:tc><w:tcPr/>${p(t)}</w:tc>`;
  const row = (...c) => `<w:tr w:rsidR="1"><w:trPr/>${c.map(cell).join('')}</w:tr>`;
  const r = R.docxToText(makeDocx(`<w:tbl><w:tblPr/>${row('Juego', 'Plataforma')}${row('Ocarina of Time', 'N64')}${row('Majora\'s Mask', 'N64')}</w:tbl>`));
  assert.equal(r.kind, 'csv');
  const j = PARSER(r.text, 'csv').juegos;
  assert.equal(j.length, 2);
  assert.equal(j[1].nombre, "Majora's Mask");
  assert.equal(j[1].plataformaNombre, 'Nintendo 64');
});

test('Word: fichero que no es .docx → error claro', () => {
  assert.throws(() => R.docxToText(zipSync({ 'a.txt': strToU8('x') }).buffer), /Word/);
});

test('emparejar plataformas importadas con las del usuario', () => {
  const mine = [{ id: 1, nombre: 'Switch' }, { id: 2, nombre: 'PS2' }, { id: 3, nombre: 'Nintendo 64' }, { id: 4, nombre: 'Mega Drive' }, { id: 5, nombre: 'Master System 2' }];
  assert.equal(M.findPlatform('Nintendo Switch', mine)?.id, 1);
  assert.equal(M.findPlatform('PlayStation 2', mine)?.id, 2);
  assert.equal(M.findPlatform('N64', mine)?.id, 3);
  assert.equal(M.findPlatform('Mega Drive / Genesis', mine)?.id, 4);
  assert.equal(M.findPlatform('nintendo 64', mine)?.id, 3);
  assert.equal(M.findPlatform('Dreamcast', mine), null);
});
