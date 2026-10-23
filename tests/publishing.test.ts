import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseContext } from '@/server/db';
import { testDatabase, createAccount } from './helpers/database';
import { createPageCheckpoint, createProject, listPageVersions, restorePageVersion, savePageDocument } from '@/server/services/projects';
import { getPublishedSite, listPublications, publishProject, rollbackPublication, unpublishProject } from '@/server/services/publishing';
import { cloneDocument, findNode } from '@/lib/document/validation';
import { makeNode } from '@/lib/document/factory';

let context: DatabaseContext;
beforeAll(async () => { context = await testDatabase(); }, 60_000);
afterAll(async () => { await context.close(); });

describe('snapshots de publication', () => {
  it('sépare brouillon et version publique, dépublie puis restaure un ancien snapshot', async () => {
    const account = await createAccount(context.db, 'publish@example.com', 'Publisher');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Site public', description: '', templateId: 'studio-business' }, context.db);
    expect(details.pages[0]).toMatchObject({ path: '/', kind: 'home' });
    const page = details.pages[0]!;
    const firstDocument = cloneDocument(page.draftDocument);
    const heading = makeNode('heading', { text: 'Version publique une', level: 2 });
    firstDocument.root.children!.push(heading);
    await savePageDocument(account.user.id, page.id, { baseRevision: 0, document: firstDocument }, context.db);
    const first = await publishProject(account.user.id, details.project.id, context.db);
    expect(first.url).toBe(`/s/${details.project.slug}`);
    const publishedText = async () => {
      const site = (await getPublishedSite(details.project.slug, context.db))!;
      return findNode(site.pages.find((item) => item.id === page.id)!.document.root, heading.id)?.props.text;
    };
    expect(await publishedText()).toBe('Version publique une');
    const secondDocument = cloneDocument(firstDocument);
    secondDocument.revision = 1;
    findNode(secondDocument.root, heading.id)!.props.text = 'Brouillon deux non public';
    await savePageDocument(account.user.id, page.id, { baseRevision: 1, document: secondDocument }, context.db);
    expect(await publishedText()).toBe('Version publique une');
    await publishProject(account.user.id, details.project.id, context.db);
    expect(await publishedText()).toBe('Brouillon deux non public');
    await unpublishProject(account.user.id, details.project.id, context.db);
    expect(await getPublishedSite(details.project.slug, context.db)).toBeNull();
    const history = await listPublications(account.user.id, details.project.id, context.db);
    expect(history).toHaveLength(2);
    await rollbackPublication(account.user.id, details.project.id, first.publication.id, context.db);
    expect(await publishedText()).toBe('Version publique une');
    expect(await listPublications(account.user.id, details.project.id, context.db)).toHaveLength(3);
  });

  it('restaure un point de brouillon dans une nouvelle révision sans effacer son historique', async () => {
    const account = await createAccount(context.db, 'versions@example.com', 'Versions');
    const other = await createAccount(context.db, 'versions-outside@example.com', 'Outside');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Versions du brouillon', description: '', templateId: 'studio-business' }, context.db);
    const page = details.pages[0]!;
    const hero = page.draftDocument.root.children!.find((node) => node.type === 'hero')!;
    const first = cloneDocument(page.draftDocument);
    findNode(first.root, hero.id)!.props.title = 'Version un restaurable';
    await savePageDocument(account.user.id, page.id, { baseRevision: 0, document: first }, context.db);
    const checkpoint = await createPageCheckpoint(account.user.id, page.id, 'manual', context.db);
    const second = cloneDocument(first);
    findNode(second.root, hero.id)!.props.title = 'Version deux';
    await savePageDocument(account.user.id, page.id, { baseRevision: 1, document: second }, context.db);
    const restored = await restorePageVersion(account.user.id, page.id, checkpoint!.id, { baseRevision: 2 }, context.db);
    expect(restored.restoredFrom).toBe(1);
    expect(restored.page.draftRevision).toBe(3);
    expect(findNode(restored.page.draftDocument.root, hero.id)?.props.title).toBe('Version un restaurable');
    expect(restored.page.draftDocument.metadata.path).toBe(page.path);
    const versions = await listPageVersions(account.user.id, page.id, context.db);
    expect(versions.map((version) => version.kind)).toEqual(['restore', 'manual']);
    await expect(restorePageVersion(account.user.id, page.id, checkpoint!.id, { baseRevision: 2 }, context.db)).rejects.toMatchObject({ status: 409 });
    await expect(restorePageVersion(other.user.id, page.id, checkpoint!.id, { baseRevision: 3 }, context.db)).rejects.toMatchObject({ status: 404 });
  });
});
