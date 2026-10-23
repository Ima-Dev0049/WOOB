import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { count, eq } from 'drizzle-orm';
import { createId } from '@/lib/id';
import { createSession, getUserWorkspaces, loginUser } from '@/server/auth';
import type { DatabaseContext } from '@/server/db';
import { adminAuditLogs, orders, plans, sessions, subscriptions, users } from '@/server/db/schema';
import { administerProject, administerUser, administerWorkspace, getAdminDashboard } from '@/server/services/admin';
import { createProject, getProjectDetails } from '@/server/services/projects';
import { getPublishedSite, publishProject } from '@/server/services/publishing';
import { getUsageSummary } from '@/server/services/quotas';
import { createAccount, testDatabase } from './helpers/database';

let context: DatabaseContext;
beforeAll(async () => { context = await testDatabase(); }, 60_000);
afterAll(async () => { await context.close(); });

async function createAdmin(email: string, name = 'Platform Admin') {
  const account = await createAccount(context.db, email, name);
  await context.db.update(users).set({ platformRole: 'admin' }).where(eq(users.id, account.user.id));
  return account;
}

describe('administration plateforme', () => {
  it('refuse un owner ordinaire, accepte uniquement un rôle explicite ou une allowlist et produit des métriques SQL', async () => {
    const ordinary = await createAccount(context.db, 'ordinary-owner@example.com', 'Ordinary Owner');
    await expect(getAdminDashboard(ordinary.user.id, context.db)).rejects.toMatchObject({ status: 403, code: 'PLATFORM_ADMIN_REQUIRED' });
    await expect(administerWorkspace(ordinary.user.id, ordinary.workspace.id, { action: 'set_status', status: 'suspended' }, context.db)).rejects.toMatchObject({ status: 403 });
    expect((await context.db.select().from(adminAuditLogs))).toHaveLength(0);

    const previousAllowlist = process.env.PLATFORM_ADMIN_EMAILS;
    try {
      process.env.PLATFORM_ADMIN_EMAILS = `other@example.com, ${ordinary.user.email.toUpperCase()}`;
      const allowed = await getAdminDashboard(ordinary.user.id, context.db);
      expect(allowed.users.find((user) => user.id === ordinary.user.id)?.platformAdmin).toBe(true);
    } finally {
      if (previousAllowlist === undefined) delete process.env.PLATFORM_ADMIN_EMAILS; else process.env.PLATFORM_ADMIN_EMAILS = previousAllowlist;
    }
    await expect(getAdminDashboard(ordinary.user.id, context.db)).rejects.toMatchObject({ status: 403 });

    const admin = await createAdmin('metrics-admin@example.com');
    const details = await createProject(ordinary.user.id, ordinary.workspace.id, { name: 'Projet métriques', description: '', templateId: 'studio-business' }, context.db);
    await context.db.insert(orders).values([
      { id: createId('order'), workspaceId: ordinary.workspace.id, projectId: details.project.id, reference: 'ADMIN-EUR-PAID', customerName: 'Client A', customerEmail: 'a@example.com', totalCents: 1_000, currency: 'EUR', paymentStatus: 'paid' },
      { id: createId('order'), workspaceId: ordinary.workspace.id, projectId: details.project.id, reference: 'ADMIN-EUR-UNPAID', customerName: 'Client B', customerEmail: 'b@example.com', totalCents: 2_500, currency: 'EUR', paymentStatus: 'unpaid' },
      { id: createId('order'), workspaceId: ordinary.workspace.id, projectId: details.project.id, reference: 'ADMIN-USD-UNPAID', customerName: 'Client C', customerEmail: 'c@example.com', totalCents: 700, currency: 'USD', paymentStatus: 'unpaid' },
    ]);
    const dashboard = await getAdminDashboard(admin.user.id, context.db);
    const expectedUsers = (await context.db.select({ value: count() }).from(users))[0]!.value;
    expect(dashboard.metrics.users.total).toBe(expectedUsers);
    expect(dashboard.metrics.users.admins).toBe(1);
    expect(dashboard.metrics.projects.total).toBeGreaterThanOrEqual(1);
    expect(dashboard.metrics.orderValues).toEqual([
      { currency: 'EUR', totalCents: 3_500, paidCents: 1_000, unpaidCents: 2_500 },
      { currency: 'USD', totalCents: 700, paidCents: 0, unpaidCents: 700 },
    ]);
    expect(dashboard.metrics).not.toHaveProperty('orderValueCents');
    expect(dashboard.activity).toHaveLength(14);
    expect(dashboard.users.some((user) => user.email === ordinary.user.email)).toBe(true);
    expect(dashboard.plans.map((plan) => plan.code)).toEqual(['business', 'free', 'pro']);
  });

  it('suspend un utilisateur en révoquant toutes ses sessions, puis le réactive avec audit', async () => {
    const admin = await createAdmin('user-admin@example.com');
    const target = await createAccount(context.db, 'suspend-user@example.com', 'Suspend User');
    await createSession(target.user.id, context.db);
    await administerUser(admin.user.id, target.user.id, { action: 'set_status', status: 'suspended' }, context.db);
    const revoked = await context.db.select().from(sessions).where(eq(sessions.userId, target.user.id));
    expect(revoked.length).toBeGreaterThanOrEqual(2);
    expect(revoked.every((session) => session.revokedAt !== null)).toBe(true);
    await expect(loginUser({ email: target.user.email, password: 'mot-de-passe-tres-long' }, context.db)).rejects.toMatchObject({ status: 401 });
    await expect(getAdminDashboard(target.user.id, context.db)).rejects.toMatchObject({ status: 403 });
    await administerUser(admin.user.id, target.user.id, { action: 'set_status', status: 'active' }, context.db);
    expect((await loginUser({ email: target.user.email, password: 'mot-de-passe-tres-long' }, context.db)).user.id).toBe(target.user.id);
    const audit = await context.db.select().from(adminAuditLogs).where(eq(adminAuditLogs.targetId, target.user.id));
    expect(audit.map((entry) => entry.action)).toEqual(['user.status', 'user.status']);
    expect(audit.map((entry) => entry.details)).toEqual([{ from: 'active', to: 'suspended' }, { from: 'suspended', to: 'active' }]);
  });

  it('gère les rôles sans auto-blocage et sans élever silencieusement le premier inscrit', async () => {
    const admin = await createAdmin('role-admin@example.com');
    const target = await createAccount(context.db, 'role-target@example.com', 'Role Target');
    expect(target.user.platformRole).toBe('user');
    await expect(administerUser(admin.user.id, admin.user.id, { action: 'set_status', status: 'suspended' }, context.db)).rejects.toMatchObject({ status: 409, code: 'ADMIN_SELF_LOCKOUT' });
    await expect(administerUser(admin.user.id, admin.user.id, { action: 'set_role', role: 'user' }, context.db)).rejects.toMatchObject({ status: 409, code: 'ADMIN_SELF_LOCKOUT' });
    await administerUser(admin.user.id, target.user.id, { action: 'set_role', role: 'admin' }, context.db);
    expect((await getAdminDashboard(target.user.id, context.db)).users.find((user) => user.id === target.user.id)?.platformRole).toBe('admin');
    await administerUser(admin.user.id, target.user.id, { action: 'set_role', role: 'user' }, context.db);
    await expect(getAdminDashboard(target.user.id, context.db)).rejects.toMatchObject({ status: 403 });
  });

  it('bloque effectivement accès tenant et site public pendant les suspensions workspace et projet', async () => {
    const admin = await createAdmin('moderation-admin@example.com');
    const owner = await createAccount(context.db, 'moderation-owner@example.com', 'Moderation Owner');
    const details = await createProject(owner.user.id, owner.workspace.id, { name: 'Site à modérer', description: '', templateId: 'studio-business' }, context.db);
    await publishProject(owner.user.id, details.project.id, context.db);
    expect(await getPublishedSite(details.project.slug, context.db)).not.toBeNull();

    await administerWorkspace(admin.user.id, owner.workspace.id, { action: 'set_status', status: 'suspended' }, context.db);
    expect(await getUserWorkspaces(owner.user.id, context.db)).toEqual([]);
    await expect(getProjectDetails(owner.user.id, details.project.id, context.db)).rejects.toMatchObject({ status: 404 });
    expect(await getPublishedSite(details.project.slug, context.db)).toBeNull();
    await administerWorkspace(admin.user.id, owner.workspace.id, { action: 'set_status', status: 'active' }, context.db);
    expect((await getUserWorkspaces(owner.user.id, context.db)).map((workspace) => workspace.id)).toContain(owner.workspace.id);
    expect(await getPublishedSite(details.project.slug, context.db)).not.toBeNull();

    await administerProject(admin.user.id, details.project.id, { action: 'suspend' }, context.db);
    await expect(getProjectDetails(owner.user.id, details.project.id, context.db)).rejects.toMatchObject({ status: 404 });
    expect(await getPublishedSite(details.project.slug, context.db)).toBeNull();
    await administerProject(admin.user.id, details.project.id, { action: 'reactivate' }, context.db);
    expect((await getProjectDetails(owner.user.id, details.project.id, context.db)).project.status).toBe('published');
    expect(await getPublishedSite(details.project.slug, context.db)).not.toBeNull();
    const audit = await context.db.select().from(adminAuditLogs).where(eq(adminAuditLogs.actorUserId, admin.user.id));
    expect(audit.map((entry) => entry.action)).toEqual(['workspace.status', 'workspace.status', 'project.status', 'project.status']);
  });

  it('change manuellement offre et quotas sans faux paiement, mais refuse de remplacer un abonnement externe', async () => {
    const admin = await createAdmin('plan-admin@example.com');
    const owner = await createAccount(context.db, 'plan-owner@example.com', 'Plan Owner');
    const pro = (await context.db.select().from(plans).where(eq(plans.code, 'pro')).limit(1))[0]!;
    const free = (await context.db.select().from(plans).where(eq(plans.code, 'free')).limit(1))[0]!;
    await administerWorkspace(admin.user.id, owner.workspace.id, { action: 'set_plan', planId: pro.id }, context.db);
    const subscription = (await context.db.select().from(subscriptions).where(eq(subscriptions.workspaceId, owner.workspace.id)))[0]!;
    expect(subscription).toMatchObject({ planId: pro.id, provider: 'manual_admin', providerSubscriptionId: null, status: 'active' });
    expect((await getUsageSummary(owner.workspace.id, context.db)).projects.limit).toBe(10);
    await context.db.update(subscriptions).set({ provider: 'stripe', providerSubscriptionId: 'sub_external_test' }).where(eq(subscriptions.id, subscription.id));
    await expect(administerWorkspace(admin.user.id, owner.workspace.id, { action: 'set_plan', planId: free.id }, context.db)).rejects.toMatchObject({ status: 409, code: 'EXTERNAL_SUBSCRIPTION_ACTIVE' });
    expect((await context.db.select().from(subscriptions).where(eq(subscriptions.id, subscription.id)))[0]!.planId).toBe(pro.id);
    const audit = await context.db.select().from(adminAuditLogs).where(eq(adminAuditLogs.targetId, owner.workspace.id));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'workspace.plan', details: { from: free.id, to: pro.id, manual: true } });
  });
});
