import type { ReportPayload } from '../capture/batcher';

const DRAFT_PREFIX = 'watchbug_draft_';

function isLocalStorageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function';
  } catch {
    return false;
  }
}

/**
 * Persist a report draft per D-08.
 * Key: watchbug_draft_${Date.now()}_${random}
 */
export function saveDraft(report: ReportPayload): void {
  if (!isLocalStorageAvailable()) return;
  const key = `${DRAFT_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    localStorage.setItem(key, JSON.stringify(report));
  } catch {
    // storage full or unavailable — silently ignore per offline tolerance
  }
}

/**
 * Load the most recent draft (highest timestamp suffix).
 */
export function loadDraft(): ReportPayload | null {
  if (!isLocalStorageAvailable()) return null;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(DRAFT_PREFIX)) keys.push(k);
  }
  if (keys.length === 0) return null;
  // Sort by numeric timestamp part descending
  keys.sort((a, b) => {
    const ta = parseInt(a.slice(DRAFT_PREFIX.length).split('_')[0] ?? '0', 10);
    const tb = parseInt(b.slice(DRAFT_PREFIX.length).split('_')[0] ?? '0', 10);
    return tb - ta;
  });
  const latest = keys[0];
  try {
    const raw = localStorage.getItem(latest);
    if (!raw) return null;
    return JSON.parse(raw) as ReportPayload;
  } catch {
    return null;
  }
}

/**
 * Remove a specific draft by full key or suffix.
 */
export function removeDraft(key: string): void {
  if (!isLocalStorageAvailable()) return;
  const fullKey = key.startsWith(DRAFT_PREFIX) ? key : `${DRAFT_PREFIX}${key}`;
  try {
    // Try fullKey first, then also try exact key as fallback
    if (localStorage.getItem(fullKey) !== null) {
      localStorage.removeItem(fullKey);
    } else if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
    } else {
      // If key is ambiguous, scan for match
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k === key || k === fullKey) {
          localStorage.removeItem(k);
          break;
        }
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Return all saved drafts.
 */
export function getAllDrafts(): ReportPayload[] {
  if (!isLocalStorageAvailable()) return [];
  const result: ReportPayload[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(DRAFT_PREFIX)) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) result.push(JSON.parse(raw) as ReportPayload);
      } catch {
        // skip malformed
      }
    }
  }
  return result;
}

/**
 * Helper: return drafts with their storage keys (for retry UI).
 */
export function getAllDraftsWithKeys(): Array<{ key: string; report: ReportPayload }> {
  if (!isLocalStorageAvailable()) return [];
  const result: Array<{ key: string; report: ReportPayload }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(DRAFT_PREFIX)) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) result.push({ key: k, report: JSON.parse(raw) as ReportPayload });
      } catch {
        // skip
      }
    }
  }
  return result;
}
