import { describe, it, expect, beforeEach } from 'vitest';
import { saveDraft, loadDraft, removeDraft, getAllDrafts, getAllDraftsWithKeys } from '../../sdk/src/transport/draft';
import type { ReportPayload } from '../../sdk/src/capture/batcher';

function makeReport(notes = 'test'): ReportPayload {
  return {
    type: 'bug',
    screenshot: 'data:image/png;base64,abc',
    metadata: { url: 'https://example.com', userAgent: 'agent', timestamp: new Date().toISOString() },
    consoleLogs: [],
    errors: [],
    notes,
  };
}

describe('draft', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveDraft stores report in localStorage', () => {
    saveDraft(makeReport('hello'));
    const all = getAllDrafts();
    expect(all).toHaveLength(1);
    expect(all[0].notes).toBe('hello');
  });

  it('loadDraft returns most recent draft', async () => {
    saveDraft(makeReport('first'));
    // ensure timestamp difference
    await new Promise((r) => setTimeout(r, 5));
    saveDraft(makeReport('second'));
    const latest = loadDraft();
    expect(latest).not.toBeNull();
    expect(latest!.notes).toBe('second');
  });

  it('removeDraft deletes specific draft', () => {
    saveDraft(makeReport('a'));
    const withKeys = getAllDraftsWithKeys();
    expect(withKeys).toHaveLength(1);
    removeDraft(withKeys[0].key);
    expect(getAllDrafts()).toHaveLength(0);
  });

  it('getAllDrafts returns all saved drafts', async () => {
    saveDraft(makeReport('1'));
    await new Promise((r) => setTimeout(r, 2));
    saveDraft(makeReport('2'));
    await new Promise((r) => setTimeout(r, 2));
    saveDraft(makeReport('3'));
    const all = getAllDrafts();
    expect(all).toHaveLength(3);
  });
});
