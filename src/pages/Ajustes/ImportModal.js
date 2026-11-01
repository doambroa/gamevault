import React, { useState, useRef, useCallback } from 'react';
import { Upload, AlertTriangle, Check, Loader, RefreshCw, Image } from 'lucide-react';
import { Modal, Btn } from '../../components/ui/index';
import { parseImportFile } from '../../utils/importParser';
import { searchGames } from '../../utils/rawg';
import { excelToCsv, docxToText } from '../../utils/fileReaders';
import { findPlatform } from '../../utils/platformMatch';

const api = window.api;

const STEPS = { DROP: 'drop', REVIEW: 'review', IMPORTING: 'importing', DONE: 'done' };

export default function ImportModal({ open, onClose, onDone, plataformas = [] }) {
  const [step,         setStep]        = useState(STEPS.DROP);
  const [juegos,       setJuegos]      = useState([]);
  const [warnings,     setWarnings]    = useState([]);
  const [progress,     setProgress]    = useState(null);
  const [results,      setResults]     = useState(null);
  const [error,        setError]       = useState('');
  const [fetchCovers,  setFetchCovers] = useState(true); // buscar carátulas en RAWG
  // Para asignar plataforma a juegos sin plataforma
  const [platAssign, setPlatAssign] = useState({}); // { nombre: plataformaId }
  // Plataforma para los juegos que vienen sin ella (p.ej. una lista TXT/Word)
  const [defaultPlat, setDefaultPlat] = useState('');
  // Mapeo de nombre de plataforma → ID existente (se resuelve al importar)
  const fileRef = useRef(null);

  const reset = () => {
    setStep(STEPS.DROP); setJuegos([]); setWarnings([]);
    setProgress(null); setResults(null); setError(''); setPlatAssign({});
    setFetchCovers(true); setDefaultPlat('');
  };

  const handleClose = () => { reset(); onClose(); };

  // ── Procesar fichero ──────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    setError('');
    const rawExt = file.name.split('.').pop().toLowerCase();
    let text, ext;
    try {
      if (['xlsx', 'xls', 'xlsm', 'ods'].includes(rawExt)) {
        text = excelToCsv(await file.arrayBuffer()); ext = 'csv';
      } else if (rawExt === 'docx') {
        const r = docxToText(await file.arrayBuffer()); text = r.text; ext = r.kind;
      } else if (rawExt === 'doc') {
        setError('Los .doc antiguos de Word no se pueden leer: ábrelo en Word y guárdalo como .docx (o como .txt).'); return;
      } else {
        text = await file.text();
        ext  = rawExt === 'json' ? 'json' : (rawExt === 'txt' || rawExt === 'md') ? 'txt' : 'csv';
      }
    } catch (e) {
      setError(`No se pudo leer el fichero: ${e.message}`); return;
    }

    try {
      if (!String(text || '').trim()) { setError('El fichero está vacío.'); return; }
      const { juegos: parsed, plataformasNecesarias, warnings: w } = parseImportFile(text, ext);
      if (!parsed.length) { setError('No se encontraron juegos en el fichero.'); return; }
      setJuegos(parsed);
      setWarnings(w);
      // Pre-asignar plataformas que ya existen
      const assign = {};
      for (const pn of plataformasNecesarias) {
        const found = findPlatform(pn, plataformas);
        if (found) assign[pn] = found.id;
      }
      setPlatAssign(assign);
      if (plataformas.length === 1) setDefaultPlat(String(plataformas[0].id));
      setStep(STEPS.REVIEW);
    } catch (e) {
      setError(`Error al procesar el fichero: ${e.message}`);
    }
  }, [plataformas]);

  const onDrop = useCallback(e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileInput = e => {
    const file = e.target.files[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // ── Importar ─────────────────────────────────────────────────────────────
  const startImport = async () => {
    setStep(STEPS.IMPORTING);
    const total = juegos.length;
    let done = 0, created = 0, skipped = 0, errors = 0, coversFound = 0;

    // Resolver/crear plataformas necesarias
    const platCache = {}; // nombre → id
    for (const p of plataformas) platCache[p.nombre] = p.id;

    // Construir mapa de asignaciones manuales
    const manual = platAssign; // { nombrePlat: id | 'new' | '' }

    for (const j of juegos) {
      setProgress({ done, total, current: j.nombre, phase: 'Creando…' });
      try {
        let plataformaId = '';
        const pn = j.plataformaNombre;

        if (pn) {
          if (platCache[pn]) {
            plataformaId = platCache[pn];
          } else if (manual[pn] && manual[pn] !== 'new' && manual[pn] !== '') {
            plataformaId = manual[pn];
            platCache[pn] = manual[pn];
          } else if (manual[pn] === 'new' || !manual[pn]) {
            // Crear la plataforma automáticamente
            const newPlat = await api.plataformas.create({ nombre: pn, marca: '', modelo: '', tipo: '', imagenes: [] });
            plataformaId = newPlat.id;
            platCache[pn] = newPlat.id;
          }
        }

        if (!plataformaId && !pn) {
          if (defaultPlat === 'new') {
            if (!platCache['Sin plataforma']) {
              const np = await api.plataformas.create({ nombre: 'Sin plataforma', imagenes: [] });
              platCache['Sin plataforma'] = np.id;
            }
            plataformaId = platCache['Sin plataforma'];
          } else if (defaultPlat) {
            plataformaId = Number(defaultPlat);
          } else {
            skipped++; done++; continue; // sin plataforma y sin asignación → saltar
          }
        }

        // Buscar carátula en RAWG (antes de crear, para incluirla en el insert)
        let imagenes = [];
        if (fetchCovers && j.nombre && !(j.imagenes || []).length) {
          try {
            setProgress({ done, total, current: j.nombre, phase: 'Buscando carátula…' });
            const rawgResults = await searchGames(j.nombre, 3);
            if (rawgResults.length > 0 && rawgResults[0].background_image) {
              imagenes = [rawgResults[0].background_image];
              coversFound++;
            }
          } catch (_) {
            // RAWG fallo silencioso — seguir sin carátula
          }
        }

        await api.juegos.create({
          plataformaId,
          nombre:           j.nombre,
          genero:           j.genero || '',
          estado:           j.estado || '',
          region:           j.region || '',
          precio:           j.precio || '',
          valoracion:       j.valoracion || '',
          fechaAdquisicion: j.fechaAdquisicion || '',
          fechaLanzamiento: j.fechaLanzamiento || '',
          idiomas:          j.idiomas || '',
          comentarios:      j.comentarios || '',
          prestadoA:        j.prestadoA || '',
          unidades:         j.unidades || 1,
          imagenes:         imagenes.length ? imagenes : (j.imagenes || []),
        });
        created++;
      } catch (e) {
        errors++;
      }
      done++;
    }

    setProgress(null);
    setResults({ total, created, skipped, errors, coversFound });
    setStep(STEPS.DONE);
  };

  // ── Plataformas únicas que necesitan asignación ───────────────────────────
  const unmappedPlats = [...new Set(juegos.map(j => j.plataformaNombre).filter(pn => pn && !findPlatform(pn, plataformas)))];
  const autoMapped = [...new Set(juegos.map(j => j.plataformaNombre).filter(Boolean))]
    .map(pn => [pn, findPlatform(pn, plataformas)])
    .filter(([pn, p]) => p && p.nombre !== pn);

  return (
    <Modal open={open} onClose={handleClose} title="Importar colección" width={640}>
      <div style={{ minHeight: 200 }}>

        {/* ── PASO 1: DROP ── */}
        {step === STEPS.DROP && (
          <div>
            <p style={{ color:'var(--text-2)', fontSize:13, marginBottom:20, lineHeight:1.6 }}>
              Importa tu colección desde <strong style={{color:'var(--text-1)'}}>Mi Colección</strong>, Excel, CSV, TXT o JSON.
              Los juegos se añadirán a tu biblioteca sin borrar los existentes.
            </p>

            <div
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{
                border: '2px dashed var(--border)', borderRadius: 'var(--r-lg)',
                padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
                background: 'var(--bg-2)', transition: 'border-color .2s, background .2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-3)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-2)'; }}>
              <Upload size={36} style={{ color:'var(--accent)', marginBottom:12 }}/>
              <p style={{ color:'var(--text-1)', fontWeight:600, marginBottom:6 }}>
                Arrastra el fichero aquí o pulsa para seleccionar
              </p>
              <p style={{ color:'var(--text-3)', fontSize:12 }}>
                CSV (Mi Colección, genérico) · Excel (.xlsx) · Word (.docx) · TXT · JSON
              </p>
              <input ref={fileRef} type="file"
                accept=".csv,.xlsx,.xls,.ods,.docx,.doc,.txt,.md,.json"
                style={{ display:'none' }} onChange={onFileInput}/>
            </div>

            {error && (
              <div style={{ marginTop:16, display:'flex', gap:8, alignItems:'center',
                background:'rgba(248,113,113,.1)', border:'1px solid rgba(248,113,113,.3)',
                borderRadius:'var(--r)', padding:'10px 14px' }}>
                <AlertTriangle size={15} style={{ color:'#f87171', flexShrink:0 }}/>
                <span style={{ color:'#f87171', fontSize:13 }}>{error}</span>
              </div>
            )}

            <div style={{ marginTop:20, padding:'12px 14px', background:'var(--bg-2)',
              border:'1px solid var(--border)', borderRadius:'var(--r-lg)', fontSize:12, color:'var(--text-3)' }}>
              <p style={{ fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>Formatos soportados:</p>
              <ul style={{ paddingLeft:16, lineHeight:2 }}>
                <li><strong style={{color:'var(--accent)'}}>Mi Colección CSV</strong> — exportación directa de la app</li>
                <li><strong style={{color:'var(--cyan)'}}>CSV genérico</strong> — cualquier CSV con columna "Nombre" o "Title"</li>
                <li><strong style={{color:'var(--gold)'}}>Excel (.xlsx)</strong> — primera hoja del libro</li>
                <li><strong style={{color:'var(--text-2)'}}>Word (.docx)</strong> — una lista (un juego por línea) o una tabla con columnas Juego / Plataforma</li>
                <li><strong style={{color:'var(--text-2)'}}>TXT</strong> — un juego por línea, opcionalmente "Juego | Plataforma"</li>
                <li><strong style={{color:'var(--text-2)'}}>JSON</strong> — array de objetos con campo "nombre" o "name"</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── PASO 2: REVIEW ── */}
        {step === STEPS.REVIEW && (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <Check size={18} style={{ color:'var(--gold)' }}/>
              <span style={{ color:'var(--text-1)', fontWeight:600 }}>
                {juegos.length} juego{juegos.length!==1?'s':''} detectado{juegos.length!==1?'s':''}
              </span>
              <button onClick={reset} style={{ marginLeft:'auto', background:'none', border:'none',
                color:'var(--text-3)', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
                <RefreshCw size={11}/> Otro fichero
              </button>
            </div>

            {warnings.length > 0 && (
              <div style={{ marginBottom:14, background:'rgba(250,204,21,.08)',
                border:'1px solid rgba(250,204,21,.25)', borderRadius:'var(--r)', padding:'10px 14px' }}>
                {warnings.map((w,i) => (
                  <p key={i} style={{ color:'var(--gold)', fontSize:12, lineHeight:1.6 }}>⚠ {w}</p>
                ))}
              </div>
            )}

            {autoMapped.length > 0 && (
              <p style={{ fontSize:11, color:'var(--text-3)', marginBottom:10, lineHeight:1.6 }}>
                Emparejadas con tus plataformas: {autoMapped.map(([pn, p]) => `${pn} → ${p.nombre}`).join(' · ')}
              </p>
            )}

            {/* Asignación de plataformas nuevas */}
            {unmappedPlats.length > 0 && (
              <div style={{ marginBottom:16, background:'var(--bg-2)',
                border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'12px 14px' }}>
                <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em',
                  textTransform:'uppercase', color:'var(--text-3)', marginBottom:10 }}>
                  Plataformas nuevas — asignar o crear
                </p>
                {unmappedPlats.map(pn => (
                  <div key={pn} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <span style={{ flex:1, fontSize:13, color:'var(--text-1)', fontWeight:500 }}>{pn}</span>
                    <select
                      value={platAssign[pn] || 'new'}
                      onChange={e => setPlatAssign(a => ({...a, [pn]: e.target.value}))}
                      style={{ fontSize:12, padding:'4px 8px', borderRadius:'var(--r)',
                        border:'1px solid var(--border)', background:'var(--bg-3)', color:'var(--text-1)',
                        minWidth:180 }}>
                      <option value="new">✦ Crear plataforma nueva</option>
                      {plataformas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {/* Plataforma para juegos sin plataforma */}
            {juegos.some(j => !j.plataformaNombre) && (
              <div style={{ marginBottom:16, background:'var(--bg-2)',
                border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'12px 14px' }}>
                <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em',
                  textTransform:'uppercase', color:'var(--text-3)', marginBottom:10 }}>
                  {juegos.filter(j => !j.plataformaNombre).length} juego(s) sin plataforma — ¿dónde los guardo?
                </p>
                <select value={defaultPlat} onChange={e => setDefaultPlat(e.target.value)}
                  style={{ fontSize:12, padding:'6px 8px', borderRadius:'var(--r)', width:'100%',
                    border:'1px solid var(--border)', background:'var(--bg-3)', color:'var(--text-1)' }}>
                  <option value="">No importarlos</option>
                  {plataformas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  <option value="new">✦ Crear plataforma "Sin plataforma"</option>
                </select>
              </div>
            )}

            {/* Preview de juegos */}
            <div style={{ maxHeight:260, overflowY:'auto', border:'1px solid var(--border)',
              borderRadius:'var(--r-lg)', background:'var(--bg-2)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--border)' }}>
                    <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--text-3)',
                      fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'.06em' }}>Nombre</th>
                    <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--text-3)',
                      fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'.06em' }}>Plataforma</th>
                    <th style={{ padding:'8px 12px', textAlign:'left', color:'var(--text-3)',
                      fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'.06em' }}>Género</th>
                    <th style={{ padding:'8px 12px', textAlign:'right', color:'var(--text-3)',
                      fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'.06em' }}>Uds.</th>
                  </tr>
                </thead>
                <tbody>
                  {juegos.slice(0, 100).map((j, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid var(--border)',
                      background: i%2===0 ? 'transparent' : 'var(--bg-3)' }}>
                      <td style={{ padding:'6px 12px', color:'var(--text-1)', fontWeight:500 }}>{j.nombre}</td>
                      <td style={{ padding:'6px 12px', color:'var(--text-2)' }}>{j.plataformaNombre||<em style={{color:'var(--text-3)'}}>—</em>}</td>
                      <td style={{ padding:'6px 12px', color:'var(--text-3)' }}>{j.genero||'—'}</td>
                      <td style={{ padding:'6px 12px', color:(j.unidades||1)>1?'var(--cyan)':'var(--text-3)', textAlign:'right', fontFamily:'var(--font-m)' }}>{j.unidades||1}</td>
                    </tr>
                  ))}
                  {juegos.length > 100 && (
                    <tr><td colSpan={4} style={{ padding:'8px 12px', color:'var(--text-3)',
                      fontStyle:'italic', fontSize:11 }}>… y {juegos.length-100} más</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Opción: buscar carátulas en RAWG */}
            <div style={{ marginTop:14, padding:'10px 14px', background:'var(--bg-2)',
              border:'1px solid var(--border)', borderRadius:'var(--r-lg)',
              display:'flex', alignItems:'center', gap:10 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', flex:1 }}>
                <input
                  type="checkbox"
                  checked={fetchCovers}
                  onChange={e => setFetchCovers(e.target.checked)}
                  style={{ width:14, height:14, accentColor:'var(--accent)', cursor:'pointer' }}
                />
                <div>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text-1)' }}>
                    Buscar carátulas en RAWG
                  </span>
                  <span style={{ fontSize:11, color:'var(--text-3)', display:'block', marginTop:1 }}>
                    Más lento pero añade imágenes automáticamente. Requiere conexión a internet.
                  </span>
                </div>
              </label>
              <Image size={16} style={{ color: fetchCovers ? 'var(--accent)' : 'var(--text-3)', flexShrink:0 }}/>
            </div>

            <div className="form-actions" style={{ marginTop:20 }}>
              <Btn variant="ghost" onClick={handleClose}>Cancelar</Btn>
              <Btn onClick={startImport}>
                Importar {juegos.length} juego{juegos.length!==1?'s':''}
              </Btn>
            </div>
          </div>
        )}

        {/* ── PASO 3: IMPORTING ── */}
        {step === STEPS.IMPORTING && progress && (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <Loader size={32} className="spin" style={{ color:'var(--accent)', marginBottom:16 }}/>
            <p style={{ color:'var(--text-1)', fontWeight:600, marginBottom:4 }}>
              Importando colección…
            </p>
            <p style={{ color:'var(--cyan)', fontSize:13, marginBottom:4, fontWeight:500 }}>
              {progress.current}
            </p>
            {progress.phase && (
              <p style={{ color:'var(--text-3)', fontSize:11, marginBottom:16 }}>
                {progress.phase}
              </p>
            )}
            <div style={{ height:6, background:'var(--bg-4)', borderRadius:3, overflow:'hidden', maxWidth:400, margin:'0 auto' }}>
              <div style={{ height:'100%', borderRadius:3,
                background:'linear-gradient(90deg,var(--accent),var(--gold))',
                width:`${(progress.done/progress.total)*100}%`,
                transition:'width .3s' }}/>
            </div>
            <p style={{ color:'var(--text-3)', fontSize:12, marginTop:8 }}>
              {progress.done} / {progress.total}
            </p>
          </div>
        )}

        {/* ── PASO 4: DONE ── */}
        {step === STEPS.DONE && results && (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <Check size={48} style={{ color:'var(--gold)', marginBottom:16 }}/>
            <p style={{ color:'var(--text-1)', fontWeight:700, fontSize:18, marginBottom:6 }}>
              ¡Importación completada!
            </p>
            <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:24, flexWrap:'wrap' }}>
              <StatChip label="Importados" value={results.created} color="var(--gold)"/>
              {results.coversFound > 0 && <StatChip label="Carátulas" value={results.coversFound} color="var(--accent)"/>}
              {results.skipped > 0 && <StatChip label="Saltados" value={results.skipped} color="var(--text-3)"/>}
              {results.errors  > 0 && <StatChip label="Errores"  value={results.errors}  color="#f87171"/>}
            </div>
            <p style={{ color:'var(--text-3)', fontSize:12, marginTop:16 }}>
              {results.coversFound > 0
                ? `${results.coversFound} juego${results.coversFound!==1?'s':''} con carátula encontrada en RAWG. Los sin carátula puedes buscarlos después.`
                : 'Los juegos importados aparecen en tu biblioteca. Las carátulas se pueden buscar después con el botón "Importar carátulas".'}
            </p>
            <div className="form-actions" style={{ marginTop:24, justifyContent:'center' }}>
              <Btn onClick={() => { onDone?.(); handleClose(); }}>Ver colección</Btn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div style={{ background:'var(--bg-3)', border:`1px solid ${color}44`,
      borderRadius:'var(--r-lg)', padding:'12px 20px', textAlign:'center' }}>
      <div style={{ fontSize:28, fontWeight:800, color, fontFamily:'var(--font-m)' }}>{value}</div>
      <div style={{ fontSize:11, color:'var(--text-3)', textTransform:'uppercase',
        letterSpacing:'.06em', marginTop:2 }}>{label}</div>
    </div>
  );
}
