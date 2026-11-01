import React, { useEffect, useState } from 'react';
import { imgSrc } from '../../utils/imgSrc';
import { X, Search, Loader, Check, ExternalLink } from 'lucide-react';
import { getCoversForGame, saveKey, getKey } from '../../utils/rawg';

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, variant='primary', size='md', ...props }) {
  return <button className={`btn btn-${variant} btn-${size}`} {...props}>{children}</button>;
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ label, error, className='', ...props }) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label">{label}</label>}
      <input className="field-input" {...props}/>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

// ── Textarea ──────────────────────────────────────────────────────────────────
export function Textarea({ label, error, rows=3, className='', ...props }) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label">{label}</label>}
      <textarea className="field-input field-textarea" rows={rows} {...props}/>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({ label, error, children, className='', ...props }) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label">{label}</label>}
      <select className="field-input field-select" {...props}>{children}</select>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width=640 }) {
  useEffect(() => {
    const fn = e => { if (e.key==='Escape') onClose(); };
    if (open) document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{maxWidth:width}}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Eliminar' }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={420}>
      <p style={{color:'var(--text-1)',marginBottom:24,lineHeight:1.6}}>{message}</p>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="danger" onClick={()=>{onConfirm();onClose();}}>{confirmLabel}</Btn>
      </div>
    </Modal>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, color='default' }) {
  return <span className={`badge badge-${color}`}>{children}</span>;
}

// ── Page Header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <p className="empty-title">{title}</p>
      {description && <p className="empty-desc">{description}</p>}
      {action}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function SkeletonList({ n=4, h=52 }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {Array.from({length:n}).map((_,i) => <div key={i} className="skeleton" style={{height:h}}/>)}
    </div>
  );
}

// ── Image Thumbs ──────────────────────────────────────────────────────────────
export function ImgThumbs({ images=[], onChange }) {
  const remove = i => onChange(images.filter((_,idx)=>idx!==i));
  // Mover imagen a posición 0 (portada)
  const setAsCover = i => {
    if (i === 0) return;
    const next = [...images];
    const [item] = next.splice(i, 1);
    next.unshift(item);
    onChange(next);
  };

  const handleLocal = async () => {
    if (!window.api) return;
    const paths = await window.api.images.select();
    if (paths?.length) onChange([...images, ...paths]);
  };

  return (
    <div className="img-thumbs">
      {images.map((img,i) => (
        <div key={i} className={`img-thumb ${i===0?'img-thumb-cover':''}`}
          title={i===0?'Portada principal':'Clic en ★ para usar como portada'}>
          <img src={imgSrc(img)} alt=""/>
          {/* Corona / estrella de portada */}
          {i === 0
            ? <span className="img-cover-badge" title="Portada">★</span>
            : <button className="img-set-cover" onClick={()=>setAsCover(i)} title="Usar como portada">★</button>
          }
          <button className="img-remove" onClick={()=>remove(i)}>×</button>
        </div>
      ))}
      {window.api && (
        <button className="img-add-btn" onClick={handleLocal} title="Añadir imagen local">
          <span>+</span><span style={{fontSize:10}}>Local</span>
        </button>
      )}
    </div>
  );
}

// ── Cover Picker Modal ────────────────────────────────────────────────────────
export function CoverPicker({ open, onClose, gameName, onSelect }) {
  const [query, setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [done, setDone]     = useState(false);

  useEffect(() => {
    if (open) { setQuery(gameName||''); setResults([]); setError(null); setDone(false); }
  }, [open, gameName]);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null); setDone(true); setResults([]);
    try { setResults(await getCoversForGame(query)); }
    catch { setError('Error al buscar. Comprueba tu conexión.'); }
    setLoading(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="🎮 Buscar carátulas" width={800}>
      <div style={{display:'flex',gap:10,marginBottom:14}}>
        <div className="search-wrap" style={{flex:1}}>
          <Search size={14} className="search-icon"/>
          <input className="field-input search-input" value={query}
            onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()}
            placeholder="Nombre del juego…" autoFocus/>
        </div>
        <Btn onClick={search} disabled={loading||!query.trim()}>
          {loading ? <Loader size={14} className="spin"/> : <Search size={14}/>} Buscar
        </Btn>
      </div>
      {error && <p style={{color:'var(--accent)',fontSize:13,marginBottom:10}}>{error}</p>}
      {loading && <div style={{textAlign:'center',padding:40}}><Loader size={32} className="spin" style={{color:'var(--accent)'}}/></div>}
      {done && !loading && results.length===0 && !error && (
        <p style={{color:'var(--text-2)',textAlign:'center',padding:32}}>Sin resultados para "{query}"</p>
      )}
      <div className="cover-grid">
        {results.map(c => (
          <div key={c.rawgId} className="cover-card" onClick={()=>{onSelect([c.coverUrl]);onClose();}}>
            <img src={c.coverUrl} alt={c.title} loading="lazy"/>
            <div className="cover-card-info">
              {c.title}<br/>
              <span style={{color:'var(--text-3)'}}>{c.released||''}</span>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── Settings Modal ────────────────────────────────────────────────────────────
export default function SettingsModal({ open, onClose, onWipe }) {
  const [key, setKey]   = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (open) { setKey(getKey()); setSaved(false); } }, [open]);
  const save = () => {
    saveKey(key);
    window.api?.config?.set('rawg_api_key', key.trim()).catch?.(() => {});   // también la usa el núcleo (búsqueda de nombres alternativos)
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };
  return (
    <Modal open={open} onClose={onClose} title="⚙️ Ajustes" width={480}>
      <p style={{fontSize:13,color:'var(--text-2)',marginBottom:8}}>
        RAWG API key — para buscar carátulas y autorellenar datos de juegos.
      </p>
      <a href="https://rawg.io/apidocs" target="_blank" rel="noreferrer"
        style={{fontSize:12,color:'var(--cyan)',display:'inline-flex',alignItems:'center',gap:4,marginBottom:14}}>
        <ExternalLink size={12}/> Obtener key gratuita en rawg.io
      </a>
      <div style={{display:'flex',gap:10}}>
        <input className="field-input" style={{flex:1}} type="password"
          placeholder="API key…" value={key} onChange={e=>setKey(e.target.value)}/>
        <Btn onClick={save} disabled={!key.trim()}>
          {saved ? <><Check size={14}/> Guardada</> : 'Guardar'}
        </Btn>
      </div>
      {onWipe && (
        <div className="danger-zone">
          <div>
            <strong>Zona peligrosa</strong>
            <p>Borra consolas, juegos y/o lista de deseos. Los ajustes se conservan.</p>
          </div>
          <Btn variant="danger" size="sm" onClick={() => { onClose(); onWipe(); }}>Borrar toda mi colección…</Btn>
        </div>
      )}
    </Modal>
  );
}
