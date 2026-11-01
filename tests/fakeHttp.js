// Servidor HTTP simulado para las pruebas E2E: HLTB y VGChartz con respuestas reales grabadas
const fs = require('fs');
const path = require('path');
const FIX = f => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
const H = (id, name, m, p, c, y) => ({ game_id: id, game_name: name, game_alias: '', comp_main: m, comp_plus: p, comp_100: c, release_world: y });
const HLTB = {
  'grand theft auto san andreas': [H(4073, 'Grand Theft Auto: San Andreas', 108349, 159341, 249044, 2004)],
  'mario kart 8 deluxe': [H(57, 'Mario Kart 8 Deluxe', 43200, 72000, 180000, 2017)],
  'super mario 64': [H(9, 'Super Mario 64', 43000, 54000, 72000, 1996)],
  'the simpsons game': [H(77, 'The Simpsons Game', 27758, 43251, 62925, 2007)],
};
// es.wikipedia: búsqueda + enlace al artículo en inglés (respuestas reales)
const WIKI = { 'simpsons': ['Los Simpson: el videojuego', 'The Simpsons Game'] };
module.exports = async function fakeHttp(url, opts = {}) {
  await new Promise(r => setTimeout(r, 30));
  const u = new URL(url);
  if (u.hostname === 'howlongtobeat.com') {
    if (u.pathname === '/') return { status: 200, text: '<script src="/_next/static/chunks/x.js"></script>' };
    if (u.pathname.endsWith('.js')) return { status: 200, text: 'fetch(`/api/search/site/init?t=${Date.now()}`)' };
    if (u.pathname === '/api/search/site/init') return { status: 200, text: '{"token":"abc"}' };
    if (u.pathname === '/api/search/site') {
      const q = JSON.parse(opts.body).searchTerms.join(' ').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
      return { status: 200, text: JSON.stringify({ data: HLTB[q] || [] }) };
    }
  }
  if (u.hostname === 'www.vgchartz.com') {
    if (u.pathname === '/games/games.php') {
      const n = u.searchParams.get('name').toLowerCase();
      if (n.includes('san andreas')) return { status: 200, text: FIX('vgc_s1.html') };
      if (n.includes('mario 64')) return { status: 200, text: FIX('vgc_s2.html') };
      if (n.includes('simpsons game')) return { status: 200, text: '<table><tr><td>1</td><td></td><td><a href="https://www.vgchartz.com/game/2/the-simpsons-game/?region=All">The Simpsons Game</a></td><td><img src="/images/consoles/All_b.png" alt="All"></td><td>4.00m</td><td>N/A</td><td>30th Oct 07</td></tr></table>' };
      if (n.includes('mario kart 8')) return { status: 200, text: '<table><tr><td>1</td><td></td><td><a href="https://www.vgchartz.com/game/153114/mario-kart-8-deluxe/?region=All">Mario Kart 8 Deluxe</a></td><td><img src="/images/consoles/NS_b.png" alt="NS"></td><td>71.53m</td><td>N/A</td><td>28th Apr 17</td></tr></table>' };
      return { status: 200, text: '<table></table>' };
    }
    if (u.pathname === '/game/227491/grand-theft-auto-san-andreas/sales') return { status: 200, text: FIX('vgc_p1.html') };
    if (u.pathname === '/game/153114/mario-kart-8-deluxe/sales') return { status: 200, text: FIX('vgc_p2.html') };
    return { status: 200, text: '<h1>Latest Sales Updates</h1><table></table>' };
  }
  if (u.hostname === 'es.wikipedia.org') {
    if (u.searchParams.get('list') === 'search') {
      const q = u.searchParams.get('srsearch').toLowerCase();
      const k = Object.keys(WIKI).find(k => q.includes(k));
      return { status: 200, text: JSON.stringify({ query: { search: k ? [{ title: WIKI[k][0], snippet: 'videojuego' }] : [] } }) };
    }
    const t = u.searchParams.get('titles');
    const k = Object.keys(WIKI).find(k => WIKI[k][0] === t);
    return { status: 200, text: JSON.stringify({ query: { pages: { 1: { title: t, langlinks: k ? [{ '*': WIKI[k][1] }] : [] } } } }) };
  }
  if (u.hostname === 'api.rawg.io') return { status: 200, text: '{"results":[]}' };
  return { status: 404, text: '' };
};
