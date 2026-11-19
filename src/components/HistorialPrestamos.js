import React from 'react';
import { History } from 'lucide-react';

const fecha = f => (f ? f.split('-').reverse().join('/') : '?');
const dias = (a, b) => { if (!a || !b) return null; const d = Math.round((new Date(b) - new Date(a)) / 86400000); return d >= 0 ? d : null; };
const dur = d => (d == null ? '' : d < 1 ? 'el mismo día' : d === 1 ? '1 día' : d < 60 ? `${d} días` : `${Math.round(d / 30.4)} meses`);

/** Quién ha tenido el juego antes (se apunta solo al marcar «devuelto») */
export default function HistorialPrestamos({ raw, compacto = false }) {
  let h = [];
  try { h = (typeof raw === 'string' ? JSON.parse(raw || '[]') : raw) || []; } catch {}
  if (!h.length) return null;
  const total = h.reduce((n, x) => n + (dias(x.desde, x.hasta) || 0), 0);
  return (
    <div className={'hist-prest' + (compacto ? ' compacto' : '')}>
      <p className="jp-section-title"><History size={12} style={{ verticalAlign: -2 }}/> Historial de préstamos <span>· {h.length} vez{h.length !== 1 ? 'es' : ''}{total ? ` · ${dur(total)} fuera en total` : ''}</span></p>
      <ol>
        {h.slice().reverse().map((x, i) => (
          <li key={i}><b>{x.a}</b><span>{fecha(x.desde)} → {fecha(x.hasta)}</span>{dias(x.desde, x.hasta) != null && <em>{dur(dias(x.desde, x.hasta))}</em>}</li>
        ))}
      </ol>
    </div>
  );
}
