import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

/**
 * Host-page fixtures for the SDK boot/global rows (INT-01, WDG-04).
 *
 * **Why `page.route` and not a file under the panel root (Pitfall 4):** the
 * panel's nginx `location /` sends
 * `Content-Security-Policy: default-src 'self'; …` with no `style-src` /
 * `script-src`, which blocks inline `<style>` and inline `<script>`. A fixture
 * baked into that root would have its own instrumentation neutered and the row
 * would pass vacuously. Route fulfilment keeps the document at the **panel
 * origin** (so `/api` stays same-origin) while sending no CSP at all, and the
 * SDK bundles are served from the same origin under `/__e2e/bundles/`.
 *
 * The global-surface measurement is deliberately passive: the page writes its
 * own `window`/prototype snapshot into `data-wb-before` / `data-wb-after`
 * attributes on `<html>`. Nothing is parked on `window` to take a measurement,
 * because that would itself be the leak WDG-04 forbids.
 */

const repoRoot = resolve(__dirname, '..', '..');
const distDir = resolve(repoRoot, 'packages/sdk', 'dist');
/** I-1: the open-shadow test bundles are emitted outside `dist/` itself. */
const e2eDistDir = resolve(distDir, 'e2e');

/**
 * `watchbug.e2e.*` is the R-14 open-shadow build and lives under `dist/e2e/`;
 * every other bundle is a shippable artifact sitting in `dist/`.
 */
function bundlePath(bundle: BundleName): string {
  return resolve(bundle.startsWith('watchbug.e2e') ? e2eDistDir : distDir, bundle);
}

export const FIXTURE_ORIGIN = 'http://127.0.0.1:8080';
export const FIXTURE_URL = `${FIXTURE_ORIGIN}/__e2e/host-fixture.html`;

/** One shared RegExp per intercepted route (e2e/ingest.spec.ts convention). */
const BUNDLE_ROUTE = /\/__e2e\/bundles\//;
const FIXTURE_ROUTE = /\/__e2e\/host-fixture\.html$/;
/** The hostile-CSS matrix (WDG-02/03/05, CA-04) — a separate document. */
const HOSTILE_ROUTE = /\/__e2e\/hostile-host\.html/;

export const HOSTILE_URL = `${FIXTURE_ORIGIN}/__e2e/hostile-host.html`;

export type BundleName =
  | 'watchbug.js'
  | 'watchbug.mjs'
  | 'watchbug.e2e.js'
  | 'watchbug.e2e.mjs'
  // The lazy editor chunk (03-05). `import()` always fetches the `.mjs` twin
  // (the loader resolves it from the core bundle's own URL); the `.js` twin
  // stays emitted and gated by `check:size` so neither can drift (OQ-5).
  | 'watchbug-annotator.js'
  | 'watchbug-annotator.mjs';

/** The lazy-lane names served alongside every core bundle (Pitfall 3). */
const LAZY_CHUNKS: readonly BundleName[] = ['watchbug-annotator.js', 'watchbug-annotator.mjs'];

/** `iife` = one async `<script src>`; `esm` = one `<script type="module">` import. */
export type FixtureMode = 'iife' | 'esm';

export interface HostFixtureOptions {
  bundle: BundleName;
  mode: FixtureMode;
  /** Defaults to the deploy stack's seeded key from `.env`. */
  projectKey?: string;
  /**
   * Absolute origin the loader script tag is served from (S-8 row): the fixture
   * document stays at FIXTURE_ORIGIN while the bundle is loaded from somewhere
   * else — exactly the cross-origin script delivery shape. `page.route` fulfils
   * it, so no real second server is needed.
   */
  scriptOrigin?: string;
  /**
   * Defaults to `true`: the loader calls `init()` on script load. Set `false`
   * to call `Watchbug.init(...)` from the test instead (S-8 refusal row).
   */
  autoInit?: boolean;
}

/** The canonical seeded key shape (`scripts/gen-key.mjs`, DEP-02). */
const PROJECT_KEY_SHAPE = /^wkbt_[0-9A-Za-z]{32}$/;

/** The deploy stack's seeded project key — the same file the api reads. */
export function projectKey(): string {
  const envFile = readFileSync(resolve(repoRoot, '.env'), 'utf8');
  const match = /^WATCHBUG_PROJECT_KEY=(.+)$/m.exec(envFile);
  if (!match) throw new Error('.env has no WATCHBUG_PROJECT_KEY — copy .env.example and run npm run key:gen');
  const key = match[1].trim();
  if (key === 'wkbt_00000000000000000000000000000000') {
    throw new Error('.env still holds the placeholder key — generate a real one with npm run key:gen');
  }
  // S-9: this key is interpolated into a single-quoted JS literal inside a
  // double-quoted HTML attribute. Validate it against its canonical shape
  // FIRST, so no `.env` edit can break out of that literal and run script inside
  // the fixture — the format guarantee belongs to this file, not to the API's
  // boot check.
  if (!PROJECT_KEY_SHAPE.test(key)) {
    throw new Error(
      `.env WATCHBUG_PROJECT_KEY is not a wkbt_ key (expected ${PROJECT_KEY_SHAPE}) — run npm run key:gen`,
    );
  }
  return key;
}

