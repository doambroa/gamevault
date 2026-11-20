import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, Plus, Pencil, ChevronLeft, ChevronRight, Check, Crown, ListChecks, Clock, Trophy, Users, Loader, Gamepad2, Radio } from 'lucide-react';
import { Btn, EmptyState } from '../components/ui/index';
import { votarPorra, ganadorPorra } from '../community/account';
import { Avatar } from '../community/ui';
import { thumb } from '../utils/imgSrc';
import { quedan } from './util';
import { PorraEditor } from './RetosAdmin';

const iniciales = n => { const p = String(n || '').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean); return (p.length > 1 ? p[0][0] + p[1][0] : (p[0] || '?').slice(0, 2)).toUpperCase(); };
const fmtFecha = iso => iso ? new Date(iso).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';

export default function PorraView({ data, me, recargar, selId, onSel }) {
  const porras = data.porras || [];
  const [editar, setEditar] = useState(null);
  const def = porras.find(p => p.estado === 'abierta' && !p.cerrada) || porras.find(p => p.estado === 'abierta') || porras[0];
  const po = porras.find(p => p.id === selId) || def;
  return (
    <>
      {(porras.length > 1 || data.admin) && (
        <div className="retos-chips">
          {porras.map(p => (
            <button key={p.id} className={'retos-chip porra' + (p.id === po?.id ? ' on' : '')} onClick={() => onSel(p.id)}>
              <Award size={15}/><span><b>{p.titulo}</b><small>{p.estado === 'borrador' ? 'Borrador (solo lo ves tú)' : p.cerrada ? (p.ganadoresPuestos ? 'Resultados' : 'Cerrada · esperando a la gala') : 'Abierta'}</small></span>
            </button>
          ))}
          {data.admin && <button className="retos-chip nuevo" onClick={() => setEditar({})}><Plus size={15}/><span><b>Nueva porra</b><small>Con los nominados de los Game Awards 2026 ya cargados</small></span></button>}
        </div>
      )}
      {!po ? (
        <EmptyState icon={<Award size={52}/>} title="No hay ninguna porra abierta"
          description={data.admin ? 'Crea la de este año con «Nueva porra»: ya vienen las categorías y los nominados con sus portadas.' : 'Cuando se abra la porra de los Game Awards, aquí podrás elegir tus favoritos categoría a categoría.'}/>
      ) : <Porra key={po.id} po={po} me={me} admin={data.admin} gente={data.gente || []} recargar={recargar} onEditar={() => setEditar(po)}/>}
      {editar && <PorraEditor po={editar.id ? editar : null} onClose={() => setEditar(null)} onSaved={async p => { setEditar(null); await recargar(); if (p?.id) onSel(p.id); }}/>}
    </>
  );
}

