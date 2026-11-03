import { describe, it, expect } from 'vitest';
import { MAX_REASON_CHARS, truncateReason } from '@watchbug/sdk/widget/status-panel.ts';

/**
 * Unit lane for the server-reason clamp — the conversion target of the
 * pure-logic half of `sdk.spec.ts` **"UI-SPEC backstop: a long server reason
 * renders truncated to 240 chars"** (03-08 Batch 3a).
 *
 * `truncateReason` is the whole clamp: the panel writes its result with
 * `textContent`, so what this function returns *is* what the user reads. The
 * row's rendering assertions (the text lands inside a ≤320 px panel) stay in
 * the e2e suite; everything the row asserted about the *string* is here, with
 * the same long fixture the row used.
 */

const LONG_REASON =
  'The report was rejected because the project key does not match any active project on this server. ' +
  'Check the key configured in your deployment, then try again once it has been corrected. ' +
  'Nothing has been stored and no attachment was written to disk.';

const ELLIPSIS = '\u2026';

describe('unit: truncateReason (UI-SPEC backstop)', () => {
  it('caps the panel reason at MAX_REASON_CHARS', () => {
    expect(MAX_REASON_CHARS).toBe(240);
    expect(LONG_REASON.length).toBeGreaterThan(MAX_REASON_CHARS);

    const reason = truncateReason(LONG_REASON);

    expect(reason.length).toBeLessThanOrEqual(MAX_REASON_CHARS);
    expect(reason.startsWith('The report was rejected')).toBe(true);
  });

  it('ends in exactly one ellipsis — never a doubled one', () => {
    const reason = truncateReason(LONG_REASON);
    expect(reason.endsWith(ELLIPSIS)).toBe(true);
    expect(reason).not.toContain(`${ELLIPSIS}${ELLIPSIS}`);
  });

  it('cuts at a word boundary so no word is halved', () => {
    const reason = truncateReason(LONG_REASON);
    const kept = reason.slice(0, -ELLIPSIS.length);

    // The kept prefix must be a real prefix of the input…
    expect(LONG_REASON.startsWith(kept)).toBe(true);
    // …and must stop exactly where a word ends: the very next input character
    // is the space that was dropped, not the middle of a word.
    expect(LONG_REASON[kept.length]).toBe(' ');
    expect(kept.endsWith(' ')).toBe(false);
  });

  it('returns a reason at or under the cap verbatim', () => {
    expect(truncateReason('Project key not recognised')).toBe('Project key not recognised');
    expect(truncateReason('')).toBe('');

    const atCap = 'x'.repeat(MAX_REASON_CHARS);
    expect(truncateReason(atCap)).toBe(atCap);
  });

  it('honours an explicit max and never splits a surrogate pair', () => {
    const reason = truncateReason(`${'word '.repeat(10)}${'\u{1F600}'.repeat(20)}`, 40);
    expect(reason.length).toBeLessThanOrEqual(40);
    expect(reason.isWellFormed()).toBe(true);
    expect(reason.endsWith(ELLIPSIS)).toBe(true);
  });
});
