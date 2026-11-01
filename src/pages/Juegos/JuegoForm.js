import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Image, Loader, Search } from 'lucide-react';
import { Modal, Input, Select, Textarea, Btn, ImgThumbs, CoverPicker } from '../../components/ui/index';
import { searchGames, rawgToJuego, getGameDetails, getGameScreenshots } from '../../utils/rawg';
import { parseImgs } from '../../utils/imgSrc';

const GENEROS  = ['Acción','Aventura','RPG','Deportes','Carreras','Plataformas','Shooter','Estrategia','Simulación','Lucha','Puzzle','Terror','MMORPG','Indie','Música','Otro'];
const ESTADOS  = ['Nuevo','Usado','Digital','Dañado'];
const REGIONES = ['PAL','NTSC','NTSC-J','Universal'];
const MODOS    = ['Un jugador','Multijugador local','Multijugador online','Cooperativo','Competitivo'];
const EMPTY    = {plataformaId:'',nombre:'',precio:'',genero:'',numeroDeJugadores:'',
  modoDeJuego:'',desarrolladora:'',fechaAdquisicion:'',fechaLanzamiento:'',
  region:'',idiomas:'',estado:'',comentarios:'',imagenes:[],
  valoracion:'',prestadoA:'',fechaPrestamo:'',unidades:1,tituloOriginal:''};

