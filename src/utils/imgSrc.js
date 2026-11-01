/**
 * imgSrc(path) — convierte cualquier ruta de imagen en una URL válida para <img src>
 *
 * Electron bloquea file:// desde el renderer (CSP).
 * Usamos el protocolo "localimg://" registrado en main.js para servir ficheros locales.
 *
 * Ejemplos de entrada y salida:
 *   "https://rawg.io/img.jpg"           → sin cambios (URL remota)
 *   "data:image/png;base64,..."         → sin cambios (data URI)
 *   "C:\Users\usuario\AppData\img.jpg"   → "localimg://C:/Users/usuario/AppData/img.jpg"
 *   "C:/Users/usuario/AppData/img.jpg"   → "localimg://C:/Users/usuario/AppData/img.jpg"
 *   "localimg://C:/..."                 → sin cambios (ya procesada)
 */
export function imgSrc(p) {
  if (!p) return null;

  // Ya es una URL válida — devolver sin tocar para evitar recursión infinita
  if (
    p.startsWith('http://') ||
    p.startsWith('https://') ||
    p.startsWith('data:') ||
    p.startsWith('localimg://') ||
    p.startsWith('blob:') ||
    p.startsWith('file://') ||
    p.startsWith('./consolas/')      // imagen por defecto incluida en la app
  ) return p;

  // Ruta local de disco → localimg://local/?p=<base64>
  // Usamos base64 para evitar que Chromium interprete "C:" como hostname
  // y corrompa la URL antes de que llegue al handler
  const b64 = btoa(unescape(encodeURIComponent(p)));
  return `localimg://local/?p=${b64}`;
}

/**
 * parseImgs(raw) — parsea el campo imagenes de la BD (string JSON o array)
 */
export function parseImgs(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) || []; }
  catch { return []; }
}

/**
 * firstImg(raw) — devuelve la primera imagen lista para usar en <img src>
 */
export function firstImg(raw) {
  const imgs = parseImgs(raw);
  return imgs[0] ? imgSrc(imgs[0]) : null;
}
