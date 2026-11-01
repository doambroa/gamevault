import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, TrendingUp, ExternalLink } from 'lucide-react';

const api = window.api;

// 27500000 → "27,5 M" · 930000 → "930.000"
export function fmtUnits(n) {
  if (n == null || !(n > 0)) return '—';
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('es-ES', { maximumFractionDigits: n >= 1e7 ? 1 : 2 })} M`;
  return Math.round(n).toLocaleString('es-ES');
}
const fmtDate = d => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

function parseVentas(juego) {
  if (!juego?.ventasJson) return null;
  try { return JSON.parse(juego.ventasJson); } catch { return null; }
}

/** Sólo hay gráfica si hay una evolución real: ≥ 3 cifras con fecha */
export const hasSalesSeries = v => Array.isArray(v?.history) && v.history.length >= 3;

export default function VentasSection({ juego, onUpdated }) {
  const [data, setData]       = useState(() => parseVentas(juego));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const autoTried = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setData(parseVentas(juego)); setError(''); }, [juego?.id, juego?.ventasJson]);

  const refresh = async () => {
    if (!juego) return;
    setLoading(true); setError('');
    try {
      const r = await api.juegos.ventasFetch({ id: juego.id, nombre: juego.nombre });
      if (r?.ok) { setData(r); onUpdated?.(); }
      else { setData(null); setError(r?.error || 'Sin datos de ventas'); }
    } catch { setError('Error al conectar con VGChartz'); }
    finally { setLoading(false); }
  };

  // Primera vez que se abre un juego sin consultar → se busca solo
  useEffect(() => {
    if (!juego || juego.ventasFetched || autoTried.current === juego.id) return;
    autoTried.current = juego.id;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [juego?.id, juego?.ventasFetched]);

  return (
    <div className="jp-data">
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <p className="jp-section-title" style={{ margin:0 }}>Ventas totales</p>
        <button className="jp-mini-btn" onClick={refresh} disabled={loading} title="Actualizar desde VGChartz">
          <RefreshCw size={11} className={loading ? 'spin' : ''}/>
          {loading ? 'Buscando…' : 'Actualizar'}
        </button>
      </div>

      {error && !loading && <p style={{ fontSize:11, color:'#f87171', marginBottom:6 }}>{error}</p>}

      {data?.total > 0 ? (
        <>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:26, fontWeight:800, color:'var(--text-0)', fontFamily:'var(--font-m)', letterSpacing:'-0.02em' }}>
              {fmtUnits(data.total)}
            </span>
            <span style={{ fontSize:12, color:'var(--text-3)' }}>unidades en todo el mundo</span>
          </div>
          {data.porConsola?.length > 1 && (
            <p style={{ fontSize:11, color:'var(--text-3)', marginTop:4, lineHeight:1.6 }}>
              {data.porConsola.slice(0, 6).map(c => `${c.consola} ${fmtUnits(c.total)}`).join(' · ')}
            </p>
          )}
          {hasSalesSeries(data) && <SalesChart points={data.history}/>}
          <p style={{ fontSize:10, color:'var(--text-3)', marginTop:8, display:'flex', alignItems:'center', gap:4 }}>
            <TrendingUp size={10}/> Fuente: VGChartz{data.nombre && data.nombre !== juego?.nombre ? ` · «${data.nombre}»` : ''}
            {data.url && (
              <a href={data.url} target="_blank" rel="noreferrer" style={{ color:'var(--text-3)', display:'inline-flex' }} title="Ver en VGChartz">
                <ExternalLink size={10}/>
              </a>
            )}
          </p>
        </>
      ) : !loading && !error ? (
        <p style={{ fontSize:12, color:'var(--text-3)' }}>
          {juego?.ventasFetched ? 'Sin datos de ventas publicados para este juego.' : 'Sin datos — pulsa Actualizar para buscar en VGChartz'}
        </p>
      ) : null}
    </div>
  );
}

// ── Gráfica de ventas acumuladas (SVG, una serie, cruz + tooltip) ─────────────
function SalesChart({ points }) {
  const W = 340, H = 150, P = { l: 44, r: 10, t: 12, b: 24 };
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  const xs = points.map(p => new Date(p.date).getTime());
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const vMax = Math.max(...points.map(p => p.value));
  const vMin = Math.min(...points.map(p => p.value));
  // Eje Y desde un mínimo "redondo" por debajo del primer valor: se ve la evolución
  const step = niceStep((vMax - vMin) || vMax, 3);
  const y0 = Math.max(0, Math.floor(vMin / step) * step - (vMax === vMin ? step : 0));
  const y1 = Math.ceil(vMax / step) * step || 1;
  const sx = t => P.l + ((t - x0) / ((x1 - x0) || 1)) * (W - P.l - P.r);
  const sy = v => H - P.b - ((v - y0) / ((y1 - y0) || 1)) * (H - P.t - P.b);
  const ticks = [];
  for (let v = y0; v <= y1 + 1; v += step) ticks.push(v);
  const years = [...new Set(points.map(p => p.date.slice(0, 4)))];
  const yearTicks = years.length > 5 ? years.filter((_, i) => i % Math.ceil(years.length / 5) === 0) : years;

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(xs[i]).toFixed(1)},${sy(p.value).toFixed(1)}`).join('');

  const onMove = e => {
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (W / rect.width);
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(sx(xs[i]) - cx) < Math.abs(sx(xs[best]) - cx)) best = i;
    setHover(best);
  };

  const hp = hover != null ? points[hover] : null;
  const hx = hp ? sx(xs[hover]) : 0, hy = hp ? sy(hp.value) : 0;
  const prev = hover > 0 ? points[hover - 1] : null;

  return (
    <div style={{ position:'relative', marginTop:8, paddingTop:50 }}>
      {!hp && (
        <div style={{ position:'absolute', top:14, left:0, fontSize:11, color:'var(--text-3)' }}>
          Ventas acumuladas · pasa el dedo o el ratón por la línea
        </div>
      )}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        aria-label={`Evolución de ventas: de ${fmtUnits(points[0].value)} (${fmtDate(points[0].date)}) a ${fmtUnits(points[points.length - 1].value)} (${fmtDate(points[points.length - 1].date)})`}
        style={{ display:'block', touchAction:'pan-y', cursor:'crosshair' }}
        onPointerMove={onMove} onPointerDown={onMove}
        onPointerLeave={e => { if (e.pointerType === 'mouse') setHover(null); }}>
        {/* rejilla y eje Y */}
        {ticks.map(v => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={sy(v)} y2={sy(v)} stroke="var(--border)" strokeWidth="1"/>
            <text x={P.l - 6} y={sy(v) + 3} textAnchor="end" fontSize="9" fill="var(--text-3)" fontFamily="var(--font-m)">{fmtUnits(v)}</text>
          </g>
        ))}
        {/* eje X: años */}
        {yearTicks.map(y => {
          const t = new Date(`${y}-01-01`).getTime();
          const tx = Math.min(W - P.r, Math.max(P.l, sx(Math.max(x0, t))));
          return <text key={y} x={tx} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--text-3)" fontFamily="var(--font-m)">{y}</text>;
        })}
        {/* área suave + línea */}
        <path d={`${path}L${sx(x1).toFixed(1)},${sy(y0)}L${sx(x0).toFixed(1)},${sy(y0)}Z`} fill="var(--cyan)" opacity="0.10"/>
        <path d={path} fill="none" stroke="var(--cyan)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
        {/* último valor etiquetado */}
        <circle cx={sx(x1)} cy={sy(points[points.length - 1].value)} r="3.5" fill="var(--cyan)" stroke="var(--bg-2)" strokeWidth="2"/>
        {/* cruz de hover */}
        {hp && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={P.t} y2={H - P.b} stroke="var(--text-3)" strokeWidth="1" strokeDasharray="3 3"/>
            <circle cx={hx} cy={hy} r="5" fill="var(--cyan)" stroke="var(--bg-2)" strokeWidth="2"/>
          </g>
        )}
        {/* zona de captura más grande que la marca */}
        <rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} fill="transparent"/>
      </svg>
      {hp && (
        <div style={{ position:'absolute', top:0, pointerEvents:'none',
          left: `${(hx / W) * 100}%`, transform: `translateX(${hx > W * 0.66 ? '-100%' : hx < W * 0.33 ? '0' : '-50%'})`,
          background:'var(--bg-4)', border:'1px solid var(--border)', borderRadius:'var(--r)',
          padding:'6px 9px', fontSize:11, whiteSpace:'nowrap', boxShadow:'0 4px 14px rgba(0,0,0,.35)' }}>
          <div style={{ color:'var(--text-3)' }}>{fmtDate(hp.date)}</div>
          <div style={{ color:'var(--text-0)', fontWeight:700, fontFamily:'var(--font-m)', fontSize:13 }}>{fmtUnits(hp.value)}</div>
          {prev && hp.value > prev.value && (
            <div style={{ color:'var(--text-2)' }}>+{fmtUnits(hp.value - prev.value)} desde {fmtDate(prev.date)}</div>
          )}
        </div>
      )}
    </div>
  );
}

function niceStep(range, n) {
  const raw = range / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
}
