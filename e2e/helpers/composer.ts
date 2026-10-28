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
