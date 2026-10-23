import { and, count, eq, gte, isNull, sum } from 'drizzle-orm';
import { getDb, type Db } from '@/server/db';
import { aiGenerations, assets, domains, pages, plans, projects, subscriptions } from '@/server/db/schema';
import type { Plan } from '@/server/db/schema';
import { ApiError } from '@/server/http';

export async function getWorkspacePlan(workspaceId: string, db?: Db): Promise<Plan> {
  const database = db ?? await getDb();
  const row = (await database.select({ plan: plans }).from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(and(eq(subscriptions.workspaceId, workspaceId), eq(subscriptions.status, 'active'))).limit(1))[0];
  if (!row) throw new ApiError(402, 'PLAN_INACTIVE', 'Aucun abonnement actif pour cet espace.');
  return row.plan;
}

function feature(plan: Plan, key: string): number {
  const value = plan.features[key];
  return typeof value === 'number' ? value : Number.POSITIVE_INFINITY;
}

export async function assertProjectQuota(workspaceId: string, db?: Db): Promise<void> {
  const database = db ?? await getDb();
  const plan = await getWorkspacePlan(workspaceId, database);
  const result = await database.select({ value: count() }).from(projects).where(and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)));
  if ((result[0]?.value || 0) >= feature(plan, 'maxProjects')) {
    throw new ApiError(429, 'PROJECT_QUOTA_REACHED', `Votre offre ${plan.name} limite le nombre de projets.`, { limit: feature(plan, 'maxProjects') });
  }
}

export async function assertPageQuota(workspaceId: string, projectId: string, db?: Db): Promise<void> {
  const database = db ?? await getDb();
  const plan = await getWorkspacePlan(workspaceId, database);
  const result = await database.select({ value: count() }).from(pages).where(and(eq(pages.workspaceId, workspaceId), eq(pages.projectId, projectId)));
  if ((result[0]?.value || 0) >= feature(plan, 'maxPagesPerProject')) {
    throw new ApiError(429, 'PAGE_QUOTA_REACHED', 'La limite de pages de votre offre est atteinte.', { limit: feature(plan, 'maxPagesPerProject') });
  }
}

export async function assertAiQuota(workspaceId: string, db?: Db): Promise<void> {
  const database = db ?? await getDb();
  const plan = await getWorkspacePlan(workspaceId, database);
  const start = new Date(new Date().toISOString().slice(0, 7) + '-01T00:00:00.000Z');
  const result = await database.select({ value: count() }).from(aiGenerations).where(and(eq(aiGenerations.workspaceId, workspaceId), gte(aiGenerations.createdAt, start)));
  if ((result[0]?.value || 0) >= feature(plan, 'maxAiGenerations')) {
    throw new ApiError(429, 'AI_QUOTA_REACHED', 'Votre quota mensuel de générations IA est atteint.', { limit: feature(plan, 'maxAiGenerations') });
  }
}

export async function assertStorageQuota(workspaceId: string, additionalBytes: number, db?: Db): Promise<void> {
  const database = db ?? await getDb();
  const plan = await getWorkspacePlan(workspaceId, database);
  const result = await database.select({ value: sum(assets.byteSize) }).from(assets).where(and(eq(assets.workspaceId, workspaceId), isNull(assets.deletedAt)));
  const used = Number(result[0]?.value || 0);
  if (used + additionalBytes > feature(plan, 'maxStorageBytes')) {
    throw new ApiError(429, 'STORAGE_QUOTA_REACHED', 'Votre espace de stockage est insuffisant.', { used, limit: feature(plan, 'maxStorageBytes') });
  }
}

export async function assertDomainQuota(workspaceId: string, db?: Db): Promise<void> {
  const database = db ?? await getDb();
  const plan = await getWorkspacePlan(workspaceId, database);
  const result = await database.select({ value: count() }).from(domains).where(and(eq(domains.workspaceId, workspaceId), eq(domains.kind, 'custom')));
  if ((result[0]?.value || 0) >= feature(plan, 'customDomains')) {
    throw new ApiError(429, 'DOMAIN_QUOTA_REACHED', 'Les domaines personnalisés ne sont pas disponibles dans votre offre.', { limit: feature(plan, 'customDomains') });
  }
}

export async function getUsageSummary(workspaceId: string, db?: Db) {
  const database = db ?? await getDb();
  const plan = await getWorkspacePlan(workspaceId, database);
  const projectCount = await database.select({ value: count() }).from(projects).where(and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)));
  const storage = await database.select({ value: sum(assets.byteSize) }).from(assets).where(and(eq(assets.workspaceId, workspaceId), isNull(assets.deletedAt)));
  const start = new Date(new Date().toISOString().slice(0, 7) + '-01T00:00:00.000Z');
  const ai = await database.select({ value: count() }).from(aiGenerations).where(and(eq(aiGenerations.workspaceId, workspaceId), gte(aiGenerations.createdAt, start)));
  return {
    plan,
    projects: { used: projectCount[0]?.value || 0, limit: feature(plan, 'maxProjects') },
    storage: { used: Number(storage[0]?.value || 0), limit: feature(plan, 'maxStorageBytes') },
    ai: { used: ai[0]?.value || 0, limit: feature(plan, 'maxAiGenerations') },
  };
}
