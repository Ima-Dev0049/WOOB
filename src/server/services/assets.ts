import { createHash } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@/lib/id';
import { getDb, type Db } from '@/server/db';
import { assets, pages, projects, publications } from '@/server/db/schema';
import { ApiError } from '@/server/http';
import { requireProject } from '@/server/auth/tenancy';
import { assertStorageQuota } from './quotas';
import { deleteObject, getObject, putObject } from '@/server/storage';

const types: Record<string, { extension: string; detect: (data: Buffer) => boolean }> = {
  'image/png': { extension: 'png', detect: (data) => data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/jpeg': { extension: 'jpg', detect: (data) => data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  'image/gif': { extension: 'gif', detect: (data) => data.length > 6 && ['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString('ascii')) },
  'image/webp': { extension: 'webp', detect: (data) => data.length > 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP' },
};
function cleanFileName(name: string): string { const cleaned = name.normalize('NFKC').replace(/[\u0000-\u001f/\\]/g, '').trim().slice(0, 180); return cleaned || 'image'; }

export async function listAssets(userId: string, projectId: string, db?: Db) {
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'read', database);
  return database.select().from(assets).where(and(eq(assets.workspaceId, project.workspaceId), eq(assets.projectId, project.id), isNull(assets.deletedAt))).orderBy(desc(assets.createdAt));
}

export async function uploadAsset(userId: string, projectId: string, file: File, altInput: unknown, db?: Db) {
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'edit', database);
  const alt = z.string().max(300).parse(typeof altInput === 'string' ? altInput : '');
  const maxBytes = Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024);
  if (!file.size || file.size > maxBytes) throw new ApiError(413, 'UPLOAD_SIZE_INVALID', `L’image doit faire entre 1 octet et ${Math.floor(maxBytes / 1048576)} Mo.`);
  const definition = types[file.type];
  if (!definition) throw new ApiError(415, 'UPLOAD_TYPE_INVALID', 'Formats acceptés : PNG, JPEG, WebP et GIF. Le SVG est refusé.');
  const data = Buffer.from(await file.arrayBuffer());
  if (!definition.detect(data)) throw new ApiError(415, 'UPLOAD_CONTENT_MISMATCH', 'Le contenu du fichier ne correspond pas à son format déclaré.');
  await assertStorageQuota(project.workspaceId, data.byteLength, database);
  const id = createId('asset');
  const storageKey = `${project.workspaceId}/${project.id}/${id}.${definition.extension}`;
  await putObject(storageKey, data, file.type);
  try {
    return (await database.insert(assets).values({ id, workspaceId: project.workspaceId, projectId: project.id, fileName: cleanFileName(file.name), storageKey, mimeType: file.type, byteSize: data.byteLength, alt, checksum: createHash('sha256').update(data).digest('hex'), createdBy: userId }).returning())[0];
  } catch (error) { await deleteObject(storageKey).catch(() => undefined); throw error; }
}

export async function readAssetForUser(assetId: string, userId: string | null, db?: Db) {
  const database = db ?? await getDb();
  const asset = (await database.select().from(assets).where(and(eq(assets.id, assetId), isNull(assets.deletedAt))).limit(1))[0];
  if (!asset) throw new ApiError(404, 'ASSET_NOT_FOUND', 'Média introuvable.');
  if (asset.visibility === 'public') {
    if (!asset.projectId) throw new ApiError(404, 'ASSET_NOT_FOUND', 'Média introuvable.');
    const project = (await database.select({ id: projects.id }).from(projects).where(and(eq(projects.id, asset.projectId), eq(projects.workspaceId, asset.workspaceId), isNull(projects.deletedAt))).limit(1))[0];
    if (!project?.id) throw new ApiError(404, 'ASSET_NOT_FOUND', 'Média introuvable.');
  } else {
    if (!userId || !asset.projectId) throw new ApiError(404, 'ASSET_NOT_FOUND', 'Média introuvable.');
    await requireProject(userId, asset.projectId, 'read', database);
  }
  const data = await getObject(asset.storageKey);
  return { asset, data };
}

export async function deleteAsset(userId: string, assetId: string, db?: Db) {
  const database = db ?? await getDb();
  const asset = (await database.select().from(assets).where(and(eq(assets.id, assetId), isNull(assets.deletedAt))).limit(1))[0];
  if (!asset?.projectId) throw new ApiError(404, 'ASSET_NOT_FOUND', 'Média introuvable.');
  await requireProject(userId, asset.projectId, 'edit', database);
  const [drafts, snapshots] = await Promise.all([
    database.select({ document: pages.draftDocument }).from(pages).where(and(eq(pages.projectId, asset.projectId), eq(pages.workspaceId, asset.workspaceId))),
    database.select({ snapshot: publications.snapshot }).from(publications).where(and(eq(publications.projectId, asset.projectId), eq(publications.workspaceId, asset.workspaceId))),
  ]);
  if (drafts.some((page) => JSON.stringify(page.document).includes(assetId)) || snapshots.some((publication) => JSON.stringify(publication.snapshot).includes(assetId))) {
    throw new ApiError(409, 'ASSET_IN_USE', 'Ce média est utilisé par un brouillon ou une publication.');
  }
  await database.update(assets).set({ deletedAt: new Date() }).where(and(eq(assets.id, assetId), eq(assets.workspaceId, asset.workspaceId)));
  await deleteObject(asset.storageKey);
}
