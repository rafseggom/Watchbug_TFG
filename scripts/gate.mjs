#!/usr/bin/env node
/**
 * scripts/gate.mjs — static architecture assertions. Zero dependencies.
 *
 * **Superseded by R-19 (AGENTS.md Testing & QA):** the six-type taxonomy is
 * the current verification policy. What R-12 still contributes is stated by
 * RSK-19: artifact-level assertions + static grep gates + `check:size` are the
 * security evidence, and this file is the **static grep gates** half of that
 * contract — it is part of the verification architecture, not optional
 * linting. A gate nobody executes is a comment.
 *
 * Boundary (R-18 reuse-first — do not re-implement what already exists):
 *   - artifact size tiers .............. `npm run check:size`    → scripts/check-size.mjs
 *   - compose / INV-03 / C-4 rules ..... `npm run check:compose` → scripts/check-compose.mjs
 *   - SDK static policy ................ this file
 *
 * Usage:
 *   node scripts/gate.mjs                    # run every rule
 *   node scripts/gate.mjs sdk-runtime-deps   # run one rule
 *
 * Exit code 1 if any rule FAILs. A rule whose subject does not exist yet
 * reports SKIP — visible in the summary, never silently. Flip `STRICT` to
 * true at Phase 7 release closeout so a SKIP becomes a FAIL and no rule can
 * quietly never run again.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(repoRoot, p).replaceAll('\\', '/');

/** @type {boolean} Phase 7 closeout: turn SKIP into FAIL. */
const STRICT = false;

/**
 * The only runtime dependencies `packages/sdk` may declare. Everything else is
 * a size-budget violation: the SDK is inlined into third-party host pages and
 * every transitive byte is stolen from the 45 KB hard tier (RNF-01).
 * Internal npm-workspace refs only — they are `import type` and erased.
 */
const ALLOWED_RUNTIME_DEPS = new Set(['@watchbug/contracts']);

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

