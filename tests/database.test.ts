import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { expect, it } from 'vitest';
import { createDatabaseContext, type DatabaseContext } from '@/server/db';
import { seedPlans } from '@/server/db/seed';
import { users } from '@/server/db/schema';
import { createAccount } from './helpers/database';

it('retrouve les données PGlite après une fermeture et une réouverture sur disque', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'woob-pglite-restart-'));
  const previousDataDir = process.env.WOOB_DATA_DIR;
  let context: DatabaseContext | undefined;

  try {
    process.env.WOOB_DATA_DIR = dataDir;
    context = await createDatabaseContext();
    await seedPlans(context.db);
    const account = await createAccount(context.db, 'restart-persistence@example.com', 'Persistance');
    await context.close();
    context = undefined;

    context = await createDatabaseContext();
    const persisted = await context.db.select().from(users).where(eq(users.id, account.user.id));
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.email).toBe('restart-persistence@example.com');
  } finally {
    if (context) await context.close();
    if (previousDataDir === undefined) delete process.env.WOOB_DATA_DIR;
    else process.env.WOOB_DATA_DIR = previousDataDir;
    await rm(dataDir, { recursive: true, force: true });
  }
}, 60_000);
