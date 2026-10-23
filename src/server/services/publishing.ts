import { and, desc, eq, inArray, isNull, max } from 'drizzle-orm';
import { createId } from '@/lib/id';
import { cloneDocument, collectAssetIds, validateSiteSnapshot } from '@/lib/document/validation';
import type { SiteSnapshot } from '@/lib/document/types';
import { getDb, type Db } from '@/server/db';
import { assets, pageVersions, pages, posts, products, projectModules, projects, publications, workspaces } from '@/server/db/schema';
import type { Project } from '@/server/db/schema';
import { ApiError } from '@/server/http';
import { requireProject } from '@/server/auth/tenancy';

function usedAssetIds(snapshot: SiteSnapshot): string[] {
  const ids = new Set<string>();
  for (const page of snapshot.pages) for (const id of collectAssetIds(page.document)) ids.add(id);
  for (const product of snapshot.products) if (product.imageAssetId) ids.add(product.imageAssetId);
  return [...ids];
}

export async function buildProjectSnapshot(project: Project, publicationId: string, db: Db): Promise<SiteSnapshot> {
  const [projectPages, modules, catalog, journal] = await Promise.all([
    db.select().from(pages).where(and(eq(pages.projectId, project.id), eq(pages.workspaceId, project.workspaceId))),
    db.select().from(projectModules).where(and(eq(projectModules.projectId, project.id), eq(projectModules.workspaceId, project.workspaceId), eq(projectModules.enabled, true))),
    db.select().from(products).where(and(eq(products.projectId, project.id), eq(products.workspaceId, project.workspaceId), eq(products.active, true))),
    db.select().from(posts).where(and(eq(posts.projectId, project.id), eq(posts.workspaceId, project.workspaceId), eq(posts.status, 'published'))),
  ]);
  const snapshot: SiteSnapshot = {
    projectId: project.id,
    publicationId,
    publishedAt: new Date().toISOString(),
    name: project.name,
    description: project.description,
    slug: project.slug,
    defaultLocale: project.defaultLocale,
    theme: cloneDocument(project.theme),
    ...(project.creativeBrief ? { creativeBrief: cloneDocument(project.creativeBrief) } : {}),
    pages: projectPages.map((page) => ({ id: page.id, path: page.path, name: page.name, seoTitle: page.seoTitle, seoDescription: page.seoDescription, document: cloneDocument(page.draftDocument) })),
    navigation: projectPages.map((page) => ({ label: page.path === '/' ? 'Accueil' : page.name, path: page.path })),
    modules: modules.map((module) => module.key),
    products: catalog.map((product) => ({ id: product.id, name: product.name, slug: product.slug, description: product.description, priceCents: product.priceCents, currency: product.currency, inventory: product.inventory, imageAssetId: product.imageAssetId })),
    posts: journal.map((post) => ({ id: post.id, title: post.title, slug: post.slug, excerpt: post.excerpt, content: post.content, publishedAt: post.publishedAt?.toISOString() || post.createdAt.toISOString() })),
  };
  const issues = validateSiteSnapshot(snapshot);
  if (issues.length) throw new ApiError(422, 'PUBLICATION_INVALID', 'Le site ne peut pas être publié.', issues);
  return snapshot;
}

