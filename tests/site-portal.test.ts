import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DatabaseContext } from '@/server/db';
import { applicationRecords } from '@/server/db/schema';
import { createAccount, testDatabase } from './helpers/database';
import { createProject } from '@/server/services/projects';
import { createApplicationRecord, executeApplicationAction, listApplicationRecords, saveApplicationModel } from '@/server/services/application';
import { schoolApplicationModel } from '@/lib/application/school-model';
import { createSession } from '@/server/auth';
import { assertSiteCsrf, loginSiteUser, registerSiteUser, resolveSiteSession } from '@/server/services/site-identity';
import { getSitePortal, listSiteRequests, savePublicIntake, submitSiteRequest } from '@/server/services/site-portal';

let context: DatabaseContext;
const password = 'mot-de-passe-site-tres-long';

beforeAll(async () => { context = await testDatabase(); }, 60_000);
afterAll(async () => { await context.close(); });

async function setup(email: string, name: string) {
  const account = await createAccount(context.db, email, name.split(' ')[0]!);
  const details = await createProject(account.user.id, account.workspace.id, { name, description: '', templateId: 'studio-business' }, context.db);
  await saveApplicationModel(account.user.id, details.project.id, { model: schoolApplicationModel, baseVersion: null }, context.db);
  await savePublicIntake(account.user.id, details.project.id, { enabled: true, objectKey: 'dossiers', title: 'Inscription en ligne', intro: 'Déposez votre dossier.' }, context.db);
  return { account, project: details.project };
}

