import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Gift, Check, Copy, LogOut, ShieldAlert } from 'lucide-react';
import { Btn, SkeletonList } from '../components/ui/index';
import { useAccount, claimInfo, claimProfile, logout } from './account';
import { Avatar, LoginForm } from './ui';

/* Enlace que el administrador manda a cada colega: «esta colección de la tabla es tuya».
 * Se entra (o se crea la cuenta) y con un botón los juegos pasan a su colección. */
export default function ReclamarPage() {
  const { id, code } = useParams();
  const { me, ready } = useAccount();
  const nav = useNavigate();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setErr(''); setInfo(null); if (me) claimInfo(id, code).then(setInfo).catch(e => setErr(e.message)); }, [me, id, code]);

  const [copiado, setCopiado] = useState(false);
  const si = async () => {
    if (!info.esPara && !window.confirm(`¿Seguro que eres ${info.display}? Sus ${info.juegos} juegos pasarán a la colección de la cuenta «${me.display || me.user}».`)) return;
    setBusy(true); setErr(''); try { await claimProfile(info.id, code); } catch (e) { setErr(e.message); setBusy(false); }
  };
  const salir = async () => { await logout(); };
  const copiar = async () => { try { await navigator.clipboard.writeText(window.location.href); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch {} };
  return (
    <div className="page">
      <div className="gv-need" style={{ maxWidth: 440 }}>
        <Gift size={40}/>
        <h3>Tu colección te espera</h3>
        {!ready ? <SkeletonList n={2}/> : !me ? (<>
          <p>Alguien ha apuntado tus juegos en GameVault. Entra con tu cuenta (o créala, es un momento) y pasarán a ser tuyos.</p>
          <LoginForm compact/>
        </>) : err ? (<>
          <p className="gv-error">{err}</p>
          <Btn variant="secondary" onClick={() => nav('/dashboard')}>Ir a mi colección</Btn>
        </>) : !info ? <SkeletonList n={2}/> : (<>
          <div className="gv-claim-who"><Avatar user={{ user: info.id, display: info.display }} size={56}/><div><b>{info.display}</b><small>{info.juegos} juego{info.juegos !== 1 ? 's' : ''} · {info.plataformas} consola{info.plataformas !== 1 ? 's' : ''}</small></div></div>
          {info.admin ? (<>
            <p className="gv-claim-aviso"><ShieldAlert size={16}/><span>Este es el enlace de <b>{info.display}</b>. Estás dentro como <b>{me.display}</b> (administrador), así que aquí no se puede aceptar: tu colección no cambia.</span></p>
            <p>Mándaselo a {info.display}: cuando lo abra con <b>su</b> cuenta, estos juegos pasarán a <b>su</b> colección, separada de la tuya.</p>
            <Btn size="lg" onClick={copiar}>{copiado ? <Check size={16}/> : <Copy size={16}/>} {copiado ? 'Enlace copiado' : 'Copiar el enlace para mandárselo'}</Btn>
            <button className="gv-link" style={{ marginTop: 6 }} onClick={() => nav('/dashboard')}>Volver a mi colección</button>
          </>) : (<>
            <p>Este enlace es para <b>{info.display}</b>. Ahora estás dentro como <b>{me.display}</b>.</p>
            <p>Si eres {info.display} y esta es tu cuenta, acepta: estos juegos (con los préstamos que ya estuvieran apuntados) pasan a <b>tu</b> colección, y desde ese momento solo tú puedes cambiarlos. Cada persona tiene su colección aparte; nadie más la puede tocar.</p>
            <Btn size="lg" onClick={si} disabled={busy}><Check size={16}/> {busy ? 'Añadiendo…' : `Sí, soy ${info.display}`}</Btn>
            <button className="gv-link" style={{ marginTop: 8 }} onClick={salir}><LogOut size={13}/> No soy {info.display}: salir de esta cuenta</button>
          </>)}
        </>)}
      </div>
    </div>
  );
}
