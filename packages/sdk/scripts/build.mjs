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
