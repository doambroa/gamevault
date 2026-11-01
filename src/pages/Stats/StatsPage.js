import React, { useState, useEffect, useCallback } from 'react';
import { imgSrc } from '../../utils/imgSrc';
import { BarChart2, Circle, Grid, ArrowLeft, SortAsc, Clock, TrendingUp, Star, MousePointerClick } from 'lucide-react';
import './Stats.css';
import JuegoPanel from '../Juegos/JuegoPanel';
import JuegoForm from '../Juegos/JuegoForm';
import '../Juegos/JuegoPanel.css';
import { fmtHours } from '../../utils/hltb';
import { fmtUnits } from '../Juegos/VentasSection';

const api = window.api;
const VIEWS = [
  { id:'bubbles', label:'Burbujas', icon:Circle    },
  { id:'bars',    label:'Barras',   icon:BarChart2 },
  { id:'grid',    label:'Tarjetas', icon:Grid      },
];
const TIMELINE_AXES = [
  { id:'fechaLanzamiento', label:'Fecha lanzamiento' },
  { id:'fechaAdquisicion', label:'Fecha adquisición' },
  { id:'precio',           label:'Precio' },
  { id:'nombre',           label:'Nombre (A-Z)' },
];

export default function StatsPage() {
  const [stats,  setStats]  = useState(null);
  const [juegos, setJuegos] = useState([]);
  const [plats,  setPlats]  = useState([]);
  const [view,   setView]   = useState('bubbles');
  const [timelinePlatId, setTimelinePlatId] = useState(null);
  const setTimelinePlat = p => setTimelinePlatId(p ? p.id : null);
  // Detalle de juego (panel derecho) y edición desde la línea temporal
  const [panelJuego, setPanelJuego] = useState(null);
  const [panelOpen, setPanelOpen]   = useState(false);
  const [editJuego, setEditJuego]   = useState(null);
  const [timelineAxis, setTimelineAxis] = useState('fechaLanzamiento');

  const load = useCallback(async () => {
    const [s, j, p] = await Promise.all([
      api.stats.get(), api.juegos.getAll({}), api.plataformas.getAll(),
    ]);
    setStats(s); setJuegos(j); setPlats(p);
    setPanelJuego(cur => (cur ? j.find(x => x.id === cur.id) || null : cur));
  }, []);
  useEffect(() => { if (api) load(); }, [load]);
  // Cambios en segundo plano (HLTB, ventas) → la gráfica se actualiza sola
  useEffect(() => {
    if (!api?.onChanged) return;
    let t; const off = api.onChanged(() => { clearTimeout(t); t = setTimeout(load, 400); });
    return () => { clearTimeout(t); off(); };
  }, [load]);

  if (!stats) return <div className="page"><p style={{color:'var(--text-2)'}}>Cargando…</p></div>;

  const platData = plats.map(p => {
    const pJuegos = juegos.filter(j => j.plataformaId === p.id);
    const imgs = typeof p.imagenes==='string'?JSON.parse(p.imagenes||'[]'):(p.imagenes||[]);
    return { ...p, numJuegos:pJuegos.length, cover:imgs[0]||null, juegos:pJuegos };
  }).filter(p => p.numJuegos > 0).sort((a,b) => b.numJuegos - a.numJuegos);

  const max = platData[0]?.numJuegos || 1;
  

  const timelinePlat = timelinePlatId != null
    ? (() => { const p = plats.find(x => x.id === timelinePlatId); return p ? { ...p, juegos: juegos.filter(j => j.plataformaId === p.id) } : null; })()
    : null;

  if (timelinePlat) return (
    <>
      <Timeline plat={timelinePlat} axis={timelineAxis} activeId={panelOpen ? panelJuego?.id : null}
        onAxisChange={setTimelineAxis} onBack={() => { setTimelinePlat(null); setPanelOpen(false); }}
        onOpen={j => { setPanelJuego(j); setPanelOpen(true); }}
        panelOpen={panelOpen}/>
      <JuegoPanel juego={panelJuego} plataforma={timelinePlat} open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onEdit={() => { setEditJuego(panelJuego); }}
        onRefresh={load}/>
      <JuegoForm open={!!editJuego} initial={editJuego} plataformas={plats}
        onClose={() => setEditJuego(null)}
        onSave={async data => { await api.juegos.update({ id: editJuego.id, ...data }); setEditJuego(null); await load(); }}/>
    </>
  );

  return (
    <div className="page">
      <div className="stats-header">
        <div>
          <h1 className="page-title">Estadísticas</h1>
          <p className="page-sub">{stats.totalJuegos} juegos en {stats.totalPlataformas} plataformas</p>
        </div>
        <div className="view-selector">
          {VIEWS.map(({id,label,icon:Icon}) => (
            <button key={id} className={`view-btn ${view===id?'active':''}`} onClick={()=>setView(id)}>
              <Icon size={15}/> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── BUBBLES ── */}
      {view==='bubbles' && (
        <div className="bubbles-container">
          {platData.map(p => {
            const size = 80 + (p.numJuegos/max)*160;
            return (
              <div key={p.id} className="bubble-wrap" style={{width:size,height:size}}
                onClick={() => setTimelinePlat(p)}>
                <div className="bubble" style={{width:size,height:size}}>
                  {p.cover
                    ? <img src={imgSrc(p.cover)} alt={p.nombre} className="bubble-img"/>
                    : <div className="bubble-no-img">{p.nombre.slice(0,2)}</div>}
                  <div className="bubble-overlay">
                    <p className="bubble-name">{p.nombre}</p>
                    <p className="bubble-count">{p.numJuegos} juegos</p>
                    <p className="bubble-hint">Clic → timeline</p>
                  </div>
                </div>
                <p className="bubble-label">{p.nombre}</p>
                <p className="bubble-sublabel">{p.numJuegos} juegos</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── BARS ── */}
      {view==='bars' && (
        <div className="bars-list">
          {platData.map(p => (
            <div key={p.id} className="bar-row" onClick={() => setTimelinePlat(p)}>
              <div className="bar-cover">
                {p.cover
                  ? <img src={imgSrc(p.cover)} alt={p.nombre} className="bar-cover-img"/>
                  : <div className="bar-cover-empty">{p.nombre.slice(0,2)}</div>}
              </div>
              <div className="bar-info">
                <div className="bar-top">
                  <span className="bar-name">{p.nombre}</span>
                  <span className="bar-num">{p.numJuegos}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{width:`${(p.numJuegos/max)*100}%`}}/>
                </div>
                <span className="bar-marca">{p.marca} · {p.tipo}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── GRID ── */}
      {view==='grid' && (
        <div className="stat-grid">
          {platData.map(p => (
            <div key={p.id} className="stat-tile" onClick={() => setTimelinePlat(p)}>
              <div className="stat-tile-num">{p.numJuegos}</div>
              {p.cover
                ? <img src={imgSrc(p.cover)} alt={p.nombre} className="stat-tile-img"/>
                : <div className="stat-tile-no-img">{p.nombre.slice(0,2)}</div>}
              <div className="stat-tile-info">
                <p className="stat-tile-name">{p.nombre}</p>
                <p className="stat-tile-marca">{p.marca}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Genre bars */}
      {stats.porGenero?.length > 0 && (
        <div style={{marginTop:40}}>
          <p className="section-title">Géneros más jugados</p>
          <div style={{background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'16px 20px'}}>
            {stats.porGenero.map((g,i) => (
              <div key={g.genero} style={{display:'flex',alignItems:'center',gap:12,marginBottom:i<stats.porGenero.length-1?10:0}}>
                <span style={{width:110,fontSize:12,color:'var(--text-1)'}}>{g.genero}</span>
                <div style={{flex:1,height:5,background:'var(--bg-4)',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(g.n/stats.porGenero[0].n)*100}%`,
                    background:'linear-gradient(90deg,var(--accent),var(--gold))',borderRadius:3}}/>
                </div>
                <span style={{width:24,fontSize:11,color:'var(--text-3)',fontFamily:'var(--font-m)',textAlign:'right'}}>{g.n}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Game hover tooltip ───────────────────────────────────────────────────────
function GameTooltip({ juego, visible, x, y }) {
  if (!juego || !visible) return null;
  const imgs = typeof juego.imagenes==='string'?JSON.parse(juego.imagenes||'[]'):(juego.imagenes||[]);
  const hasH = juego.hltbMain > 0 || juego.hltbExtra > 0 || juego.hltbComplete > 0;
  

  return (
    <div className="game-tooltip" style={{
      position:'fixed', left: x + 16 + 260 > window.innerWidth ? x - 16 - 260 : x + 16, top: Math.min(Math.max(y-60, 8), window.innerHeight - 380),
      pointerEvents:'none', zIndex:9999,
    }}>
      {imgs[0] && (
        <img src={imgSrc(imgs[0])} alt={juego.nombre}
          style={{width:'100%',height:100,objectFit:'cover',borderRadius:'var(--r) var(--r) 0 0',display:'block'}}/>
      )}
      <div style={{padding:'8px 10px'}}>
        <p style={{fontWeight:600,fontSize:13,color:'var(--text-0)',marginBottom:3}}>{juego.nombre}</p>
        {juego.genero && <p style={{fontSize:11,color:'var(--text-3)'}}>{juego.genero}</p>}
        {juego.desarrolladora && <p style={{fontSize:11,color:'var(--text-3)'}}>{juego.desarrolladora}</p>}
        {juego.fechaLanzamiento && <p style={{fontSize:11,color:'var(--gold)',fontFamily:'var(--font-m)',marginTop:2}}>{juego.fechaLanzamiento}</p>}
        {juego.precio && <p style={{fontSize:11,color:'var(--gold)',fontFamily:'var(--font-m)'}}>{Number(juego.precio).toFixed(2)} €</p>}
        {(juego.unidades || 1) > 1 && <p style={{fontSize:11,color:'var(--cyan)'}}>{juego.unidades} unidades</p>}

        {(hasH || juego.ventasTotal > 0 || juego.valoracion) && <div className="gt-sep"/>}
        {hasH && (
          <div className="gt-row">
            <Clock size={11}/>
            <div className="gt-hltb">
              <span><b style={{color:'var(--cyan)'}}>{fmtHours(juego.hltbMain)}</b><i>Historia</i></span>
              <span><b style={{color:'var(--gold)'}}>{fmtHours(juego.hltbExtra)}</b><i>+Extras</i></span>
              <span><b style={{color:'var(--accent)'}}>{fmtHours(juego.hltbComplete)}</b><i>100%</i></span>
            </div>
          </div>
        )}
        {juego.ventasTotal > 0 && (
          <div className="gt-row"><TrendingUp size={11}/><span><b>{fmtUnits(juego.ventasTotal)}</b> vendidos en el mundo</span></div>
        )}
        {juego.valoracion && (
          <div className="gt-row"><Star size={11} style={{color:'var(--gold)'}}/>
            <span>Mi valoración: <b style={{color:'var(--gold)'}}>{juego.valoracion}/10</b></span></div>
        )}
        {juego.comentarios && <p style={{fontSize:10,color:'var(--text-3)',marginTop:6,fontStyle:'italic',lineHeight:1.4}}>{juego.comentarios.slice(0,80)}{juego.comentarios.length>80?'…':''}</p>}
        <p className="gt-hint"><MousePointerClick size={10}/> Clic para ver y editar</p>
      </div>
    </div>
  );
}

// ─── Timeline view ────────────────────────────────────────────────────────────
function Timeline({ plat, axis, onAxisChange, onBack, onOpen, activeId, panelOpen }) {
  const [tooltip, setTooltip] = useState({ visible:false, juego:null, x:0, y:0 });
  const imgs = typeof plat.imagenes==='string'?JSON.parse(plat.imagenes||'[]'):(plat.imagenes||[]);
  

  const sorted = [...plat.juegos].sort((a,b) => {
    const va = a[axis]||'', vb = b[axis]||'';
    if (axis==='precio') return (Number(va)||0)-(Number(vb)||0);
    return String(va).localeCompare(String(vb),'es');
  });

  const getLabel = j => {
    if (axis==='fechaLanzamiento') return j.fechaLanzamiento||'Sin fecha';
    if (axis==='fechaAdquisicion') return j.fechaAdquisicion||'Sin fecha';
    if (axis==='precio') return j.precio?`${Number(j.precio).toFixed(2)} €`:'Sin precio';
    if (axis==='nombre') return j.nombre[0]?.toUpperCase()||'';
    return '';
  };

  const showTooltip = (e, j) => setTooltip({ visible:true, juego:j, x:e.clientX, y:e.clientY });
  const moveTooltip = (e)    => setTooltip(t => ({...t, x:e.clientX, y:e.clientY}));
  const hideTooltip = ()     => setTooltip(t => ({...t, visible:false}));

  return (
    <div className="page" style={{ paddingRight: panelOpen ? 416 : undefined, transition:'padding-right 0.3s' }}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}><ArrowLeft size={15}/> Volver</button>
        <div style={{flex:1}}>
          <h1 className="page-title">{plat.nombre}</h1>
          <p className="page-sub">{sorted.length} juegos · pasa el ratón para ver detalles, haz clic para editar</p>
        </div>
        {imgs[0] && <img src={imgSrc(imgs[0])} alt={plat.nombre}
          style={{width:80,height:56,objectFit:'cover',borderRadius:'var(--r-lg)',border:'1px solid var(--border)'}}/>}
      </div>

      {/* Axis selector */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:28,flexWrap:'wrap'}}>
        <SortAsc size={15} style={{color:'var(--text-2)'}}/>
        <span style={{fontSize:12,color:'var(--text-2)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em'}}>Ordenar por</span>
        {TIMELINE_AXES.map(ax => (
          <button key={ax.id} onClick={() => onAxisChange(ax.id)} style={{
            padding:'5px 14px',borderRadius:20,fontSize:12,fontWeight:500,cursor:'pointer',transition:'all .15s',
            background:axis===ax.id?'var(--accent-glow)':'var(--bg-3)',
            border:axis===ax.id?'1px solid rgba(230,57,70,.4)':'1px solid var(--border)',
            color:axis===ax.id?'var(--accent)':'var(--text-2)',
          }}>{ax.label}</button>
        ))}
      </div>

      {/* Timeline */}
      <div className="timeline">
        <div className="timeline-line"/>
        {sorted.map((j, i) => {
          const jImgs = typeof j.imagenes==='string'?JSON.parse(j.imagenes||'[]'):(j.imagenes||[]);
          const label = getLabel(j);
          const side  = i%2===0?'left':'right';
          return (
            <div key={j.id} className={`tl-item tl-${side}${activeId === j.id ? ' tl-active' : ''}`}
              onMouseEnter={e => !panelOpen && showTooltip(e, j)}
              onMouseMove={e => !panelOpen && moveTooltip(e)}
              onMouseLeave={hideTooltip}
              onClick={() => { hideTooltip(); onOpen?.(j); }}
              style={{ cursor: 'pointer' }}>
              <div className="tl-card">
                {jImgs[0]
                  ? <img src={imgSrc(jImgs[0])} alt={j.nombre} className="tl-img"/>
                  : <div className="tl-no-img">🎮</div>}
                <div className="tl-info">
                  <p className="tl-name">{j.nombre}</p>
                  <p className="tl-label">{label}</p>
                  {j.genero && <p className="tl-genre">{j.genero}</p>}
                </div>
              </div>
              <div className="tl-dot"/>
              <div className="tl-axis-label">{label}</div>
            </div>
          );
        })}
      </div>

      {/* Hover tooltip — rendered at mouse position */}
      <GameTooltip {...tooltip}/>
    </div>
  );
}
