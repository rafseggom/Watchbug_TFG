/**
 * Build-time flag injected by `packages/sdk/scripts/build.mjs` (R-14).
 *
 * `'closed'` in every shipped bundle (`watchbug.js` / `.mjs`); `'open'` only in
 * the e2e-only artifacts (`watchbug.e2e.js` / `.e2e.mjs`) so Playwright can
 * pierce the shadow root (INV-01, Pitfall 10). Declared as a bare global
 * because esbuild's `define` substitutes the identifier textually; the two
 * builds differ by nothing but this constant.
 */
declare const SHADOW_MODE: 'open' | 'closed';
