import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Gamepad, HardDrive, Cable, Sparkles, Briefcase, Puzzle, Package } from 'lucide-react';
import { Btn, Badge, Input, Select, Textarea, Modal, ConfirmModal } from '../../components/ui/index';

/* Accesorios de una consola (mandos, memorias, periféricos, cables…), en el detalle de la consola */
const api = window.api;
export const TIPOS = ['Mando', 'Periférico', 'Memoria', 'Cable / alimentación', 'Limpieza', 'Funda / estuche', 'Otro'];
const ESTADOS = ['Nuevo', 'Usado', 'Dañado'];
const EC = { Nuevo: 'green', Usado: 'gold', Dañado: 'accent' };
const ICONO = { 'Mando': Gamepad, 'Periférico': Puzzle, 'Memoria': HardDrive, 'Cable / alimentación': Cable,
  'Limpieza': Sparkles, 'Funda / estuche': Briefcase };
const VACIO = { nombre: '', tipo: '', unidades: 1, precio: '', estado: '', fechaAdquisicion: '', comentarios: '' };

function AccesorioForm({ open, initial, onClose, onSave }) {
  const [f, setF] = useState(VACIO);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setF(initial ? { ...VACIO, ...initial, precio: initial.precio ?? '', comentarios: initial.comentarios || '' } : VACIO); setErr(''); } }, [open, initial]);
  const s = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const guardar = async e => {
    e.preventDefault();
    if (!f.nombre.trim()) { setErr('Ponle un nombre'); return; }
    try { await onSave({ ...f, nombre: f.nombre.trim() }); } catch (x) { setErr(x.message); }
  };
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar accesorio' : 'Nuevo accesorio'} width={520}>
      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Nombre *" value={f.nombre} onChange={s('nombre')} autoFocus placeholder="Mando oficial, Memory Card 8 MB, Disco de limpieza…" error={err}/>
        <div className="grid-3">
          <Select label="Tipo" value={f.tipo || ''} onChange={s('tipo')}>
            <option value="">--</option>{TIPOS.map(t => <option key={t}>{t}</option>)}
          </Select>
          <Select label="Estado" value={f.estado || ''} onChange={s('estado')}>
            <option value="">--</option>{ESTADOS.map(t => <option key={t}>{t}</option>)}
          </Select>
          <Input label="Unidades" type="number" min="1" step="1" value={f.unidades} onChange={s('unidades')}/>
        </div>
        <div className="grid-2">
          <Input label="Precio (€)" type="number" step="0.01" value={f.precio} onChange={s('precio')} placeholder="0.00"/>
          <Input label="Fecha adquisición" type="date" value={f.fechaAdquisicion || ''} onChange={s('fechaAdquisicion')}/>
        </div>
        <Textarea label="Comentarios" value={f.comentarios} onChange={s('comentarios')} rows={2} placeholder="Con caja, color, edición…"/>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn type="button" variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn type="submit">{initial ? 'Guardar' : 'Añadir'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

export default function Accesorios({ plataformaId }) {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(null);      // null cerrado · {} nuevo · {…} editar
  const [borrar, setBorrar] = useState(null);
  const load = useCallback(() => { api?.accesorios?.getByPlataforma(plataformaId).then(setLista); }, [plataformaId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!api?.onChanged) return;
    let t; const off = api.onChanged(() => { clearTimeout(t); t = setTimeout(load, 400); });
    return () => { clearTimeout(t); off(); };
  }, [load]);

  const guardar = async d => {
    if (form?.id) await api.accesorios.update({ ...d, id: form.id });
    else await api.accesorios.create({ ...d, plataformaId });
    setForm(null); load();
  };
  const unidades = lista.reduce((a, x) => a + (x.unidades || 1), 0);

  return (
    <section className="acc-section" aria-label="Accesorios">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <p className="section-title" style={{ margin: 0 }}>
          Accesorios ({lista.length}{unidades > lista.length ? ` · ${unidades} unidades` : ''})
        </p>
        <Btn size="sm" variant="ghost" onClick={() => setForm({})}><Plus size={14}/> Añadir accesorio</Btn>
      </div>
      {lista.length === 0 ? (
        <p className="acc-vacio">Sin accesorios. Aquí van mandos, memorias, periféricos, cables o discos de limpieza.</p>
      ) : (
        <div className="acc-grid">
          {lista.map(a => {
            const Ico = ICONO[a.tipo] || Package;
            return (
              <div key={a.id} className="acc-card" onClick={() => setForm(a)} title="Editar">
                <div className="acc-ico"><Ico size={18}/></div>
                <div className="acc-info">
                  <div className="acc-nombre">{a.nombre}{(a.unidades || 1) > 1 && <span className="acc-uds">×{a.unidades}</span>}</div>
                  <div className="acc-meta">
                    {a.tipo && <span>{a.tipo}</span>}
                    {a.estado && <Badge color={EC[a.estado] || 'default'}>{a.estado}</Badge>}
                    {a.precio ? <span className="td-gold">{Number(a.precio).toFixed(2)} €</span> : null}
                  </div>
                  {a.comentarios && <div className="acc-com" title={a.comentarios}>{a.comentarios}</div>}
                </div>
                <div className="acc-acciones" onClick={e => e.stopPropagation()}>
                  <button className="icon-btn" aria-label="Editar accesorio" onClick={() => setForm(a)}><Edit2 size={13}/></button>
                  <button className="icon-btn icon-btn-danger" aria-label="Eliminar accesorio" onClick={() => setBorrar(a)}><Trash2 size={13}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <AccesorioForm open={!!form} initial={form?.id ? form : null} onClose={() => setForm(null)} onSave={guardar}/>
      <ConfirmModal open={!!borrar} onClose={() => setBorrar(null)}
        onConfirm={async () => { await api.accesorios.delete(borrar.id); setBorrar(null); load(); }}
        title="Eliminar accesorio" message={borrar ? `¿Eliminar «${borrar.nombre}»?` : ''}/>
    </section>
  );
}
