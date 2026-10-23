import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

/**
 * SDK dual-build (R-01 / R-15): one TypeScript source → IIFE + ESM, because
 * esbuild accepts exactly one `format` per `build()` call (STACK.md, VERIFIED
 * from `lib/main.d.ts`) — hence six calls: two core formats plus both formats
 * for each of the two lane entries.
 *
 * Lanes (RNF-01 tiered budget):
 *   1. core            `watchbug.js` / `.mjs`          injected script ≤ 45 KB gz
 *   2. lazy editor     `watchbug-annotator.js` / `.mjs` lazy chunk ≤ 25 KB gz
 *   3. optional adapter `watchbug-dom-serialize.js` / `.mjs` ≤ 14 KB gz
 *
 * All calls: `metafile: true` (feeds `check:size`), `minify: true`,
 * `target: ['es2020']`, `define: { SHADOW_MODE: 'closed' }` (INV-01 — the
 * build-time flag; values are JS expressions here, which is why this lives in
 * the esbuild JS API instead of an npm script under cmd.exe).
 * Zero runtime dependencies (R-01): nothing is external, nothing is imported.
 *
 * **R-14 e2e variant.** Two extra core calls emit `watchbug.e2e.js` /
 * `watchbug.e2e.mjs`: identical source, `SHADOW_MODE = 'open'`, so Playwright
 * can pierce the shadow root (Pitfall 10). The names are deliberately distinct
 * from `watchbug.js` / `.mjs` — `scripts/check-size.mjs` budgets by filename,
 * so the test-only artifact can never be mistaken for the shipped bundle and
 * is never gated. Production never loads it.
 */

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');

const shared = {
  bundle: true,
  minify: true,
  metafile: true,
  target: ['es2020'],
  logLevel: 'warning',
  define: {
    // INV-01: production bundles use a closed shadow root. `define` values must
    // be valid JS expressions, hence the quotes.
    SHADOW_MODE: JSON.stringify('closed'),
  },
};

const LANE_ENTRIES = [
  { name: 'core', entry: 'src/index.ts', out: 'watchbug' },
  { name: 'lazy-editor', entry: 'src/annotator.ts', out: 'watchbug-annotator' },
  { name: 'optional-adapter', entry: 'src/capture/dom-serialize.ts', out: 'watchbug-dom-serialize' },
];

const FORMAT_ROLES = [
  { format: 'iife', ext: '.js', globalName: 'Watchbug' },
  { format: 'esm', ext: '.mjs' },
];

const built = [];

for (const lane of LANE_ENTRIES) {
  for (const role of FORMAT_ROLES) {
    const outfile = join(dist, `${lane.out}${role.ext}`);
    await build({
      ...shared,
      entryPoints: [join(here, '..', lane.entry)],
      outfile,
      format: role.format,
      ...(role.globalName ? { globalName: role.globalName } : {}),
    });
    built.push({ lane: lane.name, format: role.format, outfile });
  }
}

for (const artifact of built) {
  if (!existsSync(artifact.outfile)) throw new Error(`esbuild did not emit ${artifact.outfile}`);
  const gz = gzipSync(readFileSync(artifact.outfile)).length;
  console.log(`built ${artifact.lane.padEnd(17)} ${artifact.format.padEnd(4)} ${(gz / 1024).toFixed(1)} KB gz  ${artifact.outfile}`);
}

// R-14: the open-mode e2e artifacts. Same entry, same format matrix, only the
// shadow mode differs — and a filename the size gate does not budget.
const E2E_CORE = { lane: 'core-e2e', entry: 'src/index.ts', out: 'watchbug.e2e' };

for (const role of FORMAT_ROLES) {
  const outfile = join(dist, `${E2E_CORE.out}${role.ext}`);
  await build({
    ...shared,
    define: { ...shared.define, SHADOW_MODE: JSON.stringify('open') },
    entryPoints: [join(here, '..', E2E_CORE.entry)],
    outfile,
    format: role.format,
    ...(role.globalName ? { globalName: role.globalName } : {}),
  });
  if (!existsSync(outfile)) throw new Error(`esbuild did not emit ${outfile}`);
  const gz = gzipSync(readFileSync(outfile)).length;
  console.log(`built ${E2E_CORE.lane.padEnd(17)} ${role.format.padEnd(4)} ${(gz / 1024).toFixed(1)} KB gz  ${outfile}`);
}
