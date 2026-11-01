import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Heart, Edit2, Trash2, ShoppingCart, Wand2, Image, Loader } from 'lucide-react';
import { Btn, Badge, PageHeader, EmptyState, ConfirmModal, Modal, Input, Select, Textarea, ImgThumbs, SkeletonList, CoverPicker } from '../../components/ui/index';
import { autofillJuego } from '../../utils/rawg';
import { useSort, SortTh } from '../../utils/useSort';
import { imgSrc, parseImgs } from '../../utils/imgSrc';

const api = window.api;
const GENEROS = ['Acción','Aventura','RPG','Deportes','Carreras','Plataformas','Shooter','Estrategia','Simulación','Lucha','Puzzle','Terror','MMORPG','Indie','Música','Otro'];
const PL={1:'accent',2:'gold',3:'default'};
const PN={1:'Alta',2:'Media',3:'Baja'};
const EMPTY={nombre:'',plataforma:'',genero:'',desarrolladora:'',fechaLanzamiento:'',precioEstimado:'',prioridad:'2',url:'',notas:'',imagenes:[],rawgId:null};

export default function DeseosPage() {
  const [items,  setItems]  = useState([]);
  const [plats,  setPlats]  = useState([]);
  const [loading,setLoading]= useState(true);
  const [form,   setForm]   = useState(null);
  const [delId,  setDelId]  = useState(null);
  const [moveItem,setMoveItem]=useState(null);
  const [movePlatId,setMovePlatId]=useState('');
  // Filtros acotados a deseos
  const [filtGenero,setFiltGenero]   = useState('');
  const [filtPlat,  setFiltPlat]     = useState('');

  const {sorted,sortKey,sortDir,toggle} = useSort(items,'prioridad');
  const thP={sortKey,sortDir,onToggle:toggle};

  // Items filtrados
  const filtered = sorted.filter(d => {
    if (filtGenero && d.genero !== filtGenero) return false;
    if (filtPlat   && d.plataforma !== filtPlat) return false;
    return true;
  });
  const hasFilters = filtGenero || filtPlat;
  const clearFilters = () => { setFiltGenero(''); setFiltPlat(''); };

  const load=useCallback(async()=>{
    setLoading(true);
    const [d,p]=await Promise.all([api.deseos.getAll(),api.plataformas.getAll()]);
    setItems(d); setPlats(p); setLoading(false);
  },[]);
  useEffect(()=>{ if(api) load(); else setLoading(false); },[load]);

  const save=async data=>{ if(data.id) await api.deseos.update(data); else await api.deseos.create(data); setForm(null); load(); };
  const move=async()=>{
    if(!movePlatId) return;
    await api.deseos.moveToCollection({id:moveItem.id,plataformaId:Number(movePlatId)});
    setMoveItem(null); load();
  };

  return(
    <div className="page">
      <PageHeader title="Lista de Deseos" subtitle={`${filtered.length} juego${filtered.length!==1?'s':''} en tu wishlist`}
        actions={<Btn onClick={()=>setForm(EMPTY)}><Plus size={16}/> Añadir deseo</Btn>}/>

      {/* Filtros activos */}
      {hasFilters && (
        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12,flexWrap:'wrap'}}>
          {filtGenero && <span className="badge badge-accent" style={{cursor:'pointer'}} onClick={()=>setFiltGenero('')}>Género: {filtGenero} ×</span>}
          {filtPlat   && <span className="badge badge-cyan"   style={{cursor:'pointer'}} onClick={()=>setFiltPlat('')}>Plataforma: {filtPlat} ×</span>}
          <button style={{fontSize:11,color:'var(--text-3)',background:'none',border:'none',cursor:'pointer'}} onClick={clearFilters}>Limpiar filtros</button>
        </div>
      )}

      {loading?<SkeletonList n={3} h={60}/>:items.length===0?(
        <EmptyState icon={<Heart size={52}/>} title="Lista vacía"
          description="Añade los juegos que quieres conseguir."
          action={<Btn onClick={()=>setForm(EMPTY)}><Plus size={16}/> Añadir</Btn>}/>
      ):(
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th style={{width:52}}>Cover</th>
              <SortTh label="Nombre"       field="nombre"           {...thP}/>
              <SortTh label="Plataforma"   field="plataforma"       {...thP}/>
              <SortTh label="Género"       field="genero"           {...thP}/>
              <SortTh label="Lanzamiento"  field="fechaLanzamiento" {...thP}/>
              <SortTh label="Precio est."  field="precioEstimado"   {...thP}/>
              <SortTh label="Prioridad"    field="prioridad"        {...thP}/>
              <th></th>
            </tr></thead>
            <tbody>
              {filtered.map(d=>{
                const imgs=parseImgs(d.imagenes);
                return(
                  <tr key={d.id}>
                    <td>
                      {imgs[0]
                        ?<img src={imgSrc(imgs[0])} alt="" style={{width:52,height:38,objectFit:'cover',borderRadius:4,border:'1px solid var(--border)'}}/>
                        :<div style={{width:52,height:38,background:'var(--bg-3)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-3)'}}><Heart size={12}/></div>}
                    </td>
                    <td className="td-name">{d.nombre}</td>
                    {/* Plataforma clickable */}
                    <td className="td-clickable" onClick={()=>d.plataforma&&setFiltPlat(d.plataforma)} title={d.plataforma?'Filtrar por plataforma':''}>
                      {d.plataforma||'—'}
                    </td>
                    {/* Género clickable */}
                    <td className="td-clickable" onClick={()=>d.genero&&setFiltGenero(d.genero)} title={d.genero?'Filtrar por género':''}>
                      {d.genero||'—'}
                    </td>
                    <td className="td-mono">{d.fechaLanzamiento||'—'}</td>
                    <td className="td-gold">{d.precioEstimado?`~${Number(d.precioEstimado).toFixed(2)} €`:'—'}</td>
                    <td><Badge color={PL[d.prioridad]||'default'}>{PN[d.prioridad]||'—'}</Badge></td>
                    <td><div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>
                      <button className="icon-btn" title="Mover a colección" onClick={()=>{setMoveItem(d);setMovePlatId('');}}><ShoppingCart size={13}/></button>
                      <button className="icon-btn" onClick={()=>setForm({...d,imagenes:parseImgs(d.imagenes)})}><Edit2 size={13}/></button>
                      <button className="icon-btn icon-btn-danger" onClick={()=>setDelId(d.id)}><Trash2 size={13}/></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DeseoForm open={!!form} initial={form} plataformas={plats} onClose={()=>setForm(null)} onSave={save}/>
      <ConfirmModal open={!!delId} onClose={()=>setDelId(null)}
        onConfirm={async()=>{await api.deseos.delete(delId);setDelId(null);load();}}
        title="Eliminar de la lista" message="¿Quitar este juego de la lista de deseos?"/>

      <Modal open={!!moveItem} onClose={()=>setMoveItem(null)} title="¡Lo tengo! 🎉" width={400}>
        <p style={{color:'var(--text-1)',marginBottom:16,lineHeight:1.6}}>
          ¿En qué plataforma tienes <strong style={{color:'var(--text-0)'}}>{moveItem?.nombre}</strong>?
        </p>
        <Select label="Plataforma" value={movePlatId} onChange={e=>setMovePlatId(e.target.value)}>
          <option value="">-- Selecciona --</option>
          {plats.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Select>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
          <Btn variant="ghost" onClick={()=>setMoveItem(null)}>Cancelar</Btn>
          <Btn onClick={move} disabled={!movePlatId}><ShoppingCart size={14}/> Añadir a colección</Btn>
        </div>
      </Modal>
    </div>
  );
}

function DeseoForm({open,initial,onClose,onSave,plataformas}) {
  const [f,setF]       = useState(EMPTY);
  const [err,setErr]   = useState({});
  const [saving,setSaving]= useState(false);
  const [covers,setCovers]= useState(false);
  const [filling,setFilling]=useState(false);
  const [fillMsg,setFillMsg]=useState('');

  useEffect(()=>{
    if(initial){
      const sane=Object.fromEntries(Object.entries({...EMPTY,...initial}).map(([k,v])=>[k,v===null?'':v]));
      setF({...sane,prioridad:String(initial.prioridad||2),imagenes:parseImgs(initial.imagenes)});
    }
    setErr({}); setFillMsg('');
  },[initial,open]);
  const s=k=>e=>setF(v=>({...v,[k]:e.target.value}));
  const validate=()=>{ const e={}; if(!f.nombre.trim()) e.nombre='Obligatorio'; setErr(e); return !Object.keys(e).length; };
  const submit=async()=>{ if(!validate()) return; setSaving(true); try{await onSave(f);}finally{setSaving(false);} };

  const autofill=async()=>{
    if(!f.nombre.trim()){setFillMsg('Escribe el nombre.');return;}
    setFilling(true); setFillMsg('Buscando en RAWG…');
    try{
      const d=await autofillJuego(f.nombre);
      if(!d){setFillMsg('No encontrado.');setFilling(false);return;}
      setF(v=>({...v,genero:d.genero||v.genero,desarrolladora:d.desarrolladora||v.desarrolladora,
        fechaLanzamiento:d.fechaLanzamiento||v.fechaLanzamiento,
        imagenes:d.imagenes?.length?d.imagenes:v.imagenes,
        notas:v.notas||(d._description||'').slice(0,200),
        rawgId:String(d._rawgId||''),
      }));
      setFillMsg('✅ Datos completados desde RAWG');
    }catch{setFillMsg('Error de conexión.');}
    setFilling(false);
  };

  return(
    <>
      <Modal open={open} onClose={onClose} title={f?.id?'Editar deseo':'Nuevo juego deseado'} width={700}>
        <div className="form-gap">
          <div className="rawg-bar">
            <button className="rawg-btn" onClick={autofill} disabled={filling}>
              {filling?<Loader size={14} className="spin"/>:<Wand2 size={14}/>} Autorrellenar con RAWG
            </button>
            <button className="rawg-btn" onClick={()=>setCovers(true)}><Image size={14}/> Carátulas</button>
            {fillMsg&&<span className="rawg-msg">{fillMsg}</span>}
          </div>
          <div className="grid-2">
            <Input label="Nombre *" value={f.nombre} onChange={s('nombre')} error={err.nombre} placeholder="Nombre del juego…"/>
            <Select label="Plataforma" value={f.plataforma} onChange={s('plataforma')}>
              <option value="">--</option>{plataformas.map(p=><option key={p.id} value={p.nombre}>{p.nombre}</option>)}
            </Select>
          </div>
          <div className="grid-3">
            <Select label="Género" value={f.genero} onChange={s('genero')}>
              <option value="">--</option>{GENEROS.map(g=><option key={g}>{g}</option>)}
            </Select>
            <Input label="Desarrolladora" value={f.desarrolladora} onChange={s('desarrolladora')}/>
            <Input label="Fecha lanzamiento" type="date" value={f.fechaLanzamiento} onChange={s('fechaLanzamiento')}/>
          </div>
          <div className="grid-3">
            <Input label="Precio estimado €" type="number" step="0.01" value={f.precioEstimado} onChange={s('precioEstimado')}/>
            <Select label="Prioridad" value={f.prioridad} onChange={s('prioridad')}>
              <option value="1">🔴 Alta</option><option value="2">🟡 Media</option><option value="3">🟢 Baja</option>
            </Select>
            <Input label="URL (tienda)" value={f.url} onChange={s('url')} placeholder="https://…"/>
          </div>
          <Textarea label="Notas" value={f.notas} onChange={s('notas')}/>
          <div className="field">
            <label className="field-label">Carátulas</label>
            <ImgThumbs images={f.imagenes||[]} onChange={imgs=>setF(v=>({...v,imagenes:imgs}))}/>
          </div>
          <div className="form-actions">
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={submit} disabled={saving}>{saving?'Guardando…':(f?.id?'Guardar':'Añadir a deseos')}</Btn>
          </div>
        </div>
      </Modal>
      <CoverPicker open={covers} onClose={()=>setCovers(false)} gameName={f.nombre}
        onSelect={urls=>setF(v=>({...v,imagenes:[...v.imagenes,...urls]}))}/>
    </>
  );
}
