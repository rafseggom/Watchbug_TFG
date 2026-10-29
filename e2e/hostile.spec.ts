import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  clickLauncher,
  installCaptureStub,
  probeHost,
  waitForHeadline,
  waitForWidget,
} from './helpers/capture-stubs';
import { completeComposer } from './helpers/composer';
import { openHostileFixture, projectKey, type HostileVariant } from './helpers/host-fixtures';

/**
 * J-14: Hostile-CSS isolation (WDG-02/03/05, CA-04) + XSS-render-inert representative.
 *
 * This is the ONLY e2e hostile spec. All payload-control, size-cap, auth,
 * rate-limit, Origin, and sanitisation rows have been re-homed to:
 *   - tests/integration/hostile-size-caps.test.ts
 *   - tests/integration/hostile-auth-rate-limit.test.ts
 *   - tests/integration/hostile-sanitisation.test.ts
 *   - tests/contract/hostile-payload-control.test.ts
 *   - tests/packaging/no-dangerouslySetInnerHTML.test.ts
 *
 * Per R-19: e2e suite is structurally capped at ≤20 core user journeys.
 * J-14 is journey 14 of 20. The single XSS-render-inert row (ING-07 pass 2)
 * is the only browser-rendering assertion kept here.
 */

const repoRoot = resolve(__dirname, '..');

/** The inline `!important` contract from UI-SPEC § Widget Geometry & Isolation. */
const HOST_CONTRACT = [
  'display: block !important',
  'position: fixed !important',
  'z-index: 2147483647 !important',
  'right: 24px !important',
  'bottom: 24px !important',
  'pointer-events: none !important',
];

async function expectHostContract(page: import('@playwright/test').Page): Promise<void> {
  const host = await probeHost(page);
  expect(host.hostPresent).toBe(true);
  expect(host.hostLastChild).toBe(true);
  for (const declaration of HOST_CONTRACT) {
    expect(host.hostStyle).toContain(declaration);
  }
  expect(host.display).toBe('block');
  expect(host.position).toBe('fixed');
  expect(host.zIndex).toBe('2147483647');
  expect(host.pointerEvents).toBe('none');
  expect(host.launcherFound).toBe(true);
  expect(host.launcherWidth).toBe(48);
  expect(host.launcherHeight).toBe(48);
  expect(host.rightInset).toBe(24);
  expect(host.bottomInset).toBe(24);
}

/** The control-element evidence each hostile rule really applied (CA-04). */
async function readControlProof(page: import('@playwright/test').Page, variant: HostileVariant): Promise<boolean> {
  return page.evaluate((which) => {
    const style = (id: string): CSSStyleDeclaration | null => {
      const node = document.getElementById(id);
      return node === null ? null : getComputedStyle(node);
    };
    switch (which) {
      case 'display': {
        const control = style('control-display');
        return control !== null && control.display === 'none';
      }
      case 'fontsize': {
        const control = style('control-fontsize');
        return control !== null && control.fontSize === '4px';
      }
      case 'unset': {
        const control = style('control-unset');
        return control !== null && control.fontWeight === '400' && control.display === 'inline';
      }
      case 'transform': {
        const node = document.getElementById('control-fixed');
        if (node === null) return false;
        const rect = node.getBoundingClientRect();
        return Math.round(rect.left) === 120 && Math.round(rect.top) === 90;
      }
      case 'zindex': {
        const action = document.getElementById('host-action');
        if (action === null) return false;
        const rect = action.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return hit !== null && hit.id === 'hostile-modal';
      }
      case 'adjacent': {
        const box = document.getElementById('hostile-box');
        if (box === null) return false;
        const rect = box.getBoundingClientRect();
        const computed = getComputedStyle(box);
        return (
          Math.round(window.innerWidth - rect.right) === 24 &&
          Math.round(window.innerHeight - rect.bottom) === 24 &&
          computed.zIndex === '2147483646'
        );
      }
      case 'clean':
      case 'empty':
        return true;
      default:
        return true;
    }
  }, variant);
}

/** Intercept a report and answer 201 — isolation rows are not ingest rows. */
async function answerCreated(page: import('@playwright/test').Page): Promise<void> {
  const INTERCEPTED_ID = '00000000-0000-0000-0000-000000000000';
  await page.route('**/api/incidents', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: INTERCEPTED_ID }) });
    } else {
      await route.continue();
    }
  });
}

/* ------------------------------------------------------------------------ */
/* J-14: Hostile-CSS isolation (WDG-02/03/05, CA-04)                        */
/* ------------------------------------------------------------------------ */

