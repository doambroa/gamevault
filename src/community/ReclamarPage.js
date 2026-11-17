import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Gift, Check } from 'lucide-react';
import { Btn, SkeletonList } from '../components/ui/index';
import { useAccount, claimInfo, claimProfile } from './account';
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

  const si = async () => { setBusy(true); setErr(''); try { await claimProfile(info.id, code); } catch (e) { setErr(e.message); setBusy(false); } };
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
          <p>¿Eres tú? Al aceptar, estos juegos se suman a la colección de <b>{me.display}</b>, con los préstamos que ya estuvieran apuntados. Desde ese momento solo tú puedes cambiarlos.</p>
          <Btn size="lg" onClick={si} disabled={busy}><Check size={16}/> {busy ? 'Añadiendo…' : 'Sí, son míos'}</Btn>
          <button className="gv-link" style={{ marginTop: 6 }} onClick={() => nav('/dashboard')}>No soy yo</button>
        </>)}
      </div>
    </div>
  );
}
