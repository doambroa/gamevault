import React, { useState, useEffect, useMemo } from 'react';
import { findPlatform } from '../../utils/platformMatch';
import { Download, ArrowRight, ArrowLeft, Check, Gamepad2, Loader, Sparkles, Trophy, Table2 } from 'lucide-react';
import { CONSOLAS, MARCAS_PRINCIPALES, imagenDeConsola, claveConsola } from '../../data/consolas';
import { useAccount, misCreditos, reclamoGuardado, olvidarReclamo, reclamarSinRecargar } from '../../community/account';
import { getGameDetails } from '../../utils/rawg';
import { thumb } from '../../utils/imgSrc';
import './Onboarding.css';

const api = window.api;

const TODAS_LAS_CONSOLAS = CONSOLAS;
const MARCAS = ['Todas', ...MARCAS_PRINCIPALES, 'Ordenadores', 'Otras'];
const pasaFiltro = (c, f) => f === 'Todas' ? true
  : f === 'Ordenadores' ? c.tipo === 'Ordenador'
  : f === 'Otras' ? !MARCAS_PRINCIPALES.includes(c.marca) && c.tipo !== 'Ordenador'
  : c.marca === f;

// Imagen de la tarjeta; si no carga, las iniciales
function Avatar({ c }) {
  const src = imagenDeConsola(c);
  const [ok, setOk] = useState(!!src);
  return (
    <div className={'ob-consola-avatar' + (ok ? ' ob-consola-avatar-img' : '')}>
      {ok ? <img src={src} alt="" loading="lazy" onError={() => setOk(false)}/> : c.nombre.slice(0, 2).toUpperCase()}
    </div>
  );
}

const claveDe = c => c.img || claveConsola(c.nombre);
const normT = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

/* «Ya tienes juegos apuntados»: perfiles de la tabla de préstamos a tu nombre (sugeridos por el administrador
 * o del enlace que has aceptado) y lo que tienes en Créditos Finales. Las consolas de la tabla salen marcadas
 * y sus juegos se añaden solos; los de Créditos Finales se eligen en un paso aparte (allí no consta la consola). */
function useApuntados() {
  const { me } = useAccount();
  const [cf, setCf] = useState(null);
  const perfiles = useMemo(() => {
    if (!me) return [];
    const l = (me.claimable || []).map(p => ({ ...p, code: '' }));
    const r = reclamoGuardado();
    if (r && !l.some(p => p.id === r.id)) l.push(r);
    return l;
  }, [me]);
  useEffect(() => {
    if (!me || me.creditos === false) { setCf([]); return; }
    misCreditos().then(r => setCf(r.juegos || [])).catch(() => setCf([]));
  }, [me]);
  return { me, perfiles, cf: cf || [], cargando: !!me && cf === null };
}

