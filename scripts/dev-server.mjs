/**
 * Servidor de previsualización fiel a Cloudflare Pages.
 *
 * Sirve `site/` tal cual, con la misma regla que usa Pages en producción: cualquier
 * ruta desconocida devuelve `site/404.html` con estado 404, en lugar del error
 * crudo del servidor. Así lo que ves en local es lo que verá quien entre a la web.
 *
 * Uso:
 *   node scripts/dev-server.mjs [puerto]
 *
 * Nota: /docs y /en/docs los genera Docusaurus y solo existen en la build
 * combinada (`node scripts/build.mjs`). En este servidor caen en la 404.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '..');
const siteDir = path.join(repo, 'site');
const notFoundPage = path.join(siteDir, '404.html');
const port = Number(process.argv[2] || process.env.PORT || 8642);

const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** Resuelve una ruta de URL a un fichero dentro de site/, o null si no existe. */
function resolver(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }

  const relativo = path.normalize(decoded).replace(/^([/\\])+/, '');
  const destino = path.join(siteDir, relativo);

  // Nunca salir de site/
  if (!destino.startsWith(siteDir)) return null;

  if (existsSync(destino)) {
    const info = statSync(destino);
    if (info.isDirectory()) {
      const indice = path.join(destino, 'index.html');
      return existsSync(indice) ? indice : null;
    }
    return destino;
  }

  // /algo -> /algo.html
  if (existsSync(`${destino}.html`)) return `${destino}.html`;

  return null;
}

function enviar(res, fichero, estado) {
  res.writeHead(estado, {
    'Content-Type': tipos[path.extname(fichero)] || 'application/octet-stream',
    // Servidor de desarrollo: nunca cachear, para que cada recarga vea el disco.
    'Cache-Control': 'no-store, must-revalidate',
  });
  createReadStream(fichero).pipe(res);
}

createServer((req, res) => {
  const fichero = resolver(req.url || '/');

  if (fichero) {
    enviar(res, fichero, 200);
    console.log(`200 ${req.url}`);
    return;
  }

  if (existsSync(notFoundPage)) {
    enviar(res, notFoundPage, 404);
    console.log(`404 ${req.url} (→ 404.html)`);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 — falta site/404.html');
  console.log(`404 ${req.url} (sin 404.html)`);
}).listen(port, () => {
  console.log(`[dev] previsualizando ${siteDir}`);
  console.log(`[dev] http://localhost:${port}/  (las rutas desconocidas sirven 404.html)`);
});
