import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDatabaseContext, type DatabaseContext } from './index';
import { users } from './schema';
import { loadEnvConfig } from '@next/env';

async function main() {
  loadEnvConfig(process.cwd());
  const email = z.string().trim().email().max(240).parse(process.argv[2]).toLowerCase();
  const context = await getDatabaseContext();
  try {
    const updated = (await context.db.update(users).set({ platformRole: 'admin', updatedAt: new Date() }).where(eq(users.normalizedEmail, email)).returning())[0];
    if (!updated) throw new Error('Aucun compte ne correspond à cet email. Créez d’abord le compte utilisateur.');
    console.log(`Administrateur plateforme attribué à ${updated.email}. Rechargez sa session pour afficher /admin.`);
  } finally {
    await context.close();
    const globalDb = globalThis as typeof globalThis & { __woobDbPromise?: Promise<DatabaseContext> | undefined };
    globalDb.__woobDbPromise = undefined;
  }
}

main().catch((error) => {
  console.error('Attribution impossible :', error instanceof Error ? error.message : 'erreur inconnue');
  process.exitCode = 1;
});
