import React, { useState, useEffect } from 'react';
import { findPlatform } from '../../utils/platformMatch';
import { Download, ArrowRight, Check, Gamepad2, Loader } from 'lucide-react';
import { CONSOLAS, MARCAS_PRINCIPALES, imagenDeConsola } from '../../data/consolas';
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

export default function OnboardingPage({ onComplete }) {
  const [step,     setStep]     = useState('welcome');
  const [selected, setSelected] = useState(new Set());
  const [filtro,   setFiltro]   = useState('Todas');
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState('');
  // Consolas que ya existen (p.ej. de la colección inicial) → no se duplican
  const [existentes, setExistentes] = useState([]);
  useEffect(() => { api?.plataformas.getAll().then(setExistentes).catch(() => {}); }, []);
  const yaLaTienes = nombre => !!findPlatform(nombre, existentes);

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

  const toggle = nombre => !yaLaTienes(nombre) && setSelected(s => {
    const next = new Set(s);
    next.has(nombre) ? next.delete(nombre) : next.add(nombre);
    return next;
  });

  // Guardar las consolas elegidas, con su imagen por defecto (incluida en la app)
  const handleFinish = async () => {
    setSaving(true);
    const consolasSeleccionadas = TODAS_LAS_CONSOLAS.filter(c => selected.has(c.nombre) && !yaLaTienes(c.nombre));
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
        <button className={'ob-finish-btn' + (selected.size===0?' ob-finish-empty':'')}
          onClick={handleFinish} disabled={saving}>
          {selected.size===0
            ? 'Continuar sin consolas'
            : `Añadir ${selected.size} consola${selected.size!==1?'s':''}`}
          <ArrowRight size={16}/>
        </button>
      </div>

      <div className="ob-marcas">
        {MARCAS.map(m => (
          <button key={m} className={'ob-marca-btn'+(filtro===m?' active':'')} onClick={()=>setFiltro(m)}>
            {m}
          </button>
        ))}
      </div>

      <div className="ob-grid">
        {consolas.map(c => {
          const sel = selected.has(c.nombre);
          const tiene = yaLaTienes(c.nombre);
          return (
            <div key={c.nombre} className={'ob-consola'+(sel?' ob-consola-sel':'')+(tiene?' ob-consola-tiene':'')}
              onClick={()=>toggle(c.nombre)} title={tiene ? 'Ya está en tu colección' : undefined}>
              {tiene && <div className="ob-tiene">Ya la tienes</div>}
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
