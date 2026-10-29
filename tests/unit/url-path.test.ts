import { describe, it, expect } from 'vitest';

/**
 * Unit test for URL path extraction logic.
 *
 * This is a pure function test that exercises the same logic used by the
 * API's ingest route to strip query strings and fragments from URLs.
 * It does not require a running server — it tests the logic in isolation.
 */

function extractPathOnly(url: string): string {
  try {
    const parsed = new URL(url, 'http://localhost');
    return parsed.pathname;
  } catch {
    // If the URL is already path-only or malformed, return as-is (fallback)
    return url.split('?')[0].split('#')[0];
  }
}

describe('unit: URL path extraction', () => {
  it('strips query string and fragment', () => {
    expect(extractPathOnly('/checkout?token=secret&session=abc#step-2')).toBe('/checkout');
  });

  it('strips only fragment when no query', () => {
    expect(extractPathOnly('/dashboard#section-3')).toBe('/dashboard');
  });

  it('strips only query when no fragment', () => {
    expect(extractPathOnly('/search?q=watchbug')).toBe('/search');
  });

  it('preserves path when clean', () => {
    expect(extractPathOnly('/settings/profile')).toBe('/settings/profile');
  });

  it('handles root path', () => {
    expect(extractPathOnly('/')).toBe('/');
  });

  it('handles empty string', () => {
    expect(extractPathOnly('')).toBe('/');
  });

  it('handles path with multiple slashes', () => {
    expect(extractPathOnly('/api/v1/incidents/123?foo=bar#baz')).toBe('/api/v1/incidents/123');
  });
});