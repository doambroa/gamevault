/**
 * hltb.js — Utilidades para mostrar datos de HowLongToBeat en la UI
 *
 * La obtención de datos se hace en el proceso principal de Electron (main.js)
 * vía IPC j:hltbFetch. Este módulo sólo formatea los valores para mostrarlos.
 */

/**
 * Formatea horas HLTB en texto corto: "8h", "14.5h", "—"
 */
export function fmtHours(h) {
  if (h == null || h === '' || h === 0) return '—';
  const n = Number(h);
  if (isNaN(n) || n <= 0) return '—';
  // Si es número entero, sin decimal; si tiene .5, mostrarlo
  return `${String(Math.round(n * 10) / 10).replace('.', ',')}h`;
}

/**
 * Devuelve string compacto para la columna de la tabla:
 * "8h / 14h / 25h" ó "—" si no hay ninguno
 */
export function hltbShort(main, extra, complete) {
  const m = fmtHours(main);
  const e = fmtHours(extra);
  const c = fmtHours(complete);
  if (m === '—' && e === '—' && c === '—') return null; // sin datos
  return `${m} / ${e} / ${c}`;
}

/**
 * True si el juego ya tiene al menos un dato HLTB
 */
export function hasHltb(juego) {
  return juego?.hltbMain > 0 || juego?.hltbExtra > 0 || juego?.hltbComplete > 0;
}