function Porra({ po: poProp, me, admin, gente, recargar, onEditar }) {
  const [po, setPo] = useState(poProp);
  useEffect(() => setPo(poProp), [poProp]);
  const cats = po.categorias || [];
  const [para, setPara] = useState('');                  // el administrador vota por otra persona
  const votosPara = useMemo(() => {
    if (!para) return null;
    const p = (po.participantes || []).find(x => x.quien?.key === para || ('@' + (x.quien?.alias || '')) === para);
    return p?.votos || {};
  }, [para, po.participantes]);
  const [mios, setMios] = useState(po.mios || {});
  useEffect(() => setMios(para ? (votosPara || {}) : (po.mios || {})), [po.mios, para, votosPara]);
  const abierta = po.estado === 'abierta' && !po.cerrada;
  const puedeVotar = abierta || (admin && !!para);
  const primeraLibre = cats.findIndex(c => !mios[c.id]);
  const [paso, setPaso] = useState(() => (abierta && primeraLibre >= 0 && Object.keys(po.mios || {}).length === 0 ? 0 : -1));   // -1 = resumen
  const [guardado, setGuardado] = useState('');
  const [modoGala, setModoGala] = useState(false);

  // Durante la gala (porra cerrada y faltan ganadores) se refresca sola para ver la clasificación en directo
  useEffect(() => {
    if (!po.cerrada || po.ganadoresPuestos >= cats.length) return;
    const t = setInterval(() => { if (!document.hidden) recargar(); }, 30000);
    return () => clearInterval(t);
  }, [po.cerrada, po.ganadoresPuestos, cats.length, recargar]);

  const elegir = async (cat, nom) => {
    if (!puedeVotar) return;
    const antes = mios[cat.id];
    const nuevo = antes === nom.id ? '' : nom.id;
    setMios(m => { const x = { ...m }; if (nuevo) x[cat.id] = nuevo; else delete x[cat.id]; return x; });
    setGuardado('guardando');
    try {
      await votarPorra(po.id, cat.id, nuevo, para || undefined);
      setGuardado('ok');
      if (nuevo && !antes) setTimeout(() => setPaso(p => {
        if (p < 0) return p;
        const sig = cats.findIndex((c, k) => k > p && !(c.id === cat.id ? nuevo : mios[c.id]));
        return sig >= 0 ? sig : p + 1 < cats.length ? p + 1 : -1;
      }), 420);
      if (para) recargar();
    } catch (e) {
      setGuardado('');
      setMios(m => { const x = { ...m }; if (antes) x[cat.id] = antes; else delete x[cat.id]; return x; });
      alert(e.message);
    }
  };
  const marcarGanador = async (cat, nom) => {
    const nuevo = cat.ganador === nom.id ? '' : nom.id;
    try { const r = await ganadorPorra(po.id, cat.id, nuevo); setPo(r.porra); recargar(); } catch (e) { alert(e.message); }
  };

  // teclado: ← →
  useEffect(() => {
    if (paso < 0) return;
    const fn = e => {
      if (/input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') setPaso(p => Math.min(cats.length - 1, p + 1));
      if (e.key === 'ArrowLeft') setPaso(p => Math.max(0, p - 1));
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [paso, cats.length]);

  const hechos = cats.filter(c => mios[c.id]).length;
  const q = po.cierre ? quedan(po.cierre) : null;

  return (
    <div className="po-view">
      <div className="po-hero">
        <div className="po-hero-ico"><Trophy size={32}/></div>
        <div className="po-hero-txt">
          <h2>{po.titulo}</h2>
          <p>
            {po.estado === 'borrador' ? 'Borrador: nadie más la ve todavía.' : abierta ? <>Abierta · {q ? <>se cierra en <b>{q}</b></> : 'sin hora de cierre'}</> : po.ganadoresPuestos ? `Resultados · ${po.ganadoresPuestos} de ${cats.length} categorías decididas` : 'Cerrada · esperando a la gala'}
            {po.cierre && abierta && <small> ({fmtFecha(po.cierre)})</small>}
          </p>
          {po.intro && <p className="po-intro">{po.intro}</p>}
        </div>
        <div className="pl-hero-acc">
          {admin && <Btn variant="ghost" size="sm" onClick={onEditar}><Pencil size={14}/> Editar</Btn>}
          {admin && po.cerrada && <Btn variant={modoGala ? 'primary' : 'secondary'} size="sm" onClick={() => setModoGala(m => !m)}><Radio size={14}/> {modoGala ? 'Terminar de marcar' : 'Marcar ganadores'}</Btn>}
        </div>
      </div>

      {admin && (abierta || po.estado === 'borrador' || po.cerrada) && (
        <div className="po-para">
          <Users size={15}/>
          <span>Votar como:</span>
          <select className="field-input field-select" value={para} onChange={e => { setPara(e.target.value); setPaso(-1); }} aria-label="Votar como">
            <option value="">Yo</option>
            {gente.filter(g => g.pending).map(g => <option key={g.user} value={g.user}>{g.display}{g.pending ? ' (sin reclamar)' : ''}</option>)}
            {(po.participantes || []).filter(p => p.quien?.sinCuenta).map(p => <option key={p.quien.key} value={p.quien.key}>{p.quien.display} (sin cuenta)</option>)}
          </select>
          <button className="gv-link" onClick={() => { const a = window.prompt('Apodo de la persona sin cuenta (p. ej. mario64)'); if (a && a.trim()) { setPara('@' + a.trim().replace(/^@/, '')); setPaso(0); } }}>+ otra persona sin cuenta</button>
          {para && <small>Lo que elijas ahora se guarda como suyo.</small>}
        </div>
      )}

      {!po.cerrada && <Participantes po={po} total={cats.length}/>}

      {po.cerrada && !para
        ? <Resultados po={po} me={me} modoGala={modoGala && admin} onGanador={marcarGanador}/>
        : paso >= 0 && cats[paso]
          ? <Paso po={po} cats={cats} paso={paso} setPaso={setPaso} mios={mios} elegir={elegir} puede={puedeVotar} guardado={guardado}/>
          : <Resumen cats={cats} mios={mios} hechos={hechos} abierta={puedeVotar} irA={setPaso} guardado={guardado} para={para}/>}
    </div>
  );
}

function Participantes({ po, total }) {
  const p = po.participantes || [];
  if (!p.length) return null;
  return (
    <div className="pl-gente po-gente" title="Quién ha votado (lo que ha elegido cada uno se ve cuando se cierre)">
      {p.map(x => (
        <span key={x.quien?.key} className={'pl-persona' + (x.n >= total ? ' lleno' : '')}>
          <Avatar user={x.quien} size={26}/><b>{x.quien?.display}</b><small>{x.n >= total ? <Check size={12}/> : `${x.n}/${total}`}</small>
        </span>
      ))}
    </div>
  );
}

function Tarjeta({ nom, sel, onClick, ganador, votantes, disabled, grande }) {
  const img = nom.img ? thumb(nom.img, grande ? 640 : 420) : null;
  return (
    <button type="button" className={'po-card' + (sel ? ' sel' : '') + (ganador ? ' win' : '') + (img ? '' : ' sin-img')} onClick={onClick} disabled={disabled} aria-pressed={!!sel}>
      <span className="po-card-img">
        {img ? <img src={img} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }}/> : <span className="po-card-ini">{iniciales(nom.n)}</span>}
        {sel && <span className="po-card-check"><Check size={18}/></span>}
        {ganador && <span className="po-card-crown"><Crown size={16}/> Ganador</span>}
      </span>
      <span className="po-card-n">{nom.n}</span>
      {nom.sub && <span className="po-card-sub">{nom.sub}</span>}
      {votantes && votantes.length > 0 && <span className="po-card-votos">{votantes.map(v => <Avatar key={v.key} user={v} size={20}/>)}</span>}
    </button>
  );
}

function Paso({ po, cats, paso, setPaso, mios, elegir, puede, guardado }) {
  const cat = cats[paso];
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [paso]);
  return (
    <div className="po-paso" ref={ref}>
      <div className="po-dots" role="tablist" aria-label="Categorías">
        {cats.map((c, k) => <button key={c.id} className={(k === paso ? 'on ' : '') + (mios[c.id] ? 'hecho' : '')} title={c.nombre} onClick={() => setPaso(k)} aria-label={c.nombre}/>)}
      </div>
      <div className="po-cat-h">
        <small>Categoría {paso + 1} de {cats.length}{cat.puntos > 1 && <b className="po-pts"> · vale {cat.puntos} puntos</b>}</small>
        <h3>{cat.nombre}</h3>
        {cat.en && <span className="po-en">{cat.en}</span>}
      </div>
      <div className="po-grid">
        {cat.nominados.map(n => <Tarjeta key={n.id} nom={n} grande sel={mios[cat.id] === n.id} onClick={() => elegir(cat, n)} disabled={!puede}/>)}
      </div>
      <div className="po-nav">
        <Btn variant="ghost" onClick={() => setPaso(p => p - 1)} disabled={paso === 0}><ChevronLeft size={16}/> Anterior</Btn>
        <span className={'po-guardado ' + guardado}>{guardado === 'guardando' ? <><Loader size={13} className="spin"/> Guardando…</> : guardado === 'ok' ? <><Check size={13}/> Guardado</> : 'Pulsa en tu favorito'}</span>
        {paso < cats.length - 1
          ? <Btn variant="secondary" onClick={() => setPaso(p => p + 1)}>Siguiente <ChevronRight size={16}/></Btn>
          : <Btn onClick={() => setPaso(-1)}><ListChecks size={16}/> Ver resumen</Btn>}
      </div>
      <button className="gv-link po-ir-resumen" onClick={() => setPaso(-1)}>Ver el resumen de todo lo que llevo</button>
    </div>
  );
}

