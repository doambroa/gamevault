import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, ArrowLeftRight, Gamepad2, Check, RefreshCw, ChevronDown, Undo2, Users } from 'lucide-react';
import { PageHeader, EmptyState, SkeletonList, Btn } from '../components/ui/index';
import { imgSrc } from '../utils/imgSrc';
import { canon, normalize } from '../core/text';
import { claveConsola, imagenPorNombre } from '../data/consolas';
import { useAccount, fetchLoans, pushNow } from './account';
import { Avatar, PrestarModal } from './ui';
import { NeedAccount } from './ComunidadPage';

const api = window.api;
const fechaEs = f => (f ? f.split('-').reverse().join('/') : '');
// Clave para juntar el mismo juego aunque cada uno lo escriba a su manera
const claveJuego = n => canon(String(n).replace(/\(.*?\)/g, ' ').replace(/[®™]/g, ''))
  .replace(/\b(the|el|la|los|las|definitive edition|deluxe|remastered|edicion|edition)\b/g, ' ').replace(/\s+/g, '');
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

  const load = useCallback(() => fetchLoans().then(g => { setGente(g); setErr(''); }).catch(e => setErr(e.message)), []);
  useEffect(() => { if (me) load(); }, [me, load]);

  const plats = useMemo(() => agrupar(gente || []), [gente]);
  const porUsuario = useMemo(() => Object.fromEntries((gente || []).map(g => [g.user, g])), [gente]);

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
    return { dejados: dej, recibidos: rec };
  }, [plats, me]);

  if (!me) return <NeedAccount titulo="Zona de préstamos"/>;

  // Tras tocar un juego mío: subirlo ya y volver a pedir la zona
  const trasCambio = async () => { setBusy(true); try { await pushNow(); } catch {} await load(); setBusy(false); };
  const abrirPrestar = async c => { const j = await api.juegos.getById(c.id); if (j) setPrestar(j); };
  const devolver = async c => { await api.juegos.devolver(c.id); trasCambio(); };

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
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => devolver(c)} disabled={busy}><Undo2 size={13}/> Devuelto</button>
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
          const entera = acotado || abiertas[P.clave] || P.lista.length <= 8;
          const lista = entera ? P.lista : P.lista.slice(0, 6);
          return (
            <section key={P.clave} className="lz-plat">
              <h2 className="lz-plat-h">{P.img && <img src={P.img} alt=""/>}{P.nombre}<span>{P.lista.length} juego{P.lista.length !== 1 ? 's' : ''}</span></h2>
              <div className="lz-lista">
                {lista.map(J => (
                  <div key={J.clave} className="lz-juego">
                    <Cover img={J.img} grande/>
                    <div className="lz-juego-info">
                      <div className="lz-juego-n">{J.nombre}</div>
                      <div className="lz-copias">
                        {J.copias.map((c, i) => (
                          <Copia key={i} c={c} mia={c.dueno.user === me.user} porUsuario={porUsuario} busy={busy}
                            onPrestar={() => abrirPrestar(c)} onDevolver={() => devolver(c)} onPerfil={u => nav('/comunidad/' + u)}/>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {!entera && <button className="lz-mas" onClick={() => setAbiertas(a => ({ ...a, [P.clave]: true }))}><ChevronDown size={14}/> Ver los {P.lista.length} juegos de {P.nombre}</button>}
            </section>
          );
        })}
        </>}
      </>)}

      <PrestarModal open={!!prestar} juego={prestar} onClose={() => setPrestar(null)} onSaved={trasCambio}/>
    </div>
  );
}

const Cover = ({ img, grande }) => (
  <div className={'lz-cover' + (grande ? ' grande' : '')}>
    {img ? <img src={imgSrc(img)} alt="" loading="lazy"/> : <Gamepad2 size={grande ? 24 : 18}/>}
  </div>
);

// Quien lo tiene: alguien de la comunidad (con su cara) o un nombre escrito a mano
function Quien({ c, porUsuario }) {
  const u = c.au && porUsuario[c.au];
  return u ? <><Avatar user={u} size={18}/> <b>{u.display}</b></> : <b>{c.a}</b>;
}

/* Una copia = la ficha de su dueño. Verde: en casa. Naranja: «dueño → quien lo tiene».
 * Las mías se pueden pulsar para prestar o marcar la devolución. */
function Copia({ c, mia, porUsuario, onPrestar, onDevolver, onPerfil, busy }) {
  const base = 'lz-copia' + (c.a ? ' fuera' : c.digital ? ' digital' : ' libre') + (mia ? ' mia' : '');
  return (
    <div className={base}>
      <button className="lz-copia-dueno" onClick={() => onPerfil(c.dueno.user)} title={`Ver la colección de ${c.dueno.display}`}>
        <Avatar user={c.dueno} size={26}/>
        <span>{mia ? 'Tú' : c.dueno.display}{c.uds > 1 && <i> ×{c.uds}</i>}</span>
      </button>
      {c.a
        ? <span className="lz-copia-st"><ArrowRight size={12}/> <Quien c={c} porUsuario={porUsuario}/></span>
        : <span className="lz-copia-st">{c.digital ? 'digital' : <><Check size={11}/> en casa</>}</span>}
      {mia && (c.a
        ? <button className="lz-copia-btn" onClick={onDevolver} disabled={busy}>Devuelto</button>
        : !c.digital && <button className="lz-copia-btn" onClick={onPrestar} disabled={busy}>Prestar</button>)}
    </div>
  );
}