export default function OnboardingPage({ onComplete }) {
  const ap = useApuntados();
  const [step,     setStep]     = useState('welcome');
  const [selected, setSelected] = useState(new Set());
  const [filtro,   setFiltro]   = useState('Todas');
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState('');
  // Consolas que ya existen (p.ej. de la colección inicial) → no se duplican
  const [existentes, setExistentes] = useState([]);
  useEffect(() => { api?.plataformas.getAll().then(setExistentes).catch(() => {}); }, []);
  const yaLaTienes = nombre => !!findPlatform(nombre, existentes);
  // consolas que llegan con la tabla → marcadas (y fijas) en la lista
  const deTabla = useMemo(() => {
    const m = new Map();
    for (const p of ap.perfiles) for (const c of p.consolas || []) { const k = claveConsola(c.n); m.set(k, (m.get(k) || 0) + (c.j || 0)); }
    return m;
  }, [ap.perfiles]);
  const titulosTabla = useMemo(() => new Set(ap.perfiles.flatMap(p => (p.titulos || []).map(normT))), [ap.perfiles]);
  const juegosTabla = ap.perfiles.reduce((s, p) => s + (p.juegos || 0), 0);
  const cfOfrecibles = useMemo(() => {
    const vistos = new Set();
    return ap.cf.filter(g => { const k = normT(g.t); if (!k || vistos.has(k) || titulosTabla.has(k)) return false; vistos.add(k); return true; });
  }, [ap.cf, titulosTabla]);
  const esDeTabla = c => deTabla.has(claveDe(c));
  // Juegos de Créditos Finales: consola elegida para cada uno ('' = no lo tengo)
  const [asignados, setAsignados] = useState({});
  const [plataformasRawg, setPlataformasRawg] = useState({});
  const [buscandoRawg, setBuscandoRawg] = useState(false);

  const handleImport = async () => {
    // En el onboarding no hay datos que perder, así que importamos directamente
    // sin el paso de confirmación (que se usa desde el sidebar cuando ya hay colección)
    const r = await api.io.import();
    if (!r || r.cancelled) return;
    // io:import ahora devuelve {needsConfirm, filePath} — confirmamos automáticamente
    const filePath = r.filePath;
    if (filePath) {
      const r2 = await api.io.importConfirm(filePath);
      if (r2?.ok) { await api.app.completeOnboarding(); onComplete(); }
    } else if (r?.ok) {
      // Fallback por si acaso
      await api.app.completeOnboarding(); onComplete();
    }
  };

  const toggle = nombre => !yaLaTienes(nombre) && !esDeTabla(TODAS_LAS_CONSOLAS.find(c => c.nombre === nombre) || { nombre }) && setSelected(s => {
    const next = new Set(s);
    next.has(nombre) ? next.delete(nombre) : next.add(nombre);
    return next;
  });

  // Consolas que tendrá la colección: las elegidas + las de la tabla
  const consolasFinales = useMemo(() => TODAS_LAS_CONSOLAS.filter(c => selected.has(c.nombre) || esDeTabla(c)), [selected, deTabla]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Paso de Créditos Finales: en qué consolas salió cada juego (RAWG) para proponer la suya
  const irACreditos = async () => {
    setStep('creditos');
    const claves = new Set(consolasFinales.map(claveDe));
    const propuesta = {};
    setBuscandoRawg(true);
    const pend = cfOfrecibles.filter(g => g.sid && String(g.sid).startsWith('rawg:') && !plataformasRawg[g.sid]);
    const encontrados = { ...plataformasRawg };
    for (let i = 0; i < pend.length; i += 5) {
      await Promise.all(pend.slice(i, i + 5).map(async g => {
        try { const d = await getGameDetails(String(g.sid).slice(5)); encontrados[g.sid] = (d.platforms || []).map(x => x.platform?.name).filter(Boolean); } catch { encontrados[g.sid] = []; }
      }));
    }
    setPlataformasRawg(encontrados);
    for (const g of cfOfrecibles) {
      if (asignados[g.t] !== undefined) { propuesta[g.t] = asignados[g.t]; continue; }
      const enRawg = (encontrados[g.sid] || []).map(claveConsola).filter(k => claves.has(k));
      const c = consolasFinales.find(x => claveDe(x) === enRawg[0]);
      propuesta[g.t] = c ? c.nombre : '';
    }
    setAsignados(propuesta);
    setBuscandoRawg(false);
  };

  // Guardar: primero los perfiles de la tabla (se suman en el servidor), luego las consolas elegidas
  // con su imagen por defecto (incluida en la app) y por último los juegos de Créditos Finales marcados
  const handleFinish = async () => {
    setSaving(true);
    for (const p of ap.perfiles) {
      setSaveMsg(`Añadiendo los ${p.juegos} juegos de la tabla de préstamos…`);
      try { await reclamarSinRecargar(p.id, p.code || ''); } catch (e) { console.warn('Reclamar', e); }
    }
    olvidarReclamo();
    let ya = existentes;
    try { ya = await api.plataformas.getAll(); setExistentes(ya); } catch {}
    const tiene = nombre => !!findPlatform(nombre, ya);
    const consolasSeleccionadas = TODAS_LAS_CONSOLAS.filter(c => selected.has(c.nombre) && !tiene(c.nombre) && !esDeTabla(c));
    let done = 0;
    for (const c of consolasSeleccionadas) {
      done++;
      setSaveMsg(`Añadiendo ${done}/${consolasSeleccionadas.length}: ${c.nombre}…`);
      await api.plataformas.create({
        nombre: c.nombre, marca: c.marca, modelo: '', tipo: c.tipo,
        fechaAdquisicion: '', fechaLanzamientoEuropa: c.fechaLanzamientoEuropa||'',
        fechaLanzamientoAmerica: '', fechaLanzamientoAsia: '',
        precio: '', precioSalida: c.precioSalida||'',
        precioAmerica: '', precioAsia: '',
        unidadesVendidas: c.unidadesVendidas||'',
        comentarios: '', imagenes: imagenDeConsola(c) ? [imagenDeConsola(c)] : [],
      });
    }
    const elegidos = cfOfrecibles.filter(g => asignados[g.t]);
    if (elegidos.length) {
      let plats = [];
      try { plats = await api.plataformas.getAll(); } catch {}
      let n = 0;
      for (const g of elegidos) {
        n++;
        setSaveMsg(`Añadiendo ${n}/${elegidos.length} de Créditos Finales: ${g.t}…`);
        const p = findPlatform(asignados[g.t], plats);
        if (!p) continue;
        try { await api.juegos.create({ plataformaId: p.id, nombre: g.t, imagenes: g.i ? [g.i] : [], comentarios: '' }); } catch (e) { console.warn('Juego de Créditos Finales', g.t, e); }
      }
    }
    await api.app.completeOnboarding();
    onComplete();
  };

  const consolas = TODAS_LAS_CONSOLAS.filter(c => pasaFiltro(c, filtro));

  // ── Welcome step ─────────────────────────────────────────────────────────
  if (step==='welcome') return (
    <div className="ob-screen">
      <div className="ob-welcome">
        <div className="ob-logo">
          <img src="./icon-192.png" alt="" width="64" height="64"/>
          <h1 className="ob-logo-text">GameVault</h1>
        </div>
        <p className="ob-tagline">Tu colección de videojuegos y consolas</p>
        <div className="ob-cards">
          <div className="ob-card ob-card-primary" onClick={() => setStep('select')}>
            <div className="ob-card-icon"><Gamepad2 size={32}/></div>
            <h3>Empezar desde cero</h3>
            <p>Selecciona las consolas que tienes y añádelas a tu colección.</p>
            <div className="ob-card-arrow"><ArrowRight size={20}/></div>
          </div>
          <div className="ob-card" onClick={handleImport}>
            <div className="ob-card-icon"><Download size={32}/></div>
            <h3>Importar colección</h3>
            <p>Ya tengo un fichero JSON exportado de GameVault.</p>
            <div className="ob-card-arrow"><ArrowRight size={20}/></div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Saving progress overlay ───────────────────────────────────────────────
  if (saving) return (
    <div className="ob-screen" style={{alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center',padding:40}}>
        <Loader size={48} className="spin" style={{color:'var(--accent)',marginBottom:20}}/>
        <p style={{fontFamily:'var(--font-d)',fontSize:20,color:'var(--text-0)',marginBottom:8}}>
          Configurando tu colección…
        </p>
        <p style={{fontSize:13,color:'var(--cyan)'}}>{saveMsg}</p>
        <p style={{fontSize:11,color:'var(--text-3)',marginTop:12}}>
          Puedes cambiar las imágenes después desde cada consola
        </p>
      </div>
    </div>
  );

  // ── Juegos de Créditos Finales ────────────────────────────────────────────
  if (step === 'creditos') {
    const n = cfOfrecibles.filter(g => asignados[g.t]).length;
    const todas = consolasFinales;
    return (
      <div className="ob-screen">
        <div className="ob-select-header">
          <div>
            <h2 className="ob-select-title">Tus juegos de Créditos Finales</h2>
            <p className="ob-select-sub">
              Estos te los has pasado o los estás jugando. Elige en qué consola tienes cada uno; los que no tengas (prestados, de suscripción…) déjalos en «No lo tengo».
              {buscandoRawg && <> <Loader size={12} className="spin"/> Mirando en qué consolas salió cada uno…</>}
            </p>
          </div>
          <div className="ob-cf-acc">
            <button className="ob-back-btn" onClick={() => setStep('select')}><ArrowLeft size={16}/> Consolas</button>
            <button className="ob-finish-btn" onClick={handleFinish} disabled={saving || buscandoRawg}>
              {n ? `Añadir ${n} juego${n !== 1 ? 's' : ''} y terminar` : 'Terminar sin estos'} <ArrowRight size={16}/>
            </button>
          </div>
        </div>
        {todas.length === 0 && <p className="ob-cf-aviso">No has elegido ninguna consola: vuelve atrás y marca en cuáles juegas para poder añadirlos.</p>}
        <div className="ob-cf-lista">
          {cfOfrecibles.map(g => {
            const v = asignados[g.t] ?? '';
            return (
              <div key={g.t} className={'ob-cf' + (v ? ' on' : '')}>
                <span className="ob-cf-img">{g.i ? <img src={thumb(g.i, 200)} alt="" loading="lazy"/> : <Gamepad2 size={18}/>}</span>
                <span className="ob-cf-t"><b>{g.t}</b><small>{g.e === 'jugando' ? 'Jugando' : 'Terminado'}{g.y ? ' en ' + g.y : ''}{plataformasRawg[g.sid]?.length ? ' · salió en ' + plataformasRawg[g.sid].slice(0, 4).join(', ') : ''}</small></span>
                <select className="field-input field-select" value={v} onChange={e => setAsignados(a => ({ ...a, [g.t]: e.target.value }))} aria-label={'Consola de ' + g.t}>
                  <option value="">No lo tengo</option>
                  {todas.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Console selector ──────────────────────────────────────────────────────
  return (
    <div className="ob-screen">
      <div className="ob-select-header">
        <div>
          <h2 className="ob-select-title">¿Qué consolas tienes?</h2>
          <p className="ob-select-sub">
            Selecciona todas las que quieras. Luego puedes cambiar la imagen de cada una.
          </p>
        </div>
        {(() => {
          const total = consolasFinales.length;
          const sigue = cfOfrecibles.length > 0;
          return (
            <button className={'ob-finish-btn' + (total===0?' ob-finish-empty':'')}
              onClick={sigue ? irACreditos : handleFinish} disabled={saving || ap.cargando}>
              {ap.cargando ? 'Un momento…'
                : sigue ? `Siguiente: tus juegos de Créditos Finales`
                : total===0 ? 'Continuar sin consolas'
                : `Añadir ${total} consola${total!==1?'s':''}`}
              <ArrowRight size={16}/>
            </button>
          );
        })()}
      </div>

      {(juegosTabla > 0 || cfOfrecibles.length > 0) && (
        <div className="ob-apuntados" role="note">
          <Sparkles size={20} className="ob-apuntados-ico"/>
          <div>
            <b>¡Oye{ap.me?.display ? ', ' + ap.me.display : ''}! Ya tienes juegos apuntados, así que esos se te dan de alta solos:</b>
            <ul>
              {juegosTabla > 0 && <li><Table2 size={14}/> <span><b>{juegosTabla} juego{juegosTabla !== 1 ? 's' : ''}</b> en la tabla de préstamos ({[...new Set(ap.perfiles.flatMap(p => (p.consolas || []).map(c => c.n)))].join(', ')}). Sus consolas ya están marcadas abajo.</span></li>}
              {cfOfrecibles.length > 0 && <li><Trophy size={14}/> <span><b>{cfOfrecibles.length} juego{cfOfrecibles.length !== 1 ? 's' : ''}</b> en Créditos Finales. En el siguiente paso eliges en qué consola tienes cada uno (allí no consta).</span></li>}
            </ul>
            <small>Marca también el resto de consolas que tengas.</small>
          </div>
        </div>
      )}

      <div className="ob-marcas">
        {MARCAS.map(m => (
          <button key={m} className={'ob-marca-btn'+(filtro===m?' active':'')} onClick={()=>setFiltro(m)}>
            {m}
          </button>
        ))}
      </div>

      <div className="ob-grid">
        {consolas.map(c => {
          const tabla = esDeTabla(c);
          const sel = selected.has(c.nombre) || tabla;
          const tiene = !tabla && yaLaTienes(c.nombre);
          return (
            <div key={c.nombre} className={'ob-consola'+(sel?' ob-consola-sel':'')+(tiene?' ob-consola-tiene':'')}
              onClick={()=>toggle(c.nombre)} title={tiene ? 'Ya está en tu colección' : tabla ? `Viene de la tabla de préstamos con ${deTabla.get(claveDe(c))} juego(s)` : undefined}>
              {tiene && <div className="ob-tiene">Ya la tienes</div>}
              {tabla && <div className="ob-tiene ob-tabla">{deTabla.get(claveDe(c))} de la tabla</div>}
              {sel && <div className="ob-check"><Check size={16}/></div>}
              <Avatar c={c}/>
              <div className="ob-consola-info">
                <p className="ob-consola-nombre">{c.nombre}</p>
                <p className="ob-consola-marca">{c.marca}</p>
                <span className={'ob-tipo ob-tipo-'+c.tipo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}>
                  {c.tipo}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