/**
 * The key that gets interpolated into a loader literal (S-9 / FX-04). An
 * explicitly supplied `options.projectKey` is validated exactly like the one
 * read from `.env`: the "cannot break out of the literal" guarantee is about
 * the SHAPE of the value, so it has to hold for every caller and not only for
 * `projectKey()`.
 */
function fixtureKey(options: HostFixtureOptions): string {
  const key = options.projectKey ?? projectKey();
  if (!PROJECT_KEY_SHAPE.test(key)) {
    throw new Error(`HostFixtureOptions.projectKey is not a wkbt_ key (expected ${PROJECT_KEY_SHAPE})`);
  }
  return key;
}

/**
 * Snapshot of `window`'s own property names plus the own properties of the four
 * prototypes WDG-04 names. Serialised into an attribute, never onto `window`.
 */
const SNAPSHOT_EXPRESSION = `JSON.stringify({
  w: Object.getOwnPropertyNames(window).sort(),
  p: [Object, Element, HTMLElement, EventTarget].map(function (ctor) {
    return Object.getOwnPropertyNames(ctor.prototype).sort();
  })
})`;

const BEFORE_SCRIPT = `<script>(function () {
  document.documentElement.setAttribute('data-wb-before', ${SNAPSHOT_EXPRESSION});
})();</script>`;

const AFTER_SCRIPT = `<script>window.addEventListener('load', function () {
  document.documentElement.setAttribute('data-wb-after', ${SNAPSHOT_EXPRESSION});
});</script>`;

function loaderMarkup(
  mode: FixtureMode,
  bundle: BundleName,
  key: string,
  options: HostFixtureOptions,
): string {
  const src = `${options.scriptOrigin ?? ''}/__e2e/bundles/${bundle}`;
  const autoInit = options.autoInit !== false;
  if (mode === 'esm') {
    return `<script type="module">
  import { init } from '${src}';
${autoInit ? `  init({ projectKey: ${JSON.stringify(key)} });` : ''}
</script>`;
  }
  // Single async script tag — the INT-01 integration shape. `projectKey()`
  // validates the key against its canonical form (S-9), so a single-quoted JS
  // literal inside the attribute cannot break out of it.
  return `<script async src="${src}"${autoInit ? ` onload="Watchbug.init({ projectKey: '${key}' })"` : ''}></script>`;
}

