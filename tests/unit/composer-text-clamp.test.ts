import { describe, it, expect, afterEach } from 'vitest';
import { MAX_NOTE_CHARS, MAX_TITLE_CHARS } from '@watchbug/contracts/constants';
import {
  NOTE_COUNTER_VISIBLE_FROM,
  clampCodePoints,
  codePoints,
} from '@watchbug/sdk/widget/composer.ts';
import { setLocale, t } from '@watchbug/sdk/strings.ts';

/**
 * Unit lane for the composer's code-point arithmetic — the conversion target of
 * the pure-logic half of `sdk.spec.ts` **P3-D-02** and its **note counter**
 * row (03-08 Batch 3a).
 *
 * The composer clamps by code points on purpose: `maxlength` counts UTF-16
 * units, so a non-BMP-heavy title would be cut short of the contract cap and a
 * unit-boundary cut could split a surrogate pair (research Pitfall 13). These
 * are the exported production functions the input handlers call — not copies.
 *
 * The DOM halves of both rows (the prefill landing in `.composer-title`, the
 * `data-shown` flip of `.composer-note-counter`, and "an empty title blocks
 * review") stay in the e2e suite: they observe rendered attributes, which the
 * cheapest layer here cannot reach. See `03-08-CONVERSION-LEDGER.md`.
 */

const EMOJI = '\u{1F600}';

afterEach(() => {
  setLocale('en');
});

describe('unit: codePoints / clampCodePoints (P3-D-02)', () => {
  it('counts code points, not UTF-16 units', () => {
    expect(EMOJI.length).toBe(2);
    expect(codePoints(EMOJI)).toBe(1);
    expect(codePoints(EMOJI.repeat(3))).toBe(3);
    expect(codePoints('ABC')).toBe(3);
    expect(codePoints('')).toBe(0);
  });

  it('clamps a 300-code-point title to exactly MAX_TITLE_CHARS', () => {
    // The P2-D-01/P3-D-02 fixture: 100 ASCII + 200 non-BMP emoji.
    const longTitle = `${'A'.repeat(100)}${EMOJI.repeat(200)}`;
    expect(codePoints(longTitle)).toBe(300);

    const clamped = clampCodePoints(longTitle, MAX_TITLE_CHARS);

    expect(codePoints(clamped)).toBe(MAX_TITLE_CHARS);
    expect(clamped).toBe(`${'A'.repeat(100)}${EMOJI.repeat(100)}`);
    expect(clamped.isWellFormed()).toBe(true);
  });

  it('returns the value unchanged when it is already within the cap', () => {
    const atCap = 'B'.repeat(MAX_TITLE_CHARS);
    expect(clampCodePoints(atCap, MAX_TITLE_CHARS)).toBe(atCap);
    expect(clampCodePoints('short', MAX_TITLE_CHARS)).toBe('short');
    expect(clampCodePoints('', MAX_TITLE_CHARS)).toBe('');
  });

  it('clamps a note at MAX_NOTE_CHARS without splitting a surrogate pair', () => {
    const longNote = `${'n'.repeat(MAX_NOTE_CHARS - 1)}${EMOJI}${EMOJI}`;
    expect(codePoints(longNote)).toBe(MAX_NOTE_CHARS + 1);

    const clamped = clampCodePoints(longNote, MAX_NOTE_CHARS);

    expect(codePoints(clamped)).toBe(MAX_NOTE_CHARS);
    expect(clamped.isWellFormed()).toBe(true);
    expect(clamped.endsWith(EMOJI)).toBe(true);
  });
});

describe('unit: note counter threshold (P3-D-02 note counter)', () => {
  it('surfaces at exactly 4,000 code points and stays hidden at 3,999', () => {
    expect(NOTE_COUNTER_VISIBLE_FROM).toBe(4_000);
    expect(codePoints('a'.repeat(3_999))).toBe(3_999);
    expect(codePoints('a'.repeat(3_999)) >= NOTE_COUNTER_VISIBLE_FROM).toBe(false);
    expect(codePoints('a'.repeat(4_000)) >= NOTE_COUNTER_VISIBLE_FROM).toBe(true);
  });

  it('renders the counter copy the e2e row asserted', () => {
    // `updateCounter` writes exactly `t('composer.note.counter', {used, max})`.
    expect(t('composer.note.counter', { used: 4_000, max: MAX_NOTE_CHARS })).toBe('4000 / 5000');
    expect(MAX_NOTE_CHARS).toBe(5_000);
  });

  it('counts a 4,000-code-point note of non-BMP characters as 4,000, not 8,000', () => {
    // The unit-counting bug this clamp exists to prevent: at 2,000 emoji the
    // counter must still be hidden, at 4,000 emoji it must show.
    expect(codePoints(EMOJI.repeat(2_000))).toBe(2_000);
    expect(codePoints(EMOJI.repeat(2_000)) >= NOTE_COUNTER_VISIBLE_FROM).toBe(false);
    expect(codePoints(EMOJI.repeat(4_000))).toBe(4_000);
    expect(codePoints(EMOJI.repeat(4_000)) >= NOTE_COUNTER_VISIBLE_FROM).toBe(true);
  });
});
