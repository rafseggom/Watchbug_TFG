#!/usr/bin/env node
/**
 * One-shot fixture generator (not part of the build or verify pipeline):
 * draws a deterministic 64×64 two-tone canvas in chromium and exports both
 * fixtures with the browser's own encoders.
 *
 *   e2e/fixtures/valid-64x64.png  — PNG via canvas.toBlob('image/png')
 *   e2e/fixtures/valid-64x64.webp — WebP via canvas.toBlob('image/webp')
 *     (chromium encodes WebP natively; the webkit project in `npm run verify`
 *      exercises the runtime fallback path against this same fixture)
 */
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'e2e', 'fixtures');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

const pngBase64 = await page.evaluate(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2f6feb';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(8, 8, 48, 48);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const buf = await blob.arrayBuffer();
  let binary = '';
  new Uint8Array(buf).forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
});

const webpBase64 = await page.evaluate(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2f6feb';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(8, 8, 48, 48);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp'));
  if (blob.type !== 'image/webp') throw new Error(`expected image/webp, got ${blob.type}`);
  const buf = await blob.arrayBuffer();
  let binary = '';
  new Uint8Array(buf).forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
});

await browser.close();

writeFileSync(join(outDir, 'valid-64x64.png'), Buffer.from(pngBase64, 'base64'));
writeFileSync(join(outDir, 'valid-64x64.webp'), Buffer.from(webpBase64, 'base64'));
console.log(`fixtures written to ${outDir}`);
