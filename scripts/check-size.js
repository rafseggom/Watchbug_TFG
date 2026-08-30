#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const LIMIT_BYTES = 45 * 1024; // 46080

function findBundle() {
  // Try project-root relative paths
  const candidates = [
    resolve(process.cwd(), 'sdk/dist/watchbug.js'),
    resolve(process.cwd(), 'dist/watchbug.js'),
    resolve(process.cwd(), '../sdk/dist/watchbug.js'),
  ];
  // Also try relative to this script's location
  try {
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(scriptDir, '../sdk/dist/watchbug.js'));
    candidates.push(resolve(scriptDir, '../dist/watchbug.js'));
  } catch {}
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

export function checkBundleSize(bundlePath) {
  const p = bundlePath ?? findBundle();
  if (!existsSync(p)) {
    console.error(`[check:size] Bundle not found: ${p}`);
    console.error('[check:size] Run `npm run build` first.');
    return { ok: false, error: 'not_found', path: p };
  }
  const raw = readFileSync(p);
  const gzipped = gzipSync(raw);
  const rawKB = (raw.length / 1024).toFixed(2);
  const gzipKB = (gzipped.length / 1024).toFixed(2);
  const limitKB = (LIMIT_BYTES / 1024).toFixed(2);
  console.log(`[check:size] Bundle: ${p}`);
  console.log(`[check:size] Raw size: ${raw.length} bytes (${rawKB} KB)`);
  console.log(`[check:size] Gzipped size: ${gzipped.length} bytes (${gzipKB} KB)`);
  console.log(`[check:size] Limit: ${LIMIT_BYTES} bytes (${limitKB} KB)`);
  if (gzipped.length > LIMIT_BYTES) {
    console.error(`[check:size] FAIL — gzipped bundle ${gzipped.length} bytes exceeds ${LIMIT_BYTES} bytes (45KB) by ${gzipped.length - LIMIT_BYTES} bytes`);
    return { ok: false, raw: raw.length, gzipped: gzipped.length, limit: LIMIT_BYTES, path: p };
  }
  console.log(`[check:size] PASS — gzipped bundle is within 45KB limit`);
  return { ok: true, raw: raw.length, gzipped: gzipped.length, limit: LIMIT_BYTES, path: p };
}

const result = checkBundleSize();
if (!result.ok) process.exit(1);
