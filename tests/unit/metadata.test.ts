import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { collectMetadata } from '../../sdk/src/capture/metadata';

describe('collectMetadata', () => {
  const originalHref = window.location.href;
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1024);
    vi.stubGlobal('innerHeight', 768);
    Object.defineProperty(window, 'screen', {
      value: { width: 1920, height: 1080 },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('collectMetadata returns URL from window.location.href', () => {
    const fakeHref = 'https://example.com/test-page';
    Object.defineProperty(window, 'location', {
      value: { href: fakeHref },
      writable: true,
      configurable: true,
    });
    const meta = collectMetadata();
    expect(meta.url).toBe(fakeHref);
  });

  it('collectMetadata returns userAgent from navigator.userAgent', () => {
    const fakeUA = 'Mozilla/5.0 TestAgent/1.0';
    Object.defineProperty(window.navigator, 'userAgent', {
      value: fakeUA,
      configurable: true,
    });
    const meta = collectMetadata();
    expect(meta.userAgent).toBe(fakeUA);
    // restore
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it('collectMetadata includes screen and viewport dimensions', () => {
    vi.stubGlobal('innerWidth', 1366);
    vi.stubGlobal('innerHeight', 768);
    Object.defineProperty(window, 'screen', {
      value: { width: 2560, height: 1440 },
      writable: true,
      configurable: true,
    });
    const meta = collectMetadata();
    expect(meta.screenWidth).toBe(2560);
    expect(meta.screenHeight).toBe(1440);
    expect(meta.viewportWidth).toBe(1366);
    expect(meta.viewportHeight).toBe(768);
  });

  it('collectMetadata timestamp is ISO format', () => {
    const meta = collectMetadata();
    // ISO 8601: YYYY-MM-DDTHH:MM:SS.mmmZ
    expect(meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // Should be parseable
    const date = new Date(meta.timestamp);
    expect(date.toISOString()).toBe(meta.timestamp);
  });

  it('collectMetadata includes language from navigator.language', () => {
    Object.defineProperty(window.navigator, 'language', {
      value: 'es-ES',
      configurable: true,
    });
    const meta = collectMetadata();
    expect(meta.language).toBe('es-ES');

    Object.defineProperty(window.navigator, 'language', {
      value: 'en-US',
      configurable: true,
    });
    const meta2 = collectMetadata();
    expect(meta2.language).toBe('en-US');
  });

  it('collectMetadata returns object with all required fields', () => {
    const meta = collectMetadata();
    expect(meta).toHaveProperty('url');
    expect(meta).toHaveProperty('userAgent');
    expect(meta).toHaveProperty('screenWidth');
    expect(meta).toHaveProperty('screenHeight');
    expect(meta).toHaveProperty('viewportWidth');
    expect(meta).toHaveProperty('viewportHeight');
    expect(meta).toHaveProperty('timestamp');
    expect(meta).toHaveProperty('language');
    expect(typeof meta.url).toBe('string');
    expect(typeof meta.userAgent).toBe('string');
    expect(typeof meta.screenWidth).toBe('number');
    expect(typeof meta.screenHeight).toBe('number');
    expect(typeof meta.viewportWidth).toBe('number');
    expect(typeof meta.viewportHeight).toBe('number');
    expect(typeof meta.timestamp).toBe('string');
    expect(typeof meta.language).toBe('string');
  });
});
