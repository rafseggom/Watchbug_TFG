import type { AppDb } from '../db/client';
import { projects } from '../db/schema';

/**
 * Boot-time project seed (P1-D-01): the single `.env`-supplied public key
 * becomes a `projects` row, so `X-Project-Key` lookups hit an indexed row
 * instead of a magic string comparison.
 *
 * Idempotent by construction (`ON CONFLICT DO NOTHING`): booting twice, or
 * racing a concurrent boot, never duplicates or fails.
 */
export async function seedProject(
  db: AppDb,
  publicKey: string,
  name = 'Default project',
): Promise<void> {
  await db
    .insert(projects)
    .values({ name, publicKey })
    .onConflictDoNothing({ target: projects.publicKey });
}
