import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { DatabaseContext } from '@/server/db';
import { testDatabase, createAccount } from './helpers/database';
import { createProject, savePageDocument } from '@/server/services/projects';
import { deleteAsset, listAssets, readAssetForUser, uploadAsset } from '@/server/services/assets';
import { makeNode } from '@/lib/document/factory';

let context: DatabaseContext;
let storageDir: string;
const previous = { driver: process.env.STORAGE_DRIVER, dir: process.env.STORAGE_LOCAL_DIR, env: process.env.APP_ENV };
beforeAll(async () => {
  context = await testDatabase();
  storageDir = await mkdtemp(path.join(tmpdir(), 'woob-assets-'));
  process.env.STORAGE_DRIVER = 'file'; process.env.STORAGE_LOCAL_DIR = storageDir; process.env.APP_ENV = 'test';
}, 60_000);
afterAll(async () => {
  await context.close(); await rm(storageDir, { recursive: true, force: true });
  if (previous.driver === undefined) delete process.env.STORAGE_DRIVER; else process.env.STORAGE_DRIVER = previous.driver;
  if (previous.dir === undefined) delete process.env.STORAGE_LOCAL_DIR; else process.env.STORAGE_LOCAL_DIR = previous.dir;
  if (previous.env === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = previous.env;
});

function file(data: Buffer, name: string, type: string): File {
  const bytes = Uint8Array.from(data);
  return new File([bytes.buffer as ArrayBuffer], name, { type });
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

describe('médias et stockage local', () => {
  it('vérifie le contenu, isole la lecture et protège les médias utilisés', async () => {
    const account = await createAccount(context.db, 'assets@example.com', 'Assets');
    const outsider = await createAccount(context.db, 'assets-outside@example.com', 'Outside');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Médias', description: '', templateId: 'studio-business' }, context.db);
    const asset = (await uploadAsset(account.user.id, details.project.id, file(png, '../pixel.png', 'image/png'), 'Un pixel de test', context.db))!;
    expect(asset.fileName).toBe('..pixel.png');
    expect(asset.byteSize).toBe(png.length);
    expect(await listAssets(account.user.id, details.project.id, context.db)).toHaveLength(1);
    expect((await readAssetForUser(asset.id, account.user.id, context.db)).data.equals(png)).toBe(true);
    await expect(readAssetForUser(asset.id, outsider.user.id, context.db)).rejects.toMatchObject({ status: 404 });
    await expect(readAssetForUser(asset.id, null, context.db)).rejects.toMatchObject({ status: 404 });
    await expect(uploadAsset(account.user.id, details.project.id, file(Buffer.from('<script>alert(1)</script>'), 'fake.png', 'image/png'), '', context.db)).rejects.toMatchObject({ status: 415, code: 'UPLOAD_CONTENT_MISMATCH' });
    await expect(uploadAsset(account.user.id, details.project.id, file(Buffer.from('<svg/>'), 'image.svg', 'image/svg+xml'), '', context.db)).rejects.toMatchObject({ status: 415 });
    const page = details.pages[0]!;
    page.draftDocument.root.children!.push(makeNode('image', { assetId: asset.id, src: '', alt: 'Pixel', caption: '' }));
    await savePageDocument(account.user.id, page.id, { baseRevision: 0, document: page.draftDocument }, context.db);
    await expect(deleteAsset(account.user.id, asset.id, context.db)).rejects.toMatchObject({ status: 409, code: 'ASSET_IN_USE' });
  });
});
