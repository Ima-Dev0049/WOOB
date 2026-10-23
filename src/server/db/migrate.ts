import { getDatabaseContext, type DatabaseContext } from './index';
import { seedPlans } from './seed';
import { loadEnvConfig } from '@next/env';

async function main() {
  loadEnvConfig(process.cwd());
  const context = await getDatabaseContext();
  await seedPlans(context.db);
  console.log(`Migrations appliquées et plans synchronisés (${context.engine}).`);
  if (process.env.APP_ENV !== 'test' && !process.argv.includes('--keep-open')) {
    await context.close();
    const globalDb = globalThis as typeof globalThis & { __woobDbPromise?: Promise<DatabaseContext> | undefined };
    globalDb.__woobDbPromise = undefined;
  }
}

main().catch((error) => {
  console.error('Échec de migration', error);
  process.exitCode = 1;
});