function fixtureMarkup(
  mode: FixtureMode,
  bundle: BundleName,
  key: string,
  options: HostFixtureOptions,
): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Watchbug host fixture</title>
${BEFORE_SCRIPT}
</head>
<body>
<h1 id="host-heading">Host page</h1>
${loaderMarkup(mode, bundle, key, options)}
${AFTER_SCRIPT}
</body>
</html>`;
}

export interface GlobalSnapshot {
  /** `Object.getOwnPropertyNames(window)`, sorted. */
  w: string[];
  /** Own properties of Object, Element, HTMLElement, EventTarget prototypes. */
  p: string[][];
}

/**
 * Serve the fixture document and its bundle at the panel origin, then load it.
 * Routes are page-scoped, so every row starts from a clean intercept set.
 */
export async function openHostFixture(page: Page, options: HostFixtureOptions): Promise<void> {
  const key = fixtureKey(options);
  await serveBundle(page, options.bundle);

  const html = fixtureMarkup(options.mode, options.bundle, key, options);
  await page.route(FIXTURE_ROUTE, async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  });

  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
}

/**
 * Serve one dist bundle from the panel origin under `/__e2e/bundles/` — plus,
 * as a SET, the lazy editor chunk twins (03-05): the loader fetches
 * `watchbug-annotator.mjs` through one dynamic import, and a single-name
 * comparison would 404 every editor row (Pitfall 3). Genuinely unknown names
 * STILL 404, so the guard keeps its teeth.
 */
async function serveBundle(page: Page, bundle: BundleName): Promise<Buffer> {
  const serving = new Map<string, Buffer>();
  const loadBundle = (name: BundleName): Buffer => {
    const bundleBytesPath = bundlePath(name);
    try {
      return readFileSync(bundleBytesPath);
    } catch {
      throw new Error(`missing ${bundleBytesPath} — run "npm run build" before the e2e suite`);
    }
  };
  const bundleBytes = loadBundle(bundle);
  serving.set(bundle, bundleBytes);
  for (const chunk of LAZY_CHUNKS) {
    if (!serving.has(chunk)) serving.set(chunk, loadBundle(chunk));
  }

  await page.route(BUNDLE_ROUTE, async (route) => {
    const requested = new URL(route.request().url()).pathname.split('/').pop();
    const bytes = requested === undefined ? undefined : serving.get(requested);
    if (bytes === undefined) {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'unknown fixture bundle' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      body: bytes,
    });
  });

  return bundleBytes;
}

/* ------------------------------------------------------------------------- */
/* Hostile-CSS matrix (WDG-02 / WDG-03 / WDG-05, CA-04)                       */
/* ------------------------------------------------------------------------- */

/**
 * One hostile rule per variant. `clean` is the unhostile control, `empty` is a
 * host page whose body carries no content at all.
 */
export type HostileVariant =
  | 'clean'
  | 'display'
  | 'fontsize'
  | 'unset'
  | 'transform'
  | 'zindex'
  | 'adjacent'
  | 'empty';

export interface HostileFixtureOptions extends HostFixtureOptions {
  variant: HostileVariant;
  /**
   * Defaults to `true`: the loader calls `init()` on script load. Set `false`
   * to measure the host document before the widget exists (WDG-03) and call
   * `window.Watchbug.init({ projectKey })` from the test instead.
   */
  autoInit?: boolean;
}

const HOSTILE_FIXTURE_PATH = resolve(repoRoot, 'e2e', 'fixtures', 'hostile-host.html');

/**
 * Serve `e2e/fixtures/hostile-host.html` with exactly one matrix variant
 * lifted into the document. Route fulfilment keeps the page at the panel origin
 * (so `/api/incidents` stays same-origin) without nginx's CSP (Pitfall 4).
 */
export async function openHostileFixture(page: Page, options: HostileFixtureOptions): Promise<void> {
  const key = fixtureKey(options);
  const template = readFileSync(HOSTILE_FIXTURE_PATH, 'utf8');

  const variantMatch = new RegExp(
    `<template data-variant="${options.variant}">([\\s\\S]*?)</template>`,
  ).exec(template);
  if (options.variant !== 'clean' && options.variant !== 'empty' && variantMatch === null) {
    throw new Error(`hostile-host.html has no variant "${options.variant}"`);
  }
  const variantContent = variantMatch?.[1] ?? '';

  let html = template
    // Anchor to the marker's own line: the fixture's head comment *names* the
    // marker, and a bare `String.replace` would substitute that mention first.
    .replace(/^<!--__VARIANT_SLOT__-->$/m, variantContent)
    .replaceAll('__BUNDLE__', options.bundle)
    .replaceAll('__PROJECT_KEY__', key);

  if (options.variant === 'empty') {
    // A genuinely empty body: no content for the widget to depend on.
    html = html.replace(
      /<!--__HOST_CONTENT_START__-->[\s\S]*?<!--__HOST_CONTENT_END__-->/,
      '',
    );
  }
  if (options.autoInit === false) {
    html = html.replace(/\s+onload="[^"]*"/, '');
  }

  await serveBundle(page, options.bundle);
  await page.route(HOSTILE_ROUTE, async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  });

  await page.goto(`${HOSTILE_URL}?variant=${options.variant}`, { waitUntil: 'load' });
}

/** Wait until the page's `load` handler has written the post-load snapshot. */
export async function waitForSnapshot(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-wb-after'), null, {
    timeout: 10_000,
  });
}

/**
 * The global-surface probe ON DEMAND (03-05 / PRF-02): the lazy chunk loads
 * long AFTER the page's `load` event, so the fixture's before/after attribute
 * pair cannot straddle it. This re-evaluates the SAME `SNAPSHOT_EXPRESSION`
 * (WDG-04's shape — `getOwnPropertyNames` of window + the four named
 * prototypes, never an `Object.keys(window)` counter, never anything parked on
 * the page) at the moment the row chooses.
 */
export async function snapshotGlobals(page: Page): Promise<GlobalSnapshot> {
  const raw = await page.evaluate(`(${SNAPSHOT_EXPRESSION})`);
  return JSON.parse(String(raw)) as GlobalSnapshot;
}

export async function readSnapshot(page: Page, which: 'before' | 'after'): Promise<GlobalSnapshot> {
  const raw = await page.locator('html').getAttribute(`data-wb-${which}`);
  if (raw === null) throw new Error(`fixture wrote no data-wb-${which} snapshot`);
  return JSON.parse(raw) as GlobalSnapshot;
}

/** Names present in `after` but absent from `before`, in `after` order. */
export function addedNames(after: string[], before: string[]): string[] {
  const known = new Set(before);
  return after.filter((name) => !known.has(name));
}
