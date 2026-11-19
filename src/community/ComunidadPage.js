import HistorialPrestamos from '../components/HistorialPrestamos';
import React, { useEffect, useMemo, useState } from 'react';
import { useCollapse, GroupHead, CollapseAll } from '../utils/useCollapse';
import { claveJuego, claveConsola } from './claves';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, Search, Gamepad2, Monitor, Trophy, ArrowLeft, Heart, Lock, BookOpen, Check, X, ArrowLeftRight, Copy, Link2, Hand, Archive, Download } from 'lucide-react';
import { PageHeader, EmptyState, Btn, SkeletonList } from '../components/ui/index';
import GameCard from '../components/GameCard';
import { firstImg, parseImgs, thumb } from '../utils/imgSrc';
import { fmtHours } from '../utils/hltb';
import { useAccount, fetchUsers, fetchView, fetchPending, pedirJuego, fetchBackups, backupNow, descargarBackup } from './account';
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
      {me.admin && <CopiasAdmin/>}
    </div>
  );
}

// Administración: copias de seguridad del servidor (cada semana se hace una sola; se guardan 8)
function CopiasAdmin() {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const cargar = () => fetchBackups().then(setSt).catch(e => setErr(e.message));
  useEffect(() => { cargar(); }, []);
  const ahora = async () => { setBusy(true); setErr(''); try { await backupNow(); await cargar(); } catch (e) { setErr(e.message); } setBusy(false); };
  const kb = b => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  if (!st && !err) return null;
  return (
    <div className="gv-admin">
      <p className="section-title"><Archive size={13} style={{ verticalAlign: -2 }}/> Copias de seguridad <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(solo lo ves tú)</span></p>
      <p className="gv-muted" style={{ marginBottom: 8 }}>Cada semana se guarda sola una copia de las colecciones de todo el mundo (y de préstamos, peticiones y perfiles por reclamar). Se conservan las 8 últimas{st?.carpeta ? <> en <code>{st.carpeta}</code></> : ''}.</p>
      {err && <p className="gv-error">{err}</p>}
      {st && st.copias.map(c => (
        <div key={c.nombre} className="gv-admin-row">
          <Archive size={16} style={{ color: 'var(--text-3)' }}/>
          <b style={{ minWidth: 170 }}>{new Date(c.fecha).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</b>
          <span className="gv-muted" style={{ flex: 1 }}>{c.nombre} · {kb(c.bytes)}</span>
          <Btn size="sm" variant="secondary" onClick={() => descargarBackup(c.nombre).catch(e => setErr(e.message))}><Download size={13}/> Descargar</Btn>
        </div>
      ))}
      {st && !st.copias.length && <p className="gv-muted">Todavía no hay ninguna copia.</p>}
      <Btn size="sm" style={{ marginTop: 10 }} onClick={ahora} disabled={busy}>{busy ? 'Copiando…' : 'Hacer una copia ahora'}</Btn>
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
  const [cruce, setCruce] = useState('todo');            // todo | comun | suyo | mio — comparar con mi colección
  const [mios, setMios] = useState([]);                  // mis juegos (de este aparato) con su consola
  useEffect(() => {
    const a = window.api; if (!a) return;
    Promise.all([a.juegos.getAll({}), a.plataformas.getAll()]).then(([js, ps]) => {
      const pn = Object.fromEntries(ps.map(p => [p.id, p])); setMios(js.map(j => ({ ...j, plataformaNombre: pn[j.plataformaId]?.nombre || '', _plat: pn[j.plataformaId] })));
    }).catch(() => {});
  }, []);

  useEffect(() => { setV(null); setErr(''); setQ(''); setPlat(''); setTab('juegos'); setCruce('todo'); if (me) fetchView(user).then(setV).catch(e => setErr(e.message)); }, [user, me]);

  const d = v?.data;
  const platPorId = useMemo(() => Object.fromEntries((d?.plataformas || []).map(p => [p.id, p])), [d]);
  const cfIdx = useMemo(() => indexCreditos(v?.creditos), [v]);
  // Juegos en común: misma consola y mismo juego (aunque esté escrito distinto)
  const kj = j => claveConsola(j.plataformaNombre) + '|' + claveJuego(j.nombre);
  const misClaves = useMemo(() => new Set(mios.map(kj)), [mios]); // eslint-disable-line react-hooks/exhaustive-deps
  const suyos = useMemo(() => (d ? d.juegos.map(j => ({ ...j, plataformaNombre: platPorId[j.plataformaId]?.nombre || '' })) : []), [d, platPorId]);
  const susClaves = useMemo(() => new Set(suyos.map(kj)), [suyos]); // eslint-disable-line react-hooks/exhaustive-deps
  const nCruce = useMemo(() => ({
    comun: suyos.filter(j => misClaves.has(kj(j))).length,
    suyo: suyos.filter(j => !misClaves.has(kj(j))).length,
    mio: mios.filter(j => !susClaves.has(kj(j))).length,
  }), [suyos, mios, misClaves, susClaves]); // eslint-disable-line react-hooks/exhaustive-deps
  const juegos = useMemo(() => {
    if (!d) return [];
    const nq = normalize(q);
    const base = cruce === 'mio' ? mios.filter(j => !susClaves.has(kj(j))).map(j => ({ ...j, _mio: true }))
      : cruce === 'comun' ? suyos.filter(j => misClaves.has(kj(j)))
      : cruce === 'suyo' ? suyos.filter(j => !misClaves.has(kj(j))) : suyos;
    return base
      .filter(j => (!plat || cruce === 'mio' || String(j.plataformaId) === plat) && (!nq || normalize(j.nombre + ' ' + (j.tituloOriginal || '')).includes(nq)) && (!soloLibres || !j.prestadoA))
      .sort(ORDEN[orden]);
  }, [d, q, plat, orden, soloLibres, suyos, mios, cruce, misClaves, susClaves]); // eslint-disable-line react-hooks/exhaustive-deps
  const pleg = useCollapse('perfil');
  const grupos = useMemo(() => {
    const m = new Map();
    // por nombre de consola: así vale igual para sus juegos y para los míos («Solo yo»)
    for (const j of juegos) { const k = j.plataformaNombre || 'Sin consola'; if (!m.has(k)) m.set(k, []); m.get(k).push(j); }
    return [...m.entries()].map(([nombre, js]) => { const p = js[0]._mio ? js[0]._plat : platPorId[js[0].plataformaId]; return { id: nombre, nombre, img: p ? firstImg(p.imagenes) : null, juegos: js }; })
      .sort((a, b) => b.juegos.length - a.juegos.length);
  }, [juegos, platPorId]);

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
        {!esYo && mios.length > 0 && (
          <div className="seg gv-cruce" role="group" aria-label="Comparar con mi colección">
            {[['todo', 'Toda su colección', suyos.length], ['comun', 'En común', nCruce.comun], ['suyo', 'Solo tiene ' + (v.display.split(' ')[0]), nCruce.suyo], ['mio', 'Solo tengo yo', nCruce.mio]].map(([k, l, n]) => (
              <button key={k} className={'seg-btn' + (cruce === k ? ' active' : '')} onClick={() => setCruce(k)}>{l} <span className="lz-n">{n}</span></button>
            ))}
          </div>
        )}
        <div className="filter-bar">
          <div className="field" style={{ flex: '1 1 220px' }}>
            <div className="search-wrap">
              <Search size={14} className="search-icon"/>
              <input className="field-input search-input" placeholder={`Buscar en la colección de ${v.display}…`} value={q} onChange={e => setQ(e.target.value)}/>
            </div>
          </div>
          <select className="field-input field-select" style={{ width: 'auto', minWidth: 160 }} value={plat} onChange={e => setPlat(e.target.value)} aria-label="Consola" disabled={cruce === 'mio'}>
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
          : plat && cruce !== 'mio' ? <div className="gcard-grid">{juegos.map(j => <GameCard key={j.id} juego={j} credito={findCredito(cfIdx, j)} onClick={() => setSel(j)}/>)}</div>
          : (<>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}><CollapseAll ids={grupos.map(g => g.id)} c={pleg}/></div>
            {grupos.map(g => (
              <div key={g.id} style={{ marginBottom: pleg.isClosed(g.id) ? 4 : 24 }}>
                <GroupHead closed={pleg.isClosed(g.id)} onToggle={() => pleg.toggle(g.id)}>{g.img && <img src={g.img} alt=""/>}{g.nombre} <span className="grp-n">({g.juegos.length})</span></GroupHead>
                {!pleg.isClosed(g.id) && <div className="gcard-grid">{g.juegos.map(j => j._mio
                  ? <GameCard key={'m' + j.id} juego={j} onClick={() => nav(`/plataformas/${j.plataformaId}`)}/>
                  : <GameCard key={j.id} juego={j} credito={findCredito(cfIdx, j)} onClick={() => setSel(j)}/>)}</div>}
              </div>
            ))}
          </>)}
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
  const { me } = useAccount();
  const [pedido, setPedido] = useState('');
  const puedePedir = me && dueno.user !== me.user && !juego.prestadoA && juego.estado !== 'Digital';
  const pedir = async () => { setPedido('…'); try { await pedirJuego(dueno.user, juego.id); setPedido('ok'); } catch (e) { setPedido(e.message); } };
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box gv-jl">
        <button className="modal-close gv-jl-x" onClick={onClose}><X size={18}/></button>
        {imgs.length > 0 && (
          <div className="gv-jl-img">
            <img src={thumb(imgs[i], 1280)} alt={juego.nombre}/>
            {imgs.length > 1 && <div className="gv-jl-thumbs">{imgs.map((s, k) => <img key={k} src={thumb(s, 200)} alt="" className={k === i ? 'on' : ''} onClick={() => setI(k)}/>)}</div>}
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
            {puedePedir && (pedido === 'ok'
              ? <span className="gv-jl-pedido"><Check size={13}/> Pedido</span>
              : <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} disabled={pedido === '…'} onClick={pedir}><Hand size={13}/> Pedírselo</button>)}
          </div>
          {pedido && pedido !== 'ok' && pedido !== '…' && <p className="gv-error">{pedido}</p>}
          <HistorialPrestamos raw={juego.historialPrestamos} compacto/>
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
