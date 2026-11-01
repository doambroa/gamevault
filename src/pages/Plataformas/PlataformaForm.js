import React, { useState, useEffect, useRef } from 'react';
import { Image, Loader, Wand2 } from 'lucide-react';
import { Btn, Modal, Input, Select, Textarea, ImgThumbs, CoverPicker } from '../../components/ui/index';
import { getCoversForGame } from '../../utils/rawg';
import { buscarConsolaLocal, buscarImagenWikipedia } from '../../utils/wikipedia';
import { imagenPorNombre } from '../../data/consolas';
import { getConsolaSvg } from '../../utils/consolaSvg';
import { parseImgs } from '../../utils/imgSrc';

const TIPOS = ['Sobremesa','Portátil','PC','Híbrida'];
const EMPTY = {
  nombre:'', marca:'', modelo:'', tipo:'', fechaAdquisicion:'',
  fechaLanzamientoEuropa:'', fechaLanzamientoAmerica:'', fechaLanzamientoAsia:'',
  precio:'', precioSalida:'', precioAmerica:'', precioAsia:'',
  unidadesVendidas:'', comentarios:'', imagenes:[], unidades:1
};

export default function PlataformaForm({ open, initial, onClose, onSave }) {
  const [f, setF]                   = useState(EMPTY);
  const [err, setErr]               = useState({});
  const [saving, setSaving]         = useState(false);
  const [covers, setCovers]         = useState(false);
  const [searching, setSearching]   = useState(false);
  const [wikiMsg, setWikiMsg]       = useState('');
  // Autocomplete
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug]         = useState(false);
  const [fetchingWiki, setFetchingWiki] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (initial) {
      // nulls de la BD → '' (inputs controlados) e imágenes siempre como array
      const sane = Object.fromEntries(Object.entries({ ...EMPTY, ...initial }).map(([k, v]) => [k, v === null ? '' : v]));
      setF({ ...sane, imagenes: parseImgs(initial.imagenes), unidades: initial.unidades || 1 });
    } else setF(EMPTY);
    setErr({}); setWikiMsg(''); setSuggestions([]); setShowSug(false);
  }, [initial, open]);

  const s = k => e => setF(v => ({...v, [k]: e.target.value}));

  // Nombre field change — triggers local autocomplete
  const onNombreChange = e => {
    const val = e.target.value;
    setF(v => ({...v, nombre: val}));
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const sugs = buscarConsolaLocal(val, 6);
      setSuggestions(sugs);
      setShowSug(sugs.length > 0);
    }, 150);
  };

  // User picks a suggestion — only autofills fields + SVG, no Wikipedia auto-fetch
  const pickSuggestion = (consola) => {
    setShowSug(false);
    setSuggestions([]);
    const anio = consola.anioEU || '';
    const dateEU = anio ? `${anio}-01-01` : '';
    const svg = imagenPorNombre(consola.nombre) || getConsolaSvg(consola.nombre);
    setF(v => ({
      ...v,
      nombre: consola.nombre,
      marca: consola.marca || v.marca,
      modelo: consola.modelo || v.modelo,
      tipo: consola.tipo || v.tipo,
      fechaLanzamientoEuropa: dateEU || v.fechaLanzamientoEuropa,
      imagenes: v.imagenes.length ? v.imagenes : (svg ? [svg] : []),
    }));
    setWikiMsg('');
  };

  // Manual Wikipedia image fetch
  const fetchWikipedia = async () => {
    if (!f.nombre.trim()) { setWikiMsg('Escribe el nombre primero.'); return; }
    setFetchingWiki(true);
    setWikiMsg('Buscando imagen en Wikipedia…');
    try {
      const dataUri = await buscarImagenWikipedia(f.nombre);
      if (dataUri) {
        setF(v => ({...v, imagenes: v.imagenes.length ? [dataUri, ...v.imagenes] : [dataUri]}));
        setWikiMsg('✅ Imagen obtenida de Wikipedia');
      } else {
        setWikiMsg('No se encontró imagen en Wikipedia.');
      }
    } catch {
      setWikiMsg('Error al conectar con Wikipedia.');
    }
    setFetchingWiki(false);
  };

  const validate = () => {
    const e = {};
    if (!String(f.nombre || '').trim()) e.nombre = 'Obligatorio';
    if (f.unidades !== '' && f.unidades != null && !(parseInt(f.unidades, 10) >= 1)) e.unidades = 'Mínimo 1';
    setErr(e); return !Object.keys(e).length;
  };
  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try { await onSave(f); } finally { setSaving(false); }
  };

  const svgPlaceholder = f.nombre ? getConsolaSvg(f.nombre) : null;
  const imgs = f.imagenes || [];

  const searchCovers = async () => {
    if (!f.nombre.trim()) { setWikiMsg('Escribe el nombre primero.'); return; }
    setSearching(true);
    try {
      const results = await getCoversForGame(f.nombre + ' console');
      if (results.length > 0) setCovers(true);
      else setWikiMsg('Sin resultados en RAWG para esta consola.');
    } catch { setWikiMsg('Error al conectar con RAWG.'); }
    setSearching(false);
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={f?.id ? 'Editar plataforma' : 'Nueva plataforma'} width={760}>
        <div className="form-gap">
          {/* Nombre with autocomplete */}
          <div className="grid-3">
            <div className="field" style={{ position:'relative' }}>
              <label className="field-label">Nombre *</label>
              <input
                className="field-input"
                style={err.nombre ? { borderColor:'var(--accent)' } : {}}
                value={f.nombre}
                onChange={onNombreChange}
                onFocus={() => suggestions.length && setShowSug(true)}
                onBlur={() => setTimeout(() => setShowSug(false), 150)}
                placeholder="PlayStation 5"
                autoComplete="off"
              />
              {err.nombre && <span className="field-error">{err.nombre}</span>}
              {showSug && (
                <ul className="autocomplete-list">
                  {suggestions.map((c,i) => (
                    <li key={i} className="autocomplete-item"
                      onMouseDown={() => pickSuggestion(c)}>
                      <span className="ac-nombre">{c.nombre}</span>
                      <span className="ac-meta">{c.marca} · {c.tipo} · {c.anioEU}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Input label="Marca"  value={f.marca}  onChange={s('marca')}  placeholder="Sony"/>
            <Input label="Modelo" value={f.modelo} onChange={s('modelo')} placeholder="CFI-1216A"/>
          </div>

          {/* Wiki status */}
          {(wikiMsg || fetchingWiki) && (
            <div className="rawg-bar" style={{ marginTop:-4 }}>
              {fetchingWiki && <Loader size={14} className="spin"/>}
              <span className="rawg-msg">{wikiMsg}</span>
            </div>
          )}

          <div className="grid-3">
            <Select label="Tipo" value={f.tipo} onChange={s('tipo')}>
              <option value="">--</option>
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </Select>
            <Input label="Fecha adquisición" type="date" value={f.fechaAdquisicion} onChange={s('fechaAdquisicion')}/>
            <Input label="Unidades" type="number" min="1" step="1" value={f.unidades} onChange={s('unidades')}
              error={err.unidades} title="Cuántas consolas iguales tienes"/>
          </div>
          <p className="field-label">Fechas de lanzamiento</p>
          <div className="grid-3">
            <Input label="Europa"  type="date" value={f.fechaLanzamientoEuropa}  onChange={s('fechaLanzamientoEuropa')}/>
            <Input label="América" type="date" value={f.fechaLanzamientoAmerica} onChange={s('fechaLanzamientoAmerica')}/>
            <Input label="Asia"    type="date" value={f.fechaLanzamientoAsia}    onChange={s('fechaLanzamientoAsia')}/>
          </div>
          <p className="field-label">Precios (€)</p>
          <div className="grid-4">
            <Input label="Pagado"    type="number" step="0.01" value={f.precio}        onChange={s('precio')}/>
            <Input label="Salida EU" type="number" step="0.01" value={f.precioSalida}  onChange={s('precioSalida')}/>
            <Input label="América"   type="number" step="0.01" value={f.precioAmerica} onChange={s('precioAmerica')}/>
            <Input label="Asia"      type="number" step="0.01" value={f.precioAsia}    onChange={s('precioAsia')}/>
          </div>
          <Input label="Unidades vendidas" value={f.unidadesVendidas} onChange={s('unidadesVendidas')} placeholder="50 millones"/>
          <Textarea label="Comentarios" value={f.comentarios} onChange={s('comentarios')}/>

          {/* Images */}
          <div className="field">
            <label className="field-label">Imágenes</label>
            {imgs.length === 0 && svgPlaceholder && (
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                <img src={svgPlaceholder} alt="SVG placeholder"
                  style={{ width:60, height:60, borderRadius:'var(--r)', border:'1px solid var(--border)', objectFit:'cover' }}/>
                <div>
                  <p style={{ fontSize:12, color:'var(--text-2)', marginBottom:4 }}>Vista previa SVG (se usará si no añades imagen)</p>
                  <button className="rawg-btn" style={{ fontSize:11 }}
                    onClick={() => setF(v => ({...v, imagenes: [svgPlaceholder]}))}>
                    Usar este SVG como imagen
                  </button>
                </div>
              </div>
            )}
            <ImgThumbs images={imgs} onChange={imgs2 => setF(v => ({...v, imagenes: imgs2}))}/>
            <div className="rawg-bar" style={{ marginTop: 8 }}>
              <button className="rawg-btn" onClick={fetchWikipedia} disabled={fetchingWiki}>
                {fetchingWiki ? <Loader size={14} className="spin"/> : <Wand2 size={14}/>}
                Descargar de Wikipedia
              </button>
              <button className="rawg-btn" onClick={searchCovers} disabled={searching}>
                {searching ? <Loader size={14} className="spin"/> : <Image size={14}/>}
                Buscar en RAWG
              </button>
            </div>
          </div>

          <div className="form-actions">
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={submit} disabled={saving}>
              {saving ? 'Guardando…' : (f?.id ? 'Guardar cambios' : 'Crear')}
            </Btn>
          </div>
        </div>
      </Modal>

      <CoverPicker open={covers} onClose={() => setCovers(false)}
        gameName={f.nombre + ' console'}
        onSelect={urls => setF(v => ({...v, imagenes: [...v.imagenes, ...urls]}))}/>
    </>
  );
}
