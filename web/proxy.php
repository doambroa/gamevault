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

$ch = curl_init($req['url']);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_MAXREDIRS      => 3,
  CURLOPT_CONNECTTIMEOUT => 15,
  CURLOPT_TIMEOUT        => 25,
  CURLOPT_HTTPHEADER     => $cabeceras,
  CURLOPT_ENCODING       => '',                       // acepta gzip
  CURLOPT_PROTOCOLS      => CURLPROTO_HTTPS | ($extra ? CURLPROTO_HTTP : 0),
]);
if ($metodo === 'POST') { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, (string)($req['body'] ?? '')); }
$texto = curl_exec($ch);
if ($texto === false) { $err = curl_error($ch); curl_close($ch); echo json_encode(['error' => 'Sin conexión: ' . $err]); exit; }
$estado = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);
if (strlen($texto) > 3000000) $texto = substr($texto, 0, 3000000);
echo json_encode(['status' => $estado, 'text' => $texto], JSON_INVALID_UTF8_SUBSTITUTE);
