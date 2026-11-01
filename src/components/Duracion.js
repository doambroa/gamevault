import React from 'react';
import { Clock } from 'lucide-react';
import { fmtHours } from '../utils/hltb';

// Orden del ciclo de clics en la cabecera "Duración"
export const DURACION_METRICAS = [
  { key: 'hltbMain',     label: 'Historia' },
  { key: 'hltbExtra',    label: '+Extras' },
  { key: 'hltbComplete', label: '100%' },
];
const KEYS = DURACION_METRICAS.map(m => m.key);

/** Historia↑ → Historia↓ → +Extras↑ → +Extras↓ → 100%↑ → 100%↓ → Historia↑ … */
export function nextDuracionSort(sortKey, sortDir) {
  const i = KEYS.indexOf(sortKey);
  if (i < 0) return [KEYS[0], 'asc'];
  if (sortDir === 'asc') return [sortKey, 'desc'];
  return [KEYS[(i + 1) % KEYS.length], 'asc'];
}

export function DuracionTh({ sortKey, sortDir, setSort }) {
  const m = DURACION_METRICAS.find(x => x.key === sortKey);
  const [nk, nd] = nextDuracionSort(sortKey, sortDir);
  const next = DURACION_METRICAS.find(x => x.key === nk);
  return (
    <th onClick={() => setSort(nk, nd)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      title={`Historia / Historia+Extras / Completista (HowLongToBeat).\nClic: ordenar por ${next.label} ${nd === 'asc' ? '↑' : '↓'}`}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: m ? 'var(--accent)' : undefined }}>
        <Clock size={11}/> Duración
        {m && <span style={{ color: 'var(--cyan)', textTransform: 'none', letterSpacing: 0 }}>· {m.label} {sortDir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </th>
  );
}

/** "8h / 14h / 25h" con la métrica por la que se ordena en cian y las otras en gris */
export function DuracionCell({ juego, sortKey }) {
  const vals = KEYS.map(k => juego[k]);
  if (!vals.some(v => v > 0)) return <span style={{ color: 'var(--text-3)' }}>—</span>;
  const activa = KEYS.includes(sortKey) ? sortKey : null;
  return (
    <span>
      {KEYS.map((k, i) => (
        <React.Fragment key={k}>
          {i > 0 && <span style={{ color: 'var(--text-3)' }}> / </span>}
          <span style={{ color: !activa || activa === k ? 'var(--cyan)' : 'var(--text-3)', fontWeight: activa === k ? 700 : 400 }}>
            {fmtHours(juego[k])}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}
