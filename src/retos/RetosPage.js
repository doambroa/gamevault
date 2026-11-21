import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Music, Award, Plus, Pencil, Trash2, Play, ListMusic, Copy, Check, Youtube, Users, ChevronDown, Lock, CalendarDays, Link2, Loader } from 'lucide-react';
import { PageHeader, Btn, SkeletonList, EmptyState } from '../components/ui/index';
import { useAccount, fetchRetos, aportarTema } from '../community/account';
import { Avatar } from '../community/ui';
import { NeedAccount } from '../community/ComunidadPage';
import { ytId, ytThumb, ytWatch, ytLista, estacion, fechaDia, fmtDia, comoDocumento, copiar } from './util';
import { PlaylistEditor, AliasModal } from './RetosAdmin';
import PorraView from './Porra';
import './Retos.css';

/* Retos Switcherino:
 *  · Playlist de estación: cada día una frase y cada uno pone el tema de videojuego que le evoca (enlace de YouTube).
 *    El día de hoy se resalta; al poner el tuyo aparece el de mañana sombreado para ir pensándolo.
 *  · Porra de los Game Awards: categoría a categoría, con tarjetas; se guarda al momento. */
export default function RetosPage({ tab: tabProp }) {
  const { me } = useAccount();
  const nav = useNavigate();
  const { id } = useParams();
  const tab = tabProp || 'playlist';
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const cargar = useCallback(() => fetchRetos().then(d => { setData(d); setErr(''); return d; }).catch(e => setErr(e.message)), []);
  // Se recarga al cambiar de pestaña, al volver a la ventana y cada minuto (para ver los temas y votos de los demás)
  useEffect(() => { if (me) cargar(); }, [me, cargar, tab]);
  useEffect(() => {
    if (!me) return;
    const foco = () => { if (!document.hidden) cargar(); };
    const t = setInterval(foco, 60000);
    window.addEventListener('focus', foco); document.addEventListener('visibilitychange', foco);
    return () => { clearInterval(t); window.removeEventListener('focus', foco); document.removeEventListener('visibilitychange', foco); };
  }, [me, cargar]);
  if (!me) return <NeedAccount titulo="Retos Switcherino"/>;
  return (
    <div className="page retos-page">
      <PageHeader title="Retos Switcherino" subtitle={tab === 'porra' ? 'La porra: quién crees que gana cada categoría' : 'Un tema de videojuego para cada día de la estación'}/>
      <div className="retos-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'playlist'} className={tab === 'playlist' ? 'on' : ''} onClick={() => nav('/retos')}><Music size={16}/> Playlist</button>
        <button role="tab" aria-selected={tab === 'porra'} className={tab === 'porra' ? 'on' : ''} onClick={() => nav('/retos/porra')}><Award size={16}/> Porra</button>
      </div>
      {err && <div className="gv-error">{err} <button className="gv-link" onClick={cargar}>Reintentar</button></div>}
      {!data ? <SkeletonList n={4}/> : tab === 'porra'
        ? <PorraView data={data} me={me} recargar={cargar} selId={id} onSel={i => nav('/retos/porra/' + i)}/>
        : <PlaylistTab data={data} me={me} recargar={cargar} selId={id} onSel={i => nav('/retos/playlist/' + i)}/>}
    </div>
  );
}

// ── Playlist ──────────────────────────────────────────────────────────────────
function estadoTxt(pl) {
  const n = (pl.dias || []).length;
  if (pl.estado === 'borrador') return 'Borrador (solo lo ves tú)';
  if (pl.estado === 'terminado' || pl.hoy > n) return 'Terminada';
  if (pl.hoy < 1) return pl.inicio ? 'Empieza el ' + fmtDia(fechaDia(pl.inicio, 1), { day: 'numeric', month: 'long' }) : 'Sin fecha';
  return `En marcha · día ${pl.hoy} de ${n}`;
}

