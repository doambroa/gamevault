/* eslint-disable */
// ─── HowLongToBeat ────────────────────────────────────────────────────────────
// HLTB no tiene API oficial. Su web usa (comprobado en vivo el 18-10-2026):
//   1) GET  /api/search/site/init?t=<ms>   → { token, [hpKey, hpVal] }
//   2) POST /api/search/site               → { data:[{game_name, comp_main, comp_plus, comp_100,…}] }
//      cabecera "x-auth-token: <token>" (+ x-hp-key / x-hp-val y body[hpKey]=hpVal si vienen)
// HLTB renombra el endpoint cada pocas semanas (/api/find → /api/bleed → /api/search/site…),
// así que lo redescubrimos leyendo los bundles JS de la portada cuando falla.
//
// `http(url, {method, headers, body})` → Promise<{ status, text }>  (lo inyecta cada plataforma)

const { similarity, searchVariants, normalize } = require('./text');

const BASE = 'https://howlongtobeat.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const KNOWN_ENDPOINTS = ['search/site', 'bleed', 'find', 's', 'search'];
const MIN_SCORE = 0.55;

function createHltb(http, log = () => {}) {
  let endpoint = null;       // p.ej. "search/site"
  let auth = null;           // { token, hpKey, hpVal }
  let discoveredAt = 0;

  const baseHeaders = () => ({ 'User-Agent': UA, 'Origin': BASE, 'Referer': BASE + '/', 'Accept': '*/*' });

  async function discoverEndpoint() {
    try {
      const home = await http(BASE + '/', { method: 'GET', headers: baseHeaders() });
      if (home.status !== 200) return null;
      const scripts = [...home.text.matchAll(/<script[^>]+src="([^"]*\/_next\/static\/chunks\/[^"]+\.js)"/g)].map(m => m[1]);
      for (const src of scripts) {
        const js = await http(src.startsWith('http') ? src : BASE + src, { method: 'GET', headers: baseHeaders() });
        if (js.status !== 200) continue;
        // La plantilla del init es inconfundible: `/api/<x>/init?t=${Date.now()}`
        const m = js.text.match(/\/api\/([a-zA-Z0-9_\/]+?)\/init\?t=/);
        if (m) { log('[HLTB] endpoint descubierto:', m[1]); return m[1]; }
      }
    } catch (e) { log('[HLTB] error descubriendo endpoint:', e.message); }
    return null;
  }

  async function fetchAuth(ep) {
    const r = await http(`${BASE}/api/${ep}/init?t=${Date.now()}`, { method: 'GET', headers: baseHeaders() });
    if (r.status !== 200) return null;
    let j; try { j = JSON.parse(r.text); } catch { return null; }
    if (!j || !j.token) return null;
    const a = { token: j.token, hpKey: null, hpVal: null };
    for (const [k, v] of Object.entries(j)) {
      if (k === 'token') continue;
      if (/key/i.test(k)) a.hpKey = v; else if (/val/i.test(k)) a.hpVal = v;
    }
    return a;
  }

  /** Garantiza endpoint + token. force=true redescubre todo. */
  async function ensure(force = false) {
    if (!force && endpoint && auth) return true;
    auth = null;
    const candidates = [];
    if (endpoint && !force) candidates.push(endpoint);
    if (force || !endpoint || Date.now() - discoveredAt > 6 * 3600e3) {
      const d = await discoverEndpoint();
      discoveredAt = Date.now();
      if (d) candidates.push(d);
    }
    for (const k of KNOWN_ENDPOINTS) if (!candidates.includes(k)) candidates.push(k);
    for (const ep of candidates) {
      try {
        const a = await fetchAuth(ep);
        if (a) { endpoint = ep; auth = a; log('[HLTB] token OK en /api/' + ep); return true; }
      } catch (e) { log('[HLTB] init falló en', ep, e.message); }
    }
    return false;
  }

  async function rawSearch(term) {
    const body = {
      searchType: 'games',
      searchTerms: term.trim().split(/\s+/),
      searchPage: 1,
      size: 20,
      searchOptions: {
        games: {
          userId: 0, platform: '', sortCategory: 'popular', rangeCategory: 'main',
          rangeTime: { min: 0, max: 0 },
          gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
          rangeYear: { max: '', min: '' },
          modifier: 'hide_dlc',
        },
        users: { sortCategory: 'postcount' },
        lists: { sortCategory: 'follows' },
        filter: '', sort: 0, randomizer: 0,
      },
      useCache: true,
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!(await ensure(attempt === 2))) throw new Error('No se pudo conectar con HowLongToBeat');
      const headers = { ...baseHeaders(), 'Content-Type': 'application/json', 'x-auth-token': auth.token };
      const b = { ...body };
      if (auth.hpKey) { headers['x-hp-key'] = String(auth.hpKey); headers['x-hp-val'] = String(auth.hpVal); b[auth.hpKey] = auth.hpVal; }
      const r = await http(`${BASE}/api/${endpoint}`, { method: 'POST', headers, body: JSON.stringify(b) });
      if (r.status === 200) {
        let j; try { j = JSON.parse(r.text); } catch { j = null; }
        if (j && Array.isArray(j.data)) return j.data;
        auth = null; continue;           // HTML de error → renovar
      }
      if (r.status === 429) throw new Error('HowLongToBeat limita las búsquedas: espera un minuto');
      log('[HLTB] búsqueda devolvió', r.status, '— renovando token');
      auth = null;                       // 403 = token caducado, 404 = endpoint renombrado
      if (r.status === 404 && attempt === 1) endpoint = null;
    }
    throw new Error('HowLongToBeat rechazó la búsqueda');
  }

  const toHours = s => (s > 0 ? Math.round((s / 3600) * 10) / 10 : null);

  function pickBest(query, list, year) {
    let best = null;
    for (const g of list) {
      let score = similarity(query, g.game_name, g.game_alias);
      if (year && g.release_world && Number(g.release_world) === Number(year)) score += 0.05;
      if (!(g.comp_main > 0 || g.comp_plus > 0 || g.comp_100 > 0)) score -= 0.1;
      if (!best || score > best.score) best = { g, score };
    }
    return best;
  }

  /**
   * Busca un juego y devuelve { hltbMain, hltbExtra, hltbComplete, hltbId, hltbName, score }
   * o null si no hay coincidencia razonable.
   * altNames: nombres alternativos (p.ej. el título inglés de RAWG) para reintentar.
   */
  async function lookup(name, { year, altNames = [] } = {}) {
    const tried = new Set();
    const queries = [];
    for (const n of [name, ...altNames]) for (const v of searchVariants(n)) {
      const k = normalize(v);
      if (!tried.has(k)) { tried.add(k); queries.push(v); }
    }
    let best = null;
    for (const q of queries.slice(0, 6)) {
      const list = await rawSearch(q);
      log(`[HLTB] "${q}" → ${list.length} resultados`);
      if (!list.length) continue;
      // Puntuar contra el nombre original y los alternativos
      for (const ref of [name, ...altNames]) {
        const b = pickBest(ref, list, year);
        if (b && (!best || b.score > best.score)) best = b;
      }
      if (best && best.score >= 0.9) break;
    }
    if (!best || best.score < MIN_SCORE) return null;
    const g = best.g;
    return {
      hltbMain: toHours(g.comp_main), hltbExtra: toHours(g.comp_plus), hltbComplete: toHours(g.comp_100),
      hltbId: g.game_id, hltbName: g.game_name, score: Math.round(best.score * 100) / 100,
    };
  }

  return { lookup, _rawSearch: rawSearch, _ensure: ensure, _state: () => ({ endpoint, auth }) };
}

module.exports = { createHltb, HLTB_BASE: BASE, HLTB_UA: UA };