for (const variant of ['display', 'fontsize', 'unset', 'transform'] as const) {
  test(`WDG-02: hostile host CSS cannot hide, restyle or break the widget — ${variant}`, async ({ page, browserName }) => {
    await installCaptureStub(page, browserName);
    await openHostileFixture(page, { variant, bundle: 'watchbug.e2e.js', mode: 'iife' });
    await waitForWidget(page);

    expect(await readControlProof(page, variant), `control for ${variant}`).toBe(true);
    await expectHostContract(page);

    await answerCreated(page);
    await clickLauncher(page);
    await completeComposer(page);
    await waitForHeadline(page, 'Report sent ✓', 15_000);
  });
}

test('WDG-02: the closed production bundle keeps the inline isolation contract under *:not(html):not(body) { display: none !important }', async ({ page }) => {
  await openHostileFixture(page, { variant: 'display', bundle: 'watchbug.js', mode: 'iife' });
  await waitForWidget(page);

  const host = await probeHost(page);
  expect(host.shadowRootOpen).toBe(false);
  expect(host.display).toBe('block');
  expect(host.position).toBe('fixed');
  expect(host.zIndex).toBe('2147483647');
  expect(host.pointerEvents).toBe('none');
  expect(host.documentHitsHost).toBe(true);
  expect(host.documentHitTag).toBe('watchbug-host');
  expect(await readControlProof(page, 'display')).toBe(true);
});

test('CA-04: every hostile rule in the matrix demonstrably applies to its control element', async ({ context }) => {
  const variants: HostileVariant[] = [
    'display',
    'fontsize',
    'unset',
    'transform',
    'zindex',
    'adjacent',
  ];
  for (const variant of variants) {
    const page = await context.newPage();
    await openHostileFixture(page, { variant, bundle: 'watchbug.js', mode: 'iife' });
    await waitForWidget(page);
    expect(await readControlProof(page, variant), `control for ${variant}`).toBe(true);
    await page.close();
  }
});

test('WDG-03: init and a full report flow leak zero styles, classes or custom properties into the host document', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostileFixture(page, {
    variant: 'clean',
    bundle: 'watchbug.e2e.js',
    mode: 'iife',
    autoInit: false,
  });
  await page.waitForFunction(
    () => typeof (window as unknown as { Watchbug?: { init?: unknown } }).Watchbug?.init === 'function',
    null,
    { timeout: 10_000 },
  );

  const scan = () =>
    page.evaluate(() => {
      const headStyles = document.head.querySelectorAll('style, link[rel="stylesheet"]').length;
      const leaked: string[] = [];
      for (const element of Array.from(document.querySelectorAll('*'))) {
        const computed = getComputedStyle(element);
        for (let index = 0; index < computed.length; index += 1) {
          const property = computed[index];
          if (property.startsWith('--wb-')) {
            leaked.push(`${element.tagName.toLowerCase()}#${element.id || '-'}:${property}`);
          }
        }
      }
      const widgetClasses = Array.from(
        document.querySelectorAll('.wrap, .launcher, .panel, .headline, .hint, .reason, .actions, .action, .spinner'),
      ).map((element) => element.tagName.toLowerCase());
      return { headStyles, leaked, widgetClasses, hostPresent: document.querySelector('watchbug-host') !== null };
    });

  const before = await scan();
  expect(before.hostPresent).toBe(false);
  expect(before.leaked).toEqual([]);
  expect(before.widgetClasses).toEqual([]);

  await page.evaluate((key) => {
    (window as unknown as { Watchbug: { init: (options: { projectKey: string }) => void } }).Watchbug.init({
      projectKey: key,
    });
  }, projectKey());

  const afterInit = await scan();
  expect(afterInit.hostPresent).toBe(true);
  expect(afterInit.headStyles).toBe(before.headStyles);
  expect(afterInit.leaked).toEqual([]);
  expect(afterInit.widgetClasses).toEqual([]);

  await answerCreated(page);
  await clickLauncher(page);
  await completeComposer(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);

  const afterFlow = await scan();
  expect(afterFlow.headStyles).toBe(before.headStyles);
  expect(afterFlow.leaked).toEqual([]);
  expect(afterFlow.widgetClasses).toEqual([]);
});

