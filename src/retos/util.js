import { Sun, Leaf, Snowflake, Flower2, Music } from 'lucide-react';

// ── YouTube ───────────────────────────────────────────────────────────────────
export function ytId(url) {
  const s = String(url || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch { return null; }
  const h = u.hostname.replace(/^(www|m|music)\./, '').toLowerCase();
  let id = '';
  if (h === 'youtu.be') id = u.pathname.split('/')[1] || '';
  else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') || (u.pathname.match(/\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/) || [])[1] || '';
  } else return null;
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
export const ytThumb = id => id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
export const ytWatch = id => `https://www.youtube.com/watch?v=${id}`;
// YouTube crea una lista al momento con hasta 50 vídeos, sin cuenta
export function ytLista(ids) {
  const l = [...new Set(ids.filter(Boolean))];
  const trozos = [];
  for (let i = 0; i < l.length; i += 50) trozos.push({ desde: i + 1, hasta: Math.min(l.length, i + 50), url: 'https://www.youtube.com/watch_videos?video_ids=' + l.slice(i, i + 50).join(',') });
  return trozos;
}

// ── Estaciones ────────────────────────────────────────────────────────────────
export const ESTACIONES = {
  verano:    { nombre: 'Verano',    Icon: Sun,       c1: '#ff9f43', c2: '#ee5253' },
  otono:     { nombre: 'Otoño',     Icon: Leaf,      c1: '#e58e26', c2: '#8e5b3a' },
  invierno:  { nombre: 'Invierno',  Icon: Snowflake, c1: '#48cae4', c2: '#5f6fd8' },
  primavera: { nombre: 'Primavera', Icon: Flower2,   c1: '#2ecc71', c2: '#f78fb3' },
  otra:      { nombre: 'Playlist',  Icon: Music,     c1: '#9b5de5', c2: '#e63946' },
};
export const estacion = k => ESTACIONES[k] || ESTACIONES.otra;

// ── Fechas ────────────────────────────────────────────────────────────────────
export function fechaDia(inicio, n) {          // día n (1…) del reto como Date local
  if (!inicio) return null;
  const [y, m, d] = inicio.split('-').map(Number);
  return new Date(y, m - 1, d + n - 1);
}
export const fmtDia = (f, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => f ? f.toLocaleDateString('es-ES', opts) : '';
export function quedan(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!(ms > 0)) return null;
  const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60;
  if (d > 0) return `${d} día${d > 1 ? 's' : ''} y ${h} h`;
  if (h > 0) return `${h} h y ${m} min`;
  return `${m} min`;
}

// «Día 3 - …» / «3. …» / «- …» al principio de cada línea se quitan al pegar la lista de frases
export function limpiarFrases(txt) {
  return String(txt || '').split(/\r?\n/)
    .map(l => l.replace(/^\s*(?:#+\s*)?(?:d[ií]a\s*\d+\s*[\\]?[-–—:.)]?\s*|\d+\s*[.)\-–:]\s*|[-*•]\s+)/i, '').replace(/\\([!-])/g, '$1').trim())
    .filter(Boolean);
}

// El texto como en los documentos de Drive (para pegarlo o guardarlo)
export function comoDocumento(pl) {
  const L = [pl.titulo, ''];
  (pl.dias || []).forEach((d, i) => {
    L.push(`# Día ${i + 1} - ${d.t}`, '');
    const ap = Object.values(pl.aportes?.[i + 1] || {});
    ap.forEach(a => L.push(`@${a.quien?.alias || a.quien?.display || a.quien?.key}: [${a.titulo || ytWatch(a.yt)}](${a.url || ytWatch(a.yt)})`));
    L.push('');
  });
  return L.join('\n');
}

export async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch {}
  try {
    const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy'); t.remove(); return ok;
  } catch { return false; }
}
