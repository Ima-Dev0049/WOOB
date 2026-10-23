import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseContext } from '@/server/db';
import { testDatabase, createAccount } from './helpers/database';
import { createPage, createPageCheckpoint, createProject, getProjectDetails, listPageVersions, restorePageVersion, savePageDocument } from '@/server/services/projects';
import { getPublishedSite, listPublications, publishProject, rollbackPublication, unpublishProject } from '@/server/services/publishing';
import { cloneDocument, findNode } from '@/lib/document/validation';
import { makeNode } from '@/lib/document/factory';
import { getDesignSystem, withDesignSystem } from '@/lib/document/design-system';

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

  it('propage le thème global à toutes les pages sans effacer leurs exceptions locales', async () => {
    const account = await createAccount(context.db, 'theme-global@example.com', 'Theme Global');
    const details = await createProject(account.user.id, account.workspace.id, { name: 'Thème partagé', description: '', templateId: 'studio-business' }, context.db);
    const second = (await createPage(account.user.id, details.project.id, { name: 'Secondaire', path: '/secondaire' }, context.db))!;
    const secondDocument = cloneDocument(second.draftDocument);
    const localHeading = makeNode('heading', { text: 'Exception conservée', level: 2 });
    localHeading.styles = { color: '#AA1122', fontSize: '31px' };
    localHeading.responsive = { mobile: { fontSize: '24px' } };
    secondDocument.root.children!.push(localHeading);
    await savePageDocument(account.user.id, second.id, { baseRevision: 0, document: secondDocument }, context.db);
    const oldThemeCheckpoint = (await createPageCheckpoint(account.user.id, second.id, 'manual', context.db))!;

    const first = details.pages[0]!;
    const firstDocument = cloneDocument(first.draftDocument);
    const design = getDesignSystem(firstDocument.theme);
    design.tokens.colors.primary = '#135724';
    design.tokens.colors.link = '#135724';
    design.styles.push({ id: 'shared-heading', name: 'Titre partagé', componentType: 'heading', styles: { fontWeight: 800, letterSpacing: '-0.03em' } });
    firstDocument.theme = withDesignSystem(firstDocument.theme, design);
    const themedHeading = makeNode('heading', { text: 'Titre avec préset', level: 2 });
    themedHeading.styleId = 'shared-heading';
    themedHeading.styles = { color: '#101010' };
    firstDocument.root.children!.push(themedHeading);
    await savePageDocument(account.user.id, first.id, { baseRevision: 0, document: firstDocument }, context.db);

    const reloaded = await getProjectDetails(account.user.id, details.project.id, context.db);
    const reloadedSecond = reloaded.pages.find((page) => page.id === second.id)!;
    expect(reloaded.project.theme.primaryColor).toBe('#135724');
    expect(reloadedSecond.draftDocument.theme.primaryColor).toBe('#135724');
    expect(reloadedSecond.draftRevision).toBe(2);
    expect(reloadedSecond.draftDocument.revision).toBe(2);
    expect(findNode(reloadedSecond.draftDocument.root, localHeading.id)?.styles).toEqual({ color: '#AA1122', fontSize: '31px' });
    expect(findNode(reloadedSecond.draftDocument.root, localHeading.id)?.responsive).toEqual({ mobile: { fontSize: '24px' } });
    expect(reloadedSecond.draftDocument.root.children).toHaveLength(1);
    await expect(savePageDocument(account.user.id, second.id, { baseRevision: 1, document: cloneDocument(reloadedSecond.draftDocument) }, context.db)).rejects.toMatchObject({ status: 409 });
    const restored = await restorePageVersion(account.user.id, second.id, oldThemeCheckpoint.id, { baseRevision: 2 }, context.db);
    expect(restored.page.draftDocument.theme.primaryColor).toBe('#135724');
    expect(findNode(restored.page.draftDocument.root, localHeading.id)?.styles).toEqual({ color: '#AA1122', fontSize: '31px' });

    await publishProject(account.user.id, details.project.id, context.db);
    const published = (await getPublishedSite(details.project.slug, context.db))!;
    expect(published.theme.primaryColor).toBe('#135724');
    expect(published.pages.find((page) => page.id === second.id)?.document.theme.designSystem?.tokens.colors.primary).toBe('#135724');
    expect(findNode(published.pages.find((page) => page.id === first.id)!.document.root, themedHeading.id)?.styleId).toBe('shared-heading');
    expect(published.pages.find((page) => page.id === first.id)?.document.theme.designSystem?.styles[0]).toMatchObject({ id: 'shared-heading', name: 'Titre partagé' });
  });
});
