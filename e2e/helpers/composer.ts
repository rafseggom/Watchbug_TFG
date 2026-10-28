import { expect, type Page } from '@playwright/test';

/**
 * Composer/review harness (03-03 Wave-0 gap: the DOM contract is fixed by the
 * plan, this file is the one vocabulary every later row uses).
 *
 * Every read and click pierces the **open-mode** shadow root (R-14 /
 * Pitfall 10) — production rows never need it. Clicks run through
 * `element.click()` in page scope: no composer walk here needs transient
 * activation (only the launcher gesture does, and `clickLauncher` keeps
 * using the real trusted mouse click).
 *
 * `completeComposer` — the assertion-free walk every migrated Phase-2 row
 * uses — was authored here by 03-07 Task 1 with its first caller
 * (`runRedactionRow`). It never waits for `Report sent` itself: the caller
 * keeps its own terminal assertion, which is what distinguishes a send that
 * landed from one that merely navigated.
 */

/** Wait until the composer overlay owns the screen (data-wb-screen). */
export async function waitForComposer(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
      const composer = root?.querySelector('section.composer');
      return (
        (root?.querySelector('.wrap')?.getAttribute('data-wb-screen') ?? '') === 'composer' &&
        (composer?.getAttribute('data-hidden') ?? 'true') !== 'true'
      );
    },
    null,
    { timeout },
  );
}

/** Wait until the review overlay owns the screen. */
export async function waitForReview(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
      const review = root?.querySelector('section.review');
      return (
        (root?.querySelector('.wrap')?.getAttribute('data-wb-screen') ?? '') === 'review' &&
        (review?.getAttribute('data-hidden') ?? 'true') !== 'true'
      );
    },
    null,
    { timeout },
  );
}

/** Write a value into the composer title field as if the user typed it. */
export async function setTitle(page: Page, value: string): Promise<void> {
  await page.evaluate((title) => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const input = root?.querySelector('.composer-title') as HTMLInputElement | null;
    if (input === null) throw new Error('setTitle: no .composer-title (open-mode root)');
    input.value = title;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

/** Write a value into the composer note field as if the user typed it. */
export async function setNote(page: Page, value: string): Promise<void> {
  await page.evaluate((note) => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const field = root?.querySelector('.composer-note') as HTMLTextAreaElement | null;
    if (field === null) throw new Error('setNote: no .composer-note (open-mode root)');
    field.value = note;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

/** Click the bug/feedback segment for `type`. */
export async function setType(page: Page, type: 'bug' | 'feedback'): Promise<void> {
  await page.evaluate((which) => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const button = root?.querySelector(`button.segment[data-wb-type="${which}"]`) as HTMLElement | null;
    if (button === null) throw new Error(`setType: no segment for ${which}`);
    button.click();
  }, type);
}

/** Click `Review report` (validates, then the router encodes and shows review). */
export async function clickComposerReview(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const button = root?.querySelector('button.composer-review') as HTMLElement | null;
    if (button === null) throw new Error('clickComposerReview: no .composer-review');
    button.click();
  });
}

/** Click `Edit report` on the review screen. */
export async function clickReviewEdit(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const button = root?.querySelector('button.review-edit') as HTMLElement | null;
    if (button === null) throw new Error('clickReviewEdit: no .review-edit');
    button.click();
  });
}

/** Click `Send report` on the review screen. */
export async function clickReviewSend(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const button = root?.querySelector('button.review-send') as HTMLElement | null;
    if (button === null) throw new Error('clickReviewSend: no .review-send');
    button.click();
  });
}

/** Click the composer locale toggle for `code` (WDG-06 override row). */
export async function setLocaleToggle(page: Page, code: 'en' | 'es'): Promise<void> {
  await page.evaluate((which) => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const button = root?.querySelector(`button.locale-toggle[data-wb-locale="${which}"]`) as HTMLElement | null;
    if (button === null) throw new Error(`setLocaleToggle: no toggle for ${which}`);
    button.click();
  }, code);
}

/** The two-step every composer row uses after setting its fields. */
export async function reviewAndSend(page: Page): Promise<void> {
  await clickComposerReview(page);
  await waitForReview(page);
  await clickReviewSend(page);
}

/**
 * The file lane (CAP-02). `setInputFiles` works through the open-mode shadow
 * root without the OS picker; the composer's `data-wb-attaching` flag is the
 * settle signal (decode is async), so a row never observes a half-applied
 * attachment. The two-phase wait tolerates a rejection that settles before
 * the first poll.
 */
