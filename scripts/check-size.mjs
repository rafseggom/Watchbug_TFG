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

/** @type {{ name: string, file: string, limitKb: number, floorKb?: number }[]} */
const LANES = [
  { name: 'core', file: 'watchbug.js', limitKb: 45 },
  // The lazy lane gates the MAX of its `.js`/`.mjs` twins (research OQ-5):
  // the loader fetches the `.mjs`, so that is the artifact users download, and
  // gating the max means neither twin can silently drift. The floor is the
  // ANTI-INLINE guard (Pitfall 1): a chunk that shrank to an empty shell means
  // esbuild folded the editor into the core bundle — a green 25 KB ceiling
  // would then pass vacuously. BOTH twins must clear it (a collapsed twin is
  // exactly the drift the max-gate exists to catch).
  { name: 'lazy', file: 'watchbug-annotator.js', limitKb: 25, floorKb: 2 },
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
  const esmFile = lane.file.replace(/\.js$/, '.mjs');
  let esmKb;
  try {
    esmKb = gzKb(join(distDir, esmFile));
  } catch {
    esmKb = null;
  }

  // A floored lane gates on the max of the twins; others gate the IIFE and
  // print the ESM twin as a delta, as before.
  const gated = lane.floorKb !== undefined && esmKb !== null ? Math.max(kb, esmKb) : kb;
  const within = gated <= lane.limitKb;
  let floorNote = '';
  let floorOk = true;
  if (lane.floorKb !== undefined) {
    if (esmKb === null) {
      floorOk = false; // a missing ESM twin of a gated lane is a breach, not a shrug
    } else {
      const minTwin = Math.min(kb, esmKb);
      floorOk = minTwin >= lane.floorKb;
      floorNote = ` | floor >= ${lane.floorKb} KB: ${floorOk ? 'OK' : 'FAIL'} (min twin ${minTwin.toFixed(1)} KB gz)`;
    }
  }
  if (!within || !floorOk) failures++;

  const delta = esmKb === null ? NaN : esmKb - kb;
  const esmNote =
    esmKb === null
      ? ` | ${esmFile}: missing`
      : ` | ${esmFile}: ${esmKb.toFixed(1)} KB gz (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} vs iife)`;
  const gateLabel = lane.floorKb !== undefined ? `${gated.toFixed(1)}` : kb.toFixed(1);
  console.log(
    `${within && floorOk ? 'SIZE OK  ' : 'SIZE FAIL'} ${lane.name.padEnd(7)} ${gateLabel.padStart(6)} KB gz / ${String(lane.limitKb).padStart(2)} KB${esmNote}${floorNote}`,
  );
  rows.push({ ...lane, kb: gated, within: within && floorOk });
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
