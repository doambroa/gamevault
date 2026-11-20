/* Tema claro / oscuro. Por defecto, OSCURO. La persona puede cambiar a claro o pedir que siga al
 * del sistema (Windows, Android, iPhone…, botón «Auto»); lo que elija se recuerda en el aparato (localStorage). */
const KEY = 'gv-theme';
const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
const sistema = () => (mq && mq.matches ? 'light' : 'dark');
/** 'system' | 'light' | 'dark' */
export const getPref = () => { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'system' ? v : 'dark'; } catch { return 'dark'; } };
/** El tema que se ve ahora mismo */
export const getTheme = () => { const p = getPref(); return p === 'system' ? sistema() : p; };
export function applyTheme(t = getTheme()) {
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = t === 'light' ? '#f4f5fa' : '#080810';
}
const avisar = () => window.dispatchEvent(new CustomEvent('gv-theme', { detail: getTheme() }));
/** t: 'light' | 'dark' | 'system' */
export function setTheme(t) {
  try { if (t === 'dark') localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch {}
  document.documentElement.classList.add('theme-anim');          // transición suave sólo al cambiar
  applyTheme();
  setTimeout(() => document.documentElement.classList.remove('theme-anim'), 400);
  avisar();
}
// Si cambia el del sistema (p. ej. modo noche automático) y no se ha fijado a mano, se sigue
if (mq) {
  const fn = () => { if (getPref() === 'system') { applyTheme(); avisar(); } };
  if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn);
}
