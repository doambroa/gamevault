import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, Clock, Trophy, Shuffle, Target, Check, Hourglass, Archive, ExternalLink } from 'lucide-react';
import GameCard from '../../components/GameCard';
import JuegoPanel from '../Juegos/JuegoPanel';
import JuegoForm from '../Juegos/JuegoForm';
import '../Juegos/JuegoPanel.css';
import { EmptyState } from '../../components/ui/index';
import { useCollapse, GroupHead, CollapseAll } from '../../utils/useCollapse';
import { useCreditos, findCredito } from '../../community/creditos';
import './Pila.css';

/* La pila de la vergüenza: lo que tienes y aún no te has pasado.
 * «Terminado» sale de Créditos Finales; los juegos sin historia que acabar (Mario Kart, Smash…)
 * se pueden marcar como «No tiene final» para que no cuenten. Cada mes propone un reto con dos
 * de los más cortos (el mismo en todos tus aparatos; se puede cambiar). */
const api = window.api;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const TRAMOS = [
  { k: 'tarde', t: 'Para una tarde', s: 'menos de 5 h', min: 0, max: 5 },
  { k: 'finde', t: 'Para un finde', s: '5 – 15 h', min: 5, max: 15 },
  { k: 'semanas', t: 'Para unas semanas', s: '15 – 40 h', min: 15, max: 40 },
  { k: 'pozo', t: 'Pozos sin fondo', s: 'más de 40 h', min: 40, max: Infinity },
];
const fmtH = h => `${Math.round(h).toLocaleString('es-ES')} h`;
// número «aleatorio» fijo para un mes: el reto es el mismo en el PC, el móvil y la web
const semilla = (n) => { let x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); };

