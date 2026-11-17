import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, Monitor, Clock, Euro, BookOpen, Trophy, CalendarDays, Tags, Hourglass, X } from 'lucide-react';
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
  const [sel, setSel] = useState(null);                     // { titulo, juegos } — lo que se ha pulsado
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
  const hecho = j => j._cf?.e === 'terminado';

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
        {/* ── Consolas ── */}
        <section className="st-card st-wide">
          <h2 className="st-h"><Monitor size={15}/> Juegos por consola
            {cf.disponible && <span className="st-leyenda"><i className="st-sw st-sw-done"/> terminados <i className="st-sw"/> por jugar</span>}</h2>
          <div className="st-bars">
            {porConsola.map(({ p, js, n, t, img }) => (
              <button key={p.id} className={'st-bar' + (sel?.k === 'p' + p.id ? ' on' : '')} onClick={() => abrir(p.nombre, js, 'p' + p.id)}
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
          </div>
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

