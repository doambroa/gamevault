// Prueba del proxy.php real (PHP + curl) contra un "upstream" local que imita a HLTB
const http = require('http'); const { spawn } = require('child_process');
const seen = [];
const up = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
  seen.push({ m: req.method, url: req.url, h: req.headers, b });
  if (req.url.startsWith('/api/search/site/init')) { res.end('{"token":"abc"}'); return; }
  if (req.url === '/api/search/site') { res.writeHead(req.headers['x-auth-token'] === 'abc' ? 200 : 403); res.end(JSON.stringify({ data: [{ game_name: 'Ñandú: Edición ñ', comp_main: 3600 }] })); return; }
  res.writeHead(404); res.end('no'); }); }).listen(5099);
const php = spawn('php', ['-S', '127.0.0.1:5098', '-t', require('path').join(__dirname, '../../dist/web')], { env: { ...process.env, GV_PROXY_TEST_HOST: '127.0.0.1' } });
const call = (body) => fetch('http://127.0.0.1:5098/proxy.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ code: r.status, j: await r.json() }));
const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) process.exitCode = 1; };
setTimeout(async () => {
  try {
    const ping = await fetch('http://127.0.0.1:5098/proxy.php?ping=1').then(r => r.json());
    ok(ping.gamevault && ping.curl, 'ping: el proxy responde y tiene curl');
    const a = await call({ url: 'http://127.0.0.1:5099/api/search/site/init?t=1', method: 'GET', headers: { 'User-Agent': 'X' } });
    ok(a.j.status === 200 && JSON.parse(a.j.text).token === 'abc', 'GET reenviado (init de HLTB)');
    const b = await call({ url: 'http://127.0.0.1:5099/api/search/site', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': 'abc', 'Cookie': 'no', 'Host': 'evil' }, body: '{"searchTerms":["gta"]}' });
    ok(b.j.status === 200 && JSON.parse(b.j.text).data[0].game_name === 'Ñandú: Edición ñ', 'POST con cuerpo, cabecera x-auth-token y UTF-8');
    const last = seen[seen.length - 1];
    ok(last.b === '{"searchTerms":["gta"]}' && !last.h.cookie && last.h.host !== 'evil', 'reenvía el cuerpo y descarta cabeceras no permitidas (Cookie, Host)');
    const c = await call({ url: 'https://evil.example.com/x', method: 'GET' });
    ok(c.code === 403, 'dominio no permitido → 403');
    const d = await call({ url: 'http://howlongtobeat.com/', method: 'GET' });
    ok(d.code === 403, 'http sin cifrar → rechazado');
    const e = await call({ url: 'http://127.0.0.1:5099/x', method: 'DELETE' });
    ok(e.code === 400, 'método no permitido → 400');
    const g = await fetch('http://127.0.0.1:5098/proxy.php').then(r => r.status);
    ok(g === 405, 'GET sin ping → 405');
  } finally { php.kill(); up.close(); }
}, 800);
