import { describe, it, expect } from 'vitest';
import { stripQueryFragment } from '@watchbug/contracts/schema';

/**
 * Unit test for the **production** URL transform (R-08).
 *
 * The previous version re-implemented the logic locally (`new URL(...).pathname`),
 * which returned `/cb` for an absolute URL while the real contract preserves
 * scheme and host. A green test against a copy is not evidence about the code
 * that ships; this one imports `stripQueryFragment` from `packages/contracts`.
 */

describe('unit: contract stripQueryFragment', () => {
  it('strips query string and fragment', () => {
    expect(stripQueryFragment('/checkout?session=abc&step=2#step-2')).toBe('/checkout');
  });

  it('strips only fragment when no query', () => {
    expect(stripQueryFragment('/dashboard#section-3')).toBe('/dashboard');
  });

  it('strips only query when no fragment', () => {
    expect(stripQueryFragment('/search?q=watchbug')).toBe('/search');
  });

  it('preserves path when clean', () => {
    expect(stripQueryFragment('/settings/profile')).toBe('/settings/profile');
  });

  it('handles root path', () => {
    expect(stripQueryFragment('/')).toBe('/');
  });

  it('handles empty string', () => {
    expect(stripQueryFragment('')).toBe('');
  });

  it('handles path with multiple slashes', () => {
    expect(stripQueryFragment('/api/v1/incidents/123?foo=bar#baz')).toBe('/api/v1/incidents/123');
  });

  it('preserves scheme and host on an absolute URL (the contract real behaviour)', () => {
    expect(stripQueryFragment('https://example.test/cb?code=secret#done')).toBe(
      'https://example.test/cb',
    );
  });

  it('is idempotent — the ingest re-validates the already-stripped value', () => {
    const once = stripQueryFragment('/checkout?session=abc#step-2');
    expect(stripQueryFragment(once)).toBe(once);
  });
});
