import { and, eq, isNotNull, lte, or } from 'drizzle-orm';
import type { AppDb } from './db/client';
import { incidents } from './db/schema';
import type { Storage } from './ports';

/**
 * TTL purge job (S-2 / RET-01, RET-02; R-09, R-10).
 *
 * The schema, migration and `.env.example` promise that identity fields
 * (`user.id/name/email`) purge on the identity TTL and the whole incident
 * (row + attachment blob) purges on the artifact TTL. Without this module
 * those `*_purge_at` columns are decorative and every row keeps live PII
 * forever — the exact "TTL retention is decorative" finding this job closes
 * (INFORME-ANALISIS §4.1-2).
 *
 * Design constraints (from the plan, not reopened here):
 *
 * - **No schema change.** Both purge columns already exist
 *   (`db/schema.ts`), so touching the schema would be a Drizzle migration
 *   and an AGENTS.md consultation trigger. A purge-scan index is
 *   deliberately skipped: the artifact retention bound keeps the table
 *   small and the sweep runs at most once a minute.
 * - **Blob deletion only through the `Storage` seam.** This module imports
 *   no `node:fs`/`node:path` and never builds a path: `storage.delete(key)`
 *   is where `FsStorage.pathFor` re-validates `STORAGE_KEY_REGEX` and the
 *   volume-root prefix (T-m3v-01).
 * - **INV-03 / no new dependency.** The job runs INSIDE the api process with
 *   a plain `setInterval` (no cron sidecar, no scheduler library).
 * - **Resilience.** Every failure path is caught and logged; a dead DB can
 *   never reject boot or crash the process (T-m3v-02).
 */

/** Artifact sweep batch size — bounds one tick's row/blob work (T-m3v-02). */
const ARTIFACT_BATCH = 100;

export interface PurgeDeps {
  db: AppDb;
  storage: Storage;
  /** Sweep cadence in minutes; validated positive-integer by config `readInt`. */
  intervalMinutes: number;
}

export interface PurgeHandle {
  stop(): void;
}

/**
 * One-shot sweep: strip due identity fields, then delete due incidents
 * (blob first, row second). Exported for the scripted proof and retries.
 */
export async function runPurge(deps: PurgeDeps): Promise<void> {
  const { db, storage } = deps;
  const now = new Date();

  // Identity sweep (RET-01 / R-09): one set-based UPDATE. The `or(isNotNull…)`
  // guard is the idempotency mechanism — `identity_purge_at` stays in the past
  // after a purge, so a row already stripped never matches again.
  const stripped = await db
    .update(incidents)
    .set({ userId: null, userName: null, userEmail: null })
    .where(
      and(
        lte(incidents.identityPurgeAt, now),
        or(
          isNotNull(incidents.userId),
          isNotNull(incidents.userName),
          isNotNull(incidents.userEmail),
        ),
      ),
    )
    .returning({ id: incidents.id });

  // Artifact sweep (RET-02 / R-10). Blob first, row second — the reverse
  // ordering would leave a rowless blob this by-row job can never observe
  // again (WR-03, incidents.ts): an unrecoverable volume leak. On a blob
  // failure the row is kept as the pointer and retried next tick, which is
  // safe because `FsStorage.delete` is `rm(…, { force: true })` (T-m3v-06).
  const due = await db
    .select({ id: incidents.id, storageKey: incidents.storageKey })
    .from(incidents)
    .where(lte(incidents.artifactPurgeAt, now))
    .limit(ARTIFACT_BATCH);

  let deleted = 0;
  for (const row of due) {
    // CAP-03: an imageless row has no blob — the null key is never handed to
    // the Storage seam (the one invariant, read here and by the blob route's
    // 404). The row is still deleted and still counted, so the TTL sweep
    // survives mixed rows without an exception path (T-03-08).
    if (row.storageKey !== null) {
      try {
        await storage.delete(row.storageKey);
      } catch (err) {
        // Counts and uuids only — never the PII the job exists to destroy
        // (T-m3v-03).
        console.error(`[watchbug] purge: artifact blob delete failed (id=${row.id}, kept for retry):`, err);
        continue;
      }
    }
    await db.delete(incidents).where(eq(incidents.id, row.id));
    deleted += 1;
  }

  // Repudiation guard (T-m3v-04): every non-empty sweep is observable.
  if (stripped.length > 0 || deleted > 0) {
    console.log(`[watchbug] purge: identity=${stripped.length} artifacts=${deleted}`);
  }
}

/**
 * Start the TTL purge job: one caught fire-and-forget boot sweep (boot never
 * awaits it — a dead DB cannot fail `buildApp`/`listen`) followed by an
 * `unref()`-ed interval. The `running` flag makes a slow sweep skip
 * overlapping ticks instead of stacking queries.
 */
export function startPurge(deps: PurgeDeps): PurgeHandle {
  let running = false;

  const sweep = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await runPurge(deps);
    } catch (err) {
      console.error('[watchbug] purge sweep failed:', err);
    } finally {
      running = false;
    }
  };

  void sweep();

  const timer = setInterval(() => {
    void sweep();
  }, deps.intervalMinutes * 60_000);
  timer.unref();

  return {
    stop(): void {
      clearInterval(timer);
    },
  };
}
