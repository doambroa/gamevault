/* Integración con Créditos Finales (la app de «juegos terminados»)
 * Si el servidor la tiene instalada al lado, cada juego de la colección sabe si te lo has pasado,
 * con qué nota, en cuántas horas y qué apuntaste. Se empareja por título (también el título
 * original y el nombre con el que lo conoce HowLongToBeat).
 */
import { useEffect, useState } from 'react';
import { canon } from '../core/text';
import { useAccount, fetchCreditos, creditosUrl } from './account';

const PESO = { terminado: 5, jugando: 4, retomar: 3, pendiente: 2, abandonado: 1 };
export const ESTADO_CF = {
  terminado: { txt: 'Terminado', color: 'green' }, jugando: { txt: 'Jugando', color: 'cyan' }, pendiente: { txt: 'Pendiente', color: 'default' },
  abandonado: { txt: 'Abandonado', color: 'accent' }, retomar: { txt: 'Por retomar', color: 'gold' },
};
// sin subtítulos de edición: «Skyrim Special Edition» ≈ «Skyrim»
const base = t => canon(t).replace(/\b(remastered|remaster|hd|definitive edition|special edition|deluxe|goty|game of the year edition|the)\b/g, ' ').replace(/\s+/g, ' ').trim();

export function indexCreditos(lista) {
  const idx = new Map();
  for (const g of lista || []) {
    for (const k of new Set([canon(g.t), base(g.t)])) {
      if (!k) continue;
      const cur = idx.get(k);
      // gana lo más «hecho» y, a igualdad, lo más reciente
      if (!cur || PESO[g.e] > PESO[cur.e] || (PESO[g.e] === PESO[cur.e] && String(g.d || g.y) > String(cur.d || cur.y))) idx.set(k, g);
    }
  }
  return idx;
}
export function findCredito(idx, juego) {
  if (!idx || !idx.size || !juego) return null;
  for (const t of [juego.nombre, juego.tituloOriginal, juego.hltbName]) {
    if (!t) continue;
    const r = idx.get(canon(t)) || idx.get(base(t));
    if (r) return r;
  }
  return null;
}

const cache = new Map();          // usuario → Promise<{disponible, juegos}>
export function loadCreditos(user) {
  if (!cache.has(user)) cache.set(user, fetchCreditos(user).catch(() => { cache.delete(user); return { disponible: false, juegos: [] }; }));
  return cache.get(user);
}
/** Mis juegos de Créditos Finales, indexados. { disponible, idx, lista, url } */
export function useCreditos() {
  const { me } = useAccount();
  const [st, setSt] = useState({ disponible: false, idx: new Map(), lista: [], url: null });
  useEffect(() => {
    let vivo = true;
    if (!me || !me.creditos) { setSt({ disponible: false, idx: new Map(), lista: [], url: null }); return; }
    loadCreditos(me.user).then(r => vivo && setSt({ disponible: !!r.disponible, idx: indexCreditos(r.juegos), lista: r.juegos || [], url: creditosUrl() }));
    return () => { vivo = false; };
  }, [me]);
  return st;
}
// 0–5 estrellas (6 = la matrícula de honor de Créditos Finales)
export const estrellas = r => (r == null ? '' : '★'.repeat(Math.min(5, Math.round(r))) + (r > 5 ? '✦' : '') + '☆'.repeat(Math.max(0, 5 - Math.round(r))));
