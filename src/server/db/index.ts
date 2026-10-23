import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePostgres, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = PgliteDatabase<typeof schema> | NodePgDatabase<typeof schema>;
export type DatabaseContext = {
  db: Db;
  engine: 'pglite' | 'postgresql';
  close: () => Promise<void>;
};

const globalDb = globalThis as typeof globalThis & { __woobDbPromise?: Promise<DatabaseContext> | undefined };

export async function createDatabaseContext(options: { memory?: boolean } = {}): Promise<DatabaseContext> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl && !options.memory) {
    const ssl = process.env.PGSSL === 'disable' ? false : process.env.PGSSL === 'require' ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' } : undefined;
    const pool = new Pool({ connectionString: databaseUrl, max: 10, ssl });
    const db = drizzlePostgres(pool, { schema });
    await migratePostgres(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
    return { db, engine: 'postgresql', close: () => pool.end() };
  }

  const dataDir = options.memory ? undefined : (process.env.WOOB_DATA_DIR || '.woob-data');
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  return { db, engine: 'pglite', close: () => client.close() };
}

export function getDatabaseContext(): Promise<DatabaseContext> {
  if (!globalDb.__woobDbPromise) {
    globalDb.__woobDbPromise = createDatabaseContext().catch((error) => {
      globalDb.__woobDbPromise = undefined;
      throw error;
    });
  }
  return globalDb.__woobDbPromise;
}

export async function getDb(): Promise<Db> {
  return (await getDatabaseContext()).db;
}

export async function resetDatabaseContextForTests(): Promise<void> {
  if (globalDb.__woobDbPromise) {
    const context = await globalDb.__woobDbPromise;
    await context.close();
    globalDb.__woobDbPromise = undefined;
  }
}
