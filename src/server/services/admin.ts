import { and, asc, count, desc, eq, gte, isNull, sql, sum } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@/lib/id';
import { getDb, type Db } from '@/server/db';
import { adminAuditLogs, aiGenerations, assets, domains, formSubmissions, orders, pages, plans, projects, reservations, sessions, subscriptions, users, workspaceMembers, workspaces } from '@/server/db/schema';
import { ApiError } from '@/server/http';
import { isPlatformAdmin, requirePlatformAdmin } from '@/server/auth/platform';

const userAdminAction = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set_status'), status: z.enum(['active', 'suspended']) }),
  z.object({ action: z.literal('set_role'), role: z.enum(['user', 'admin']) }),
]);
const workspaceAdminAction = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set_status'), status: z.enum(['active', 'suspended']) }),
  z.object({ action: z.literal('set_plan'), planId: z.string().uuid() }),
]);

function number(value: unknown): number {
  return Number(value || 0);
}

function iso(value: Date): string {
  return value.toISOString();
}

function lastDays(amount: number): string[] {
  const today = new Date();
  return Array.from({ length: amount }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (amount - index - 1)));
    return date.toISOString().slice(0, 10);
  });
}

export async function getAdminDashboard(actorId: string, db?: Db) {
  const database = db ?? await getDb();
  await requirePlatformAdmin(actorId, database);
  const since = new Date(Date.now() - 13 * 86400_000);
  since.setUTCHours(0, 0, 0, 0);
  const [
    userMetrics, workspaceMetrics, projectMetrics, pagesMetric, ordersMetric, reservationsMetric, leadsMetric, aiMetric, storageMetric, domainsMetric,
    userRows, workspaceRows, projectRows, planRows, auditRows, dailyUsers, dailyProjects,
  ] = await Promise.all([
    database.select({ total: count(), active: sql<number>`cast(sum(case when ${users.status} = 'active' then 1 else 0 end) as integer)`, admins: sql<number>`cast(sum(case when ${users.platformRole} = 'admin' then 1 else 0 end) as integer)` }).from(users),
    database.select({ total: count(), active: sql<number>`cast(sum(case when ${workspaces.status} = 'active' then 1 else 0 end) as integer)` }).from(workspaces),
    database.select({ total: count(), published: sql<number>`cast(sum(case when ${projects.status} = 'published' then 1 else 0 end) as integer)`, suspended: sql<number>`cast(sum(case when ${projects.status} = 'suspended' then 1 else 0 end) as integer)` }).from(projects).where(isNull(projects.deletedAt)),
    database.select({ value: count() }).from(pages),
    database.select({ currency: orders.currency, value: count(), orderValue: sum(orders.totalCents), paidValue: sql<number>`cast(sum(case when ${orders.paymentStatus} = 'paid' then ${orders.totalCents} else 0 end) as bigint)`, unpaidValue: sql<number>`cast(sum(case when ${orders.paymentStatus} <> 'paid' then ${orders.totalCents} else 0 end) as bigint)` }).from(orders).groupBy(orders.currency),
    database.select({ value: count() }).from(reservations),
    database.select({ value: count() }).from(formSubmissions),
    database.select({ value: count() }).from(aiGenerations),
    database.select({ value: sum(assets.byteSize) }).from(assets).where(isNull(assets.deletedAt)),
    database.select({ total: count(), verified: sql<number>`cast(sum(case when ${domains.state} = 'dns_verified' then 1 else 0 end) as integer)` }).from(domains),
    database.select({ id: users.id, name: users.name, email: users.email, normalizedEmail: users.normalizedEmail, status: users.status, platformRole: users.platformRole, createdAt: users.createdAt, workspaceCount: count(workspaceMembers.workspaceId) }).from(users).leftJoin(workspaceMembers, eq(workspaceMembers.userId, users.id)).groupBy(users.id, users.name, users.email, users.normalizedEmail, users.status, users.platformRole, users.createdAt).orderBy(desc(users.createdAt)).limit(100),
    database.select({ id: workspaces.id, name: workspaces.name, status: workspaces.status, createdAt: workspaces.createdAt, ownerName: users.name, ownerEmail: users.email, planId: plans.id, planCode: plans.code, planName: plans.name, provider: subscriptions.provider, providerSubscriptionId: subscriptions.providerSubscriptionId, projectCount: count(projects.id) }).from(workspaces).innerJoin(users, eq(users.id, workspaces.ownerId)).leftJoin(subscriptions, and(eq(subscriptions.workspaceId, workspaces.id), eq(subscriptions.status, 'active'))).leftJoin(plans, eq(plans.id, subscriptions.planId)).leftJoin(projects, and(eq(projects.workspaceId, workspaces.id), isNull(projects.deletedAt))).groupBy(workspaces.id, workspaces.name, workspaces.status, workspaces.createdAt, users.name, users.email, plans.id, plans.code, plans.name, subscriptions.provider, subscriptions.providerSubscriptionId).orderBy(desc(workspaces.createdAt)).limit(100),
    database.select({ id: projects.id, name: projects.name, slug: projects.slug, status: projects.status, updatedAt: projects.updatedAt, workspaceId: workspaces.id, workspaceName: workspaces.name }).from(projects).innerJoin(workspaces, eq(workspaces.id, projects.workspaceId)).where(isNull(projects.deletedAt)).orderBy(desc(projects.updatedAt)).limit(100),
    database.select({ id: plans.id, code: plans.code, name: plans.name, monthlyPriceCents: plans.monthlyPriceCents, currency: plans.currency, subscribers: count(subscriptions.id) }).from(plans).leftJoin(subscriptions, and(eq(subscriptions.planId, plans.id), eq(subscriptions.status, 'active'))).where(eq(plans.active, true)).groupBy(plans.id, plans.code, plans.name, plans.monthlyPriceCents, plans.currency).orderBy(asc(plans.code)),
    database.select({ id: adminAuditLogs.id, action: adminAuditLogs.action, targetType: adminAuditLogs.targetType, targetId: adminAuditLogs.targetId, details: adminAuditLogs.details, createdAt: adminAuditLogs.createdAt, actorName: users.name, actorEmail: users.email }).from(adminAuditLogs).innerJoin(users, eq(users.id, adminAuditLogs.actorUserId)).orderBy(desc(adminAuditLogs.createdAt)).limit(50),
    database.select({ day: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`, value: count() }).from(users).where(gte(users.createdAt, since)).groupBy(sql`date_trunc('day', ${users.createdAt})`),
    database.select({ day: sql<string>`to_char(date_trunc('day', ${projects.createdAt}), 'YYYY-MM-DD')`, value: count() }).from(projects).where(gte(projects.createdAt, since)).groupBy(sql`date_trunc('day', ${projects.createdAt})`),
  ]);
  const userActivity = new Map(dailyUsers.map((row) => [row.day, number(row.value)]));
  const projectActivity = new Map(dailyProjects.map((row) => [row.day, number(row.value)]));
  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      users: { total: number(userMetrics[0]?.total), active: number(userMetrics[0]?.active), admins: number(userMetrics[0]?.admins) },
      workspaces: { total: number(workspaceMetrics[0]?.total), active: number(workspaceMetrics[0]?.active) },
      projects: { total: number(projectMetrics[0]?.total), published: number(projectMetrics[0]?.published), suspended: number(projectMetrics[0]?.suspended) },
      pages: number(pagesMetric[0]?.value),
      orders: ordersMetric.reduce((total, row) => total + number(row.value), 0),
      orderValues: ordersMetric.map((row) => ({ currency: row.currency, totalCents: number(row.orderValue), paidCents: number(row.paidValue), unpaidCents: number(row.unpaidValue) })).sort((a, b) => a.currency.localeCompare(b.currency)),
      reservations: number(reservationsMetric[0]?.value),
      leads: number(leadsMetric[0]?.value),
      aiGenerations: number(aiMetric[0]?.value),
      storageBytes: number(storageMetric[0]?.value),
      domains: { total: number(domainsMetric[0]?.total), verified: number(domainsMetric[0]?.verified) },
    },
    activity: lastDays(14).map((date) => ({ date, users: userActivity.get(date) || 0, projects: projectActivity.get(date) || 0 })),
    users: userRows.map((row) => ({ id: row.id, name: row.name, email: row.email, status: row.status, platformRole: row.platformRole, platformAdmin: isPlatformAdmin(row), workspaceCount: number(row.workspaceCount), createdAt: iso(row.createdAt) })),
    workspaces: workspaceRows.map((row) => ({ id: row.id, name: row.name, status: row.status, ownerName: row.ownerName, ownerEmail: row.ownerEmail, planId: row.planId, planCode: row.planCode, planName: row.planName, provider: row.provider, hasProviderSubscription: Boolean(row.providerSubscriptionId), projectCount: number(row.projectCount), createdAt: iso(row.createdAt) })),
    projects: projectRows.map((row) => ({ ...row, updatedAt: iso(row.updatedAt) })),
    plans: planRows.map((row) => ({ ...row, subscribers: number(row.subscribers) })),
    audit: auditRows.map((row) => ({ ...row, createdAt: iso(row.createdAt) })),
  };
}

export type AdminDashboardData = Awaited<ReturnType<typeof getAdminDashboard>>;

export async function administerUser(actorId: string, targetId: string, input: unknown, db?: Db) {
  const data = userAdminAction.parse(input);
  const database = db ?? await getDb();
  await requirePlatformAdmin(actorId, database);
  const targetKey = z.string().uuid().parse(targetId);
  const target = (await database.select().from(users).where(eq(users.id, targetKey)).limit(1))[0];
  if (!target) throw new ApiError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable.');
  if (actorId === target.id && ((data.action === 'set_status' && data.status === 'suspended') || (data.action === 'set_role' && data.role === 'user'))) {
    throw new ApiError(409, 'ADMIN_SELF_LOCKOUT', 'Vous ne pouvez pas suspendre votre propre compte ni retirer votre propre rôle administrateur.');
  }
  return database.transaction(async (tx) => {
    if (data.action === 'set_status') {
      const updated = (await tx.update(users).set({ status: data.status, updatedAt: new Date() }).where(eq(users.id, target.id)).returning())[0];
      if (data.status === 'suspended') await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, target.id), isNull(sessions.revokedAt)));
      await tx.insert(adminAuditLogs).values({ id: createId('audit'), actorUserId: actorId, action: 'user.status', targetType: 'user', targetId: target.id, details: { from: target.status, to: data.status } });
      return updated;
    }
    const updated = (await tx.update(users).set({ platformRole: data.role, updatedAt: new Date() }).where(eq(users.id, target.id)).returning())[0];
    await tx.insert(adminAuditLogs).values({ id: createId('audit'), actorUserId: actorId, action: 'user.platform_role', targetType: 'user', targetId: target.id, details: { from: target.platformRole, to: data.role } });
    return updated;
  });
}

export async function administerWorkspace(actorId: string, targetId: string, input: unknown, db?: Db) {
  const data = workspaceAdminAction.parse(input);
  const database = db ?? await getDb();
  await requirePlatformAdmin(actorId, database);
  const targetKey = z.string().uuid().parse(targetId);
  const target = (await database.select().from(workspaces).where(eq(workspaces.id, targetKey)).limit(1))[0];
  if (!target) throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Espace de travail introuvable.');
  if (data.action === 'set_status') {
    return database.transaction(async (tx) => {
      const updated = (await tx.update(workspaces).set({ status: data.status, updatedAt: new Date() }).where(eq(workspaces.id, target.id)).returning())[0];
      await tx.insert(adminAuditLogs).values({ id: createId('audit'), actorUserId: actorId, action: 'workspace.status', targetType: 'workspace', targetId: target.id, details: { from: target.status, to: data.status } });
      return updated;
    });
  }
  const plan = (await database.select().from(plans).where(and(eq(plans.id, data.planId), eq(plans.active, true))).limit(1))[0];
  if (!plan) throw new ApiError(422, 'PLAN_NOT_FOUND', 'Cette offre est introuvable ou inactive.');
  const subscription = (await database.select().from(subscriptions).where(eq(subscriptions.workspaceId, target.id)).limit(1))[0];
  if (!subscription) throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Aucun abonnement à modifier.');
  if (subscription.providerSubscriptionId) throw new ApiError(409, 'EXTERNAL_SUBSCRIPTION_ACTIVE', 'Cet abonnement dépend d’un prestataire externe. Modifiez-le chez ce prestataire avant toute attribution manuelle.');
  return database.transaction(async (tx) => {
    const updated = (await tx.update(subscriptions).set({ planId: plan.id, provider: 'manual_admin', providerCustomerId: null, providerSubscriptionId: null, status: 'active', currentPeriodEnd: null, updatedAt: new Date() }).where(eq(subscriptions.id, subscription.id)).returning())[0];
    await tx.insert(adminAuditLogs).values({ id: createId('audit'), actorUserId: actorId, action: 'workspace.plan', targetType: 'workspace', targetId: target.id, details: { from: subscription.planId, to: plan.id, manual: true } });
    return updated;
  });
}

export async function administerProject(actorId: string, targetId: string, input: unknown, db?: Db) {
  const data = z.object({ action: z.enum(['suspend', 'reactivate']) }).parse(input);
  const database = db ?? await getDb();
  await requirePlatformAdmin(actorId, database);
  const targetKey = z.string().uuid().parse(targetId);
  const target = (await database.select().from(projects).where(and(eq(projects.id, targetKey), isNull(projects.deletedAt))).limit(1))[0];
  if (!target) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Projet introuvable.');
  const status = data.action === 'suspend' ? 'suspended' : target.activePublicationId ? 'published' : 'draft';
  return database.transaction(async (tx) => {
    const updated = (await tx.update(projects).set({ status, updatedAt: new Date() }).where(eq(projects.id, target.id)).returning())[0];
    await tx.insert(adminAuditLogs).values({ id: createId('audit'), actorUserId: actorId, action: 'project.status', targetType: 'project', targetId: target.id, details: { from: target.status, to: status } });
    return updated;
  });
}
