import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, Monitor, Clock, Euro, BookOpen, Trophy, CalendarDays, Tags, Hourglass, X, Circle, BarChart2, LayoutGrid, GitCommitHorizontal } from 'lucide-react';
import './Stats.css';
import JuegoPanel from '../Juegos/JuegoPanel';
import JuegoForm from '../Juegos/JuegoForm';
import '../Juegos/JuegoPanel.css';
import GameCard from '../../components/GameCard';
import { firstImg } from '../../utils/imgSrc';
import { useCreditos, findCredito } from '../../community/creditos';

/* Estadísticas, versión 2.0
 * Antes: tres dibujos del mismo dato (burbujas, barras, tarjetas) y una «línea temporal» que era una
 * lista larguísima sin escala de tiempo y con detalles solo al pasar el ratón (no va en el móvil).
 * Ahora: cada bloque responde a una pregunta, todo se puede pulsar y lo pulsado se abre debajo
 * con las carátulas; de ahí, a la ficha del juego. */

const api = window.api;
const eur = n => (Number(n) || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';
const VISTAS = [['burbujas', 'Burbujas', Circle], ['barras', 'Barras', BarChart2], ['tarjetas', 'Tarjetas', LayoutGrid]];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TRAMOS = [
  { k: 'corto', l: 'Menos de 5 h', min: 0, max: 5 },
  { k: 'tarde', l: '5 – 15 h', min: 5, max: 15 },
  { k: 'finde', l: '15 – 30 h', min: 15, max: 30 },
  { k: 'largo', l: '30 – 60 h', min: 30, max: 60 },
  { k: 'eterno', l: 'Más de 60 h', min: 60, max: Infinity },
];

export default function StatsPage() {
  const nav = useNavigate();
  const [juegos, setJuegos] = useState(null);
  const [plats, setPlats] = useState([]);
  const [eje, setEje] = useState('fechaLanzamiento');      // fechaLanzamiento | fechaAdquisicion | terminado
  const [platFiltro, setPlatFiltro] = useState('');
  const [sel, setSel] = useState(null);
  const [vistaC, setVistaSt] = useState(() => { try { return localStorage.getItem('gv-stats-vista') || 'burbujas'; } catch { return 'burbujas'; } });
  const setVista = v => { setVistaSt(v); try { localStorage.setItem('gv-stats-vista', v); } catch {} };
  const [tlPlatSel, setTlPlat] = useState(null);       // null = la consola con más juegos
  const [tlEje, setTlEje] = useState('fechaLanzamiento');
  const verConsola = id => { setTlPlat(String(id)); setTimeout(() => document.getElementById('st-tl')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };                     // { titulo, juegos } — lo que se ha pulsado
  const [panelJuego, setPanelJuego] = useState(null);
  const [editJuego, setEditJuego] = useState(null);
  const cf = useCreditos();
  useEffect(() => { if (sel) setTimeout(() => document.getElementById('st-sel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }, [sel]);

  const load = useCallback(async () => {
    const [j, p] = await Promise.all([api.juegos.getAll({}), api.plataformas.getAll()]);
    setJuegos(j); setPlats(p);
    setPanelJuego(cur => (cur ? j.find(x => x.id === cur.id) || null : cur));
  }, []);
  useEffect(() => { if (api) load(); }, [load]);
  useEffect(() => {
    if (!api?.onChanged) return;
    let t; const off = api.onChanged(() => { clearTimeout(t); t = setTimeout(load, 400); });
    return () => { clearTimeout(t); off(); };
  }, [load]);

  const platPorId = useMemo(() => Object.fromEntries(plats.map(p => [p.id, p])), [plats]);
  const lista = useMemo(() => (juegos || []).map(j => ({
    ...j, plataformaNombre: j.plataformaNombre || platPorId[j.plataformaId]?.nombre || '',
    _cf: findCredito(cf.idx, j),
  })), [juegos, platPorId, cf]);
  const hecho = useCallback(j => j._cf?.e === 'terminado', []);

  // ── Números de cabecera ──
  const kpi = useMemo(() => {
    const horas = lista.reduce((n, j) => n + (j.hltbMain > 0 ? j.hltbMain : 0), 0);
    const pendientes = lista.filter(j => !hecho(j) && j.hltbMain > 0);
    return {
      juegos: lista.reduce((n, j) => n + Math.max(1, j.unidades || 1), 0),
      consolas: plats.length,
      horas, gasto: lista.reduce((n, j) => n + (Number(j.precio) || 0), 0) + plats.reduce((n, p) => n + (Number(p.precio) || 0), 0),
      prestados: lista.filter(j => j.prestadoA).length,
      terminados: lista.filter(hecho).length,
      horasPend: pendientes.reduce((n, j) => n + j.hltbMain, 0),
    };
  }, [lista, plats]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Por consola ──
  const porConsola = useMemo(() => plats.map(p => {
    const js = lista.filter(j => j.plataformaId === p.id);
    return { p, js, n: js.length, t: js.filter(hecho).length, img: firstImg(p.imagenes) };
  }).filter(x => x.n > 0).sort((a, b) => b.n - a.n), [plats, lista]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxC = porConsola[0]?.n || 1;
  const tlPlat = tlPlatSel ?? '';

  // ── Año a año (con escala de tiempo de verdad: los años vacíos también salen) ──
  const anios = useMemo(() => {
    const m = new Map();
    for (const j of lista) {
      if (platFiltro && String(j.plataformaId) !== platFiltro) continue;
      let y = null;
      if (eje === 'terminado') y = hecho(j) ? Number(j._cf.y) || null : null;
      else y = Number(String(j[eje] || '').slice(0, 4)) || null;
      if (!y || y < 1970 || y > 2100) continue;
      if (!m.has(y)) m.set(y, []);
      m.get(y).push(j);
    }
    if (!m.size) return [];
    const ys = [...m.keys()];
    const res = [];
    for (let y = Math.min(...ys); y <= Math.max(...ys); y++) res.push({ y, js: m.get(y) || [] });
    return res;
  }, [lista, eje, platFiltro]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxA = Math.max(1, ...anios.map(a => a.js.length));
  const sinFecha = lista.filter(j => (!platFiltro || String(j.plataformaId) === platFiltro) && (eje === 'terminado' ? false : !String(j[eje] || '').match(/^\d{4}/))).length;

  // ── Duración ──
  const tramos = useMemo(() => TRAMOS.map(t => ({ ...t, js: lista.filter(j => j.hltbMain > 0 && j.hltbMain >= t.min && j.hltbMain < t.max) })), [lista]);
  const maxT = Math.max(1, ...tramos.map(t => t.js.length));

  // ── Géneros ──
  const generos = useMemo(() => {
    const m = {};
    for (const j of lista) if (j.genero) (m[j.genero] = m[j.genero] || []).push(j);
    return Object.entries(m).map(([g, js]) => ({ g, js })).sort((a, b) => b.js.length - a.js.length).slice(0, 12);
  }, [lista]);
  const maxG = generos[0]?.js.length || 1;

  if (!juegos) return <div className="page"><p style={{ color: 'var(--text-2)' }}>Cargando…</p></div>;

  // Se guardan los ids (no los juegos): si se edita uno desde la ficha, la lista de abajo se ve ya cambiada
  const abrir = (titulo, js, k) => setSel(s => (s && s.k === k ? null : { titulo, ids: js.map(j => j.id), k }));
  const selJuegos = sel ? lista.filter(j => sel.ids.includes(j.id)) : [];
  const panelOpen = !!panelJuego;

  return (
    <div className={'page' + (panelOpen ? ' con-panel' : '')}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Estadísticas</h1>
          <p className="page-sub">Pulsa cualquier barra para ver sus juegos</p>
        </div>
      </div>

      <div className="st-kpis">
        <Kpi icon={<Gamepad2 size={16}/>} n={kpi.juegos} l="juegos"/>
        <Kpi icon={<Monitor size={16}/>} n={kpi.consolas} l="consolas"/>
        <Kpi icon={<Clock size={16}/>} n={Math.round(kpi.horas).toLocaleString('es-ES')} l="horas de historia" title="Suma de lo que se tarda en pasar cada juego (HowLongToBeat)"/>
        {kpi.gasto > 0 && <Kpi icon={<Euro size={16}/>} n={eur(kpi.gasto)} l="invertido"/>}
        {kpi.prestados > 0 && <Kpi icon={<BookOpen size={16}/>} n={kpi.prestados} l="prestados" onClick={() => nav('/juegos?prestados=1')}/>}
        {cf.disponible && <Kpi icon={<Trophy size={16}/>} n={kpi.terminados} l="terminados" onClick={() => nav('/juegos?cf=si')} tono="green"/>}
      </div>

      <div className="st-grid">
        {/* ── Consolas: burbujas, barras o tarjetas; al pulsar una, su línea temporal ── */}
        <section className="st-card st-wide">
          <h2 className="st-h"><Monitor size={15}/> Juegos por consola
            <span className="view-selector st-views">
              {VISTAS.map(([id, l, Icon]) => (
                <button key={id} className={'view-btn' + (vistaC === id ? ' active' : '')} onClick={() => setVista(id)}><Icon size={14}/> {l}</button>
              ))}
            </span>
          </h2>
          {vistaC === 'burbujas' && (
            <div className="bubbles-container st-bubbles">
              {porConsola.map(({ p, n, t, img }) => {
                const size = 78 + Math.sqrt(n / maxC) * 150;        // el área (no el diámetro) va con el número de juegos
                return (
                  <button key={p.id} className={'bubble-wrap' + (tlPlat === String(p.id) ? ' on' : '')} style={{ width: size }} onClick={() => verConsola(p.id)}
                    title={`${p.nombre}: ${n} juegos${cf.disponible ? ` · ${t} terminados` : ''} — pulsa para ver su línea temporal`}>
                    <span className="bubble" style={{ width: size, height: size }}>
                      {img ? <img src={img} alt="" className="bubble-img st-bubble-img"/> : <span className="bubble-no-img">{p.nombre.slice(0, 2)}</span>}
                      {cf.disponible && t > 0 && <svg className="st-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" pathLength="100" strokeDasharray={`${(t / n) * 100} 100`}/></svg>}
                      <span className="st-bubble-n">{n}</span>
                    </span>
                    <span className="bubble-label">{p.nombre}</span>
                    {cf.disponible && <span className="bubble-sublabel">{t} terminado{t !== 1 ? 's' : ''}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {vistaC === 'barras' && (
            <div className="st-bars">
              {porConsola.map(({ p, n, t, img }) => (
                <button key={p.id} className={'st-bar' + (tlPlat === String(p.id) ? ' on' : '')} onClick={() => verConsola(p.id)}
                  title={`${p.nombre}: ${n} juegos${cf.disponible ? ` · ${t} terminados` : ''}`}>
                  <span className="st-bar-img">{img ? <img src={img} alt=""/> : <Monitor size={16}/>}</span>
                  <span className="st-bar-name">{p.nombre}</span>
                  <span className="st-bar-track">
                    <span className="st-bar-fill" style={{ width: `${(n / maxC) * 100}%` }}>
                      {cf.disponible && t > 0 && <span className="st-bar-done" style={{ width: `${(t / n) * 100}%` }}/>}
                    </span>
                  </span>
                  <span className="st-bar-n">{n}</span>
                </button>
              ))}
              {cf.disponible && <p className="st-leyenda" style={{ marginTop: 6 }}><i className="st-sw st-sw-done"/> terminados <i className="st-sw"/> por jugar</p>}
            </div>
          )}
          {vistaC === 'tarjetas' && (
            <div className="stat-grid">
              {porConsola.map(({ p, n, t, img }) => (
                <button key={p.id} className={'stat-tile' + (tlPlat === String(p.id) ? ' on' : '')} onClick={() => verConsola(p.id)}>
                  <span className="stat-tile-num">{n}</span>
                  {img ? <img src={img} alt="" className="stat-tile-img st-tile-img"/> : <span className="stat-tile-no-img">{p.nombre.slice(0, 2)}</span>}
                  <span className="stat-tile-info"><span className="stat-tile-name">{p.nombre}</span><span className="stat-tile-marca">{cf.disponible ? `${t} terminados` : p.marca}</span></span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Línea temporal con carátulas ── */}
        <section className="st-card st-wide" id="st-tl">
          <h2 className="st-h"><GitCommitHorizontal size={15}/> Línea temporal</h2>
          <div className="st-tools">
            <select className="field-input field-select" style={{ width: 'auto' }} value={tlPlat} onChange={e => setTlPlat(e.target.value)} aria-label="Consola de la línea temporal">
              <option value="">Todas las consolas</option>
              {porConsola.map(({ p, n }) => <option key={p.id} value={p.id}>{p.nombre} ({n})</option>)}
            </select>
            <div className="seg">
              {[['fechaLanzamiento', 'Salida'], ['fechaAdquisicion', 'Compra'], ...(cf.disponible ? [['terminado', 'Terminado']] : [])].map(([k, l]) => (
                <button key={k} className={'seg-btn' + (tlEje === k ? ' active' : '')} onClick={() => setTlEje(k)}>{l}</button>
              ))}
            </div>
          </div>
          <Timeline juegos={lista.filter(j => !tlPlat || String(j.plataformaId) === tlPlat)} eje={tlEje} hecho={hecho}
            activeId={panelJuego?.id} onOpen={setPanelJuego} showPlat={!tlPlat}
            onMore={(label, js) => abrir(`${label} · ${platPorId[tlPlat]?.nombre || 'todas las consolas'}`, js, 'tl' + label + tlPlat)}/>
        </section>

        {/* ── Año a año ── */}
        <section className="st-card st-wide">
          <h2 className="st-h"><CalendarDays size={15}/> Año a año</h2>
          <div className="st-tools">
            <div className="seg">
              {[['fechaLanzamiento', 'Cuándo salieron'], ['fechaAdquisicion', 'Cuándo los compré'], ...(cf.disponible ? [['terminado', 'Cuándo me los pasé']] : [])].map(([k, l]) => (
                <button key={k} className={'seg-btn' + (eje === k ? ' active' : '')} onClick={() => { setEje(k); setSel(null); }}>{l}</button>
              ))}
            </div>
            <select className="field-input field-select" style={{ width: 'auto' }} value={platFiltro} onChange={e => { setPlatFiltro(e.target.value); setSel(null); }} aria-label="Consola">
              <option value="">Todas las consolas</option>
              {porConsola.map(({ p }) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          {anios.length === 0 ? <p className="gv-muted">No hay fechas apuntadas para esto todavía.</p> : (
            <div className="st-years" style={{ '--n': anios.length }}>
              {anios.map(a => (
                <button key={a.y} className={'st-year' + (sel?.k === 'y' + a.y ? ' on' : '') + (a.js.length ? '' : ' vacio')} disabled={!a.js.length}
                  onClick={() => abrir(`${a.y} · ${eje === 'fechaLanzamiento' ? 'salieron' : eje === 'fechaAdquisicion' ? 'los compraste' : 'te los pasaste'}`, a.js, 'y' + a.y)}
                  title={`${a.y}: ${a.js.length} juego${a.js.length !== 1 ? 's' : ''}`}>
                  <span className="st-year-n">{a.js.length || ''}</span>
                  <span className="st-year-col" style={{ height: `${(a.js.length / maxA) * 100}%` }}/>
                  <span className="st-year-l">{a.y % 5 === 0 || anios.length <= 16 ? a.y : '·'}</span>
                </button>
              ))}
            </div>
          )}
          {sinFecha > 0 && <p className="gv-muted st-nota">{sinFecha} juego{sinFecha !== 1 ? 's' : ''} sin esta fecha no salen aquí.</p>}
        </section>

        {/* ── Duración ── */}
        <section className="st-card">
          <h2 className="st-h"><Hourglass size={15}/> ¿Cuánto duran?</h2>
          <div className="st-bars st-bars-simple">
            {tramos.map(t => (
              <button key={t.k} className={'st-bar' + (sel?.k === t.k ? ' on' : '')} disabled={!t.js.length} onClick={() => abrir(`Duran ${t.l.toLowerCase()}`, t.js, t.k)}>
                <span className="st-bar-name">{t.l}</span>
                <span className="st-bar-track"><span className="st-bar-fill" style={{ width: `${(t.js.length / maxT) * 100}%` }}/></span>
                <span className="st-bar-n">{t.js.length}</span>
              </button>
            ))}
          </div>
          {cf.disponible && kpi.horasPend > 0 && (
            <p className="st-pila"><b>{Math.round(kpi.horasPend).toLocaleString('es-ES')} h</b> de historia te esperan en los juegos que aún no has terminado
              {' '}<button className="gv-link" onClick={() => abrir('Cortos y sin terminar: para empezar ya', lista.filter(j => !hecho(j) && j.hltbMain > 0 && j.hltbMain < 10).sort((a, b) => a.hltbMain - b.hltbMain), 'cortos')}>ver los más cortos</button></p>
          )}
        </section>

        {/* ── Géneros ── */}
        <section className="st-card">
          <h2 className="st-h"><Tags size={15}/> Géneros</h2>
          {generos.length === 0 ? <p className="gv-muted">Aún no hay géneros apuntados.</p> : (
            <div className="st-bars st-bars-simple">
              {generos.map(({ g, js }) => (
                <button key={g} className={'st-bar' + (sel?.k === 'g' + g ? ' on' : '')} onClick={() => abrir(g, js, 'g' + g)}>
                  <span className="st-bar-name">{g}</span>
                  <span className="st-bar-track"><span className="st-bar-fill" style={{ width: `${(js.length / maxG) * 100}%` }}/></span>
                  <span className="st-bar-n">{js.length}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Lo pulsado, con sus carátulas */}
      {sel && (
        <div className="st-sel" id="st-sel">
          <div className="st-sel-h">
            <h2>{sel.titulo} <span>{selJuegos.length}</span></h2>
            <button className="icon-btn" onClick={() => setSel(null)} title="Cerrar"><X size={16}/></button>
          </div>
          <div className="gcard-grid gcard-grid-sm">
            {selJuegos.slice().sort((a, b) => String(a.fechaLanzamiento || '9').localeCompare(String(b.fechaLanzamiento || '9'))).map(j => (
              <GameCard key={j.id} juego={j} showPlat credito={j._cf} active={panelJuego?.id === j.id} onClick={() => setPanelJuego(j)}/>
            ))}
          </div>
        </div>
      )}

      <JuegoPanel juego={panelJuego} plataforma={panelJuego ? platPorId[panelJuego.plataformaId] : null} open={panelOpen}
        onClose={() => setPanelJuego(null)} onEdit={() => setEditJuego(panelJuego)} onRefresh={load}/>
      <JuegoForm open={!!editJuego} initial={editJuego} plataformas={plats}
        onClose={() => setEditJuego(null)}
        onSave={async data => { await api.juegos.update({ id: editJuego.id, ...data }); setEditJuego(null); await load(); }}/>
    </div>
  );
}

function Kpi({ icon, n, l, onClick, title, tono }) {
  const C = onClick ? 'button' : 'div';
  return (
    <C className={'st-kpi' + (onClick ? ' click' : '') + (tono ? ' ' + tono : '')} onClick={onClick} title={title}>
      <span className="st-kpi-i">{icon}</span>
      <span className="st-kpi-n">{n}</span>
      <span className="st-kpi-l">{l}</span>
    </C>
  );
}


/* Línea temporal: escala de años real, las carátulas de cada año encima de su año y, al pulsar una, la ficha.
 * Pensada para que vaya fluida: miniaturas pequeñas (7 KB en vez de 1–2 MB), como mucho 3 carátulas por
 * año (el resto en «+N», que abre el año entero debajo), los años vacíos seguidos se juntan en un hueco
 * y pasar el ratón no vuelve a pintar nada (el texto de abajo se cambia directamente). */
const POR_ANIO = 3;
function Timeline({ juegos, eje, hecho, activeId, onOpen, onMore, showPlat }) {
  const ref = React.useRef(null);
  const infoRef = React.useRef(null);
  const fmt = f => { if (!f) return 'sin fecha'; const [y, m, d] = f.split('-'); return [d && Number(d), m && MESES[Number(m) - 1], y].filter(Boolean).join(' '); };
  const { cols, items, sin } = useMemo(() => {
    const fecha = j => (eje === 'terminado' ? (hecho(j) ? (j._cf.d || String(j._cf.y || '')) : '') : String(j[eje] || ''));
    const items = []; const porAnio = new Map(); const sinF = [];
    for (const j of juegos) {
      const f = fecha(j);
      if (!/^\d{4}/.test(f)) { sinF.push(j); continue; }
      const y = Number(f.slice(0, 4)); if (!porAnio.has(y)) porAnio.set(y, []); porAnio.get(y).push({ j, f });
    }
    const ys = [...porAnio.keys()].sort((a, b) => a - b);
    const cols = [];
    const add = (key, label, l) => {
      l.sort((a, b) => a.f.localeCompare(b.f));
      cols.push({ key, label, n: l.length, todos: l.map(x => x.j), vis: l.slice(0, POR_ANIO).map(x => { items.push(x); return items.length - 1; }) });
    };
    for (let i = 0; i < ys.length; i++) {
      add(ys[i], String(ys[i]), porAnio.get(ys[i]));
      const sig = ys[i + 1];
      if (sig && sig - ys[i] > 1) cols.push({ key: 'gap' + ys[i], gap: sig - ys[i] - 1 === 1 ? String(ys[i] + 1) : `${ys[i] + 1}–${sig - 1}` });
    }
    if (sinF.length && eje !== 'terminado') add('sin', 'Sin fecha', sinF.map(j => ({ j, f: '' })));
    return { cols, items, sin: sinF.length };
  }, [juegos, eje, hecho]);

  // empezar por lo más reciente al cambiar de consola o de eje
  useEffect(() => { const el = ref.current; if (el) el.scrollLeft = el.scrollWidth; }, [cols]);
  // la rueda del ratón mueve la línea en horizontal (y no la página) mientras quede recorrido
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const fn = e => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0 || (e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return;
      e.preventDefault(); el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', fn, { passive: false });
    return () => el.removeEventListener('wheel', fn);
  }, []);
  const ayuda = 'Pasa por encima o pulsa una carátula para ver su ficha · desliza o usa la rueda para recorrer los años';
  const info = i => {
    const el = infoRef.current; if (!el) return;
    if (i == null) { el.textContent = ayuda; el.classList.add('gv-muted'); return; }
    const { j, f } = items[i];
    el.classList.remove('gv-muted');
    el.textContent = `${j.nombre} · ${fmt(f)}${showPlat && j.plataformaNombre ? ' · ' + j.plataformaNombre : ''}${hecho(j) ? ' · ✔ terminado' : ''}`;
  };
  const tarjeta = React.useRef(null);
  const sobre = e => {
    const b = e.target.closest('[data-i]');
    info(b ? Number(b.dataset.i) : null);
    if (b) tarjeta.current?.show(items[Number(b.dataset.i)], b); else tarjeta.current?.hide();
  };
  if (!cols.length) return <p className="gv-muted">No hay juegos con esta fecha{eje === 'terminado' ? ' (aún no te has pasado ninguno de esta consola)' : ''}.</p>;
  return (
    <div className="tl2">
      <div className="tl2-scroll" ref={ref} onMouseOver={sobre} onMouseLeave={() => { info(null); tarjeta.current?.hide(); }} onFocus={sobre} onScroll={() => tarjeta.current?.hide()}>
        <div className="tl2-track">
          {cols.map(c => c.gap ? (
            <div key={c.key} className="tl2-gap" title={`Sin juegos: ${c.gap}`}><div className="tl2-tick"><span>{c.gap}</span></div></div>
          ) : (
            <div key={c.key} className={'tl2-year' + (c.key === 'sin' ? ' sin' : '')}>
              <div className="tl2-pila">
                {c.n > POR_ANIO && (
                  <button className="tl2-more" onClick={() => onMore(c.label, c.todos)} title={`Ver los ${c.n} juegos de ${c.label}`}>+{c.n - POR_ANIO}</button>
                )}
                {c.vis.map(i => {
                  const { j } = items[i];
                  const img = firstImg(j.imagenes, 200);
                  return (
                    <button key={j.id} data-i={i} className={'tl2-game' + (activeId === j.id ? ' on' : '') + (hecho(j) ? ' hecho' : '')}
                      onClick={() => onOpen(j)} aria-label={`${j.nombre}, ${fmt(items[i].f)}`}>
                      {img ? <img src={img} alt="" loading="lazy" decoding="async" width="72" height="96"/> : <span>{j.nombre.slice(0, 24)}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="tl2-tick"><span>{c.label}</span><b>{c.n}</b></div>
            </div>
          ))}
        </div>
      </div>
      <HoverCard ref={tarjeta} hecho={hecho} fmt={fmt}/>
      <div className="tl2-info gv-muted" ref={infoRef}>{ayuda}{sin > 0 && eje === 'terminado' ? ` · ${sin} sin terminar` : ''}</div>
    </div>
  );
}

/* Ficha ampliada al pasar el ratón por una carátula de la línea temporal (como en las versiones anteriores).
 * Tiene su propio estado: al moverse por las carátulas solo se vuelve a pintar esta tarjeta. */
const HoverCard = React.forwardRef(function HoverCard({ hecho, fmt }, ref) {
  const [st, setSt] = useState(null);
  const tm = React.useRef(null);
  React.useImperativeHandle(ref, () => ({
    show(item, el) {
      clearTimeout(tm.current);
      tm.current = setTimeout(() => {
        const r = el.getBoundingClientRect();
        const z = parseFloat(document.documentElement.style.zoom) || 1;   // zoom de CSS (web): pasar a px de la página
        const W = 300, vw = window.innerWidth / z, vh = window.innerHeight / z;
        const L = r.left / z, R = r.right / z, T = r.top / z;
        let left = R + 12; if (left + W > vw - 8) left = L - W - 12; if (left < 8) left = Math.max(8, Math.min(vw - W - 8, L));
        const top = Math.max(8, Math.min(T - 40, vh - 420));
        setSt({ item, left, top });
      }, 90);
    },
    hide() { clearTimeout(tm.current); setSt(null); },
  }), []);
  if (!st) return null;
  const { j, f } = st.item;
  const img = firstImg(j.imagenes, 640);
  const cf = j._cf;
  const filas = [
    ['Consola', j.plataformaNombre],
    ['Fecha', fmt(f)],
    ['Género', j.genero],
    ['Desarrolla', j.desarrolladora],
    ['Historia', j.hltbMain > 0 ? `${Math.round(j.hltbMain * 10) / 10} h` : null],
    ['Tu nota', j.valoracion ? `${j.valoracion}/10` : null],
    ['Unidades', j.unidades > 1 ? `×${j.unidades}` : null],
    ['Prestado a', j.prestadoA],
  ].filter(x => x[1]);
  return (
    <div className="tl2-hover" style={{ left: st.left, top: st.top }} role="tooltip">
      <div className="tl2-hover-img">{img ? <img src={img} alt=""/> : <Gamepad2 size={40}/>}</div>
      <div className="tl2-hover-body">
        <b>{j.nombre}</b>
        {hecho(j) && <span className="tl2-hover-cf">✔ Terminado{cf.y ? ` en ${cf.y}` : ''}{cf.r != null ? ` · ${'★'.repeat(Math.min(5, Math.round(cf.r)))}` : ''}{cf.h ? ` · ${cf.h} h` : ''}</span>}
        <dl>{filas.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
        <small>Pulsa para abrir la ficha</small>
      </div>
    </div>
  );
});
