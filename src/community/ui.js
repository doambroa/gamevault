import React, { useEffect, useRef, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertTriangle, LogOut, Camera, User, Eye, EyeOff, Server, Trophy, ArrowRight } from 'lucide-react';
import { Modal, Btn, Input } from '../components/ui/index';
import {
  useAccount, login, register, logout, continueAsGuest, checkServer, saveProfile, uploadImage, absUrl,
  resolveConflict, syncNow, applyRemote, fetchUsers, IS_APP, DEFAULT_SERVER, creditosUrl, claimProfile,
} from './account';
import './community.css';

// ── Avatar: foto o iniciales sobre un color propio de cada persona ────────────
const COLORES = ['#e63946', '#f4a261', '#2a9d8f', '#48cae4', '#9b5de5', '#f15bb5', '#43aa8b', '#577590', '#f9844a', '#4d908e'];
export function Avatar({ user, size = 36, className = '' }) {
  const name = user?.display || user?.user || '?';
  const src = absUrl(user?.avatar);
  const [roto, setRoto] = useState(false);
  useEffect(() => setRoto(false), [src]);
  let h = 0; for (const ch of String(user?.user || name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const st = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  const pend = String(user?.user || '').startsWith('~');
  if (pend) className += ' gv-avatar-pend';
  if (src && !roto) return <img className={'gv-avatar ' + className} style={st} src={src} alt={name} onError={() => setRoto(true)}/>;
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('') || name.slice(0, 2);
  return <span className={'gv-avatar gv-avatar-ini ' + className} style={{ ...st, background: COLORES[h % COLORES.length] }} aria-label={name}>{(name.includes(' ') ? ini : name.slice(0, 2)).toUpperCase()}</span>;
}

// ── Entrar / crear cuenta ─────────────────────────────────────────────────────
export function LoginForm({ onDone, compact = false }) {
  const acc = useAccount();
  const [modo, setModo] = useState('login');
  const [f, setF] = useState({ user: '', pass: '', invite: '', server: acc.server || DEFAULT_SERVER });
  const [verServidor, setVerServidor] = useState(IS_APP && !(acc.server || DEFAULT_SERVER));
  const [info, setInfo] = useState({ creditos: false, needsInvite: acc.needsInvite });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const s = k => e => setF(v => ({ ...v, [k]: e.target.value }));

  // ¿El servidor comparte cuentas con Créditos Finales? ¿pide código de invitación?
  useEffect(() => {
    let vivo = true;
    const srv = IS_APP ? f.server : acc.server;
    if (!srv) return;
    const t = setTimeout(() => checkServer(srv).then(j => vivo && setInfo(j)).catch(() => {}), 400);
    return () => { vivo = false; clearTimeout(t); };
  }, [f.server, acc.server]);

  const enviar = async e => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (modo === 'login') await login(f); else await register(f);
      onDone?.();
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  };

  return (
    <form className={'gv-login' + (compact ? ' compact' : '')} onSubmit={enviar}>
      <div className="seg gv-login-seg" role="tablist">
        <button type="button" className={'seg-btn' + (modo === 'login' ? ' active' : '')} onClick={() => { setModo('login'); setErr(''); }}>Entrar</button>
        <button type="button" className={'seg-btn' + (modo === 'alta' ? ' active' : '')} onClick={() => { setModo('alta'); setErr(''); }}>Crear cuenta</button>
      </div>
      {info.creditos && (
        <p className="gv-login-cf"><Trophy size={14}/> {modo === 'login'
          ? <>Es la misma cuenta que usas en <b>Créditos Finales</b>.</>
          : <>La cuenta te servirá también para <b>Créditos Finales</b>.</>}</p>
      )}
      <Input label="Usuario" value={f.user} onChange={s('user')} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={modo === 'alta' ? 'De 3 a 20 letras o números' : ''} autoFocus={!compact}/>
      <Input label="Contraseña" type="password" value={f.pass} onChange={s('pass')} autoComplete={modo === 'login' ? 'current-password' : 'new-password'} placeholder={modo === 'alta' ? 'Mínimo 6 caracteres' : ''}/>
      {modo === 'alta' && info.needsInvite && <Input label="Código de invitación" value={f.invite} onChange={s('invite')}/>}
      {IS_APP && (verServidor
        ? <Input label="Servidor" value={f.server} onChange={s('server')} placeholder="https://midominio.es/gamevault/" autoCapitalize="none" spellCheck={false}/>
        : <button type="button" className="gv-link" onClick={() => setVerServidor(true)}><Server size={12}/> {f.server.replace(/^https?:\/\//, '').replace(/\/$/, '')} · cambiar</button>)}
      {err && <p className="gv-error">{err}</p>}
      <Btn type="submit" size="lg" disabled={busy || !f.user.trim() || !f.pass || (IS_APP && !f.server.trim())}>
        {busy ? 'Un momento…' : modo === 'login' ? 'Entrar' : 'Crear mi cuenta'}
      </Btn>
    </form>
  );
}

// Pantalla de entrada en la web: registrarse / entrar, o seguir sin cuenta
export function LoginScreen() {
  return (
    <div className="gv-gate">
      <div className="gv-gate-card">
        <img src="./icon-192.png" alt="" width="72" height="72" className="gv-gate-logo"/>
        <h1>GameVault</h1>
        <p className="gv-gate-sub">Tu colección de videojuegos y consolas, en todos tus dispositivos y a la vista de tus colegas.</p>
        <LoginForm/>
        <button className="gv-link gv-gate-guest" onClick={continueAsGuest}>Seguir sin cuenta (la colección se queda solo en este dispositivo) <ArrowRight size={12}/></button>
      </div>
    </div>
  );
}

// ── Estado de la sincronización (pie de la barra lateral) ─────────────────────
export function SyncChip({ onClick }) {
  const { me, sync } = useAccount();
  if (!me) return null;
  const ico = { syncing: <RefreshCw size={12} className="spin"/>, ok: <Check size={12}/>, idle: <Cloud size={12}/>, offline: <CloudOff size={12}/>,
    error: <AlertTriangle size={12}/>, conflict: <AlertTriangle size={12}/>, remote: <RefreshCw size={12}/> }[sync.status];
  const txt = { syncing: 'Guardando…', ok: 'Guardado en tu cuenta', idle: 'Cuenta conectada', offline: 'Sin conexión', error: 'No se pudo guardar', conflict: 'Hay que elegir versión', remote: 'Hay cambios nuevos' }[sync.status];
  return <button className={'gv-sync gv-sync-' + sync.status} onClick={onClick} title={sync.msg || txt}>{ico}<span>{txt}</span></button>;
}

// Botón de cuenta: arriba en la barra lateral
export function AccountButton({ onOpen }) {
  const { me, available, ready } = useAccount();
  if (!ready || !available) return null;
  if (!me) return (
    <button className="gv-accbtn gv-accbtn-out" onClick={onOpen}>
      <span className="gv-avatar gv-avatar-ini" style={{ width: 34, height: 34, background: 'var(--bg-4)', color: 'var(--text-2)' }}><User size={16}/></span>
      <span className="gv-accbtn-txt"><b>Iniciar sesión</b><small>Sincroniza y comparte tu colección</small></span>
    </button>
  );
  return (
    <button className="gv-accbtn" onClick={onOpen} title="Mi cuenta">
      <Avatar user={me} size={34}/>
      <span className="gv-accbtn-txt"><b>{me.display}</b><SyncLine/></span>
    </button>
  );
}
function SyncLine() {
  const { sync } = useAccount();
  const txt = { syncing: 'Guardando…', ok: 'Todo guardado', idle: 'Conectado', offline: 'Sin conexión', error: 'Error al guardar', conflict: 'Elige versión', remote: 'Cambios nuevos' }[sync.status];
  return <small className={'gv-syncline gv-sync-' + sync.status}>{txt}</small>;
}

const Toggle = ({ on, onChange, label, desc }) => (
  <label className="gv-toggle">
    <span className="gv-toggle-txt"><b>{label}</b>{desc && <small>{desc}</small>}</span>
    <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)}/>
    <span className="gv-toggle-sw" aria-hidden="true">{on ? <Eye size={11}/> : <EyeOff size={11}/>}</span>
  </label>
);

// ── Mi cuenta: perfil, privacidad, sincronización ─────────────────────────────
export function AccountModal({ open, onClose }) {
  const acc = useAccount();
  const { me, sync } = acc;
  const [bio, setBio] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);
  useEffect(() => { if (open && me) { setBio(me.bio || ''); setMsg(''); } }, [open, me]);

  if (!open) return null;
  if (!me) return (
    <Modal open onClose={onClose} title="Tu cuenta" width={420}>
      <p className="gv-muted" style={{ marginBottom: 14 }}>Con una cuenta tu colección se guarda en el servidor, la tienes igual en el PC, el móvil y la web, y tus colegas pueden verla (sin tocar nada).</p>
      <LoginForm compact onDone={onClose}/>
    </Modal>
  );
  const privacidad = async (k, v) => { try { await saveProfile({ privacy: { [k]: v } }); } catch (e) { setMsg(e.message); } };
  const subirFoto = async e => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setMsg('Subiendo foto…');
    try { const r = await uploadImage(f, { max: 400 }); await saveProfile({ avatar: r.path }); setMsg(''); }
    catch (ex) { setMsg(ex.message); }
  };
  const cf = creditosUrl();
  return (
    <Modal open onClose={onClose} title="Mi cuenta" width={480}>
      <div className="gv-profile-head">
        <button className="gv-avatar-edit" onClick={() => fileRef.current?.click()} title="Cambiar foto de perfil">
          <Avatar user={me} size={76}/><span><Camera size={14}/></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={subirFoto}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="gv-profile-name">{me.display}</div>
          <div className="gv-muted">@{me.user}{me.avatar && <> · <button className="gv-link" onClick={() => saveProfile({ avatar: null })}>quitar foto</button></>}</div>
        </div>
      </div>
      <div className="field" style={{ marginBottom: 16 }}>
        <label className="field-label">Una frase sobre ti o tu colección</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field-input" maxLength={160} value={bio} onChange={e => setBio(e.target.value)} placeholder="Coleccionista de Nintendo 64 y lo que caiga"/>
          <Btn variant="secondary" disabled={bio === (me.bio || '')} onClick={() => saveProfile({ bio }).catch(e => setMsg(e.message))}>Guardar</Btn>
        </div>
      </div>

      <p className="section-title">Qué ven los demás de tu colección</p>
      <div className="gv-toggles">
        <Toggle on={me.privacy?.precios !== false} onChange={v => privacidad('precios', v)} label="Precios" desc="Lo que te costó cada juego y consola"/>
        <Toggle on={me.privacy?.comentarios !== false} onChange={v => privacidad('comentarios', v)} label="Comentarios" desc="Tus notas personales de cada juego"/>
        <Toggle on={me.privacy?.deseos !== false} onChange={v => privacidad('deseos', v)} label="Lista de deseos" desc="Para que sepan qué regalarte"/>
      </div>
      <p className="gv-muted" style={{ marginTop: 6 }}>Nadie puede modificar tu colección: los demás solo la consultan.</p>

      <p className="section-title" style={{ marginTop: 20 }}>Sincronización</p>
      <div className={'gv-syncbox gv-sync-' + sync.status}>
        <SyncChip/>
        <span className="gv-muted" style={{ flex: 1 }}>{sync.msg}</span>
        {sync.status === 'remote'
          ? <Btn size="sm" onClick={applyRemote}>Actualizar</Btn>
          : <Btn size="sm" variant="secondary" onClick={syncNow} disabled={sync.status === 'syncing'}><RefreshCw size={13}/> Sincronizar ahora</Btn>}
      </div>
      {msg && <p className="gv-error" style={{ marginTop: 10 }}>{msg}</p>}

      <div className="form-actions" style={{ justifyContent: 'space-between', marginTop: 20 }}>
        {acc.me?.creditos && cf
          ? <a className="btn btn-ghost btn-md" href={cf} target="_blank" rel="noreferrer"><Trophy size={14}/> Abrir Créditos Finales</a> : <span/>}
        <Btn variant="ghost" onClick={async () => { await logout(); onClose(); }}><LogOut size={14}/> Cerrar sesión</Btn>
      </div>
    </Modal>
  );
}

// ── Dos versiones distintas de la colección: que decida la persona ────────────
const cuenta = c => (c ? `${c.juegos ?? 0} juegos · ${c.plataformas ?? 0} consolas` : '');
const fecha = iso => { try { return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return ''; } };
export function ConflictModal() {
  const { conflict, me } = useAccount();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  if (!conflict || !me) return null;
  const go = async k => { setBusy(k); setErr(''); try { await resolveConflict(k); } catch (e) { setErr(e.message); } setBusy(''); };
  if (conflict.otraCuenta) return (
    <div className="modal-overlay" style={{ zIndex: 9500 }}>
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div className="modal-header"><h2 className="modal-title">Este aparato tiene la colección de otra cuenta</h2></div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-1)', lineHeight: 1.6, marginBottom: 16 }}>
            Aquí está la colección de <b>{conflict.otraCuenta}</b> ({cuenta(conflict.local?.counts)}) con cambios que aún no se han subido a su cuenta.
            Las colecciones de cada persona <b>no se mezclan</b>: la suya no pasará a la tuya.
          </p>
          <div className="gv-conflict">
            <button className="gv-conflict-opt" disabled={!!busy} onClick={() => go('salir')}>
              <User size={22}/>
              <b>Salir y que entre {conflict.otraCuenta}</b>
              <small>Al entrar con su cuenta se suben sus cambios</small>
              <span className="btn btn-secondary btn-sm">{busy === 'salir' ? 'Saliendo…' : 'Salir'}</span>
            </button>
            <button className="gv-conflict-opt" disabled={!!busy} onClick={() => go('descartar')}>
              <Cloud size={22}/>
              <b>Seguir como {me.display || me.user}</b>
              <small>Se pierden esos cambios sin subir de {conflict.otraCuenta} y se carga tu colección</small>
              <span className="btn btn-secondary btn-sm">{busy === 'descartar' ? 'Cargando…' : 'Usar la mía'}</span>
            </button>
          </div>
          {err && <p className="gv-error">{err}</p>}
        </div>
      </div>
    </div>
  );
  return (
    <div className="modal-overlay" style={{ zIndex: 9500 }}>
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div className="modal-header"><h2 className="modal-title">¿Qué colección te quedas?</h2></div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-1)', lineHeight: 1.6, marginBottom: 16 }}>
            {conflict.first
              ? <>En tu cuenta ya hay una colección guardada y en este dispositivo hay otra distinta. Elige cuál quieres conservar: <b>la otra se sustituye</b>.</>
              : <>Has cambiado tu colección en otro dispositivo y aquí también tenías cambios sin subir. Elige cuál quieres conservar: <b>la otra se sustituye</b>.</>}
          </p>
          <div className="gv-conflict">
            <button className="gv-conflict-opt" disabled={!!busy} onClick={() => go('server')}>
              <Cloud size={22}/>
              <b>La de mi cuenta</b>
              <small>{cuenta(conflict.server?.counts)}</small>
              <small>{conflict.server?.updatedAt ? 'Guardada el ' + fecha(conflict.server.updatedAt) : ''}{conflict.server?.device ? ` · ${conflict.server.device}` : ''}</small>
              <span className="btn btn-secondary btn-sm">{busy === 'server' ? 'Descargando…' : 'Usar esta'}</span>
            </button>
            <button className="gv-conflict-opt" disabled={!!busy} onClick={() => go('local')}>
              <User size={22}/>
              <b>La de este dispositivo</b>
              <small>{cuenta(conflict.local?.counts)}</small>
              <small>Lo que estás viendo ahora</small>
              <span className="btn btn-secondary btn-sm">{busy === 'local' ? 'Subiendo…' : 'Usar esta'}</span>
            </button>
          </div>
          <p className="gv-muted" style={{ marginTop: 12 }}>Si dudas, exporta antes una copia con «Exportar JSON».</p>
          {err && <p className="gv-error">{err}</p>}
        </div>
      </div>
    </div>
  );
}

