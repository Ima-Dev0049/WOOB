import { createId } from '@/lib/id';
import type { Db } from './index';
import { plans } from './schema';
import { getDatabaseContext } from './index';
import { loadEnvConfig } from '@next/env';

const planDefinitions = [
  {
    code: 'free', name: 'Gratuit', description: 'Pour découvrir Woob et publier un premier site.', monthlyPriceCents: 0,
    features: { maxProjects: 2, maxPagesPerProject: 12, maxAiGenerations: 20, maxStorageBytes: 52428800, customDomains: 0, advancedEditor: true, modules: 4 },
  },
  {
    code: 'pro', name: 'Professionnel', description: 'Plus de projets, de générations et un domaine personnalisé. Prix à configurer.', monthlyPriceCents: null,
    features: { maxProjects: 10, maxPagesPerProject: 50, maxAiGenerations: 250, maxStorageBytes: 1073741824, customDomains: 1, advancedEditor: true, modules: 8 },
  },
  {
    code: 'business', name: 'Business', description: 'Capacités étendues pour les équipes et modules métier. Prix à configurer.', monthlyPriceCents: null,
    features: { maxProjects: 50, maxPagesPerProject: 200, maxAiGenerations: 1500, maxStorageBytes: 10737418240, customDomains: 10, advancedEditor: true, modules: 20 },
  },
] as const;

export async function seedPlans(db: Db): Promise<void> {
  for (const definition of planDefinitions) {
    const stripePriceId = definition.code === 'pro'
      ? process.env.STRIPE_PRO_PRICE_ID || null
      : definition.code === 'business'
        ? process.env.STRIPE_BUSINESS_PRICE_ID || null
        : null;
    await db.insert(plans).values({
      id: createId('plan'),
      code: definition.code,
      version: 1,
      name: definition.name,
      description: definition.description,
      monthlyPriceCents: definition.monthlyPriceCents,
      currency: 'EUR',
      features: definition.features,
      stripePriceId,
      active: true,
    }).onConflictDoUpdate({
      target: [plans.code, plans.version],
      set: { name: definition.name, description: definition.description, features: definition.features, active: true, ...(definition.code === 'free' ? { monthlyPriceCents: 0 } : {}), ...(stripePriceId ? { stripePriceId } : {}) },
    });
  }
}

async function main() {
  loadEnvConfig(process.cwd());
  const context = await getDatabaseContext();
  await seedPlans(context.db);
  console.log('Plans synchronisés. Aucun utilisateur ou mot de passe de démonstration n’a été créé.');
  await context.close();
  const globalDb = globalThis as typeof globalThis & { __woobDbPromise?: Promise<unknown> | undefined };
  globalDb.__woobDbPromise = undefined;
}

if (process.argv[1]?.endsWith('seed.ts')) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
