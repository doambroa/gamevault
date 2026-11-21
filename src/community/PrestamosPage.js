import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, ArrowLeftRight, Gamepad2, Check, RefreshCw, ChevronDown, Undo2, Users, Hand, X, LayoutGrid, Rows3, Inbox, BellRing, Copy, Clock3, Heart } from 'lucide-react';
import { useCollapse, GroupHead, CollapseAll } from '../utils/useCollapse';
import { PageHeader, EmptyState, SkeletonList, Btn } from '../components/ui/index';
import { thumb } from '../utils/imgSrc';
import { normalize } from '../core/text';
import { claveJuego, mismaConsola } from './claves';
import { claveConsola, imagenPorNombre } from '../data/consolas';
import { useAccount, fetchLoans, pushNow, recordarPrestamo, useRequests, refreshRequests, pedirJuego, cancelarPeticion, contestarPeticion } from './account';
import { Avatar, PrestarModal } from './ui';
import { NeedAccount } from './ComunidadPage';

const api = window.api;
const fechaEs = f => (f ? f.split('-').reverse().join('/') : '');
const masComun = lista => { const c = {}; let best = lista[0]; for (const x of lista) { c[x] = (c[x] || 0) + 1; if (c[x] > c[best]) best = x; } return best; };

/* Junta los juegos de todo el mundo: consola → juego → copias (una por dueño).
 * Así «Metroid Dread» sale una sola vez con las tres personas que lo tienen, en vez de tres filas. */
