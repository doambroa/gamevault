import React, { useEffect, useState } from 'react';
import { Check, Plus, PencilLine, Loader } from 'lucide-react';
import { Modal, Btn } from '../../components/ui/index';
import { findPlatform } from '../../utils/platformMatch';
import { CONSOLAS, MARCAS_PRINCIPALES, imagenDeConsola } from '../../data/consolas';
import '../Onboarding/Onboarding.css';

/* «Nueva plataforma»: la misma rejilla de la bienvenida, con las que ya tienes marcadas.
 * Se eligen varias de golpe (con su imagen y datos por defecto) o, si no está, «Añádela a mano» abre el formulario. */
const MARCAS = ['Todas', ...MARCAS_PRINCIPALES, 'Ordenadores', 'Otras'];
const pasaFiltro = (c, f) => f === 'Todas' ? true
  : f === 'Ordenadores' ? c.tipo === 'Ordenador'
  : f === 'Otras' ? !MARCAS_PRINCIPALES.includes(c.marca) && c.tipo !== 'Ordenador'
  : c.marca === f;

function Avatar({ c }) {
  const src = imagenDeConsola(c);
  const [ok, setOk] = useState(!!src);
  return (
    <div className={'ob-consola-avatar' + (ok ? ' ob-consola-avatar-img' : '')}>
      {ok ? <img src={src} alt="" loading="lazy" onError={() => setOk(false)}/> : c.nombre.slice(0, 2).toUpperCase()}
    </div>
  );
}

export const datosConsola = c => ({
  nombre: c.nombre, marca: c.marca, modelo: '', tipo: c.tipo,
  fechaAdquisicion: '', fechaLanzamientoEuropa: c.fechaLanzamientoEuropa || '',
  fechaLanzamientoAmerica: '', fechaLanzamientoAsia: '',
  precio: '', precioSalida: c.precioSalida || '', precioAmerica: '', precioAsia: '',
  unidadesVendidas: c.unidadesVendidas || '', comentarios: '',
  imagenes: imagenDeConsola(c) ? [imagenDeConsola(c)] : [],
});

export default function NuevasConsolas({ open, onClose, tengo = [], onManual, onHecho }) {
  const [sel, setSel] = useState(new Set());
  const [filtro, setFiltro] = useState('Todas');
  const [busy, setBusy] = useState('');
  useEffect(() => { if (open) { setSel(new Set()); setFiltro('Todas'); setBusy(''); } }, [open]);
  const laTengo = c => !!findPlatform(c.nombre, tengo);
  const toggle = c => !laTengo(c) && setSel(s => { const n = new Set(s); n.has(c.nombre) ? n.delete(c.nombre) : n.add(c.nombre); return n; });
  const anadir = async () => {
    const lista = CONSOLAS.filter(c => sel.has(c.nombre) && !laTengo(c));
    let i = 0;
    for (const c of lista) {
      i++; setBusy(`Añadiendo ${i}/${lista.length}: ${c.nombre}…`);
      await window.api.plataformas.create(datosConsola(c));
    }
    onHecho?.(lista.length);
  };
  const consolas = CONSOLAS.filter(c => pasaFiltro(c, filtro));
  const nTengo = CONSOLAS.filter(laTengo).length;
  return (
    <Modal open={open} onClose={onClose} title="Añadir consolas" width={1180}>
      <div className="nc">
        <p className="nc-sub">Marca las que quieras añadir (puedes elegir varias). {nTengo > 0 && <>Las <b>{nTengo}</b> que ya tienes salen marcadas como «Ya la tienes».</>}</p>
        <div className="ob-marcas nc-marcas">
          {MARCAS.map(m => <button key={m} className={'ob-marca-btn' + (filtro === m ? ' active' : '')} onClick={() => setFiltro(m)}>{m}</button>)}
        </div>
        <div className="ob-grid nc-grid">
          {consolas.map(c => {
            const tiene = laTengo(c), s = sel.has(c.nombre);
            return (
              <div key={c.nombre} className={'ob-consola' + (s ? ' ob-consola-sel' : '') + (tiene ? ' ob-consola-tiene' : '')}
                onClick={() => toggle(c)} title={tiene ? 'Ya está en tu colección' : undefined} role="button" aria-pressed={s} aria-label={c.nombre}>
                {tiene && <div className="ob-tiene">Ya la tienes</div>}
                {s && <div className="ob-check"><Check size={16}/></div>}
                <Avatar c={c}/>
                <div className="ob-consola-info">
                  <p className="ob-consola-nombre">{c.nombre}</p>
                  <p className="ob-consola-marca">{c.marca}</p>
                  <span className={'ob-tipo ob-tipo-' + c.tipo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}>{c.tipo}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="nc-pie">
          <button className="nc-manual" onClick={onManual}><PencilLine size={15}/> ¿No es ninguna de estas? <b>Añádela a mano</b></button>
          <span style={{ flex: 1 }}/>
          {busy && <span className="nc-busy"><Loader size={13} className="spin"/> {busy}</span>}
          <Btn variant="ghost" onClick={onClose} disabled={!!busy}>Cancelar</Btn>
          <Btn onClick={anadir} disabled={!sel.size || !!busy}><Plus size={15}/> {sel.size ? `Añadir ${sel.size} consola${sel.size !== 1 ? 's' : ''}` : 'Elige alguna'}</Btn>
        </div>
      </div>
    </Modal>
  );
}
