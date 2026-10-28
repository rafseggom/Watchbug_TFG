import type { Page } from '@playwright/test';

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
 * `completeComposer` — the assertion-free walk the ~30 migrated Phase-2 rows
 * will use — is authored with its final form and its first caller in 03-07
 * Task 1; nothing in waves 1-4 calls it.
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