function Resumen({ cats, mios, hechos, abierta, irA, guardado, para }) {
  const faltan = cats.length - hechos;
  return (
    <div className="po-resumen">
      <div className="po-res-h">
        <h3>{para ? 'Lo que lleva elegido' : 'Tu porra'}</h3>
        <p>{faltan === 0 ? <><Check size={15}/> Completa: {cats.length} de {cats.length}. {abierta ? 'Puedes cambiar lo que quieras hasta el cierre.' : ''}</> : <>Llevas {hechos} de {cats.length}{abierta && <> · te {faltan === 1 ? 'falta 1' : `faltan ${faltan}`}</>}</>}
          {guardado === 'ok' && <span className="po-guardado ok"> · <Check size={13}/> Todo guardado</span>}</p>
        {abierta && <div className="pl-prog po-prog"><i style={{ width: Math.round(hechos / Math.max(1, cats.length) * 100) + '%' }}/></div>}
        {abierta && faltan > 0 && <Btn onClick={() => irA(cats.findIndex(c => !mios[c.id]))}>{hechos ? 'Seguir donde lo dejé' : 'Empezar'} <ChevronRight size={16}/></Btn>}
      </div>
      <div className="po-res-grid">
        {cats.map((c, k) => {
          const n = c.nominados.find(x => x.id === mios[c.id]);
          return (
            <button key={c.id} className={'po-res-item' + (n ? '' : ' falta')} onClick={() => abierta && irA(k)} disabled={!abierta}>
              <span className="po-res-img">{n?.img ? <img src={thumb(n.img, 200)} alt="" loading="lazy"/> : <Gamepad2 size={18}/>}</span>
              <span className="po-res-txt"><small>{c.nombre}{c.puntos > 1 ? ` · ${c.puntos} pts` : ''}</small><b>{n ? n.n : 'Sin elegir'}</b>{n?.sub && <i>{n.sub}</i>}</span>
              {abierta && <Pencil size={13} className="po-res-ed"/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Resultados({ po, me, modoGala, onGanador }) {
  const cats = po.categorias || [];
  const part = po.participantes || [];
  const rank = [...part].sort((a, b) => (b.puntos || 0) - (a.puntos || 0) || (b.aciertos || 0) - (a.aciertos || 0) || String(a.quien?.display).localeCompare(String(b.quien?.display)));
  let pos = 0, prev = null;
  const conPos = rank.map((r, k) => { if (prev === null || r.puntos !== prev) pos = k + 1; prev = r.puntos; return { ...r, pos }; });
  const total = cats.reduce((s, c) => s + (c.puntos || 1), 0);
  const votantesDe = (cat, nomId) => part.filter(p => p.votos?.[cat.id] === nomId).map(p => p.quien);
  return (
    <div className="po-result">
      <div className="po-rank">
        <h3><Trophy size={18}/> Clasificación {po.ganadoresPuestos < cats.length && <small>({po.ganadoresPuestos} de {cats.length} categorías decididas{po.ganadoresPuestos ? '' : ': se va llenando durante la gala'})</small>}</h3>
        {conPos.length === 0 && <p className="gv-muted">Nadie votó en esta porra.</p>}
        <ol>
          {conPos.map(r => (
            <li key={r.quien?.key} className={(r.pos === 1 && po.ganadoresPuestos ? 'oro ' : '') + (r.quien?.user === me.user ? 'yo' : '')}>
              <span className="po-pos">{r.pos === 1 && po.ganadoresPuestos ? <Crown size={16}/> : r.pos}</span>
              <Avatar user={r.quien} size={30}/>
              <b>{r.quien?.display}</b>
              <span className="po-pts-n">{r.puntos || 0}<small> / {total} pts</small></span>
              <small className="po-ac">{r.aciertos || 0} acierto{r.aciertos === 1 ? '' : 's'}</small>
            </li>
          ))}
        </ol>
      </div>
      {modoGala && <div className="pl-aviso"><Radio size={15}/> Modo gala: pulsa en el ganador de cada categoría según lo vayan anunciando. La clasificación se actualiza para todos.</div>}
      {cats.map(c => (
        <section key={c.id} className="po-cat-res">
          <h4>{c.nombre}{c.puntos > 1 && <small> · {c.puntos} pts</small>}{!c.ganador && <small className="po-pend"> · <Clock size={12}/> sin decidir</small>}</h4>
          <div className="po-grid peq">
            {c.nominados.map(n => <Tarjeta key={n.id} nom={n} ganador={c.ganador === n.id} sel={false} votantes={votantesDe(c, n.id)} disabled={!modoGala} onClick={() => onGanador(c, n)}/>)}
          </div>
        </section>
      ))}
    </div>
  );
}

