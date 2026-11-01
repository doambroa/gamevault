import React, { useState, useRef } from 'react';
import { Clock, Loader, Check, AlertTriangle } from 'lucide-react';
import { Modal, Btn } from '../../components/ui/index';

const api = window.api;
const PAUSA_MS = 1200;            // entre juegos, para no saturar HowLongToBeat

/**
 * Consulta en HowLongToBeat la duración de TODOS los juegos.
 * Sobrescribe los tiempos que hayan cambiado; si un juego no se encuentra, conserva lo que tuviera.
 */
export default function ImportDuracionesModal({ open, onClose, onDone }) {
  const [fase, setFase] = useState('confirm');   // confirm | running | done
  const [total, setTotal] = useState(0);
  const [prog, setProg] = useState({ done: 0, current: '' });
  const [res, setRes] = useState(null);
  const cancel = useRef(false);

  const [estimado, setEstimado] = useState(null);
  React.useEffect(() => {
    if (!open) return;
    setFase('confirm'); setRes(null); setProg({ done: 0, current: '' });
    api.juegos.getAll({}).then(j => { setTotal(j.length); setEstimado(Math.max(1, Math.round(j.length * 2.5 / 60))); });
  }, [open]);

  const start = async () => {
    cancel.current = false;
    setFase('running');
    const juegos = await api.juegos.getAll({});
    const r = { actualizados: 0, iguales: 0, noEncontrados: [], errores: 0 };
    for (let i = 0; i < juegos.length; i++) {
      if (cancel.current) break;
      const j = juegos[i];
      setProg({ done: i, current: j.nombre });
      try {
        const x = await api.juegos.hltbFetch({ id: j.id, keepOnMiss: true });
        if (x?.ok) x.changed ? r.actualizados++ : r.iguales++;
        else if (x?.notFound) r.noEncontrados.push(j.nombre);
        else { r.errores++; if (/conectar|limita/i.test(x?.error || '') && r.errores >= 3) { r.abortado = x.error; break; } }
      } catch { r.errores++; }
      await new Promise(ok => setTimeout(ok, PAUSA_MS));
    }
    r.procesados = cancel.current ? prog.done : juegos.length;
    r.cancelado = cancel.current;
    setRes(r); setFase('done'); onDone?.();
  };

  const close = () => { if (fase === 'running') { cancel.current = true; return; } onClose(); };

  return (
    <Modal open={open} onClose={close} title="Importar duraciones" width={520}>
      {fase === 'confirm' && (
        <div>
          <div style={{ display:'flex', gap:12, alignItems:'flex-start', background:'rgba(250,204,21,.08)',
            border:'1px solid rgba(250,204,21,.25)', borderRadius:'var(--r)', padding:'12px 14px', marginBottom:18 }}>
            <AlertTriangle size={18} style={{ color:'var(--gold)', flexShrink:0, marginTop:1 }}/>
            <div style={{ fontSize:13, color:'var(--text-1)', lineHeight:1.6 }}>
              Se consultará <strong>HowLongToBeat</strong> para los <strong>{total}</strong> juegos de tu colección.
              Es una operación que puede llevar un tiempo{estimado ? <> (unos <strong>{estimado} min</strong>)</> : null}:
              se hace de uno en uno para que HowLongToBeat no bloquee las consultas.
              <br/><br/>
              Se <strong>sobrescribirán todos los tiempos que hayan cambiado</strong>. Si un juego no se encuentra,
              se conservan los tiempos que ya tuviera. Puedes cancelar en cualquier momento.
            </div>
          </div>
          <div className="form-actions">
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={start} disabled={!total}><Clock size={14}/> Importar duraciones</Btn>
          </div>
        </div>
      )}

      {fase === 'running' && (
        <div style={{ textAlign:'center', padding:'24px 8px' }}>
          <Loader size={28} className="spin" style={{ color:'var(--accent)', marginBottom:12 }}/>
          <p style={{ color:'var(--text-1)', fontWeight:600, marginBottom:4 }}>Consultando HowLongToBeat…</p>
          <p style={{ color:'var(--cyan)', fontSize:13, marginBottom:16, minHeight:18 }}>{prog.current}</p>
          <div style={{ height:6, background:'var(--bg-4)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${total ? (prog.done / total) * 100 : 0}%`, transition:'width .3s',
              background:'linear-gradient(90deg,var(--accent),var(--gold))' }}/>
          </div>
          <p style={{ color:'var(--text-3)', fontSize:12, margin:'8px 0 18px' }}>{prog.done} / {total}</p>
          <Btn variant="ghost" onClick={() => { cancel.current = true; }}>Cancelar</Btn>
        </div>
      )}

      {fase === 'done' && res && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <Check size={22} style={{ color:'var(--gold)' }}/>
            <p style={{ fontWeight:700, color:'var(--text-0)' }}>
              {res.abortado ? 'Importación detenida' : res.cancelado ? 'Importación cancelada' : 'Duraciones actualizadas'}
            </p>
          </div>
          {res.abortado && <p style={{ color:'#f87171', fontSize:13, marginBottom:10 }}>{res.abortado}</p>}
          <ul style={{ fontSize:13, color:'var(--text-1)', lineHeight:1.9, paddingLeft:18, marginBottom:12 }}>
            <li><strong style={{ color:'var(--cyan)' }}>{res.actualizados}</strong> con tiempos nuevos o cambiados</li>
            <li><strong>{res.iguales}</strong> sin cambios</li>
            <li><strong>{res.noEncontrados.length}</strong> no encontrados en HowLongToBeat</li>
            {res.errores > 0 && <li><strong style={{ color:'#f87171' }}>{res.errores}</strong> con error de conexión</li>}
          </ul>
          {res.noEncontrados.length > 0 && (
            <details style={{ fontSize:12, color:'var(--text-3)', marginBottom:12 }}>
              <summary style={{ cursor:'pointer' }}>Ver los no encontrados</summary>
              <p style={{ marginTop:6, lineHeight:1.6 }}>{res.noEncontrados.join(' · ')}</p>
              <p style={{ marginTop:6 }}>Consejo: edita el juego y rellena «Título original o en inglés».</p>
            </details>
          )}
          <div className="form-actions"><Btn onClick={onClose}>Cerrar</Btn></div>
        </div>
      )}
    </Modal>
  );
}
