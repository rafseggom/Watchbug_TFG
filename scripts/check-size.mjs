#!/usr/bin/env node
/**
 * R-01 / RNF-01 / CA-03 size gate — zero dependencies (`node:zlib` only).
 *
 * Four budget tiers over the gzipped artifacts, reported in a FIXED lane
 * order — core, lazy, adapter, then the runtime total — so every run reads
 * the same way and the SUMMARY can quote the numbers:
 *
 *   core    `watchbug.js`           ≤ 45 KB gz  (hard, RNF-01)
 *   lazy    `watchbug-annotator.js` ≤ 25 KB gz  (each lazy chunk)
 *   adapter `watchbug-dom-serialize.js` ≤ 14 KB gz (optional CaptureSource)
 *   runtime core + lazy + adapter   ≤ 80 KB gz  (total runtime payload)
 *
 * The lazy lane gates on the MAX of its `.js`/`.mjs` twins (research OQ-5):
 * the loader fetches the `.mjs`, so that is the artifact users download, and
 * gating the max means neither twin can silently drift. The floor is the
 * ANTI-INLINE guard (Pitfall 1): a chunk that shrank to an empty shell means
 * esbuild folded the editor into the core bundle — a green 25 KB ceiling
 * would then pass vacuously. BOTH twins must clear it (a collapsed twin is
 * exactly the drift the max-gate exists to catch), and the verdict prints on
 * its own line so the ceiling check and the floor check are never conflated.
 *
 * A-12 / M-2: the worst case where a host loads EVERY lane is
 * 45 + 25 + 14 = 84 KB, which exceeds the 80 KB runtime tier. That contradiction
 * is printed on every run — the tiers are per-lane ceilings, not a promise
 * that all three fit together, and the owner decides per integration which
 * lanes are loaded.
 *
 * Breach policy: a tier breach is fixed by cutting bytes from the lane that
 * breached it. The limits below are RNF-01's contract — raising one is an
 * owner decision, never an executor edit.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(repoRoot, 'packages', 'sdk', 'dist');

const KB = 1024;

/** Fixed report order: core, lazy, adapter, then the runtime total. */
const LANES = [
  { name: 'core', file: 'watchbug.js', limitKb: 45 },
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
  if (!within) failures++;

  // Every measured number prints: both twins for a floored lane, the delta
  // for the rest. The runtime total below sums the GATED values.
  const twinNote =
    esmKb === null
      ? ` | ${esmFile}: MISSING`
      : lane.floorKb !== undefined
        ? ` (max of .js ${kb.toFixed(1)} / .mjs ${esmKb.toFixed(1)} KB gz)`
        : ` | ${esmFile}: ${esmKb.toFixed(1)} KB gz (${(esmKb - kb).toFixed(1)} vs iife)`;
  console.log(
    `${within ? 'SIZE OK  ' : 'SIZE FAIL'} ${lane.name.padEnd(7)} ${gated.toFixed(1).padStart(6)} KB gz / ${String(lane.limitKb).padStart(2)} KB${twinNote}`,
  );

  // The anti-inline floor is its OWN verdict — ceiling and floor never share
  // a line, so a drifting twin cannot hide behind a green ceiling.
  if (lane.floorKb !== undefined) {
    let floorOk;
    let floorNote;
    if (esmKb === null) {
      floorOk = false; // a missing ESM twin of a gated lane is a breach, not a shrug
      floorNote = 'FAIL (esm twin missing)';
    } else {
      const minTwin = Math.min(kb, esmKb);
      floorOk = minTwin >= lane.floorKb;
      floorNote = `${floorOk ? 'OK' : 'FAIL'} (min twin ${minTwin.toFixed(1)} KB gz)`;
    }
    if (!floorOk) failures++;
    console.log(
      `${floorOk ? 'SIZE OK  ' : 'SIZE FAIL'} ${`${lane.name}-floor`.padEnd(13)} >= ${String(lane.floorKb).padStart(2)} KB gz  ${floorNote}`,
    );
  }

  rows.push({ ...lane, kb: gated, within });
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
