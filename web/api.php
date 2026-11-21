<?php
// GameVault — cuentas, sincronización y comunidad. Pensado para XAMPP (PHP 7.4+), sin base de datos:
// todo se guarda en ficheros JSON dentro de data/ (bloqueada desde el navegador).
//
// Cuentas:   ping, me, register, login, logout, password, profile
// Colección: collection (la mía), save (subir), upload (fotos propias)
// Comunidad: users, view (colección de otra persona, solo lectura), loans (zona de préstamos)
// Créditos Finales: creditos (juegos terminados de un usuario, si la app está instalada al lado)
// Retos Switcherino: retos, reto_aporte, reto_guardar, reto_borrar, reto_alias, porra_guardar, porra_voto, porra_ganador
// Perfiles por reclamar: colecciones cargadas de antemano (p. ej. de una hoja de cálculo) para gente
//   que aún no tiene cuenta. Su id empieza por «~». Quien tenga el enlace (o el usuario sugerido)
//   la reclama y pasa a su colección: claim. La lista con los enlaces la ven los administradores: pending.
//
// Si junto a esta carpeta existe «creditos» (la app Créditos Finales), las cuentas son LAS MISMAS:
// se usa su users.json y su sesión, así que quien entra en una está dentro de la otra.
// Las apps de Windows y Android no usan cookies: reciben un token y lo mandan en X-GV-Token.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-GV-Token, X-GV');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }

$cfg = file_exists(__DIR__ . '/config.php') ? (require __DIR__ . '/config.php') : [];
if (!is_array($cfg)) $cfg = [];
$DIR     = __DIR__ . '/data';
$UPLOADS = __DIR__ . '/uploads';

// ── Créditos Finales al lado → cuentas compartidas ─────────────────────────────
$CRED = rtrim((string)($cfg['creditos_dir'] ?? (__DIR__ . '/../creditos')), '/\\');
$SHARED = empty($cfg['cuentas_propias']) && is_file("$CRED/api.php") && is_dir("$CRED/data");
$credCfg = [];
if ($SHARED && is_file("$CRED/config.php")) { $c = @include "$CRED/config.php"; if (is_array($c)) $credCfg = $c; }
$USERS   = $SHARED ? "$CRED/data/users.json" : "$DIR/users.json";
$INVITE  = (string)($cfg['invite_code'] ?? ($credCfg['invite_code'] ?? ''));
$SESSION = $SHARED ? ($credCfg['session_name'] ?? 'creditos') : ($cfg['session_name'] ?? 'gamevault');
$SESSION = preg_replace('/[^A-Za-z0-9_]/', '', (string)$SESSION) ?: 'gamevault';

$action = $_GET['action'] ?? '';
$TOKEN  = (string)($_SERVER['HTTP_X_GV_TOKEN'] ?? '');
$IS_POST = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';