describe('identité des utilisateurs finaux par site', () => {
  it('isole les comptes et les sessions entre deux sites et refuse le cookie Studio', async () => {
    const siteA = await setup('portal-a@example.com', 'Collège Horizon');
    const siteB = await setup('portal-b@example.com', 'Lycée Rivage');

    const portal = await getSitePortal(siteA.project.slug, context.db);
    expect(portal.title).toBe('Inscription en ligne');
    expect(portal.fields.map((field) => field.key)).toEqual(['nom', 'email', 'filiere-id', 'telephone', 'motivation']);
    expect(portal.fields.find((field) => field.key === 'filiere-id')?.relation?.targetLabel).toBe('Filières');
    expect(portal.fields.some((field) => field.key === 'statut')).toBe(false);

    const registered = await registerSiteUser(siteA.project.slug, { name: 'Awa Mensah', email: 'Awa@Example.com', password }, context.db);
    expect(registered.siteUser.normalizedEmail).toBe('awa@example.com');
    expect(registered.siteUser.projectId).toBe(siteA.project.id);

    const session = await resolveSiteSession(siteA.project.slug, registered.session.token, context.db);
    expect(session?.siteUser.id).toBe(registered.siteUser.id);
    expect(await resolveSiteSession(siteB.project.slug, registered.session.token, context.db)).toBeNull();
    const studioToken = (await createSession(siteA.account.user.id, context.db)).token;
    expect(await resolveSiteSession(siteA.project.slug, studioToken, context.db)).toBeNull();

    await expect(registerSiteUser(siteA.project.slug, { name: 'Awa bis', email: 'awa@example.com', password }, context.db)).rejects.toMatchObject({ status: 409, code: 'SITE_EMAIL_IN_USE' });
    const sameEmailElsewhere = await registerSiteUser(siteB.project.slug, { name: 'Awa Mensah', email: 'awa@example.com', password }, context.db);
    expect(sameEmailElsewhere.siteUser.projectId).toBe(siteB.project.id);
    await expect(loginSiteUser(siteA.project.slug, { email: 'awa@example.com', password: 'mauvais-mot-de-passe' }, context.db)).rejects.toMatchObject({ status: 401, code: 'SITE_INVALID_CREDENTIALS' });
    const logged = await loginSiteUser(siteA.project.slug, { email: 'awa@example.com', password }, context.db);
    expect(logged.siteUser.id).toBe(registered.siteUser.id);
    await expect(getSitePortal('Slug Invalide', context.db)).rejects.toMatchObject({ status: 404 });
  });

  it('dépose une demande avec le statut initial et ne montre que ses propres dossiers', async () => {
    const site = await setup('portal-c@example.com', 'Institut Kora');
    const filiere = await createApplicationRecord(site.account.user.id, site.project.id, 'filieres', { nom: 'Génie logiciel', code: 'GL', description: 'Formation en développement.' }, context.db);
    const portal = await getSitePortal(site.project.slug, context.db);
    expect(portal.fields.find((field) => field.key === 'filiere-id')?.relation?.options).toEqual([{ value: filiere.id, label: 'Génie logiciel' }]);

    const applicant = await registerSiteUser(site.project.slug, { name: 'Awa Mensah', email: 'awa.portal@example.com', password }, context.db);
    const submitted = await submitSiteRequest(site.project.slug, applicant.siteUser, {
      data: { nom: 'Awa Mensah', email: 'awa.portal@example.com', 'filiere-id': filiere.id, motivation: 'Je souhaite rejoindre cette formation.' },
    }, context.db);
    expect(submitted.status).toBe('recu');

    const stored = (await context.db.select().from(applicationRecords).where(and(eq(applicationRecords.id, submitted.id), eq(applicationRecords.projectId, site.project.id))))[0]!;
    expect(stored.siteUserId).toBe(applicant.siteUser.id);
    expect(stored.createdBy).toBeNull();
    expect(stored.data).toMatchObject({ nom: 'Awa Mensah', 'filiere-id': filiere.id, statut: 'recu' });

    await expect(submitSiteRequest(site.project.slug, applicant.siteUser, { data: { nom: 'Intrus', email: 'intrus@example.com', 'filiere-id': filiere.id, statut: 'accepte' } }, context.db))
      .rejects.toMatchObject({ status: 422, code: 'SITE_FIELD_NOT_PUBLIC' });
    await expect(submitSiteRequest(site.project.slug, applicant.siteUser, { data: { nom: 'Sans filière', email: 'sans@example.com', 'filiere-id': crypto.randomUUID() } }, context.db))
      .rejects.toMatchObject({ status: 422, code: 'SITE_RELATION_INVALID' });
    await expect(submitSiteRequest(site.project.slug, applicant.siteUser, { data: { nom: 'Incomplet' } }, context.db))
      .rejects.toMatchObject({ status: 422, code: 'SITE_REQUEST_INVALID' });

    const mine = await listSiteRequests(site.project.slug, applicant.siteUser, context.db);
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]).toMatchObject({ title: 'Awa Mensah', status: 'recu', statusLabel: 'Reçu' });

    const other = await registerSiteUser(site.project.slug, { name: 'Koffi Dossou', email: 'koffi.portal@example.com', password }, context.db);
    expect((await listSiteRequests(site.project.slug, other.siteUser, context.db)).items).toHaveLength(0);

    const studioList = await listApplicationRecords(site.account.user.id, site.project.id, 'dossiers', {}, context.db);
    expect(studioList.total).toBe(1);
    await executeApplicationAction(site.account.user.id, site.project.id, 'dossiers', submitted.id, 'mettre-en-revue', context.db);
    await executeApplicationAction(site.account.user.id, site.project.id, 'dossiers', submitted.id, 'accepter', context.db);
    const updated = await listSiteRequests(site.project.slug, applicant.siteUser, context.db);
    expect(updated.items[0]).toMatchObject({ status: 'accepte', statusLabel: 'Accepté' });
  });

  it('exige le jeton de session sur les écritures et réserve la configuration au Studio autorisé', async () => {
    const site = await setup('portal-d@example.com', 'Université Sèmè');
    const applicant = await registerSiteUser(site.project.slug, { name: 'Awa Mensah', email: 'awa.csrf@example.com', password }, context.db);
    const session = await resolveSiteSession(site.project.slug, applicant.session.token, context.db);
    expect(session).not.toBeNull();

    const csrfRequest = (origin: string, token: string) => new Request('http://localhost/api/portal/x/requests', { method: 'POST', headers: { origin, 'x-csrf-token': token } });
    await expect(assertSiteCsrf(csrfRequest('http://localhost', 'jeton-invalide'), session!)).rejects.toMatchObject({ status: 403, code: 'CSRF_REJECTED' });
    await expect(assertSiteCsrf(csrfRequest('http://evil.example', applicant.session.csrfToken), session!)).rejects.toMatchObject({ status: 403, code: 'ORIGIN_REJECTED' });
    await expect(assertSiteCsrf(csrfRequest('http://localhost', applicant.session.csrfToken), session!)).resolves.toBeUndefined();

    const outsider = await createAccount(context.db, 'portal-outsider@example.com', 'Outsider');
    await expect(savePublicIntake(outsider.user.id, site.project.id, { enabled: false }, context.db)).rejects.toMatchObject({ status: 404 });
    await expect(savePublicIntake(site.account.user.id, site.project.id, { enabled: true, objectKey: 'objet-inexistant' }, context.db)).rejects.toMatchObject({ status: 422, code: 'PUBLIC_INTAKE_OBJECT_INVALID' });

    const closed = await savePublicIntake(site.account.user.id, site.project.id, { enabled: false, objectKey: 'dossiers' }, context.db);
    expect(closed.enabled).toBe(false);
    expect(closed.objectKey).toBe('dossiers');
    await expect(getSitePortal(site.project.slug, context.db)).rejects.toMatchObject({ status: 404 });
    await expect(submitSiteRequest(site.project.slug, applicant.siteUser, { data: { nom: 'Fermé', email: 'ferme@example.com' } }, context.db)).rejects.toMatchObject({ status: 404, code: 'SITE_NOT_FOUND' });
    await expect(registerSiteUser(site.project.slug, { name: 'Nouveau', email: 'nouveau@example.com', password }, context.db)).rejects.toMatchObject({ status: 404 });
  });
});
