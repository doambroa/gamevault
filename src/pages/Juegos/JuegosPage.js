import React, { useState, useEffect, useCallback, useRef } from 'react';
import { imgSrc, parseImgs } from '../../utils/imgSrc';
import { Plus, Gamepad2, Search, Edit2, Trash2, Download, Loader, Check, BookOpen, Upload, Clock, Layers, List } from 'lucide-react';
import { Btn, Badge, PageHeader, EmptyState, ConfirmModal, Input, Select, SkeletonList } from '../../components/ui/index';
import JuegoForm  from './JuegoForm';
import JuegoPanel from './JuegoPanel';
import ImportModal from '../Ajustes/ImportModal';
import './JuegoPanel.css';
import { useSort, SortTh } from '../../utils/useSort';
import { searchGames } from '../../utils/rawg';
import { useLocation, useNavigate } from 'react-router-dom';
import { DuracionTh, DuracionCell } from '../../components/Duracion';
import ImportDuracionesModal from './ImportDuracionesModal';

const VISTA_KEY = 'gv_juegos_vista';
const loadVista = () => { try { return localStorage.getItem(VISTA_KEY) === 'todos' ? 'todos' : 'plataforma'; } catch { return 'plataforma'; } };

const api = window.api;
const GENEROS  = ['Acción','Aventura','RPG','Deportes','Carreras','Plataformas','Shooter','Estrategia','Simulación','Lucha','Puzzle','Terror','MMORPG','Indie','Música','Otro'];
const ESTADOS  = ['Nuevo','Usado','Digital','Dañado'];
const REGIONES = ['PAL','NTSC','NTSC-J','Universal'];
const EC = { Nuevo:'green', Usado:'gold', Digital:'cyan', Dañado:'accent' };

// Truncate comment to first N chars
const truncate = (txt, n=40) => {
  if (!txt) return null;
  return txt.length > n ? txt.slice(0, n).trimEnd() + '…' : txt;
};

