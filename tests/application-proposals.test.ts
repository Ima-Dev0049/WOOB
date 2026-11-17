import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseContext } from '@/server/db';
import { createAccount, testDatabase } from './helpers/database';
import { createProject } from '@/server/services/projects';
import { addExistingMember } from '@/server/services/members';
import { getApplicationModel, previewApplicationProposal, saveApplicationModel } from '@/server/services/application';
import { ApplicationProposalError, proposeApplicationModelChange } from '@/lib/application/proposal';
import { schoolApplicationModel } from '@/lib/application/school-model';

let context: DatabaseContext;
beforeAll(async () => { context = await testDatabase(); }, 60_000);
afterAll(async () => { await context.close(); });

async function setup(email: string) {
  const account = await createAccount(context.db, email, email.split('@')[0]!);
  const details = await createProject(account.user.id, account.workspace.id, { name: `Propositions ${email}`, description: '', templateId: 'studio-business' }, context.db);
  const saved = await saveApplicationModel(account.user.id, details.project.id, { model: schoolApplicationModel, baseVersion: null }, context.db);
  return { account, projectId: details.project.id, version: saved.version };
}

describe('propositions de modèle', () => {
  it('construit un champ prévisualisable sans muter le modèle actif', () => {
    const before = structuredClone(schoolApplicationModel);
    const proposal = proposeApplicationModelChange(schoolApplicationModel, { kind: 'suivi-date', objectKey: 'dossiers' });
    expect(schoolApplicationModel).toEqual(before);
    const dossier = proposal.model.objects.find((object) => object.key === 'dossiers')!;
    const field = dossier.fields.find((candidate) => candidate.key === proposal.createdKey)!;
    expect(field).toMatchObject({ label: 'Date de suivi', type: 'date', required: false });
    expect(dossier.columns).toContain(proposal.createdKey);
    expect(proposal.changes.map((change) => change.label)).toContain('Colonne ajoutée');
    // Everything else is preserved, including records-facing fields and role grants.
    expect(proposal.model.objects.filter((object) => object.key !== 'dossiers')).toEqual(before.objects.filter((object) => object.key !== 'dossiers'));
    expect(proposal.model.roles).toEqual(before.roles);

    const montant = proposeApplicationModelChange(schoolApplicationModel, { kind: 'montant', objectKey: 'dossiers' });
    const montantField = montant.model.objects.find((object) => object.key === 'dossiers')!.fields.find((candidate) => candidate.key === montant.createdKey)!;
    expect(montantField).toMatchObject({ type: 'number', min: 0 });
  });

  it('propose une transition entre deux statuts et refuse les doublons ou les cibles invalides', () => {
    const proposal = proposeApplicationModelChange(schoolApplicationModel, { kind: 'validation', objectKey: 'dossiers', label: 'Valider le dossier', from: 'en-revue', to: 'accepte' });
    const dossier = proposal.model.objects.find((object) => object.key === 'dossiers')!;
    const action = dossier.actions.find((candidate) => candidate.key === proposal.createdKey)!;
    expect(action).toMatchObject({ label: 'Valider le dossier', from: ['en-revue'], to: 'accepte' });
    expect(proposal.summary).toContain('En revue');
    expect(() => proposeApplicationModelChange(schoolApplicationModel, { kind: 'validation', objectKey: 'dossiers', from: 'accepte', to: 'accepte' }))
      .toThrow(ApplicationProposalError);
    expect(() => proposeApplicationModelChange(schoolApplicationModel, { kind: 'suivi-date', objectKey: 'inconnu' }))
      .toThrow(/n’existe pas/);
    expect(() => proposeApplicationModelChange(schoolApplicationModel, { kind: 'tel', objectKey: 'dossiers', label: 'Email' }))
      .toThrow(/existe déjà/);
    const duplicated = proposeApplicationModelChange(schoolApplicationModel, { kind: 'validation', objectKey: 'dossiers', label: 'Valider le dossier', from: 'en-revue', to: 'accepte' });
    expect(() => proposeApplicationModelChange(duplicated.model, { kind: 'validation', objectKey: 'dossiers', label: 'Valider le dossier', from: 'en-revue', to: 'accepte' }))
      .toThrow(/existe déjà/);
  });

  it('réserve la proposition aux rôles autorisés et persiste seulement après validation', async () => {
    const { account, projectId, version } = await setup('proposals@example.com');
    const proposal = await previewApplicationProposal(account.user.id, projectId, { kind: 'suivi-date', objectKey: 'dossiers' }, context.db);
    expect(proposal.model.objects.find((object) => object.key === 'dossiers')!.fields.some((field) => field.key === proposal.createdKey)).toBe(true);
    // Previewing writes nothing: the stored model still has the original version and fields.
    const unchanged = await getApplicationModel(account.user.id, projectId, context.db);
    expect(unchanged.version).toBe(version);
    expect(unchanged.model!.objects.find((object) => object.key === 'dossiers')!.fields.some((field) => field.key === proposal.createdKey)).toBe(false);

    const saved = await saveApplicationModel(account.user.id, projectId, { model: proposal.model, baseVersion: version }, context.db);
    expect(saved.version).toBe(version + 1);
    const reloaded = await getApplicationModel(account.user.id, projectId, context.db);
    expect(reloaded.model!.objects.find((object) => object.key === 'dossiers')!.fields.some((field) => field.key === proposal.createdKey)).toBe(true);

    const viewer = await createAccount(context.db, 'proposals-viewer@example.com', 'Viewer');
    await addExistingMember(account.user.id, account.workspace.id, { email: 'proposals-viewer@example.com', role: 'viewer' }, context.db);
    await expect(previewApplicationProposal(viewer.user.id, projectId, { kind: 'suivi-date', objectKey: 'dossiers' }, context.db)).rejects.toMatchObject({ status: 403 });

    const outsider = await createAccount(context.db, 'proposals-outsider@example.com', 'Outsider');
    await expect(previewApplicationProposal(outsider.user.id, projectId, { kind: 'suivi-date', objectKey: 'dossiers' }, context.db)).rejects.toMatchObject({ status: 404 });

    await expect(previewApplicationProposal(account.user.id, projectId, { kind: 'suivi-date', objectKey: 'dossiers' }, context.db))
      .rejects.toMatchObject({ status: 409, code: 'PROPOSAL_ALREADY_APPLIED' });
  });
});
