<?php
/**
 * Backend de VALIDACAO DE PALAVRAS-CHAVE — MediaGrowth.
 * Guarda o estado por SLUG num JSON (data/<slug>.json), com trava de arquivo.
 * A pagina (GitHub Pages) le o seed dela e sincroniza o estado vivo aqui.
 *
 * Endpoints:
 *   GET  api.php?action=get&slug=<slug>
 *   POST api.php  action=decide     slug kw status note by   -> aprova/reprova/limpa 1 palavra
 *   POST api.php  action=suggest    slug text note by        -> adiciona sugestao do cliente
 *   POST api.php  action=delsuggest slug id                  -> remove uma sugestao
 *   POST api.php  action=reviewer   slug by                  -> grava quem esta avaliando
 *
 * Sem login (pagina de validacao publica por slug). CORS liberado (roda no GitHub Pages).
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$DATA = __DIR__ . '/data';
if (!is_dir($DATA)) { @mkdir($DATA, 0775, true); }

function bad($msg) { http_response_code(400); echo json_encode(['erro' => $msg]); exit; }
function slug_ok($s) { return is_string($s) && preg_match('/^[a-z0-9\-]{1,64}$/', $s); }
function clip($s, $n) { $s = is_string($s) ? $s : ''; return mb_substr(trim($s), 0, $n); }

$slug = $_REQUEST['slug'] ?? '';
if (!slug_ok($slug)) bad('slug invalido');
$file = "$DATA/$slug.json";

function fresh() { return ['decisions' => new stdClass(), 'suggestions' => [], 'reviewer' => '']; }

function load_state($file) {
  if (!file_exists($file)) return fresh();
  $j = json_decode(file_get_contents($file), true);
  if (!is_array($j)) return fresh();
  if (!isset($j['decisions']))   $j['decisions']   = new stdClass();
  if (!isset($j['suggestions']) || !is_array($j['suggestions'])) $j['suggestions'] = [];
  if (!isset($j['reviewer']))    $j['reviewer']    = '';
  return $j;
}

$action = $_REQUEST['action'] ?? 'get';

if ($action === 'get') {
  echo json_encode(load_state($file), JSON_UNESCAPED_UNICODE);
  exit;
}

/* ---- escrita: trava exclusiva ---- */
$fp = fopen($file, 'c+');
if (!$fp) bad('io');
flock($fp, LOCK_EX);
$st = json_decode(stream_get_contents($fp), true);
if (!is_array($st)) $st = ['decisions' => [], 'suggestions' => [], 'reviewer' => ''];
if (!isset($st['decisions'])   || !is_array($st['decisions']))   $st['decisions'] = [];
if (!isset($st['suggestions']) || !is_array($st['suggestions'])) $st['suggestions'] = [];
if (!isset($st['reviewer']))   $st['reviewer'] = '';

function commit($fp, $st) {
  ftruncate($fp, 0); rewind($fp);
  fwrite($fp, json_encode($st, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
  fflush($fp);
  flock($fp, LOCK_UN); fclose($fp);
  echo json_encode($st, JSON_UNESCAPED_UNICODE);
  exit;
}
function abort_lock($fp, $msg) { flock($fp, LOCK_UN); fclose($fp); bad($msg); }

if ($action === 'decide') {
  $kw     = clip($_POST['kw'] ?? '', 160);
  $status = clip($_POST['status'] ?? '', 12);   // approved | rejected | pending
  $note   = clip($_POST['note'] ?? '', 1200);
  $by     = clip($_POST['by'] ?? '', 80);
  if ($kw === '') abort_lock($fp, 'kw vazio');
  if (!in_array($status, ['approved', 'rejected', 'pending'], true)) abort_lock($fp, 'status invalido');
  if ($by !== '') $st['reviewer'] = $by;

  if ($status === 'pending' && $note === '') {
    unset($st['decisions'][$kw]);
  } else {
    $st['decisions'][$kw] = ['status' => $status, 'note' => $note, 'by' => $by, 'at' => date('c')];
  }
  commit($fp, $st);
}

if ($action === 'suggest') {
  $text = clip($_POST['text'] ?? '', 160);
  $note = clip($_POST['note'] ?? '', 1200);
  $by   = clip($_POST['by'] ?? '', 80);
  if ($text === '') abort_lock($fp, 'texto vazio');
  if ($by !== '') $st['reviewer'] = $by;
  $st['suggestions'][] = ['id' => uniqid('s'), 'text' => $text, 'note' => $note, 'by' => $by, 'at' => date('c')];
  commit($fp, $st);
}

if ($action === 'delsuggest') {
  $id = clip($_POST['id'] ?? '', 32);
  if ($id === '') abort_lock($fp, 'id vazio');
  $st['suggestions'] = array_values(array_filter($st['suggestions'], function ($s) use ($id) {
    return ($s['id'] ?? '') !== $id;
  }));
  commit($fp, $st);
}

if ($action === 'reviewer') {
  $by = clip($_POST['by'] ?? '', 80);
  $st['reviewer'] = $by;
  commit($fp, $st);
}

abort_lock($fp, 'action invalida');
