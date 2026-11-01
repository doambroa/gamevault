/* Tema claro / oscuro. Se guarda en el propio dispositivo (localStorage) y se aplica
 * antes de pintar la app para que no haya parpadeo. Oscuro por defecto. */
const KEY = 'gv-theme';
export const getTheme = () => { try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } };
export function applyTheme(t = getTheme()) {
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = t === 'light' ? '#f4f5fa' : '#080810';
}
export function setTheme(t) {
  try { localStorage.setItem(KEY, t); } catch {}
  document.documentElement.classList.add('theme-anim');          // transición suave sólo al cambiar
  applyTheme(t);
  setTimeout(() => document.documentElement.classList.remove('theme-anim'), 400);
  window.dispatchEvent(new CustomEvent('gv-theme', { detail: t }));
}