async function persistPublication(project: Project, userId: string, snapshot: SiteSnapshot, db: Db) {
  return db.transaction(async (tx) => {
    await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, project.id)).for('update');
    const numberResult = await tx.select({ value: max(publications.number) }).from(publications).where(eq(publications.projectId, project.id));
    const number = (numberResult[0]?.value || 0) + 1;
    await tx.update(publications).set({ state: 'superseded', activatedAt: null }).where(and(eq(publications.projectId, project.id), eq(publications.state, 'active')));
    const publication = (await tx.insert(publications).values({ id: snapshot.publicationId, workspaceId: project.workspaceId, projectId: project.id, number, state: 'active', snapshot, sourceRevision: project.draftRevision, createdBy: userId, activatedAt: new Date() }).returning())[0];
    if (!publication) throw new Error('La publication n’a pas pu être créée.');
    await tx.update(projects).set({ activePublicationId: publication.id, status: 'published', updatedAt: new Date() }).where(and(eq(projects.id, project.id), eq(projects.workspaceId, project.workspaceId)));
    for (const page of snapshot.pages) {
      const current = (await tx.select().from(pages).where(and(eq(pages.id, page.id), eq(pages.projectId, project.id))).limit(1))[0];
      if (!current) throw new ApiError(409, 'PUBLICATION_PAGE_MISSING', 'Une page a été supprimée pendant la publication.');
      const versionResult = await tx.select({ value: max(pageVersions.versionNumber) }).from(pageVersions).where(eq(pageVersions.pageId, page.id));
      await tx.insert(pageVersions).values({ id: createId('version'), workspaceId: project.workspaceId, projectId: project.id, pageId: page.id, versionNumber: (versionResult[0]?.value || 0) + 1, kind: 'published', document: cloneDocument(current.draftDocument), sourceRevision: current.draftRevision, createdBy: userId });
    }
    const assetIds = usedAssetIds(snapshot);
    await tx.update(assets).set({ visibility: 'private' }).where(and(eq(assets.workspaceId, project.workspaceId), eq(assets.projectId, project.id)));
    if (assetIds.length) await tx.update(assets).set({ visibility: 'public' }).where(and(eq(assets.workspaceId, project.workspaceId), eq(assets.projectId, project.id), inArray(assets.id, assetIds)));
    return publication;
  });
}

export async function publishProject(userId: string, projectId: string, db?: Db) {
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'publish', database);
  const publicationId = createId('publication');
  const snapshot = await buildProjectSnapshot(project, publicationId, database);
  const publication = await persistPublication(project, userId, snapshot, database);
  return { publication, url: `/s/${project.slug}` };
}

export async function unpublishProject(userId: string, projectId: string, db?: Db) {
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'publish', database);
  await database.transaction(async (tx) => {
    await tx.update(publications).set({ state: 'superseded', activatedAt: null }).where(and(eq(publications.projectId, project.id), eq(publications.state, 'active')));
    await tx.update(projects).set({ activePublicationId: null, status: 'draft', updatedAt: new Date() }).where(and(eq(projects.id, project.id), eq(projects.workspaceId, project.workspaceId)));
    await tx.update(assets).set({ visibility: 'private' }).where(and(eq(assets.workspaceId, project.workspaceId), eq(assets.projectId, project.id)));
  });
}

export async function listPublications(userId: string, projectId: string, db?: Db) {
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'read', database);
  return database.select({ id: publications.id, number: publications.number, state: publications.state, createdAt: publications.createdAt }).from(publications).where(and(eq(publications.projectId, project.id), eq(publications.workspaceId, project.workspaceId))).orderBy(desc(publications.number));
}

export async function rollbackPublication(userId: string, projectId: string, publicationId: string, db?: Db) {
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'publish', database);
  const old = (await database.select().from(publications).where(and(eq(publications.id, publicationId), eq(publications.projectId, project.id), eq(publications.workspaceId, project.workspaceId))).limit(1))[0];
  if (!old) throw new ApiError(404, 'PUBLICATION_NOT_FOUND', 'Version publiée introuvable.');
  const snapshot = cloneDocument(old.snapshot);
  snapshot.publicationId = createId('publication');
  snapshot.publishedAt = new Date().toISOString();
  const publication = await persistPublication(project, userId, snapshot, database);
  return { publication, url: `/s/${project.slug}` };
}

async function findPublishedSite(condition: ReturnType<typeof and>, db?: Db): Promise<SiteSnapshot | null> {
  const database = db ?? await getDb();
  const row = (await database.select({ snapshot: publications.snapshot }).from(projects)
    .innerJoin(publications, and(eq(publications.id, projects.activePublicationId), eq(publications.projectId, projects.id)))
    .innerJoin(workspaces, and(eq(workspaces.id, projects.workspaceId), eq(workspaces.status, 'active')))
    .where(and(condition, isNull(projects.deletedAt), eq(projects.status, 'published'), eq(publications.state, 'active')))
    .limit(1))[0];
  return row ? row.snapshot : null;
}

export async function getPublishedSite(slug: string, db?: Db): Promise<SiteSnapshot | null> {
  return findPublishedSite(eq(projects.slug, slug), db);
}

export async function getPublishedProjectSite(projectId: string, db?: Db): Promise<SiteSnapshot | null> {
  return findPublishedSite(eq(projects.id, projectId), db);
}