/** Recursive, portable, dependency-free source file listing. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile() && CODE_EXT.has(extname(entry.name))) out.push(p);
  }
  return out;
}

const readLines = (file) => readFileSync(file, 'utf8').split(/\r?\n/);

const pass = (notes = []) => ({ status: 'pass', notes });
const fail = (notes) => ({ status: 'fail', notes });
const skip = (notes) => ({ status: 'skip', notes });

/** @type {Array<{id: string, title: string, ref: string, run: () => {status: string, notes: string[]}}>}*/
const RULES = [
  {
    id: 'sdk-runtime-deps',
    title: 'packages/sdk declares no external runtime dependency',
    ref: 'RNF-01 · R-15 · STACK "Runtime dependencies: NONE"',
    run() {
      const manifest = join(repoRoot, 'packages', 'sdk', 'package.json');
      if (!existsSync(manifest)) return skip(['packages/sdk/package.json not present yet']);

      // Tolerate a UTF-8 BOM: Windows-authored manifests often carry one and
      // `JSON.parse` rejects it outright.
      const pkg = JSON.parse(readFileSync(manifest, 'utf8').replace(/^\uFEFF/, ''));
      const runtimeBlocks = ['dependencies', 'peerDependencies', 'optionalDependencies'];
      const offenders = [];
      for (const block of runtimeBlocks) {
        for (const name of Object.keys(pkg[block] ?? {})) {
          if (!ALLOWED_RUNTIME_DEPS.has(name)) offenders.push(`${block}.${name}`);
        }
      }
      if (offenders.length > 0) {
        return fail([
          'every runtime byte ships to third-party host pages — only devDependencies and the authorised internal refs are allowed',
          ...offenders.map((o) => `forbidden runtime dependency: ${o}`),
        ]);
      }
      return pass([`runtime blocks contain only: ${[...ALLOWED_RUNTIME_DEPS].join(', ')}`]);
    },
  },

  {
    id: 'sdk-no-host-storage',
    title: 'packages/sdk never reads host storage, cookies or credentials',
    ref: 'SEC-03 · C-5 (RSK-19 static grep gate)',
    run() {
      const files = walk(join(repoRoot, 'packages', 'sdk', 'src'));
      if (files.length === 0) return skip(['packages/sdk/src has no source files yet']);

      const FORBIDDEN = [
        ['document.cookie', /document\.cookie/],
        ['localStorage', /\blocalStorage\b/],
        ['sessionStorage', /\bsessionStorage\b/],
        ['Authorization header', /\bAuthorization\b/],
        ['Bearer token', /Bearer\s/],
      ];
      // `credentials: 'omit'` is the *safe* value and is the only legal form.
      const CREDENTIALS = /credentials\s*:\s*['"]?([A-Za-z]+)/;

      const hits = [];
      for (const file of files) {
        readLines(file).forEach((line, i) => {
          const at = `${rel(file)}:${i + 1}  ${line.trim()}`;
          for (const [label, re] of FORBIDDEN) {
            if (re.test(line)) hits.push(`[${label}] ${at}`);
          }
          const cred = line.match(CREDENTIALS);
          if (cred && cred[1] !== 'omit') hits.push(`[fetch credentials = '${cred[1]}'] ${at}`);
        });
      }
      if (hits.length > 0) return fail(hits);
      return pass([`${files.length} SDK source file(s) clean of host storage/credential access`]);
    },
  },

  {
    id: 'sdk-single-encode-sink',
    title: 'packages/sdk has at most one image-encode sink',
    ref: 'C-2 · RSK-02 (destructive non-undoable masks, single `encodeFinal()` sink)',
    run() {
      const files = walk(join(repoRoot, 'packages', 'sdk', 'src'));
      if (files.length === 0) return skip(['packages/sdk/src has no source files yet']);

      const SINK = /\b(?:toBlob|toDataURL|convertToBlob)\b/g;
      const hits = [];
      let sinks = 0;
      for (const file of files) {
        readLines(file).forEach((line, i) => {
          const found = line.match(SINK);
          if (!found) return;
          sinks += found.length;
          hits.push(`${rel(file)}:${i + 1}  ${[...new Set(found)].join(', ')}  →  ${line.trim()}`);
        });
      }
      if (sinks > 1) {
        return fail([
          `masked pixels must be re-baked as the LAST pixel operation before a single encode — ${sinks} encode sinks found`,
          ...hits,
        ]);
      }
      if (sinks === 0) {
        return skip([
          'no encode sink found — encodeFinal() has disappeared from the lane; this is a build defect, not a pending phase (the sink shipped with 03-03)',
        ]);
      }
      return pass(hits);
    },
  },

  {
    id: 'sdk-no-html-sink',
    title: 'packages/sdk never parses HTML into the DOM',
    ref: 'T-02-01 · SEC-05 · UI-SPEC (createElement/textContent only — the composer/editor keep it)',
    run() {
      const files = walk(join(repoRoot, 'packages', 'sdk', 'src'));
      if (files.length === 0) return skip(['packages/sdk/src has no source files yet']);

      // Token census, comments included — the same discipline
      // `sdk-no-host-storage` and `sdk-single-encode-sink` run: prose that
      // spells a counted token fails the gate, so the codebase keeps its
      // comments phrased around it (02-04 Pitfall 1 precedent).
      const FORBIDDEN = [
        ['innerHTML', /\binnerHTML\b/],
        ['outerHTML', /\bouterHTML\b/],
        ['insertAdjacentHTML', /\binsertAdjacentHTML\b/],
        ['document.write', /\bdocument\.write(?:ln)?\b/],
      ];
      const hits = [];
      for (const file of files) {
        readLines(file).forEach((line, i) => {
          const at = `${rel(file)}:${i + 1}  ${line.trim()}`;
          for (const [label, re] of FORBIDDEN) {
            if (re.test(line)) hits.push(`[${label}] ${at}`);
          }
        });
      }
      if (hits.length > 0) {
        return fail([
          'the widget renders through createElement / textContent / createElementNS only — an HTML sink re-opens the stored-XSS surface inside the shadow root (SEC-05)',
          ...hits,
        ]);
      }
      return pass([`${files.length} SDK source file(s) clean of HTML-parse sinks`]);
    },
  },

  {
    id: 'sdk-lazy-lane-purity',
    title: 'the core bundle never value-imports the lazy editor lane',
    ref: 'PRF-02 · RNF-01 · the 45 KB tier (an editor absorbed into core is a regression, not a pass)',
    run() {
      const files = walk(join(repoRoot, 'packages', 'sdk', 'src'));
      if (files.length === 0) return skip(['packages/sdk/src has no source files yet']);

      /** True for a relative specifier that resolves INTO the lazy lane. */
      const isLazySpec = (spec) => {
        const path = spec.replace(/^\.\//, '').replace(/^(\.\.\/)+/, '');
        return (
          /(?:^|\/)(?:annotator|strings\.editor)\.ts$/.test(path) || /(?:^|\/)annotator\//.test(path)
        );
      };

      const offenders = [];
      const typeOnly = [];
      for (const file of files) {
        const relPath = rel(file).replace(/^packages\/sdk\/src\//, '');
        // The lane itself may import freely; everything else is core.
        if (relPath === 'annotator.ts' || relPath === 'strings.editor.ts' || relPath.startsWith('annotator/')) {
          continue;
        }
        let statementType = null; // 'type' | 'value' while inside a multi-line import
        readLines(file).forEach((line, i) => {
          const at = `${relPath}:${i + 1}  ${line.trim()}`;
          const start = /^[ \t]*(?:import|export)\b/.test(line);
          if (start) {
            statementType = /^[ \t]*(?:import|export)\s+type\b/.test(line) ? 'type' : 'value';
            // A side-effect import of the lane (`import './annotator/…'`) is a
            // value import: it ships editor bytes into core.
            const side = /^[ \t]*import\s+['"]([^'"]+)['"]/.exec(line);
            if (side && isLazySpec(side[1])) {
              offenders.push(`side-effect import of the lazy lane →  ${at}`);
              statementType = null;
            }
          }
          // A LITERAL dynamic import is analyzable — esbuild would inline the
          // chunk into core (Pitfall 1). The loader's variable specifier is the
          // only legal shape, and it names no path here. All three literal
          // quote styles count: a backtick template with no substitution is
          // constant-folded by esbuild exactly like a string literal, so a
          // dynamic import written in backticks inlines the lane just the same
          // (LW-04).
          const dyn = /\bimport\s*\(\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/.exec(line);
          if (dyn && isLazySpec(dyn[2])) {
            offenders.push(`literal dynamic import inlines the lane →  ${at}`);
          }
          const from = /\bfrom\s+['"]([^'"]+)['"]/.exec(line);
          if (from && statementType !== null) {
            if (isLazySpec(from[1])) {
              if (statementType === 'type') typeOnly.push(at);
              else offenders.push(`value import of the lazy lane →  ${at}`);
            }
            statementType = null;
          }
        });
      }
      if (offenders.length > 0) {
        return fail([
          'the lazy lane must reach core only through the variable-specifier import in widget/loader.ts',
          ...offenders,
        ]);
      }
      return pass([
        `${files.length} SDK source file(s) scanned; the only lazy-lane boundary crossings are type-only (erased at build):`,
        ...(typeOnly.length > 0 ? typeOnly.map((at) => `type-only →  ${at}`) : ['none']),
      ]);
    },
  },
];

/* ------------------------------------------------------------------ */

const requested = process.argv.slice(2);
const unknown = requested.filter((id) => !RULES.some((r) => r.id === id));
if (unknown.length > 0) {
  console.error(`gate.mjs unknown rule id(s): ${unknown.join(', ')}`);
  console.error(`available: ${RULES.map((r) => r.id).join(', ')}`);
  process.exit(2);
}

const selected = requested.length > 0 ? RULES.filter((r) => requested.includes(r.id)) : RULES;

console.log('gate.mjs — static architecture assertions (R-12 / RSK-19)\n');

let passed = 0;
let failed = 0;
let skipped = 0;

for (const rule of selected) {
  let result;
  try {
    result = rule.run();
  } catch (err) {
    result = fail([`rule threw: ${err?.message ?? String(err)}`]);
  }

  const status = result.status;
  const tag = status === 'pass' ? 'PASS' : status === 'fail' ? 'FAIL' : 'SKIP';
  const isFail = status === 'fail' || (STRICT && status === 'skip');
  if (isFail) failed++;
  else if (status === 'pass') passed++;
  else skipped++;

  console.log(`${isFail ? 'FAIL' : tag}  ${rule.id}`);
  console.log(`      ${rule.title}   [${rule.ref}]`);
  for (const note of result.notes) console.log(`      • ${note}`);
  console.log('');
}

if (STRICT && skipped > 0) {
  console.log(`STRICT is on - ${skipped} skipped rule(s) are treated as failures.`);
}

console.log(`gate.mjs summary: ${passed} passed, ${failed} failed, ${skipped} skipped`);

if (failed > 0) {
  console.log(`gate.mjs FAILED (${failed} violation${failed === 1 ? '' : 's'})`);
  process.exit(1);
}
console.log('gate.mjs PASSED');
