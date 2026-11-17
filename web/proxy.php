<?php
/*
 * GameVault · proxy para la versión web / iPhone
 * ────────────────────────────────────────────────────────────────────────────
 * Safari (y cualquier navegador) no deja que la app llame directamente a
 * HowLongToBeat o VGChartz (CORS). Este fichero, junto a la app en tu servidor,
 * hace la petición por ella. Sólo permite estos dominios, sólo HTTPS.
 * Requiere PHP con la extensión curl (XAMPP la trae activada).
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$PERMITIDOS = ['howlongtobeat.com', 'www.vgchartz.com', 'es.wikipedia.org', 'api.rawg.io'];
$extra = getenv('GV_PROXY_TEST_HOST');            // sólo para pruebas automáticas
if ($extra) $PERMITIDOS[] = $extra;

if (isset($_GET['ping'])) { echo json_encode(['gamevault' => true, 'curl' => function_exists('curl_init')]); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Método no permitido']); exit; }

$raw = file_get_contents('php://input', false, null, 0, 200000);
$req = json_decode($raw, true);
if (!is_array($req) || empty($req['url'])) { http_response_code(400); echo json_encode(['error' => 'Petición no válida']); exit; }

$u = parse_url($req['url']);
$esquemaOk = ($u['scheme'] ?? '') === 'https' || ($extra && ($u['host'] ?? '') === $extra);
if (!$esquemaOk || !in_array($u['host'] ?? '', $PERMITIDOS, true)) {
  http_response_code(403); echo json_encode(['error' => 'Dominio no permitido: ' . ($u['host'] ?? '?')]); exit;
}
$metodo = strtoupper($req['method'] ?? 'GET');
if (!in_array($metodo, ['GET', 'POST'], true)) { http_response_code(400); echo json_encode(['error' => 'Método no permitido']); exit; }

// Cabeceras que se reenvían (las demás se ignoran)
$CAB_OK = ['user-agent', 'accept', 'accept-language', 'content-type', 'origin', 'referer', 'x-auth-token', 'x-hp-key', 'x-hp-val'];
$cabeceras = [];
foreach (($req['headers'] ?? []) as $k => $v) {
  if (in_array(strtolower($k), $CAB_OK, true) && is_scalar($v)) $cabeceras[] = $k . ': ' . str_replace(["\r", "\n"], '', (string)$v);
}

// Certificados raíz: los de XAMPP si curl/openssl no los tienen configurados
function caBundle() {
  foreach ([ini_get('curl.cainfo'), ini_get('openssl.cafile'), __DIR__ . '/cacert.pem', dirname(PHP_BINARY) . '/extras/ssl/cacert.pem',
            'C:/xampp/php/extras/ssl/cacert.pem', 'C:/xampp/apache/bin/curl-ca-bundle.crt'] as $p) if ($p && @is_file($p)) return $p;
  return null;
}
$ca = caBundle();
if (function_exists('curl_init')) {
  $ch = curl_init($req['url']);
  $opt = [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 3,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_TIMEOUT        => 25,
    CURLOPT_HTTPHEADER     => $cabeceras,
    CURLOPT_ENCODING       => '',                       // acepta gzip
    CURLOPT_PROTOCOLS      => CURLPROTO_HTTPS | ($extra ? CURLPROTO_HTTP : 0),
  ];
  if ($ca) $opt[CURLOPT_CAINFO] = $ca;
  curl_setopt_array($ch, $opt);
  if ($metodo === 'POST') { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, (string)($req['body'] ?? '')); }
  $texto = curl_exec($ch);
  if ($texto === false) { $err = curl_error($ch); curl_close($ch); echo json_encode(['error' => 'Sin conexión: ' . $err]); exit; }
  $estado = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  curl_close($ch);
} else {
  // PHP sin la extensión curl (lo normal en XAMPP si no se activa en php.ini): se usa file_get_contents
  $http = ['method' => $metodo, 'timeout' => 25, 'ignore_errors' => true, 'follow_location' => 1, 'max_redirects' => 3,
           'header' => implode("\r\n", $cabeceras) . "\r\n", 'protocol_version' => 1.1];
  $http['header'] .= "Connection: close\r\n";
  if ($metodo === 'POST') $http['content'] = (string)($req['body'] ?? '');
  $texto = @file_get_contents($req['url'], false, stream_context_create(['http' => $http, 'ssl' => $ca ? ['cafile' => $ca] : []]));
  if ($texto === false) { echo json_encode(['error' => 'Sin conexión: ' . (error_get_last()['message'] ?? 'la petición falló')]); exit; }
  $estado = 0;
  // con redirecciones hay varias líneas de estado: vale la última
  foreach (($http_response_header ?? []) as $h) if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $estado = (int)$m[1];
  // si el servidor mandó gzip aunque no se pidió
  foreach (($http_response_header ?? []) as $h) if (stripos($h, 'Content-Encoding: gzip') === 0 && function_exists('gzdecode')) { $d = @gzdecode($texto); if ($d !== false) $texto = $d; }
}
if (strlen($texto) > 3000000) $texto = substr($texto, 0, 3000000);
echo json_encode(['status' => $estado, 'text' => $texto], JSON_INVALID_UTF8_SUBSTITUTE);
