import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration (R-15).
 *
 * `out` points at the committed, reviewable migration set — a migration is an
 * AGENTS.md consultation trigger, so the generated SQL is the artifact owners
 * read in the PR. Credentials come from `DATABASE_URL`; the `db:generate` /
 * `db:migrate` scripts launch this with Node's `--env-file-if-exists=../../.env`
 * so a plain `npm --prefix apps/api run db:migrate` works from the repo root.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
