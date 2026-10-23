import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DatabaseContext } from '@/server/db';
import { plans, subscriptions, workspaceMembers } from '@/server/db/schema';
import { createProject } from '@/server/services/projects';
import { addDomain, deleteDomain, listDomains, verifyDomain } from '@/server/services/domains';
import { createAccount, testDatabase } from './helpers/database';

const dns = vi.hoisted(() => ({ resolveTxt: vi.fn() }));
vi.mock('node:dns/promises', () => ({ resolveTxt: dns.resolveTxt }));

let context: DatabaseContext;
let sequence = 0;
const previousDnsSetting = process.env.DNS_VERIFICATION_ENABLED;

beforeAll(async () => { context = await testDatabase(); }, 60_000);
afterEach(() => {
  dns.resolveTxt.mockReset();
  if (previousDnsSetting === undefined) delete process.env.DNS_VERIFICATION_ENABLED;
  else process.env.DNS_VERIFICATION_ENABLED = previousDnsSetting;
});
afterAll(async () => { await context.close(); });

async function setupDomainProject(planCode = 'business') {
  sequence += 1;
  const account = await createAccount(context.db, `domains-${sequence}@example.com`, `Domaines ${sequence}`);
  const project = await createProject(account.user.id, account.workspace.id, { name: `Domaines ${sequence}`, description: '', templateId: 'studio-business' }, context.db);
  const plan = (await context.db.select().from(plans).where(eq(plans.code, planCode)).limit(1))[0]!;
  await context.db.update(subscriptions).set({ planId: plan.id }).where(eq(subscriptions.workspaceId, account.workspace.id));
  return { account, project };
}

describe('domaines personnalisés', () => {
  it('applique le quota, rejette les hôtes ambigus et ne divulgue pas le hash du jeton', async () => {
    const { account, project } = await setupDomainProject('free');
    await expect(addDomain(account.user.id, project.project.id, { hostname: 'quota.example' }, context.db)).rejects.toMatchObject({ status: 429, code: 'DOMAIN_QUOTA_REACHED' });
    await context.db.update(subscriptions).set({ planId: (await context.db.select().from(plans).where(eq(plans.code, 'business')).limit(1))[0]!.id }).where(eq(subscriptions.workspaceId, account.workspace.id));

    for (const hostname of ['https://example.com', 'example.com/chemin', 'example.com:443', '127.0.0.1', 'localhost', 'a..example']) {
      await expect(addDomain(account.user.id, project.project.id, { hostname }, context.db)).rejects.toMatchObject({ status: 422, code: 'HOSTNAME_INVALID' });
    }
    const added = await addDomain(account.user.id, project.project.id, { hostname: 'BÜCHER.example.' }, context.db);
    expect(added.domain.asciiHostname).toBe('xn--bcher-kva.example');
    expect(added.domain.state).toBe('pending_dns');
    expect(added.verification).toMatchObject({ type: 'TXT', name: '_woob.xn--bcher-kva.example' });
    expect(added.verification.value).toMatch(/^woob-verify=.+/);
    expect(added.domain).not.toHaveProperty('verificationTokenHash');
    expect(added.domain).not.toHaveProperty('kind');
    await expect(addDomain(account.user.id, project.project.id, { hostname: 'xn--bcher-kva.example' }, context.db)).rejects.toMatchObject({ status: 409, code: 'DOMAIN_ALREADY_EXISTS' });
    const listed = await listDomains(account.user.id, project.project.id, context.db);
    expect(listed).toHaveLength(1);
    expect(listed[0]).not.toHaveProperty('verificationTokenHash');
  });

  it('autorise les admins, refuse les viewers et isole les autres workspaces', async () => {
    const { account, project } = await setupDomainProject();
    const admin = await createAccount(context.db, 'domain-admin@example.com', 'Admin domaines');
    const viewer = await createAccount(context.db, 'domain-viewer@example.com', 'Viewer domaines');
    const outsider = await createAccount(context.db, 'domain-outsider@example.com', 'Outside domaines');
    await context.db.insert(workspaceMembers).values([
      { workspaceId: account.workspace.id, userId: admin.user.id, role: 'admin', status: 'active' },
      { workspaceId: account.workspace.id, userId: viewer.user.id, role: 'viewer', status: 'active' },
    ]);
    const added = await addDomain(admin.user.id, project.project.id, { hostname: 'admin.example' }, context.db);
    expect((await listDomains(viewer.user.id, project.project.id, context.db))[0]?.hostname).toBe('admin.example');
    await expect(addDomain(viewer.user.id, project.project.id, { hostname: 'viewer.example' }, context.db)).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    await expect(verifyDomain(viewer.user.id, added.domain.id, context.db)).rejects.toMatchObject({ status: 403 });
    await expect(deleteDomain(viewer.user.id, added.domain.id, context.db)).rejects.toMatchObject({ status: 403 });
    await expect(listDomains(outsider.user.id, project.project.id, context.db)).rejects.toMatchObject({ status: 404 });
    await expect(verifyDomain(outsider.user.id, added.domain.id, context.db)).rejects.toMatchObject({ status: 404 });
    await expect(deleteDomain(outsider.user.id, added.domain.id, context.db)).rejects.toMatchObject({ status: 404 });
    await deleteDomain(admin.user.id, added.domain.id, context.db);
    expect(await listDomains(account.user.id, project.project.id, context.db)).toEqual([]);
  });

  it('reste en attente sans DNS activé et teste les transitions avec un résolveur simulé', async () => {
    const { account, project } = await setupDomainProject();
    const added = await addDomain(account.user.id, project.project.id, { hostname: 'verification.example' }, context.db);
    process.env.DNS_VERIFICATION_ENABLED = 'false';
    await expect(verifyDomain(account.user.id, added.domain.id, context.db)).rejects.toMatchObject({ status: 503, code: 'DNS_VERIFICATION_UNAVAILABLE' });
    expect(dns.resolveTxt).not.toHaveBeenCalled();
    expect((await listDomains(account.user.id, project.project.id, context.db))[0]?.state).toBe('pending_dns');

    process.env.DNS_VERIFICATION_ENABLED = 'true';
    dns.resolveTxt.mockResolvedValue([['woob-verify=mauvais-jeton']]);
    await expect(verifyDomain(account.user.id, added.domain.id, context.db)).rejects.toMatchObject({ status: 409, code: 'DNS_NOT_VERIFIED' });
    expect((await listDomains(account.user.id, project.project.id, context.db))[0]?.state).toBe('pending_dns');

    dns.resolveTxt.mockResolvedValue([[added.verification.value]]);
    const verified = await verifyDomain(account.user.id, added.domain.id, context.db);
    expect(dns.resolveTxt).toHaveBeenLastCalledWith('_woob.verification.example');
    expect(verified.state).toBe('dns_verified');
    expect(verified.lastError).toContain('TLS toujours requis');
    expect(verified).not.toHaveProperty('verificationTokenHash');
  });
});