export default function JuegosPage() {
  const [juegos,   setJuegos]   = useState([]);
  const [plats,    setPlats]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delId,    setDelId]    = useState(null);
  // Panel
  const [panelJuego, setPanelJuego] = useState(null);
  const [panelPlat,  setPanelPlat]  = useState(null);
  const [panelOpen,  setPanelOpen]  = useState(false);
  // Bulk cover import
  const [importing, setImporting]   = useState(false);
  const [importProgress, setImportProgress] = useState(null); // {done, total, current}
  const [importDone, setImportDone] = useState(false);
  const importRef = useRef(false);
  // Collection import modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  // URL params (e.g. ?prestados=1)
  const location = useLocation();
  const navigate = useNavigate();
  // Filters
  const [filters, setFilters] = useState(() => {
    const params = new URLSearchParams(location.search);
    return {
      busqueda:'', plataformaId:'', genero: params.get('genero') || '', estado:'', region:'', anio:'', desarrolladora:'',
      prestado: params.get('prestados') === '1' ? '1' : ''
    };
  });

  const { sorted, sortKey, sortDir, toggle, setSort } = useSort(juegos, 'nombre');
  const thP = { sortKey, sortDir, onToggle: toggle };
  // Vista: agrupada por plataforma o todos los juegos en una sola tabla (se recuerda)
  const [vista, setVistaState] = useState(loadVista);
  const setVista = v => { setVistaState(v); try { localStorage.setItem(VISTA_KEY, v); } catch {} };
  const [durModal, setDurModal] = useState(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const active = Object.fromEntries(Object.entries(filters).filter(([,v]) => v !== ''));
    const [j, p] = await Promise.all([api.juegos.getAll(active), api.plataformas.getAll()]);
    setJuegos(j); setPlats(p);
    setPanelJuego(cur => (cur ? j.find(x => x.id === cur.id) || cur : cur));
    setLoading(false);
  }, [filters]);

  useEffect(() => { if (api) load(); else setLoading(false); }, [load]);
  // Datos de HLTB/ventas que llegan en segundo plano → refrescar la tabla sin parpadeo
  useEffect(() => {
    if (!api?.onChanged) return;
    let t; const off = api.onChanged(() => { clearTimeout(t); t = setTimeout(() => load({ silent: true }), 500); });
    return () => { clearTimeout(t); off(); };
  }, [load]);

  const sf = k => e => setFilters(f => ({...f, [k]: e.target.value}));
  const clear = () => {
    setFilters({ busqueda:'', plataformaId:'', genero:'', estado:'', region:'', anio:'', desarrolladora:'', prestado:'' });
    // Limpiar URL si venía con ?prestados=1
    if (location.search) navigate('/juegos', { replace: true });
  };
  const hasF  = Object.values(filters).some(Boolean);

  const save = async data => {
    if (editItem) await api.juegos.update({ id: editItem.id, ...data });
    else          await api.juegos.create(data);
    setShowForm(false); setEditItem(null); load();
  };

  const openPanel = (juego) => {
    const plat = plats.find(p => p.id === juego.plataformaId);
    setPanelJuego(juego); setPanelPlat(plat||null); setPanelOpen(true);
  };

  const handleFilterBy = (field, value) => {
    if (!value) return;
    const map = { anio:'anio', genero:'genero', region:'region', estado:'estado', desarrolladora:'desarrolladora' };
    if (map[field]) setFilters(f => ({...f, [map[field]]: value}));
    setPanelOpen(false);
  };

  const cellFilter = (field, value) => { if (value) handleFilterBy(field, value); };

  // ── Bulk cover import ──────────────────────────────────────────────────────
  const [importMode, setImportMode] = useState(null); // null | 'choose' | 'running'

  const startBulkImport = async (onlyMissing) => {
    setImportMode('running');
    setImporting(true); setImportDone(false); importRef.current = true;
    // Si onlyMissing=true usamos needsCovers (solo sin imagen); si false todos los juegos
    let needs;
    if (onlyMissing) {
      needs = await api.juegos.needsCovers();
    } else {
      const all = await api.juegos.getAll({});
      needs = all.map(j => ({ id: j.id, nombre: j.nombre, plataformaId: j.plataformaId }));
    }
    setImportProgress({ done:0, total: needs.length, current:'' });
    let done = 0;
    for (const j of needs) {
      if (!importRef.current) break;
      setImportProgress({ done, total: needs.length, current: j.nombre });
      try {
        const results = await searchGames(j.nombre, 1);
        if (results[0]?.background_image) {
          await api.juegos.updateCovers({ id: j.id, imagenes: [results[0].background_image] });
        }
      } catch { /* skip on error */ }
      done++;
      await new Promise(r => setTimeout(r, 300));
    }
    importRef.current = false;
    setImporting(false); setImportProgress(null); setImportDone(true); setImportMode(null);
    setTimeout(() => setImportDone(false), 4000);
    load();
  };

  const bulkImportCovers = async () => {
    // Comprobar si hay juegos con carátula
    const needs = await api.juegos.needsCovers();
    const total = juegos.length;
    const missing = needs.length;
    if (missing === total || missing === 0) {
      // Todos sin carátula o todos con carátula → un solo modo
      await startBulkImport(missing > 0);
    } else {
      // Hay mezcla → preguntar
      setImportMode('choose');
    }
  };

  const grouped = sorted.reduce((acc, j) => {
    const k = j.plataformaNombre || 'Sin plataforma';
    if (!acc[k]) acc[k] = [];
    acc[k].push(j); return acc;
  }, {});

  // Active filter pills
  const activePills = [
    filters.genero       && { label:`Género: ${filters.genero}`,         color:'accent' },
    filters.region       && { label:`Región: ${filters.region}`,         color:'cyan' },
    filters.estado       && { label:`Estado: ${filters.estado}`,         color:'gold' },
    filters.anio         && { label:`Año: ${filters.anio}`,              color:'green' },
    filters.desarrolladora && { label:`Dev: ${filters.desarrolladora}`,  color:'cyan' },
    filters.plataformaId && { label:`Plataforma filtrada`,               color:'default' },
    filters.prestado     && { label:'Solo prestados',                    color:'gold' },
  ].filter(Boolean);

  return (
    <div className="page" style={{ paddingRight: panelOpen ? 416 : 32, transition:'padding-right 0.3s' }}>
      <PageHeader
        title="Juegos"
        subtitle={`${juegos.length} juego${juegos.length!==1?'s':''}${vista==='plataforma' ? ` en ${Object.keys(grouped).length} plataforma${Object.keys(grouped).length!==1?'s':''}` : ''}`}
        actions={
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {/* Import collection button */}
            <Btn variant="secondary" size="sm" onClick={() => setImportModalOpen(true)}
              title="Importar colección desde CSV, Excel, TXT o JSON">
              <Upload size={14}/> Importar colección
            </Btn>
            {/* Bulk cover import button */}
            <Btn variant="secondary" size="sm" onClick={bulkImportCovers}
              disabled={importing} title="Busca en RAWG las carátulas de todos los juegos que no tienen imagen">
              {importing
                ? <><Loader size={14} className="spin"/> Importando…</>
                : importDone
                ? <><Check size={14}/> Listo</>
                : <><Download size={14}/> Importar carátulas</>}
            </Btn>
            <Btn variant="secondary" size="sm" onClick={() => setDurModal(true)}
              title="Consulta en HowLongToBeat la duración de todos los juegos">
              <Clock size={14}/> Importar duraciones
            </Btn>
            <Btn onClick={() => { setEditItem(null); setShowForm(true); }}>
              <Plus size={16}/> Nuevo juego
            </Btn>
          </div>
        }
      />

      {/* Import progress bar */}
      {importing && importProgress && (
        <div style={{ marginBottom:16, background:'var(--bg-2)', border:'1px solid var(--border)',
          borderRadius:'var(--r-lg)', padding:'12px 16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:12, color:'var(--text-1)', fontWeight:500 }}>
              Buscando carátula: <em style={{color:'var(--cyan)'}}>{importProgress.current}</em>
            </span>
            <span style={{ fontSize:12, color:'var(--text-2)', fontFamily:'var(--font-m)' }}>
              {importProgress.done}/{importProgress.total}
            </span>
          </div>
          <div style={{ height:4, background:'var(--bg-4)', borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:2,
              background:'linear-gradient(90deg,var(--accent),var(--gold))',
              width:`${(importProgress.done/importProgress.total)*100}%`,
              transition:'width .3s' }}/>
          </div>
          <button style={{ marginTop:8, fontSize:11, color:'var(--text-3)', background:'none',
            border:'none', cursor:'pointer' }}
            onClick={() => { importRef.current=false; }}>
            Cancelar
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <div className="field" style={{flex:'1 1 160px'}}>
          <label className="field-label">Buscar</label>
          <div className="search-wrap">
            <Search size={14} className="search-icon"/>
            <input className="field-input search-input" placeholder="Nombre…"
              value={filters.busqueda} onChange={sf('busqueda')}/>
          </div>
        </div>
        <Select label="Plataforma" value={filters.plataformaId} onChange={sf('plataformaId')} style={{minWidth:130}}>
          <option value="">Todas</option>
          {plats.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Select>
        <Select label="Género" value={filters.genero} onChange={sf('genero')} style={{minWidth:110}}>
          <option value="">Todos</option>
          {GENEROS.map(g => <option key={g}>{g}</option>)}
        </Select>
        <Select label="Estado" value={filters.estado} onChange={sf('estado')} style={{minWidth:100}}>
          <option value="">Todos</option>
          {ESTADOS.map(e => <option key={e}>{e}</option>)}
        </Select>
        <Select label="Región" value={filters.region} onChange={sf('region')} style={{minWidth:90}}>
          <option value="">Todas</option>
          {REGIONES.map(r => <option key={r}>{r}</option>)}
        </Select>
        <Input label="Año" type="number" value={filters.anio} onChange={sf('anio')}
          placeholder="1998" style={{width:80}}/>
        <div className="field" style={{justifyContent:'center'}}>
          <label className="field-label">&nbsp;</label>
          <label style={{display:'inline-flex',alignItems:'center',gap:7,cursor:'pointer',
            padding:'6px 12px',borderRadius:'var(--r)',
            background: filters.prestado ? 'rgba(250,204,21,.12)' : 'var(--bg-3)',
            border: filters.prestado ? '1px solid rgba(250,204,21,.4)' : '1px solid var(--border)',
            color: filters.prestado ? 'var(--gold)' : 'var(--text-2)',
            fontSize:12,fontWeight:500,userSelect:'none',transition:'all .15s',whiteSpace:'nowrap'}}>
            <input type="checkbox" checked={!!filters.prestado}
              onChange={e => setFilters(f=>({...f,prestado:e.target.checked?'1':''}))}
              style={{accentColor:'var(--gold)',width:13,height:13}}/>
            Solo prestados
          </label>
        </div>
        {hasF && (
          <div className="field" style={{justifyContent:'flex-end'}}>
            <label className="field-label">&nbsp;</label>
            <button onClick={clear} style={{
              display:'inline-flex', alignItems:'center', gap:5,
              padding:'6px 12px', borderRadius:'var(--r)',
              background:'var(--bg-3)', border:'1px solid var(--border)',
              color:'var(--text-1)', fontSize:12, fontWeight:500, cursor:'pointer',
              whiteSpace:'nowrap', transition:'background .15s',
            }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-4)'}
            onMouseLeave={e=>e.currentTarget.style.background='var(--bg-3)'}>
              ✕ Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Vista: por plataforma | todos */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <div className="seg" role="group" aria-label="Vista del listado">
          <button className={'seg-btn' + (vista === 'plataforma' ? ' active' : '')} onClick={() => setVista('plataforma')}>
            <Layers size={13}/> Por plataforma
          </button>
          <button className={'seg-btn' + (vista === 'todos' ? ' active' : '')} onClick={() => setVista('todos')}>
            <List size={13}/> Todos
          </button>
        </div>
      </div>

      {/* Active filter pills */}
      {activePills.length > 0 && (
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
          {activePills.map((p,i) => (
            <span key={i} className={`badge badge-${p.color}`}>{p.label}</span>
          ))}
        </div>
      )}

      {loading ? <SkeletonList n={5}/> :
       juegos.length === 0 ? (
        <EmptyState icon={<Gamepad2 size={52}/>}
          title={hasF ? 'Sin resultados' : 'Sin juegos aún'}
          description={hasF ? 'Prueba otros filtros. Pulsa en cualquier valor de la tabla para filtrar.' : 'Añade tu primer juego.'}
          action={!hasF && <Btn onClick={() => setShowForm(true)}><Plus size={16}/> Añadir</Btn>}/>
      ) : (
        (vista === 'todos' ? [['__todos__', sorted]] : Object.entries(grouped)).map(([plat, items]) => (
          <div key={plat} style={{marginBottom:28}}>
            {vista !== 'todos' && (
              <p className="section-title">
                {plat} <span style={{color:'var(--text-3)',fontWeight:400}}>({items.length})</span>
              </p>
            )}
            <div className="table-wrap">
              <table className="table">
                <thead><tr>
                  <th style={{width:64}}></th>
                  <SortTh label="Nombre"        field="nombre"           {...thP}/>
                  {vista === 'todos' && <SortTh label="Plataforma" field="plataformaNombre" {...thP}/>}
                  <SortTh label="Género"         field="genero"           {...thP}/>
                  <SortTh label="Desarrolladora" field="desarrolladora"   {...thP}/>
                  <SortTh label="Estado"         field="estado"           {...thP}/>
                  <SortTh label="Región"         field="region"           {...thP}/>
                  <SortTh label="Lanzamiento"    field="fechaLanzamiento" {...thP}/>
                  <SortTh label="Adquisición"    field="fechaAdquisicion" {...thP}/>
                  <SortTh label="Precio"         field="precio"           {...thP}/>
                  <SortTh label="Nota"           field="valoracion"       {...thP}/>
                  <DuracionTh sortKey={sortKey} sortDir={sortDir} setSort={setSort}/>
                  <SortTh label="Prestado"       field="prestadoA"        {...thP}/>
                  <SortTh label="Comentarios"    field="comentarios"      {...thP}/>
                  <th></th>
                </tr></thead>
                <tbody>
                  {items.map(j => {
                    const imgs = parseImgs(j.imagenes);
                    const isActive = panelOpen && panelJuego?.id === j.id;
                    const comentarioCorto = truncate(j.comentarios, 38);
                    return (
                      <tr key={j.id}
                        style={{background: isActive?'var(--bg-2)':undefined, cursor:'pointer'}}
                        onClick={() => openPanel(j)}>
                        {/* Miniatura */}
                        <td style={{padding:'4px 6px 4px 12px'}}>
                          {imgs[0]
                            ? <img src={imgSrc(imgs[0])}
                                alt="" style={{width:52,height:38,objectFit:'cover',borderRadius:5,border:'1px solid var(--border)',display:'block'}}/>
                            : <div style={{width:52,height:38,background:'var(--bg-3)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-3)',fontSize:18}}>🎮</div>}
                        </td>
                        <td className="td-name">{j.nombre}</td>
                        {vista === 'todos' && (
                          <td className="td-clickable" style={{whiteSpace:'nowrap'}}
                            onClick={e=>{e.stopPropagation(); setFilters(f => ({...f, plataformaId: String(j.plataformaId)}));}}
                            title="Filtrar por esta plataforma">
                            {j.plataformaNombre||'—'}
                          </td>
                        )}
                        {/* Clickable: genre */}
                        <td className="td-clickable"
                          onClick={e=>{e.stopPropagation();cellFilter('genero',j.genero);}}>
                          {j.genero||'—'}
                        </td>
                        {/* Clickable: developer */}
                        <td className="td-clickable"
                          onClick={e=>{e.stopPropagation();cellFilter('desarrolladora',j.desarrolladora);}}>
                          {j.desarrolladora||'—'}
                        </td>
                        <td className="td-clickable"
                          onClick={e=>{e.stopPropagation();cellFilter('estado',j.estado);}}>
                          {j.estado?<Badge color={EC[j.estado]||'default'}>{j.estado}</Badge>:'—'}
                        </td>
                        <td className="td-clickable"
                          onClick={e=>{e.stopPropagation();cellFilter('region',j.region);}}>
                          {j.region||'—'}
                        </td>
                        <td className="td-clickable td-mono"
                          onClick={e=>{e.stopPropagation();cellFilter('anio',j.fechaLanzamiento?.slice(0,4));}}>
                          {j.fechaLanzamiento||'—'}
                        </td>
                        <td className="td-mono">{j.fechaAdquisicion||'—'}</td>
                        <td className="td-gold">{j.precio?`${Number(j.precio).toFixed(2)} €`:'—'}</td>
                        {/* Valoración */}
                        <td style={{fontFamily:'var(--font-m)',fontSize:12,whiteSpace:'nowrap'}}>
                          {j.valoracion
                            ? <span style={{color:'var(--gold)',fontWeight:600}}>{j.valoracion}<span style={{color:'var(--text-3)',fontWeight:400}}>/10</span></span>
                            : <span style={{color:'var(--text-3)'}}>—</span>}
                        </td>
                        {/* Duración HLTB */}
                        <td style={{fontFamily:'var(--font-m)',fontSize:11,whiteSpace:'nowrap'}}
                          title="Historia / Historia+Extras / Completista">
                          <DuracionCell juego={j} sortKey={sortKey}/>
                        </td>
                        {/* Prestado */}
                        <td style={{fontSize:12,whiteSpace:'nowrap'}}>
                          {j.prestadoA
                            ? <span style={{display:'inline-flex',alignItems:'center',gap:4,
                                color:'var(--gold)',fontWeight:500}}>
                                <BookOpen size={11}/>{j.prestadoA}
                              </span>
                            : <span style={{color:'var(--text-3)'}}>—</span>}
                        </td>
                        {/* Truncated comment */}
                        <td style={{maxWidth:160}}>
                          {comentarioCorto
                            ? <span style={{fontSize:11,color:'var(--text-3)',fontStyle:'italic'}}
                                title={j.comentarios}>{comentarioCorto}</span>
                            : <span style={{color:'var(--text-3)'}}>—</span>}
                        </td>
                        <td onClick={e=>e.stopPropagation()}>
                          <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>
                            <button className="icon-btn" onClick={()=>{setEditItem(j);setShowForm(true);}}>
                              <Edit2 size={13}/>
                            </button>
                            <button className="icon-btn icon-btn-danger" onClick={()=>setDelId(j.id)}>
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
          </div>
        ))
      )}

      {/* Modal elección modo importación carátulas */}
      {importMode === 'choose' && (
        <div className="modal-overlay" onClick={() => setImportMode(null)}>
          <div className="modal-box" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Importar carátulas</h2>
              <button className="modal-close" onClick={() => setImportMode(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{color:'var(--text-1)',marginBottom:20,lineHeight:1.6}}>
                Algunos juegos ya tienen carátulas. ¿Qué quieres hacer?
              </p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <Btn onClick={() => startBulkImport(true)}>
                  <Download size={14}/> Solo los que faltan
                </Btn>
                <Btn variant="secondary" onClick={() => startBulkImport(false)}>
                  <Download size={14}/> Buscar para todos (sobreescribe)
                </Btn>
                <Btn variant="ghost" onClick={() => setImportMode(null)}>Cancelar</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      <JuegoPanel juego={panelJuego} plataforma={panelPlat} open={panelOpen}
        onClose={()=>setPanelOpen(false)}
        onEdit={()=>{setEditItem(panelJuego);setShowForm(true);setPanelOpen(false);}}
        onFilterBy={handleFilterBy}
        onRefresh={() => load({ silent: true })}/>

      <JuegoForm open={showForm} initial={editItem} plataformas={plats}
        onClose={()=>{setShowForm(false);setEditItem(null);}} onSave={save}/>
      <ConfirmModal open={!!delId} onClose={()=>setDelId(null)}
        onConfirm={async()=>{await api.juegos.delete(delId);setDelId(null);load();}}
        title="Eliminar juego" message="¿Seguro que quieres eliminar este juego?"/>

      <ImportDuracionesModal open={durModal} onClose={() => setDurModal(false)}
        onDone={() => load({ silent: true })}/>

      <ImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onDone={() => { setImportModalOpen(false); load(); }}
        plataformas={plats}/>
    </div>
  );
}