export async function attachImage(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  await page.locator('watchbug-host input.composer-file').setInputFiles({
    name: file.name,
    mimeType: file.mimeType,
    buffer: file.buffer,
  });
  await page
    .waitForFunction(
      () =>
        (
          document.querySelector('watchbug-host')?.shadowRoot?.querySelector('section.composer') ??
          null
        )?.getAttribute('data-wb-attaching') === 'true',
      null,
      { timeout: 3_000 },
    )
    .catch(() => undefined);
  await page.waitForFunction(
    () =>
      (
        document.querySelector('watchbug-host')?.shadowRoot?.querySelector('section.composer') ??
        null
      )?.getAttribute('data-wb-attaching') !== 'true',
    null,
    { timeout: 20_000 },
  );
}

/** Wait until the composer's image zone is in `state` (DOM contract). */
export async function expectZoneState(
  page: Page,
  state: 'image' | 'text-only' | 'degraded',
): Promise<void> {
  await page.waitForFunction(
    (want) => {
      const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
      const composer = root?.querySelector('section.composer');
      return (
        (composer?.getAttribute('data-hidden') ?? 'true') !== 'true' &&
        composer?.getAttribute('data-wb-state') === want
      );
    },
    state,
    { timeout: 10_000 },
  );
}

/** Click the `Continue with text only` action inside the degraded notice. */
export async function clickContinueTextOnly(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const button = root?.querySelector('button.composer-continue-text') as HTMLElement | null;
    if (button === null) throw new Error('clickContinueTextOnly: no .composer-continue-text');
    button.click();
  });
}

/** Click the ONE visible `Attach image` action (footer or degraded notice). */
export async function clickVisibleAttach(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
    const visible = [...(root?.querySelectorAll('button.composer-attach') ?? [])].filter(
      (button) => button.getBoundingClientRect().width > 0,
    );
    if (visible.length === 0) throw new Error('clickVisibleAttach: no visible .composer-attach');
    visible[0].click();
  });
}

/** What `completeComposer` may check or fill before walking to Send. */
export interface CompleteComposerOptions {
  /** Type into the title field ONLY when provided. */
  title?: string;
  /** Type into the note field ONLY when provided. */
  note?: string;
  /** Click that bug/feedback segment ONLY when provided. */
  type?: 'bug' | 'feedback';
  /** Assert the prefilled title (P2-D-01 -> P3-D-02: prefill = document.title clamped). */
  expectPrefilledTitle?: string;
  /** Assert the default segment (P3-D-03: `bug`). */
  expectDefaultType?: 'bug' | 'feedback';
  /**
   * Poll timeout for the composer/review waits. Default 10 s; rows whose
   * Review-entry encode is heavy (the CAP-05 16 MP / 8192 px frames) pass a
   * larger budget — it is a wait timeout, never an assertion.
   */
  timeout?: number;
}

/**
 * The shared one-walk-closes-the-form helper for the migrated Phase-2 rows
 * (research F4 / PATTERNS S-8): wait for the composer, optionally check the
 * prefill, apply any provided fields, walk `Review report → review → Send
 * report`, and return ONCE THE REQUEST HAS BEEN ISSUED.
 *
 * Deliberately assertion-free about pixels, request counts or terminal copy —
 * the caller keeps its own terminal assertion (`waitForHeadline('Report sent
 * ✓')`, the intercepted meta, the decoded bytes). The request-issued edge is
 * the observable `data-wb-screen === 'status'` switch: `deliver()` renders the
 * status panel synchronously at the Send click (pipeline.ts `onView
 * {kind: 'sending'}` before its first `await`), so the poll returns as soon
 * as the POST is in flight — before any reply can land.
 */
export async function completeComposer(
  page: Page,
  options: CompleteComposerOptions = {},
): Promise<void> {
  const timeout = options.timeout ?? 10_000;
  await waitForComposer(page, timeout);
  if (options.expectPrefilledTitle !== undefined || options.expectDefaultType !== undefined) {
    const prefill = await page.evaluate(() => {
      const root = document.querySelector('watchbug-host')?.shadowRoot ?? null;
      return {
        title: (root?.querySelector('.composer-title') as HTMLInputElement | null)?.value ?? '',
        type:
          root?.querySelector('button.segment[aria-pressed="true"]')?.getAttribute('data-wb-type') ??
          null,
      };
    });
    if (options.expectPrefilledTitle !== undefined) {
      expect(prefill.title, 'composer prefills the title the row expects').toBe(
        options.expectPrefilledTitle,
      );
    }
    if (options.expectDefaultType !== undefined) {
      expect(prefill.type, 'the default segment is what the row expects').toBe(
        options.expectDefaultType,
      );
    }
  }
  if (options.title !== undefined) await setTitle(page, options.title);
  if (options.note !== undefined) await setNote(page, options.note);
  if (options.type !== undefined) await setType(page, options.type);
  await clickComposerReview(page);
  await waitForReview(page, timeout);
  await clickReviewSend(page);
  await page.waitForFunction(
    () =>
      (
        document.querySelector('watchbug-host')?.shadowRoot?.querySelector('.wrap') ?? null
      )?.getAttribute('data-wb-screen') === 'status',
    null,
    { timeout: 15_000 },
  );
}