function agrupar(gente) {
  const plats = new Map();
  for (const p of gente) {
    for (const j of p.juegos) {
      const pk = claveConsola(j.p);
      if (!plats.has(pk)) plats.set(pk, { clave: pk, nombres: [], juegos: new Map() });
      const P = plats.get(pk); P.nombres.push(j.p || 'Sin consola');
      const jk = claveJuego(j.n);
      if (!P.juegos.has(jk)) P.juegos.set(jk, { clave: pk + '|' + jk, nombres: [], img: null, copias: [] });
      const J = P.juegos.get(jk); J.nombres.push(j.n); if (!J.img && j.i) J.img = j.i;
      J.copias.push({ dueno: p, id: j.id, digital: j.e === 'Digital', uds: j.u || 1, a: j.a || null, au: j.au || null, f: j.f || null });
    }
  }
  return [...plats.values()].map(P => ({
    clave: P.clave,
    nombre: masComun(P.nombres),
    img: imagenPorNombre(masComun(P.nombres)),
    juegos: [...P.juegos.values()].map(J => ({ ...J, nombre: masComun(J.nombres), norm: normalize(J.nombres.join(' ')) })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  })).sort((a, b) => b.juegos.length - a.juegos.length);
}

export default function PrestamosPage() {
  const { me } = useAccount();
  const nav = useNavigate();
  const [gente, setGente] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [plat, setPlat] = useState('');
  const [filtro, setFiltro] = useState('todos');       // todos | libres | prestados | faltan
  const [vista, setVista] = useState('juegos');         // juegos | movimientos
  const [abiertas, setAbiertas] = useState({});         // consolas desplegadas enteras
  const [prestar, setPrestar] = useState(null);         // juego mío (de la BD local)
  const [busy, setBusy] = useState(false);
  const [modo, setModoSt] = useState(() => { try { return localStorage.getItem('gv-prestamos-modo') || 'cuadricula'; } catch { return 'cuadricula'; } });
  const setModo = m => { setModoSt(m); try { localStorage.setItem('gv-prestamos-modo', m); } catch {} };
  const pleg = useCollapse('prestamos');
  const reqs = useRequests();
  const [pedir, setPedir] = useState(null);
  const [recordar, setRecordar] = useState(null);       // { J, c } préstamo mío al que mandar un recordatorio
  const [misDeseos, setMisDeseos] = useState([]);

  const load = useCallback(() => { refreshRequests(); api?.deseos?.getAll().then(setMisDeseos).catch(() => {}); return fetchLoans().then(g => { setGente(g); setErr(''); }).catch(e => setErr(e.message)); }, []);
  useEffect(() => { if (me) load(); }, [me, load]);

  const plats = useMemo(() => agrupar(gente || []), [gente]);
  const porUsuario = useMemo(() => Object.fromEntries((gente || []).map(g => [g.user, g])), [gente]);

  // Lista de deseos cruzada: lo que quiero y ya tiene alguien de la comunidad
  const deseados = useMemo(() => {
    if (!me) return [];
    const out = [];
    for (const d of misDeseos) {
      const k = claveJuego(d.nombre);
      for (const P of plats) {
        if (!mismaConsola(d.plataforma, P.nombre)) continue;
        for (const J of P.juegos) {
          if (!J.clave.endsWith('|' + k)) continue;
          const copias = J.copias.filter(c => c.dueno.user !== me.user);
          if (copias.length) out.push({ d, J, P, copias });
        }
      }
    }
    return out;
  }, [misDeseos, plats, me]);

  // Mis movimientos: lo que he dejado y lo que tengo de otros
  // Todos los préstamos en curso de la comunidad: la tabla «quién tiene el juego de quién»
  const movimientos = useMemo(() => {
    const m = [];
    for (const P of plats) for (const J of P.juegos) for (const c of J.copias) if (c.a) m.push({ J, P, c });
    return m.sort((x, y) => String(y.c.f || '').localeCompare(String(x.c.f || '')) || x.J.nombre.localeCompare(y.J.nombre, 'es'));
  }, [plats]);
  const { dejados, recibidos } = useMemo(() => {
    const dej = [], rec = [];
    if (me) for (const P of plats) for (const J of P.juegos) for (const c of J.copias) {
      if (c.dueno.user === me.user && c.a) dej.push({ J, P, c });
      if (c.au === me.user && c.dueno.user !== me.user) rec.push({ J, P, c });
    }
    const viejo = (a, b) => String(a.c.f || '9').localeCompare(String(b.c.f || '9'));   // lo que más tiempo lleva fuera, primero
    return { dejados: dej.sort(viejo), recibidos: rec.sort(viejo) };
  }, [plats, me]);

  if (!me) return <NeedAccount titulo="Zona de préstamos"/>;

  // Tras tocar un juego mío: subirlo ya y volver a pedir la zona
  const trasCambio = async () => { setBusy(true); try { await pushNow(); } catch {} await load(); setBusy(false); };
  const abrirPrestar = async c => { const j = await api.juegos.getById(c.id); if (j) setPrestar(j); };
  const devolver = async c => { await api.juegos.devolver(c.id); trasCambio(); };
  // Lo que ya he pedido y está sin contestar: dueño|idJuego → petición
  const pedidas = Object.fromEntries((reqs.enviadas || []).filter(r => r.estado === 'pendiente').map(r => [r.to + '|' + r.juegoId, r]));
  const contestar = async (r, ok) => { setBusy(true); try { await contestarPeticion(r, ok); } catch (e) { alert(e.message); } await load(); setBusy(false); };
  const accionesCopia = (c, J) => ({
    mia: c.dueno.user === me.user, pedida: pedidas[c.dueno.user + '|' + c.id],
    onPrestar: () => abrirPrestar(c), onDevolver: () => devolver(c), onPerfil: u => nav('/comunidad/' + u),
    onPedir: () => setPedir({ c, J }), onCancelar: r => cancelarPeticion(r.id),
  });

  const nq = normalize(q);
  const pasa = J => {
    if (nq && !J.norm.includes(nq)) return false;
    if (filtro === 'libres') return J.copias.some(c => !c.a && !c.digital && c.dueno.user !== me.user);
    if (filtro === 'prestados') return J.copias.some(c => c.a);
    if (filtro === 'faltan') return !J.copias.some(c => c.dueno.user === me.user);
    return true;
  };
  const visibles = plats.filter(P => !plat || P.clave === plat).map(P => ({ ...P, lista: P.juegos.filter(pasa) })).filter(P => P.lista.length);
  const total = plats.reduce((n, P) => n + P.juegos.length, 0);
  const acotado = !!(plat || nq || filtro !== 'todos');

  return (
    <div className="page">
      <PageHeader title="Zona de préstamos"
        subtitle={gente ? `${total} juegos distintos entre ${gente.length} persona${gente.length !== 1 ? 's' : ''} · mira quién tiene qué y quién se lo ha dejado a quién` : ''}
        actions={<>
          <Btn variant="ghost" size="sm" onClick={() => { setBusy(true); load().finally(() => setBusy(false)); }} disabled={busy}><RefreshCw size={14} className={busy ? 'spin' : ''}/> Actualizar</Btn>
          <Btn variant="secondary" onClick={() => nav('/comunidad')}><Users size={15}/> La gente</Btn>
        </>}/>

      {err ? <p className="gv-error">{err}</p> : !gente ? <SkeletonList n={5}/> : total === 0 ? (
        <EmptyState icon={<ArrowLeftRight size={52}/>} title="Todavía no hay juegos" description="En cuanto alguien con cuenta tenga juegos en su colección aparecerán aquí."/>
      ) : (<>
        <Peticiones reqs={reqs} busy={busy} onContestar={contestar} onCancelar={r => cancelarPeticion(r.id)}/>

        {deseados.length > 0 && (
          <div className="lz-deseos">
            <p className="section-title"><Heart size={13} style={{ verticalAlign: -2 }}/> De tu lista de deseos <span>({deseados.length} {deseados.length === 1 ? 'juego lo tiene' : 'juegos los tiene'} alguien)</span></p>
            {deseados.map(({ d, J, P, copias }) => (
              <div key={d.id + J.clave} className="lz-deseo">
                <Cover img={J.img}/>
                <div className="lz-mio-info"><b>{J.nombre}</b><small>{P.nombre}</small></div>
                <div className="lz-copias">{copias.map((c, i) => <Copia key={i} c={c} porUsuario={porUsuario} busy={busy} {...accionesCopia(c, J)}/>)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Mis préstamos, de un vistazo */}
        {(dejados.length > 0 || recibidos.length > 0) && (
          <div className="lz-mios">
            <div className="lz-mios-col">
              <p className="section-title">He prestado <span>({dejados.length})</span></p>
              {dejados.length === 0 && <p className="gv-muted">Tienes todos tus juegos en casa.</p>}
              {dejados.map(({ J, P, c }) => (
                <div key={J.clave} className="lz-mio">
                  <Cover img={J.img}/>
                  <div className="lz-mio-info"><b>{J.nombre}</b><small>{P.nombre}</small>
                    <span className="lz-flecha"><ArrowRight size={12}/> <Quien c={c} porUsuario={porUsuario}/>{c.f && <em> · desde el {fechaEs(c.f)}</em>}</span>
                    <Tiempo f={c.f}/>
                  </div>
                  <div className="lz-mio-btns">
                    <button className="btn btn-ghost btn-sm" onClick={() => setRecordar({ J, c })} title="Recordarle que te lo devuelva"><BellRing size={13}/> Recordar</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => devolver(c)} disabled={busy}><Undo2 size={13}/> Devuelto</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="lz-mios-col">
              <p className="section-title">Tengo de otros <span>({recibidos.length})</span></p>
              {recibidos.length === 0 && <p className="gv-muted">Ahora mismo nadie te ha dejado nada.</p>}
              {recibidos.map(({ J, P, c }) => (
                <div key={J.clave + c.dueno.user} className="lz-mio">
                  <Cover img={J.img}/>
                  <div className="lz-mio-info"><b>{J.nombre}</b><small>{P.nombre}</small>
                    <span className="lz-flecha">es de <Avatar user={c.dueno} size={18}/> {c.dueno.display}{c.f && <em> · desde el {fechaEs(c.f)}</em>}</span>
                    <Tiempo f={c.f} mio={false}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="seg gv-tabs">
          <button className={'seg-btn' + (vista === 'juegos' ? ' active' : '')} onClick={() => setVista('juegos')}><Gamepad2 size={14}/> Quién tiene cada juego</button>
          <button className={'seg-btn' + (vista === 'movimientos' ? ' active' : '')} onClick={() => setVista('movimientos')}><ArrowLeftRight size={14}/> Préstamos en curso <span className="lz-n">{movimientos.length}</span></button>
        </div>

        {vista === 'movimientos' && (
          movimientos.length === 0 ? <EmptyState icon={<ArrowLeftRight size={52}/>} title="Nadie tiene nada de nadie" description="Cuando alguien preste un juego aparecerá aquí."/> : (
          <div className="lz-mov">
            {movimientos.map(({ J, P, c }, i) => (
              <div key={i} className="lz-mov-row">
                <Cover img={J.img}/>
                <div className="lz-mov-juego"><b>{J.nombre}</b><small>{P.nombre}</small></div>
                <button className="lz-mov-p" onClick={() => nav('/comunidad/' + c.dueno.user)} title={`Ver la colección de ${c.dueno.display}`}><Avatar user={c.dueno} size={26}/><span>{c.dueno.user === me.user ? 'Tú' : c.dueno.display}</span></button>
                <ArrowRight size={16} className="lz-mov-arrow"/>
                <span className="lz-mov-p">{c.au && porUsuario[c.au] ? <><Avatar user={porUsuario[c.au]} size={26}/><span>{c.au === me.user ? 'Tú' : porUsuario[c.au].display}</span></> : <span className="lz-mov-libre">{c.a}</span>}</span>
                <span className="lz-mov-f">{c.f ? 'desde el ' + fechaEs(c.f) : ''}</span>
                {c.dueno.user === me.user && <button className="btn btn-secondary btn-sm" onClick={() => devolver(c)} disabled={busy}><Undo2 size={13}/> Devuelto</button>}
              </div>
            ))}
          </div>)
        )}

        {vista === 'juegos' && <>
        {/* Buscar y acotar */}
        <div className="lz-filtros">
          <div className="search-wrap" style={{ flex: '1 1 240px' }}>
            <Search size={14} className="search-icon"/>
            <input className="field-input search-input" placeholder="¿Qué juego buscas?" value={q} onChange={e => setQ(e.target.value)}/>
          </div>
          <div className="seg">
            {[['todos', 'Todos'], ['libres', 'Me lo pueden dejar'], ['prestados', 'Prestados'], ['faltan', 'No lo tengo']].map(([k, l]) => (
              <button key={k} className={'seg-btn' + (filtro === k ? ' active' : '')} onClick={() => setFiltro(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="lz-filtros">
          <div className="seg" role="group" aria-label="Forma de verlos">
            <button className={'seg-btn' + (modo === 'cuadricula' ? ' active' : '')} onClick={() => setModo('cuadricula')}><LayoutGrid size={13}/> Fichas</button>
            <button className={'seg-btn' + (modo === 'tabla' ? ' active' : '')} onClick={() => setModo('tabla')}><Rows3 size={13}/> Tabla</button>
          </div>
          <CollapseAll ids={visibles.map(P => P.clave)} c={pleg}/>
        </div>
        <div className="lz-chips">
          <button className={'lz-chip' + (!plat ? ' on' : '')} onClick={() => setPlat('')}>Todas <span>{total}</span></button>
          {plats.map(P => (
            <button key={P.clave} className={'lz-chip' + (plat === P.clave ? ' on' : '')} onClick={() => setPlat(plat === P.clave ? '' : P.clave)}>
              {P.img && <img src={P.img} alt=""/>}{P.nombre} <span>{P.juegos.length}</span>
            </button>
          ))}
        </div>

        {visibles.length === 0 && <EmptyState icon={<Gamepad2 size={52}/>} title="Nada por aquí" description="Prueba con otra búsqueda u otro filtro."/>}
        {visibles.map(P => {
          const cerrada = pleg.isClosed(P.clave);
          const entera = acotado || abiertas[P.clave] || P.lista.length <= 8 || modo === 'tabla';
          const lista = entera ? P.lista : P.lista.slice(0, 6);
          return (
            <section key={P.clave} className={'lz-plat' + (cerrada ? ' cerrada' : '')}>
              <GroupHead closed={cerrada} onToggle={() => pleg.toggle(P.clave)} className="lz-plat-h">
                {P.img && <img src={P.img} alt=""/>}{P.nombre}<span className="grp-n">{P.lista.length} juego{P.lista.length !== 1 ? 's' : ''}</span>
              </GroupHead>
              {!cerrada && (modo === 'tabla' ? (
                <div className="table-wrap">
                  <table className="table lz-tabla">
                    <thead><tr><th style={{ width: 64 }}></th><th>Juego</th><th>Quién lo tiene</th></tr></thead>
                    <tbody>
                      {lista.map(J => (
                        <tr key={J.clave}>
                          <td><Cover img={J.img}/></td>
                          <td className="lz-tabla-n">{J.nombre}<small>{J.copias.length} copia{J.copias.length !== 1 ? 's' : ''}</small></td>
                          <td><div className="lz-copias lz-copias-fila">
                            {J.copias.map((c, i) => <Copia key={i} c={c} porUsuario={porUsuario} busy={busy} {...accionesCopia(c, J)}/>)}
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (<>
                <div className="lz-lista">
                  {lista.map(J => (
                    <div key={J.clave} className="lz-juego">
                      <Cover img={J.img} grande/>
                      <div className="lz-juego-info">
                        <div className="lz-juego-n">{J.nombre}</div>
                        <div className="lz-copias">
                          {J.copias.map((c, i) => <Copia key={i} c={c} porUsuario={porUsuario} busy={busy} {...accionesCopia(c, J)}/>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {!entera && <button className="lz-mas" onClick={() => setAbiertas(a => ({ ...a, [P.clave]: true }))}><ChevronDown size={14}/> Ver los {P.lista.length} juegos de {P.nombre}</button>}
              </>))}
            </section>
          );
        })}
        </>}
      </>)}

      <PrestarModal open={!!prestar} juego={prestar} onClose={() => setPrestar(null)} onSaved={trasCambio}/>
      <PedirModal p={pedir} onClose={() => setPedir(null)}/>
      <RecordarModal r={recordar} porUsuario={porUsuario} onClose={() => setRecordar(null)}/>
    </div>
  );
}

const Cover = ({ img, grande }) => (
  <div className={'lz-cover' + (grande ? ' grande' : '')}>
    {img ? <img src={thumb(img, grande ? 320 : 200)} alt="" loading="lazy" decoding="async"/> : <Gamepad2 size={grande ? 24 : 18}/>}
  </div>
);

// Quien lo tiene: alguien de la comunidad (con su cara) o un nombre escrito a mano
function Quien({ c, porUsuario }) {
  const u = c.au && porUsuario[c.au];
  return u ? <><Avatar user={u} size={18}/> <b>{u.display}</b></> : <b>{c.a}</b>;
}

/* Una copia = la ficha de su dueño. Verde: en casa. Naranja: «dueño → quien lo tiene».
 * Las mías se pueden prestar o marcar la devolución; las de otros (en casa) se pueden pedir. */
function Copia({ c, mia, pedida, porUsuario, onPrestar, onDevolver, onPerfil, onPedir, onCancelar, busy }) {
  const base = 'lz-copia' + (c.a ? ' fuera' : c.digital ? ' digital' : ' libre') + (mia ? ' mia' : '');
  const sinCuenta = String(c.dueno.user).startsWith('~');
  return (
    <div className={base}>
      <button className="lz-copia-dueno" onClick={() => onPerfil(c.dueno.user)} title={`Ver la colección de ${c.dueno.display}`}>
        <Avatar user={c.dueno} size={26}/>
        <span>{mia ? 'Tú' : c.dueno.display}{c.uds > 1 && <i> ×{c.uds}</i>}</span>
      </button>
      {c.a
        ? <span className="lz-copia-st"><ArrowRight size={12}/> <Quien c={c} porUsuario={porUsuario}/></span>
        : <span className="lz-copia-st">{c.digital ? 'digital' : <><Check size={11}/> en casa</>}</span>}
      {mia ? (c.a
        ? <button className="lz-copia-btn" onClick={onDevolver} disabled={busy}>Devuelto</button>
        : !c.digital && <button className="lz-copia-btn" onClick={onPrestar} disabled={busy}>Prestar</button>)
      : !c.a && !c.digital && (pedida
        ? <button className="lz-copia-btn pedido" onClick={() => onCancelar(pedida)} title="Ya se lo has pedido. Pulsa para retirar la petición"><Check size={11}/> Pedido</button>
        : <button className="lz-copia-btn pedir" onClick={onPedir} title={`Pedirle a ${c.dueno.display} que te lo deje${sinCuenta ? ' (le llegará cuando se una a GameVault)' : ''}`}><Hand size={12}/> Pedir</button>)}
    </div>
  );
}

// Pedir un juego: un mensaje opcional y listo; al dueño le sale arriba en su Zona de préstamos
function PedirModal({ p, onClose }) {
  const [msg, setMsg] = useState('');
  const [st, setSt] = useState('');
  useEffect(() => { setMsg(''); setSt(''); }, [p]);
  if (!p) return null;
  const { c, J } = p;
  const enviar = async () => { setSt('enviando'); try { await pedirJuego(c.dueno.user, c.id, msg); setSt('ok'); setTimeout(onClose, 1200); } catch (e) { setSt(e.message); } };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3 className="modal-title">Pedir «{J.nombre}»</h3><button className="icon-btn" onClick={onClose}><X size={16}/></button></div>
        <div className="modal-body">
          <div className="gv-claim-who"><Avatar user={c.dueno} size={44}/><div><b>{c.dueno.display}</b><small>{String(c.dueno.user).startsWith('~') ? 'Aún no tiene cuenta: le llegará en cuanto se una a GameVault (pásale su enlace)' : 'le llegará tu petición en su Zona de préstamos'}</small></div></div>
          <label className="field-label" style={{ marginTop: 10 }}>Mensaje (opcional)</label>
          <textarea className="field-input" rows={3} maxLength={300} value={msg} onChange={e => setMsg(e.target.value)} placeholder="¿Me lo dejas este finde? Te lo devuelvo en dos semanas"/>
          {st && st !== 'enviando' && st !== 'ok' && <p className="gv-error">{st}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={enviar} disabled={st === 'enviando' || st === 'ok'}>
            {st === 'ok' ? <><Check size={14}/> Enviado</> : <><Hand size={14}/> Pedírselo</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// Arriba del todo: lo que me piden (para contestar) y lo que he pedido (y cómo va)
function Peticiones({ reqs, busy, onContestar, onCancelar }) {
  const rec = reqs.recibidas || [], env = reqs.enviadas || [];
  if (!rec.length && !env.length) return null;
  const ESTADO = { pendiente: 'esperando respuesta', aceptada: '¡te lo deja!', rechazada: 'ahora no puede', cancelada: 'retirada' };
  return (
    <div className="lz-pet">
      {rec.length > 0 && (
        <div className="lz-pet-col recibidas">
          <p className="section-title"><Inbox size={13} style={{ verticalAlign: -2 }}/> Te piden <span>({rec.length})</span></p>
          {rec.map(r => (
            <div key={r.id} className="lz-pet-row">
              <Avatar user={r.quien} size={34}/>
              <div className="lz-pet-info"><b>{r.quien?.display}</b> te pide <b>{r.nombre}</b>{r.msg && <em>«{r.msg}»</em>}</div>
              <div className="lz-pet-btns">
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onContestar(r, true)}><Check size={13}/> Prestárselo</button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onContestar(r, false)}>Ahora no</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {env.length > 0 && (
        <div className="lz-pet-col">
          <p className="section-title"><Hand size={13} style={{ verticalAlign: -2 }}/> Has pedido <span>({env.length})</span></p>
          {env.map(r => (
            <div key={r.id} className={'lz-pet-row ' + r.estado}>
              <Avatar user={r.quien} size={28}/>
              <div className="lz-pet-info"><b>{r.nombre}</b> a {r.quien?.display} · <span className="lz-pet-st">{ESTADO[r.estado] || r.estado}</span></div>
              {r.estado === 'pendiente' && <button className="icon-btn" title="Retirar la petición" onClick={() => onCancelar(r)}><X size={14}/></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Cuánto tiempo lleva fuera un préstamo; a partir de un mes en ámbar y de tres en rojo
// Días enteros entre la fecha (YYYY-MM-DD) y hoy, contando por días de calendario (no por horas)
export function diasDesde(f) {
  if (!f) return null;
  const [y, m, d] = String(f).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const hoy = new Date(); const a = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()), b = Date.UTC(y, m - 1, d);
  const n = Math.round((a - b) / 86400000);
  return n >= 0 ? n : null;
}
export function textoTiempo(d) {
  if (d == null) return '';
  if (d < 1) return 'hoy'; if (d === 1) return '1 día'; if (d < 31) return `${d} días`;
  const m = Math.round(d / 30.4); if (m < 12) return `${m} mes${m > 1 ? 'es' : ''}`;
  const y = Math.floor(d / 365); return `${y} año${y > 1 ? 's' : ''}${m - y * 12 > 0 ? ` y ${m - y * 12} mes${m - y * 12 > 1 ? 'es' : ''}` : ''}`;
}
function Tiempo({ f, mio = true }) {
  const d = diasDesde(f);
  if (d == null) return null;
  const cls = d >= 90 ? 'rojo' : d >= 30 ? 'ambar' : '';
  return <span className={'lz-tiempo ' + cls} title={mio ? 'Tiempo que lleva fuera de casa' : 'Tiempo que llevas con él'}>
    <Clock3 size={11}/> {mio ? 'fuera' : 'lo tienes'} {d < 1 ? 'desde hoy' : `desde hace ${textoTiempo(d)}`}</span>;
}

// Recordar a quien tiene mi juego que me lo devuelva: si tiene cuenta, le llega un aviso;
// si no, se copia el mensaje para mandarlo por WhatsApp o donde sea
function RecordarModal({ r, porUsuario, onClose }) {
  const [msg, setMsg] = useState('');
  const [st, setSt] = useState('');
  useEffect(() => { setMsg(''); setSt(''); }, [r]);
  if (!r) return null;
  const { J, c } = r;
  const conCuenta = !!c.au;
  const quien = (c.au && porUsuario[c.au]?.display) || c.a;
  const d = diasDesde(c.f);
  const texto = `¡Hola, ${quien}! ¿Qué tal con «${J.nombre}»?${d != null && d > 0 ? ` Ya van ${textoTiempo(d)}.` : ''} Cuando acabes, ¿me lo devuelves? 🙂`;
  const enviar = async () => {
    setSt('enviando');
    try { await recordarPrestamo(c.au, c.id, msg); setSt('ok'); setTimeout(onClose, 1300); } catch (e) { setSt(e.message); }
  };
  const copiar = async () => {
    try { if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share({ text: texto }); setSt('ok'); return; } } catch { return; }
    try { await navigator.clipboard.writeText(texto); setSt('copiado'); } catch { window.prompt('Copia el mensaje:', texto); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3 className="modal-title">Recordar «{J.nombre}»</h3><button className="icon-btn" onClick={onClose}><X size={16}/></button></div>
        <div className="modal-body">
          {conCuenta ? (<>
            <p className="gv-muted" style={{ marginBottom: 10 }}>A <b>{quien}</b> le saldrá un aviso en GameVault{d != null ? ` recordándole que lo tiene desde hace ${textoTiempo(d)}` : ''}.</p>
            <label className="field-label">Mensaje (opcional)</label>
            <textarea className="field-input" rows={3} maxLength={300} value={msg} onChange={e => setMsg(e.target.value)} placeholder="¿Me lo traes el sábado?"/>
          </>) : (<>
            <p className="gv-muted" style={{ marginBottom: 10 }}><b>{quien}</b> no tiene cuenta en GameVault. Copia este mensaje y mándaselo por donde soléis hablar:</p>
            <div className="lz-recordar-txt">{texto}</div>
          </>)}
          {st && !['enviando', 'ok', 'copiado'].includes(st) && <p className="gv-error">{st}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          {conCuenta
            ? <button className="btn btn-primary" onClick={enviar} disabled={st === 'enviando' || st === 'ok'}>{st === 'ok' ? <><Check size={14}/> Enviado</> : <><BellRing size={14}/> Mandar recordatorio</>}</button>
            : <button className="btn btn-primary" onClick={copiar}>{st === 'copiado' || st === 'ok' ? <><Check size={14}/> Copiado</> : <><Copy size={14}/> Copiar mensaje</>}</button>}
        </div>
      </div>
    </div>
  );
}
