import { imagenPorNombre, CONSOLAS } from '../data/consolas';

/* Pone su imagen por defecto (public/consolas) a las consolas que no tienen ninguna y,
 * de paso, completa marca y tipo si están vacíos (p. ej. colecciones importadas de Excel).
 * Se ejecuta una vez al abrir la app y otra tras cada importación (el núcleo borra la marca
 * al importar), así una imagen que el usuario quite a propósito no vuelve en cada arranque. */
const MARCA = 'imgsPorDefecto';

export async function asignarImagenesPorDefecto({ forzar = false } = {}) {
  const api = window.api;
  if (!api?.plataformas || !api?.config) return 0;
  if (!forzar && (await api.config.get(MARCA)) === 'hecho') return 0;
  const ps = await api.plataformas.getAll();
  let n = 0;
  for (const p of ps) {
    let imgs = [];
    try { imgs = typeof p.imagenes === 'string' ? JSON.parse(p.imagenes || '[]') : (p.imagenes || []); } catch {}
    const img = imagenPorNombre(p.nombre);
    if (!img) continue;
    const ficha = CONSOLAS.find(c => `./consolas/${c.img}.png` === img) || {};
    const cambios = {};
    if (!imgs.length) cambios.imagenes = [img];
    if (!p.marca && ficha.marca) cambios.marca = ficha.marca;
    if (!p.tipo && ficha.tipo) cambios.tipo = ficha.tipo;
    if (!Object.keys(cambios).length) continue;
    await api.plataformas.update({ ...p, imagenes: imgs, ...cambios });
    n++;
  }
  await api.config.set(MARCA, 'hecho');
  return n;
}
