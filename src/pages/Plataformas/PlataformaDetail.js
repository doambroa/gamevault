import React, { useState, useEffect, useCallback } from 'react';
import { imgSrc, parseImgs } from '../../utils/imgSrc';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Plus, Gamepad2, Copy } from 'lucide-react';
import { Btn, Badge, ConfirmModal } from '../../components/ui/index';
import JuegoForm  from '../Juegos/JuegoForm';
import JuegoPanel from '../Juegos/JuegoPanel';
import '../Juegos/JuegoPanel.css';
import { useSort, SortTh } from '../../utils/useSort';
import PlataformaForm from './PlataformaForm';
import { DuracionTh, DuracionCell } from '../../components/Duracion';

const api = window.api;
const TC = { Sobremesa:'accent', Portátil:'cyan', PC:'gold', Híbrida:'green' };
const EC = { Nuevo:'green', Usado:'gold', Digital:'cyan', Dañado:'accent' };

const truncate = (txt, n=38) => {
  if (!txt) return null;
  return txt.length > n ? txt.slice(0, n).trimEnd() + '…' : txt;
};

export default function PlataformaDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [plat,    setPlat]    = useState(null);
  const [juegos,  setJuegos]  = useState([]);
  const [filtered,setFiltered]= useState(null); // null = no filter applied
  const [activeFilter, setActiveFilter] = useState(null); // {field, value}
  const [showJuego, setShowJuego] = useState(false);
  const [editJuego, setEditJuego] = useState(null);
  const [delJuego,  setDelJuego]  = useState(null);
  const [delPlat,   setDelPlat]   = useState(false);
  const [editPlat,  setEditPlat]  = useState(false);
  // Panel
  const [panelJuego, setPanelJuego] = useState(null);
  const [panelOpen,  setPanelOpen]  = useState(false);

  const { sorted, sortKey, sortDir, toggle, setSort } = useSort(filtered ?? juegos, 'nombre');
  const thP = { sortKey, sortDir, onToggle: toggle };

  const load = useCallback(async () => {
    const [p, j] = await Promise.all([
      api.plataformas.getById(Number(id)),
      api.juegos.getByPlataforma(Number(id)),
    ]);
    setPlat(p); setJuegos(j);
    // Mantener el panel con los datos frescos (HLTB/ventas llegan en segundo plano)
    setPanelJuego(cur => (cur ? j.find(x => x.id === cur.id) || cur : cur));
    setFiltered(f => (f ? f.map(x => j.find(y => y.id === x.id)).filter(Boolean) : f));
  }, [id]);

  useEffect(() => { if (api) { load(); setFiltered(null); setActiveFilter(null); } }, [load]);
  useEffect(() => {
    if (!api?.onChanged) return;
    let t; const off = api.onChanged(() => { clearTimeout(t); t = setTimeout(load, 400); });
    return () => { clearTimeout(t); off(); };
  }, [load]);

  const saveJuego = async data => {
    if (editJuego) await api.juegos.update({ id: editJuego.id, ...data });
    else           await api.juegos.create({ ...data, plataformaId: Number(id) });
    setShowJuego(false); setEditJuego(null); load();
  };

  // Filter within this platform's games
  const handleCellFilter = (field, value) => {
    if (!value) return;
    let result = juegos;
    if (field === 'genero')      result = juegos.filter(j => j.genero === value);
    if (field === 'estado')      result = juegos.filter(j => j.estado === value);
    if (field === 'region')      result = juegos.filter(j => j.region === value);
    if (field === 'anio')        result = juegos.filter(j => j.fechaLanzamiento?.startsWith(value));
    if (field === 'desarrolladora') result = juegos.filter(j => j.desarrolladora === value);
    setFiltered(result);
    setActiveFilter({ field, value });
    setPanelOpen(false);
  };

  const clearFilter = () => { setFiltered(null); setActiveFilter(null); };

  if (!plat) return <div className="page"><p style={{color:'var(--text-2)'}}>Cargando…</p></div>;

  const imgs = parseImgs(plat.imagenes);
  const displayJuegos = sorted;

  return (
    <div className="page" style={{ paddingRight: panelOpen ? 416 : 32, transition:'padding-right 0.3s' }}>
      {/* Back + actions */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}>
        <Btn variant="ghost" size="sm" onClick={() => nav('/plataformas')}>
          <ArrowLeft size={15}/> Volver
        </Btn>
        <div style={{flex:1}}/>
        <Btn variant="ghost" size="sm" onClick={() => setEditPlat(true)}>
          <Edit2 size={14}/> Editar consola
        </Btn>
        <Btn variant="danger" size="sm" onClick={() => setDelPlat(true)}>
          <Trash2 size={14}/> Eliminar consola
        </Btn>
      </div>

      {/* Platform header */}
      <div style={{display:'flex',gap:28,marginBottom:28,alignItems:'flex-start'}}>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:6}}>
            <h1 className="page-title">{plat.nombre}</h1>
            {plat.tipo && <Badge color={TC[plat.tipo]||'default'}>{plat.tipo}</Badge>}
          </div>
          <p style={{color:'var(--text-2)',fontSize:13}}>
            {plat.marca}{plat.modelo ? ` · ${plat.modelo}` : ''}
          </p>
          {plat.fechaLanzamientoEuropa &&
            <p style={{color:'var(--text-3)',fontSize:12,marginTop:8,fontFamily:'var(--font-m)'}}>
              EU: {plat.fechaLanzamientoEuropa}
            </p>}
          <p style={{color:'var(--text-2)',fontSize:12,marginTop:8,display:'flex',alignItems:'center',gap:6}}>
            <Copy size={12} style={{color:'var(--text-3)'}}/>
            <span>Unidades en tu colección:</span>
            <strong style={{fontFamily:'var(--font-m)',color:(plat.unidades||1)>1?'var(--cyan)':'var(--text-0)'}}>{plat.unidades || 1}</strong>
          </p>
          {plat.unidadesVendidas &&
            <p style={{color:'var(--text-3)',fontSize:12,marginTop:4,fontFamily:'var(--font-m)'}}>
              {plat.unidadesVendidas} unidades vendidas en el mundo
            </p>}
          {plat.comentarios &&
            <p style={{color:'var(--text-2)',fontSize:13,marginTop:10,lineHeight:1.6}}>
              {plat.comentarios}
            </p>}
        </div>
        {imgs[0] && (
          <img src={imgSrc(imgs[0])}
            alt={plat.nombre}
            style={{width:180,height:130,objectFit:imgs[0].startsWith('./consolas/')?'contain':'cover',background:'var(--bg-2)',borderRadius:'var(--r-lg)',
              border:'1px solid var(--border)',flexShrink:0}}/>
        )}
      </div>

      {/* Games header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <p className="section-title" style={{margin:0}}>
            Juegos ({displayJuegos.length}{activeFilter ? ` filtrados de ${juegos.length}` : ''}{(() => { const u = juegos.reduce((a, j) => a + (j.unidades || 1), 0); return u > juegos.length ? ` · ${u} unidades` : ''; })()})
          </p>
          {activeFilter && (
            <span className="badge badge-accent" style={{cursor:'pointer'}} onClick={clearFilter}>
              {activeFilter.field}: {activeFilter.value} ✕
            </span>
          )}
        </div>
        <Btn size="sm" onClick={() => { setEditJuego(null); setShowJuego(true); }}>
          <Plus size={14}/> Añadir juego
        </Btn>
      </div>

      {juegos.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px 20px',color:'var(--text-2)'}}>
          <Gamepad2 size={36} style={{marginBottom:10,color:'var(--text-3)'}}/><p>Sin juegos aún.</p>
        </div>
      ) : displayJuegos.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px 20px',color:'var(--text-2)'}}>
          <p>Sin juegos con ese filtro.</p>
          <Btn variant="ghost" size="sm" style={{marginTop:10}} onClick={clearFilter}>Quitar filtro</Btn>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th style={{width:44}}></th>
              <SortTh label="Nombre"        field="nombre"           {...thP}/>
              <SortTh label="Género"         field="genero"           {...thP}/>
              <SortTh label="Desarrolladora" field="desarrolladora"   {...thP}/>
              <SortTh label="Estado"         field="estado"           {...thP}/>
              <SortTh label="Región"         field="region"           {...thP}/>
              <SortTh label="Lanzamiento"    field="fechaLanzamiento" {...thP}/>
              <SortTh label="Precio"         field="precio"           {...thP}/>
              <DuracionTh sortKey={sortKey} sortDir={sortDir} setSort={setSort}/>
              <SortTh label="Comentarios"    field="comentarios"      {...thP}/>
              <th></th>
            </tr></thead>
            <tbody>
              {displayJuegos.map(j => {
                const jImgs = parseImgs(j.imagenes);
                const isActive = panelOpen && panelJuego?.id === j.id;
                const comentarioCorto = truncate(j.comentarios, 38);
                return (
                  <tr key={j.id}
                    style={{background:isActive?'var(--bg-2)':undefined, cursor:'pointer'}}
                    onClick={() => { setPanelJuego(j); setPanelOpen(true); }}>
                    <td style={{padding:'8px 6px 8px 12px'}}>
                      {jImgs[0]
                        ? <img src={imgSrc(jImgs[0])}
                            alt="" style={{width:36,height:24,objectFit:'cover',borderRadius:4,border:'1px solid var(--border)'}}/>
                        : <div style={{width:36,height:24,background:'var(--bg-3)',borderRadius:4}}/>}
                    </td>
                    <td className="td-name">{j.nombre}</td>
                    <td className="td-clickable"
                      onClick={e=>{e.stopPropagation();handleCellFilter('genero',j.genero);}}>
                      {j.genero||'—'}
                    </td>
                    <td className="td-clickable"
                      onClick={e=>{e.stopPropagation();handleCellFilter('desarrolladora',j.desarrolladora);}}>
                      {j.desarrolladora||'—'}
                    </td>
                    <td className="td-clickable"
                      onClick={e=>{e.stopPropagation();handleCellFilter('estado',j.estado);}}>
                      {j.estado?<Badge color={EC[j.estado]||'default'}>{j.estado}</Badge>:'—'}
                    </td>
                    <td className="td-clickable"
                      onClick={e=>{e.stopPropagation();handleCellFilter('region',j.region);}}>
                      {j.region||'—'}
                    </td>
                    <td className="td-clickable td-mono"
                      onClick={e=>{e.stopPropagation();handleCellFilter('anio',j.fechaLanzamiento?.slice(0,4));}}>
                      {j.fechaLanzamiento||'—'}
                    </td>
                    <td className="td-gold">{j.precio?`${Number(j.precio).toFixed(2)} €`:'—'}</td>
                    <td style={{fontFamily:'var(--font-m)',fontSize:11,whiteSpace:'nowrap'}}><DuracionCell juego={j} sortKey={sortKey}/></td>
                    <td style={{maxWidth:140}}>
                      {comentarioCorto
                        ? <span style={{fontSize:11,color:'var(--text-3)',fontStyle:'italic'}}
                            title={j.comentarios}>{comentarioCorto}</span>
                        : <span style={{color:'var(--text-3)'}}>—</span>}
                    </td>
                    <td onClick={e=>e.stopPropagation()}>
                      <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>
                        <button className="icon-btn" onClick={()=>{setEditJuego(j);setShowJuego(true);}}>
                          <Edit2 size={13}/>
                        </button>
                        <button className="icon-btn icon-btn-danger" onClick={()=>setDelJuego(j.id)}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sliding panel — shows plat as context */}
      <JuegoPanel
        juego={panelJuego}
        plataforma={plat}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onEdit={() => { setEditJuego(panelJuego); setShowJuego(true); setPanelOpen(false); }}
        onFilterBy={(field, value) => handleCellFilter(field, value)}
        onRefresh={load}
      />

      <JuegoForm open={showJuego} initial={editJuego} plataformas={[plat]} lockPlataforma
        plataformaId={Number(id)}
        onClose={() => { setShowJuego(false); setEditJuego(null); }} onSave={saveJuego}/>

      <ConfirmModal open={!!delJuego} onClose={() => setDelJuego(null)}
        onConfirm={async()=>{await api.juegos.delete(delJuego);setDelJuego(null);load();}}
        title="Eliminar juego" message="¿Seguro que quieres eliminar este juego?"/>
      <ConfirmModal open={delPlat} onClose={() => setDelPlat(false)}
        onConfirm={async()=>{await api.plataformas.delete(Number(id));nav('/plataformas');}}
        title="Eliminar plataforma" message="¿Eliminar esta plataforma y todos sus juegos?"/>

      <PlataformaForm
        open={editPlat}
        initial={plat ? {
          ...plat,
          imagenes: parseImgs(plat.imagenes)
        } : null}
        onClose={() => setEditPlat(false)}
        onSave={async data => {
          await api.plataformas.update(data);
          setEditPlat(false);
          load();
        }}/>
    </div>
  );
}
