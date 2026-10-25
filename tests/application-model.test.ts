import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { createId } from '@/lib/id';
import type { DatabaseContext } from '@/server/db';
import { applicationModels, applicationRecords } from '@/server/db/schema';
import { createAccount, testDatabase } from './helpers/database';
import { createProject } from '@/server/services/projects';
import { addExistingMember } from '@/server/services/members';
import { applicationColumnKeys, applicationModelSchema, applicationRecordSchema, buildApplicationRoutes, roleCan, roleCanAction, type ApplicationModel } from '@/lib/application/model';
import { addApplicationTransition, addOptionalApplicationEnumField, addOptionalApplicationRelationField, addOptionalApplicationTextField, addOptionalApplicationTypedField, addSimpleApplicationObject, setApplicationObjectColumns } from '@/lib/application/model-editor';
import { commercialApplicationModel } from '@/lib/application/commercial-model';
import { restaurantApplicationModel } from '@/lib/application/restaurant-model';
import { schoolApplicationModel } from '@/lib/application/school-model';
import { universityApplicationModel } from '@/lib/application/university-model';
import {
  createApplicationRecord,
  deleteApplicationRecord,
  executeApplicationAction,
  exportApplicationRecords,
  getApplicationModel,
  getApplicationRecord,
  getApplicationSummary,
  listApplicationRecords,
  saveApplicationModel,
  updateApplicationRecord,
} from '@/server/services/application';

let context: DatabaseContext;
beforeAll(async () => { context = await testDatabase(); }, 60_000);
afterAll(async () => { await context.close(); });

async function setup(email: string, model: ApplicationModel = schoolApplicationModel) {
  const account = await createAccount(context.db, email, email.split('@')[0]!);
  const details = await createProject(account.user.id, account.workspace.id, { name: `Application ${email}`, description: '', templateId: 'studio-business' }, context.db);
  const saved = await saveApplicationModel(account.user.id, details.project.id, { model, baseVersion: null }, context.db);
  return { account, details, model: saved };
}

async function createFiliere(userId: string, projectId: string, code = 'INFO') {
  return createApplicationRecord(userId, projectId, 'filieres', { nom: `Informatique ${code}`, code, description: 'Formation en sciences numériques.' }, context.db);
}

function dossierInput(filiereId: string, suffix = 'A') {
  return { nom: `Étudiant ${suffix}`, email: `etudiant-${suffix.toLowerCase()}@example.com`, telephone: '+229 01 02 03 04', 'filiere-id': filiereId, motivation: 'Poursuivre mes études.' };
}

