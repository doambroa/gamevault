import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, Upload } from 'lucide-react';
import { Modal, Btn } from './index';

/* "Borrar toda mi colección": aviso muy visible, casillas premarcadas para elegir qué borrar
 * y confirmación escribiendo BORRAR. Los juegos pertenecen a su consola, así que al borrar
 * las plataformas también se borran los juegos (la casilla queda fija). */
const PALABRA = 'BORRAR';

export default function WipeModal({ open, onClose }) {
  const [n, setN] = useState(null);
  const [sel, setSel] = useState({ plataformas: true, juegos: true, deseos: true });
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setSel({ plataformas: true, juegos: true, deseos: true }); setTxt(''); setErr(''); setN(null);
    window.api?.io.counts?.().then(setN).catch(() => setN({ plataformas: 0, juegos: 0, deseos: 0 }));
  }, [open]);

  const juegosForzados = sel.plataformas;
  const efectivo = { ...sel, juegos: sel.juegos || juegosForzados };
  const total = n ? (efectivo.plataformas ? n.plataformas : 0) + (efectivo.juegos ? n.juegos : 0) + (efectivo.deseos ? n.deseos : 0) : 0;
  const todo = efectivo.plataformas && efectivo.juegos && efectivo.deseos;
  const listo = txt.trim().toUpperCase() === PALABRA && (efectivo.plataformas || efectivo.juegos || efectivo.deseos);

  const borrar = async () => {
    setBusy(true); setErr('');
    try {
      const r = await window.api.io.wipe(efectivo);
      if (!r?.ok) throw new Error(r?.error || 'No se pudo borrar');
      window.location.hash = '#/dashboard';
      window.location.reload();
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  const Opcion = ({ k, label, count, disabled, note }) => (
    <label className={'wipe-opt' + (efectivo[k] ? ' on' : '') + (disabled ? ' locked' : '')}>
      <input type="checkbox" checked={!!efectivo[k]} disabled={disabled || busy}
        onChange={e => setSel(s => ({ ...s, [k]: e.target.checked }))}/>
      <span className="wipe-opt-label">{label}</span>
      <span className="wipe-opt-n">{count ?? '…'}</span>
      {note && <span className="wipe-opt-note">{note}</span>}
    </label>
  );

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={todo ? 'Borrar toda mi colección' : 'Borrar parte de mi colección'} width={520}>
      <div className="wipe-alert" role="alert">
        <AlertTriangle size={34}/>
        <div>
          <strong>{todo ? 'Se va a borrar TODA tu colección' : 'Se van a borrar datos de tu colección'}</strong>
          <p>Los datos marcados se eliminan <b>definitivamente</b> de la base de datos. <b>No se puede deshacer.</b></p>
        </div>
      </div>

      <div className="wipe-opts">
        <Opcion k="plataformas" label="Borrar Plataformas" count={n?.plataformas}/>
        <Opcion k="juegos" label="Borrar Juegos" count={n?.juegos} disabled={juegosForzados}
          note={juegosForzados ? 'Los juegos van con su consola: al borrar las plataformas se borran también.' : null}/>
        <Opcion k="deseos" label="Borrar lista de deseos" count={n?.deseos}/>
      </div>

      <div className="wipe-backup">
        <span>¿Quieres una copia por si acaso?</span>
        <Btn variant="ghost" size="sm" disabled={busy} onClick={() => window.api?.io.export().then(r => r?.error && setErr(r.error))}>
          <Upload size={14}/> Exportar JSON antes
        </Btn>
      </div>

      <label className="wipe-confirm">
        <span>Para confirmar, escribe <code>{PALABRA}</code></span>
        <input className="field-input" value={txt} onChange={e => setTxt(e.target.value)} disabled={busy}
          placeholder={PALABRA} autoComplete="off" spellCheck={false}/>
      </label>
      {err && <p className="wipe-err">{err}</p>}

      <div className="wipe-actions">
        <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Btn>
        <Btn variant="danger" onClick={borrar} disabled={!listo || busy}>
          <Trash2 size={15}/> {busy ? 'Borrando…' : `Borrar ${total} elemento${total !== 1 ? 's' : ''}`}
        </Btn>
      </div>
    </Modal>
  );
}