test('WDG-05: the widget wins the stacking contest over a hostile max-z-index modal and the flow still completes', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostileFixture(page, { variant: 'zindex', bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  expect(await readControlProof(page, 'zindex')).toBe(true);

  const host = await probeHost(page);
  expect(host.hostLastChild).toBe(true);
  expect(host.documentHitsHost).toBe(true);
  expect(host.documentHitTag).toBe('watchbug-host');
  expect(host.rootHitsLauncher).toBe(true);

  await answerCreated(page);
  await clickLauncher(page);
  await completeComposer(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
});

test('WDG-05: a hostile element painted at the widget coordinates neither captures its hit target nor swallows host clicks', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostileFixture(page, { variant: 'adjacent', bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  expect(await readControlProof(page, 'adjacent')).toBe(true);

  const host = await probeHost(page);
  expect(host.documentHitsHost).toBe(true);
  expect(host.rootHitsLauncher).toBe(true);

  await page.mouse.click(100, 60);
  await expect(page.locator('html')).toHaveAttribute('data-host-click', 'yes');

  await answerCreated(page);
  await clickLauncher(page);
  await completeComposer(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
});

test('WDG-05: an empty host page still renders the launcher at 24 px insets and starts the flow', async ({ page, browserName }) => {
  await installCaptureStub(page, browserName);
  await openHostileFixture(page, { variant: 'empty', bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const empty = await page.evaluate(() => ({
    hostContent: document.getElementById('host-content') !== null,
    bodyChildren: document.body.querySelectorAll('div, button, h1').length,
  }));
  expect(empty.hostContent).toBe(false);
  expect(empty.bodyChildren).toBe(0);

  const host = await probeHost(page);
  expect(host.launcherFound).toBe(true);
  expect(host.rightInset).toBe(24);
  expect(host.bottomInset).toBe(24);

  await answerCreated(page);
  await clickLauncher(page);
  await completeComposer(page);
  await waitForHeadline(page, 'Report sent ✓', 15_000);
});

test('WDG-05: a z-index tie stays resolved by DOM order and the host is re-appended after a documentElement replacement', async ({ page }) => {
  await openHostileFixture(page, { variant: 'zindex', bundle: 'watchbug.e2e.js', mode: 'iife' });
  await waitForWidget(page);

  const before = await probeHost(page);
  expect(before.hostLastChild).toBe(true);
  expect(before.documentHitsHost).toBe(true);

  const lastChildTag = await page.evaluate(async () => {
    const replacement = document.adoptNode(
      document.implementation.createHTMLDocument('replaced').documentElement,
    );
    document.replaceChild(replacement, document.documentElement);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    return document.documentElement.lastElementChild?.tagName.toLowerCase() ?? '';
  });
  expect(lastChildTag).toBe('watchbug-host');

  const after = await probeHost(page);
  expect(after.hostPresent).toBe(true);
  expect(after.hostLastChild).toBe(true);
  expect(after.documentHitsHost).toBe(true);
});

/* ------------------------------------------------------------------------ */
/* XSS-render-inert representative (ING-07 pass 2)                          */
/* ------------------------------------------------------------------------ */

const BASE_META = {
  type: 'bug' as const,
  title: 'ING-07 probe',
  url: '/ing-07',
};

async function postMeta(
  request: import('@playwright/test').APIRequestContext,
  meta: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const png = readFileSync(resolve(repoRoot, 'e2e/fixtures/valid-64x64.png'));
  const res = await request.post('/api/incidents', {
    multipart: {
      meta: JSON.stringify(meta),
      image: { name: 'shot.png', mimeType: 'image/png', buffer: png },
    },
    headers: { 'X-Project-Key': projectKey(), 'Idempotency-Key': `e2e-ing07-${randomUUID()}` },
  });
  return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
}

async function storedRow(
  request: import('@playwright/test').APIRequestContext,
  id: string,
): Promise<Record<string, unknown>> {
  const list = (await (await request.get('/api/incidents')).json()) as Array<Record<string, unknown>>;
  const row = list.find((r) => r.id === id);
  expect(row, `incident ${id} must appear in the list`).toBeDefined();
  return row as Record<string, unknown>;
}

test('ING-07 pass 2: stored hostile payloads render as literal text and inject zero elements into the panel DOM', async ({ page, request }) => {
  const titles = [
    '&lt;img src=x onerror=alert(1)&gt;',
    '2 < 3 & 4 > 1',
    '<b>a</b><i>b</i>',
    'Hello <img src=x onerror=alert(1)> world',
  ];
  for (const title of titles) {
    const res = await postMeta(request, { ...BASE_META, title });
    expect(res.status, `payload ${JSON.stringify(title)} must store`).toBe(201);
  }

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Watchbug' })).toBeVisible();
  await expect(page.locator('aside button').first()).toBeVisible();

  const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const normalise = (s: string): string => s.replace(/\s+/g, ' ');
  expect(bodyText).toContain(normalise('Hello  world'));
  expect(bodyText).toContain('2 < 3 & 4 > 1');
  expect(bodyText).toContain('ab');
  expect(bodyText).toContain('&lt;img src=x onerror=alert(1)&gt;');

  const detailHeading = page.locator('main h2');
  await expect(detailHeading).toHaveCount(1);
  expect((await detailHeading.innerText()).replace(/\s+/g, ' ')).toContain('Hello world');

  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.locator('[onerror]')).toHaveCount(0);
  await expect(page.locator('script:not([src])')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);

  const shot = page.locator('main img');
  await expect(shot).toHaveCount(1);
  expect((await shot.getAttribute('src')) ?? '').toMatch(/^\/api\/incidents\/[0-9a-f-]{36}\/image$/);
});