function PlaylistTab({ data, me, recargar, selId, onSel }) {
  const pls = data.playlists || [];
  const [editar, setEditar] = useState(null);       // null | {} (nueva) | playlist
  const [alias, setAlias] = useState(false);
  const def = pls.find(p => p.estado === 'activo' && p.hoy <= p.dias.length) || pls.find(p => p.estado === 'activo') || pls.find(p => p.estado === 'borrador') || pls[0];
  const pl = pls.find(p => p.id === selId) || def;
  return (
    <>
      <div className="retos-chips">
        {pls.map(p => {
          const E = estacion(p.estacion);
          return (
            <button key={p.id} className={'retos-chip' + (p.id === pl?.id ? ' on' : '') + ' st-' + p.estado} style={{ '--c1': E.c1, '--c2': E.c2 }} onClick={() => onSel(p.id)}>
              <E.Icon size={15}/><span><b>{p.titulo}</b><small>{estadoTxt(p)}</small></span>
            </button>
          );
        })}
        {data.admin && <button className="retos-chip nuevo" onClick={() => setEditar({})}><Plus size={15}/><span><b>Nueva playlist</b><small>Pega las frases y elige el día de inicio</small></span></button>}
      </div>
      {!pl ? (
        <EmptyState icon={<Music size={52}/>} title="Todavía no hay ninguna playlist"
          description={data.admin ? 'Crea la primera con «Nueva playlist»: pegas las frases (una por día) y eliges cuándo empieza.' : 'Cuando se arranque la próxima, aquí saldrá la frase de cada día para que pongas tu tema.'}/>
      ) : <PlaylistView key={pl.id} pl={pl} me={me} admin={data.admin} gente={data.gente || []} recargar={recargar} onEditar={() => setEditar(pl)} onAlias={() => setAlias(true)}/>}
      {editar && <PlaylistEditor pl={editar.id ? editar : null} onClose={() => setEditar(null)} onSaved={async p => { setEditar(null); await recargar(); if (p?.id) onSel(p.id); }}/>}
      {alias && <AliasModal data={data} onClose={() => setAlias(false)} recargar={recargar}/>}
    </>
  );
}

