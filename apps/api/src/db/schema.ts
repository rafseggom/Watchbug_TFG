import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Drizzle schema for the Walking Skeleton (R-15 / Pattern 4).
 *
 * ⚠ A migration is an AGENTS.md consultation trigger — this shape is the
 * artifact the owner reviews, so everything that must exist from day one is
 * here: TTL columns (M-1/A-02), the idempotency uniqueness (ING-03) and the
 * enum-as-text CHECK constraints (no pgEnum migration churn later).
 *
 * Columns are snake_case to match the SQL (naming convention in AGENTS.md).
 */

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /** Public, write-only project key (`wkbt_…`) — P1-D-03, SEC-03. */
  publicKey: text('public_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    /** Client-generated; retried submissions reuse it (ING-03). */
    idempotencyKey: text('idempotency_key').notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    note: text('note'),
    url: text('url'),
    /** Identity columns are separable and purgeable on their own TTL (M-1/A-02). */
    userId: text('user_id'),
    userName: text('user_name'),
    userEmail: text('user_email'),
    identityPurgeAt: timestamp('identity_purge_at', { withTimezone: true }).notNull(),
    artifactPurgeAt: timestamp('artifact_purge_at', { withTimezone: true }).notNull(),
    /** Server-generated Storage key — the request never names a file (C-4).
     *  NULL for a CAP-03 text-only report: no screenshot, no blob. The one
     *  invariant `storageKey === null` has exactly two readers: the blob
     *  route's 404 branch and `purge.ts`'s skip guard. */
    storageKey: text('storage_key'),
    /** Screenshot MIME, or null when the report carries no image (CAP-03).
     *  `'image/jpeg'` joins the allowlist per P3-D-14 (the CHECK widens for the
     *  03-02 attach lane; a CHECK over NULL evaluates to UNKNOWN, which passes —
     *  imageless rows satisfy it for free). */
    contentType: text('content_type'),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The concurrency guarantee for ING-03: uniqueness lives in the database,
    // never in an application-level check-then-insert.
    uniqueIndex('incidents_project_idempotency_unique').on(t.projectId, t.idempotencyKey),
    check('incidents_type_check', sql`${t.type} in ('bug', 'feedback')`),
    check('incidents_content_type_check', sql`${t.contentType} in ('image/webp', 'image/png', 'image/jpeg')`),
    check('incidents_status_check', sql`${t.status} in ('pending', 'in_progress', 'resolved')`),
    index('incidents_project_created_idx').on(t.projectId, t.createdAt),
  ],
);

export type Project = typeof projects.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
