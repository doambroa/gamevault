import React, { useState, useEffect } from 'react';
import { Monitor, Gamepad2, Heart, BookOpen, Star, TrendingUp, FileText, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Btn } from '../../components/ui/index';
import { firstImg } from '../../utils/imgSrc';

const api = window.api;

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const nav = useNavigate();

  useEffect(() => { api?.stats.get().then(setS).catch(()=>{}); }, []);

  const exportPdf = async () => {
    setExportingPdf(true);
    try {
      const r = await api?.io.exportPdf();
      if (r?.error) alert(r.error);
    } catch (e) { alert('No se pudo generar el PDF: ' + e.message); }
    finally { setExportingPdf(false); }
  };

  return (
    <div className="page">
      <PageHeader title="Dashboard" subtitle="Resumen de tu colección"
        actions={
          <Btn variant="secondary" size="sm" onClick={exportPdf} disabled={exportingPdf}
            title="Exportar catálogo completo a PDF con carátulas y plataformas">
            {exportingPdf
              ? <><Loader size={14} className="spin"/> Generando…</>
              : <><FileText size={14}/> Exportar PDF</>}
          </Btn>
        }/>

      {/* Stat cards — clickable to navigate */}
      <div className="stats-grid">
        <StatCard cls="stat-accent" icon={<Monitor size={20}/>}
          label="Plataformas" value={s?.totalPlataformas??'—'}
          onClick={() => nav('/plataformas')} hint="Ver todas"/>
        <StatCard cls="stat-cyan" icon={<Gamepad2 size={20}/>}
          label="Juegos" value={s?.totalJuegos??'—'}
          onClick={() => nav('/juegos')} hint="Ver todos"/>
        <StatCard cls="stat-gold" icon={<TrendingUp size={20}/>}
          label="Inversión total"
          value={s ? `${(Number(s.valorConsolas||0)+Number(s.valorJuegos||0)).toFixed(0)} €` : '—'}
          sub={s ? `Consolas ${Number(s.valorConsolas||0).toFixed(0)} € · Juegos ${Number(s.valorJuegos||0).toFixed(0)} €` : null}/>
        <StatCard cls="stat-accent" icon={<Heart size={20}/>}
          label="En deseos" value={s?.totalDeseos??'—'}
          onClick={() => nav('/deseos')} hint="Ver lista"/>
      </div>

      {/* Segunda fila de stats: prestados (solo si hay) + valoración media (solo si hay) */}
      {(s?.totalPrestados > 0 || s?.mediaValoracion != null) && (
        <div className="stats-grid" style={{marginTop:0}}>
          {s?.totalPrestados > 0 && (
            <StatCard cls="stat-gold" icon={<BookOpen size={20}/>}
              label="Prestados" value={s.totalPrestados}
              onClick={() => nav('/juegos?prestados=1')}
              hint="Ver prestados"/>
          )}
          {s?.mediaValoracion != null && (
            <StatCard cls="stat-cyan" icon={<Star size={20}/>}
              label="Nota media" value={`${s.mediaValoracion}/10`}/>
          )}
        </div>
      )}

      {/* Por plataforma — each row clickable */}
      {s?.porPlataforma?.length > 0 && (
        <div style={{marginBottom:28}}>
          <p className="section-title">Por plataforma</p>
          <div style={{background:'var(--bg-2)',border:'1px solid var(--border)',
            borderRadius:'var(--r-lg)',overflow:'hidden'}}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{width:44}}></th>
                  <th>Plataforma</th>
                  <th>Marca</th>
                  <th>Juegos</th>
                  <th title="Precio consola + juegos">Inversión</th>
                  <th title="Solo juegos">Juegos €</th>
                </tr>
              </thead>
              <tbody>
                {s.porPlataforma.map(p => (
                  <PlatRow key={p.id ?? p.nombre} p={p} onNav={nav}/>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Genre bars */}
      {s?.porGenero?.length > 0 && (
        <div>
          <p className="section-title">Por género</p>
          <div className="genre-bars">
            {s.porGenero.map((g,i) => (
              <div key={g.genero} className="genre-row"
                style={{cursor:'pointer'}}
                onClick={() => nav(`/juegos?genero=${encodeURIComponent(g.genero)}`)}>
                <span className="genre-label">{g.genero}</span>
                <div className="genre-bar-bg">
                  <div className="genre-bar-fill"
                    style={{width:`${(g.n/s.porGenero[0].n)*100}%`,animationDelay:`${i*40}ms`}}/>
                </div>
                <span className="genre-count">{g.n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!s && <p style={{color:'var(--text-2)'}}>Cargando…</p>}
    </div>
  );
}

// Platform row (el resumen ya trae id e imágenes: antes hacía una consulta por fila)
function PlatRow({ p, onNav }) {
  const platId = p.id;
  const cover = firstImg(p.imagenes);

  const handleClick = () => {
    if (platId) onNav(`/plataformas/${platId}`);
  };

  return (
    <tr onClick={handleClick}
      style={{cursor: platId?'pointer':undefined, transition:'background .15s'}}
      className={platId ? 'dashboard-plat-row' : ''}>
      <td style={{padding:'8px 6px 8px 12px'}}>
        {cover
          ? <img src={cover} alt={p.nombre}
              style={{width:36,height:24,objectFit:'cover',borderRadius:4,border:'1px solid var(--border)'}}/>
          : <div style={{width:36,height:24,background:'var(--bg-3)',borderRadius:4,
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Monitor size={12} style={{color:'var(--text-3)'}}/>
            </div>}
      </td>
      <td className="td-name">{p.nombre}</td>
      <td style={{color:'var(--text-2)'}}>{p.marca||'—'}</td>
      <td style={{fontFamily:'var(--font-m)',fontSize:13}}>{p.numJuegos}</td>
      <td className="td-gold">{Number(p.valorTotal??p.valor??0).toFixed(2)} €</td>
      <td style={{color:'var(--text-2)',fontFamily:'var(--font-m)',fontSize:12}}>
        {Number(p.valorJuegos??0).toFixed(2)} €
      </td>
    </tr>
  );
}

function StatCard({cls, icon, label, value, sub, onClick, hint}) {
  return (
    <div className={`stat-card ${cls}`}
      onClick={onClick}
      style={{cursor: onClick?'pointer':undefined, position:'relative'}}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div style={{fontSize:10,color:'var(--text-3)',marginTop:2,fontWeight:400}}>{sub}</div>}
      {hint && onClick && (
        <span style={{position:'absolute',bottom:10,right:12,
          fontSize:10,color:'var(--text-3)',fontWeight:500,
          opacity:0,transition:'opacity .2s'}}
          className="stat-hint">{hint} →</span>
      )}
    </div>
  );
}