describe('modèle d’application géré', () => {
  it('valide les références du modèle et déduit les routes avec leurs rôles', () => {
    const routes = buildApplicationRoutes(schoolApplicationModel);
    expect(routes).toHaveLength(11);
    expect(routes.find((route) => route.id === 'dossiers.actions.accepter')?.roles).toEqual(['owner', 'admin', 'editor']);
    expect(routes.find((route) => route.id === 'dossiers.delete')?.roles).toEqual(['owner', 'admin']);

    const invalidRelation = structuredClone(schoolApplicationModel);
    invalidRelation.objects[1]!.fields.find((field) => field.key === 'filiere-id')!.targetObject = 'inconnu';
    expect(applicationModelSchema.safeParse(invalidRelation).success).toBe(false);

    const invalidViewer = structuredClone(schoolApplicationModel);
    invalidViewer.roles.find((role) => role.key === 'viewer')!.grants[0]!.operations = ['read', 'create'];
    expect(applicationModelSchema.safeParse(invalidViewer).success).toBe(false);

    const objectWithDate = structuredClone(schoolApplicationModel.objects[0]!);
    objectWithDate.fields.push({ key: 'ouverture', label: 'Ouverture', type: 'date', required: true });
    const dateSchema = applicationRecordSchema(objectWithDate, 'create');
    expect(dateSchema.safeParse({ nom: 'Informatique', code: 'INFO', ouverture: '2026-02-28' }).success).toBe(true);
    expect(dateSchema.safeParse({ nom: 'Informatique', code: 'INFO', ouverture: '2026-02-31' }).success).toBe(false);
  });

  it('exécute CRUD, recherche, statut initial et relations sans accès horizontal', async () => {
    const { account, details } = await setup('crud-application@example.com');
    const filiere = await createFiliere(account.user.id, details.project.id);
    const dossier = await createApplicationRecord(account.user.id, details.project.id, 'dossiers', dossierInput(filiere.id), context.db);
    expect(dossier.data.statut).toBe('recu');

    const found = await listApplicationRecords(account.user.id, details.project.id, 'dossiers', { q: 'etudiant-a@example.com', limit: 50, offset: 0 }, context.db);
    expect(found.total).toBe(1);
    expect(found.records[0]?.id).toBe(dossier.id);
    expect((await listApplicationRecords(account.user.id, details.project.id, 'dossiers', { status: 'accepte' }, context.db)).total).toBe(0);

    const updated = await updateApplicationRecord(account.user.id, details.project.id, 'dossiers', dossier.id, { ...dossierInput(filiere.id), telephone: '+229 97 00 00 00' }, context.db);
    expect(updated.data).toMatchObject({ telephone: '+229 97 00 00 00', statut: 'recu' });
    await expect(updateApplicationRecord(account.user.id, details.project.id, 'dossiers', dossier.id, { ...dossierInput(filiere.id), statut: 'accepte' }, context.db)).rejects.toMatchObject({ name: 'ZodError' });
    expect((await getApplicationRecord(account.user.id, details.project.id, 'dossiers', dossier.id, context.db)).data.statut).toBe('recu');

    const otherProject = await createProject(account.user.id, account.workspace.id, { name: 'Autre projet applicatif', description: '', templateId: 'studio-business' }, context.db);
    await saveApplicationModel(account.user.id, otherProject.project.id, { model: schoolApplicationModel, baseVersion: null }, context.db);
    const otherFiliere = await createFiliere(account.user.id, otherProject.project.id, 'DROIT');
    const resolvedByIds = await listApplicationRecords(account.user.id, details.project.id, 'filieres', { ids: [filiere.id, otherFiliere.id], limit: 100, offset: 0 }, context.db);
    expect(resolvedByIds.records.map((record) => record.id)).toEqual([filiere.id]);
    expect(resolvedByIds.total).toBe(1);
    expect((await listApplicationRecords(account.user.id, details.project.id, 'dossiers', { ids: [filiere.id] }, context.db)).total).toBe(0);
    await expect(createApplicationRecord(account.user.id, details.project.id, 'dossiers', dossierInput(otherFiliere.id, 'B'), context.db)).rejects.toMatchObject({ status: 422, code: 'APPLICATION_RELATION_INVALID' });
  });

  it('pagine sans doublon avec un départage stable lorsque les dates sont identiques', async () => {
    const { account, details } = await setup('pagination-application@example.com');
    for (let index = 0; index < 27; index += 1) {
      await createFiliere(account.user.id, details.project.id, `P${String(index).padStart(2, '0')}`);
    }
    const sameCreationDate = new Date('2026-10-24T12:00:00.000Z');
    await context.db.update(applicationRecords).set({ createdAt: sameCreationDate }).where(and(
      eq(applicationRecords.projectId, details.project.id),
      eq(applicationRecords.workspaceId, account.workspace.id),
      eq(applicationRecords.objectKey, 'filieres'),
    ));

    const all = await listApplicationRecords(account.user.id, details.project.id, 'filieres', { limit: 100, offset: 0 }, context.db);
    const expectedIds = all.records.map((record) => record.id).sort((left, right) => left < right ? 1 : left > right ? -1 : 0);
    expect(all.records.map((record) => record.id)).toEqual(expectedIds);

    const first = await listApplicationRecords(account.user.id, details.project.id, 'filieres', { limit: 25, offset: 0 }, context.db);
    const second = await listApplicationRecords(account.user.id, details.project.id, 'filieres', { limit: 25, offset: 25 }, context.db);
    const repeatedFirst = await listApplicationRecords(account.user.id, details.project.id, 'filieres', { limit: 25, offset: 0 }, context.db);
    expect(first.total).toBe(27);
    expect(first.records).toHaveLength(25);
    expect(second.records).toHaveLength(2);
    expect(repeatedFirst.records.map((record) => record.id)).toEqual(first.records.map((record) => record.id));
    expect([...first.records, ...second.records].map((record) => record.id)).toEqual(expectedIds);
    expect(new Set([...first.records, ...second.records].map((record) => record.id)).size).toBe(27);
    expect((await listApplicationRecords(account.user.id, details.project.id, 'filieres', { limit: 25, offset: 50 }, context.db)).records).toEqual([]);
  });

  it('applique les transitions et les permissions du rôle à chaque opération', async () => {
    const { account, details } = await setup('roles-application@example.com');
    const filiere = await createFiliere(account.user.id, details.project.id);
    const dossier = await createApplicationRecord(account.user.id, details.project.id, 'dossiers', dossierInput(filiere.id), context.db);
    const editor = await createAccount(context.db, 'editor-application@example.com', 'Secrétariat');
    const contributor = await createAccount(context.db, 'contributor-application@example.com', 'Contributeur');
    const viewer = await createAccount(context.db, 'viewer-application@example.com', 'Lecture');
    const outsider = await createAccount(context.db, 'outsider-application@example.com', 'Extérieur');
    await addExistingMember(account.user.id, account.workspace.id, { email: editor.user.email, role: 'editor' }, context.db);
    await addExistingMember(account.user.id, account.workspace.id, { email: contributor.user.email, role: 'contributor' }, context.db);
    await addExistingMember(account.user.id, account.workspace.id, { email: viewer.user.email, role: 'viewer' }, context.db);

    expect((await listApplicationRecords(viewer.user.id, details.project.id, 'dossiers', {}, context.db)).total).toBe(1);
    await expect(createApplicationRecord(viewer.user.id, details.project.id, 'dossiers', dossierInput(filiere.id, 'Viewer'), context.db)).rejects.toMatchObject({ status: 403 });
    await expect(executeApplicationAction(contributor.user.id, details.project.id, 'dossiers', dossier.id, 'mettre-en-revue', context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    await expect(deleteApplicationRecord(editor.user.id, details.project.id, 'dossiers', dossier.id, context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    await expect(executeApplicationAction(editor.user.id, details.project.id, 'dossiers', dossier.id, 'accepter', context.db)).rejects.toMatchObject({ status: 409, code: 'APPLICATION_TRANSITION_INVALID' });

    expect((await executeApplicationAction(editor.user.id, details.project.id, 'dossiers', dossier.id, 'mettre-en-revue', context.db)).data.statut).toBe('en-revue');
    expect((await executeApplicationAction(editor.user.id, details.project.id, 'dossiers', dossier.id, 'accepter', context.db)).data.statut).toBe('accepte');
    await expect(executeApplicationAction(editor.user.id, details.project.id, 'dossiers', dossier.id, 'accepter', context.db)).rejects.toMatchObject({ status: 409, code: 'APPLICATION_TRANSITION_INVALID' });
    await expect(listApplicationRecords(outsider.user.id, details.project.id, 'dossiers', {}, context.db)).rejects.toMatchObject({ status: 404 });
    await expect(saveApplicationModel(editor.user.id, details.project.id, { model: schoolApplicationModel, baseVersion: 1 }, context.db)).rejects.toMatchObject({ status: 403 });
  });

  it('exécute une réservation de restaurant avec ses rôles accueil et service', async () => {
    const routes = buildApplicationRoutes(restaurantApplicationModel);
    expect(routes).toHaveLength(12);
    expect(routes.find((route) => route.id === 'reservations.actions.confirmer')?.roles).toEqual(['owner', 'admin', 'editor']);
    expect(routes.find((route) => route.id === 'reservations.actions.installer')?.roles).toEqual(['owner', 'admin', 'contributor']);
    const { account, details } = await setup('restaurant-application@example.com', restaurantApplicationModel);
    const table = await createApplicationRecord(account.user.id, details.project.id, 'tables', { nom: 'Terrasse 1', places: 4, zone: 'terrasse', notes: 'Table au calme.' }, context.db);
    const editor = await createAccount(context.db, 'restaurant-accueil@example.com', 'Accueil');
    const contributor = await createAccount(context.db, 'restaurant-service@example.com', 'Service');
    await addExistingMember(account.user.id, account.workspace.id, { email: editor.user.email, role: 'editor' }, context.db);
    await addExistingMember(account.user.id, account.workspace.id, { email: contributor.user.email, role: 'contributor' }, context.db);
    const input = { nom: 'Client Restaurant', email: 'client-restaurant@example.com', telephone: '+229 01 02 03 04', date: '2026-12-24', service: 'diner', personnes: 2, 'table-id': table.id, notes: 'Anniversaire.' };
    const reservation = await createApplicationRecord(account.user.id, details.project.id, 'reservations', input, context.db);
    expect(reservation.data.statut).toBe('demandee');
    await expect(executeApplicationAction(contributor.user.id, details.project.id, 'reservations', reservation.id, 'confirmer', context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    expect((await executeApplicationAction(editor.user.id, details.project.id, 'reservations', reservation.id, 'confirmer', context.db)).data.statut).toBe('confirmee');
    await expect(executeApplicationAction(editor.user.id, details.project.id, 'reservations', reservation.id, 'installer', context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    expect((await executeApplicationAction(contributor.user.id, details.project.id, 'reservations', reservation.id, 'installer', context.db)).data.statut).toBe('installee');
    await expect(executeApplicationAction(editor.user.id, details.project.id, 'reservations', reservation.id, 'terminer', context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    expect((await executeApplicationAction(contributor.user.id, details.project.id, 'reservations', reservation.id, 'terminer', context.db)).data.statut).toBe('terminee');
    await expect(executeApplicationAction(editor.user.id, details.project.id, 'reservations', reservation.id, 'annuler', context.db)).rejects.toMatchObject({ status: 409, code: 'APPLICATION_TRANSITION_INVALID' });
    await expect(createApplicationRecord(contributor.user.id, details.project.id, 'reservations', input, context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    expect((await getApplicationRecord(account.user.id, details.project.id, 'reservations', reservation.id, context.db)).data).toMatchObject({ statut: 'terminee', 'table-id': table.id, personnes: 2 });
    expect((await listApplicationRecords(account.user.id, details.project.id, 'reservations', { q: 'Client Restaurant' }, context.db)).total).toBe(1);
  });

  it('exécute une opportunité commerciale avec validation séparée et relation client persistée', async () => {
    const routes = buildApplicationRoutes(commercialApplicationModel);
    expect(routes).toHaveLength(12);
    expect(routes.find((route) => route.id === 'opportunites.actions.qualifier')?.roles).toEqual(['owner', 'admin', 'editor']);
    expect(routes.find((route) => route.id === 'opportunites.actions.conclure')?.roles).toEqual(['owner', 'admin', 'contributor']);
    const { account, details } = await setup('commercial-application@example.com', commercialApplicationModel);
    const client = await createApplicationRecord(account.user.id, details.project.id, 'clients', { nom: 'Entreprise Baobab', contact: 'Awa Mensah', email: 'contact@baobab.example', telephone: '+229 01 02 03 04', segment: 'grand-compte', notes: 'Client historique.' }, context.db);
    const editor = await createAccount(context.db, 'commercial-equipe@example.com', 'Commercial');
    const contributor = await createAccount(context.db, 'commercial-validation@example.com', 'Validation');
    await addExistingMember(account.user.id, account.workspace.id, { email: editor.user.email, role: 'editor' }, context.db);
    await addExistingMember(account.user.id, account.workspace.id, { email: contributor.user.email, role: 'contributor' }, context.db);
    const input = { nom: 'Refonte du portail client', 'client-id': client.id, budget: 12500.5, echeance: '2027-01-15', notes: 'Proposition à valider.' };
    const opportunity = await createApplicationRecord(account.user.id, details.project.id, 'opportunites', input, context.db);
    expect(opportunity.data.statut).toBe('nouvelle');
    await expect(executeApplicationAction(contributor.user.id, details.project.id, 'opportunites', opportunity.id, 'qualifier', context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    expect((await executeApplicationAction(editor.user.id, details.project.id, 'opportunites', opportunity.id, 'qualifier', context.db)).data.statut).toBe('qualifiee');
    await expect(executeApplicationAction(editor.user.id, details.project.id, 'opportunites', opportunity.id, 'conclure', context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    expect((await executeApplicationAction(editor.user.id, details.project.id, 'opportunites', opportunity.id, 'proposer', context.db)).data.statut).toBe('proposition');
    expect((await executeApplicationAction(contributor.user.id, details.project.id, 'opportunites', opportunity.id, 'conclure', context.db)).data.statut).toBe('gagnee');
    await expect(executeApplicationAction(editor.user.id, details.project.id, 'opportunites', opportunity.id, 'perdre', context.db)).rejects.toMatchObject({ status: 409, code: 'APPLICATION_TRANSITION_INVALID' });
    await expect(createApplicationRecord(contributor.user.id, details.project.id, 'opportunites', input, context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    await expect(deleteApplicationRecord(editor.user.id, details.project.id, 'clients', client.id, context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    expect((await getApplicationRecord(account.user.id, details.project.id, 'opportunites', opportunity.id, context.db)).data).toMatchObject({ statut: 'gagnee', 'client-id': client.id, budget: 12500.5 });
    expect((await listApplicationRecords(account.user.id, details.project.id, 'opportunites', { q: 'Refonte du portail' }, context.db)).total).toBe(1);
  });

  it('exécute une inscription universitaire avec deux relations et droits scolarité/enseignement', async () => {
    const routes = buildApplicationRoutes(universityApplicationModel);
    expect(routes).toHaveLength(16);
    expect(routes.find((route) => route.id === 'inscriptions.actions.accepter')?.roles).toEqual(['owner', 'admin', 'editor']);
    expect(routes.find((route) => route.id === 'inscriptions.actions.activer')?.roles).toEqual(['owner', 'admin', 'contributor']);
    const { account, details } = await setup('university-application@example.com', universityApplicationModel);
    const student = await createApplicationRecord(account.user.id, details.project.id, 'etudiants', { nom: 'Awa Université', email: 'awa-universite@example.com', telephone: '+229 01 02 03 04', notes: 'Dossier complet.' }, context.db);
    const course = await createApplicationRecord(account.user.id, details.project.id, 'cours', { intitule: 'Architecture logicielle', code: 'ARCH-401', credits: 6, semestre: 's1', description: 'Conception d’applications modulaires.' }, context.db);
    const editor = await createAccount(context.db, 'university-scolarite@example.com', 'Scolarité');
    const contributor = await createAccount(context.db, 'university-enseignement@example.com', 'Enseignement');
    await addExistingMember(account.user.id, account.workspace.id, { email: editor.user.email, role: 'editor' }, context.db);
    await addExistingMember(account.user.id, account.workspace.id, { email: contributor.user.email, role: 'contributor' }, context.db);
    const input = { reference: 'INS-2027-001', 'etudiant-id': student.id, 'cours-id': course.id, rentree: '2027-09-01', notes: 'Inscription prioritaire.' };
    const enrollment = await createApplicationRecord(account.user.id, details.project.id, 'inscriptions', input, context.db);
    expect(enrollment.data.statut).toBe('demandee');
    await expect(executeApplicationAction(contributor.user.id, details.project.id, 'inscriptions', enrollment.id, 'accepter', context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    expect((await executeApplicationAction(editor.user.id, details.project.id, 'inscriptions', enrollment.id, 'accepter', context.db)).data.statut).toBe('acceptee');
    await expect(executeApplicationAction(editor.user.id, details.project.id, 'inscriptions', enrollment.id, 'activer', context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    expect((await executeApplicationAction(contributor.user.id, details.project.id, 'inscriptions', enrollment.id, 'activer', context.db)).data.statut).toBe('active');
    await expect(executeApplicationAction(editor.user.id, details.project.id, 'inscriptions', enrollment.id, 'terminer', context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    expect((await executeApplicationAction(contributor.user.id, details.project.id, 'inscriptions', enrollment.id, 'terminer', context.db)).data.statut).toBe('terminee');
    await expect(executeApplicationAction(editor.user.id, details.project.id, 'inscriptions', enrollment.id, 'annuler', context.db)).rejects.toMatchObject({ status: 409, code: 'APPLICATION_TRANSITION_INVALID' });
    await expect(createApplicationRecord(contributor.user.id, details.project.id, 'inscriptions', input, context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    await expect(deleteApplicationRecord(account.user.id, details.project.id, 'etudiants', student.id, context.db)).rejects.toMatchObject({ status: 409, code: 'APPLICATION_RECORD_REFERENCED' });
    await expect(deleteApplicationRecord(account.user.id, details.project.id, 'cours', course.id, context.db)).rejects.toMatchObject({ status: 409, code: 'APPLICATION_RECORD_REFERENCED' });
    expect((await getApplicationRecord(account.user.id, details.project.id, 'inscriptions', enrollment.id, context.db)).data).toMatchObject({ statut: 'terminee', 'etudiant-id': student.id, 'cours-id': course.id });
    expect((await listApplicationRecords(account.user.id, details.project.id, 'inscriptions', { q: 'INS-2027' }, context.db)).total).toBe(1);
  });

  it('agrège tous les enregistrements lisibles au-delà de la pagination sans exposer les objets interdits', async () => {
    const restricted = structuredClone(restaurantApplicationModel);
    restricted.roles = restricted.roles.map((role) => role.key === 'editor' ? { ...role, grants: role.grants.filter((grant) => grant.object === 'reservations') } : role);
    const { account, details } = await setup('summary-application@example.com', restricted);
    const empty = await getApplicationSummary(account.user.id, details.project.id, context.db);
    expect(empty).toEqual({ total: 0, objects: [{ objectKey: 'tables', total: 0, statuses: [] }, { objectKey: 'reservations', total: 0, statuses: [] }] });
    const table = await createApplicationRecord(account.user.id, details.project.id, 'tables', { nom: 'Salle synthèse', places: 4, zone: 'salle' }, context.db);
    const editor = await createAccount(context.db, 'summary-accueil@example.com', 'Accueil');
    await addExistingMember(account.user.id, account.workspace.id, { email: editor.user.email, role: 'editor' }, context.db);
    const reservations = [];
    for (let index = 0; index < 30; index += 1) {
      reservations.push(await createApplicationRecord(account.user.id, details.project.id, 'reservations', { nom: `Client synthèse ${index}`, telephone: '+229 01 02 03 04', date: '2027-02-10', service: 'diner', personnes: 2, 'table-id': table.id }, context.db));
    }
    await executeApplicationAction(editor.user.id, details.project.id, 'reservations', reservations[0]!.id, 'confirmer', context.db);
    const page = await listApplicationRecords(account.user.id, details.project.id, 'reservations', { limit: 25, offset: 0 }, context.db);
    expect(page.records).toHaveLength(25);
    expect(page.total).toBe(30);
    const summary = await getApplicationSummary(account.user.id, details.project.id, context.db);
    expect(summary.total).toBe(31);
    expect(summary.objects.find((object) => object.objectKey === 'tables')).toEqual({ objectKey: 'tables', total: 1, statuses: [] });
    const reservationSummary = summary.objects.find((object) => object.objectKey === 'reservations');
    expect(reservationSummary?.total).toBe(30);
    expect(reservationSummary?.statuses).toEqual(expect.arrayContaining([{ value: 'demandee', count: 29 }, { value: 'confirmee', count: 1 }]));
    const editorSummary = await getApplicationSummary(editor.user.id, details.project.id, context.db);
    expect(editorSummary.total).toBe(30);
    expect(editorSummary.objects.map((object) => object.objectKey)).toEqual(['reservations']);
    expect(restaurantApplicationModel.roles.find((role) => role.key === 'editor')?.grants).toHaveLength(2);
  });

  it('exporte un CSV filtré et borné avec toutes les colonnes, sans formule de tableur ni accès interdit', async () => {
    const restricted = structuredClone(restaurantApplicationModel);
    restricted.roles = restricted.roles.map((role) => role.key === 'editor' ? { ...role, grants: role.grants.filter((grant) => grant.object === 'tables') } : role);
    const { account, details } = await setup('csv-application@example.com', restricted);
    const table = await createApplicationRecord(account.user.id, details.project.id, 'tables', { nom: 'Salle export', places: 4, zone: 'salle' }, context.db);
    const rows = Array.from({ length: 5001 }, (_, index) => {
      const createdAt = new Date(Date.UTC(2027, 0, 1) + (5001 - index) * 1000);
      return {
        id: createId('application-record'), workspaceId: account.workspace.id, projectId: details.project.id, objectKey: 'reservations', createdBy: account.user.id, createdAt, updatedAt: createdAt,
        data: { nom: index === 0 ? '=2+2' : index === 1 ? 'Client confirmé' : `Client export ${index}`, telephone: '+229 01 02 03 04', date: '2027-02-10', service: 'diner', personnes: 2, 'table-id': table.id, statut: index === 1 ? 'confirmee' : 'demandee' },
      };
    });
    for (let offset = 0; offset < rows.length; offset += 1000) await context.db.insert(applicationRecords).values(rows.slice(offset, offset + 1000));
    const result = await exportApplicationRecords(account.user.id, details.project.id, 'reservations', {}, context.db);
    expect(result).toMatchObject({ filename: 'woob-reservations.csv', total: 5001, exported: 5000, truncated: true });
    expect(result.csv.startsWith('\uFEFF"id","nom","email"')).toBe(true);
    expect(result.csv).toContain('"table-id","notes","statut","created_at","updated_at"');
    expect(result.csv.split('\r\n')).toHaveLength(5001);
    expect(result.csv).toContain('"\'=2+2"');
    expect(result.csv).not.toContain('"=2+2"');
    const filtered = await exportApplicationRecords(account.user.id, details.project.id, 'reservations', { q: 'Client confirmé', status: 'confirmee' }, context.db);
    expect(filtered).toMatchObject({ total: 1, exported: 1, truncated: false });
    expect(filtered.csv).toContain('Client confirmé');
    expect(filtered.csv).toContain('"confirmee"');
    expect(filtered.csv).not.toContain('=2+2');
    await expect(exportApplicationRecords(account.user.id, details.project.id, 'reservations', { status: 'inconnu' }, context.db)).rejects.toMatchObject({ status: 422, code: 'APPLICATION_FILTER_INVALID' });
    const editor = await createAccount(context.db, 'csv-accueil@example.com', 'Accueil');
    await addExistingMember(account.user.id, account.workspace.id, { email: editor.user.email, role: 'editor' }, context.db);
    await expect(exportApplicationRecords(editor.user.id, details.project.id, 'reservations', {}, context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
  });

  it('prépare et persiste un objet simple sans muter le modèle initial ni élargir les droits', async () => {
    const { account, details } = await setup('editor-application-model@example.com');
    const input = { label: 'Club d’échecs', pluralLabel: 'Clubs', key: '', description: 'Groupes et activités.' };
    const draft = addSimpleApplicationObject(schoolApplicationModel, input);
    const club = draft.objects[2]!;
    expect(schoolApplicationModel.objects).toHaveLength(2);
    expect(club.key).toBe('club-d-echecs');
    expect(club.fields).toEqual([{ key: 'nom', label: 'Nom', type: 'text', required: true, maxLength: 160 }]);
    expect(buildApplicationRoutes(draft)).toHaveLength(15);
    expect(buildApplicationRoutes(draft).find((route) => route.id === `${club.key}.create`)?.roles).toEqual(['owner', 'admin']);
    expect(roleCan(draft, 'owner', club.key, 'create')).toBe(true);
    expect(roleCan(draft, 'editor', club.key, 'read')).toBe(false);
    expect(addSimpleApplicationObject(draft, input).objects[3]?.key).toBe('club-d-echecs-2');

    const existing = await createFiliere(account.user.id, details.project.id, 'LEGACY');
    expect((await saveApplicationModel(account.user.id, details.project.id, { model: draft, baseVersion: 1 }, context.db)).version).toBe(2);
    const created = await createApplicationRecord(account.user.id, details.project.id, club.key, { nom: 'Club robotique' }, context.db);
    expect(created.data.nom).toBe('Club robotique');
    expect((await listApplicationRecords(account.user.id, details.project.id, club.key, {}, context.db)).total).toBe(1);
    expect((await getApplicationRecord(account.user.id, details.project.id, 'filieres', existing.id, context.db)).data.code).toBe('LEGACY');
  });

  it('ajoute un champ texte optionnel sans réécrire les colonnes, les grants ou les anciennes données', async () => {
    const { account, details } = await setup('field-application-model@example.com');
    const existing = await createFiliere(account.user.id, details.project.id, 'AVANT');
    const input = { objectKey: 'filieres', label: 'Responsable', key: '' };
    const draft = addOptionalApplicationTextField(schoolApplicationModel, input);
    const originalObject = schoolApplicationModel.objects[0]!;
    const target = draft.objects[0]!;
    expect(schoolApplicationModel.objects[0]!.fields).toHaveLength(3);
    expect(target.fields.at(-1)).toEqual({ key: 'responsable', label: 'Responsable', type: 'text', required: false, maxLength: 160 });
    expect(target.columns).toEqual(originalObject.columns);
    expect(target.actions).toEqual(originalObject.actions);
    expect(draft.roles).toEqual(schoolApplicationModel.roles);
    expect(buildApplicationRoutes(draft)).toHaveLength(11);
    expect(addOptionalApplicationTextField(draft, input).objects[0]!.fields.at(-1)?.key).toBe('responsable-2');
    expect(() => addOptionalApplicationTextField(draft, { ...input, objectKey: 'inconnu' })).toThrow('Objet cible introuvable');

    expect((await saveApplicationModel(account.user.id, details.project.id, { model: draft, baseVersion: 1 }, context.db)).version).toBe(2);
    const beforeUpdate = await getApplicationRecord(account.user.id, details.project.id, 'filieres', existing.id, context.db);
    expect(beforeUpdate.data.code).toBe('AVANT');
    expect(beforeUpdate.data.responsable).toBeUndefined();
    const updated = await updateApplicationRecord(account.user.id, details.project.id, 'filieres', existing.id, { ...existing.data, responsable: 'Awa Mensah' }, context.db);
    expect(updated.data.responsable).toBe('Awa Mensah');
    expect((await getApplicationRecord(account.user.id, details.project.id, 'filieres', existing.id, context.db)).data.responsable).toBe('Awa Mensah');
    expect((await createFiliere(account.user.id, details.project.id, 'APRES')).data.code).toBe('APRES');
  });

  it('ajoute des entiers, décimaux et dates optionnels validés sans réécrire les données existantes', async () => {
    const { account, details } = await setup('typed-fields-application-model@example.com');
    const existing = await createFiliere(account.user.id, details.project.id, 'AVANT');
    const originalObject = structuredClone(schoolApplicationModel.objects[0]!);
    const integerInput = { objectKey: 'filieres', label: 'Capacité', key: '', type: 'integer' } as const;
    const withInteger = addOptionalApplicationTypedField(schoolApplicationModel, integerInput);
    const withNumber = addOptionalApplicationTypedField(withInteger, { objectKey: 'filieres', label: 'Taux de réussite', key: '', type: 'number' });
    const draft = addOptionalApplicationTypedField(withNumber, { objectKey: 'filieres', label: 'Ouverture prévue', key: '', type: 'date' });
    const target = draft.objects[0]!;
    expect(schoolApplicationModel.objects[0]!.fields).toHaveLength(3);
    expect(target.fields.slice(-3)).toEqual([
      { key: 'capacite', label: 'Capacité', type: 'integer', required: false },
      { key: 'taux-de-reussite', label: 'Taux de réussite', type: 'number', required: false },
      { key: 'ouverture-prevue', label: 'Ouverture prévue', type: 'date', required: false },
    ]);
    expect(target.columns).toEqual(originalObject.columns);
    expect(target.actions).toEqual(originalObject.actions);
    expect(draft.roles).toEqual(schoolApplicationModel.roles);
    expect(buildApplicationRoutes(draft)).toHaveLength(11);
    expect(addOptionalApplicationTypedField(draft, integerInput).objects[0]!.fields.at(-1)?.key).toBe('capacite-2');

    expect((await saveApplicationModel(account.user.id, details.project.id, { model: draft, baseVersion: 1 }, context.db)).version).toBe(2);
    const beforeUpdate = await getApplicationRecord(account.user.id, details.project.id, 'filieres', existing.id, context.db);
    expect(beforeUpdate.data.code).toBe('AVANT');
    expect(beforeUpdate.data.capacite).toBeUndefined();
    const values = { ...existing.data, capacite: 40, 'taux-de-reussite': 87.5, 'ouverture-prevue': '2027-09-01' };
    await expect(updateApplicationRecord(account.user.id, details.project.id, 'filieres', existing.id, { ...values, capacite: 40.5 }, context.db)).rejects.toMatchObject({ name: 'ZodError' });
    await expect(updateApplicationRecord(account.user.id, details.project.id, 'filieres', existing.id, { ...values, 'taux-de-reussite': Number.POSITIVE_INFINITY }, context.db)).rejects.toMatchObject({ name: 'ZodError' });
    await expect(updateApplicationRecord(account.user.id, details.project.id, 'filieres', existing.id, { ...values, 'ouverture-prevue': '2027-02-30' }, context.db)).rejects.toMatchObject({ name: 'ZodError' });
    const updated = await updateApplicationRecord(account.user.id, details.project.id, 'filieres', existing.id, values, context.db);
    expect(updated.data).toMatchObject({ code: 'AVANT', capacite: 40, 'taux-de-reussite': 87.5, 'ouverture-prevue': '2027-09-01' });
    expect((await getApplicationRecord(account.user.id, details.project.id, 'filieres', existing.id, context.db)).data).toMatchObject(values);
    const withoutOptional = await createFiliere(account.user.id, details.project.id, 'APRES');
    expect(withoutOptional.data.capacite).toBeUndefined();
    expect(withoutOptional.data['taux-de-reussite']).toBeUndefined();
    expect(withoutOptional.data['ouverture-prevue']).toBeUndefined();
  });

  it('ajoute une liste enum optionnelle avec des clés déterministes et conserve les anciennes données', async () => {
    const { account, details } = await setup('enum-field-application-model@example.com');
    const existing = await createFiliere(account.user.id, details.project.id, 'AVANT');
    const originalObject = structuredClone(schoolApplicationModel.objects[0]!);
    const input = { objectKey: 'filieres', label: 'Niveau d’études', key: '', options: ['Licence', 'Master', 'Sur place', 'Sur-place'] };
    const draft = addOptionalApplicationEnumField(schoolApplicationModel, input);
    const target = draft.objects[0]!;
    expect(schoolApplicationModel.objects[0]!.fields).toHaveLength(3);
    expect(target.fields.at(-1)).toEqual({
      key: 'niveau-d-etudes', label: 'Niveau d’études', type: 'enum', required: false,
      options: [
        { value: 'licence', label: 'Licence' },
        { value: 'master', label: 'Master' },
        { value: 'sur-place', label: 'Sur place' },
        { value: 'sur-place-2', label: 'Sur-place' },
      ],
    });
    expect(target.columns).toEqual(originalObject.columns);
    expect(target.actions).toEqual(originalObject.actions);
    expect(draft.objects[1]).toEqual(schoolApplicationModel.objects[1]);
    expect(draft.roles).toEqual(schoolApplicationModel.roles);
    expect(buildApplicationRoutes(draft)).toHaveLength(11);
    expect(addOptionalApplicationEnumField(draft, input).objects[0]!.fields.at(-1)?.key).toBe('niveau-d-etudes-2');
    expect(() => addOptionalApplicationEnumField(draft, { ...input, options: ['Unique'] })).toThrow('2 et 40');
    expect(() => addOptionalApplicationEnumField(draft, { ...input, options: Array.from({ length: 41 }, (_, index) => `Option ${index}`) })).toThrow('2 et 40');
    expect(() => addOptionalApplicationEnumField(draft, { ...input, options: ['Licence', ' licence '] })).toThrow('libellés');
    expect(() => addOptionalApplicationEnumField(draft, { ...input, options: ['Licence', ''] })).toThrow('vides');
    expect(() => addOptionalApplicationEnumField(draft, { ...input, objectKey: 'inconnu' })).toThrow('Objet cible introuvable');

    expect((await saveApplicationModel(account.user.id, details.project.id, { model: draft, baseVersion: 1 }, context.db)).version).toBe(2);
    expect((await getApplicationRecord(account.user.id, details.project.id, 'filieres', existing.id, context.db)).data['niveau-d-etudes']).toBeUndefined();
    const withoutValue = await createFiliere(account.user.id, details.project.id, 'SANS');
    expect(withoutValue.data['niveau-d-etudes']).toBeUndefined();
    await expect(updateApplicationRecord(account.user.id, details.project.id, 'filieres', existing.id, { ...existing.data, 'niveau-d-etudes': 'inconnu' }, context.db)).rejects.toMatchObject({ name: 'ZodError' });
    const updated = await updateApplicationRecord(account.user.id, details.project.id, 'filieres', existing.id, { ...existing.data, 'niveau-d-etudes': 'master' }, context.db);
    expect(updated.data).toMatchObject({ code: 'AVANT', 'niveau-d-etudes': 'master' });
    expect((await getApplicationRecord(account.user.id, details.project.id, 'filieres', existing.id, context.db)).data['niveau-d-etudes']).toBe('master');
  });

  it('ajoute une relation optionnelle tout en validant le type lié et en conservant les dossiers existants', async () => {
    const { account, details } = await setup('relation-application-model@example.com');
    const primary = await createFiliere(account.user.id, details.project.id, 'PRINCIPALE');
    const secondary = await createFiliere(account.user.id, details.project.id, 'SECONDAIRE');
    const dossier = await createApplicationRecord(account.user.id, details.project.id, 'dossiers', dossierInput(primary.id), context.db);
    const input = { objectKey: 'dossiers', targetObject: 'filieres', label: 'Filière secondaire', key: '' };
    const originalObject = structuredClone(schoolApplicationModel.objects[1]!);
    const draft = addOptionalApplicationRelationField(schoolApplicationModel, input);
    const target = draft.objects[1]!;
    expect(schoolApplicationModel.objects[1]!.fields).toHaveLength(originalObject.fields.length);
    expect(target.fields.at(-1)).toEqual({ key: 'filiere-secondaire', label: 'Filière secondaire', type: 'relation', required: false, targetObject: 'filieres' });
    expect(target.columns).toEqual(originalObject.columns);
    expect(target.actions).toEqual(originalObject.actions);
    expect(draft.roles).toEqual(schoolApplicationModel.roles);
    expect(buildApplicationRoutes(draft)).toHaveLength(11);
    expect(addOptionalApplicationRelationField(draft, input).objects[1]!.fields.at(-1)?.key).toBe('filiere-secondaire-2');
    expect(() => addOptionalApplicationRelationField(draft, { ...input, objectKey: 'inconnu' })).toThrow('Objet source introuvable');
    expect(() => addOptionalApplicationRelationField(draft, { ...input, targetObject: 'inconnu' })).toThrow('Objet lié introuvable');
    const withClub = addSimpleApplicationObject(draft, { label: 'Club', pluralLabel: 'Clubs', key: '', description: '' });
    expect(addOptionalApplicationRelationField(withClub, { objectKey: 'club', targetObject: 'filieres', label: 'Filière du club', key: '' }).objects.find((object) => object.key === 'club')?.fields.at(-1)).toMatchObject({ key: 'filiere-du-club', targetObject: 'filieres', required: false });
    expect(addOptionalApplicationRelationField(withClub, { ...input, label: 'Club du dossier', targetObject: 'club' }).objects[1]!.fields.at(-1)).toMatchObject({ key: 'club-du-dossier', targetObject: 'club', required: false });

    expect((await saveApplicationModel(account.user.id, details.project.id, { model: draft, baseVersion: 1 }, context.db)).version).toBe(2);
    expect((await getApplicationRecord(account.user.id, details.project.id, 'dossiers', dossier.id, context.db)).data['filiere-secondaire']).toBeUndefined();
    await expect(updateApplicationRecord(account.user.id, details.project.id, 'dossiers', dossier.id, { ...dossierInput(primary.id, 'B'), 'filiere-secondaire': dossier.id }, context.db)).rejects.toMatchObject({ status: 422, code: 'APPLICATION_RELATION_INVALID' });
    const updated = await updateApplicationRecord(account.user.id, details.project.id, 'dossiers', dossier.id, { ...dossierInput(primary.id, 'B'), 'filiere-secondaire': secondary.id }, context.db);
    expect(updated.data['filiere-secondaire']).toBe(secondary.id);
    expect(updated.data['filiere-id']).toBe(primary.id);
    expect(updated.data.statut).toBe('recu');
    expect((await getApplicationRecord(account.user.id, details.project.id, 'dossiers', dossier.id, context.db)).data['filiere-secondaire']).toBe(secondary.id);
    await expect(deleteApplicationRecord(account.user.id, details.project.id, 'filieres', secondary.id, context.db)).rejects.toMatchObject({ status: 409, code: 'APPLICATION_RECORD_REFERENCED' });
    const withoutOptional = await createApplicationRecord(account.user.id, details.project.id, 'dossiers', dossierInput(primary.id, 'C'), context.db);
    expect(withoutOptional.data['filiere-secondaire']).toBeUndefined();
  });

  it('configure les colonnes sans muter les champs, les grants ou les données existantes', async () => {
    const { account, details } = await setup('columns-application-model@example.com');
    const filiere = await createFiliere(account.user.id, details.project.id);
    const dossier = await createApplicationRecord(account.user.id, details.project.id, 'dossiers', dossierInput(filiere.id), context.db);
    const originalObject = structuredClone(schoolApplicationModel.objects[1]!);
    const columns = ['motivation', 'nom', 'statut', 'filiere-id'];
    const draft = setApplicationObjectColumns(schoolApplicationModel, { objectKey: 'dossiers', columns });
    expect(schoolApplicationModel.objects[1]!.columns).toEqual(originalObject.columns);
    expect(draft.objects[1]!.columns).toEqual(columns);
    expect(applicationColumnKeys(draft.objects[1]!)).toEqual(columns);
    expect(draft.objects[1]!.fields).toEqual(originalObject.fields);
    expect(draft.objects[1]!.actions).toEqual(originalObject.actions);
    expect(draft.objects[0]).toEqual(schoolApplicationModel.objects[0]);
    expect(draft.roles).toEqual(schoolApplicationModel.roles);
    expect(buildApplicationRoutes(draft)).toHaveLength(11);
    expect(() => setApplicationObjectColumns(draft, { objectKey: 'dossiers', columns: ['nom', 'nom'] })).toThrow('une fois');
    expect(() => setApplicationObjectColumns(draft, { objectKey: 'dossiers', columns: ['inconnu'] })).toThrow('champ de cet objet');
    expect(() => setApplicationObjectColumns(draft, { objectKey: 'dossiers', columns: [] })).toThrow('1 et 12');
    expect(() => setApplicationObjectColumns(draft, { objectKey: 'dossiers', columns: Array.from({ length: 13 }, (_, index) => `colonne-${index}`) })).toThrow('1 et 12');
    expect(() => setApplicationObjectColumns(draft, { objectKey: 'inconnu', columns: ['nom'] })).toThrow('Objet du tableau introuvable');
    const duplicate = structuredClone(draft);
    duplicate.objects[1]!.columns = ['nom', 'nom'];
    expect(applicationModelSchema.safeParse(duplicate).success).toBe(false);

    expect((await saveApplicationModel(account.user.id, details.project.id, { model: draft, baseVersion: 1 }, context.db)).version).toBe(2);
    expect((await getApplicationModel(account.user.id, details.project.id, context.db)).model?.objects[1]?.columns).toEqual(columns);
    expect((await getApplicationRecord(account.user.id, details.project.id, 'dossiers', dossier.id, context.db)).data).toEqual(dossier.data);
    const updated = await updateApplicationRecord(account.user.id, details.project.id, 'dossiers', dossier.id, { ...dossierInput(filiere.id), email: 'adresse-masquee@example.com', telephone: '+229 99 88 77 66', motivation: 'Valeur conservée et modifiable.' }, context.db);
    expect(updated.data).toMatchObject({ email: 'adresse-masquee@example.com', telephone: '+229 99 88 77 66', motivation: 'Valeur conservée et modifiable.', statut: 'recu' });
    expect((await listApplicationRecords(account.user.id, details.project.id, 'dossiers', {}, context.db)).total).toBe(1);
  });

  it('ajoute une transition sans élargir les grants et l’exécute sur un dossier existant', async () => {
    const { account, details } = await setup('transition-application-model@example.com');
    const filiere = await createFiliere(account.user.id, details.project.id);
    const dossier = await createApplicationRecord(account.user.id, details.project.id, 'dossiers', dossierInput(filiere.id), context.db);
    expect((await executeApplicationAction(account.user.id, details.project.id, 'dossiers', dossier.id, 'refuser', context.db)).data.statut).toBe('refuse');
    const editor = await createAccount(context.db, 'editor-transition-application@example.com', 'Secrétariat');
    await addExistingMember(account.user.id, account.workspace.id, { email: editor.user.email, role: 'editor' }, context.db);
    const input = { objectKey: 'dossiers', label: 'Rouvrir', key: '', from: 'refuse', to: 'en-revue' };
    const originalObject = structuredClone(schoolApplicationModel.objects[1]!);
    const draft = addApplicationTransition(schoolApplicationModel, input);
    const target = draft.objects[1]!;
    expect(schoolApplicationModel.objects[1]!.actions).toHaveLength(3);
    expect(target.fields).toEqual(originalObject.fields);
    expect(target.actions.slice(0, 3)).toEqual(originalObject.actions);
    expect(target.actions.at(-1)).toEqual({ key: 'rouvrir', label: 'Rouvrir', from: ['refuse'], to: 'en-revue' });
    expect(draft.roles).toEqual(schoolApplicationModel.roles);
    expect(buildApplicationRoutes(draft)).toHaveLength(12);
    expect(buildApplicationRoutes(draft).find((route) => route.id === 'dossiers.actions.rouvrir')?.roles).toEqual(['owner', 'admin']);
    expect(roleCanAction(draft, 'owner', 'dossiers', 'rouvrir')).toBe(true);
    expect(roleCanAction(draft, 'editor', 'dossiers', 'rouvrir')).toBe(false);
    expect(addApplicationTransition(draft, input).objects[1]!.actions.at(-1)?.key).toBe('rouvrir-2');
    expect(() => addApplicationTransition(draft, { ...input, objectKey: 'filieres' })).toThrow('statut');
    expect(() => addApplicationTransition(draft, { ...input, to: 'refuse' })).toThrow('changer de statut');
    expect(() => addApplicationTransition(draft, { ...input, from: 'archive' })).toThrow('appartenir au processus');

    expect((await saveApplicationModel(account.user.id, details.project.id, { model: draft, baseVersion: 1 }, context.db)).version).toBe(2);
    await expect(executeApplicationAction(editor.user.id, details.project.id, 'dossiers', dossier.id, 'rouvrir', context.db)).rejects.toMatchObject({ status: 403, code: 'APPLICATION_PERMISSION_DENIED' });
    const reopened = await executeApplicationAction(account.user.id, details.project.id, 'dossiers', dossier.id, 'rouvrir', context.db);
    expect(reopened.data).toMatchObject({ nom: dossier.data.nom, 'filiere-id': filiere.id, statut: 'en-revue' });
    expect((await getApplicationRecord(account.user.id, details.project.id, 'dossiers', dossier.id, context.db)).data.statut).toBe('en-revue');
    await expect(executeApplicationAction(account.user.id, details.project.id, 'dossiers', dossier.id, 'rouvrir', context.db)).rejects.toMatchObject({ status: 409, code: 'APPLICATION_TRANSITION_INVALID' });
    expect((await executeApplicationAction(account.user.id, details.project.id, 'dossiers', dossier.id, 'accepter', context.db)).data.statut).toBe('accepte');
  });

  it('conserve les versions et refuse une évolution incompatible avec les données', async () => {
    const { account, details } = await setup('versions-application@example.com');
    const filiere = await createFiliere(account.user.id, details.project.id);
    await createApplicationRecord(account.user.id, details.project.id, 'dossiers', dossierInput(filiere.id), context.db);
    const secondModel: ApplicationModel = { ...structuredClone(schoolApplicationModel), description: 'Deuxième version du modèle.' };
    await expect(saveApplicationModel(account.user.id, details.project.id, { model: secondModel, baseVersion: 0 }, context.db)).rejects.toMatchObject({ status: 409, code: 'APPLICATION_MODEL_REVISION_CONFLICT' });
    expect((await saveApplicationModel(account.user.id, details.project.id, { model: secondModel, baseVersion: 1 }, context.db)).version).toBe(2);

    const incompatible = structuredClone(secondModel);
    incompatible.objects[0]!.fields = incompatible.objects[0]!.fields.filter((field) => field.key !== 'code');
    incompatible.objects[0]!.columns = ['nom', 'description'];
    await expect(saveApplicationModel(account.user.id, details.project.id, { model: incompatible, baseVersion: 2 }, context.db)).rejects.toMatchObject({ status: 409, code: 'APPLICATION_MODEL_INCOMPATIBLE' });

    const invalidRelationTarget = structuredClone(secondModel);
    invalidRelationTarget.objects[1]!.fields.find((field) => field.key === 'filiere-id')!.targetObject = 'dossiers';
    await expect(saveApplicationModel(account.user.id, details.project.id, { model: invalidRelationTarget, baseVersion: 2 }, context.db)).rejects.toMatchObject({ status: 409, code: 'APPLICATION_MODEL_INCOMPATIBLE' });

    const versions = await context.db.select().from(applicationModels).where(and(eq(applicationModels.projectId, details.project.id), eq(applicationModels.workspaceId, account.workspace.id))).orderBy(applicationModels.version);
    expect(versions.map((row) => row.version)).toEqual([1, 2]);
    expect(versions.filter((row) => row.current)).toHaveLength(1);
    expect(versions.find((row) => row.current)?.version).toBe(2);
  });

  it('protège les relations à la suppression puis autorise le nettoyage ordonné', async () => {
    const { account, details } = await setup('delete-application@example.com');
    const filiere = await createFiliere(account.user.id, details.project.id);
    const dossier = await createApplicationRecord(account.user.id, details.project.id, 'dossiers', dossierInput(filiere.id), context.db);
    await expect(deleteApplicationRecord(account.user.id, details.project.id, 'filieres', filiere.id, context.db)).rejects.toMatchObject({ status: 409, code: 'APPLICATION_RECORD_REFERENCED' });
    expect((await deleteApplicationRecord(account.user.id, details.project.id, 'dossiers', dossier.id, context.db)).deleted).toBe(true);
    expect((await deleteApplicationRecord(account.user.id, details.project.id, 'filieres', filiere.id, context.db)).deleted).toBe(true);
    expect((await listApplicationRecords(account.user.id, details.project.id, 'filieres', {}, context.db)).total).toBe(0);
  });
});
