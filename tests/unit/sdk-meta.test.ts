import { describe, it, expect } from 'vitest';
import { MAX_TITLE_CHARS, MAX_URL_PATH_CHARS } from '@watchbug/contracts/constants';
import { buildMeta, filenameFor } from '@watchbug/sdk/transport/lane1.ts';

/**
 * Unit lane for the SDK's `meta` seeding — the conversion target of
 * `sdk.spec.ts` **P2-D-01** (03-08 Batch 3a).
 *
 * `buildMeta` is the single production clamp for the host-controlled
 * `document.title` and for the report URL (R-08). Both are pure: the helper
 * only reads `doc.title` and `loc.pathname`, so a plain object stands in for
 * the DOM and no browser is needed. The assertions match the e2e row that was
 * moved here one-for-one — the same 100-ASCII + 200-emoji fixture, the same
 * "exactly MAX_TITLE_CHARS code points" threshold — plus the surrogate-pair
 * and path-only edges the row proved on the wire.
 *
 * The two browser halves of the deleted row survive elsewhere and are named
 * in `03-08-CONVERSION-LEDGER.md`: "the segment defaults to bug and reaches the
 * wire" is J-02 (`INT-02` asserts `"type":"bug"` in the sent meta) and "the
 * composer prefills the clamped title" is J-02's `P3-D-02` row.
 */

/** `buildMeta` reads exactly `title`; nothing else is touched. */
function doc(title: string | undefined): Document {
  return { title } as unknown as Document;
}

/** `buildMeta` reads exactly `pathname`; `href`/`search`/`hash` are ignored. */
function loc(pathname: string): Location {
  return { pathname } as unknown as Location;
}

describe('unit: sdk buildMeta (P2-D-01)', () => {
  it('clamps document.title to exactly MAX_TITLE_CHARS code points', () => {
    // 300 code points but 500 UTF-16 units — the cap must count code points,
    // matching the Zod `.max(MAX_TITLE_CHARS)` semantics the server applies.
    const longTitle = `${'A'.repeat(100)}${'\u{1F600}'.repeat(200)}`;
    expect([...longTitle].length).toBe(300);

    const meta = buildMeta(doc(longTitle), loc('/form'));

    expect([...meta.title].length).toBe(MAX_TITLE_CHARS);
    expect(meta.title).toBe([...longTitle].slice(0, MAX_TITLE_CHARS).join(''));
    expect(meta.title).toBe(`${'A'.repeat(100)}${'\u{1F600}'.repeat(100)}`);
  });

  it('never splits a surrogate pair at the cap', () => {
    const longTitle = `${'A'.repeat(100)}${'\u{1F600}'.repeat(200)}`;
    const { title } = buildMeta(doc(longTitle), loc('/form'));

    // A unit-boundary cut would leave a lone surrogate here; the code-point
    // slice cannot.
    expect(title.isWellFormed()).toBe(true);
    expect(title).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(title).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });

  it('leaves a title at exactly the cap unchanged', () => {
    const atCap = 'B'.repeat(MAX_TITLE_CHARS);
    expect([...atCap].length).toBe(MAX_TITLE_CHARS);
    expect(buildMeta(doc(atCap), loc('/form')).title).toBe(atCap);
  });

  it('trims surrounding whitespace before clamping', () => {
    const meta = buildMeta(doc('  padded title  '), loc('/form'));
    expect(meta.title).toBe('padded title');
  });

  it('falls back to "Untitled page" for an empty, whitespace-only or missing title', () => {
    expect(buildMeta(doc(''), loc('/form')).title).toBe('Untitled page');
    expect(buildMeta(doc('   '), loc('/form')).title).toBe('Untitled page');
    expect(buildMeta(doc(undefined), loc('/form')).title).toBe('Untitled page');
  });
});

describe('unit: sdk buildMeta url (PRV-06 / R-08)', () => {
  it('keeps the pathname only — a query string and fragment never seed meta.url', () => {
    // `href` would carry `?token=secret`; only `pathname` is ever read.
    const meta = buildMeta(doc('PRV-06 path-only report'), loc('/checkout/step-2'));
    expect(meta.url).toBe('/checkout/step-2');
    expect(meta.url).not.toContain('?');
    expect(meta.url).not.toContain('#');
    expect(meta.url).not.toContain('://');
  });

  it('clamps the path at MAX_URL_PATH_CHARS', () => {
    const longPath = `/${'a'.repeat(MAX_URL_PATH_CHARS * 2)}`;
    const { url } = buildMeta(doc('long path'), loc(longPath));
    expect(url.length).toBe(MAX_URL_PATH_CHARS);
  });
});

describe('unit: sdk filenameFor (CA-01 image part)', () => {
  it('names the part after the bytes the engine actually produced', () => {
    expect(filenameFor('image/webp')).toBe('screenshot.webp');
    expect(filenameFor('image/png')).toBe('screenshot.png');
    // The R-11 fallback is silent: an unknown type is a PNG.
    expect(filenameFor('image/jpeg')).toBe('screenshot.png');
    expect(filenameFor('')).toBe('screenshot.png');
  });
});