// Aviso discreto: otro dispositivo ha guardado cambios
export function RemoteToast() {
  const { sync, me } = useAccount();
  if (!me || sync.status !== 'remote') return null;
  return (
    <div className="gv-toast">
      <RefreshCw size={15}/> <span>Has cambiado tu colección en otro dispositivo.</span>
      <Btn size="sm" onClick={applyRemote}>Actualizar</Btn>
    </div>
  );
}

// ── Prestar un juego: a alguien de la comunidad o a quien sea ─────────────────
export function PrestarModal({ open, juego, onClose, onSaved }) {
  const { me } = useAccount();
  const [gente, setGente] = useState([]);
  const [quien, setQuien] = useState('');        // texto libre
  const [usuario, setUsuario] = useState('');    // usuario de la comunidad
  const [fechaP, setFechaP] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setQuien(juego?.prestadoUsuario ? '' : juego?.prestadoA || ''); setUsuario(juego?.prestadoUsuario || '');
    setFechaP(juego?.fechaPrestamo || new Date().toISOString().slice(0, 10));
    if (me) fetchUsers().then(l => setGente(l.filter(u => u.user !== me.user))).catch(() => setGente([]));
  }, [open, juego, me]);
  if (!open || !juego) return null;
  const elegido = gente.find(g => g.user === usuario);
  const guardar = async () => {
    setBusy(true);
    await window.api.juegos.prestar({ id: juego.id, prestadoA: elegido ? elegido.display : quien.trim(), prestadoUsuario: elegido ? elegido.user : null, fechaPrestamo: fechaP });
    setBusy(false); onSaved?.(); onClose();
  };
  return (
    <Modal open onClose={onClose} title="Prestar juego" width={460}>
      <p style={{ color: 'var(--text-1)', marginBottom: 14 }}>¿A quién le dejas <b style={{ color: 'var(--text-0)' }}>{juego.nombre}</b>?</p>
      {gente.length > 0 && (
        <div className="gv-pick">
          {gente.map(g => (
            <button key={g.user} className={'gv-pick-item' + (usuario === g.user ? ' on' : '')} onClick={() => { setUsuario(usuario === g.user ? '' : g.user); setQuien(''); }}>
              <Avatar user={g} size={40}/><span>{g.display}</span>{g.pending && <small className="gv-pick-pend">sin cuenta</small>}
            </button>
          ))}
        </div>
      )}
      <Input label={gente.length ? 'O a otra persona' : 'Nombre'} value={quien} placeholder="Nombre de quien lo tiene"
        onChange={e => { setQuien(e.target.value); setUsuario(''); }}/>
      <div style={{ marginTop: 12 }}><Input label="Desde" type="date" value={fechaP} onChange={e => setFechaP(e.target.value)}/></div>
      <div className="form-actions">
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={guardar} disabled={busy || (!elegido && !quien.trim())}>Marcar como prestado</Btn>
      </div>
    </Modal>
  );
}

