/* Tamaño del texto (y de toda la interfaz). «Automático» lo sube en pantallas grandes:
 * en un monitor 2K/1440p sin escalado de Windows la app se veía pequeña.
 * Se aplica con CSS zoom en <html>; las alturas a pantalla completa lo compensan con --z. */
const KEY = 'gv-texto';
export const OPCIONES = [['auto', 'Automático'], ['0.9', 'Pequeño (90 %)'], ['1', 'Normal (100 %)'], ['1.1', 'Grande (110 %)'], ['1.25', 'Más grande (125 %)'], ['1.4', 'Enorme (140 %)']];
export const getPref = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };
const nativo = () => typeof window !== 'undefined' && !!window.api?.window?.setZoom;
export function autoZoom() {
  // en Windows el zoom es nativo y cambia innerWidth; el tamaño real de la ventana es outerWidth
  const w = nativo() ? window.outerWidth : window.innerWidth;
  if (w <= 900) return 1;                 // móviles y tabletas: ya usan el tamaño del sistema
  return w >= 2300 ? 1.2 : w >= 1800 ? 1.1 : 1;
}
export const getZoom = () => { const p = getPref(); return p === 'auto' ? autoZoom() : Number(p) || 1; };
export function applyTextSize() {
  const z = getZoom();
  const r = document.documentElement;
  if (nativo()) { window.api.window.setZoom(z); r.style.zoom = ''; r.style.setProperty('--z', '1'); r.dataset.zoom = String(z); return; }
  r.style.zoom = z === 1 ? '' : String(z);
  r.style.setProperty('--z', String(z));
  r.dataset.zoom = String(z);
}
export function setTextSize(v) {
  try { if (v === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch {}
  applyTextSize();
}
let t;
if (typeof window !== 'undefined') window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (getPref() === 'auto') applyTextSize(); }, 200); });
