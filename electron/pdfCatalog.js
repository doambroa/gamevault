// ─── Catálogo PDF ────────────────────────────────────────────────────────────
// Genera el HTML del catálogo con PÁGINAS A4 DE TAMAÑO FIJO: el contenido se reparte
// en bloques (cabecera de consola + filas de tarjetas, gráficas, índice) y cada bloque
// se coloca entero en una página; nunca se parte entre dos. Así ninguna carátula ni
// tarjeta puede quedar cortada.
// Sin dependencias de Electron: se puede probar renderizándolo en cualquier Chromium.

// ── Medidas (mm) ─────────────────────────────────────────────────────────────
const PAGE_H = 297, PAD_Y = 14, PAD_X = 12, FOOTER = 8;
const USABLE_H = PAGE_H - PAD_Y * 2 - FOOTER;          // alto útil por página
const COLS = 4, GAP = 4;
const CARD_H = 62;                                      // tarjeta de juego
const ROW_H = CARD_H + GAP;
const PLAT_HEAD_H = 30, CONT_HEAD_H = 11, BLOCK_GAP = 6;

const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const parseImgs = raw => { if (Array.isArray(raw)) return raw; try { return JSON.parse(raw || '[]') || []; } catch { return []; } };
const eur = n => `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
const eur2 = n => `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const hrs = h => (h > 0 ? `${String(Math.round(h * 10) / 10).replace('.', ',')} h` : '—');
const units = n => (n >= 1e6 ? `${(n / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M` : Math.round(n).toLocaleString('es-ES'));

const EC = { Nuevo: '#4ade80', Usado: '#facc15', Digital: '#22d3ee', Dañado: '#f87171' };

