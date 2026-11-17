<?php
// GameVault — cuentas, sincronización y comunidad. Pensado para XAMPP (PHP 7.4+), sin base de datos:
// todo se guarda en ficheros JSON dentro de data/ (bloqueada desde el navegador).
//
// Cuentas:   ping, me, register, login, logout, password, profile
// Colección: collection (la mía), save (subir), upload (fotos propias)
// Comunidad: users, view (colección de otra persona, solo lectura), loans (zona de préstamos)
// Créditos Finales: creditos (juegos terminados de un usuario, si la app está instalada al lado)
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
function pendings() { global $DIR; return readJson("$DIR/pending.json", []); }
function isPendingId($u) { return is_string($u) && preg_match('/^~[a-z0-9-]{2,40}$/', $u) && isset(pendings()[$u]); }
function isAdmin($u) { global $cfg; return $u && in_array($u, (array)($cfg['admins'] ?? ['soiber']), true); }

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
    $res[] = ['id' => $id, 'display' => $p['display'] ?? $id] + counts($c ?: []);
  }
  return $res;
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
      $res[] = ['t' => $g['title'], 'y' => (int)$year, 'e' => 'terminado', 'r' => $g['rating'] ?? null, 'h' => $g['hours'] ?? null,
        'd' => $g['date'] ?? null, 'x' => !empty($g['replayed']), 'c' => $g['comment'] ?? '', 's' => $g['song']['title'] ?? null];
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
    $pub = function ($n) use ($all, $prof) { return isset($all[$n]) ? publicUser($n, $all[$n], $prof) : ['user' => $n, 'display' => $n]; };
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
    if (isPendingId($to)) out(['error' => 'Todavía no tiene cuenta en GameVault: pídeselo por otro lado'], 400);
    if (!isset(users()[$to])) out(['error' => 'Esa persona no existe'], 404);
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
    out($res);

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
    out(['id' => $id, 'display' => $p['display'] ?? $id] + counts($c ?: []));

  case 'claim':     // POST {id, code}: la colección del perfil pasa a ser mía (se suma a la que tenga)
    $u = requireUser(); $b = body();
    $id = (string)($b['id'] ?? ''); if ($id !== '' && $id[0] !== '~') $id = '~' . $id;
    $all = pendings();
    if (!isset($all[$id])) out(['error' => 'Este perfil ya se ha reclamado o no existe'], 404);
    $p = $all[$id];
    if (($p['suggest'] ?? null) !== $u && !hash_equals((string)($p['code'] ?? ''), (string)($b['code'] ?? ''))) { sleep(1); out(['error' => 'El enlace no es válido'], 403); }
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
    @rename(collFile($id), collFile($id) . '.reclamado-por-' . $u);
    out(['ok' => true, 'rev' => $rev] + counts(['data' => $merged]));

  default:
    out(['error' => 'Acción desconocida'], 404);
}
