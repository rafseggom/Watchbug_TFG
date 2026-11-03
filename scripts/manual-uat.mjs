#!/usr/bin/env node
/**
 * Watchbug — one-command manual UAT harness.
 *
 * Opens a visible Chromium with a host page served at the PANEL ORIGIN
 * (`http://127.0.0.1:8080/__manual/demo.html`) through `page.route`, loading
 * the real `packages/sdk/dist/watchbug.js` bundle. Because the document lives
 * on the same origin as `/api`, the widget files reports against the compose
 * stack without touching `WATCHBUG_CORS_ORIGINS` or nginx.
 *
 * What it does before opening the browser:
 *   1. validates `.env` has a real `wkbt_…` project key (never printed);
 *   2. rebuilds `contracts` + `sdk` when a source file is newer than the
 *      shipped bundle (or the bundle is missing);
 *   3. starts `docker compose up -d` when the stack is not already healthy.
 *
 * Usage (from the repo root):
 *   npm run uat                    # DPR 1, 1280x860 window
 *   npm run uat -- --dpr=2         # DPR 2 (pixelation HG-02)
 *   npm run uat -- --width=760     # narrow window (word-wrap)
 *   npm run uat -- --no-build      # skip the freshness check
 *   npm run uat -- --no-stack      # never start compose
 *   npm run uat -- --dry-run       # preflight only, no browser
 *
 * This is a development harness: no build step of its own, no tests.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import os from 'node:os';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = resolve(ROOT, 'packages', 'sdk', 'dist');
const ORIGIN = 'http://127.0.0.1:8080';
const HEALTH = `${ORIGIN}/api/health`;
const DEMO_URL = `${ORIGIN}/__manual/demo.html`;
const BUNDLE_PREFIX = '/__manual/bundles/';

const LOG_PATH = resolve(os.tmpdir(), 'watchbug-uat.log');
mkdirSync(dirname(LOG_PATH), { recursive: true });
const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  writeFileSync(LOG_PATH, `${stamped}\n`, { flag: 'a' });
};

const args = new Map(
  process.argv.slice(2).map((raw) => {
    const [key, value = 'true'] = raw.replace(/^--/, '').split('=');
    return [key, value];
  }),
);
const dpr = Number(args.get('dpr') ?? 1);
const width = Number(args.get('width') ?? 1280);
const height = Number(args.get('height') ?? 860);
const shouldBuild = !args.has('no-build');
const mayStartStack = !args.has('no-stack');

const run = (command) => {
  log(`$ ${command}`);
  const result = spawnSync(command, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) throw new Error(`command failed (${result.status}): ${command}`);
};

/** The project key is read at runtime and NEVER printed. */
const envFile = existsSync(resolve(ROOT, '.env')) ? readFileSync(resolve(ROOT, '.env'), 'utf8') : '';
const keyMatch = /^WATCHBUG_PROJECT_KEY=(.+)$/m.exec(envFile);
if (keyMatch === null) {
  throw new Error('.env has no WATCHBUG_PROJECT_KEY — cp .env.example .env && npm run key:gen');
}
const PROJECT_KEY = keyMatch[1].trim();
// Validate the shape BEFORE interpolating it into a JS literal (S-9).
if (!/^wkbt_[0-9A-Za-z]{32}$/.test(PROJECT_KEY)) {
  throw new Error('.env WATCHBUG_PROJECT_KEY is not wkbt_<32 base62> — run npm run key:gen');
}

/** Newest mtime under a directory, or 0 when it does not exist. */
function newestMtime(dir) {
  let newest = 0;
  if (!existsSync(dir)) return newest;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = resolve(dir, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, newestMtime(absolute));
    else if (['.ts', '.tsx', '.mjs', '.json'].includes(extname(entry.name))) {
      newest = Math.max(newest, statSync(absolute).mtimeMs);
    }
  }
  return newest;
}

const requiredBundles = [
  'watchbug.js',
  'watchbug.mjs',
  'watchbug-annotator.js',
  'watchbug-annotator.mjs',
];
const bundleMissing = requiredBundles.some((name) => !existsSync(resolve(DIST, name)));
const sourceChanged =
  !bundleMissing &&
  Math.max(
    newestMtime(resolve(ROOT, 'packages', 'sdk', 'src')),
    newestMtime(resolve(ROOT, 'packages', 'contracts', 'src')),
  ) > Math.min(...requiredBundles.map((name) => statSync(resolve(DIST, name)).mtimeMs));

if (shouldBuild && (bundleMissing || sourceChanged)) {
  log(bundleMissing ? 'SDK bundle missing — building…' : 'SDK source is newer than the bundle — rebuilding…');
  run('npm run build -w @watchbug/contracts && npm run build -w @watchbug/sdk');
}

