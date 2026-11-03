#!/usr/bin/env node
/**
 * Watchbug — arnés de UAT manual (fase 3).
 *
 * Qué hace: abre un Chromium *visible* con una página host servida en el ORIGEN
 * DEL PANEL (`http://127.0.0.1:8080/__manual/demo.html`) mediante `page.route`,
 * cargando el bundle real de `packages/sdk/dist/watchbug.js`. Como el documento
 * vive en el mismo origen que `/api`, el widget publica contra el stack de
 * compose sin tocar `WATCHBUG_CORS_ORIGINS` ni el nginx del panel.
 *
 * Por qué `page.route` y no un fichero estático: el `location /` del panel envía
 * `Content-Security-Policy: default-src 'self'` (sin `script-src`/`style-src`
 * inline) y su raíz es la SPA del panel, no una página host. `page.route` es
 * exactamente lo que hace la suite e2e (`e2e/helpers/host-fixtures.ts`).
 *
 * Uso (desde la raíz del repo, con el stack arriba):
 *   docker compose up -d
 *   npm run build -w @watchbug/sdk
 *   node manual-widget.mjs                 # DPR 1
 *   node manual-widget.mjs --dpr=2         # DPR 2 (pixelate HG-02)
 *   node manual-widget.mjs --width=760     # ventana estrecha (word-wrap)
 *
 * No forma parte del runtime: es un fichero de desarrollo, sin build ni tests.
 */

import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import os from 'node:os';

const ROOT = import.meta.dirname;
const DIST = resolve(ROOT, 'packages', 'sdk', 'dist');
const ORIGIN = 'http://127.0.0.1:8080';
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

/** El proyecto key se lee del `.env` en tiempo de ejecución y NUNCA se imprime. */
const envFile = readFileSync(resolve(ROOT, '.env'), 'utf8');
const keyMatch = /^WATCHBUG_PROJECT_KEY=(.+)$/m.exec(envFile);
if (keyMatch === null) {
  throw new Error('.env no tiene WATCHBUG_PROJECT_KEY — copia .env.example y ejecuta npm run key:gen');
}
const PROJECT_KEY = keyMatch[1].trim();
// La forma se valida ANTES de interpolarla en un literal JS (misma regla S-9
// que `e2e/helpers/host-fixtures.ts::projectKey`).
if (!/^wkbt_[0-9A-Za-z]{32}$/.test(PROJECT_KEY)) {
  throw new Error('.env WATCHBUG_PROJECT_KEY no tiene la forma wkbt_<32 base62> — ejecuta npm run key:gen');
}

const BUNDLES = new Map(
  ['watchbug.js', 'watchbug.mjs', 'watchbug-annotator.js', 'watchbug-annotator.mjs', 'watchbug-dom-serialize.js', 'watchbug-dom-serialize.mjs'].map(
    (name) => [name, readFileSync(resolve(DIST, name))],
  ),
);

/** Texto fino (8/10 px) para juzgar visualmente el modo Pixelate. */
const DENSE_LINES = Array.from({ length: 16 }, (_, i) =>
  `<div>${String(i + 1).padStart(2, '0')} · IL1l0O S5B8 gq9w E3c7 Rnm2 Kk4 — 0123456789 · IlÍoÓ0</div>`,
).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Watchbug — host de UAT manual (fase 3)</title>
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
</style>
</head>
<body>
<header>
  <h1>Watchbug — página host de UAT manual (fase 3)</h1>
  <p>Origen del panel (127.0.0.1:8080) vía page.route · bundle real · DPR ${dpr}</p>
</header>
<main>
  <section class="card">
    <h2>1 · Datos que deben quedar enmascarados (SEC-01)</h2>
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
      Informe de ejemplo: al pulsar el lanzador se captura la pestaña. El propio widget se oculta
      durante la captura, así que este texto y los campos de arriba deben aparecer en la imagen.
    </p>
    <ol class="hint">
      <li>Captura: elige esta pestaña en el selector del navegador.</li>
      <li>Para la prueba de foto real, elige otra ventana o la pantalla completa.</li>
      <li>Cancelar el selector simula un fallo de captura (composer degradado).</li>
    </ol>
  </section>
</main>
<script async src="${BUNDLE_PREFIX}watchbug.js" onload="Watchbug.init({ projectKey: '${PROJECT_KEY}' })"></script>
</body>
</html>`;

log(`=== Watchbug UAT manual — DPR ${dpr}, ventana ${width}x${height} ===`);
log(`documento: ${DEMO_URL}`);

// `viewport: null` es OBLIGATORIO para la fidelidad de la captura: con un
// viewport emulado, Playwright impone `innerWidth/innerHeight` distintos del
// tamaño real de la pestaña, y `transformFor()` escala los rects de redacción
// a un frame que no corresponde al viewport (máscaras desplazadas). Con el
// viewport real, innerWidth === frame.width / DPR y la registración es exacta.
// El DPR real se fuerza con `--force-device-scale-factor` (no con emulación).
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

// Prueba de registración: la superficie que captura getDisplayMedia debe ser
// exactamente innerWidth×dpr por innerHeight×dpr. Si no cuadra, las máscaras
// de T1 aterrizarán desplazadas — mejor saberlo aquí que en el blob guardado.
const metrics = await page.evaluate(() => ({
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  dpr: window.devicePixelRatio,
}));
log(
  `[viewport] innerWidth=${metrics.innerWidth} innerHeight=${metrics.innerHeight} dpr=${metrics.dpr}` +
    ` → frame esperado ${metrics.innerWidth * metrics.dpr}x${metrics.innerHeight * metrics.dpr}`,
);

// Pestaña del panel para revisar lo almacenado sin salir del navegador.
const panel = await context.newPage();
panel.on('pageerror', (error) => log(`[panel:error] ${error.message}`));
await panel.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
await page.bringToFront();

log('Listo. Cierra la ventana del navegador (o Ctrl+C) para terminar.');
log(`log de la sesión: ${LOG_PATH}`);

await new Promise((done) => browser.on('disconnected', done));
log('Navegador cerrado.');
