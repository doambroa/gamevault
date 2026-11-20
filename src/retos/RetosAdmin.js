import React, { useMemo, useState } from 'react';
import { Trash2, Plus, ArrowUp, ArrowDown, Search, Loader, Download, ChevronDown, Gamepad2, Wand2 } from 'lucide-react';
import { Modal, Btn } from '../components/ui/index';
import { guardarPlaylist, guardarPorra, borrarReto, aliasReto } from '../community/account';
import { searchGames } from '../utils/rawg';
import { thumb } from '../utils/imgSrc';
import { ESTACIONES, limpiarFrases, fechaDia, fmtDia } from './util';
import { TGA_2026 } from './tga2026';

// ── Playlist: título, estación, día de inicio y las frases (una por línea) ───────
export function PlaylistEditor({ pl, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    titulo: pl?.titulo || '', estacion: pl?.estacion || 'invierno', inicio: pl?.inicio || '', estado: pl?.estado || 'borrador',
    intro: pl?.intro || '', video: pl?.video || '', playlist: pl?.playlist || '', verFuturas: !!pl?.verFuturas,
    frases: (pl?.dias || []).map(d => d.t).join('\n'),
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const dias = limpiarFrases(f.frases);
  const guardar = async (estado = f.estado) => {
    setBusy(true); setErr('');
    try {
      const r = await guardarPlaylist({ id: pl?.id, titulo: f.titulo, estacion: f.estacion, inicio: f.inicio, estado, intro: f.intro, video: f.video, playlist: f.playlist, verFuturas: f.verFuturas, dias });
      onSaved(r.playlist);
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  const borrar = async () => {
    if (!window.confirm(`¿Borrar «${pl.titulo}» con todos sus temas? Se guarda una copia en el servidor (retos.json.bak).`)) return;
    try { await borrarReto('playlist', pl.id); onSaved(null); } catch (e) { setErr(e.message); }
  };
  const fin = f.inicio && dias.length ? fechaDia(f.inicio, dias.length) : null;
  return (
    <Modal open onClose={onClose} title={pl ? 'Editar playlist' : 'Nueva playlist'} width={720}>
      <div className="rt-form">
        <div className="rt-row">
          <label className="field"><span className="field-label">Título</span><input className="field-input" value={f.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Invierno Festivo Switcherino"/></label>
          <label className="field" style={{ maxWidth: 170 }}><span className="field-label">Estación</span>
            <select className="field-input field-select" value={f.estacion} onChange={e => set('estacion', e.target.value)}>
              {Object.entries(ESTACIONES).map(([k, e]) => <option key={k} value={k}>{e.nombre}</option>)}
            </select></label>
        </div>
        <div className="rt-row">
          <label className="field"><span className="field-label">Empieza el</span><input type="date" className="field-input" value={f.inicio} onChange={e => set('inicio', e.target.value)}/></label>
          <label className="field"><span className="field-label">Estado</span>
            <select className="field-input field-select" value={f.estado} onChange={e => set('estado', e.target.value)}>
              <option value="borrador">Borrador (solo lo ves tú)</option>
              <option value="activo">En marcha</option>
              <option value="terminado">Terminada</option>
            </select></label>
        </div>
        <p className="rt-hint">{dias.length} día{dias.length !== 1 ? 's' : ''}{fin ? ` · del ${fmtDia(fechaDia(f.inicio, 1), { day: 'numeric', month: 'long' })} al ${fmtDia(fin, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}. Cada día, a quien no haya puesto su tema le sale un aviso con la frase.</p>
        <label className="field"><span className="field-label">Las frases, una por línea (puedes pegar la lista del documento: «Día 1 - …» o «1. …» se limpia solo)</span>
          <textarea className="field-input field-textarea rt-frases" rows={10} value={f.frases} onChange={e => set('frases', e.target.value)} placeholder={'Inicio del invierno, entra el frío…\nDía de mucho frío aplacado por tu estancia en unas termas…'}/></label>
        <label className="field"><span className="field-label">Texto de presentación (opcional)</span><textarea className="field-input field-textarea" rows={2} value={f.intro} onChange={e => set('intro', e.target.value)}/></label>
        <label className="rt-check"><input type="checkbox" checked={f.verFuturas} onChange={e => set('verFuturas', e.target.checked)}/> Enseñar todas las frases desde el principio (si no, cada día se descubre el suyo y el de mañana al poner tu tema)</label>
        <div className="rt-row">
          <label className="field"><span className="field-label">Vídeo final en YouTube (cuando lo subas)</span><input className="field-input" value={f.video} onChange={e => set('video', e.target.value)} placeholder="https://www.youtube.com/watch?v=…"/></label>
          <label className="field"><span className="field-label">Lista de YouTube (opcional)</span><input className="field-input" value={f.playlist} onChange={e => set('playlist', e.target.value)} placeholder="https://www.youtube.com/playlist?list=…"/></label>
        </div>
        {err && <p className="field-error">{err}</p>}
        <div className="rt-acc">
          {pl && <Btn variant="ghost" onClick={borrar}><Trash2 size={14}/> Borrar</Btn>}
          <span style={{ flex: 1 }}/>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          {f.estado === 'borrador' && f.inicio && dias.length > 0 && <Btn variant="secondary" disabled={busy} onClick={() => guardar('activo')}>Guardar y arrancar</Btn>}
          <Btn disabled={busy || !dias.length} onClick={() => guardar()}>{busy && <Loader size={14} className="spin"/>} Guardar</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── Quién es quién: los apodos de los documentos (gente sin cuenta) ↔ cuentas ─────
export function AliasModal({ data, onClose, recargar }) {
  const apodos = useMemo(() => {
    const m = new Map();
    const add = q => { if (q?.alias) { const k = q.alias.toLowerCase().replace(/[^a-z0-9]/g, ''); if (!m.has(k)) m.set(k, { alias: q.alias, user: q.sinCuenta ? '' : q.user }); } };
    for (const pl of data.playlists || []) for (const d of Object.values(pl.aportes || {})) for (const a of Object.values(d)) add(a.quien);
    for (const po of data.porras || []) for (const p of po.participantes || []) add(p.quien);
    for (const [k, u] of Object.entries(data.alias || {})) if (!m.has(k)) m.set(k, { alias: k, user: u }); else m.get(k).user = u;
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);
  const [busy, setBusy] = useState('');
  const cambiar = async (k, user) => {
    setBusy(k);
    try { await aliasReto(k, user); await recargar(); } catch (e) { alert(e.message); } finally { setBusy(''); }
  };
  return (
    <Modal open onClose={onClose} title="Quién es quién" width={560}>
      <p className="rt-hint">Los temas de los documentos van con el apodo del grupo. Si esa persona tiene cuenta (o un perfil por reclamar), únela aquí y sus temas saldrán con su foto. Los apodos iguales al usuario se unen solos.</p>
      {apodos.length === 0 && <p className="gv-muted">Todavía no hay apodos.</p>}
      <div className="rt-alias">
        {apodos.map(([k, a]) => (
          <div key={k} className="rt-alias-row">
            <b>@{a.alias}</b>
            <select className="field-input field-select" value={(data.alias || {})[k] || a.user || ''} disabled={busy === k} onChange={e => cambiar(k, e.target.value)}>
              <option value="">Sin cuenta</option>
              {(data.gente || []).map(g => <option key={g.user} value={g.user}>{g.display}{g.pending ? ' (sin reclamar)' : ''}</option>)}
            </select>
            {busy === k && <Loader size={14} className="spin"/>}
          </div>
        ))}
      </div>
      <div className="rt-acc"><span style={{ flex: 1 }}/><Btn onClick={onClose}>Hecho</Btn></div>
    </Modal>
  );
}

// ── Porra: categorías con sus nominados (con la plantilla de los Game Awards 2026) ─
const isoLocal = iso => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const localIso = v => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? '' : d.toISOString(); };
const nid = () => Math.random().toString(36).slice(2, 10);

export function PorraEditor({ po, onClose, onSaved }) {
  const [f, setF] = useState(() => po
    ? { titulo: po.titulo, fecha: po.fecha || '', cierre: isoLocal(po.cierre), estado: po.estado, intro: po.intro || '', categorias: JSON.parse(JSON.stringify(po.categorias || [])) }
    : { titulo: TGA_2026.titulo, fecha: TGA_2026.fecha, cierre: TGA_2026.cierre, estado: 'borrador', intro: TGA_2026.intro, categorias: JSON.parse(JSON.stringify(TGA_2026.categorias)) });
  const [abierta, setAbierta] = useState(null);
  const [busy, setBusy] = useState(false);
  const [buscando, setBuscando] = useState('');
  const [err, setErr] = useState('');
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const setCat = (i, fn) => setF(x => { const c = [...x.categorias]; c[i] = fn({ ...c[i] }); return { ...x, categorias: c }; });
  const moverCat = (i, d) => setF(x => { const c = [...x.categorias]; const j = i + d; if (j < 0 || j >= c.length) return x; [c[i], c[j]] = [c[j], c[i]]; return { ...x, categorias: c }; });
  const setNom = (ci, ni, k, v) => setCat(ci, c => { const n = [...c.nominados]; n[ni] = { ...n[ni], [k]: v }; return { ...c, nominados: n }; });
  const sinImg = f.categorias.reduce((s, c) => s + c.nominados.filter(n => !n.img).length, 0);

  const guardar = async (estado = f.estado) => {
    setBusy(true); setErr('');
    try {
      const r = await guardarPorra({ id: po?.id, titulo: f.titulo, fecha: f.fecha, cierre: localIso(f.cierre), estado, intro: f.intro, categorias: f.categorias });
      onSaved(r.porra);
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  const borrar = async () => {
    if (!window.confirm(`¿Borrar «${po.titulo}» con todos los votos? Se guarda una copia en el servidor (retos.json.bak).`)) return;
    try { await borrarReto('porra', po.id); onSaved(null); } catch (e) { setErr(e.message); }
  };
  const plantilla = () => {
    if (f.categorias.length && !window.confirm('¿Cambiar las categorías por las de The Game Awards 2026?')) return;
    setF(x => ({ ...x, categorias: JSON.parse(JSON.stringify(TGA_2026.categorias)) }));
  };
  // Portada de RAWG para un nominado (o el juego de su subtítulo, p. ej. en «Mejor interpretación»)
  const buscarUna = async (ci, ni, siguiente = false) => {
    const n = f.categorias[ci].nominados[ni];
    const q = (/interpret|performance/i.test(f.categorias[ci].nombre) && n.sub) ? n.sub : n.n;
    setBuscando(ci + ':' + ni);
    try {
      const r = (await searchGames(q, 6))?.results || [];
      const imgs = r.map(g => g.background_image).filter(Boolean);
      if (!imgs.length) return false;
      const k = siguiente ? (imgs.indexOf(n.img) + 1) % imgs.length : 0;
      setNom(ci, ni, 'img', imgs[k]);
      return true;
    } catch { return false; } finally { setBuscando(''); }
  };
  const buscarTodas = async () => {
    for (let ci = 0; ci < f.categorias.length; ci++) for (let ni = 0; ni < f.categorias[ci].nominados.length; ni++) {
      if (!f.categorias[ci].nominados[ni].img && !/creador|creator|esports|adapta|creaci|user creation/i.test(f.categorias[ci].nombre + ' ' + (f.categorias[ci].en || ''))) await buscarUna(ci, ni);
    }
  };

  return (
    <Modal open onClose={onClose} title={po ? 'Editar porra' : 'Nueva porra'} width={860}>
      <div className="rt-form">
        <div className="rt-row">
          <label className="field"><span className="field-label">Título</span><input className="field-input" value={f.titulo} onChange={e => set('titulo', e.target.value)}/></label>
          <label className="field" style={{ maxWidth: 200 }}><span className="field-label">Estado</span>
            <select className="field-input field-select" value={f.estado} onChange={e => set('estado', e.target.value)}>
              <option value="borrador">Borrador (solo lo ves tú)</option>
              <option value="abierta">Abierta para votar</option>
              <option value="cerrada">Cerrada</option>
            </select></label>
        </div>
        <div className="rt-row">
          <label className="field"><span className="field-label">Día de la gala</span><input type="date" className="field-input" value={f.fecha} onChange={e => set('fecha', e.target.value)}/></label>
          <label className="field"><span className="field-label">Se cierra el (tu hora)</span><input type="datetime-local" className="field-input" value={f.cierre} onChange={e => set('cierre', e.target.value)}/></label>
        </div>
        <label className="field"><span className="field-label">Texto de presentación</span><textarea className="field-input field-textarea" rows={2} value={f.intro} onChange={e => set('intro', e.target.value)}/></label>
        <div className="rt-cats-h">
          <b>{f.categorias.length} categorías · {f.categorias.reduce((s, c) => s + c.nominados.length, 0)} nominados</b>
          <span style={{ flex: 1 }}/>
          <Btn variant="ghost" size="sm" onClick={plantilla}><Download size={14}/> Cargar Game Awards 2026</Btn>
          {sinImg > 0 && <Btn variant="ghost" size="sm" onClick={buscarTodas} disabled={!!buscando}><Wand2 size={14}/> Buscar portadas que faltan ({sinImg})</Btn>}
        </div>
        <div className="rt-cats">
          {f.categorias.map((c, ci) => (
            <div key={c.id || ci} className={'rt-cat' + (abierta === ci ? ' open' : '')}>
              <div className="rt-cat-h">
                <button className="icon-btn" onClick={() => setAbierta(a => a === ci ? null : ci)} aria-label="Abrir"><ChevronDown size={15} className={abierta === ci ? '' : 'rot'}/></button>
                <input className="field-input" value={c.nombre} onChange={e => setCat(ci, x => ({ ...x, nombre: e.target.value }))} aria-label="Nombre de la categoría"/>
                <label className="rt-pts" title="Puntos por acertar"><input type="number" min={1} max={10} className="field-input" value={c.puntos || 1} onChange={e => setCat(ci, x => ({ ...x, puntos: +e.target.value || 1 }))}/> pts</label>
                <span className="rt-cat-mini">{c.nominados.slice(0, 6).map(n => n.img ? <img key={n.id} src={thumb(n.img, 200)} alt=""/> : <i key={n.id}/>)}</span>
                <button className="icon-btn" onClick={() => moverCat(ci, -1)} aria-label="Subir"><ArrowUp size={14}/></button>
                <button className="icon-btn" onClick={() => moverCat(ci, 1)} aria-label="Bajar"><ArrowDown size={14}/></button>
                <button className="icon-btn" onClick={() => window.confirm(`¿Quitar «${c.nombre}»?`) && setF(x => ({ ...x, categorias: x.categorias.filter((_, k) => k !== ci) }))} aria-label="Quitar categoría"><Trash2 size={14}/></button>
              </div>
              {abierta === ci && (
                <div className="rt-noms">
                  {c.nominados.map((n, ni) => (
                    <div key={n.id || ni} className="rt-nom">
                      <span className="rt-nom-img">{n.img ? <img src={thumb(n.img, 200)} alt=""/> : <Gamepad2 size={16}/>}</span>
                      <input className="field-input" value={n.n} placeholder="Nombre" onChange={e => setNom(ci, ni, 'n', e.target.value)}/>
                      <input className="field-input" value={n.sub || ''} placeholder="Subtítulo (estudio, juego…)" onChange={e => setNom(ci, ni, 'sub', e.target.value)}/>
                      <input className="field-input" value={n.img || ''} placeholder="Imagen (https://…)" onChange={e => setNom(ci, ni, 'img', e.target.value)}/>
                      <button className="icon-btn" title={n.img ? 'Probar otra portada de RAWG' : 'Buscar portada en RAWG'} onClick={() => buscarUna(ci, ni, !!n.img)} disabled={!!buscando}>{buscando === ci + ':' + ni ? <Loader size={14} className="spin"/> : <Search size={14}/>}</button>
                      <button className="icon-btn" title="Quitar" onClick={() => setCat(ci, x => ({ ...x, nominados: x.nominados.filter((_, k) => k !== ni) }))}><Trash2 size={14}/></button>
                    </div>
                  ))}
                  <button className="pl-add" onClick={() => setCat(ci, x => ({ ...x, nominados: [...x.nominados, { id: nid(), n: '', sub: '', img: '' }] }))}><Plus size={14}/> Añadir nominado</button>
                </div>
              )}
            </div>
          ))}
          <button className="pl-add" onClick={() => { setF(x => ({ ...x, categorias: [...x.categorias, { id: nid(), nombre: 'Nueva categoría', puntos: 1, nominados: [] }] })); setAbierta(f.categorias.length); }}><Plus size={14}/> Añadir categoría</button>
        </div>
        {err && <p className="field-error">{err}</p>}
        <div className="rt-acc">
          {po && <Btn variant="ghost" onClick={borrar}><Trash2 size={14}/> Borrar</Btn>}
          <span style={{ flex: 1 }}/>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          {f.estado === 'borrador' && <Btn variant="secondary" disabled={busy} onClick={() => guardar('abierta')}>Guardar y abrir para votar</Btn>}
          <Btn disabled={busy} onClick={() => guardar()}>{busy && <Loader size={14} className="spin"/>} Guardar</Btn>
        </div>
      </div>
    </Modal>
  );
}
