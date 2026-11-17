import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { DatabaseContext } from '@/server/db';
import { createAccount, testDatabase } from './helpers/database';
import { createProject } from '@/server/services/projects';
import { listAssets, uploadAsset } from '@/server/services/assets';
import { addExistingMember } from '@/server/services/members';
import {
  APPLICATION_ATTACHMENT_LIMIT,
  attachApplicationAsset,
  createApplicationRecord,
  detachApplicationAttachment,
  listApplicationAttachments,
  saveApplicationModel,
} from '@/server/services/application';
import { schoolApplicationModel } from '@/lib/application/school-model';

let context: DatabaseContext;
let storageDir: string;
const previous = { driver: process.env.STORAGE_DRIVER, dir: process.env.STORAGE_LOCAL_DIR, env: process.env.APP_ENV };
beforeAll(async () => {
  context = await testDatabase();
  storageDir = await mkdtemp(path.join(tmpdir(), 'woob-attachments-'));
  process.env.STORAGE_DRIVER = 'file'; process.env.STORAGE_LOCAL_DIR = storageDir; process.env.APP_ENV = 'test';
}, 60_000);
afterAll(async () => {
  await context.close(); await rm(storageDir, { recursive: true, force: true });
  if (previous.driver === undefined) delete process.env.STORAGE_DRIVER; else process.env.STORAGE_DRIVER = previous.driver;
  if (previous.dir === undefined) delete process.env.STORAGE_LOCAL_DIR; else process.env.STORAGE_LOCAL_DIR = previous.dir;
  if (previous.env === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = previous.env;
});

function file(data: Buffer, name: string, type: string): File {
  return new File([Uint8Array.from(data).buffer as ArrayBuffer], name, { type });
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');

async function setup(email: string) {
  const account = await createAccount(context.db, email, email.split('@')[0]!);
  const details = await createProject(account.user.id, account.workspace.id, { name: `Pièces ${email}`, description: '', templateId: 'studio-business' }, context.db);
  await saveApplicationModel(account.user.id, details.project.id, { model: schoolApplicationModel, baseVersion: null }, context.db);
  const filiere = await createApplicationRecord(account.user.id, details.project.id, 'filieres', { nom: 'Informatique', code: 'INFO', description: 'Formation.' }, context.db);
  const dossier = await createApplicationRecord(account.user.id, details.project.id, 'dossiers', {
    nom: 'Étudiant Test', email: `dossier-${email}`, telephone: '+229 01 02 03 04', 'filiere-id': filiere.id, motivation: 'Poursuivre mes études.',
  }, context.db);
  return { account, projectId: details.project.id, dossierId: dossier.id };
}

describe('pièces jointes des dossiers', () => {
  it('joint un PDF ou une image, les liste et détache sans supprimer l’asset', async () => {
    const { account, projectId, dossierId } = await setup('attachments@example.com');
    const picture = (await uploadAsset(account.user.id, projectId, file(png, 'plan.png', 'image/png'), '', context.db))!;
    const document = (await uploadAsset(account.user.id, projectId, file(pdf, 'devis.pdf', 'application/pdf'), '', context.db))!;
    expect(document.mimeType).toBe('application/pdf');

    const first = await attachApplicationAsset(account.user.id, projectId, 'dossiers', dossierId, { assetId: picture.id, label: 'Photo du dossier' }, context.db);
    expect(first.label).toBe('Photo du dossier');
    expect(first.fileName).toBe('plan.png');
    await attachApplicationAsset(account.user.id, projectId, 'dossiers', dossierId, { assetId: document.id }, context.db);

    const listed = await listApplicationAttachments(account.user.id, projectId, 'dossiers', dossierId, context.db);
    expect(listed).toHaveLength(2);
    expect(listed.map((item) => item.fileName).sort()).toEqual(['devis.pdf', 'plan.png']);
    expect(listed.find((item) => item.fileName === 'devis.pdf')?.label).toBe('devis.pdf');

    await detachApplicationAttachment(account.user.id, projectId, 'dossiers', dossierId, first.id, context.db);
    expect(await listApplicationAttachments(account.user.id, projectId, 'dossiers', dossierId, context.db)).toHaveLength(1);
    await expect(detachApplicationAttachment(account.user.id, projectId, 'dossiers', dossierId, first.id, context.db))
      .rejects.toMatchObject({ status: 404, code: 'ATTACHMENT_NOT_FOUND' });
    // The upload stays in the project library after the link is removed.
    expect((await listAssets(account.user.id, projectId, context.db)).some((asset) => asset.id === first.assetId)).toBe(true);
  });

  it('refuse un doublon, un fichier d’un autre projet, un rôle en lecture et le dépassement de limite', async () => {
    const { account, projectId, dossierId } = await setup('attachments-limits@example.com');
    const other = await setup('attachments-other@example.com');
    const share = (await uploadAsset(account.user.id, projectId, file(png, 'share.png', 'image/png'), '', context.db))!;
    const foreign = (await uploadAsset(other.account.user.id, other.projectId, file(png, 'foreign.png', 'image/png'), '', context.db))!;

    await attachApplicationAsset(account.user.id, projectId, 'dossiers', dossierId, { assetId: share.id }, context.db);
    await expect(attachApplicationAsset(account.user.id, projectId, 'dossiers', dossierId, { assetId: share.id }, context.db))
      .rejects.toMatchObject({ status: 409, code: 'ATTACHMENT_DUPLICATE' });
    await expect(attachApplicationAsset(account.user.id, projectId, 'dossiers', dossierId, { assetId: foreign.id }, context.db))
      .rejects.toMatchObject({ status: 422, code: 'ATTACHMENT_ASSET_INVALID' });

    const outsider = await createAccount(context.db, 'attachments-outsider@example.com', 'Outsider');
    await expect(listApplicationAttachments(outsider.user.id, projectId, 'dossiers', dossierId, context.db)).rejects.toMatchObject({ status: 404 });

    const viewer = await createAccount(context.db, 'attachments-viewer@example.com', 'Viewer');
    await addExistingMember(account.user.id, account.workspace.id, { email: 'attachments-viewer@example.com', role: 'viewer' }, context.db);
    await expect(attachApplicationAsset(viewer.user.id, projectId, 'dossiers', dossierId, { assetId: share.id }, context.db)).rejects.toMatchObject({ status: 403 });

    for (let index = 1; index < APPLICATION_ATTACHMENT_LIMIT; index += 1) {
      const extra = (await uploadAsset(account.user.id, projectId, file(png, `extra-${index}.png`, 'image/png'), '', context.db))!;
      await attachApplicationAsset(account.user.id, projectId, 'dossiers', dossierId, { assetId: extra.id }, context.db);
    }
    expect(await listApplicationAttachments(account.user.id, projectId, 'dossiers', dossierId, context.db)).toHaveLength(APPLICATION_ATTACHMENT_LIMIT);
    const overflow = (await uploadAsset(account.user.id, projectId, file(png, 'overflow.png', 'image/png'), '', context.db))!;
    await expect(attachApplicationAsset(account.user.id, projectId, 'dossiers', dossierId, { assetId: overflow.id }, context.db))
      .rejects.toMatchObject({ status: 409, code: 'ATTACHMENT_LIMIT_REACHED' });
  });
});
