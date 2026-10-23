import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DatabaseContext } from '@/server/db';
import { testDatabase, createAccount } from './helpers/database';
import { createProject, getProjectDetails, savePageDocument } from '@/server/services/projects';
import { loginUser, resetPassword, verifyEmail } from '@/server/auth';
import { authTokens, users, workspaceMembers } from '@/server/db/schema';
import { createToken, hashToken } from '@/server/security/crypto';
import { createId } from '@/lib/id';
import { requestIp } from '@/server/security/rate-limit';
import { cloneDocument, findNode } from '@/lib/document/validation';
import { makeNode } from '@/lib/document/factory';
import { addExistingMember, listMembers, suspendMember, updateMemberRole } from '@/server/services/members';

let context: DatabaseContext;
beforeAll(async () => { context = await testDatabase(); }, 60_000);
afterAll(async () => { await context.close(); });

describe('authentification et isolation des workspaces', () => {
  it('crée des comptes, vérifie les mots de passe et refuse un email dupliqué', async () => {
    const account = await createAccount(context.db, 'auth@example.com', 'Auth Test');
    expect(account.user.normalizedEmail).toBe('auth@example.com');
    expect(account.user.passwordHash).not.toContain('mot-de-passe');
    const login = await loginUser({ email: 'AUTH@example.com', password: 'mot-de-passe-tres-long' }, context.db);
    expect(login.user.id).toBe(account.user.id);
    await expect(loginUser({ email: account.user.email, password: 'incorrect' }, context.db)).rejects.toMatchObject({ status: 401 });
    await expect(createAccount(context.db, 'auth@example.com')).rejects.toMatchObject({ status: 409 });
  });

  it('consomme les jetons de récupération et de vérification une seule fois', async () => {
    const account = await createAccount(context.db, 'recovery@example.com', 'Recovery');
    const resetToken = createToken();
    const verifyToken = createToken();
    await context.db.insert(authTokens).values([
      { id: createId('token'), userId: account.user.id, kind: 'password_reset', tokenHash: hashToken(resetToken), expiresAt: new Date(Date.now() + 3600_000) },
      { id: createId('token'), userId: account.user.id, kind: 'verify_email', tokenHash: hashToken(verifyToken), expiresAt: new Date(Date.now() + 3600_000) },
    ]);
    await resetPassword(resetToken, 'nouveau-mot-de-passe-tres-long', context.db);
    await expect(loginUser({ email: account.user.email, password: 'mot-de-passe-tres-long' }, context.db)).rejects.toMatchObject({ status: 401 });
    expect((await loginUser({ email: account.user.email, password: 'nouveau-mot-de-passe-tres-long' }, context.db)).user.id).toBe(account.user.id);
    await expect(resetPassword(resetToken, 'encore-un-mot-de-passe-long', context.db)).rejects.toMatchObject({ status: 400 });
    await verifyEmail(verifyToken, context.db);
    expect((await context.db.select().from(users).where(eq(users.id, account.user.id)))[0]!.emailVerifiedAt).not.toBeNull();
    await expect(verifyEmail(verifyToken, context.db)).rejects.toMatchObject({ status: 400 });
  });

  it('interdit les accès horizontaux et applique le rôle viewer', async () => {
    const owner = await createAccount(context.db, 'owner@example.com', 'Owner');
    const outsider = await createAccount(context.db, 'outsider@example.com', 'Outsider');
    const details = await createProject(owner.user.id, owner.workspace.id, { name: 'Projet secret', description: '', templateId: 'studio-business' }, context.db);
    await expect(getProjectDetails(outsider.user.id, details.project.id, context.db)).rejects.toMatchObject({ status: 404 });
    const page = details.pages[0]!;
    await expect(savePageDocument(outsider.user.id, page.id, { baseRevision: 0, document: page.draftDocument }, context.db)).rejects.toMatchObject({ status: 404 });
    await context.db.insert(workspaceMembers).values({ workspaceId: owner.workspace.id, userId: outsider.user.id, role: 'viewer', status: 'active' });
    expect((await getProjectDetails(outsider.user.id, details.project.id, context.db)).project.id).toBe(details.project.id);
    await expect(savePageDocument(outsider.user.id, page.id, { baseRevision: 0, document: page.draftDocument }, context.db)).rejects.toMatchObject({ status: 403 });
    await context.db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, owner.workspace.id), eq(workspaceMembers.userId, outsider.user.id)));
  });

  it('ne fait confiance aux IP transmises que lorsque le proxy est explicitement activé', () => {
    const request = new Request('http://localhost/api', { headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' } });
    const previous = process.env.TRUST_PROXY;
    delete process.env.TRUST_PROXY;
    expect(requestIp(request)).toBe('direct');
    process.env.TRUST_PROXY = 'true';
    expect(requestIp(request)).toBe('203.0.113.10');
    if (previous === undefined) delete process.env.TRUST_PROXY; else process.env.TRUST_PROXY = previous;
  });

  it('gère les comptes existants avec hiérarchie, suspension et réactivation', async () => {
    const owner = await createAccount(context.db, 'team-owner@example.com', 'Team Owner');
    const admin = await createAccount(context.db, 'team-admin@example.com', 'Team Admin');
    const contributor = await createAccount(context.db, 'team-contributor@example.com', 'Team Contributor');
    const details = await createProject(owner.user.id, owner.workspace.id, { name: 'Projet partagé', description: '', templateId: 'studio-business' }, context.db);
    await addExistingMember(owner.user.id, owner.workspace.id, { email: admin.user.email, role: 'admin' }, context.db);
    await addExistingMember(admin.user.id, owner.workspace.id, { email: contributor.user.email, role: 'contributor' }, context.db);
    expect((await getProjectDetails(contributor.user.id, details.project.id, context.db)).project.id).toBe(details.project.id);
    await expect(updateMemberRole(admin.user.id, owner.workspace.id, contributor.user.id, 'admin', context.db)).rejects.toMatchObject({ status: 403 });
    await expect(updateMemberRole(admin.user.id, owner.workspace.id, owner.user.id, 'viewer', context.db)).rejects.toMatchObject({ status: 403 });
    await suspendMember(admin.user.id, owner.workspace.id, contributor.user.id, context.db);
    await expect(getProjectDetails(contributor.user.id, details.project.id, context.db)).rejects.toMatchObject({ status: 404 });
    await addExistingMember(admin.user.id, owner.workspace.id, { email: contributor.user.email, role: 'viewer' }, context.db);
    const directory = await listMembers(owner.user.id, owner.workspace.id, context.db);
    expect(directory.members.find((member) => member.userId === contributor.user.id)).toMatchObject({ role: 'viewer', status: 'active' });
  });

  it('retrouve un titre modifié après une nouvelle lecture et détecte les conflits', async () => {
    const account = await createAccount(context.db, 'persist@example.com', 'Persistence');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Persistance', description: '', templateId: 'studio-business' }, context.db);
    const page = details.pages[0]!;
    const first = cloneDocument(page.draftDocument);
    const heading = makeNode('heading', { text: 'Titre avant sauvegarde', level: 2 });
    first.root.children!.push(heading);
    const saved = await savePageDocument(account.user.id, page.id, { baseRevision: 0, document: first }, context.db);
    expect(saved.draftRevision).toBe(1);
    const reread = await getProjectDetails(account.user.id, details.project.id, context.db);
    const persistedPage = reread.pages.find((item) => item.id === page.id)!;
    expect(findNode(persistedPage.draftDocument.root, heading.id)?.props.text).toBe('Titre avant sauvegarde');
    const second = cloneDocument(persistedPage.draftDocument);
    findNode(second.root, heading.id)!.props.text = 'Titre après actualisation';
    await savePageDocument(account.user.id, page.id, { baseRevision: 1, document: second }, context.db);
    const fresh = await getProjectDetails(account.user.id, details.project.id, context.db);
    expect(findNode(fresh.pages.find((item) => item.id === page.id)!.draftDocument.root, heading.id)?.props.text).toBe('Titre après actualisation');
    await expect(savePageDocument(account.user.id, page.id, { baseRevision: 1, document: second }, context.db)).rejects.toMatchObject({ status: 409, code: 'REVISION_CONFLICT' });
  });
});
