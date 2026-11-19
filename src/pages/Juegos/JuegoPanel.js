import HistorialPrestamos from '../../components/HistorialPrestamos';
import React, { useState, useEffect, useRef } from 'react';
import { imgSrc, parseImgs, thumb } from '../../utils/imgSrc';
import { X, Edit2, Monitor, Calendar, Euro, Users, Globe, Tag, Info, ChevronLeft, ChevronRight, BookOpen, RefreshCw, Copy } from 'lucide-react';
import { Badge } from '../../components/ui/index';
import VentasSection from './VentasSection';
import { PrestarModal } from '../../community/ui';
import { useCreditos, findCredito, estrellas, ESTADO_CF } from '../../community/creditos';
import { Trophy, ExternalLink, Maximize2 } from 'lucide-react';

const api = window.api;
const EC = { Nuevo:'green', Usado:'gold', Digital:'cyan', Dañado:'accent' };
const TC = { Sobremesa:'accent', Portátil:'cyan', PC:'gold', Híbrida:'green' };

export default function JuegoPanel({ juego, plataforma, open, onClose, onEdit, onFilterBy, onRefresh }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [hltbLoading, setHltbLoading] = useState(false);
  const [hltbError,   setHltbError]   = useState('');
  // Local HLTB state so the panel updates instantly after a manual refresh
  const [hltbData, setHltbData] = useState(null); // { hltbMain, hltbExtra, hltbComplete } | null

  const autoHltb = useRef(null);
  const [zoom, setZoom] = useState(false);          // foto a pantalla completa
  const [prestar, setPrestar] = useState(false);
  const cf = useCreditos();
  const credito = findCredito(cf.idx, juego);

  useEffect(() => { setImgIdx(0); setHltbData(null); setHltbError(''); setZoom(false); }, [juego?.id]);

  const hltbMain     = hltbData?.hltbMain     ?? juego?.hltbMain;
  const hltbExtra    = hltbData?.hltbExtra    ?? juego?.hltbExtra;
  const hltbComplete = hltbData?.hltbComplete ?? juego?.hltbComplete;

  const refreshHltb = async () => {
    if (!juego) return;
    setHltbLoading(true); setHltbError('');
    try {
      const res = await api.juegos.hltbFetch({ id: juego.id, nombre: juego.nombre });
      if (res?.ok) {
        setHltbData({ hltbMain: res.hltbMain, hltbExtra: res.hltbExtra, hltbComplete: res.hltbComplete });
        onRefresh?.(); // reload the list so the Duración column updates too
      } else {
        setHltbError(res?.error || 'No encontrado en HowLongToBeat');
      }
    } catch (e) {
      setHltbError('Error al conectar con HowLongToBeat');
    } finally {
      setHltbLoading(false);
    }
  };

  // Juegos antiguos que nunca se consultaron: buscar al abrir el detalle
  useEffect(() => {
    if (!open || !juego || juego.hltbFetched || autoHltb.current === juego.id) return;
    autoHltb.current = juego.id;
    refreshHltb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, juego?.id, juego?.hltbFetched]);

  if (!open && !juego) return null;
  if (!juego) return null;

  const imgs = parseImgs(juego.imagenes);

  // Clickable cell — filters the list by this field/value
  const FilterTag = ({ field, value, label, color }) => {
    if (!value) return <span style={{ color: 'var(--text-3)' }}>—</span>;
    return (
      <span
        className="jp-filter-tag"
        onClick={() => onFilterBy && onFilterBy(field, value)}
        title={`Filtrar por: ${value}`}
      >
        {color ? <Badge color={color}>{label || value}</Badge> : (label || value)}
      </span>
    );
  };

  const Row = ({ icon: Icon, label, children }) => (
    <div className="jp-row">
      <div className="jp-row-label">
        {Icon && <Icon size={13} />}
        {label}
      </div>
      <div className="jp-row-value">{children}</div>
    </div>
  );

  return (
    <>
      {/* Overlay */}
      <div className={`jp-overlay ${open ? 'jp-overlay-visible' : ''}`} onClick={onClose} />

      {/* Panel */}
      <div className={`jp-panel ${open ? 'jp-panel-open' : ''}`}>
        {/* Header */}
        <div className="jp-header">
          <button className="jp-close" onClick={onClose}><X size={18} /></button>
          <div className="jp-header-actions">
            <button className="jp-action-btn" onClick={onEdit} title="Editar">
              <Edit2 size={15} /> Editar
            </button>
          </div>
        </div>

        <div className="jp-body">
          {/* Image gallery */}
          {imgs.length > 0 && (
            <div className="jp-gallery">
              <img src={thumb(imgs[imgIdx], 1280)} alt={juego.nombre} className="jp-main-img" onClick={() => setZoom(true)} title="Ver en grande"/>
              <button className="jp-zoom-btn" onClick={() => setZoom(true)} title="Ver en grande"><Maximize2 size={14}/></button>
              {imgs.length > 1 && (
                <>
                  <button className="jp-gallery-btn jp-gallery-prev"
                    onClick={() => setImgIdx(i => (i - 1 + imgs.length) % imgs.length)}>
                    <ChevronLeft size={18} />
                  </button>
                  <button className="jp-gallery-btn jp-gallery-next"
                    onClick={() => setImgIdx(i => (i + 1) % imgs.length)}>
                    <ChevronRight size={18} />
                  </button>
                  <div className="jp-gallery-dots">
                    {imgs.map((_, i) => (
                      <button key={i} className={`jp-dot ${i === imgIdx ? 'jp-dot-active' : ''}`}
                        onClick={() => setImgIdx(i)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Title */}
          <div className="jp-title-block">
            <h2 className="jp-title">{juego.nombre}</h2>
            {juego.tituloOriginal && <p className="jp-dev" style={{ fontStyle:'italic' }}>{juego.tituloOriginal}</p>}
            {juego.desarrolladora && <p className="jp-dev">{juego.desarrolladora}</p>}
            <div className="jp-badges">
              {juego.estado && <Badge color={EC[juego.estado] || 'default'}>{juego.estado}</Badge>}
              {juego.genero && (
                <span className="jp-filter-tag" onClick={() => onFilterBy?.('genero', juego.genero)}>
                  <Badge color="default">{juego.genero}</Badge>
                </span>
              )}
            </div>
          </div>

          {/* Platform card */}
          {plataforma && (
            <div className="jp-platform-card">
              <div className="jp-platform-icon"><Monitor size={16} /></div>
              <div>
                <p className="jp-platform-name">{plataforma.nombre}</p>
                <p className="jp-platform-marca">{plataforma.marca}{plataforma.modelo ? ` · ${plataforma.modelo}` : ''}</p>
              </div>
              {plataforma.tipo && (
                <span style={{ marginLeft: 'auto' }}>
                  <Badge color={TC[plataforma.tipo] || 'default'}>{plataforma.tipo}</Badge>
                </span>
              )}
            </div>
          )}

          {/* Data rows — each value is clickable to filter */}
          <div className="jp-data">
            <p className="jp-section-title">Detalles</p>

            <Row icon={Calendar} label="Lanzamiento">
              <FilterTag field="anio" value={juego.fechaLanzamiento?.slice(0, 4)}
                label={juego.fechaLanzamiento} />
            </Row>

            <Row icon={Calendar} label="Adquisición">
              <span style={{ fontFamily: 'var(--font-m)', fontSize: 12 }}>
                {juego.fechaAdquisicion || '—'}
              </span>
            </Row>

            <Row icon={Euro} label="Precio">
              <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-m)', fontSize: 13 }}>
                {juego.precio ? `${Number(juego.precio).toFixed(2)} €` : '—'}
              </span>
            </Row>

            <Row icon={Tag} label="Género">
              <FilterTag field="genero" value={juego.genero} />
            </Row>

            <Row icon={Users} label="Jugadores">
              <FilterTag field="modoDeJuego" value={juego.modoDeJuego}
                label={juego.modoDeJuego + (juego.numeroDeJugadores ? ` (${juego.numeroDeJugadores})` : '')} />
            </Row>

            <Row icon={Globe} label="Región">
              <FilterTag field="region" value={juego.region} />
            </Row>

            <Row icon={Info} label="Idiomas">
              <span style={{ fontSize: 12, color: 'var(--text-1)' }}>{juego.idiomas || '—'}</span>
            </Row>

            <Row icon={Copy} label="Unidades">
              <span style={{ fontFamily: 'var(--font-m)', fontSize: 13, color: (juego.unidades || 1) > 1 ? 'var(--cyan)' : 'var(--text-1)', fontWeight: 600 }}>
                {juego.unidades || 1}{(juego.unidades || 1) > 1 ? ' (duplicado)' : ''}
              </span>
            </Row>
          </div>

          {/* Duración (HLTB) */}
          <div className="jp-data">
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <p className="jp-section-title" style={{ margin:0 }}>Duración</p>
              <button className="jp-mini-btn" onClick={refreshHltb} disabled={hltbLoading}
                title="Actualizar datos de HowLongToBeat">
                <RefreshCw size={11} className={hltbLoading ? 'spin' : ''}/>
                {hltbLoading ? 'Buscando…' : 'Actualizar'}
              </button>
            </div>

            {hltbError && (
              <p style={{ fontSize:11, color:'#f87171', marginBottom:6 }}>
                {hltbError}{!juego.tituloOriginal && ' — si el título está en castellano, prueba a escribir el original en «Editar → Título original».'}
              </p>
            )}

            {hltbLoading && !(hltbMain > 0 || hltbExtra > 0 || hltbComplete > 0) ? (
              <p style={{ fontSize:12, color:'var(--text-3)' }}>Consultando HowLongToBeat…</p>
            ) : (hltbMain > 0 || hltbExtra > 0 || hltbComplete > 0) ? (
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <HltbChip label="Historia" hours={hltbMain} color="var(--cyan)"/>
                <HltbChip label="Historia + Extras" hours={hltbExtra} color="var(--gold)"/>
                <HltbChip label="Completista" hours={hltbComplete} color="var(--accent)"/>
              </div>
            ) : null}
            {(hltbMain > 0 || hltbExtra > 0 || hltbComplete > 0) && juego.hltbName && juego.hltbName !== juego.nombre ? (
              <p style={{ fontSize:10, color:'var(--text-3)', marginTop:6 }}>En HowLongToBeat: «{juego.hltbName}»</p>
            ) : null}
            {(hltbMain > 0 || hltbExtra > 0 || hltbComplete > 0) || hltbLoading ? null : (
              <p style={{ fontSize:12, color:'var(--text-3)' }}>
                {juego.hltbFetched && !hltbError ? 'HowLongToBeat no tiene tiempos para este juego.' : 'Sin datos — pulsa Actualizar para buscar en HowLongToBeat'}
              </p>
            )}
          </div>

          {/* Ventas totales (VGChartz) */}
          <VentasSection juego={juego} onUpdated={onRefresh}/>

          {/* Valoración personal */}
          {juego.valoracion && (
            <div className="jp-data">
              <p className="jp-section-title">Mi valoración</p>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ display:'flex', gap:3 }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <div key={n} style={{
                      width:14, height:14, borderRadius:2,
                      background: n <= juego.valoracion ? 'var(--gold)' : 'var(--bg-4)',
                    }}/>
                  ))}
                </div>
                <span style={{ fontFamily:'var(--font-m)', fontSize:14, color:'var(--gold)', fontWeight:700 }}>
                  {juego.valoracion}/10
                </span>
              </div>
            </div>
          )}

          {/* Créditos Finales: ¿me lo he pasado? */}
          {credito && (
            <div className={'jp-cf jp-cf-' + credito.e}>
              <div className="jp-cf-head">
                <Trophy size={15}/>
                <b>{credito.e === 'terminado' ? `Terminado${credito.y ? ' en ' + credito.y : ''}` : ESTADO_CF[credito.e]?.txt}</b>
                {credito.x && <span className="badge badge-default">Rejugado</span>}
                {cf.url && <a href={cf.url} target="_blank" rel="noreferrer" title="Abrir Créditos Finales"><ExternalLink size={13}/></a>}
              </div>
              {credito.e === 'terminado' && (
                <div className="jp-cf-nums">
                  {credito.r != null && <span className="jp-cf-stars" title={`${credito.r} de 5`}>{estrellas(credito.r)}</span>}
                  {credito.h ? <span>{String(credito.h).replace('.', ',')} h</span> : null}
                  {credito.d && <span>{credito.d.split('-').reverse().join('/')}</span>}
                </div>
              )}
              {credito.s && <p className="jp-cf-song">♪ {credito.s}</p>}
              {credito.c && <p className="jp-cf-com">{credito.c}</p>}
            </div>
          )}

          {/* Préstamo */}
          <div className={'jp-loan' + (juego.prestadoA ? ' on' : '')}>
            <BookOpen size={15}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              {juego.prestadoA
                ? <><p className="jp-loan-t">Lo tiene {juego.prestadoA}</p>{juego.fechaPrestamo && <p className="jp-loan-d">desde el {juego.fechaPrestamo.split('-').reverse().join('/')}</p>}</>
                : <p className="jp-loan-d">Lo tienes tú</p>}
            </div>
            {juego.prestadoA
              ? <button className="jp-action-btn" onClick={async () => { await api.juegos.devolver(juego.id); onRefresh?.(); }}>Me lo han devuelto</button>
              : <button className="jp-action-btn" onClick={() => setPrestar(true)}>Prestar…</button>}
          </div>
          <HistorialPrestamos raw={juego.historialPrestamos}/>
          <label className="jp-sinfinal" title="Juegos sin historia que acabar (Mario Kart, Smash, party…): no cuentan para la pila de la vergüenza">
            <input type="checkbox" checked={!!juego.sinFinal} onChange={async e => { await api.juegos.sinFinal({ id: juego.id, valor: e.target.checked }); onRefresh?.(); }}/>
            No tiene final <small>(no cuenta para la pila de la vergüenza)</small>
          </label>

          {/* Comments */}
          {juego.comentarios && (
            <div className="jp-comments">
              <p className="jp-section-title">Comentarios</p>
              <p className="jp-comment-text">{juego.comentarios}</p>
            </div>
          )}

          {/* Thumbnail strip for more images */}
          {imgs.length > 1 && (
            <div className="jp-thumbs">
              {imgs.map((img, i) => (
                <img key={i} src={thumb(img, 200)} alt=""
                  className={`jp-thumb ${i === imgIdx ? 'jp-thumb-active' : ''}`}
                  onClick={() => setImgIdx(i)} />
              ))}
            </div>
          )}
        </div>
      </div>
      {zoom && imgs[imgIdx] && (
        <div className="jp-lightbox" onClick={() => setZoom(false)}>
          <img src={imgSrc(imgs[imgIdx])} alt={juego.nombre}/>
          <button className="jp-close" onClick={() => setZoom(false)}><X size={20}/></button>
        </div>
      )}
      <PrestarModal open={prestar} juego={juego} onClose={() => setPrestar(false)} onSaved={onRefresh}/>
    </>
  );
}

function HltbChip({ label, hours, color }) {
  const display = hours > 0 ? `${String(hours).replace('.', ',')} h` : '—';
  return (
    <div style={{ background:'var(--bg-3)', border:`1px solid ${color}33`,
      borderRadius:'var(--r-lg)', padding:'8px 14px', textAlign:'center', minWidth:80 }}>
      <div style={{ fontSize:18, fontWeight:800, color, fontFamily:'var(--font-m)' }}>{display}</div>
      <div style={{ fontSize:10, color:'var(--text-3)', textTransform:'uppercase',
        letterSpacing:'.06em', marginTop:2 }}>{label}</div>
    </div>
  );
}