function out($d, $code = 200) {
  http_response_code($code);
  echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
  exit;
}
function body() { $j = json_decode((string)file_get_contents('php://input'), true); return is_array($j) ? $j : []; }
function readJson($f, $def) { if (!is_file($f)) return $def; $j = json_decode((string)@file_get_contents($f), true); return is_array($j) ? $j : $def; }
function writeJson($f, $d, $pretty = true) {
  $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | ($pretty ? JSON_PRETTY_PRINT : 0);
  $s = json_encode($d, $flags);
  if ($s === false) return false;
  // escribir en un temporal y renombrar: un corte de luz no deja el fichero a medias
  $tmp = $f . '.tmp' . mt_rand();
  if (file_put_contents($tmp, $s, LOCK_EX) === false) return false;
  if (!@rename($tmp, $f)) { $ok = file_put_contents($f, $s, LOCK_EX) !== false; @unlink($tmp); return $ok; }
  return true;
}
function ensureDirs() {
  global $DIR, $UPLOADS;
  foreach ([$DIR, $UPLOADS] as $d) if (!is_dir($d)) @mkdir($d, 0775, true);
  if (!is_file("$DIR/.htaccess")) @file_put_contents("$DIR/.htaccess", "Require all denied\nDeny from all\n");
  if (!is_file("$DIR/index.html")) @file_put_contents("$DIR/index.html", '');
  // en uploads/ solo se sirven imágenes: nada de PHP ni listados
  if (!is_file("$UPLOADS/.htaccess")) @file_put_contents("$UPLOADS/.htaccess",
    "Options -Indexes\n<IfModule mod_php.c>\n  php_flag engine off\n</IfModule>\n<IfModule mod_php7.c>\n  php_flag engine off\n</IfModule>\n" .
    "<FilesMatch \"\\.(php|phtml|phar|pl|py|cgi|html?|js)$\">\n  Require all denied\n</FilesMatch>\n" .
    "<IfModule mod_headers.c>\n  Header set Cache-Control \"public, max-age=31536000, immutable\"\n  Header set X-Content-Type-Options \"nosniff\"\n</IfModule>\n");
  if (!is_file("$UPLOADS/index.html")) @file_put_contents("$UPLOADS/index.html", '');
}
function users() { global $USERS; return readJson($USERS, []); }
function saveUsers($u) { global $USERS; ensureDirs(); return writeJson($USERS, $u); }
function validName($u) { return (bool)preg_match('/^[a-z0-9_-]{3,20}$/', (string)$u); }
function collFile($u) { global $DIR; return "$DIR/c_$u.json"; }
function profiles() { global $DIR; return readJson("$DIR/profiles.json", []); }
function tokens() { global $DIR; return readJson("$DIR/tokens.json", []); }
// Peticiones de préstamo (data/requests.json); se guardan con bloqueo para que dos a la vez no se pisen
function reqs() { global $DIR; return readJson("$DIR/requests.json", []); }
function reqTx(callable $fn) {
  global $DIR; ensureDirs(); $f = "$DIR/requests.json";
  $h = fopen($f, 'c+'); if (!$h) out(['error' => 'No se pudo escribir en data/'], 500);
  flock($h, LOCK_EX);
  $l = json_decode(stream_get_contents($h) ?: '[]', true); if (!is_array($l)) $l = [];
  $fn($l);
  $l = array_values(array_filter($l, function ($r) { return $r['estado'] === 'pendiente' || ($r['answered'] ?? '') >= date('c', time() - 90 * 86400); }));
  ftruncate($h, 0); rewind($h); fwrite($h, json_encode($l, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
  fflush($h); flock($h, LOCK_UN); fclose($h);
}
// Fichero JSON con bloqueo (lectura-modificación-escritura sin pisarse)
function jsonTx($f, callable $fn) {
  ensureDirs();
  $h = fopen($f, 'c+'); if (!$h) out(['error' => 'No se pudo escribir en data/'], 500);
  flock($h, LOCK_EX);
  $d = json_decode(stream_get_contents($h) ?: '{}', true); if (!is_array($d)) $d = [];
  $r = $fn($d);
  ftruncate($h, 0); rewind($h); fwrite($h, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
  fflush($h); flock($h, LOCK_UN); fclose($h);
  return $r;
}
// Avisos para una persona (petición recibida, respuesta, recordatorio…). Se guardan los 60 últimos.
function notify($to, $tipo, $de, $texto, $extra = []) {
  global $DIR;
  if (!$to || $to === $de) return;
  jsonTx("$DIR/notifs.json", function (&$d) use ($to, $tipo, $de, $texto, $extra) {
    $l = $d[$to] ?? [];
    $l[] = ['id' => bin2hex(random_bytes(5)), 'tipo' => $tipo, 'de' => $de, 'texto' => $texto, 'fecha' => date('c'), 'leida' => false] + $extra;
    $d[$to] = array_slice($l, -60);
  });
}
// Copia de seguridad semanal de todas las colecciones (data/backups), se hace sola con el primer acceso
// de la semana. Un único fichero comprimido por copia; se guardan las 8 últimas.
function backupDir() { global $DIR; return "$DIR/backups"; }
function makeBackup($motivo = 'semanal') {
  global $DIR;
  $bd = backupDir(); if (!is_dir($bd)) @mkdir($bd, 0775, true);
  $pack = ['gamevault' => 'copia', 'fecha' => date('c'), 'motivo' => $motivo, 'ficheros' => []];
  foreach (glob("$DIR/*.json") ?: [] as $f) {
    $n = basename($f);
    if ($n === 'tokens.json') continue;                     // las sesiones de los aparatos no se copian
    $pack['ficheros'][$n] = json_decode(file_get_contents($f), true);
  }
  $json = json_encode($pack, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  $gz = function_exists('gzencode');
  $name = 'gamevault-' . date('Y-m-d-His') . ($gz ? '.json.gz' : '.json');
  if (@file_put_contents("$bd/$name", $gz ? gzencode($json, 6) : $json) === false) return null;
  @file_put_contents("$bd/ultima.txt", (string)time());
  $all = listBackups();
  foreach (array_slice($all, 8) as $old) @unlink("$bd/" . $old['nombre']);
  return $name;
}
function listBackups() {
  $res = [];
  foreach (glob(backupDir() . '/gamevault-*.json*') ?: [] as $f) $res[] = ['nombre' => basename($f), 'fecha' => date('c', filemtime($f)), 'bytes' => filesize($f)];
  usort($res, function ($a, $b) { return strcmp($b['nombre'], $a['nombre']); });
  return $res;
}
function weeklyBackup() {
  $u = backupDir() . '/ultima.txt';
  $t = is_file($u) ? (int)@file_get_contents($u) : 0;
  if (time() - $t < 7 * 86400) return;
  @file_put_contents($u, (string)time());                   // primero la marca: así dos peticiones a la vez no copian dos veces
  makeBackup('semanal');
}
function pendings() { global $DIR; return readJson("$DIR/pending.json", []); }
function isPendingId($u) { return is_string($u) && preg_match('/^~[a-z0-9-]{2,40}$/', $u) && isset(pendings()[$u]); }
function isAdmin($u) { global $cfg; return $u && in_array($u, (array)($cfg['admins'] ?? ['soiber']), true); }

// ── Retos Switcherino: playlist de estación (un tema por día) y porra de los Game Awards ──────────
// Todo en data/retos.json: { playlists: {id: …}, porras: {id: …}, alias: {apodo: usuario} }
// Quién aporta/vota se guarda con una clave: el usuario, un perfil por reclamar (~id) o un apodo (@apodo)
// para la gente sin cuenta que el administrador añade a mano (como en los documentos de antes).
function retosFile() { global $DIR; return "$DIR/retos.json"; }
function retosData() { $d = readJson(retosFile(), []); return $d + ['playlists' => [], 'porras' => [], 'alias' => []]; }
function retosTx(callable $fn) {
  return jsonTx(retosFile(), function (&$d) use ($fn) {
    foreach (['playlists', 'porras', 'alias'] as $k) if (!isset($d[$k]) || !is_array($d[$k])) $d[$k] = [];
    return $fn($d);
  });
}
function hoyMadrid() { return new DateTime('now', new DateTimeZone('Europe/Madrid')); }
// Día del reto que toca hoy (1…n), 0 si aún no empezó, n+1 si ya terminó
function diaReto($pl) {
  if (empty($pl['inicio'])) return 0;
  $ini = DateTime::createFromFormat('!Y-m-d', $pl['inicio'], new DateTimeZone('Europe/Madrid'));
  if (!$ini) return 0;
  $hoy = DateTime::createFromFormat('!Y-m-d', hoyMadrid()->format('Y-m-d'), new DateTimeZone('Europe/Madrid'));
  $d = (int)$ini->diff($hoy)->format('%r%a') + 1;
  if ($d < 1) return 0;
  return min($d, count($pl['dias'] ?? []) + 1);
}
function normAlias($s) { return preg_replace('/[^a-z0-9]/', '', strtolower((string)$s)); }
// ¿A quién corresponde una clave? → {key, user?, display, avatar?, pending?, alias?}
function quienRetos($key, $alias) {
  static $all = null, $prof = null, $pend = null;
  if ($all === null) { $all = users(); $prof = profiles(); $pend = pendings(); }
  $k = (string)$key;
  if ($k !== '' && $k[0] === '@') {
    $a = substr($k, 1); $to = $alias[normAlias($a)] ?? null;
    if (!$to && isset($all[normAlias($a)])) $to = normAlias($a);
    if ($to && (isset($all[$to]) || isset($pend[$to]))) return ['alias' => $a] + quienRetos($to, $alias);
    return ['key' => $k, 'display' => $a, 'alias' => $a, 'sinCuenta' => true];
  }
  if (isset($all[$k])) return ['key' => $k] + publicUser($k, $all[$k], $prof);
  if (isset($pend[$k])) return ['key' => $k, 'user' => $k, 'display' => $pend[$k]['display'] ?? $k, 'pending' => true];
  return ['key' => $k, 'display' => $k, 'sinCuenta' => true];
}
function ytId($url) {
  $url = trim((string)$url);
  if (preg_match('~^[A-Za-z0-9_-]{11}$~', $url)) return $url;
  if (!preg_match('~^https?://~i', $url)) $url = 'https://' . $url;
  $p = parse_url($url); $h = strtolower(preg_replace('/^(www|m|music)\./', '', $p['host'] ?? ''));
  if ($h === 'youtu.be') $id = explode('/', trim($p['path'] ?? '', '/'))[0] ?? '';
  elseif ($h === 'youtube.com' || $h === 'youtube-nocookie.com') {
    parse_str($p['query'] ?? '', $q);
    $id = $q['v'] ?? '';
    if (!$id && preg_match('~/(?:embed|shorts|live|v)/([A-Za-z0-9_-]{11})~', $p['path'] ?? '', $m)) $id = $m[1];
  } else return null;
  return preg_match('~^[A-Za-z0-9_-]{11}$~', (string)$id) ? $id : null;
}
// Título del vídeo con oEmbed de YouTube (sin clave). Si no hay internet en el servidor, sin título.
function ytTitulo($id) {
  $u = 'https://www.youtube.com/oembed?format=json&url=' . rawurlencode("https://www.youtube.com/watch?v=$id");
  $ctx = ['http' => ['timeout' => 6, 'ignore_errors' => true, 'header' => "User-Agent: GameVault\r\n"]];
  foreach ([ini_get('openssl.cafile'), dirname(PHP_BINARY) . '/extras/ssl/cacert.pem', 'C:/xampp/php/extras/ssl/cacert.pem'] as $ca)
    if ($ca && @is_file($ca)) { $ctx['ssl'] = ['cafile' => $ca]; break; }
  if (function_exists('curl_init')) {
    $ch = curl_init($u);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_CONNECTTIMEOUT => 4] + (isset($ctx['ssl']) ? [CURLOPT_CAINFO => $ctx['ssl']['cafile']] : []));
    $r = curl_exec($ch); curl_close($ch);
  } else $r = @file_get_contents($u, false, stream_context_create($ctx));
  $j = $r ? json_decode($r, true) : null;
  return is_array($j) && !empty($j['title']) ? ['titulo' => mb_substr($j['title'], 0, 200), 'canal' => mb_substr((string)($j['author_name'] ?? ''), 0, 80)] : null;
}
// Lo que ve cada uno de una porra: los votos de los demás solo cuando se cierra
function porraCerrada($po) { return ($po['estado'] ?? '') === 'cerrada' || (!empty($po['cierre']) && strtotime($po['cierre']) <= time()); }
function porraPuntos($po) {
  $pts = [];
  foreach (($po['votos'] ?? []) as $k => $v) {
    $p = 0; $ac = 0;
    foreach (($po['categorias'] ?? []) as $c) {
      if (!empty($c['ganador']) && ($v[$c['id']] ?? null) === $c['ganador']) { $p += max(1, (int)($c['puntos'] ?? 1)); $ac++; }
    }
    $pts[$k] = ['puntos' => $p, 'aciertos' => $ac];
  }
  return $pts;
}
function porraVista($po, $me, $alias, $admin) {
  $cerr = porraCerrada($po);
  $votos = $po['votos'] ?? [];
  $res = $po; unset($res['votos'], $res['avisados']);
  $res['cerrada'] = $cerr;
  $res['mios'] = $votos[$me] ?? (object)[];
  $pts = porraPuntos($po);
  $part = [];
  foreach ($votos as $k => $v) {
    $row = ['quien' => quienRetos($k, $alias), 'n' => count($v)];
    // antes del cierre nadie ve los votos de los demás (el administrador solo los que mete él por otros)
    if ($cerr || ($admin && ($k[0] === '@' || $k[0] === '~'))) $row['votos'] = $v;
    if ($cerr) $row += $pts[$k];
    $part[] = $row;
  }
  $res['participantes'] = $part;
  $res['ganadoresPuestos'] = count(array_filter($po['categorias'] ?? [], function ($c) { return !empty($c['ganador']); }));
  return $res;
}
function playlistVista($pl, $alias) {
  $res = $pl; $res['hoy'] = diaReto($pl);
  $ap = [];
  foreach (($pl['aportes'] ?? []) as $dia => $l) foreach ($l as $k => $a) $ap[$dia][(string)$k] = $a + ['quien' => quienRetos($k, $alias)];
  $res['aportes'] = (object)$ap;
  return $res;
}
// Avisos de los retos, se crean al consultar los avisos: «hoy toca el día N», «ya puedes hacer la porra»…
function avisosRetos($u) {
  global $DIR;
  if (!is_file(retosFile())) return;
  $d = retosData(); $ya = [];
  foreach ((readJson("$DIR/notifs.json", [])[$u] ?? []) as $n) if (!empty($n['clave'])) $ya[$n['clave']] = true;
  foreach ($d['playlists'] as $pl) {
    if (($pl['estado'] ?? '') !== 'activo') continue;
    $h = diaReto($pl); $n = count($pl['dias'] ?? []);
    if ($h < 1 || $h > $n) continue;
    $clave = "pl:{$pl['id']}:$h";
    if (isset($ya[$clave]) || isset($pl['aportes'][$h][$u])) continue;
    notify($u, 'reto', 'switcherino', "Día $h de «{$pl['titulo']}»: " . mb_substr($pl['dias'][$h - 1]['t'] ?? '', 0, 160), ['clave' => $clave, 'link' => '/retos']);
  }
  foreach ($d['porras'] as $po) {
    if (($po['estado'] ?? '') !== 'abierta' || porraCerrada($po)) continue;
    $faltan = count($po['categorias'] ?? []) - count($po['votos'][$u] ?? []);
    $clave = "po:{$po['id']}";
    if (!isset($ya[$clave]) && $faltan > 0) notify($u, 'porra', 'switcherino', "¡Ya puedes hacer tu porra: «{$po['titulo']}»!", ['clave' => $clave, 'link' => '/retos/porra']);
    $clave2 = "po:{$po['id']}:ultimo";
    if (!isset($ya[$clave2]) && $faltan > 0 && !empty($po['cierre']) && strtotime($po['cierre']) - time() < 36 * 3600)
      notify($u, 'porra', 'switcherino', "Te faltan $faltan categorías de la porra y se cierra pronto", ['clave' => $clave2, 'link' => '/retos/porra']);
  }
}
function leerAvisoClave($u, $clave) {
  global $DIR;
  if (!is_file("$DIR/notifs.json")) return;
  jsonTx("$DIR/notifs.json", function (&$d) use ($u, $clave) { foreach (($d[$u] ?? []) as $k => $n) if (($n['clave'] ?? '') === $clave) $d[$u][$k]['leida'] = true; });
}
function slugId($s) { $s = strtr(mb_strtolower((string)$s), ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n','ç'=>'c','à'=>'a','è'=>'e','ò'=>'o']); $s = trim(preg_replace('/[^a-z0-9]+/', '-', $s), '-'); return substr($s ?: 'reto', 0, 40) . '-' . substr(bin2hex(random_bytes(3)), 0, 4); }
function txt($s, $n) { return mb_substr(trim(preg_replace('/\s+/u', ' ', (string)$s)), 0, $n); }

// ── Sesión (web) o token (apps) ────────────────────────────────────────────────
$ME = null; $VIA = null;
if ($TOKEN !== '') {
  $t = tokens(); $h = hash('sha256', $TOKEN);
  if (isset($t[$h]) && isset(users()[$t[$h]['user']])) { $ME = $t[$h]['user']; $VIA = 'token'; }
} else {
  session_set_cookie_params(['lifetime' => 60 * 60 * 24 * 90, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax',
    'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')]);
  ini_set('session.gc_maxlifetime', (string)(60 * 60 * 24 * 90));
  session_name($SESSION);
  @session_start();
  $u = $_SESSION['user'] ?? null;
  if ($u && isset(users()[$u])) { $ME = $u; $VIA = 'session'; }
}
// Los cambios hechos con la cookie de sesión exigen una cabecera propia: así otra web no puede
// provocarlos desde el navegador de alguien que tenga la sesión abierta.
if ($IS_POST && $TOKEN === '' && ($_SERVER['HTTP_X_GV'] ?? '') === '') out(['error' => 'Petición no válida'], 400);

function requireUser() {
  global $ME;
  if (!$ME) out(['error' => 'No has iniciado sesión'], 401);
  if (session_status() === PHP_SESSION_ACTIVE) session_write_close();   // no bloquear otras peticiones del mismo usuario
  return $ME;
}
function newToken($user, $device) {
  global $DIR; ensureDirs();
  $tok = bin2hex(random_bytes(24));
  $t = tokens();
  // como mucho 12 dispositivos por persona: se caducan los más antiguos
  $mine = array_filter($t, function ($x) use ($user) { return $x['user'] === $user; });
  if (count($mine) >= 12) { uasort($mine, function ($a, $b) { return strcmp($a['last'] ?? '', $b['last'] ?? ''); }); foreach (array_slice(array_keys($mine), 0, count($mine) - 11) as $k) unset($t[$k]); }
  $t[hash('sha256', $tok)] = ['user' => $user, 'device' => mb_substr((string)$device, 0, 60), 'created' => date('c'), 'last' => date('c')];
  writeJson("$DIR/tokens.json", $t);
  return $tok;
}

// ── Perfiles ───────────────────────────────────────────────────────────────────
function privacyOf($p) {
  $d = ['precios' => true, 'comentarios' => true, 'deseos' => true];   // por defecto se ve todo
  foreach ($d as $k => $_) if (isset($p['privacy'][$k])) $d[$k] = (bool)$p['privacy'][$k];
  return $d;
}
function publicUser($name, $info, $prof) {
  $p = $prof[$name] ?? [];
  return ['user' => $name, 'display' => $info['display'] ?? $name, 'avatar' => $p['avatar'] ?? null, 'bio' => $p['bio'] ?? ''];
}
function meInfo($name) {
  global $SHARED;
  $all = users(); $prof = profiles();
  $c = readJson(collFile($name), null);
  return publicUser($name, $all[$name] ?? [], $prof) + [
    'privacy' => privacyOf($prof[$name] ?? []),
    'rev' => (int)($c['rev'] ?? 0), 'updatedAt' => $c['updatedAt'] ?? null,
    'creditos' => $SHARED, 'admin' => isAdmin($name), 'claimable' => claimableFor($name),
  ];
}
// Perfiles por reclamar que el administrador ha dejado sugeridos para esta persona
function claimableFor($name) {
  $res = [];
  foreach (pendings() as $id => $p) if (($p['suggest'] ?? null) === $name) {
    $c = readJson(collFile($id), null);
    $res[] = ['id' => $id, 'display' => $p['display'] ?? $id] + counts($c ?: []) + resumenPerfil($c);
  }
  return $res;
}
// Qué consolas (y cuántos juegos en cada una) y qué títulos hay en un perfil de la tabla: la bienvenida
// las deja marcadas y no vuelve a ofrecer esos juegos desde Créditos Finales
function resumenPerfil($c) {
  $d = $c['data'] ?? $c ?? [];
  $n = []; foreach (($d['juegos'] ?? []) as $j) $n[$j['plataformaId'] ?? 0] = ($n[$j['plataformaId'] ?? 0] ?? 0) + 1;
  $cons = []; foreach (($d['plataformas'] ?? []) as $p) $cons[] = ['n' => $p['nombre'] ?? '', 'j' => $n[$p['id']] ?? 0];
  $tit = []; foreach (($d['juegos'] ?? []) as $j) $tit[] = $j['nombre'] ?? '';
  return ['consolas' => $cons, 'titulos' => $tit];
}

// ── Colecciones ────────────────────────────────────────────────────────────────
function shareableImg($s) {
  return is_string($s) && (preg_match('#^https?://#i', $s) || strncmp($s, './consolas/', 11) === 0);
}
function imgs($raw) {
  $a = is_array($raw) ? $raw : json_decode((string)$raw, true);
  if (!is_array($a)) return [];
  return array_values(array_filter($a, 'shareableImg'));
}
// Lo que ven los demás: sin precios / comentarios / deseos si el dueño lo ha ocultado, y sin datos internos
function filtered($data, $priv) {
  $res = ['plataformas' => [], 'juegos' => [], 'accesorios' => [], 'deseos' => []];
  $drop = ['ventasJson', 'tituloIngles', 'hltbFetched', 'ventasFetched', 'createdAt', 'updatedAt'];
  $money = ['precio', 'precioEstimado'];
  $notes = ['comentarios', 'notas'];
  foreach ($res as $t => $_) {
    if ($t === 'deseos' && !$priv['deseos']) continue;
    foreach (($data[$t] ?? []) as $row) {
      if (!is_array($row)) continue;
      foreach ($drop as $k) unset($row[$k]);
      if (!$priv['precios']) foreach ($money as $k) unset($row[$k]);
      if (!$priv['comentarios']) foreach ($notes as $k) unset($row[$k]);
      $row['imagenes'] = imgs($row['imagenes'] ?? []);
      $res[$t][] = $row;
    }
  }
  return $res;
}
function counts($c) {
  $d = $c['data'] ?? [];
  $uds = 0; foreach (($d['juegos'] ?? []) as $j) $uds += max(1, (int)($j['unidades'] ?? 1));
  return ['juegos' => count($d['juegos'] ?? []), 'unidades' => $uds, 'plataformas' => count($d['plataformas'] ?? [])];
}

// ── Créditos Finales ───────────────────────────────────────────────────────────
function creditosDe($u) {
  global $SHARED, $CRED;
  if (!$SHARED || !validName($u)) return null;
  $db = readJson("$CRED/data/u_$u.json", null);
  if (!$db) return [];
  $res = [];
  foreach (($db['years'] ?? []) as $year => $y) {
    foreach (($y['games'] ?? []) as $g) {
      if (!is_array($g) || empty($g['title'])) continue;
      $res[] = ['t' => $g['title'], 'y' => (int)$year, 'e' => 'terminado', 'r' => $g['rating'] ?? null, 'h' => $g['hours'] ?? null, 'sid' => $g['sourceId'] ?? null,
        'd' => $g['date'] ?? null, 'x' => !empty($g['replayed']), 'c' => $g['comment'] ?? '', 's' => $g['song']['title'] ?? null,
        // la carátula que tiene en Créditos Finales (sus fotos locales van relativas a /creditos/)
        'i' => !empty($g['image']) ? (preg_match('#^https?://#', $g['image']) ? $g['image'] : baseUrl() . '../creditos/' . ltrim($g['image'], '/')) : null];
    }
    foreach (['enCurso' => 'jugando', 'pendientes' => 'pendiente', 'abandonados' => 'abandonado', 'retomar' => 'retomar'] as $k => $estado) {
      foreach (($y['lists'][$k] ?? []) as $g) {
        $t = is_array($g) ? ($g['title'] ?? '') : (string)$g;
        if ($t !== '') $res[] = ['t' => $t, 'y' => (int)$year, 'e' => $estado];
      }
    }
  }
  return $res;
}
// Suma una colección a otra: las consolas con el mismo nombre se juntan; ids nuevos para lo que llega
function normName($s) { $s = strtolower(trim((string)$s)); $s = preg_replace('/^(nintendo|sony|sega|microsoft)\s+/', '', $s); return preg_replace('/[^a-z0-9]+/', '', $s); }
function mergeColl($mine, $src) {
  foreach (['plataformas', 'juegos', 'deseos', 'accesorios'] as $t) if (!isset($mine[$t]) || !is_array($mine[$t])) $mine[$t] = [];
  $max = function ($rows) { $m = 0; foreach ($rows as $r) $m = max($m, (int)($r['id'] ?? 0)); return $m; };
  $byName = []; foreach ($mine['plataformas'] as $p) $byName[normName($p['nombre'] ?? '')] = $p['id'];
  $mapP = []; $nextP = $max($mine['plataformas']);
  foreach (($src['plataformas'] ?? []) as $p) {
    $k = normName($p['nombre'] ?? '');
    if (isset($byName[$k])) { $mapP[$p['id']] = $byName[$k]; continue; }
    $p['id'] = $mapP[$p['id']] = $byName[$k] = ++$nextP; $mine['plataformas'][] = $p;
  }
  foreach (['juegos', 'accesorios'] as $t) { $n = $max($mine[$t]);
    foreach (($src[$t] ?? []) as $r) { if (!isset($mapP[$r['plataformaId'] ?? 0])) continue; $r['plataformaId'] = $mapP[$r['plataformaId']]; $r['id'] = ++$n; $mine[$t][] = $r; } }
  $n = $max($mine['deseos']); foreach (($src['deseos'] ?? []) as $r) { $r['id'] = ++$n; $mine['deseos'][] = $r; }
  return $mine;
}
function baseUrl() {
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
  $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
  return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $dir . '/';
}

switch ($action) {
  case 'ping':
    out(['gamevault' => true, 'api' => 2, 'creditos' => $SHARED, 'needsInvite' => $INVITE !== '']);

  case 'me':
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    if (is_dir($DIR)) { try { weeklyBackup(); } catch (Throwable $e) {} }
    if (!$ME) out(['user' => null, 'creditos' => $SHARED, 'needsInvite' => $INVITE !== '']);
    out(meInfo($ME));

  case 'register':
    $b = body();
    $disp = trim((string)($b['user'] ?? '')); $u = strtolower($disp); $p = (string)($b['pass'] ?? '');
    if (!validName($u)) out(['error' => 'Usuario: de 3 a 20 caracteres, solo letras, números, - y _'], 400);
    if (strlen($p) < 6) out(['error' => 'La contraseña debe tener al menos 6 caracteres'], 400);
    if ($INVITE !== '' && !hash_equals($INVITE, trim((string)($b['invite'] ?? '')))) { sleep(1); out(['error' => 'Código de invitación incorrecto'], 403); }
    ensureDirs();
    $all = users();
    if (isset($all[$u])) out(['error' => 'Ese usuario ya existe'], 409);
    $all[$u] = ['hash' => password_hash($p, PASSWORD_DEFAULT), 'display' => $disp, 'created' => date('c'), 'public' => false];
    if (!saveUsers($all)) out(['error' => 'No se pudo escribir en el servidor (¿permisos de data/?)'], 500);
    // cuentas compartidas: Créditos Finales espera que cada cuenta tenga su lista (vacía al nacer)
    if ($SHARED && !is_file("$CRED/data/u_$u.json")) writeJson("$CRED/data/u_$u.json", ['version' => 1, 'years' => new stdClass()]);
    $tok = null;
    if (!empty($b['token'])) $tok = newToken($u, $b['device'] ?? '');
    else { @session_regenerate_id(true); $_SESSION['user'] = $u; }
    out(meInfo($u) + ($tok ? ['token' => $tok] : []));

  case 'login':
    $b = body();
    $u = strtolower(trim((string)($b['user'] ?? ''))); $p = (string)($b['pass'] ?? '');
    $all = users();
    if (!isset($all[$u]) || !password_verify($p, (string)($all[$u]['hash'] ?? ''))) { sleep(1); out(['error' => 'Usuario o contraseña incorrectos'], 401); }
    $tok = null;
    if (!empty($b['token'])) $tok = newToken($u, $b['device'] ?? '');
    else { @session_regenerate_id(true); $_SESSION['user'] = $u; }
    out(meInfo($u) + ($tok ? ['token' => $tok] : []));

  case 'logout':
    if ($TOKEN !== '') { $t = tokens(); unset($t[hash('sha256', $TOKEN)]); writeJson("$DIR/tokens.json", $t); }
    elseif (session_status() === PHP_SESSION_ACTIVE) { $_SESSION = []; @session_destroy(); }
    out(['ok' => true]);

  case 'password':
    $u = requireUser(); $b = body(); $all = users();
    if (!password_verify((string)($b['old'] ?? ''), (string)$all[$u]['hash'])) { sleep(1); out(['error' => 'La contraseña actual no es correcta'], 403); }
    if (strlen((string)($b['new'] ?? '')) < 6) out(['error' => 'La nueva contraseña debe tener al menos 6 caracteres'], 400);
    $all[$u]['hash'] = password_hash((string)$b['new'], PASSWORD_DEFAULT);
    saveUsers($all);
    out(['ok' => true]);

  case 'profile':   // POST {privacy:{precios,comentarios,deseos}, bio, avatar}
    $u = requireUser(); $b = body(); ensureDirs();
    $prof = profiles(); $p = $prof[$u] ?? [];
    if (isset($b['privacy']) && is_array($b['privacy'])) {
      $cur = privacyOf($p);
      foreach ($cur as $k => $_) if (array_key_exists($k, $b['privacy'])) $cur[$k] = (bool)$b['privacy'][$k];
      $p['privacy'] = $cur;
    }
    if (array_key_exists('bio', $b)) $p['bio'] = mb_substr(trim((string)$b['bio']), 0, 160);
    if (array_key_exists('avatar', $b)) {
      $a = $b['avatar'];
      // solo se acepta una foto subida por esta misma persona (o ninguna)
      $p['avatar'] = (is_string($a) && preg_match('#^uploads/' . preg_quote($u, '#') . '/[a-f0-9]{40}\.(jpg|png|webp|gif)$#', $a)) ? $a : null;
    }
    $prof[$u] = $p;
    if (!writeJson("$DIR/profiles.json", $prof)) out(['error' => 'No se pudo guardar el perfil'], 500);
    out(meInfo($u));

  case 'upload':    // POST con la imagen como cuerpo → {path, url}
    $u = requireUser(); ensureDirs();
    $raw = (string)file_get_contents('php://input');
    if ($raw === '' || strlen($raw) > 6 * 1024 * 1024) out(['error' => 'La imagen está vacía o pesa más de 6 MB'], 413);
    $info = @getimagesizefromstring($raw);
    $ext = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp', IMAGETYPE_GIF => 'gif'][$info[2] ?? 0] ?? null;
    if (!$info || !$ext) out(['error' => 'El fichero no es una imagen válida (JPG, PNG, WebP o GIF)'], 415);
    $d = "$UPLOADS/$u";
    if (!is_dir($d)) @mkdir($d, 0775, true);
    $name = sha1($raw) . '.' . $ext;
    if (!is_file("$d/$name") && file_put_contents("$d/$name", $raw, LOCK_EX) === false) out(['error' => 'No se pudo guardar la imagen'], 500);
    out(['path' => "uploads/$u/$name", 'url' => baseUrl() . "uploads/$u/$name"]);

  case 'collection':
    $u = requireUser();
    $c = readJson(collFile($u), null);
    out(['rev' => (int)($c['rev'] ?? 0), 'updatedAt' => $c['updatedAt'] ?? null, 'device' => $c['device'] ?? null, 'data' => $c['data'] ?? null]);

  case 'save':      // POST {baseRev, data, device, force}
    $u = requireUser(); $b = body(); ensureDirs();
    $data = $b['data'] ?? null;
    if (!is_array($data) || !isset($data['plataformas']) || !is_array($data['plataformas']) || !is_array($data['juegos'] ?? null)) out(['error' => 'Colección no válida'], 400);
    $f = collFile($u);
    $cur = readJson($f, null);
    $rev = (int)($cur['rev'] ?? 0);
    // alguien (otro dispositivo) guardó entre medias → que decida la persona, no se pisa nada
    if (empty($b['force']) && (int)($b['baseRev'] ?? 0) !== $rev) out(['error' => 'conflict', 'rev' => $rev, 'updatedAt' => $cur['updatedAt'] ?? null, 'device' => $cur['device'] ?? null, 'counts' => counts($cur ?: [])], 409);
    $clean = [];
    foreach (['plataformas', 'juegos', 'deseos', 'accesorios'] as $t) $clean[$t] = array_values(array_filter(is_array($data[$t] ?? null) ? $data[$t] : [], 'is_array'));
    if (is_file($f)) @copy($f, "$f.bak");
    $new = ['rev' => $rev + 1, 'updatedAt' => date('c'), 'device' => mb_substr((string)($b['device'] ?? ''), 0, 60), 'data' => $clean];
    if (!writeJson($f, $new, false)) out(['error' => 'No se pudo guardar en el servidor (¿permisos de data/?)'], 500);
    out(['ok' => true, 'rev' => $new['rev'], 'updatedAt' => $new['updatedAt']]);

  case 'users':     // la gente: cualquiera con cuenta ve a los demás
    requireUser();
    $prof = profiles(); $res = [];
    foreach (users() as $name => $info) {
      $c = readJson(collFile($name), null);
      $row = publicUser($name, $info, $prof) + counts($c ?: []) + ['updatedAt' => $c['updatedAt'] ?? null];
      if ($SHARED) { $n = 0; foreach ((creditosDe($name) ?: []) as $g) if ($g['e'] === 'terminado') $n++; $row['terminados'] = $n; }
      $res[] = $row;
    }
    usort($res, function ($a, $b) { return strcmp((string)($b['updatedAt'] ?? ''), (string)($a['updatedAt'] ?? '')); });
    foreach (pendings() as $id => $p) {
      $c = readJson(collFile($id), null);
      $res[] = ['user' => $id, 'display' => $p['display'] ?? $id, 'avatar' => null, 'bio' => '', 'pending' => true] + counts($c ?: []) + ['updatedAt' => $c['updatedAt'] ?? null];
    }
    out($res);

  case 'view':      // la colección de alguien, solo lectura
    requireUser();
    $u = strtolower(trim((string)($_GET['u'] ?? ''))); $all = users();
    if (isPendingId($u)) {
      $p = pendings()[$u]; $c = readJson(collFile($u), null);
      $priv = privacyOf([]);
      out(['user' => $u, 'display' => $p['display'] ?? $u, 'avatar' => null, 'bio' => 'Todavía no tiene cuenta: estos juegos se cargaron de una tabla compartida.',
        'pending' => true, 'privacy' => $priv, 'updatedAt' => $c['updatedAt'] ?? null, 'data' => filtered($c['data'] ?? [], $priv), 'creditos' => null]);
    }
    if (!validName($u) || !isset($all[$u])) out(['error' => 'Ese usuario no existe'], 404);
    $prof = profiles(); $priv = privacyOf($prof[$u] ?? []);
    $c = readJson(collFile($u), null);
    out(publicUser($u, $all[$u], $prof) + ['privacy' => $priv, 'updatedAt' => $c['updatedAt'] ?? null,
      'data' => filtered($c['data'] ?? [], $priv), 'creditos' => creditosDe($u)]);

  case 'loans':     // zona de préstamos: los juegos de todos, en pequeño
    requireUser();
    $prof = profiles(); $res = [];
    $gente = [];
    foreach (users() as $name => $info) $gente[$name] = publicUser($name, $info, $prof);
    foreach (pendings() as $id => $p) $gente[$id] = ['user' => $id, 'display' => $p['display'] ?? $id, 'avatar' => null, 'bio' => '', 'pending' => true];
    foreach ($gente as $name => $pub) {
      $c = readJson(collFile($name), null);
      $d = $c['data'] ?? null;
      if (!$d || empty($d['juegos'])) continue;
      $plat = [];
      foreach (($d['plataformas'] ?? []) as $p) $plat[$p['id'] ?? 0] = $p['nombre'] ?? '';
      $js = [];
      foreach ($d['juegos'] as $j) {
        $im = imgs($j['imagenes'] ?? []);
        $js[] = ['id' => $j['id'] ?? null, 'n' => $j['nombre'] ?? '', 'p' => $plat[$j['plataformaId'] ?? 0] ?? '', 'e' => $j['estado'] ?? null,
          'u' => max(1, (int)($j['unidades'] ?? 1)), 'a' => $j['prestadoA'] ?? null, 'au' => $j['prestadoUsuario'] ?? null,
          'f' => $j['fechaPrestamo'] ?? null, 'i' => $im[0] ?? null];
      }
      $res[] = $pub + ['juegos' => $js];
    }
    out($res);

  case 'creditos':
    requireUser();
    $u = strtolower(trim((string)($_GET['u'] ?? $ME)));
    if (!$SHARED) out(['disponible' => false, 'juegos' => []]);
    out(['disponible' => true, 'url' => baseUrl() . '../creditos/', 'juegos' => creditosDe($u) ?: []]);

  /* ---------- peticiones de préstamo: «¿me lo dejas?» ---------- */
  case 'requests':  // GET → { recibidas: pendientes para mí, enviadas: las mías (últimos 60 días) }
    $u = requireUser(); $prof = profiles(); $all = users();
    $pend = pendings();
    $pub = function ($n) use ($all, $prof, $pend) {
      if (isset($all[$n])) return publicUser($n, $all[$n], $prof);
      if (isset($pend[$n])) return ['user' => $n, 'display' => $pend[$n]['display'] ?? $n, 'pending' => true];
      return ['user' => $n, 'display' => $n];
    };
    $rec = []; $env = []; $lim = date('c', time() - 60 * 86400);
    foreach (reqs() as $r) {
      if ($r['to'] === $u && $r['estado'] === 'pendiente') $rec[] = $r + ['quien' => $pub($r['from'])];
      if ($r['from'] === $u && ($r['estado'] === 'pendiente' || ($r['answered'] ?? '') >= $lim)) $env[] = $r + ['quien' => $pub($r['to'])];
    }
    out(['recibidas' => array_reverse($rec), 'enviadas' => array_reverse($env)]);

  case 'req_create': // POST {owner, id, nombre, msg}
    $u = requireUser(); $b = body();
    $to = strtolower((string)($b['owner'] ?? '')); $jid = (int)($b['id'] ?? 0);
    if ($to === $u) out(['error' => 'Ese juego ya es tuyo'], 400);
    // a quien aún no tiene cuenta también se le puede pedir: le llegará cuando reclame su colección
    if (!isPendingId($to) && !isset(users()[$to])) out(['error' => 'Esa persona no existe'], 404);
    $j = null; foreach ((readJson(collFile($to), null)['data']['juegos'] ?? []) as $x) if ((int)($x['id'] ?? 0) === $jid) $j = $x;
    if (!$j) out(['error' => 'Ese juego ya no está en su colección'], 404);
    if (!empty($j['prestadoA'])) out(['error' => 'Ahora mismo lo tiene otra persona'], 409);
    $res = null;
    reqTx(function (&$l) use ($u, $to, $jid, $j, $b, &$res) {
      foreach ($l as $r) if ($r['from'] === $u && $r['to'] === $to && $r['juegoId'] === $jid && $r['estado'] === 'pendiente') { $res = $r; return; }
      $res = ['id' => bin2hex(random_bytes(6)), 'from' => $u, 'to' => $to, 'juegoId' => $jid, 'nombre' => (string)($j['nombre'] ?? ''),
        'msg' => mb_substr(trim((string)($b['msg'] ?? '')), 0, 300), 'created' => date('c'), 'estado' => 'pendiente'];
      $l[] = $res;
    });
    $disp = users()[$u]['display'] ?? $u;
    if (($res['created'] ?? '') >= date('c', time() - 5)) notify($to, 'peticion', $u, "$disp te pide «{$res['nombre']}»" . ($res['msg'] ? ": «{$res['msg']}»" : ''), ['juegoId' => $jid, 'nombre' => $res['nombre']]);
    out($res);

  case 'req_answer': // POST {id, accept} — solo el dueño del juego
  case 'req_cancel': // POST {id} — solo quien lo pidió
    $u = requireUser(); $b = body(); $id = (string)($b['id'] ?? ''); $res = null; $err = null;
    reqTx(function (&$l) use ($u, $id, $b, $action, &$res, &$err) {
      foreach ($l as $k => $r) if ($r['id'] === $id) {
        if ($action === 'req_answer' && $r['to'] !== $u) { $err = 'Esa petición no es para ti'; return; }
        if ($action === 'req_cancel' && $r['from'] !== $u) { $err = 'Esa petición no es tuya'; return; }
        $l[$k]['estado'] = $action === 'req_cancel' ? 'cancelada' : (!empty($b['accept']) ? 'aceptada' : 'rechazada');
        $l[$k]['answered'] = date('c'); $res = $l[$k]; return;
      }
      $err = 'Esa petición ya no existe';
    });
    if ($err) out(['error' => $err], 404);
    if ($action === 'req_answer') {
      $disp = users()[$u]['display'] ?? $u;
      notify($res['from'], $res['estado'] === 'aceptada' ? 'aceptada' : 'rechazada', $u,
        $res['estado'] === 'aceptada' ? "¡$disp te deja «{$res['nombre']}»!" : "$disp ahora no puede dejarte «{$res['nombre']}»", ['juegoId' => $res['juegoId'], 'nombre' => $res['nombre']]);
    }
    out($res);

  /* ---------- avisos ---------- */
  case 'notifs':    // GET → { avisos: [...], sinLeer: n }
    $u = requireUser(); $all = users(); $prof = profiles();
    try { avisosRetos($u); } catch (Throwable $e) {}
    $l = array_reverse(readJson("$DIR/notifs.json", [])[$u] ?? []);
    foreach ($l as $k => $n) $l[$k]['quien'] = isset($all[$n['de']]) ? publicUser($n['de'], $all[$n['de']], $prof) : ['user' => $n['de'], 'display' => $n['de']];
    out(['avisos' => $l, 'sinLeer' => count(array_filter($l, function ($n) { return empty($n['leida']); }))]);

  case 'notifs_read': // POST {ids?} — sin ids, todas
    $u = requireUser(); $b = body(); $ids = isset($b['ids']) ? (array)$b['ids'] : null;
    jsonTx("$DIR/notifs.json", function (&$d) use ($u, $ids) {
      foreach (($d[$u] ?? []) as $k => $n) if ($ids === null || in_array($n['id'], $ids, true)) $d[$u][$k]['leida'] = true;
    });
    out(['ok' => true]);

  case 'remind':    // POST {to, id, msg}: el dueño recuerda a quien tiene su juego que se lo devuelva
    $u = requireUser(); $b = body();
    $to = strtolower((string)($b['to'] ?? '')); $jid = (int)($b['id'] ?? 0);
    $j = null; foreach ((readJson(collFile($u), null)['data']['juegos'] ?? []) as $x) if ((int)($x['id'] ?? 0) === $jid) $j = $x;
    if (!$j || ($j['prestadoUsuario'] ?? null) !== $to) out(['error' => 'Ese juego no lo tiene esa persona (¿está sincronizado?)'], 400);
    $clave = "$u|$jid"; $ya = false;
    jsonTx("$DIR/reminders.json", function (&$d) use ($clave, &$ya) {
      if (($d[$clave] ?? 0) > time() - 3 * 86400) { $ya = true; return; }
      $d[$clave] = time();
    });
    if ($ya) out(['error' => 'Ya se lo recordaste hace menos de 3 días'], 429);
    $disp = users()[$u]['display'] ?? $u;
    $desde = !empty($j['fechaPrestamo']) ? ' (desde el ' . implode('/', array_reverse(explode('-', $j['fechaPrestamo']))) . ')' : '';
    $msg = mb_substr(trim((string)($b['msg'] ?? '')), 0, 300);
    notify($to, 'recordatorio', $u, "$disp te recuerda que tienes su «{$j['nombre']}»$desde" . ($msg ? ": «{$msg}»" : ''), ['juegoId' => $jid, 'nombre' => $j['nombre']]);
    out(['ok' => true]);

  /* ---------- copias de seguridad (administradores) ---------- */
  case 'backups':
    $u = requireUser(); if (!isAdmin($u)) out(['error' => 'Solo para administradores'], 403);
    $f = backupDir() . '/ultima.txt';
    out(['copias' => listBackups(), 'ultima' => is_file($f) ? date('c', (int)file_get_contents($f)) : null, 'carpeta' => str_replace('\\', '/', realpath(backupDir()) ?: backupDir())]);

  case 'backup_now':
    $u = requireUser(); if (!isAdmin($u)) out(['error' => 'Solo para administradores'], 403);
    $n = makeBackup('a mano');
    if (!$n) out(['error' => 'No se pudo escribir la copia en data/backups'], 500);
    out(['ok' => true, 'nombre' => $n, 'copias' => listBackups()]);

  case 'backup_get':  // descarga de una copia (administradores)
    $u = requireUser(); if (!isAdmin($u)) out(['error' => 'Solo para administradores'], 403);
    $n = basename((string)($_GET['n'] ?? ''));
    $f = backupDir() . '/' . $n;
    if (!preg_match('/^gamevault-[\d-]+\.json(\.gz)?$/', $n) || !is_file($f)) out(['error' => 'No existe esa copia'], 404);
    header_remove('Content-Type');
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $n . '"');
    header('Content-Length: ' . filesize($f));
    readfile($f); exit;

  case 'pending':   // administradores: perfiles por reclamar con su enlace para mandárselo a cada uno
    $u = requireUser();
    if (!isAdmin($u)) out(['error' => 'Solo para administradores'], 403);
    $res = [];
    foreach (pendings() as $id => $p) {
      $c = readJson(collFile($id), null);
      $res[] = ['id' => $id, 'display' => $p['display'] ?? $id, 'suggest' => $p['suggest'] ?? null,
        'link' => baseUrl() . '#/reclamar/' . rawurlencode(substr($id, 1)) . '/' . ($p['code'] ?? '')] + counts($c ?: []);
    }
    out($res);

  case 'claiminfo': // GET id, code → a quién corresponde el enlace (sin tocar nada)
    requireUser();
    $id = '~' . preg_replace('/[^a-z0-9-]/', '', strtolower((string)($_GET['id'] ?? '')));
    $all = pendings();
    if (!isset($all[$id])) out(['error' => 'Este perfil ya se ha reclamado o no existe'], 404);
    $p = $all[$id];
    $ok = ($p['suggest'] ?? null) === $ME || hash_equals((string)($p['code'] ?? ''), (string)($_GET['code'] ?? ''));
    if (!$ok) out(['error' => 'El enlace no es válido'], 403);
    $c = readJson(collFile($id), null);
    out(['id' => $id, 'display' => $p['display'] ?? $id, 'esPara' => ($p['suggest'] ?? null) === $ME,
      'admin' => isAdmin($ME) && ($p['suggest'] ?? null) !== $ME] + counts($c ?: []) + resumenPerfil($c));

  case 'claim':     // POST {id, code}: la colección del perfil pasa a ser mía (se suma a la que tenga)
    $u = requireUser(); $b = body();
    $id = (string)($b['id'] ?? ''); if ($id !== '' && $id[0] !== '~') $id = '~' . $id;
    $all = pendings();
    if (!isset($all[$id])) out(['error' => 'Este perfil ya se ha reclamado o no existe'], 404);
    $p = $all[$id];
    if (($p['suggest'] ?? null) !== $u && !hash_equals((string)($p['code'] ?? ''), (string)($b['code'] ?? ''))) { sleep(1); out(['error' => 'El enlace no es válido'], 403); }
    // el administrador abre los enlaces para probarlos o copiarlos: nunca se le pasan colecciones ajenas por error
    if (isAdmin($u) && ($p['suggest'] ?? null) !== $u) out(['error' => 'Este enlace es para ' . ($p['display'] ?? $id) . ': tiene que abrirlo con su propia cuenta. La tuya de administrador no puede quedarse con su colección.'], 403);
    $src = readJson(collFile($id), null)['data'] ?? [];
    $f = collFile($u); $cur = readJson($f, null);
    $mine = $cur['data'] ?? ['plataformas' => [], 'juegos' => [], 'deseos' => [], 'accesorios' => []];
    $merged = mergeColl($mine, $src);
    if (is_file($f)) @copy($f, "$f.bak");
    $rev = (int)($cur['rev'] ?? 0) + 1;
    if (!writeJson($f, ['rev' => $rev, 'updatedAt' => date('c'), 'device' => 'Perfil reclamado', 'data' => $merged], false)) out(['error' => 'No se pudo guardar'], 500);
    // quien tuviera prestado algo «a este perfil» ahora lo tiene prestado a la cuenta de verdad
    $disp = users()[$u]['display'] ?? $u;
    foreach (glob("$DIR/c_*.json") ?: [] as $cf) {
      $c = readJson($cf, null); $hit = false;
      foreach (($c['data']['juegos'] ?? []) as $k => $j) if (($j['prestadoUsuario'] ?? null) === $id) { $c['data']['juegos'][$k]['prestadoUsuario'] = $u; $c['data']['juegos'][$k]['prestadoA'] = $disp; $hit = true; }
      if ($hit) { $c['rev'] = (int)($c['rev'] ?? 0) + 1; $c['updatedAt'] = date('c'); writeJson($cf, $c, false); }
    }
    unset($all[$id]); writeJson("$DIR/pending.json", $all);
    // las peticiones que le hicieron mientras no tenía cuenta pasan a su cuenta
    if (is_file("$DIR/requests.json")) reqTx(function (&$l) use ($id, $u) { foreach ($l as $k => $r) { if ($r['to'] === $id) $l[$k]['to'] = $u; } });
    if (is_file("$DIR/notifs.json")) jsonTx("$DIR/notifs.json", function (&$d) use ($id, $u) { if (!empty($d[$id])) { $d[$u] = array_slice(array_merge($d[$u] ?? [], $d[$id]), -60); unset($d[$id]); } });
    if (is_file(retosFile())) retosTx(function (&$d) use ($id, $u) {
      foreach ($d['alias'] as $a => $to) if ($to === $id) $d['alias'][$a] = $u;
      foreach ($d['playlists'] as $pk => $pl) foreach (($pl['aportes'] ?? []) as $dia => $l) if (isset($l[$id])) { if (!isset($l[$u])) $d['playlists'][$pk]['aportes'][$dia][$u] = $l[$id]; unset($d['playlists'][$pk]['aportes'][$dia][$id]); }
      foreach ($d['porras'] as $pk => $po) if (isset($po['votos'][$id])) { $d['porras'][$pk]['votos'][$u] = ($po['votos'][$u] ?? []) + $po['votos'][$id]; unset($d['porras'][$pk]['votos'][$id]); }
    });
    @rename(collFile($id), collFile($id) . '.reclamado-por-' . $u);
    out(['ok' => true, 'rev' => $rev] + counts(['data' => $merged]));

  case 'mis_creditos': // GET → los juegos que tengo en Créditos Finales (para ofrecerlos al crear la colección)
    $u = requireUser();
    $l = creditosDe($u);
    out(['juegos' => array_values(array_filter($l ?: [], function ($g) { return in_array($g['e'], ['terminado', 'jugando'], true); }))]);

  /* ---------- retos Switcherino ---------- */
  case 'retos':     // GET → { playlists:[…], porras:[…], admin, alias, gente }
    $u = requireUser(); $d = retosData(); $adm = isAdmin($u);
    $pls = []; foreach ($d['playlists'] as $pl) if ($adm || ($pl['estado'] ?? '') !== 'borrador') $pls[] = playlistVista($pl, $d['alias']);
    usort($pls, function ($a, $b) { return strcmp((string)($b['inicio'] ?? '9999'), (string)($a['inicio'] ?? '9999')); });
    $pos = []; foreach ($d['porras'] as $po) if ($adm || ($po['estado'] ?? '') !== 'borrador') $pos[] = porraVista($po, $u, $d['alias'], $adm);
    usort($pos, function ($a, $b) { return strcmp((string)($b['fecha'] ?? ''), (string)($a['fecha'] ?? '')); });
    $res = ['playlists' => $pls, 'porras' => $pos, 'admin' => $adm, 'hoy' => hoyMadrid()->format('Y-m-d')];
    if ($adm) {
      $res['alias'] = (object)$d['alias'];
      $g = []; $prof = profiles();
      foreach (users() as $n => $i) $g[] = publicUser($n, $i, $prof);
      foreach (pendings() as $id => $p) $g[] = ['user' => $id, 'display' => $p['display'] ?? $id, 'pending' => true];
      $res['gente'] = $g;
    }
    out($res);

  case 'reto_aporte': // POST {pid, dia, url, titulo?, para?}: mi tema para ese día (url vacía = quitarlo)
    $u = requireUser(); $b = body(); $adm = isAdmin($u);
    $para = trim((string)($b['para'] ?? ''));
    if ($para !== '' && !$adm) out(['error' => 'Solo el administrador puede añadir temas de otros'], 403);
    if ($para !== '' && $para[0] !== '@' && $para[0] !== '~' && !isset(users()[$para])) out(['error' => 'Esa persona no existe'], 400);
    if ($para !== '' && $para[0] === '@') $para = '@' . txt(substr($para, 1), 30);
    $key = $para !== '' ? $para : $u;
    $url = trim((string)($b['url'] ?? '')); $id = null; $info = null;
    if ($url !== '') {
      $id = ytId($url);
      if (!$id) out(['error' => 'Eso no parece un enlace de YouTube'], 400);
      $info = trim((string)($b['titulo'] ?? '')) === '' ? ytTitulo($id) : null;
    }
    $res = retosTx(function (&$d) use ($b, $key, $url, $id, $info, $adm) {
      $pid = (string)($b['pid'] ?? ''); $dia = (int)($b['dia'] ?? 0);
      if (!isset($d['playlists'][$pid])) return ['error' => 'Ese reto no existe', 'code' => 404];
      $pl = &$d['playlists'][$pid];
      if ($dia < 1 || $dia > count($pl['dias'] ?? [])) return ['error' => 'Ese día no existe', 'code' => 400];
      if (!$adm) {
        if (($pl['estado'] ?? '') !== 'activo') return ['error' => 'Este reto no está en marcha', 'code' => 400];
        if ($dia > diaReto($pl)) return ['error' => 'Ese día todavía no ha llegado', 'code' => 400];
      }
      if ($url === '') { unset($pl['aportes'][$dia][$key]); if (empty($pl['aportes'][$dia])) unset($pl['aportes'][$dia]); return ['ok' => true]; }
      $prev = $pl['aportes'][$dia][$key] ?? [];
      $tit = txt($b['titulo'] ?? '', 200);
      if ($tit === '') $tit = $info['titulo'] ?? (($prev['yt'] ?? '') === $id ? ($prev['titulo'] ?? '') : '');
      $pl['aportes'][$dia][$key] = ['yt' => $id, 'url' => mb_substr($url, 0, 300), 'titulo' => $tit, 'canal' => $info['canal'] ?? ($prev['canal'] ?? ''),
        'nota' => txt($b['nota'] ?? ($prev['nota'] ?? ''), 200), 'fecha' => date('c')];
      return ['ok' => true, 'aporte' => $pl['aportes'][$dia][$key]];
    });
    if (!empty($res['error'])) out(['error' => $res['error']], $res['code']);
    if ($key === $u && $url !== '') leerAvisoClave($u, 'pl:' . (string)($b['pid'] ?? '') . ':' . (int)($b['dia'] ?? 0));
    out($res);

  case 'reto_guardar': // POST (admin) {id?, titulo, estacion, inicio, dias:[texto], estado, video, playlist, verFuturas}
    $u = requireUser(); if (!isAdmin($u)) out(['error' => 'Solo para administradores'], 403);
    $b = body();
    $dias = []; foreach ((array)($b['dias'] ?? []) as $t) { $t = txt(is_array($t) ? ($t['t'] ?? '') : $t, 600); if ($t !== '') $dias[] = ['t' => $t]; }
    if (!$dias) out(['error' => 'Pon al menos un día'], 400);
    if (count($dias) > 62) out(['error' => 'Como mucho 62 días'], 400);
    $ini = (string)($b['inicio'] ?? '');
    if ($ini !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $ini)) out(['error' => 'Fecha de inicio no válida'], 400);
    $estado = in_array($b['estado'] ?? '', ['borrador', 'activo', 'terminado'], true) ? $b['estado'] : 'borrador';
    if ($estado === 'activo' && $ini === '') out(['error' => 'Para arrancarlo hace falta la fecha de inicio'], 400);
    $pl = retosTx(function (&$d) use ($b, $dias, $ini, $estado, $u) {
      $id = (string)($b['id'] ?? '');
      if ($id === '' || !isset($d['playlists'][$id])) { $id = slugId($b['titulo'] ?? 'playlist'); $d['playlists'][$id] = ['id' => $id, 'creado' => date('c'), 'por' => $u, 'aportes' => []]; }
      $p = &$d['playlists'][$id];
      $p['titulo'] = txt($b['titulo'] ?? '', 80) ?: 'Playlist Switcherino';
      $p['estacion'] = in_array($b['estacion'] ?? '', ['primavera', 'verano', 'otono', 'invierno', 'otra'], true) ? $b['estacion'] : 'otra';
      $p['intro'] = txt($b['intro'] ?? '', 1000);
      $p['inicio'] = $ini; $p['estado'] = $estado; $p['dias'] = $dias;
      $nv = txt($b['video'] ?? '', 300);
      if ($nv !== ($p['video'] ?? '')) $p['videoTitulo'] = ($vid = ytId($nv)) ? (ytTitulo($vid)['titulo'] ?? '') : '';
      $p['video'] = $nv; $p['playlist'] = txt($b['playlist'] ?? '', 300);
      $p['verFuturas'] = !empty($b['verFuturas']);
      // si se quitan días del final, sus temas se quedan guardados por si se vuelven a poner
      return $p;
    });
    $d = retosData();
    out(['ok' => true, 'playlist' => playlistVista($pl, $d['alias'])]);

  case 'porra_guardar': // POST (admin) {id?, titulo, fecha, cierre, estado, categorias:[{id?, nombre, puntos, nominados:[{id?, n, sub, img}], ganador}]}
    $u = requireUser(); if (!isAdmin($u)) out(['error' => 'Solo para administradores'], 403);
    $b = body();
    $cats = [];
    foreach ((array)($b['categorias'] ?? []) as $c) {
      $noms = [];
      foreach ((array)($c['nominados'] ?? []) as $n) {
        $nn = txt($n['n'] ?? '', 120); if ($nn === '') continue;
        $img = (string)($n['img'] ?? ''); if ($img !== '' && !preg_match('~^https://~', $img)) $img = '';
        $noms[] = ['id' => preg_replace('/[^a-z0-9-]/', '', (string)($n['id'] ?? '')) ?: substr(bin2hex(random_bytes(4)), 0, 8), 'n' => $nn, 'sub' => txt($n['sub'] ?? '', 120), 'img' => mb_substr($img, 0, 400)];
      }
      $nom = txt($c['nombre'] ?? '', 120); if ($nom === '' || !$noms) continue;
      $cid = preg_replace('/[^a-z0-9-]/', '', (string)($c['id'] ?? '')) ?: substr(bin2hex(random_bytes(4)), 0, 8);
      $gan = (string)($c['ganador'] ?? ''); $okG = false; foreach ($noms as $n) if ($n['id'] === $gan) $okG = true;
      $cats[] = ['id' => $cid, 'nombre' => $nom, 'en' => txt($c['en'] ?? '', 120), 'puntos' => max(1, min(10, (int)($c['puntos'] ?? 1))), 'nominados' => $noms, 'ganador' => $okG ? $gan : null];
    }
    if (!$cats) out(['error' => 'Pon al menos una categoría con nominados'], 400);
    $estado = in_array($b['estado'] ?? '', ['borrador', 'abierta', 'cerrada'], true) ? $b['estado'] : 'borrador';
    $po = retosTx(function (&$d) use ($b, $cats, $estado, $u) {
      $id = (string)($b['id'] ?? '');
      if ($id === '' || !isset($d['porras'][$id])) { $id = slugId($b['titulo'] ?? 'porra'); $d['porras'][$id] = ['id' => $id, 'creado' => date('c'), 'por' => $u, 'votos' => []]; }
      $p = &$d['porras'][$id];
      $p['titulo'] = txt($b['titulo'] ?? '', 80) ?: 'Porra Switcherino';
      $p['intro'] = txt($b['intro'] ?? '', 1000);
      $p['fecha'] = txt($b['fecha'] ?? '', 30); $p['cierre'] = txt($b['cierre'] ?? '', 30);
      $p['estado'] = $estado; $p['categorias'] = $cats;
      // votos a nominados que ya no existen se quitan
      $ok = []; foreach ($cats as $c) foreach ($c['nominados'] as $n) $ok[$c['id']][$n['id']] = true;
      foreach ($p['votos'] as $k => $v) { foreach ($v as $cid => $nid) if (empty($ok[$cid][$nid])) unset($p['votos'][$k][$cid]); if (empty($p['votos'][$k])) unset($p['votos'][$k]); }
      return $p;
    });
    $d = retosData();
    out(['ok' => true, 'porra' => porraVista($po, $u, $d['alias'], true)]);

  case 'porra_voto': // POST {id, cat, nom, para?} — nom vacío = quitar el voto. Se puede cambiar hasta el cierre.
    $u = requireUser(); $b = body(); $adm = isAdmin($u);
    $para = trim((string)($b['para'] ?? ''));
    if ($para !== '' && !$adm) out(['error' => 'Solo el administrador puede votar por otros'], 403);
    if ($para !== '' && $para[0] === '@') $para = '@' . txt(substr($para, 1), 30);
    $key = $para !== '' ? $para : $u;
    $res = retosTx(function (&$d) use ($b, $key, $adm) {
      $id = (string)($b['id'] ?? '');
      if (!isset($d['porras'][$id])) return ['error' => 'Esa porra no existe', 'code' => 404];
      $p = &$d['porras'][$id];
      if (!$adm && (($p['estado'] ?? '') !== 'abierta' || porraCerrada($p))) return ['error' => 'La porra ya está cerrada', 'code' => 400];
      $cid = (string)($b['cat'] ?? ''); $nid = (string)($b['nom'] ?? ''); $cat = null;
      foreach ($p['categorias'] as $c) if ($c['id'] === $cid) $cat = $c;
      if (!$cat) return ['error' => 'Esa categoría no existe', 'code' => 400];
      if ($nid === '') { unset($p['votos'][$key][$cid]); if (empty($p['votos'][$key])) unset($p['votos'][$key]); return ['ok' => true, 'mios' => (object)($p['votos'][$key] ?? [])]; }
      $ok = false; foreach ($cat['nominados'] as $n) if ($n['id'] === $nid) $ok = true;
      if (!$ok) return ['error' => 'Ese nominado no está en la categoría', 'code' => 400];
      $p['votos'][$key][$cid] = $nid;
      return ['ok' => true, 'mios' => $p['votos'][$key], 'completa' => count($p['votos'][$key]) >= count($p['categorias'])];
    });
    if (!empty($res['error'])) out(['error' => $res['error']], $res['code']);
    if ($key === $u && !empty($res['completa'])) { leerAvisoClave($u, 'po:' . (string)($b['id'] ?? '')); leerAvisoClave($u, 'po:' . (string)($b['id'] ?? '') . ':ultimo'); }
    out($res);

  case 'porra_ganador': // POST (admin) {id, cat, nom} — nom vacío = sin ganador todavía
    $u = requireUser(); if (!isAdmin($u)) out(['error' => 'Solo para administradores'], 403);
    $b = body();
    $po = retosTx(function (&$d) use ($b) {
      $id = (string)($b['id'] ?? ''); if (!isset($d['porras'][$id])) return null;
      foreach ($d['porras'][$id]['categorias'] as $k => $c) if ($c['id'] === (string)($b['cat'] ?? '')) {
        $nid = (string)($b['nom'] ?? ''); $ok = $nid === '';
        foreach ($c['nominados'] as $n) if ($n['id'] === $nid) $ok = true;
        if ($ok) $d['porras'][$id]['categorias'][$k]['ganador'] = $nid ?: null;
      }
      return $d['porras'][$id];
    });
    if (!$po) out(['error' => 'Esa porra no existe'], 404);
    out(['ok' => true, 'porra' => porraVista($po, $u, retosData()['alias'], true)]);

  case 'reto_borrar': // POST (admin) {tipo: playlist|porra, id}
    $u = requireUser(); if (!isAdmin($u)) out(['error' => 'Solo para administradores'], 403);
    $b = body(); $k = ($b['tipo'] ?? '') === 'porra' ? 'porras' : 'playlists';
    if (is_file(retosFile())) @copy(retosFile(), retosFile() . '.bak');
    retosTx(function (&$d) use ($b, $k) { unset($d[$k][(string)($b['id'] ?? '')]); });
    out(['ok' => true]);

  case 'reto_alias': // POST (admin) {alias, user} — «mario64» es tal usuario (user vacío = nadie)
    $u = requireUser(); if (!isAdmin($u)) out(['error' => 'Solo para administradores'], 403);
    $b = body(); $a = normAlias($b['alias'] ?? ''); $to = (string)($b['user'] ?? '');
    if ($a === '') out(['error' => 'Falta el apodo'], 400);
    if ($to !== '' && !isset(users()[$to]) && !isPendingId($to)) out(['error' => 'Esa persona no existe'], 400);
    retosTx(function (&$d) use ($a, $to) { if ($to === '') unset($d['alias'][$a]); else $d['alias'][$a] = $to; });
    out(['ok' => true]);

  default:
    out(['error' => 'Acción desconocida'], 404);
}