// ── «¿Esta colección es tuya?» — perfiles de la tabla compartida que el admin te ha asignado ──
const LS_NO = 'gv-claim-no';
export function ClaimBanner() {
  const { me } = useAccount();
  const [no, setNo] = useState(() => { try { return JSON.parse(localStorage.getItem(LS_NO)) || []; } catch { return []; } });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const p = (me?.claimable || []).find(c => !no.includes(c.id));
  if (!p) return null;
  const nope = () => { const v = [...no, p.id]; setNo(v); try { localStorage.setItem(LS_NO, JSON.stringify(v)); } catch {} };
  const si = async () => { setBusy(true); setErr(''); try { await claimProfile(p.id); } catch (e) { setErr(e.message); setBusy(false); } };
  return (
    <div className="gv-claim">
      <Avatar user={{ user: p.id, display: p.display }} size={42}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>¿Eres {p.display}?</b>
        <p>En la tabla de préstamos había {p.juegos} juego{p.juegos !== 1 ? 's' : ''} a tu nombre. Si son tuyos, pasan a tu colección (y lo que tengas prestado sigue apuntado).</p>
        {err && <p className="gv-error">{err}</p>}
      </div>
      <div className="gv-claim-btns">
        <Btn size="sm" onClick={si} disabled={busy}>{busy ? 'Añadiendo…' : 'Sí, son míos'}</Btn>
        <Btn size="sm" variant="ghost" onClick={nope} disabled={busy}>No soy yo</Btn>
      </div>
    </div>
  );
}
