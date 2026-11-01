// Lectura de Excel y Word directamente en la app (sin pasar por Electron),
// así funciona igual en Windows y en Android.
import * as XLSX from 'xlsx';
import { unzipSync, strFromU8 } from 'fflate';

/** Excel (.xlsx/.xls/.ods) → CSV con ';' de la primera hoja con datos */
export function excelToCsv(arrayBuffer) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';', RS: '\n', dateNF: 'yyyy-mm-dd', blankrows: false });
    if (csv.replace(/[;\s]/g, '')) return csv;
  }
  return '';
}

const xmlText = xml => xml
  .replace(/<w:tab\/>/g, '\t')
  .replace(/<w:br\/>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .trim();

/**
 * Word (.docx) → { kind:'csv', text } si el documento tiene tablas (una fila por juego),
 *               { kind:'txt', text } si es una lista de párrafos (un juego por línea).
 */
export function docxToText(arrayBuffer) {
  const files = unzipSync(new Uint8Array(arrayBuffer), { filter: f => f.name === 'word/document.xml' });
  const xmlBytes = files['word/document.xml'];
  if (!xmlBytes) throw new Error('No es un documento de Word (.docx) válido');
  const xml = strFromU8(xmlBytes);

  const tables = [...xml.matchAll(/<w:tbl(?:\s[^>]*)?>([\s\S]*?)<\/w:tbl>/g)].map(m => m[1]);
  if (tables.length) {
    const lines = [];
    for (const t of tables) {
      for (const tr of t.matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)) {
        const cells = [...tr[1].matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)]
          .map(c => xmlText(c[1].replace(/<\/w:p>/g, ' ')).replace(/[;\n\t]+/g, ' ').trim());
        if (cells.some(Boolean)) lines.push(cells.join(';'));
      }
    }
    if (lines.length) return { kind: 'csv', text: lines.join('\n') };
  }
  const paragraphs = [...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)]
    .map(m => xmlText(m[1]))
    .filter(Boolean);
  return { kind: 'txt', text: paragraphs.join('\n') };
}
