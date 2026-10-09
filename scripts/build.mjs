/**
 * Build combinado para Cloudflare Pages.
 *
 * Salida: ./dist
 *   /                  → landing (site/index.html)
 *   /en/               → landing EN (site/en/index.html)
 *   /aviso-legal/ ...  → páginas legales ES
 *   /en/legal-notice/ …→ páginas legales EN
 *   /roadmap/          → tablero interactivo (site/roadmap)
 *   /docs, /en/docs    → Docusaurus (desde docs/)
 *
 * Orden: primero Docusaurus (genera assets, /docs, sitemap), luego la landing
 * sobreescribe sus homepages (/ y /en/) que ahora son la landing.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '..');
const docsDir = path.join(repo, 'docs');
const siteDir = path.join(repo, 'site');
const distDir = path.join(repo, 'dist');

const SITE_URL = 'https://www.watchbugus.com';

// 1. Dependencias de Docusaurus si faltan (Cloudflare no instala docs/ por sí solo)
if (!existsSync(path.join(docsDir, 'node_modules'))) {
  console.log('[build] npm ci en docs/ ...');
  execFileSync('npm', ['ci'], { cwd: docsDir, stdio: 'inherit' });
}

// 2. Limpiar salida
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

// 3. Docusaurus → dist/
console.log('[build] docusaurus build ...');
execFileSync('npx', ['docusaurus', 'build', '--out-dir', '../dist'], {
  cwd: docsDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

// 4. Landing → dist/ (pisa las homepages de Docusaurus: / y /en/)
console.log('[build] copiando landing (site/) ...');
cpSync(siteDir, distDir, { recursive: true });

// 5. 404 propio de la landing (pisa el de Docusaurus)
const notFound = path.join(siteDir, '404.html');
if (existsSync(notFound)) cpSync(notFound, path.join(distDir, '404.html'));

// 6. Completar el sitemap de Docusaurus con las páginas de la landing
const landingRoutes = [
  '/',
  '/en/',
  '/roadmap/',
  '/aviso-legal/',
  '/privacidad/',
  '/cookies/',
  '/en/legal-notice/',
  '/en/privacy/',
  '/en/cookies/',
];
const sitemapPath = path.join(distDir, 'sitemap.xml');
if (existsSync(sitemapPath)) {
  let xml = readFileSync(sitemapPath, 'utf8');
  const existing = xml;
  const extra = landingRoutes
    .filter((route) => !existing.includes(`<loc>${SITE_URL}${route}</loc>`))
    .map((route) => `  <url><loc>${SITE_URL}${route}</loc></url>`)
    .join('\n');
  if (extra) xml = xml.replace('</urlset>', `${extra}\n</urlset>`);
  writeFileSync(sitemapPath, xml);
} else {
  writeFileSync(
    sitemapPath,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      landingRoutes.map((r) => `  <url><loc>${SITE_URL}${r}</loc></url>`).join('\n') +
      `\n</urlset>\n`
  );
}

// 7. robots.txt
writeFileSync(
  path.join(distDir, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
);

console.log('[build] OK → dist/');
