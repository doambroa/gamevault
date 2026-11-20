import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Hand, Check, X, Clock, BellRing, Music, Award } from 'lucide-react';
import { useAccount, useNotifs, marcarLeidos, refreshNotifs, sistemaDisponible, sistemaActivado, activarSistema } from './account';
import { Avatar } from './ui';

/* Campana de avisos: te piden un juego, te contestan a una petición o te recuerdan que devuelvas algo.
 * Se consultan al servidor cada 2 minutos con la app abierta; si se activan, salen también como
 * notificación de Windows / Android / navegador. */
const ICONO = { peticion: Hand, aceptada: Check, rechazada: X, recordatorio: Clock, reto: Music, porra: Award };

export function hace(f) {
  if (!f) return '';
  const s = (Date.now() - new Date(f).getTime()) / 1000;
  if (s < 60) return 'ahora mismo';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'ayer' : d < 31 ? `hace ${d} días` : `hace ${Math.round(d / 30)} mes${Math.round(d / 30) > 1 ? 'es' : ''}`;
}

export function NotifBell({ variant = 'icon', onNavigate }) {
  const { me } = useAccount();
  const n = useNotifs();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);
  if (!me) return null;
  const abrir = e => { e.stopPropagation(); setOpen(o => !o); if (!open) refreshNotifs(); };
  return (
    <div className={'gv-bell-wrap v-' + variant} ref={ref}>
      {variant === 'icon'
        ? <button className={'gv-bell' + (n.sinLeer ? ' on' : '')} onClick={abrir} title={n.sinLeer ? `${n.sinLeer} aviso${n.sinLeer > 1 ? 's' : ''} sin leer` : 'Avisos'} aria-label="Avisos">
            {n.sinLeer ? <BellRing size={17}/> : <Bell size={17}/>}{n.sinLeer > 0 && <b>{n.sinLeer}</b>}
          </button>
        : <button className="sidebar-action sidebar-mob" onClick={abrir}><Bell size={14}/> Avisos{n.sinLeer > 0 && <b className="nav-badge" style={{ position: 'static', marginLeft: 6 }}>{n.sinLeer}</b>}</button>}
      {open && <AvisosPanel n={n} onClose={() => setOpen(false)} onNavigate={onNavigate}/>}
    </div>
  );
}

function AvisosPanel({ n, onClose, onNavigate }) {
  const nav = useNavigate();
  const [sis, setSis] = useState(sistemaActivado());
  const ir = async a => {
    if (!a.leida) marcarLeidos([a.id]);
    onClose(); onNavigate?.();
    nav(a.link || '/prestamos');
  };
  const toggleSis = async () => setSis(await activarSistema(!sis));
  return (
    <div className="gv-avisos" role="dialog" aria-label="Avisos" onClick={e => e.stopPropagation()}>
      <div className="gv-avisos-h">
        <b>Avisos</b>
        {n.sinLeer > 0 && <button className="gv-link" onClick={() => marcarLeidos()}>Marcar todo como leído</button>}
      </div>
      <div className="gv-avisos-list">
        {(n.avisos || []).length === 0 && <p className="gv-muted" style={{ padding: '18px 14px' }}>No tienes avisos. Aquí saldrá cuando alguien te pida un juego, te conteste, te recuerde una devolución o toque un reto de Switcherino.</p>}
        {(n.avisos || []).slice(0, 30).map(a => {
          const I = ICONO[a.tipo] || Bell;
          return (
            <button key={a.id} className={'gv-aviso t-' + a.tipo + (a.leida ? '' : ' nuevo')} onClick={() => ir(a)}>
              <span className="gv-aviso-av">{a.de === 'switcherino' ? <span className="gv-avatar gv-avatar-ini gv-aviso-sw" style={{ width: 32, height: 32 }}><I size={16}/></span> : <Avatar user={a.quien || { user: a.de, display: a.de }} size={32}/>}<i><I size={11}/></i></span>
              <span className="gv-aviso-txt">{a.texto}<small>{hace(a.fecha)}</small></span>
            </button>
          );
        })}
      </div>
      {sistemaDisponible() && (
        <label className="gv-avisos-sis">
          <input type="checkbox" checked={sis} onChange={toggleSis}/>
          <span>Avisarme también con notificaciones en este aparato <small>(con GameVault abierto o en segundo plano)</small></span>
        </label>
      )}
    </div>
  );
}
