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

export const FIXTURE_ORIGIN = 'http://127.0.0.1:8080';
export const FIXTURE_URL = `${FIXTURE_ORIGIN}/__e2e/host-fixture.html`;

/** One shared RegExp per intercepted route (e2e/ingest.spec.ts convention). */
const BUNDLE_ROUTE = /\/__e2e\/bundles\//;
const FIXTURE_ROUTE = /\/__e2e\/host-fixture\.html$/;

export type BundleName = 'watchbug.js' | 'watchbug.mjs' | 'watchbug.e2e.js' | 'watchbug.e2e.mjs';

/** `iife` = one async `<script src>`; `esm` = one `<script type="module">` import. */
export type FixtureMode = 'iife' | 'esm';

export interface HostFixtureOptions {
  bundle: BundleName;
  mode: FixtureMode;
  /** Defaults to the deploy stack's seeded key from `.env`. */
  projectKey?: string;
}

/** The deploy stack's seeded project key — the same file the api reads. */
export function projectKey(): string {
  const envFile = readFileSync(resolve(repoRoot, '.env'), 'utf8');
  const match = /^WATCHBUG_PROJECT_KEY=(.+)$/m.exec(envFile);
  if (!match) throw new Error('.env has no WATCHBUG_PROJECT_KEY — copy .env.example and run npm run key:gen');
  const key = match[1].trim();
  if (key === 'wkbt_00000000000000000000000000000000') {
    throw new Error('.env still holds the placeholder key — generate a real one with npm run key:gen');
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

function loaderMarkup(mode: FixtureMode, bundle: BundleName, key: string): string {
  if (mode === 'esm') {
    return `<script type="module">
  import { init } from '/__e2e/bundles/${bundle}';
  init({ projectKey: ${JSON.stringify(key)} });
</script>`;
  }
  // Single async script tag — the INT-01 integration shape. The key is a
  // well-formed `wkbt_` token, so a single-quoted JS literal inside the
  // attribute cannot break out of it.
  return `<script async src="/__e2e/bundles/${bundle}" onload="Watchbug.init({ projectKey: '${key}' })"></script>`;
}

function fixtureMarkup(mode: FixtureMode, bundle: BundleName, key: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Watchbug host fixture</title>
${BEFORE_SCRIPT}
</head>
<body>
<h1 id="host-heading">Host page</h1>
${loaderMarkup(mode, bundle, key)}
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
  const key = options.projectKey ?? projectKey();
  const bundlePath = resolve(distDir, options.bundle);

  let bundleBytes: Buffer;
  try {
    bundleBytes = readFileSync(bundlePath);
  } catch {
    throw new Error(`missing ${bundlePath} — run "npm run build" before the e2e suite`);
  }

  await page.route(BUNDLE_ROUTE, async (route) => {
    const requested = new URL(route.request().url()).pathname.split('/').pop();
    if (requested !== options.bundle) {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'unknown fixture bundle' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      body: bundleBytes,
    });
  });

  const html = fixtureMarkup(options.mode, options.bundle, key);
  await page.route(FIXTURE_ROUTE, async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  });

  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
}

/** Wait until the page's `load` handler has written the post-load snapshot. */
export async function waitForSnapshot(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-wb-after'), null, {
    timeout: 10_000,
  });
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
