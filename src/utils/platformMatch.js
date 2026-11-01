import { CONSOLAS_CONOCIDAS } from './wikipedia.js';

// "Nintendo Switch" ↔ "Switch", "PlayStation 2" ↔ "PS2", "Mega Drive / Genesis" ↔ "Mega Drive"…
const normP = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^(sega|nintendo|sony|microsoft)\s+/, '').replace(/[^a-z0-9]+/g, '');
/** Empareja un nombre de plataforma importado con una de las del usuario */
export function findPlatform(name, plataformas) {
  const n = normP(name);
  if (!n) return null;
  const exact = plataformas.find(p => normP(p.nombre) === n);
  if (exact) return exact;
  const parts = String(name).split('/').map(normP).filter(Boolean);
  for (const c of CONSOLAS_CONOCIDAS) {
    const names = [c.nombre, ...(c.alias || [])].map(normP);
    if (!names.some(x => x === n || parts.includes(x))) continue;
    const hit = plataformas.find(p => names.includes(normP(p.nombre)));
    if (hit) return hit;
  }
  return plataformas.find(p => parts.includes(normP(p.nombre))) || null;
}
