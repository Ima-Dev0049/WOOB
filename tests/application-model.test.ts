import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DatabaseContext } from '@/server/db';
import { applicationModels, applicationRecords } from '@/server/db/schema';
import { createAccount, testDatabase } from './helpers/database';
import { createProject } from '@/server/services/projects';
import { addExistingMember } from '@/server/services/members';
import { applicationModelSchema, applicationRecordSchema, buildApplicationRoutes, type ApplicationModel } from '@/lib/application/model';
import { schoolApplicationModel } from '@/lib/application/school-model';
import {
  createApplicationRecord,
  deleteApplicationRecord,
  executeApplicationAction,
  getApplicationRecord,
  listApplicationRecords,
  saveApplicationModel,
  updateApplicationRecord,
} from '@/server/services/application';

let context: DatabaseContext;
beforeAll(async () => { context = await testDatabase(); }, 60_000);
afterAll(async () => { await context.close(); });

async function setup(email: string) {
  const account = await createAccount(context.db, email, email.split('@')[0]!);
  const details = await createProject(account.user.id, account.workspace.id, { name: `Application ${email}`, description: '', templateId: 'studio-business' }, context.db);
  const model = await saveApplicationModel(account.user.id, details.project.id, { model: schoolApplicationModel, baseVersion: null }, context.db);
  return { account, details, model };
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
