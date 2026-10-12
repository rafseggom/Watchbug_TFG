import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * Postgres client (R-15: `pg` + `drizzle-orm`, typed SQL — no ORM magic).
 * One pool per process; connections are established lazily, so constructing
 * this module never blocks boot.
 */
export interface Database {
  db: NodePgDatabase<typeof schema>;
  pool: Pool;
  close(): Promise<void>;
}

export function createDb(databaseUrl: string): Database {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  // A dead pool must not become a silent500-factory: surface it loudly.
  pool.on('error', (err) => {
    console.error('[watchbug] unexpected postgres pool error:', err.message);
  });

  return {
    db: drizzle({ client: pool, schema }),
    pool,
    close: () => pool.end(),
  };
}

export type AppDb = Database['db'];
