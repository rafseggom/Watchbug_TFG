#!/usr/bin/env node
/**
 * R-01 / RNF-01 / CA-03 size gate — zero dependencies (`node:zlib` only).
 *
 * Four budget tiers over the gzipped IIFE artifacts (the payload a host page
 * actually downloads; the `.mjs` twins are the ESM lane and are printed for
 * visibility but gated on the same bytes):
 *
 *   core    `watchbug.js`           ≤ 45 KB gz  (hard, RNF-01)
 *   lazy    `watchbug-annotator.js` ≤ 25 KB gz  (each lazy chunk)
 *   adapter `watchbug-dom-serialize.js` ≤ 14 KB gz (optional CaptureSource)
 *   runtime core + lazy + adapter   ≤ 80 KB gz  (total runtime payload)
 *
 * A-12 / M-2: the worst case where a host loads EVERY lane is
 * 45 + 25 + 14 = 84 KB, which exceeds the 80 KB runtime tier. That contradiction
 * is printed on every run — the tiers are per-lane ceilings, not a promise
 * that all three fit together, and the owner decides per integration which
 * lanes are loaded.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(repoRoot, 'packages', 'sdk', 'dist');

const KB = 1024;

/** @type {{ name: string, file: string, limitKb: number }[]} */
const LANES = [
  { name: 'core', file: 'watchbug.js', limitKb: 45 },
  { name: 'lazy', file: 'watchbug-annotator.js', limitKb: 25 },
  { name: 'adapter', file: 'watchbug-dom-serialize.js', limitKb: 14 },
];

const RUNTIME_TOTAL_KB = 80;

function gzKb(path) {
  return gzipSync(readFileSync(path)).length / KB;
}

let failures = 0;
const rows = [];

for (const lane of LANES) {
  const path = join(distDir, lane.file);
  let kb;
  try {
    kb = gzKb(path);
  } catch {
    console.error(`SIZE FAIL  ${lane.name.padEnd(7)} ${lane.file}: artifact missing (run "npm run build" first)`);
    failures++;
    continue;
  }
  const within = kb <= lane.limitKb;
  if (!within) failures++;
  rows.push({ ...lane, kb, within });

  // ESM twin, printed for visibility with its gz delta against the IIFE lane.
  const esmFile = lane.file.replace(/\.js$/, '.mjs');
  let esmNote = '';
  try {
    const esmKb = gzKb(join(distDir, esmFile));
    const delta = esmKb - kb;
    esmNote = ` | ${esmFile}: ${esmKb.toFixed(1)} KB gz (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} vs iife)`;
  } catch {
    esmNote = ` | ${esmFile}: missing`;
  }

  console.log(
    `${within ? 'SIZE OK  ' : 'SIZE FAIL'} ${lane.name.padEnd(7)} ${kb.toFixed(1).padStart(6)} KB gz / ${String(lane.limitKb).padStart(2)} KB${esmNote}`,
  );
}

const total = rows.reduce((sum, row) => sum + row.kb, 0);
const totalWithin = total <= RUNTIME_TOTAL_KB;
if (!totalWithin) failures++;
console.log(
  `${totalWithin ? 'SIZE OK  ' : 'SIZE FAIL'} runtime ${total.toFixed(1).padStart(6)} KB gz / ${RUNTIME_TOTAL_KB} KB (core + lazy + adapter)`,
);

console.log('');
console.log('WORST CASE (all lanes loaded): 45 + 25 + 14 = 84 KB > 80 KB runtime tier (A-12 / M-2)');
console.log('  The per-lane ceilings do not sum under the runtime budget. Every integration');
console.log('  must choose lanes; loading core + lazy is 70 KB and stays inside 80 KB.');

if (failures > 0) {
  console.error(`\ncheck:size FAILED (${failures} breach${failures === 1 ? '' : 'es'})`);
  process.exit(1);
}
console.log('\ncheck:size PASSED');