export default function PilaPage() {
  const cf = useCreditos();
  const [juegos, setJuegos] = useState(null);
  const [plats, setPlats] = useState([]);
  const [platF, setPlatF] = useState('');
  const [panel, setPanel] = useState(null);
  const [edit, setEdit] = useState(null);
  const pleg = useCollapse('pila');
  const hoy = new Date();
  const mesKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const [giro, setGiro] = useState(() => { try { return Number(localStorage.getItem('gv-reto-' + mesKey)) || 0; } catch { return 0; } });

  const load = useCallback(async () => {
    const [j, p] = await Promise.all([api.juegos.getAll({}), api.plataformas.getAll()]);
    setJuegos(j); setPlats(p);
    setPanel(cur => (cur ? j.find(x => x.id === cur.id) || null : cur));
  }, []);
  useEffect(() => { if (api) load(); }, [load]);
  useEffect(() => {
    if (!api?.onChanged) return;
    let t; const off = api.onChanged(() => { clearTimeout(t); t = setTimeout(load, 400); });
    return () => { clearTimeout(t); off(); };
  }, [load]);

  const platPorId = useMemo(() => Object.fromEntries(plats.map(p => [p.id, p])), [plats]);
  const todos = useMemo(() => (juegos || []).map(j => ({ ...j, plataformaNombre: platPorId[j.plataformaId]?.nombre || '', _cf: findCredito(cf.idx, j) })), [juegos, platPorId, cf]);
  const hecho = j => j._cf?.e === 'terminado';
  const pila = useMemo(() => todos.filter(j => !j.sinFinal && !hecho(j)), [todos]);
  const vista = useMemo(() => pila.filter(j => !platF || String(j.plataformaId) === platF), [pila, platF]);
  const sinFinal = todos.filter(j => j.sinFinal).length;
  const terminados = todos.filter(hecho).length;
  const contables = todos.length - sinFinal;
  const horas = vista.reduce((n, j) => n + (j.hltbMain > 0 ? j.hltbMain : 0), 0);
  const sinDato = vista.filter(j => !(j.hltbMain > 0)).length;
  const esteMes = (cf.lista || []).filter(g => g.e === 'terminado' && String(g.d || '').startsWith(mesKey)).length;

  // Reto del mes: dos de los 12 más cortos de la pila
  const reto = useMemo(() => {
    const cortos = pila.filter(j => j.hltbMain > 0).sort((a, b) => a.hltbMain - b.hltbMain || a.id - b.id).slice(0, 12);
    if (cortos.length < 2) return [];
    const base = hoy.getFullYear() * 12 + hoy.getMonth() + giro * 101;
    const i = Math.floor(semilla(base) * cortos.length);
    let k = Math.floor(semilla(base + 7) * (cortos.length - 1)); if (k >= i) k++;
    return [cortos[i], cortos[k]];
  }, [pila, giro]); // eslint-disable-line react-hooks/exhaustive-deps
  // Los del reto que ya están hechos (si te los pasas, salen de la pila; se buscan en todos)
  const [retoIds, setRetoIds] = useState(null);
  useEffect(() => {
    const k = 'gv-reto-ids-' + mesKey + '-' + giro;
    let guard = null; try { guard = JSON.parse(localStorage.getItem(k)); } catch {}
    if (guard && guard.length === 2) setRetoIds(guard);
    else if (reto.length === 2) { const ids = reto.map(j => j.id); setRetoIds(ids); try { localStorage.setItem(k, JSON.stringify(ids)); } catch {} }
  }, [reto, mesKey, giro]);
  const retoJuegos = (retoIds || []).map(id => todos.find(j => j.id === id)).filter(Boolean);
  const retoHechos = retoJuegos.filter(hecho).length;
  const otroReto = () => { const g = giro + 1; setGiro(g); setRetoIds(null); try { localStorage.setItem('gv-reto-' + mesKey, String(g)); } catch {} };

  const olvidados = useMemo(() => vista.filter(j => j.fechaAdquisicion).sort((a, b) => String(a.fechaAdquisicion).localeCompare(String(b.fechaAdquisicion))).slice(0, 6), [vista]);
  const grupos = useMemo(() => {
    const g = TRAMOS.map(t => ({ ...t, js: vista.filter(j => j.hltbMain > 0 && j.hltbMain >= t.min && j.hltbMain < t.max).sort((a, b) => a.hltbMain - b.hltbMain) }));
    g.push({ k: 'sindato', t: 'Sin saber cuánto duran', s: 'sin dato de HowLongToBeat', js: vista.filter(j => !(j.hltbMain > 0)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) });
    return g.filter(x => x.js.length);
  }, [vista]);
  const consolas = useMemo(() => {
    const m = {}; for (const j of pila) m[j.plataformaId] = (m[j.plataformaId] || 0) + 1;
    return Object.entries(m).map(([id, n]) => ({ id, n, nombre: platPorId[id]?.nombre || '?' })).sort((a, b) => b.n - a.n);
  }, [pila, platPorId]);

  if (!juegos) return <div className="page"><p style={{ color: 'var(--text-2)' }}>Cargando…</p></div>;
  const pct = contables ? Math.round((terminados / contables) * 100) : 0;
  const card = j => <GameCard key={j.id} juego={j} showPlat={!platF} credito={j._cf} metric="hltbMain" active={panel?.id === j.id} onClick={() => setPanel(j)}/>;

  return (
    <div className={'page' + (panel ? ' con-panel' : '')}>
      <div className="page-header">
        <div>
          <h1 className="page-title">La pila de la vergüenza</h1>
          <p className="page-sub">Lo que tienes y aún no te has pasado</p>
        </div>
        {cf.url && <a className="btn btn-secondary" href={cf.url} target="_blank" rel="noreferrer"><Trophy size={14}/> Créditos Finales <ExternalLink size={12}/></a>}
      </div>

      {!cf.disponible && (
        <div className="pila-aviso">Sin <b>Créditos Finales</b> no sé qué juegos te has pasado, así que aquí salen todos. Entra con tu cuenta (es la misma) para que los terminados se descuenten solos.</div>
      )}

      <div className="pila-hero">
        <div className="pila-hero-n"><Layers size={22}/><b>{vista.length}</b><span>juegos sin terminar{platF ? ` en ${platPorId[platF]?.nombre}` : ''}</span></div>
        <div className="pila-hero-n"><Clock size={22}/><b>{fmtH(horas)}</b><span>de historia por delante{sinDato ? ` (+${sinDato} sin dato)` : ''}</span></div>
        <div className="pila-hero-n"><Hourglass size={22}/><b>{Math.ceil(horas / 2).toLocaleString('es-ES')} días</b><span>jugando 2 horas al día ({(horas / 2 / 365).toLocaleString('es-ES', { maximumFractionDigits: 1 })} años)</span></div>
        {cf.disponible && (
          <div className="pila-hero-n pct"><Trophy size={22}/><b>{pct} %</b><span>de la colección terminada ({terminados} de {contables})</span>
            <i className="pila-bar"><i style={{ width: pct + '%' }}/></i></div>
        )}
      </div>

      {retoJuegos.length === 2 && (
        <section className={'pila-reto' + (retoHechos === 2 ? ' hecho' : '')}>
          <div className="pila-reto-h">
            <Target size={18}/>
            <div><b>Reto de {MESES[hoy.getMonth()]}: pásate estos dos</b>
              <small>{retoHechos === 2 ? '¡Reto cumplido! 🎉' : `${retoHechos} de 2 · ${fmtH(retoJuegos.reduce((n, j) => n + (j.hltbMain || 0), 0))} en total`}{esteMes ? ` · este mes llevas ${esteMes} terminado${esteMes > 1 ? 's' : ''}` : ''}</small></div>
            {retoHechos < 2 && <button className="btn btn-ghost btn-sm" onClick={otroReto} title="Proponer otros dos"><Shuffle size={13}/> Otros dos</button>}
          </div>
          <div className="pila-reto-js">
            {retoJuegos.map(j => (
              <div key={j.id} className={'pila-reto-j' + (hecho(j) ? ' ok' : '')}>
                {card(j)}
                {hecho(j) && <span className="pila-reto-ok"><Check size={14}/> Hecho</span>}
              </div>
            ))}
          </div>
          {!cf.disponible && <p className="gv-muted" style={{ marginTop: 8 }}>Cuando lo apuntes en Créditos Finales, aquí se marcará como hecho.</p>}
        </section>
      )}

      {consolas.length > 1 && (
        <div className="lz-chips pila-chips">
          <button className={'lz-chip' + (!platF ? ' on' : '')} onClick={() => setPlatF('')}>Todas <span>{pila.length}</span></button>
          {consolas.map(c => <button key={c.id} className={'lz-chip' + (platF === c.id ? ' on' : '')} onClick={() => setPlatF(c.id)}>{c.nombre} <span>{c.n}</span></button>)}
        </div>
      )}

      {vista.length === 0 ? (
        <EmptyState icon={<Trophy size={52}/>} title="¡Pila vacía!" description={todos.length ? 'Te has pasado todo lo que tienes aquí. Eres una leyenda.' : 'Aún no tienes juegos en la colección.'}/>
      ) : (<>
        {olvidados.length > 2 && (
          <section className="pila-sec">
            <GroupHead closed={pleg.isClosed('olvidados')} onToggle={() => pleg.toggle('olvidados')}><Archive size={15}/> Los más olvidados <span className="grp-n">comprados hace más tiempo</span></GroupHead>
            {!pleg.isClosed('olvidados') && <div className="gcard-grid gcard-grid-sm">{olvidados.map(card)}</div>}
          </section>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><CollapseAll ids={['olvidados', ...grupos.map(g => g.k)]} c={pleg}/></div>
        {grupos.map(g => (
          <section key={g.k} className="pila-sec">
            <GroupHead closed={pleg.isClosed(g.k)} onToggle={() => pleg.toggle(g.k)}>{g.t} <span className="grp-n">· {g.s} · {g.js.length} juego{g.js.length !== 1 ? 's' : ''}</span></GroupHead>
            {!pleg.isClosed(g.k) && <div className="gcard-grid gcard-grid-sm">{g.js.map(card)}</div>}
          </section>
        ))}
        {sinFinal > 0 && <p className="gv-muted pila-pie">{sinFinal} juego{sinFinal !== 1 ? 's' : ''} marcado{sinFinal !== 1 ? 's' : ''} como «No tiene final» no cuentan. Se marca en la ficha de cada juego.</p>}
      </>)}

      <JuegoPanel juego={panel} plataforma={panel ? platPorId[panel.plataformaId] : null} open={!!panel}
        onClose={() => setPanel(null)} onEdit={() => setEdit(panel)} onRefresh={load}/>
      <JuegoForm open={!!edit} initial={edit} plataformas={plats}
        onClose={() => setEdit(null)}
        onSave={async data => { await api.juegos.update({ id: edit.id, ...data }); setEdit(null); await load(); }}/>
    </div>
  );
}
