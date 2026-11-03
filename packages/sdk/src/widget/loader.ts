/**
 * The lazy-chunk loader (PRF-02: the editor is fetched only on demand).
 *
 * Memoised single-promise cache with retry-on-failure — the same discipline
 * `preferredMimeType`'s cache keeps in `image/encode.ts` (PATTERNS §3): a
 * transient 404 clears the cache so the next `Annotate image` click can
 * succeed instead of living with a dead button (T-03-21).
 *
 * Two load-bearing details, both verified on this repo's esbuild 0.28.2:
 *
 *  - The specifier reaches `import()` through a VARIABLE. A string-literal
 *    specifier is analyzable and esbuild INLINES the chunk into the core
 *    bundle (splitting is ESM-only) — the 45 KB tier would blow and the 25 KB
 *    lazy gate would pass vacuously (Pitfall 1).
 *  - The URL is ABSOLUTE and built from the CORE BUNDLE'S OWN URL (`base`),
 *    never from `init()` options, a `data-` attribute or `document.baseURI`
 *    (T-03-20). In a classic script `import()` resolves relative specifiers
 *    against the DOCUMENT base — a relative specifier would let a host page
 *    decide which code the widget loads.
 */

import type { AnnotatorModule } from '../annotator.ts';

/** The shipped lazy artifact: `import()` always evaluates its target as a
 * module, so the chunk is the `.mjs` twin (the `.js` twin stays emitted and
 * `check:size` budgets the MAX of the two so neither can drift — OQ-5). */
const CHUNK_FILE = 'watchbug-annotator.mjs';

let cached: Promise<AnnotatorModule> | null = null;

/** Fetch attempts so far — see the module-map note in `loadAnnotator`. */
let attempts = 0;

/** Absolute chunk URL from the core bundle's own URL, or `null` when the base
 * cannot be resolved (an unresolvable base is a rejected promise the composer
 * surfaces as the inline load error — never a silent guess). */
export function annotatorChunkUrl(coreUrl: string | undefined): string | null {
  if (coreUrl === undefined) return null;
  try {
    return new URL(CHUNK_FILE, coreUrl).href;
  } catch {
    return null;
  }
}

/**
 * Load the annotator chunk. Resolves the memoised module; a rejection clears
 * the cache so a retry can succeed.
 */
export function loadAnnotator(coreUrl: string | undefined): Promise<AnnotatorModule> {
  if (cached !== null) return cached;
  const href = annotatorChunkUrl(coreUrl);
  if (href === null) {
    return Promise.reject(new Error('watchbug: the annotator chunk URL cannot be resolved'));
  }
  // Non-analyzable on purpose: a literal specifier is inlined into the core
  // bundle (esbuild splitting is ESM-only), which would blow the 45 KB tier
  // and make every laziness assertion meaningless.
  //
  // A failed dynamic-import fetch is PERMANENTLY cached in the engine's
  // module map: re-importing the same URL returns the cached rejection
  // without touching the network (probe-verified on this platform
  // 2026-10-28). Clearing the memo above is therefore necessary but not
  // sufficient for a retry — the retry must re-fetch through a fresh URL.
  // A query buster does exactly that, and only after a failure: the happy
  // path stays exactly one bare `.mjs` request, so PRF-02's laziness count
  // keeps its teeth (T-03-21).
  const specifier: string = attempts === 0 ? href : `${href}?retry=${attempts}`;
  attempts += 1;
  cached = (import(specifier) as Promise<AnnotatorModule>).catch((error: unknown) => {
    cached = null; // a transient failure must be retryable (T-03-21)
    throw error;
  });
  return cached;
}