export default function JuegoForm({open, initial, onClose, onSave, plataformas=[], plataformaId, lockPlataforma}) {
  const [f, setF]             = useState(EMPTY);
  const [err, setErr]         = useState({});
  const [saving, setSaving]   = useState(false);
  const [covers, setCovers]   = useState(false);

  // ── AJAX autocomplete state ──────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug]         = useState(false);
  const [sugLoading, setSugLoading]   = useState(false);
  const debounceRef = useRef(null);
  const sugRef      = useRef(null);

  useEffect(() => {
    if (initial) {
      // Sanitizar nulls de la BD → string vacío para evitar warning en <select value={null}>
      const sanitized = Object.fromEntries(
        Object.entries({...EMPTY, ...initial}).map(([k,v]) => [k, v === null ? '' : v])
      );
      setF({...sanitized,
        imagenes: parseImgs(initial.imagenes),
        unidades: initial.unidades || 1,
      });
    } else {
      setF({...EMPTY, plataformaId: plataformaId||''});
    }
    setErr({}); setSuggestions([]); setShowSug(false);
  }, [initial, open, plataformaId]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = e => { if (sugRef.current && !sugRef.current.contains(e.target)) setShowSug(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Debounced AJAX search while typing ───────────────────────────────────
  const handleNombreChange = useCallback(e => {
    const val = e.target.value;
    setF(v => ({...v, nombre: val}));
    setShowSug(false);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); return; }
    setSugLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchGames(val, 8);
        setSuggestions(results.filter(g => g.background_image));
        setShowSug(true);
      } catch { setSuggestions([]); }
      setSugLoading(false);
    }, 400); // 400ms debounce — espera a que el usuario pare de escribir
  }, []);

  // ── Al seleccionar una sugerencia — rellena todos los campos ─────────────
  const handleSelectSuggestion = useCallback(async game => {
    setShowSug(false);
    setSugLoading(true);
    setF(v => ({...v, nombre: game.name}));
    try {
      const [details, screenshots] = await Promise.all([
        getGameDetails(game.id),
        getGameScreenshots(game.id),
      ]);
      const data = rawgToJuego(details);
      const imagenes = [
        ...(details.background_image ? [details.background_image] : []),
        ...screenshots.slice(0, 3),
      ];
      setF(v => ({
        ...v,
        nombre:           details.name || v.nombre,
        genero:           data.genero           || v.genero,
        desarrolladora:   data.desarrolladora   || v.desarrolladora,
        fechaLanzamiento: data.fechaLanzamiento || v.fechaLanzamiento,
        imagenes:         imagenes.length ? imagenes : v.imagenes,
        comentarios:      v.comentarios || (details.description_raw||'').slice(0, 200),
      }));
    } catch (e) {
      console.error('Error fetching game details:', e);
    }
    setSugLoading(false);
  }, []);

  const s = k => e => setF(v => ({...v, [k]: e.target.value}));

  const validate = () => {
    const e = {};
    if (!f.nombre.trim()) e.nombre = 'Obligatorio';
    if (!f.plataformaId)  e.plataformaId = 'Selecciona plataforma';
    if (f.unidades !== '' && f.unidades != null && !(parseInt(f.unidades, 10) >= 1)) e.unidades = 'Mínimo 1';
    setErr(e);
    return !Object.keys(e).length;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try { await onSave(f); } finally { setSaving(false); }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={initial?.id ? 'Editar juego' : 'Nuevo juego'} width={780}>
        <div className="form-gap">

          {/* Plataforma */}
          {lockPlataforma
            ? <div className="field"><label className="field-label">Plataforma</label>
                <input className="field-input" disabled value={plataformas[0]?.nombre||'—'}/></div>
            : <Select label="Plataforma *" value={f.plataformaId} onChange={s('plataformaId')} error={err.plataformaId}>
                <option value="">-- Selecciona --</option>
                {plataformas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Select>
          }

          {/* Nombre con AJAX autocomplete */}
          <div className="field" style={{position:'relative'}} ref={sugRef}>
            <label className="field-label">
              Nombre *
              {sugLoading && <Loader size={12} className="spin" style={{marginLeft:6,color:'var(--cyan)'}}/>}
              {!sugLoading && f.nombre.length >= 2 &&
                <span style={{fontSize:10,color:'var(--text-3)',marginLeft:6}}>
                  Buscando en RAWG mientras escribes…
                </span>
              }
            </label>
            <div style={{position:'relative'}}>
              <Search size={14} style={{position:'absolute',left:10,top:'50%',
                transform:'translateY(-50%)',color:'var(--text-3)',pointerEvents:'none'}}/>
              <input
                className="field-input"
                style={{paddingLeft:32}}
                placeholder="Escribe el nombre del juego…"
                value={f.nombre}
                onChange={handleNombreChange}
                onFocus={() => suggestions.length > 0 && setShowSug(true)}
                autoComplete="off"
              />
            </div>
            {err.nombre && <span className="field-error">{err.nombre}</span>}

            {/* Dropdown de sugerencias */}
            {showSug && suggestions.length > 0 && (
              <div className="sug-dropdown">
                {suggestions.map(game => (
                  <div key={game.id} className="sug-item"
                    onMouseDown={e => { e.preventDefault(); handleSelectSuggestion(game); }}>
                    {game.background_image &&
                      <img className="sug-img" src={game.background_image} alt=""/>}
                    <div className="sug-info">
                      <p className="sug-name">{game.name}</p>
                      <p className="sug-meta">
                        {game.released || ''}
                        {game.genres?.length ? ` · ${game.genres[0].name}` : ''}
                      </p>
                    </div>
                    <div className="sug-hint">↵ autorellenar</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Input label="Título original o en inglés (opcional)" value={f.tituloOriginal||''} onChange={s('tituloOriginal')}
            placeholder="Solo si el nombre está en castellano y no encuentra la duración o las ventas — p.ej. The Simpsons Game"/>

          <div className="grid-2">
            <Select label="Género" value={f.genero} onChange={s('genero')}>
              <option value="">--</option>
              {GENEROS.map(g => <option key={g}>{g}</option>)}
            </Select>
            <Input label="Desarrolladora" value={f.desarrolladora} onChange={s('desarrolladora')} placeholder="Nintendo"/>
          </div>

          <div className="grid-3">
            <Select label="Modo de juego" value={f.modoDeJuego} onChange={s('modoDeJuego')}>
              <option value="">--</option>
              {MODOS.map(m => <option key={m}>{m}</option>)}
            </Select>
            <Input label="Nº jugadores" type="number" min="1" value={f.numeroDeJugadores} onChange={s('numeroDeJugadores')} placeholder="1"/>
            <Select label="Estado" value={f.estado} onChange={s('estado')}>
              <option value="">--</option>
              {ESTADOS.map(e => <option key={e}>{e}</option>)}
            </Select>
          </div>

          <div className="grid-3">
            <Select label="Región" value={f.region} onChange={s('region')}>
              <option value="">--</option>
              {REGIONES.map(r => <option key={r}>{r}</option>)}
            </Select>
            <Input label="Idiomas" value={f.idiomas} onChange={s('idiomas')} placeholder="ES, EN…"/>
            <Input label="Precio (€)" type="number" step="0.01" value={f.precio} onChange={s('precio')} placeholder="0.00"/>
          </div>

          <div className="grid-3">
            <Input label="Fecha lanzamiento" type="date" value={f.fechaLanzamiento} onChange={s('fechaLanzamiento')}/>
            <Input label="Fecha adquisición" type="date" value={f.fechaAdquisicion}  onChange={s('fechaAdquisicion')}/>
            <Input label="Unidades" type="number" min="1" step="1" value={f.unidades}
              onChange={s('unidades')} error={err.unidades} title="Copias que tienes de este juego (duplicados)"/>
          </div>

          <Textarea label="Comentarios" value={f.comentarios} onChange={s('comentarios')}/>

          {/* Valoración personal */}
          <div className="field">
            <label className="field-label">Valoración personal</label>
            <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} type="button"
                  onClick={() => setF(v => ({...v, valoracion: v.valoracion===n?'':n}))}
                  style={{
                    width:36, height:36, borderRadius:'var(--r)', border:'1px solid var(--border)',
                    background: f.valoracion===n ? 'var(--gold)' : 'var(--bg-3)',
                    color: f.valoracion===n ? '#000' : 'var(--text-2)',
                    fontFamily:'var(--font-m)', fontSize:13, fontWeight:600,
                    cursor:'pointer', transition:'all .15s',
                    boxShadow: f.valoracion===n ? '0 0 0 2px var(--gold)' : 'none',
                  }}>
                  {n}
                </button>
              ))}
              {f.valoracion && (
                <span style={{
                  display:'inline-flex', alignItems:'center', gap:4, marginLeft:4,
                  background:'var(--bg-3)', border:'1px solid var(--gold)',
                  borderRadius:'var(--r)', padding:'2px 8px',
                  fontSize:12, color:'var(--gold)', fontFamily:'var(--font-m)', fontWeight:600
                }}>
                  {f.valoracion}/10
                  <button style={{ background:'none',border:'none',cursor:'pointer',
                    color:'var(--text-2)',fontSize:14,lineHeight:1,padding:'0 2px',
                    display:'flex',alignItems:'center' }}
                    title="Quitar valoración"
                    onClick={() => setF(v=>({...v,valoracion:''}))}>✕</button>
                </span>
              )}
            </div>
          </div>

          {/* Préstamo */}
          <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)',
            borderRadius:'var(--r-lg)', padding:'12px 14px' }}>
            <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em',
              textTransform:'uppercase', color:'var(--text-3)', marginBottom:10 }}>
              Préstamo
            </p>
            <div className="grid-2">
              <Input label="Prestado a" value={f.prestadoA||''} onChange={s('prestadoA')} placeholder="Nombre o contacto"/>
              <Input label="Fecha préstamo" type="date" value={f.fechaPrestamo||''} onChange={s('fechaPrestamo')}/>
            </div>
            {f.prestadoA && (
              <button
                onClick={() => setF(v=>({...v,prestadoA:'',fechaPrestamo:''}))}
                style={{ marginTop:8, fontSize:11, fontWeight:600, cursor:'pointer',
                  display:'inline-flex', alignItems:'center', gap:5,
                  padding:'5px 10px', borderRadius:'var(--r)',
                  background:'rgba(248,113,113,.15)', border:'1px solid rgba(248,113,113,.4)',
                  color:'#f87171', transition:'background .15s' }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(248,113,113,.25)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(248,113,113,.15)'}>
                ✕ Marcar como devuelto
              </button>
            )}
          </div>

          <div className="field">
            <label className="field-label">
              Carátulas
              <span style={{fontSize:10,color:'var(--text-3)',marginLeft:6,fontWeight:400}}>
                (se añaden automáticamente al seleccionar el juego)
              </span>
            </label>
            <ImgThumbs images={f.imagenes||[]} onChange={imgs => setF(v=>({...v,imagenes:imgs}))}/>
            <button className="rawg-btn" style={{marginTop:6,width:'fit-content'}}
              onClick={() => setCovers(true)}>
              <Image size={13}/> Buscar más carátulas
            </button>
          </div>

          <div className="form-actions">
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={submit} disabled={saving}>
              {saving ? 'Guardando…' : (initial?.id ? 'Guardar cambios' : 'Crear juego')}
            </Btn>
          </div>
        </div>
      </Modal>

      <CoverPicker open={covers} onClose={() => setCovers(false)} gameName={f.nombre}
        onSelect={urls => setF(v => ({...v, imagenes:[...v.imagenes,...urls]}))}/>
    </>
  );
}
