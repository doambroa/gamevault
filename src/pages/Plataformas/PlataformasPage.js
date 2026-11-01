import React, { useState, useEffect, useCallback } from 'react';
import { imgSrc } from '../../utils/imgSrc';
import { Plus, Monitor, Edit2, Trash2, ChevronRight, Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Btn, Badge, PageHeader, EmptyState, ConfirmModal, SkeletonList } from '../../components/ui/index';
import PlataformaForm from './PlataformaForm';

const api = window.api;
const TC = { Sobremesa:'accent', Portátil:'cyan', PC:'gold', Híbrida:'green' };
const EMPTY = {
  nombre:'', marca:'', modelo:'', tipo:'', fechaAdquisicion:'',
  fechaLanzamientoEuropa:'', fechaLanzamientoAmerica:'', fechaLanzamientoAsia:'',
  precio:'', precioSalida:'', precioAmerica:'', precioAsia:'',
  unidadesVendidas:'', comentarios:'', imagenes:[]
};

export default function PlataformasPage() {
  const nav = useNavigate();
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState(null);
  const [delId,   setDelId]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setItems(await api.plataformas.getAll());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async data => {
    if (data.id) await api.plataformas.update(data);
    else         await api.plataformas.create(data);
    setForm(null); load();
  };

  const grouped = items.reduce((acc, p) => {
    const t = p.tipo || 'Sin tipo';
    if (!acc[t]) acc[t] = [];
    acc[t].push(p); return acc;
  }, {});

  return (
    <div className="page">
      <PageHeader title="Plataformas"
        subtitle={`${items.length} consola${items.length !== 1 ? 's' : ''} · ${items.reduce((a, p) => a + (p.numJuegos || 0), 0)} juegos`}
        actions={<Btn onClick={() => setForm(EMPTY)}><Plus size={16}/> Nueva plataforma</Btn>}/>

      {loading ? <SkeletonList n={4} h={110}/> :
       items.length === 0 ? (
        <EmptyState icon={<Monitor size={52}/>} title="Sin plataformas"
          description="Añade tu primera consola."
          action={<Btn onClick={() => setForm(EMPTY)}><Plus size={16}/> Añadir</Btn>}/>
       ) : Object.entries(grouped).map(([tipo, list]) => (
        <div key={tipo} style={{ marginBottom: 28 }}>
          <p className="section-title">{tipo}</p>
          <div className="plat-grid">
            {list.map(p => {
              const imgs = typeof p.imagenes==='string' ? JSON.parse(p.imagenes||'[]') : (p.imagenes||[]);
              return (
                <div key={p.id} className="plat-card" onClick={() => nav(`/plataformas/${p.id}`)}>
                  <div className="plat-card-top">
                    <div className="plat-icon">
                      {imgs[0]
                        ? <img src={imgSrc(imgs[0])}
                            alt="" style={{ width:36, height:36, objectFit:String(imgs[0]).startsWith('./consolas/')?'contain':'cover', borderRadius:'var(--r)' }}/>
                        : <Monitor size={18}/>}
                    </div>
                    <div className="plat-actions">
                      <button className="icon-btn" onClick={e => {
                        e.stopPropagation();
                        setForm({...p, imagenes: typeof p.imagenes==='string' ? JSON.parse(p.imagenes||'[]') : (p.imagenes||[])});
                      }}><Edit2 size={13}/></button>
                      <button className="icon-btn icon-btn-danger" onClick={e => {
                        e.stopPropagation(); setDelId(p.id);
                      }}><Trash2 size={13}/></button>
                    </div>
                  </div>
                  <p className="plat-name">{p.nombre}</p>
                  <p className="plat-marca">{p.marca}{p.modelo ? ` · ${p.modelo}` : ''}</p>
                  <p className="plat-juegos" title={p.unidadesJuegos > p.numJuegos ? `${p.unidadesJuegos} unidades contando duplicados` : undefined}>
                    <Gamepad2 size={12}/>
                    <strong>{p.numJuegos || 0}</strong> juego{p.numJuegos === 1 ? '' : 's'}
                    {p.unidadesJuegos > p.numJuegos && <span style={{ color:'var(--text-3)' }}> · {p.unidadesJuegos} uds.</span>}
                    {(p.unidades || 1) > 1 && <span className="plat-uds">×{p.unidades} consolas</span>}
                  </p>
                  <div className="plat-footer">
                    <Badge color={TC[p.tipo]||'default'}>{p.tipo||'—'}</Badge>
                    {p.precio && <span style={{ fontSize:12, color:'var(--gold)', fontFamily:'var(--font-m)' }}>{Number(p.precio).toFixed(2)} €</span>}
                  </div>
                  <ChevronRight size={15} className="plat-arrow"/>
                </div>
              );
            })}
          </div>
        </div>
       ))
      }

      <PlataformaForm open={!!form} initial={form} onClose={() => setForm(null)} onSave={save}/>
      <ConfirmModal open={!!delId} onClose={() => setDelId(null)}
        onConfirm={async () => { await api.plataformas.delete(delId); setDelId(null); load(); }}
        title="Eliminar plataforma" message="¿Eliminar esta consola y todos sus juegos?"/>
    </div>
  );
}

