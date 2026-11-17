import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, Search, Gamepad2, Monitor, Trophy, ArrowLeft, Heart, Lock, BookOpen, Check, X, ArrowLeftRight, Copy, Link2 } from 'lucide-react';
import { PageHeader, EmptyState, Btn, SkeletonList } from '../components/ui/index';
import GameCard from '../components/GameCard';
import { firstImg, parseImgs, imgSrc } from '../utils/imgSrc';
import { fmtHours } from '../utils/hltb';
import { useAccount, fetchUsers, fetchView, fetchPending } from './account';
import { Avatar, LoginForm } from './ui';
import { indexCreditos, findCredito, estrellas, ESTADO_CF } from './creditos';
import { normalize } from '../core/text';

const hace = iso => {
  if (!iso) return 'sin colección todavía';
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return 'actualizada hoy';
  if (d < 2) return 'actualizada ayer';
  if (d < 31) return `actualizada hace ${Math.floor(d)} días`;
  return 'actualizada el ' + new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Lo que se ve en las páginas de comunidad cuando no hay sesión (o no hay servidor) */
export function NeedAccount({ titulo = 'Comunidad' }) {
  const { ready, available } = useAccount();
  return (
    <div className="page">
      <PageHeader title={titulo}/>
      {!ready ? <SkeletonList n={3}/> : !available ? (
        <EmptyState icon={<Users size={52}/>} title="Sin servidor de cuentas"
          description="Esta copia de GameVault no está conectada a ningún servidor. La comunidad funciona cuando la app se sirve desde un servidor con cuentas."/>
      ) : (
        <div className="gv-need">
          <Users size={40}/>
          <h3>Entra para ver a la gente</h3>
          <p>Con una cuenta ves las colecciones de los demás, quién tiene cada juego y a quién se lo ha prestado.</p>
          <LoginForm compact/>
        </div>
      )}
    </div>
  );
}

// ── La gente ──────────────────────────────────────────────────────────────────
export default function ComunidadPage() {
  const { me } = useAccount();
  const nav = useNavigate();
  const [gente, setGente] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { if (me) fetchUsers().then(setGente).catch(e => setErr(e.message)); }, [me]);
  if (!me) return <NeedAccount/>;
  const lista = (gente || []).filter(g => !q || normalize(g.display + ' ' + g.user).includes(normalize(q)));
  return (
    <div className="page">
      <PageHeader title="Comunidad" subtitle={gente ? `${gente.length} persona${gente.length !== 1 ? 's' : ''} · pulsa en alguien para ver su colección` : ''}
        actions={<Btn variant="secondary" onClick={() => nav('/prestamos')}><ArrowLeftRight size={15}/> Zona de préstamos</Btn>}/>
      {gente && gente.length > 6 && (
        <div className="search-wrap" style={{ maxWidth: 320, marginBottom: 18 }}>
          <Search size={14} className="search-icon"/>
          <input className="field-input search-input" placeholder="Buscar a alguien…" value={q} onChange={e => setQ(e.target.value)}/>
        </div>
      )}
      {err ? <p className="gv-error">{err}</p> : !gente ? <SkeletonList n={4} h={90}/> : (
        <div className="gv-people">
          {lista.map(g => (
            <button key={g.user} className={'gv-person' + (g.user === me.user ? ' yo' : '')} onClick={() => nav('/comunidad/' + g.user)}>
              <Avatar user={g} size={64}/>
              <div className="gv-person-info">
                <div className="gv-person-name">{g.display}{g.user === me.user && <span className="badge badge-accent">Tú</span>}{g.pending && <span className="gv-pend-badge">sin cuenta</span>}</div>
                {g.bio && <div className="gv-person-bio">{g.bio}</div>}
                <div className="gv-person-nums">
                  <span><Gamepad2 size={13}/> <b>{g.juegos}</b> juegos</span>
                  <span><Monitor size={13}/> <b>{g.plataformas}</b> consolas</span>
                  {g.terminados > 0 && <span title="Juegos terminados en Créditos Finales"><Trophy size={13}/> <b>{g.terminados}</b> terminados</span>}
                </div>
                <div className="gv-person-upd">{g.pending ? 'de la tabla de préstamos · aún no se ha unido' : hace(g.updatedAt)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {me.admin && <PendientesAdmin/>}
    </div>
  );
}

// Administración: enlaces para que cada colega reclame la colección que se cargó a su nombre
function PendientesAdmin() {
  const [l, setL] = useState(null);
  const [copiado, setCopiado] = useState('');
  useEffect(() => { fetchPending().then(setL).catch(() => setL([])); }, []);
  if (!l || !l.length) return null;
  const copiar = async x => { try { await navigator.clipboard.writeText(x.link); setCopiado(x.id); setTimeout(() => setCopiado(''), 2000); } catch { window.prompt('Copia el enlace:', x.link); } };
  return (
    <div className="gv-admin">
      <p className="section-title"><Link2 size={13} style={{ verticalAlign: -2 }}/> Perfiles por reclamar <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(solo lo ves tú)</span></p>
      <p className="gv-muted" style={{ marginBottom: 8 }}>Manda a cada uno su enlace. Al abrirlo entran o se crean la cuenta y sus juegos pasan a su colección.{l.some(x => x.suggest) && ' A los que ya tienen cuenta les sale el aviso solo.'}</p>
      {l.map(x => (
        <div key={x.id} className="gv-admin-row">
          <Avatar user={{ user: x.id, display: x.display }} size={30}/>
          <b style={{ minWidth: 150 }}>{x.display}</b>
          <span className="gv-muted">{x.juegos} juegos{x.suggest ? ` · aviso a @${x.suggest}` : ''}</span>
          <code>{x.link}</code>
          <Btn size="sm" variant="secondary" onClick={() => copiar(x)}>{copiado === x.id ? <><Check size={13}/> Copiado</> : <><Copy size={13}/> Copiar</>}</Btn>
        </div>
      ))}
    </div>
  );
}

// ── La colección de otra persona (solo lectura) ───────────────────────────────
const ORDEN = { nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'), reciente: (a, b) => String(b.fechaAdquisicion || '').localeCompare(String(a.fechaAdquisicion || '')), lanzamiento: (a, b) => String(a.fechaLanzamiento || '9').localeCompare(String(b.fechaLanzamiento || '9')) };

export function PerfilPage() {
  const { user } = useParams();
  const { me } = useAccount();
  const nav = useNavigate();
  const [v, setV] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('juegos');
  const [q, setQ] = useState('');
  const [plat, setPlat] = useState('');
  const [orden, setOrden] = useState('nombre');
  const [soloLibres, setSoloLibres] = useState(false);
  const [sel, setSel] = useState(null);

  useEffect(() => { setV(null); setErr(''); setQ(''); setPlat(''); setTab('juegos'); if (me) fetchView(user).then(setV).catch(e => setErr(e.message)); }, [user, me]);

  const d = v?.data;
  const platPorId = useMemo(() => Object.fromEntries((d?.plataformas || []).map(p => [p.id, p])), [d]);
  const cfIdx = useMemo(() => indexCreditos(v?.creditos), [v]);
  const juegos = useMemo(() => {
    if (!d) return [];
    const nq = normalize(q);
    return d.juegos
      .map(j => ({ ...j, plataformaNombre: platPorId[j.plataformaId]?.nombre || '' }))
      .filter(j => (!plat || String(j.plataformaId) === plat) && (!nq || normalize(j.nombre + ' ' + (j.tituloOriginal || '')).includes(nq)) && (!soloLibres || !j.prestadoA))
      .sort(ORDEN[orden]);
  }, [d, q, plat, orden, soloLibres, platPorId]);

  if (!me) return <NeedAccount/>;
  if (err) return <div className="page"><button className="gv-back" onClick={() => nav('/comunidad')}><ArrowLeft size={15}/> Comunidad</button><EmptyState icon={<Users size={52}/>} title="No se pudo cargar" description={err}/></div>;
  if (!v) return <div className="page"><SkeletonList n={5}/></div>;

  const esYo = v.user === me.user;
  const terminados = (v.creditos || []).filter(c => c.e === 'terminado');
  const nPorPlat = {}; for (const j of d.juegos) nPorPlat[j.plataformaId] = (nPorPlat[j.plataformaId] || 0) + 1;
  const tabs = [['juegos', `Juegos (${d.juegos.length})`], ['consolas', `Consolas (${d.plataformas.length})`]];
  if (v.privacy?.deseos !== false && d.deseos.length) tabs.push(['deseos', `Deseos (${d.deseos.length})`]);
  if (terminados.length) tabs.push(['terminados', `Terminados (${terminados.length})`]);

  return (
    <div className="page">
      <button className="gv-back" onClick={() => nav('/comunidad')}><ArrowLeft size={15}/> Comunidad</button>
      <div className="gv-perfil-head">
        <Avatar user={v} size={88}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title">{v.display}</h1>
          {v.bio && <p className="gv-perfil-bio">{v.bio}</p>}
          <p className="gv-muted">{v.pending ? <span className="gv-pend-badge">sin cuenta</span> : hace(v.updatedAt)} · <Lock size={11} style={{ verticalAlign: -1 }}/> solo lectura{esYo && ' · así ven los demás tu colección'}</p>
        </div>
      </div>

      <div className="seg gv-tabs">
        {tabs.map(([k, l]) => <button key={k} className={'seg-btn' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'juegos' && (<>
        <div className="filter-bar">
          <div className="field" style={{ flex: '1 1 220px' }}>
            <div className="search-wrap">
              <Search size={14} className="search-icon"/>
              <input className="field-input search-input" placeholder={`Buscar en la colección de ${v.display}…`} value={q} onChange={e => setQ(e.target.value)}/>
            </div>
          </div>
          <select className="field-input field-select" style={{ width: 'auto', minWidth: 160 }} value={plat} onChange={e => setPlat(e.target.value)} aria-label="Consola">
            <option value="">Todas las consolas</option>
            {d.plataformas.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(p => <option key={p.id} value={p.id}>{p.nombre} ({nPorPlat[p.id] || 0})</option>)}
          </select>
          <select className="field-input field-select" style={{ width: 'auto' }} value={orden} onChange={e => setOrden(e.target.value)} aria-label="Orden">
            <option value="nombre">Por nombre</option><option value="reciente">Últimas compras</option><option value="lanzamiento">Por lanzamiento</option>
          </select>
          <label className={'gv-check' + (soloLibres ? ' on' : '')}><input type="checkbox" checked={soloLibres} onChange={e => setSoloLibres(e.target.checked)}/> Solo los que tiene en casa</label>
        </div>
        {juegos.length === 0
          ? <EmptyState icon={<Gamepad2 size={52}/>} title={d.juegos.length ? 'Sin resultados' : 'Aún no tiene juegos'} description={d.juegos.length ? 'Prueba con otra búsqueda.' : ''}/>
          : <div className="gcard-grid">{juegos.map(j => <GameCard key={j.id} juego={j} showPlat={!plat} credito={findCredito(cfIdx, j)} onClick={() => setSel(j)}/>)}</div>}
      </>)}

      {tab === 'consolas' && (
        <div className="plat-grid">
          {d.plataformas.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(p => {
            const img = firstImg(p.imagenes);
            return (
              <div key={p.id} className="plat-card" onClick={() => { setPlat(String(p.id)); setTab('juegos'); }}>
                <div className="plat-card-top con-foto"><div className={'plat-foto' + (String(img).includes('/consolas/') ? ' plat-foto-consola' : '')}>{img ? <img src={img} alt=""/> : <Monitor size={30} style={{ color: 'var(--text-3)' }}/>}</div></div>
                <div className="plat-name">{p.nombre}</div>
                <div className="plat-marca">{[p.marca, p.modelo].filter(Boolean).join(' · ') || '—'}</div>
                <div className="plat-juegos"><Gamepad2 size={13}/> <strong>{nPorPlat[p.id] || 0}</strong> juegos{p.unidades > 1 && <span className="plat-uds">×{p.unidades}</span>}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'deseos' && (
        <div className="gv-wishes">
          {d.deseos.map(w => (
            <div key={w.id} className="gv-wish">
              {firstImg(w.imagenes) ? <img src={firstImg(w.imagenes)} alt="" loading="lazy"/> : <div className="gv-wish-noimg"><Heart size={20}/></div>}
              <div><b>{w.nombre}</b><small>{[w.plataforma, w.precioEstimado ? `~${Number(w.precioEstimado).toFixed(0)} €` : null].filter(Boolean).join(' · ')}</small>{w.notas && <p>{w.notas}</p>}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'terminados' && (
        <div className="gv-done">
          {terminados.slice().sort((a, b) => String(b.d || b.y).localeCompare(String(a.d || a.y))).map((c, i) => (
            <div key={i} className="gv-done-row">
              <span className="gv-done-y">{c.y}</span>
              <div style={{ flex: 1, minWidth: 0 }}><b>{c.t}</b>{c.c && <p>{c.c}</p>}</div>
              <span className="jp-cf-stars">{estrellas(c.r)}</span>
              <span className="gv-done-h">{c.h ? String(c.h).replace('.', ',') + ' h' : ''}</span>
            </div>
          ))}
        </div>
      )}

      {sel && <JuegoLectura juego={sel} plat={platPorId[sel.plataformaId]} credito={findCredito(cfIdx, sel)} dueno={v} onClose={() => setSel(null)}/>}
    </div>
  );
}

// Ficha de un juego ajeno: se mira, no se toca
function JuegoLectura({ juego, plat, credito, dueno, onClose }) {
  const imgs = parseImgs(juego.imagenes);
  const [i, setI] = useState(0);
  useEffect(() => { const fn = e => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', fn); return () => document.removeEventListener('keydown', fn); }, [onClose]);
  const fila = (l, val) => (val ? <div className="gv-jl-row"><span>{l}</span><b>{val}</b></div> : null);
  const fechaEs = f => (f ? f.split('-').reverse().join('/') : null);
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box gv-jl">
        <button className="modal-close gv-jl-x" onClick={onClose}><X size={18}/></button>
        {imgs.length > 0 && (
          <div className="gv-jl-img">
            <img src={imgSrc(imgs[i])} alt={juego.nombre}/>
            {imgs.length > 1 && <div className="gv-jl-thumbs">{imgs.map((s, k) => <img key={k} src={imgSrc(s)} alt="" className={k === i ? 'on' : ''} onClick={() => setI(k)}/>)}</div>}
          </div>
        )}
        <div className="gv-jl-body">
          <h2>{juego.nombre}</h2>
          <p className="gv-muted">{[plat?.nombre, juego.desarrolladora, (juego.fechaLanzamiento || '').slice(0, 4)].filter(Boolean).join(' · ')}</p>
          <div className="gv-jl-owner">
            <Avatar user={dueno} size={28}/>
            {juego.prestadoA
              ? <span className="gv-jl-out"><BookOpen size={13}/> Es de {dueno.display}, pero ahora lo tiene <b>{juego.prestadoA}</b>{juego.fechaPrestamo ? ` (desde el ${fechaEs(juego.fechaPrestamo)})` : ''}</span>
              : <span className="gv-jl-in"><Check size={13}/> {dueno.display} lo tiene en casa{juego.estado === 'Digital' ? ' (digital)' : ''}</span>}
          </div>
          {credito && (
            <div className={'jp-cf jp-cf-' + credito.e} style={{ margin: '12px 0 0' }}>
              <div className="jp-cf-head"><Trophy size={15}/><b>{credito.e === 'terminado' ? `${dueno.display} se lo pasó${credito.y ? ' en ' + credito.y : ''}` : ESTADO_CF[credito.e]?.txt}</b></div>
              {credito.e === 'terminado' && <div className="jp-cf-nums">{credito.r != null && <span className="jp-cf-stars">{estrellas(credito.r)}</span>}{credito.h ? <span>{String(credito.h).replace('.', ',')} h</span> : null}</div>}
              {credito.c && <p className="jp-cf-com">{credito.c}</p>}
            </div>
          )}
          <div className="gv-jl-rows">
            {fila('Género', juego.genero)}
            {fila('Estado', juego.estado)}
            {fila('Región', juego.region)}
            {fila('Unidades', juego.unidades > 1 ? juego.unidades : null)}
            {fila('Lanzamiento', fechaEs(juego.fechaLanzamiento))}
            {fila('Lo tiene desde', fechaEs(juego.fechaAdquisicion))}
            {fila('Le costó', juego.precio ? `${Number(juego.precio).toFixed(2)} €` : null)}
            {fila('Su nota', juego.valoracion ? `${juego.valoracion}/10` : null)}
            {fila('Duración', juego.hltbMain > 0 ? `${fmtHours(juego.hltbMain)} historia${juego.hltbComplete > 0 ? ` · ${fmtHours(juego.hltbComplete)} al 100%` : ''}` : null)}
          </div>
          {juego.comentarios && <p className="gv-jl-com">«{juego.comentarios}»</p>}
        </div>
      </div>
    </div>
  );
}
