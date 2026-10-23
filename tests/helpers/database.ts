import { createDatabaseContext, type DatabaseContext } from '@/server/db';
import { seedPlans } from '@/server/db/seed';

export async function testDatabase(): Promise<DatabaseContext> {
  const context = await createDatabaseContext({ memory: true });
  await seedPlans(context.db);
  return context;
}

export async function createAccount(db: DatabaseContext['db'], email = 'camille@example.com', name = 'Camille Test') {
  const { registerUser } = await import('@/server/auth');
  return registerUser({ name, email, password: 'mot-de-passe-tres-long', workspaceName: `Espace ${name}` }, db);
}