function PlaylistView({ pl, me, admin, gente, recargar, onEditar, onAlias }) {
  const E = estacion(pl.estacion);
  const n = pl.dias.length;
  const terminado = pl.estado === 'terminado' || pl.hoy > n;
  const borrador = pl.estado === 'borrador';
  const hoy = terminado ? n + 1 : borrador ? 0 : pl.hoy;
  const ap = useMemo(() => pl.aportes || {}, [pl.aportes]);
  const yo = me.user;
  const puseHoy = hoy >= 1 && hoy <= n && !!ap[hoy]?.[yo];
  const [copiado, setCopiado] = useState(false);
  const [verAntes, setVerAntes] = useState(true);
  const hoyRef = useRef(null);

  const todos = useMemo(() => {
    const ids = [];
    for (let i = 1; i <= n; i++) Object.values(ap[i] || {}).forEach(a => ids.push(a.yt));
    return ids;
  }, [ap, n]);
  const participantes = useMemo(() => {
    const m = new Map();
    for (let i = 1; i <= n; i++) for (const a of Object.values(ap[i] || {})) {
      const k = a.quien?.user || a.quien?.key; const x = m.get(k) || { quien: a.quien, n: 0 }; x.n++; m.set(k, x);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [ap, n]);

  const visible = i => terminado || admin || pl.verFuturas || i <= hoy || (i === hoy + 1 && (puseHoy || hoy === 0));
  const tipo = i => (terminado ? 'pasado' : i < hoy ? 'pasado' : i === hoy ? 'hoy' : i === hoy + 1 ? 'manana' : 'futuro');
  const ocultos = Array.from({ length: n }, (_, k) => k + 1).filter(i => !visible(i)).length;

  const dias = Array.from({ length: n }, (_, k) => k + 1).filter(visible);
  // En marcha: hoy (y mañana) arriba, luego los anteriores del más reciente al más antiguo
  const arriba = terminado ? [] : dias.filter(i => i >= hoy);
  const antes = terminado ? dias : dias.filter(i => i < hoy).reverse();

  const pctHoy = hoy >= 1 && hoy <= n ? Math.round(((hoy - 1) / n) * 100) : terminado ? 100 : 0;
  const listas = ytLista(todos);
  const doCopiar = async () => { if (await copiar(comoDocumento(pl))) { setCopiado(true); setTimeout(() => setCopiado(false), 2000); } };

  return (
    <div className="pl-view" style={{ '--c1': E.c1, '--c2': E.c2 }}>
      <div className="pl-hero">
        <div className="pl-hero-ico"><E.Icon size={34}/></div>
        <div className="pl-hero-txt">
          <h2>{pl.titulo}</h2>
          <p>{estadoTxt(pl)}{pl.inicio && <> · {fmtDia(fechaDia(pl.inicio, 1), { day: 'numeric', month: 'short' })} – {fmtDia(fechaDia(pl.inicio, n), { day: 'numeric', month: 'short', year: 'numeric' })}</>}</p>
          {!borrador && <div className="pl-prog" title={`${pctHoy}% del reto`}><i style={{ width: pctHoy + '%' }}/></div>}
        </div>
        {/* El vídeo final: el resultado de todo lo de abajo, bien a la vista */}
        {pl.video && ytId(pl.video) && (
          <a className="pl-video" href={pl.video} target="_blank" rel="noreferrer" title="Ver el vídeo en YouTube">
            <span className="pl-video-img"><img src={`https://i.ytimg.com/vi/${ytId(pl.video)}/hqdefault.jpg`} alt=""/><span className="pl-video-play"><Play size={26}/></span></span>
            <span className="pl-video-txt"><small><Youtube size={12}/> El vídeo final</small>{pl.videoTitulo && <b>{pl.videoTitulo}</b>}</span>
          </a>
        )}
        <div className="pl-hero-acc">
          {listas.map((l, k) => <a key={k} className="btn btn-secondary btn-sm" href={l.url} target="_blank" rel="noreferrer"><ListMusic size={14}/> {listas.length > 1 ? `Escuchar ${l.desde}–${l.hasta}` : `Escuchar todo (${todos.length})`}</a>)}
          {pl.playlist && <a className="btn btn-ghost btn-sm" href={pl.playlist} target="_blank" rel="noreferrer"><Youtube size={14}/> Lista en YouTube</a>}
          {admin && <>
            <Btn variant="ghost" size="sm" onClick={onEditar}><Pencil size={14}/> Editar</Btn>
            <Btn variant="ghost" size="sm" onClick={doCopiar}>{copiado ? <Check size={14}/> : <Copy size={14}/>} {copiado ? 'Copiado' : 'Copiar como documento'}</Btn>
            <Btn variant="ghost" size="sm" onClick={onAlias}><Users size={14}/> Quién es quién</Btn>
          </>}
        </div>
      </div>

      {pl.intro && <section className="pl-intro-box"><h3>De qué va</h3><p>{pl.intro}</p></section>}

      {participantes.length > 0 && (
        <div className="pl-gente">
          {participantes.map(p => (
            <span key={p.quien?.key} className="pl-persona" title={`${p.quien?.display}: ${p.n} tema${p.n !== 1 ? 's' : ''}`}>
              <Avatar user={p.quien} size={26}/><b>{p.quien?.display}</b><small>{p.n}</small>
            </span>
          ))}
        </div>
      )}

      {borrador && <div className="pl-aviso">Está en borrador: nadie más la ve. Cuando tengas las frases, pon la fecha de inicio y márcala «En marcha» desde <b>Editar</b>.</div>}
      {!borrador && hoy === 0 && <div className="pl-aviso"><CalendarDays size={16}/> Empieza el {fmtDia(fechaDia(pl.inicio, 1), { weekday: 'long', day: 'numeric', month: 'long' })}. Ya puedes ir pensando en el primer tema.</div>}

      <div className="pl-dias">
        {arriba.map(i => <DiaCard key={i} ref={i === hoy ? hoyRef : null} pl={pl} i={i} tipo={borrador ? 'futuro' : tipo(i)} me={me} admin={admin} gente={gente} recargar={recargar}/>)}
        {!terminado && ocultos > 0 && (
          <div className="pl-ocultos"><Lock size={15}/> {ocultos === 1 ? 'Queda 1 día' : `Quedan ${ocultos} días`} por descubrir{!puseHoy && hoy >= 1 && hoy <= n ? ' · pon el tema de hoy y verás la frase de mañana' : ''}</div>
        )}
        {antes.length > 0 && !terminado && (
          <button className="pl-antes-h" onClick={() => setVerAntes(v => !v)}>
            <ChevronDown size={16} className={verAntes ? '' : 'rot'}/> Días anteriores <small>{antes.length}</small>
          </button>
        )}
        {(terminado || verAntes) && antes.map(i => <DiaCard key={i} pl={pl} i={i} tipo={tipo(i)} me={me} admin={admin} gente={gente} recargar={recargar}/>)}
      </div>
    </div>
  );
}

const DiaCard = React.forwardRef(function DiaCard({ pl, i, tipo, me, admin, gente, recargar }, ref) {
  const lista = Object.entries(pl.aportes?.[i] || {}).map(([key, a]) => ({ key, ...a }));
  const mio = lista.find(a => a.key === me.user);
  const [form, setForm] = useState(tipo === 'hoy' && !mio);
  const [editMio, setEditMio] = useState(false);
  useEffect(() => { if (tipo === 'hoy' && !mio) setForm(true); }, [tipo, mio]);
  const fecha = fechaDia(pl.inicio, i);
  const puedeAportar = tipo === 'hoy' || tipo === 'pasado';
  const lista2 = [...lista].sort((a, b) => (a.key === me.user ? -1 : b.key === me.user ? 1 : String(a.fecha).localeCompare(String(b.fecha))));
  return (
    <section ref={ref} className={'pl-dia t-' + tipo} id={'dia-' + i} aria-label={`Día ${i}`}>
      <header className="pl-dia-h">
        <span className="pl-dia-n"><small>Día</small>{i}</span>
        <div className="pl-dia-f">
          <div className="pl-dia-cuando">
            {tipo === 'hoy' && <b className="pl-tag hoy">Hoy</b>}
            {tipo === 'manana' && <b className="pl-tag manana">Mañana</b>}
            {fecha && <span>{fmtDia(fecha, { weekday: 'long', day: 'numeric', month: 'long' })}</span>}
          </div>
          <p className="pl-frase">{pl.dias[i - 1].t}</p>
        </div>
      </header>
      {tipo === 'manana' && <p className="pl-pensar">Ve pensando en tu tema: mañana se abre este día.</p>}
      {lista2.length > 0 && (
        <div className="pl-temas">
          {lista2.map(a => (a.key === me.user && editMio)
            ? <AporteForm key={a.key} pl={pl} i={i} inicial={a} onDone={() => { setEditMio(false); recargar(); }} onCancel={() => setEditMio(false)}/>
            : <Tema key={a.key} a={a} mio={a.key === me.user} admin={admin} pl={pl} i={i} recargar={recargar} onEditar={() => setEditMio(true)}/>)}
        </div>
      )}
      {lista2.length === 0 && tipo !== 'manana' && tipo !== 'futuro' && !form && <p className="pl-vacio">Nadie ha puesto tema este día.</p>}
      {puedeAportar && !mio && (form
        ? <AporteForm pl={pl} i={i} onDone={() => { setForm(false); recargar(); }} onCancel={tipo === 'hoy' ? null : () => setForm(false)} hoy={tipo === 'hoy'}/>
        : <button className="pl-add" onClick={() => setForm(true)}><Plus size={15}/> {tipo === 'pasado' ? '¿Se te pasó? Pon el tuyo' : 'Poner mi tema'}</button>)}
      {admin && <AdminAporte pl={pl} i={i} gente={gente} recargar={recargar}/>}
    </section>
  );
});

function Tema({ a, mio, admin, pl, i, recargar, onEditar }) {
  const [borrando, setBorrando] = useState(false);
  const quitar = async () => {
    if (!window.confirm('¿Quitar este tema?')) return;
    setBorrando(true);
    try { await aportarTema(pl.id, i, '', mio ? {} : { para: a.key }); await recargar(); } catch (e) { alert(e.message); setBorrando(false); }
  };
  const url = a.url || ytWatch(a.yt);
  return (
    <div className={'pl-tema' + (mio ? ' mio' : '')}>
      <a className="pl-thumb" href={url} target="_blank" rel="noreferrer" title="Abrir en YouTube">
        <img src={ytThumb(a.yt)} alt="" loading="lazy"/><span className="pl-play"><Play size={18}/></span>
      </a>
      <div className="pl-tema-txt">
        <a className="pl-tema-t" href={url} target="_blank" rel="noreferrer">{a.titulo || 'Vídeo de YouTube'}</a>
        {a.nota && <small className="pl-nota">{a.nota}</small>}
        <span className="pl-quien"><Avatar user={a.quien} size={20}/>{a.quien?.display}{a.quien?.sinCuenta && <i title="Sin cuenta en GameVault"> · sin cuenta</i>}</span>
      </div>
      {(mio || admin) && (
        <div className="pl-tema-acc">
          {mio && <button className="icon-btn" title="Cambiar" onClick={onEditar}><Pencil size={14}/></button>}
          <button className="icon-btn" title="Quitar" onClick={quitar} disabled={borrando}><Trash2 size={14}/></button>
        </div>
      )}
    </div>
  );
}

function AporteForm({ pl, i, inicial, onDone, onCancel, hoy, para }) {
  const [url, setUrl] = useState(inicial?.url || '');
  const [titulo, setTitulo] = useState(inicial?.titulo || '');
  const [nota, setNota] = useState(inicial?.nota || '');
  const [mas, setMas] = useState(!!inicial?.nota);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const id = ytId(url);
  const enviar = async e => {
    e.preventDefault();
    if (!id) { setErr('Pega un enlace de YouTube (youtube.com/watch?v=… o youtu.be/…)'); return; }
    setBusy(true); setErr('');
    try {
      const mismo = inicial && inicial.yt === id;
      await aportarTema(pl.id, i, url.trim(), { titulo: mismo || titulo !== (inicial?.titulo || '') ? titulo : '', nota, ...(para ? { para } : {}) });
      onDone?.();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <form className={'pl-form' + (hoy ? ' hoy' : '')} onSubmit={enviar}>
      <div className="pl-form-row">
        {id ? <img className="pl-form-prev" src={ytThumb(id)} alt=""/> : <span className="pl-form-prev vacio"><Link2 size={18}/></span>}
        <div className="pl-form-campos">
          <input className="field-input" placeholder={hoy ? 'Pega aquí el enlace de YouTube de tu tema de hoy' : 'Enlace de YouTube'} value={url} onChange={e => setUrl(e.target.value)} autoFocus={!!inicial} aria-label="Enlace de YouTube"/>
          {(mas || inicial) && <input className="field-input" placeholder="Título (si lo dejas vacío se coge el de YouTube)" value={titulo} onChange={e => setTitulo(e.target.value)} aria-label="Título"/>}
          {mas && <input className="field-input" placeholder="Un comentario, si quieres (de qué juego es, por qué…)" value={nota} onChange={e => setNota(e.target.value)} aria-label="Comentario"/>}
        </div>
      </div>
      {err && <p className="field-error">{err}</p>}
      <div className="pl-form-acc">
        {!mas && <button type="button" className="gv-link" onClick={() => setMas(true)}>Añadir título o comentario</button>}
        <span style={{ flex: 1 }}/>
        {onCancel && <Btn type="button" variant="ghost" size="sm" onClick={onCancel}>Cancelar</Btn>}
        <Btn type="submit" size="sm" disabled={busy || !url.trim()}>{busy ? <Loader size={14} className="spin"/> : <Check size={14}/>} {inicial ? 'Guardar' : para ? 'Añadir' : 'Añadir mi tema'}</Btn>
      </div>
    </form>
  );
}

// El administrador mete los temas que le pasan por el grupo (de gente con cuenta o sin ella)
function AdminAporte({ pl, i, gente, recargar }) {
  const [abierto, setAbierto] = useState(false);
  const [quien, setQuien] = useState('');
  const [apodo, setApodo] = useState('');
  if (!abierto) return <button className="pl-add admin" onClick={() => setAbierto(true)}><Users size={14}/> Añadir el de otra persona</button>;
  const para = quien === '@' ? (apodo.trim() ? '@' + apodo.trim().replace(/^@/, '') : '') : quien;
  return (
    <div className="pl-admin-add">
      <div className="pl-form-row" style={{ gap: 8 }}>
        <select className="field-input field-select" value={quien} onChange={e => setQuien(e.target.value)} aria-label="Persona">
          <option value="">¿De quién es?</option>
          {gente.map(g => <option key={g.user} value={g.user}>{g.display}{g.pending ? ' (sin reclamar)' : ''}</option>)}
          <option value="@">Otra persona sin cuenta…</option>
        </select>
        {quien === '@' && <input className="field-input" placeholder="Su apodo (p. ej. mario64)" value={apodo} onChange={e => setApodo(e.target.value)}/>}
      </div>
      {para ? <AporteForm pl={pl} i={i} para={para} onDone={() => { setAbierto(false); setQuien(''); setApodo(''); recargar(); }} onCancel={() => setAbierto(false)}/>
        : <Btn variant="ghost" size="sm" onClick={() => setAbierto(false)}>Cancelar</Btn>}
    </div>
  );
}
