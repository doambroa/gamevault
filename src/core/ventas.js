/* eslint-disable */
// ─── Ventas globales (VGChartz) ───────────────────────────────────────────────
// RAWG NO ofrece cifras de ventas. VGChartz es la base de datos pública más completa:
//   · /games/games.php?name=…  → tabla con "Total Shipped" / "Total Sales" por consola
//     (y una fila "All" con el total combinado cuando existe)
//   · /game/<id>/<slug>/sales  → "Latest Sales Updates": cifras acumuladas con fecha,
//     que usamos como serie temporal para la gráfica.
// `http(url, {method, headers})` → Promise<{ status, text }>

const { similarity, searchVariants, parseVgcDate, parseUnits, stripTags, normalize } = require('./text');

const BASE = 'https://www.vgchartz.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MIN_SCORE = 0.6;

function searchUrl(name) {
  const p = new URLSearchParams({
    name, results: '50', order: 'Sales', ownership: 'Both',
    showtotalsales: '1', shownasales: '0', showpalsales: '0', showjapansales: '0', showothersales: '0',
    showshipped: '1', showreleasedate: '1', showpublisher: '0', showdeveloper: '0', showlastupdate: '0',
    showvgchartzscore: '0', showcriticscore: '0', showuserscore: '0',
  });
  return `${BASE}/games/games.php?${p.toString()}`;
}

/** Extrae las filas de resultados de la página de búsqueda */
function parseSearch(html) {
  const rows = [];
  const re = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = re.exec(html))) {
    const tr = m[1];
    const link = tr.match(/href="(?:https?:\/\/www\.vgchartz\.com)?\/game\/(\d+)\/([^/"]+)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    const consoleImg = tr.match(/\/images\/consoles\/[^"]*"\s+alt="([^"]*)"/);
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(t => stripTags(t[1]));
    // Las 3 últimas celdas: shipped, sales, fecha
    const n = tds.length;
    if (n < 4) continue;
    rows.push({
      id: Number(link[1]), slug: link[2], name: stripTags(link[3]),
      consola: consoleImg ? consoleImg[1] : '',
      shipped: parseUnits(tds[n - 3]), sales: parseUnits(tds[n - 2]),
      release: parseVgcDate(tds[n - 1]),
    });
  }
  return rows;
}

/** Extrae el historial "Latest Sales Updates" de la página /sales */
function parseSalesPage(html) {
  const out = [];
  const i = html.indexOf('Latest Sales Updates');
  if (i >= 0) {
    const end = html.indexOf('</table>', i);
    const block = html.slice(i, end > 0 ? end : i + 20000);
    for (const tr of block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(t => stripTags(t[1]));
      if (tds.length < 3) continue;
      const value = parseUnits(tds[0]);
      const date = parseVgcDate(tds[tds.length - 1]);
      if (value && date) out.push({ date, value });
    }
  }
  let shippingTotal = null;
  const st = html.match(/Shipping Total<\/h1>[\s\S]*?([\d,]{4,})\s*Units/);
  if (st) shippingTotal = parseUnits(st[1]);
  out.sort((a, b) => a.date.localeCompare(b.date));
  return { updates: out, shippingTotal };
}

/** Combina historiales de varias consolas: en cada fecha suma el último valor conocido de cada una */
function mergeHistories(histories) {
  const dates = [...new Set(histories.flatMap(h => h.map(p => p.date)))].sort();
  return dates.map(date => ({
    date,
    value: histories.reduce((sum, h) => {
      let last = 0;
      for (const p of h) if (p.date <= date) last = p.value;
      return sum + last;
    }, 0),
  }));
}

function createVentas(http, log = () => {}) {
  const get = async url => {
    const r = await http(url, { method: 'GET', headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*', 'Accept-Language': 'en-US,en;q=0.9' } });
    if (r.status !== 200) throw new Error(`VGChartz respondió ${r.status}`);
    return r.text;
  };

  /**
   * Devuelve { total, history:[{date,value}], porConsola:[{consola,total}], nombre, url, fuente }
   * o null si no se encuentra.
   */
  async function lookup(name, { altNames = [] } = {}) {
    let rows = [], usedQuery = null, bestScore = 0, bestName = null;
    const refs = [name, ...altNames];
    for (const q of [...new Set([name, ...altNames].flatMap(searchVariants))].slice(0, 5)) {
      const found = parseSearch(await get(searchUrl(q)));
      log(`[Ventas] "${q}" → ${found.length} filas`);
      if (!found.length) continue;
      for (const r of found) {
        const s = Math.max(...refs.map(ref => similarity(ref, r.name)));
        if (s > bestScore) { bestScore = s; bestName = r.name; }
      }
      rows = found; usedQuery = q;
      if (bestScore >= 0.9) break;
    }
    if (!rows.length || bestScore < MIN_SCORE) return null;

    const same = rows.filter(r => normalize(r.name) === normalize(bestName));
    const units = r => Math.max(r.shipped || 0, r.sales || 0);
    const all = same.find(r => r.consola === 'All');
    const platforms = same.filter(r => r.consola !== 'All' && units(r) > 0);
    let total = all ? units(all) : platforms.reduce((s, r) => s + units(r), 0);

    // Historial temporal
    let history = [];
    try {
      if (all) {
        const p = parseSalesPage(await get(`${BASE}/game/${all.id}/${all.slug}/sales`));
        history = p.updates;
        if (!total && p.shippingTotal) total = p.shippingTotal;
      } else {
        const top = platforms.sort((a, b) => units(b) - units(a)).slice(0, 4);
        const hs = [];
        for (const r of top) {
          const p = parseSalesPage(await get(`${BASE}/game/${r.id}/${r.slug}/sales`));
          if (p.updates.length) hs.push(p.updates);
        }
        history = hs.length > 1 ? mergeHistories(hs) : (hs[0] || []);
      }
    } catch (e) { log('[Ventas] historial no disponible:', e.message); }

    if (!total && history.length) total = history[history.length - 1].value;
    if (!total) return null;

    const ref = all || platforms[0] || same[0];
    return {
      total,
      history,
      porConsola: platforms.map(r => ({ consola: r.consola, total: units(r) })),
      nombre: bestName,
      url: ref ? `${BASE}/game/${ref.id}/${ref.slug}/` : null,
      fuente: 'VGChartz',
      query: usedQuery,
    };
  }

  return { lookup };
}

module.exports = { createVentas, parseSearch, parseSalesPage, mergeHistories, searchUrl };