async function healthy() {
  try {
    const response = await fetch(HEALTH);
    if (!response.ok) return false;
    const body = await response.json();
    return body?.status === 'ok';
  } catch {
    return false;
  }
}

async function waitForStack(seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (await healthy()) return true;
    await new Promise((done) => setTimeout(done, 1000));
  }
  return false;
}

if (!(await healthy())) {
  if (!mayStartStack) {
    throw new Error(`stack is not healthy at ${HEALTH} — run "docker compose up -d --build"`);
  }
  log('stack is not healthy — starting docker compose…');
  run('docker compose up -d');
  if (!(await waitForStack(90))) {
    throw new Error(
      `stack never became healthy at ${HEALTH} — run "docker compose up -d --build" and check "docker compose logs"`,
    );
  }
} else {
  log('stack is healthy.');
}

if (args.has('dry-run')) {
  log('dry-run: preflight OK — .env key, SDK bundle and stack are ready; browser not launched.');
  process.exitCode = 0;
} else {
const BUNDLES = new Map(
  [
    'watchbug.js',
    'watchbug.mjs',
    'watchbug-annotator.js',
    'watchbug-annotator.mjs',
    'watchbug-dom-serialize.js',
    'watchbug-dom-serialize.mjs',
  ].map((name) => [name, readFileSync(resolve(DIST, name))]),
);

/** Fine text (8/10 px) for judging Pixelate visually. */
const DENSE_LINES = Array.from({ length: 16 }, (_, i) =>
  `<div>${String(i + 1).padStart(2, '0')} · IL1l0O S5B8 gq9w E3c7 Rnm2 Kk4 — 0123456789 · IlÍoÓ0</div>`,
).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Watchbug — host de UAT manual</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; background: #f5f6f8; color: #16181d; }
  header { background: #111827; color: #fff; padding: 16px 24px; }
  header h1 { margin: 0; font-size: 18px; font-weight: 700; }
  header p { margin: 6px 0 0; font-size: 12px; opacity: .8; }
  main { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; padding: 20px 24px 40px; }
  .card { background: #fff; border: 1px solid #dfe3ea; border-radius: 10px; padding: 14px 16px; }
  .card h2 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #475569; }
  label { display: block; margin: 10px 0 4px; font-size: 11px; font-weight: 700; color: #475569; }
  input { width: 100%; padding: 7px 9px; font-size: 13px; border: 1px solid #b8c0cc; border-radius: 6px; }
  .mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; }
  #sensitive { margin-top: 10px; padding: 9px 10px; background: #fff3cd; border: 1px dashed #c9a227; border-radius: 6px; font: 700 12px ui-monospace, Consolas, monospace; }
  .tiny { font-family: ui-monospace, Consolas, monospace; font-size: 8px; line-height: 1.45; letter-spacing: .2px; white-space: nowrap; }
  .hint { margin: 10px 0 0; font-size: 11px; color: #64748b; line-height: 1.5; }
  ol.hint { padding-left: 16px; }
  ol.checklist { padding-left: 18px; font-size: 12px; line-height: 1.7; color: #334155; }
  code { background: #eef2f7; padding: 1px 4px; border-radius: 4px; }
</style>
</head>
<body>
<header>
  <h1>Watchbug — página host de UAT manual</h1>
  <p>Origen del panel (127.0.0.1:8080) vía page.route · bundle real · DPR ${dpr}</p>
</header>
<main>
  <section class="card">
    <h2>Checklist de la sesión</h2>
    <ol class="checklist">
      <li>El lanzador flotante aparece abajo a la derecha.</li>
      <li>Pulsa el lanzador → el compositor muestra la captura y este formulario.</li>
      <li>Pulsa <b>Anotar imagen</b> y dibuja un trazo, una forma y una etiqueta.</li>
      <li>Usa la herramienta <b>Máscara</b> sobre un secreto y confirma.</li>
      <li><b>Review report</b> → revisa la vista previa → <b>Send report</b>.</li>
      <li>La pestaña del panel debe listar el informe y su captura.</li>
    </ol>
    <h2 style="margin-top:16px">1 · Datos que deben quedar enmascarados (SEC-01)</h2>
    <label for="pwd">input[type=password]</label>
    <input id="pwd" type="password" value="Sup3rSecret-2026" />
    <label for="card">Tarjeta con Luhn válido</label>
    <input id="card" type="text" value="4111 1111 1111 1111" />
    <label for="assign">Asignación de credencial</label>
    <input id="assign" type="text" value="api_token=abcd1234efgh5678" />
    <label for="jwt">Forma JWT</label>
    <input id="jwt" type="text" value="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlLWRlbW8" />
    <p class="hint">Nodo de texto con esquema de autorización:</p>
    <p class="mono" style="margin:4px 0 0">Authorization: Bearer sk-live-9f8e7d6c5b4a3210</p>
    <div id="sensitive" data-watchbug-sensitive>MARCA-SENSIBLE: NO DEBE APARECER EN LA CAPTURA</div>
  </section>
  <section class="card">
    <h2>2 · Texto fino (juicio visual del modo Pixelate)</h2>
    <div class="tiny">
${DENSE_LINES}
    </div>
    <h2 style="margin-top:16px">3 · Texto normal</h2>
    <p class="hint" style="font-size:12px;color:#334155">
      Al pulsar el lanzador se captura la pestaña. El propio widget se oculta
      durante la captura, así que este texto y los campos de arriba deben
      aparecer en la imagen.
    </p>
    <ol class="hint">
      <li>Captura: elige esta pestaña en el selector del navegador.</li>
      <li>Para la prueba de foto real, elige otra ventana o la pantalla completa.</li>
      <li>Cancelar el selector simula un fallo de captura (composer degradado).</li>
    </ol>
    <p class="hint">Panel: <a href="${ORIGIN}" target="_blank" rel="noreferrer">${ORIGIN}</a></p>
  </section>
</main>
<script async src="${BUNDLE_PREFIX}watchbug.js" onload="Watchbug.init({ projectKey: '${PROJECT_KEY}' })"></script>
</body>
</html>`;

log(`=== Watchbug UAT manual — DPR ${dpr}, ventana ${width}x${height} ===`);
log(`documento: ${DEMO_URL}`);

// Load Playwright only when the browser is actually going to open: `--dry-run`
// must not pay the driver startup cost (and exits cleanly before it).
const { chromium } = await import('@playwright/test');

// `viewport: null` is MANDATORY for capture fidelity: an emulated viewport
// makes innerWidth/innerHeight differ from the real tab size, and
// `transformFor()` then scales the redaction rects to a frame that does not
// match the viewport (shifted masks). The real DPR is forced with
// `--force-device-scale-factor`, never with emulation.
const browser = await chromium.launch({
  headless: false,
  args: [
    `--window-size=${width},${height}`,
    ...(dpr === 1 ? [] : [`--force-device-scale-factor=${dpr}`]),
  ],
});
const context = await browser.newContext({ viewport: null });
const page = await context.newPage();

await page.route('**/__manual/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/__manual/demo.html') {
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    return;
  }
  const name = path.startsWith(BUNDLE_PREFIX) ? path.slice(BUNDLE_PREFIX.length) : undefined;
  const bytes = name === undefined ? undefined : BUNDLES.get(name);
  if (bytes === undefined) {
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'bundle desconocido' });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: bytes });
});

page.on('console', (message) => log(`[page:${message.type()}] ${message.text()}`));
page.on('pageerror', (error) => log(`[page:error] ${error.message}`));

page.on('request', (request) => {
  const url = new URL(request.url());
  if (url.pathname.startsWith('/api/')) log(`[req] ${request.method()} ${url.pathname}`);
});
page.on('response', async (response) => {
  const url = new URL(response.url());
  if (!url.pathname.startsWith('/api/')) return;
  let body = '';
  try {
    body = (await response.text()).slice(0, 400);
  } catch {
    body = '<sin cuerpo>';
  }
  log(`[res] ${response.status()} ${response.request().method()} ${url.pathname} ${body}`);
});

await page.goto(DEMO_URL, { waitUntil: 'load' });

// Registration probe: the surface getDisplayMedia captures must be exactly
// innerWidth×dpr by innerHeight×dpr. If it is not, the T1 masks will land
// shifted — better to know here than in the stored blob.
const metrics = await page.evaluate(() => ({
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  dpr: window.devicePixelRatio,
}));
log(
  `[viewport] innerWidth=${metrics.innerWidth} innerHeight=${metrics.innerHeight} dpr=${metrics.dpr}` +
    ` → frame esperado ${metrics.innerWidth * metrics.dpr}x${metrics.innerHeight * metrics.dpr}`,
);

// Panel tab for reviewing what was stored without leaving the browser.
const panel = await context.newPage();
panel.on('pageerror', (error) => log(`[panel:error] ${error.message}`));
await panel.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
await page.bringToFront();

log('Listo. Sigue el checklist de la página y cierra la ventana (o Ctrl+C) al terminar.');
log(`log de la sesión: ${LOG_PATH}`);

await new Promise((done) => browser.on('disconnected', done));
log('Navegador cerrado.');
}