// ── Gráfica de barras horizontales (SVG) ─────────────────────────────────────
// Una sola serie → un solo color; etiquetas en tinta de texto, valor al final de la barra.
function barChart(rows, { color, fmt = v => String(v), width = 820, max = 10, sub = false } = {}) {
  rows = rows.slice(0, max);
  if (!rows.length) return `<div class="no-data">Sin datos suficientes todavía</div>`;
  // Las filas se reparten el alto disponible de la tarjeta (≈ 490 px de viewBox)
  const labelW = 270, valueW = 120, top = 6, AVAIL = 462;
  const rowH = Math.min(sub ? 48 : 42, Math.floor((AVAIL - top) / rows.length)), barH = Math.min(16, Math.round(rowH * 0.38));
  const plotW = width - labelW - valueW;
  const vmax = Math.max(...rows.map(r => r.value)) || 1;
  const H = top + rows.length * rowH;
  const parts = rows.map((r, i) => {
    const y = top + i * rowH;
    const w = Math.max(3, (r.value / vmax) * plotW);
    const by = y + (rowH - barH) / 2 - (sub ? 5 : 0);
    const label = r.label.length > 30 ? r.label.slice(0, 29) + '…' : r.label;
    return `
      <text x="${labelW - 12}" y="${by + barH - 3}" text-anchor="end" class="c-label">${esc(label)}</text>
      ${sub && r.sub ? `<text x="${labelW - 12}" y="${by + barH + 14}" text-anchor="end" class="c-sub">${esc(r.sub)}</text>` : ''}
      <rect x="${labelW}" y="${by}" width="${plotW}" height="${barH}" rx="4" class="c-track"/>
      <path d="M${labelW},${by} h${w - 4} a4,4 0 0 1 4,4 v${barH - 8} a4,4 0 0 1 -4,4 h-${w - 4} z" fill="${color}"/>
      <text x="${labelW + w + 8}" y="${by + barH - 3}" class="c-value">${esc(fmt(r.value))}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${H}" width="100%" role="img">${parts}</svg>`;
}

// ── Gráfica de columnas (décadas) ────────────────────────────────────────────
function columnChart(rows, { color, width = 820, height = 470 } = {}) {
  if (!rows.length) return `<div class="no-data">Sin fechas de lanzamiento todavía</div>`;
  const padB = 30, padT = 24, n = rows.length;
  const slot = width / n, bw = Math.min(70, slot * 0.6);
  const vmax = Math.max(...rows.map(r => r.value)) || 1;
  const parts = rows.map((r, i) => {
    const h = Math.max(3, (r.value / vmax) * (height - padB - padT));
    const x = i * slot + (slot - bw) / 2, y = height - padB - h;
    return `
      <path d="M${x},${height - padB} v-${h - 4} a4,4 0 0 1 4,-4 h${bw - 8} a4,4 0 0 1 4,4 v${h - 4} z" fill="${color}"/>
      <text x="${x + bw / 2}" y="${y - 7}" text-anchor="middle" class="c-value">${r.value}</text>
      <text x="${x + bw / 2}" y="${height - 10}" text-anchor="middle" class="c-label">${esc(r.label)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img">
    <line x1="0" x2="${width}" y1="${height - padB}" y2="${height - padB}" class="c-axis"/>${parts}</svg>`;
}

// ── Datos de las gráficas ────────────────────────────────────────────────────
function computeCharts(plataformas, juegos) {
  const by = (arr, keyFn, valFn = () => 1) => {
    const m = new Map();
    for (const x of arr) { const k = keyFn(x); if (!k) continue; m.set(k, (m.get(k) || 0) + valFn(x)); }
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es'));
  };
  const platName = Object.fromEntries(plataformas.map(p => [p.id, p.nombre]));
  const u = j => Number(j.unidades) || 1;
  const generos = by(juegos, j => j.genero, u);
  const unidadesPlat = by(juegos, j => platName[j.plataformaId], u);
  const caros = juegos.filter(j => Number(j.precio) > 0)
    .sort((a, b) => b.precio - a.precio)
    .map(j => ({ label: j.nombre, sub: platName[j.plataformaId] || '', value: Number(j.precio) }));
  const inversion = plataformas.map(p => ({
    label: p.nombre,
    value: (Number(p.precio) || 0) * (Number(p.unidades) || 1) + juegos.filter(j => j.plataformaId === p.id).reduce((s, j) => s + (Number(j.precio) || 0) * u(j), 0),
  })).filter(r => r.value > 0).sort((a, b) => b.value - a.value);
  const decadas = by(juegos.filter(j => /^\d{4}/.test(j.fechaLanzamiento || '')), j => `${String(j.fechaLanzamiento).slice(0, 3)}0s`, u)
    .sort((a, b) => a.label.localeCompare(b.label));
  const largos = juegos.filter(j => j.hltbMain > 0).sort((a, b) => b.hltbMain - a.hltbMain)
    .map(j => ({ label: j.nombre, sub: platName[j.plataformaId] || '', value: j.hltbMain }));
  const vendidos = juegos.filter(j => j.ventasTotal > 0).sort((a, b) => b.ventasTotal - a.ventasTotal)
    .map(j => ({ label: j.nombre, sub: platName[j.plataformaId] || '', value: j.ventasTotal }));
  return { generos, unidadesPlat, caros, inversion, decadas, largos, vendidos };
}

// ── Construcción del HTML ────────────────────────────────────────────────────
function buildCatalogHtml({ plataformas, juegos, imgFor = () => null, fecha = new Date() }) {
  const juegosDe = id => juegos.filter(j => j.plataformaId === id).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  const totalUnidades = juegos.reduce((s, j) => s + (Number(j.unidades) || 1), 0);
  const inversionTotal = juegos.reduce((s, j) => s + (Number(j.precio) || 0) * (Number(j.unidades) || 1), 0)
    + plataformas.reduce((s, p) => s + (Number(p.precio) || 0) * (Number(p.unidades) || 1), 0);
  const horasHistoria = juegos.reduce((s, j) => s + (Number(j.hltbMain) || 0), 0);
  const conNota = juegos.filter(j => j.valoracion);
  const notaMedia = conNota.length ? conNota.reduce((s, j) => s + Number(j.valoracion), 0) / conNota.length : null;
  const ch = computeCharts(plataformas, juegos);
  const fechaTxt = fecha.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

  const pages = [];   // cada elemento: HTML del contenido de una página

  // 1) Portada
  pages.push(`
    <div class="cover">
      <div class="cover-title"><span style="color:#f1f5f9">Game</span><span style="color:#e63946">Vault</span></div>
      <div class="cover-line"></div>
      <div class="cover-sub">Catálogo de mi colección · ${esc(fechaTxt)}</div>
      <div class="kpis">
        ${kpi(plataformas.length, 'Consolas')}${kpi(juegos.length, 'Juegos')}
        ${totalUnidades !== juegos.length ? kpi(totalUnidades, 'Unidades') : ''}
        ${kpi(eur(inversionTotal), 'Inversión')}
        ${horasHistoria > 0 ? kpi(Math.round(horasHistoria).toLocaleString('es-ES') + ' h', 'Historia (HLTB)') : ''}
        ${notaMedia ? kpi(notaMedia.toFixed(1).replace('.', ','), 'Nota media') : ''}
        ${juegos.some(j => j.prestadoA) ? kpi(juegos.filter(j => j.prestadoA).length, 'Prestados') : ''}
      </div>
    </div>`);

  // 2) Índice (paginado por filas)
  const tocRows = plataformas.map(p => {
    const img = imgFor(parseImgs(p.imagenes)[0]);
    const n = juegosDe(p.id).length;
    return `<a class="toc-row" href="#plat-${p.id}">
      ${img ? `<img class="toc-img" src="${img}">` : '<div class="toc-img toc-img-empty">🎮</div>'}
      <span class="toc-name">${esc(p.nombre)}</span><span class="toc-count">${n} juego${n !== 1 ? 's' : ''}</span></a>`;
  });
  const TOC_PER_PAGE = 20;
  const tocPages = Math.max(1, Math.ceil(tocRows.length / TOC_PER_PAGE));
  for (let i = 0; i < Math.max(1, tocRows.length); i += TOC_PER_PAGE) {
    pages.push(`<h2 class="page-h">Índice${parte(i / TOC_PER_PAGE + 1, tocPages)}</h2><p class="page-sub">${plataformas.length} consolas · ${juegos.length} juegos</p>${tocRows.slice(i, i + TOC_PER_PAGE).join('') || '<p class="no-data">Todavía no hay consolas.</p>'}`);
  }

  // 3) Consolas: bloques (cabecera + filas) empaquetados en páginas sin partirse
  const blocks = [];
  for (const p of plataformas) {
    const lista = juegosDe(p.id);
    const rows = [];
    for (let i = 0; i < lista.length; i += COLS) rows.push(lista.slice(i, i + COLS));
    const firstRows = Math.floor((USABLE_H - PLAT_HEAD_H) / ROW_H);
    const nextRows = Math.floor((USABLE_H - CONT_HEAD_H) / ROW_H);
    const chunks = [];
    let k = 0;
    do { const take = chunks.length ? nextRows : firstRows; chunks.push(rows.slice(k, k + take)); k += take; } while (k < rows.length);
    chunks.forEach((chunk, n) => {
      const first = n === 0, tag = parte(n + 1, chunks.length);
      const h = (first ? PLAT_HEAD_H : CONT_HEAD_H) + chunk.length * ROW_H + (lista.length ? 0 : 8);
      blocks.push({ h, html: (first ? platHeader(p, lista, imgFor, tag) : `<div class="cont">${esc(p.nombre)} <span>${tag.trim()}</span></div>`) +
        (lista.length ? chunk.map(r => `<div class="row">${r.map(j => card(j, imgFor)).join('')}</div>`).join('') : '<p class="no-data small">Sin juegos registrados</p>') });
    });
  }
  let cur = [], used = 0;
  for (const b of blocks) {
    if (cur.length && used + BLOCK_GAP + b.h > USABLE_H) { pages.push(cur.join('')); cur = []; used = 0; }
    cur.push(`<div class="block">${b.html}</div>`); used += (cur.length > 1 ? BLOCK_GAP : 0) + b.h;
  }
  if (cur.length) pages.push(cur.join(''));

  // 4) Gráficas al final (2 por página, cada una es un bloque indivisible)
  const charts = [
    { t: 'Géneros más jugados', s: 'Unidades por género', html: barChart(ch.generos, { color: '#a78bfa', max: 10 }) },
    { t: 'Unidades por plataforma', s: 'Juegos (contando duplicados) de cada consola', html: barChart(ch.unidadesPlat, { color: '#22d3ee', max: 12 }) },
    { t: 'Juegos más caros', s: 'Precio pagado', html: barChart(ch.caros, { color: '#facc15', fmt: eur2, max: 10, sub: true }) },
    { t: 'Inversión por plataforma', s: 'Consola + juegos', html: barChart(ch.inversion, { color: '#f472b6', fmt: eur, max: 12 }) },
    { t: 'Juegos por década', s: 'Según la fecha de lanzamiento', html: columnChart(ch.decadas, { color: '#4ade80' }) },
    ch.largos.length
      ? { t: 'Los más largos', s: 'Historia principal según HowLongToBeat', html: barChart(ch.largos, { color: '#22d3ee', fmt: hrs, max: 10, sub: true }) }
      : { t: 'Los más vendidos', s: 'Ventas mundiales (VGChartz)', html: barChart(ch.vendidos, { color: '#4ade80', fmt: units, max: 10, sub: true }) },
  ];
  const chartPages = Math.ceil(charts.length / 2);
  for (let i = 0; i < charts.length; i += 2) {
    pages.push(`<h2 class="page-h">Estadísticas${parte(i / 2 + 1, chartPages)}</h2>` +
      charts.slice(i, i + 2).map(c => `<section class="chart"><h3>${c.t}</h3><p>${c.s}</p>${c.html}</section>`).join(''));
  }


  const body = pages.map((html, i) => `<div class="pg">${html}<div class="footer"><span>GameVault · ${esc(fechaTxt)}</span><span>${i + 1} / ${pages.length}</span></div></div>`).join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${CSS}</style></head><body>${body}</body></html>`;
}

function kpi(v, l) { return `<div class="kpi"><div class="kpi-n">${esc(v)}</div><div class="kpi-l">${esc(l)}</div></div>`; }

// « (2 de 6)» cuando una sección ocupa varias páginas; nada si cabe en una
function parte(n, total) { return total > 1 ? ` (${n} de ${total})` : ''; }

function platHeader(p, lista, imgFor, tag = '') {
  const img = imgFor(parseImgs(p.imagenes)[0]);
  const uds = lista.reduce((s, j) => s + (Number(j.unidades) || 1), 0);
  return `<div class="plat" id="plat-${p.id}">
    ${img ? `<img class="plat-img" src="${img}">` : '<div class="plat-img plat-img-empty">🎮</div>'}
    <div class="plat-info">
      <h2>${esc(p.nombre)}${tag ? `<span class="parte">${tag.trim()}</span>` : ''}${p.unidades > 1 ? ` <span class="badge b-units">×${p.unidades}</span>` : ''}</h2>
      <p>${esc([p.marca, p.modelo, p.tipo].filter(Boolean).join(' · '))}</p>
      <p class="plat-meta">${lista.length} juego${lista.length !== 1 ? 's' : ''}${uds !== lista.length ? ` · ${uds} unidades` : ''}${p.precio ? ` · consola ${eur2(p.precio)}` : ''}</p>
    </div></div>`;
}

function card(j, imgFor) {
  const img = imgFor(parseImgs(j.imagenes)[0]);
  const c = EC[j.estado] || '#888';
  const anio = (j.fechaLanzamiento || '').slice(0, 4);
  return `<div class="card">
    ${img ? `<div class="card-img" style="background-image:url('${img}')"></div>` : '<div class="card-img card-img-empty">🎮</div>'}
    <div class="card-body">
      <p class="card-name">${esc(j.nombre)}</p>
      <p class="card-meta">${esc([j.genero, anio].filter(Boolean).join(' · ')) || '&nbsp;'}</p>
      <div class="badges">
        ${j.estado ? `<span class="badge" style="background:${c}22;color:${c};border-color:${c}44">${esc(j.estado)}</span>` : ''}
        ${j.valoracion ? `<span class="badge b-gold">★ ${j.valoracion}</span>` : ''}
        ${j.unidades > 1 ? `<span class="badge b-units">×${j.unidades}</span>` : ''}
        ${j.hltbMain > 0 ? `<span class="badge b-time">${hrs(j.hltbMain)}</span>` : ''}
        ${j.prestadoA ? `<span class="badge b-loan">📖 ${esc(j.prestadoA)}</span>` : ''}
      </div>
      ${j.precio ? `<p class="card-price">${eur2(j.precio)}</p>` : ''}
    </div></div>`;
}

const CSS = `
  @page { size: A4; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:#0f1117; }
  body { font-family: 'Segoe UI', -apple-system, Roboto, sans-serif; color:#e2e8f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pg { width:210mm; height:${PAGE_H}mm; padding:${PAD_Y}mm ${PAD_X}mm; position:relative; overflow:hidden;
        page-break-after:always; break-after:page; background:#0f1117; }
  .pg:last-child { page-break-after:auto; break-after:auto; }
  .footer { position:absolute; left:${PAD_X}mm; right:${PAD_X}mm; bottom:7mm; display:flex; justify-content:space-between;
            font-size:8pt; color:#475569; border-top:1px solid #1e2433; padding-top:2mm; }
  .page-h { font-size:20pt; font-weight:800; color:#a78bfa; margin-bottom:2mm; }
  .page-sub { font-size:9pt; color:#64748b; margin-bottom:5mm; }
  .no-data { color:#64748b; font-style:italic; font-size:10pt; padding:8mm 0; text-align:center; }
  .no-data.small { padding:2mm 0; text-align:left; font-size:9pt; }
  /* Portada */
  .cover { height:${USABLE_H}mm; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
  .cover-title { font-size:54pt; font-weight:900; letter-spacing:-1px; line-height:1; }
  .cover-line { width:60mm; height:1.6mm; border-radius:1mm; margin:5mm 0 4mm; background:linear-gradient(90deg,#e63946,#7c3aed,#06b6d4); }
  .cover-sub { font-size:14pt; color:#94a3b8; margin-bottom:14mm; }
  .kpis { display:flex; flex-wrap:wrap; justify-content:center; gap:5mm; max-width:170mm; }
  .kpi { background:#1a1f2e; border:1px solid #2d3748; border-radius:4mm; padding:5mm 7mm; min-width:42mm; }
  .kpi-n { font-size:22pt; font-weight:800; color:#f1f5f9; }
  .kpi-l { font-size:8pt; color:#64748b; text-transform:uppercase; letter-spacing:1px; margin-top:1mm; }
  /* Gráficas */
  .chart { background:#151a26; border:1px solid #232b3d; border-radius:4mm; padding:5mm 6mm; margin-top:4mm; height:${(USABLE_H - 14) / 2 - 4}mm; overflow:hidden; }
  .chart h3 { font-size:13pt; color:#f1f5f9; }
  .chart p { font-size:8.5pt; color:#64748b; margin:1mm 0 3mm; }
  .c-label { font-size:16px; fill:#cbd5e1; }
  .c-sub { font-size:12.5px; fill:#64748b; }
  .c-value { font-size:15px; fill:#f1f5f9; font-weight:700; }
  .c-track { fill:#1e2638; }
  .c-axis { stroke:#2d3748; stroke-width:1; }
  /* Índice */
  .toc-row { display:flex; align-items:center; gap:4mm; height:10.5mm; padding:0 3mm; margin-bottom:1.5mm; border:1px solid #232b3d;
             border-radius:2.5mm; background:#151a26; text-decoration:none; color:inherit; }
  .toc-img { width:12mm; height:8mm; object-fit:contain; background:#252d3d; border-radius:1.5mm; flex-shrink:0; }
  .toc-img-empty { display:flex; align-items:center; justify-content:center; background:#252d3d; font-size:10pt; }
  .toc-name { flex:1; font-size:10.5pt; font-weight:600; }
  .toc-count { font-size:9pt; color:#64748b; }
  /* Consolas */
  .block + .block { margin-top:${BLOCK_GAP}mm; }
  .plat { height:${PLAT_HEAD_H - 4}mm; margin-bottom:4mm; display:flex; align-items:center; gap:5mm; background:#1a1f2e;
          border:1px solid #2d3748; border-radius:3mm; padding:3mm 4mm; }
  .plat-img { width:30mm; height:19mm; object-fit:contain; background:#252d3d; padding:1mm; box-sizing:border-box; border-radius:2mm; flex-shrink:0; }
  .plat-img-empty { display:flex; align-items:center; justify-content:center; background:#252d3d; font-size:16pt; }
  .plat h2 { font-size:15pt; font-weight:800; color:#f1f5f9; }
  .plat p { font-size:8.5pt; color:#94a3b8; margin-top:0.6mm; }
  .plat .plat-meta { color:#64748b; }
  .cont { height:${CONT_HEAD_H - 3}mm; margin-bottom:3mm; font-size:11pt; font-weight:700; color:#cbd5e1;
          border-bottom:1px solid #232b3d; display:flex; align-items:center; }
  .plat h2 .parte { color:#64748b; font-weight:400; margin-left:2mm; font-size:9pt; }
  .cont span { color:#64748b; font-weight:400; margin-left:2mm; font-size:9pt; }
  .row { display:grid; grid-template-columns:repeat(${COLS}, 1fr); gap:${GAP}mm; height:${CARD_H}mm; margin-bottom:${GAP}mm; }
  .card { height:${CARD_H}mm; background:#1a1f2e; border:1px solid #2d3748; border-radius:2.5mm; overflow:hidden; display:flex; flex-direction:column; }
  .card-img { height:30mm; flex-shrink:0; background-size:cover; background-position:center top; background-color:#252d3d; }
  .card-img-empty { display:flex; align-items:center; justify-content:center; font-size:20pt; color:#334155; }
  .card-body { padding:2mm 2.5mm; flex:1; overflow:hidden; display:flex; flex-direction:column; }
  .card-name { font-size:8.6pt; font-weight:700; color:#f1f5f9; line-height:1.2; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .card-meta { font-size:7pt; color:#64748b; margin-top:0.8mm; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .badges { display:flex; flex-wrap:wrap; gap:1mm; margin-top:1.2mm; max-height:9mm; overflow:hidden; }
  .badge { font-size:6.5pt; padding:0.3mm 1.4mm; border-radius:1mm; font-weight:700; border:1px solid transparent; white-space:nowrap; }
  .b-gold { background:#facc1522; color:#facc15; border-color:#facc1544; }
  .b-units { background:#22d3ee22; color:#22d3ee; border-color:#22d3ee44; }
  .b-time { background:#a78bfa22; color:#c4b5fd; border-color:#a78bfa44; }
  .b-loan { background:#f9731622; color:#fb923c; border-color:#f9731633; }
  .card-price { margin-top:auto; font-size:8pt; color:#facc15; font-weight:700; }
`;

module.exports = { buildCatalogHtml, computeCharts, barChart, USABLE_H };
