import { describe, it, expect } from 'vitest';
import { validatePayload } from '../../sdk/src/transport/validation';

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'bug',
    screenshot: 'data:image/png;base64,abc',
    metadata: { url: 'https://example.com', userAgent: 'agent', timestamp: new Date().toISOString() },
    consoleLogs: [{ level: 'log', message: 'hi', timestamp: new Date().toISOString() }],
    errors: [],
    ...overrides,
  };
}

describe('validation', () => {
  it('validatePayload returns valid for correct payload', () => {
    const res = validatePayload(basePayload());
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('validatePayload rejects invalid type', () => {
    const res = validatePayload(basePayload({ type: 'invalid' }));
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toContain('type');
  });

  it('validatePayload rejects empty screenshot', () => {
    const res = validatePayload(basePayload({ screenshot: '' }));
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toContain('screenshot');
  });

  it('validatePayload requires consoleLogs for type=bug per TRN-04', () => {
    const resEmpty = validatePayload(basePayload({ type: 'bug', consoleLogs: [] }));
    expect(resEmpty.valid).toBe(false);
    expect(resEmpty.errors.join(' ')).toContain('consoleLogs');

    const resMissing = validatePayload({ ...basePayload(), consoleLogs: undefined } as unknown as Record<string, unknown>);
    // missing should also be invalid for bug
    const res2 = validatePayload({ type: 'bug', screenshot: 'data:image/png;base64,abc', metadata: { url: 'https://example.com', userAgent: 'a', timestamp: new Date().toISOString() }, errors: [] } as unknown as Record<string, unknown>);
    expect(res2.valid).toBe(false);
  });

  it('validatePayload allows optional consoleLogs for type=feedback per TRN-04', () => {
    const resEmpty = validatePayload(basePayload({ type: 'feedback', consoleLogs: [] }));
    expect(resEmpty.valid).toBe(true);

    const resMissing = validatePayload({ type: 'feedback', screenshot: 'data:image/png;base64,abc', metadata: { url: 'https://example.com', userAgent: 'a', timestamp: new Date().toISOString() }, errors: [] } as unknown as Record<string, unknown>);
    expect(resMissing.valid).toBe(true);

    const resWith = validatePayload(basePayload({ type: 'feedback', consoleLogs: [{ level: 'log', message: 'hi', timestamp: new Date().toISOString() }] }));
    expect(resWith.valid).toBe(true);
  });

  it('validatePayload rejects missing metadata fields', () => {
    const res = validatePayload(basePayload({ metadata: { url: '', userAgent: '', timestamp: '' } }));
    expect(res.valid).toBe(false);
  });

  it('validatePayload requires errors array', () => {
    const res = validatePayload({ ...basePayload(), errors: 'not-array' } as unknown as Record<string, unknown>);
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toContain('errors');
  });
});
