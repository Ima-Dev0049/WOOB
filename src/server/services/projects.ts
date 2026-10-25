import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { and, asc, desc, eq, isNull, max, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@/lib/id';
import { normalizePagePath, slugify } from '@/lib/utils';
import { getDesignSystem, normalizeThemeSettings, withDesignSystem } from '@/lib/document/design-system';
import { createPageDocument } from '@/lib/document/factory';
import { cloneDocument, validatePageDocument, assertValidPageDocument, themeSchema } from '@/lib/document/validation';
import type { ThemeSettings } from '@/lib/document/types';
import { getTemplate } from '@/lib/templates';
import { CatalogError, functionalModuleIds, resolveProjectCreation } from '@/lib/catalog';
import { buildProjectDraft, createCatalogSnapshot, creationSelectionSchema } from '@/lib/catalog/generation';
import { readProjectGeneration } from './project-generation';
import { getDb, type Db } from '@/server/db';
import { aiGenerations, pageVersions, pages, posts, products, projectCreationRequests, projectModules, projects } from '@/server/db/schema';
import { ApiError } from '@/server/http';
import { requireMembership, requireProject } from '@/server/auth/tenancy';
import { assertPageQuota, assertProjectQuota } from './quotas';

export const projectInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(''),
  templateId: z.string().max(100).default('studio-business'),
  brief: z.string().trim().max(2000).optional(),
  siteTypeId: z.string().max(100).nullable().optional(),
  activityDomainId: z.string().max(100).nullable().optional(),
  designStyleId: z.string().max(100).optional(),
  moduleIds: z.array(z.enum(functionalModuleIds)).max(functionalModuleIds.length).optional(),
  locale: z.enum(['fr', 'en']).optional(),
  generationId: z.string().uuid().optional(),
  creativeConceptId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional(),
  requestId: z.string().uuid().optional(),
});

async function availableProjectSlug(name: string, db: Db): Promise<string> {
  const base = slugify(name);
  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? base : `${base}-${createId().slice(0, 6)}`;
    const existing = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, candidate)).limit(1);
    if (!existing.length) return candidate;
  }
  throw new ApiError(409, 'SLUG_UNAVAILABLE', 'Impossible de trouver une adresse disponible.');
}

export async function listProjects(userId: string, workspaceId: string, db?: Db) {
  const database = db ?? await getDb();
  await requireMembership(userId, workspaceId, 'read', database);
  return database.select().from(projects).where(and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt))).orderBy(desc(projects.updatedAt));
}

function projectRequestFingerprint(data: z.output<typeof projectInputSchema>): string {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === 'requestId' || value === undefined) continue;
    normalized[key] = key === 'moduleIds'
      ? functionalModuleIds.filter((moduleId) => (value as string[]).includes(moduleId))
      : value;
  }
  const canonical = Object.fromEntries(Object.entries(normalized).sort(([left], [right]) => left.localeCompare(right)));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

async function findProjectCreationRequest(db: Db, userId: string, workspaceId: string, requestKey: string) {
  return (await db.select().from(projectCreationRequests).where(and(
    eq(projectCreationRequests.workspaceId, workspaceId),
    eq(projectCreationRequests.requestedBy, userId),
    eq(projectCreationRequests.requestKey, requestKey),
  )).limit(1))[0];
}

function requestedProjectId(request: NonNullable<Awaited<ReturnType<typeof findProjectCreationRequest>>>, requestHash: string): string {
  if (request.requestHash !== requestHash) {
    throw new ApiError(409, 'PROJECT_CREATION_MISMATCH', 'Cette clé de création a déjà été utilisée avec une autre sélection.');
  }
  if (!request.projectId || !request.completedAt) {
    throw new ApiError(409, 'PROJECT_CREATION_INCOMPLETE', 'La création liée à cette clé est indisponible.');
  }
  return request.projectId;
}

export async function createProject(userId: string, workspaceId: string, input: unknown, db?: Db) {
  const data = projectInputSchema.parse(input);
  const database = db ?? await getDb();
  await requireMembership(userId, workspaceId, 'edit', database);
  const requestHash = data.requestId ? projectRequestFingerprint(data) : null;
  if (data.requestId && requestHash) {
    const existing = await findProjectCreationRequest(database, userId, workspaceId, data.requestId);
    if (existing) {
      const projectId = requestedProjectId(existing, requestHash);
      return { ...await getProjectDetails(userId, projectId, database), replayed: true };
    }
  }
  await assertProjectQuota(workspaceId, database);
  const catalogRequested = data.brief !== undefined || data.siteTypeId !== undefined || data.activityDomainId !== undefined
    || data.designStyleId !== undefined || data.moduleIds !== undefined || data.locale !== undefined || data.generationId !== undefined || data.creativeConceptId !== undefined;
  let draft: ReturnType<typeof buildProjectDraft> | null = null;
  let template = catalogRequested ? undefined : getTemplate(data.templateId);
  if (!catalogRequested && !template) throw new ApiError(422, 'TEMPLATE_NOT_FOUND', 'Ce modèle n’existe pas.');
  if (catalogRequested) {
    const selection = creationSelectionSchema.parse({
      name: data.name, brief: data.brief ?? data.description, siteTypeId: data.siteTypeId,
      activityDomainId: data.activityDomainId, designStyleId: data.designStyleId, moduleIds: data.moduleIds, locale: data.locale,
    });
    let resolved;
    try {
      resolved = resolveProjectCreation(selection);
    } catch (error) {
      if (error instanceof CatalogError) throw new ApiError(422, error.code, error.message);
      throw error;
    }
    if (data.creativeConceptId && !data.generationId) throw new ApiError(422, 'GENERATION_REQUIRED', 'Générez une prévisualisation avant de choisir un concept.');
    const generated = data.generationId
      ? await readProjectGeneration(userId, workspaceId, data.generationId, createCatalogSnapshot(resolved), database, data.creativeConceptId, { name: selection.name, brief: selection.brief || '' })
      : undefined;
    draft = buildProjectDraft(selection, generated?.content, resolved, generated?.creative, generated?.brief || undefined);
    template = getTemplate(draft.resolved.templateId);
  }
  if (!template) throw new ApiError(422, 'TEMPLATE_NOT_FOUND', 'Ce modèle n’existe pas.');
  const theme = normalizeThemeSettings(draft?.pages[0]?.document.theme || draft?.resolved.style.theme || template.theme);
  const projectPages = draft?.pages || template.pages.map((templatePage) => {
    const pageId = createId('page');
    const document = createPageDocument({ pageId, name: templatePage.name, path: templatePage.path, theme, nodes: cloneDocument(templatePage.nodes) });
    document.metadata.description = templatePage.seoDescription;
    return { id: pageId, name: templatePage.name, path: templatePage.path, seoTitle: templatePage.seoTitle, seoDescription: templatePage.seoDescription, document };
  });
  const selectedModules = draft?.resolved.selectedModuleIds || template.modules;
  const initialProducts = draft?.products || template.products;
  const initialPosts = draft?.posts || template.posts;
  const projectId = createId('project');
  const slug = await availableProjectSlug(data.name, database);
  const outcome = await database.transaction(async (tx) => {
    if (data.requestId && requestHash) {
      const claimed = await tx.insert(projectCreationRequests).values({
        id: createId('project-request'), workspaceId, requestedBy: userId,
        requestKey: data.requestId, requestHash, generationId: data.generationId ?? null,
      }).onConflictDoNothing().returning();
      if (!claimed.length) {
        const existing = await findProjectCreationRequest(tx, userId, workspaceId, data.requestId);
        if (!existing) throw new ApiError(409, 'PROJECT_CREATION_CONFLICT', 'Cette création est déjà en cours de validation.');
        return { projectId: requestedProjectId(existing, requestHash), replayed: true };
      }
    }
    await tx.insert(projects).values({
      id: projectId, workspaceId, name: data.name, slug,
      description: data.description || draft?.selection.brief?.slice(0, 500) || '', theme,
      defaultLocale: draft?.resolved.locale || 'fr', catalogSelection: draft?.snapshot || null, creativeBrief: draft?.brief || null,
    });
    for (const page of projectPages) {
      assertValidPageDocument(page.document);
      await tx.insert(pages).values({ id: page.id, workspaceId, projectId, name: page.name, path: page.path, kind: page.path === '/' ? 'home' : 'standard', draftDocument: page.document, seoTitle: page.seoTitle, seoDescription: page.seoDescription });
    }
    for (const key of selectedModules) {
      await tx.insert(projectModules).values({ id: createId('module'), workspaceId, projectId, key, enabled: true });
    }
    for (const item of initialProducts) {
      await tx.insert(products).values({ id: createId('product'), workspaceId, projectId, name: item.name, slug: slugify(item.name), description: item.description, priceCents: item.priceCents, currency: item.currency, inventory: item.inventory, active: true });
    }
    for (const item of initialPosts) {
      await tx.insert(posts).values({ id: createId('post'), workspaceId, projectId, title: item.title, slug: slugify(item.title), excerpt: item.excerpt, content: item.content, status: 'published', publishedAt: new Date() });
    }
    if (data.generationId) {
      const linked = await tx.update(aiGenerations).set({ projectId }).where(and(
        eq(aiGenerations.id, data.generationId), eq(aiGenerations.workspaceId, workspaceId),
        eq(aiGenerations.requestedBy, userId), eq(aiGenerations.kind, 'project_create'), isNull(aiGenerations.projectId),
      )).returning();
      if (!linked.length) throw new ApiError(409, 'GENERATION_ALREADY_USED', 'Cette prévisualisation a déjà été utilisée. Générez-en une nouvelle.');
    }
    if (data.requestId) {
      await tx.update(projectCreationRequests).set({ projectId, completedAt: new Date() }).where(and(
        eq(projectCreationRequests.workspaceId, workspaceId),
        eq(projectCreationRequests.requestedBy, userId),
        eq(projectCreationRequests.requestKey, data.requestId),
      ));
    }
    return { projectId, replayed: false };
  });
  return { ...await getProjectDetails(userId, outcome.projectId, database), replayed: outcome.replayed };
}

export async function getProjectDetails(userId: string, projectId: string, db?: Db) {
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'read', database);
  const [projectPages, modules, catalog, journal] = await Promise.all([
    database.select().from(pages).where(and(eq(pages.projectId, projectId), eq(pages.workspaceId, project.workspaceId))).orderBy(sql`case when ${pages.path} = '/' then 0 else 1 end`, asc(pages.createdAt), asc(pages.path), asc(pages.id)),
    database.select().from(projectModules).where(and(eq(projectModules.projectId, projectId), eq(projectModules.workspaceId, project.workspaceId))),
    database.select().from(products).where(and(eq(products.projectId, projectId), eq(products.workspaceId, project.workspaceId))).orderBy(asc(products.createdAt)),
    database.select().from(posts).where(and(eq(posts.projectId, projectId), eq(posts.workspaceId, project.workspaceId))).orderBy(desc(posts.createdAt)),
  ]);
  return { project, pages: projectPages, modules, products: catalog, posts: journal };
}

export async function updateProjectSettings(userId: string, projectId: string, input: unknown, db?: Db) {
  const data = z.object({ name: z.string().trim().min(2).max(120), description: z.string().max(500), defaultLocale: z.enum(['fr', 'en']), theme: z.unknown().optional() }).parse(input);
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'edit', database);
  let theme: ThemeSettings | undefined;
  if (data.theme) {
    const themeResult = themeSchema.safeParse(data.theme);
    if (!themeResult.success) throw new ApiError(422, 'THEME_INVALID', 'Le thème est invalide.', themeResult.error.issues);
    theme = normalizeThemeSettings(themeResult.data);
    const currentDesign = getDesignSystem(project.theme);
    const nextDesign = getDesignSystem(theme);
    const retained = currentDesign.styles.filter((style) => !nextDesign.styles.some((candidate) => candidate.id === style.id));
    if (retained.length) theme = withDesignSystem(theme, { ...nextDesign, styles: [...nextDesign.styles, ...retained] });
  }
  return database.transaction(async (tx) => {
    const updated = (await tx.update(projects).set({ name: data.name, description: data.description, defaultLocale: data.defaultLocale, ...(theme ? { theme } : {}), draftRevision: project.draftRevision + 1, updatedAt: new Date() }).where(and(eq(projects.id, projectId), eq(projects.workspaceId, project.workspaceId), eq(projects.draftRevision, project.draftRevision))).returning())[0];
    if (!updated) throw new ApiError(409, 'REVISION_CONFLICT', 'Le projet a été modifié ailleurs.');
    if (theme) {
      const serializedTheme = JSON.stringify(theme);
      await tx.update(pages).set({
        draftDocument: sql`jsonb_set(jsonb_set(${pages.draftDocument}, '{theme}', ${serializedTheme}::jsonb, true), '{revision}', to_jsonb(${pages.draftRevision} + 1), true)`,
        draftRevision: sql`${pages.draftRevision} + 1`, updatedAt: new Date(),
      }).where(and(eq(pages.projectId, projectId), eq(pages.workspaceId, project.workspaceId)));
    }
    return updated;
  });
}

export async function deleteProject(userId: string, projectId: string, db?: Db) {
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'delete', database);
  await database.update(projects).set({ deletedAt: new Date(), activePublicationId: null, status: 'deleted', updatedAt: new Date() }).where(and(eq(projects.id, projectId), eq(projects.workspaceId, project.workspaceId)));
}

export async function createPage(userId: string, projectId: string, input: unknown, db?: Db) {
  const data = z.object({ name: z.string().trim().min(1).max(120), path: z.string().trim().min(1).max(200).optional() }).parse(input);
  const database = db ?? await getDb();
  const project = await requireProject(userId, projectId, 'edit', database);
  await assertPageQuota(project.workspaceId, projectId, database);
  const path = data.path ? normalizePagePath(data.path) : normalizePagePath(data.name);
  const pageId = createId('page');
  const document = createPageDocument({ pageId, name: data.name, path, theme: normalizeThemeSettings(project.theme) });
  const created = await database.insert(pages).values({ id: pageId, workspaceId: project.workspaceId, projectId, name: data.name, path, draftDocument: document, seoTitle: data.name }).returning();
  return created[0];
}

export async function savePageDocument(userId: string, pageId: string, input: unknown, db?: Db) {
  const data = z.object({ baseRevision: z.number().int().nonnegative(), document: z.unknown() }).parse(input);
  const database = db ?? await getDb();
  const existing = (await database.select().from(pages).where(eq(pages.id, pageId)).limit(1))[0];
  if (!existing) throw new ApiError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
  const project = await requireProject(userId, existing.projectId, 'edit', database);
  const validation = validatePageDocument(data.document);
  if (!validation.success) throw new ApiError(422, 'DOCUMENT_INVALID', 'Le document est invalide.', validation.issues);
  const document = validation.data;
  if (document.pageId !== pageId || document.metadata.path !== existing.path) {
    throw new ApiError(422, 'DOCUMENT_IDENTITY_MISMATCH', 'Le document ne correspond pas à cette page ou à son chemin.');
  }
  // A theme proposal cannot orphan a reusable style still referenced by another page.
  const previousDesign = getDesignSystem(project.theme);
  const nextDesign = getDesignSystem(document.theme);
  const retainedStyles = previousDesign.styles.filter((style) => !nextDesign.styles.some((candidate) => candidate.id === style.id));
  if (retainedStyles.length) document.theme = withDesignSystem(document.theme, { ...nextDesign, styles: [...nextDesign.styles, ...retainedStyles] });
  const themeChanged = !isDeepStrictEqual(normalizeThemeSettings(project.theme), document.theme);
  document.revision = existing.draftRevision + 1;
  return database.transaction(async (tx) => {
    const updated = (await tx.update(pages).set({ draftDocument: document, draftRevision: document.revision, updatedAt: new Date() }).where(and(eq(pages.id, pageId), eq(pages.workspaceId, project.workspaceId), eq(pages.projectId, project.id), eq(pages.draftRevision, data.baseRevision))).returning())[0];
    if (!updated) throw new ApiError(409, 'REVISION_CONFLICT', 'Cette page a changé dans un autre onglet.', { currentRevision: existing.draftRevision });
    const projectUpdate = await tx.update(projects).set({
      ...(themeChanged ? { theme: document.theme } : {}),
      draftRevision: project.draftRevision + 1,
      updatedAt: new Date(),
    }).where(and(eq(projects.id, project.id), eq(projects.workspaceId, project.workspaceId), eq(projects.draftRevision, project.draftRevision))).returning();
    if (!projectUpdate.length) throw new ApiError(409, 'REVISION_CONFLICT', 'Le projet a été modifié ailleurs. Rechargez avant de continuer.');
    if (themeChanged) {
      const serializedTheme = JSON.stringify(document.theme);
      // JSONB updates preserve each page's current root and local exceptions in the database.
      await tx.update(pages).set({
        draftDocument: sql`jsonb_set(jsonb_set(${pages.draftDocument}, '{theme}', ${serializedTheme}::jsonb, true), '{revision}', to_jsonb(${pages.draftRevision} + 1), true)`,
        draftRevision: sql`${pages.draftRevision} + 1`,
        updatedAt: new Date(),
      }).where(and(eq(pages.projectId, project.id), eq(pages.workspaceId, project.workspaceId), ne(pages.id, pageId)));
    }
    return updated;
  });
}

export async function updatePageMetadata(userId: string, pageId: string, input: unknown, db?: Db) {
  const data = z.object({ name: z.string().trim().min(1).max(120), path: z.string().trim().min(1).max(200), seoTitle: z.string().max(180), seoDescription: z.string().max(500), baseRevision: z.number().int().nonnegative() }).parse(input);
  const database = db ?? await getDb();
  const existing = (await database.select().from(pages).where(eq(pages.id, pageId)).limit(1))[0];
  if (!existing) throw new ApiError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
  const project = await requireProject(userId, existing.projectId, 'edit', database);
  const path = existing.kind === 'home' ? '/' : normalizePagePath(data.path);
  const document = cloneDocument(existing.draftDocument);
  document.metadata = { title: data.seoTitle || data.name, description: data.seoDescription, path };
  document.revision = existing.draftRevision + 1;
  const updated = (await database.update(pages).set({ name: data.name, path, seoTitle: data.seoTitle, seoDescription: data.seoDescription, draftDocument: document, draftRevision: document.revision, updatedAt: new Date() }).where(and(eq(pages.id, pageId), eq(pages.workspaceId, project.workspaceId), eq(pages.draftRevision, data.baseRevision))).returning())[0];
  if (!updated) throw new ApiError(409, 'REVISION_CONFLICT', 'Cette page a changé dans un autre onglet.');
  return updated;
}

export async function duplicatePage(userId: string, pageId: string, db?: Db) {
  const database = db ?? await getDb();
  const existing = (await database.select().from(pages).where(eq(pages.id, pageId)).limit(1))[0];
  if (!existing) throw new ApiError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
  const project = await requireProject(userId, existing.projectId, 'edit', database);
  await assertPageQuota(project.workspaceId, project.id, database);
  const newId = createId('page');
  const path = normalizePagePath(`${existing.name}-copie-${newId.slice(0, 4)}`);
  const document = cloneDocument(existing.draftDocument);
  document.pageId = newId;
  document.documentId = createId('doc');
  document.metadata.path = path;
  document.metadata.title = `${existing.name} — copie`;
  document.revision = 0;
  return (await database.insert(pages).values({ id: newId, workspaceId: project.workspaceId, projectId: project.id, name: `${existing.name} — copie`, path, kind: 'standard', draftDocument: document, seoTitle: existing.seoTitle, seoDescription: existing.seoDescription }).returning())[0];
}

export async function deletePage(userId: string, pageId: string, db?: Db) {
  const database = db ?? await getDb();
  const existing = (await database.select().from(pages).where(eq(pages.id, pageId)).limit(1))[0];
  if (!existing) throw new ApiError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
  await requireProject(userId, existing.projectId, 'edit', database);
  if (existing.kind === 'home') throw new ApiError(409, 'HOME_DELETE_FORBIDDEN', 'Choisissez une autre page d’accueil avant de supprimer celle-ci.');
  await database.delete(pages).where(eq(pages.id, pageId));
}

export async function setHomePage(userId: string, pageId: string, db?: Db) {
  const database = db ?? await getDb();
  const target = (await database.select().from(pages).where(eq(pages.id, pageId)).limit(1))[0];
  if (!target) throw new ApiError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
  const project = await requireProject(userId, target.projectId, 'edit', database);
  if (target.path === '/') return target;
  return database.transaction(async (tx) => {
    const current = (await tx.select().from(pages).where(and(eq(pages.projectId, project.id), eq(pages.path, '/'))).limit(1))[0];
    const targetOldPath = target.path;
    const currentNewPath = current ? normalizePagePath(`${current.name}-${current.id.slice(0, 4)}`) : null;
    const temporary = `/moving-${createId().slice(0, 12)}`;
    await tx.update(pages).set({ path: temporary }).where(eq(pages.id, target.id));
    if (current) {
      const document = cloneDocument(current.draftDocument);
      document.metadata.path = currentNewPath!;
      document.revision += 1;
      await tx.update(pages).set({ path: currentNewPath!, kind: 'standard', draftDocument: document, draftRevision: document.revision }).where(eq(pages.id, current.id));
    }
    const document = cloneDocument(target.draftDocument);
    document.metadata.path = '/';
    document.revision += 1;
    const updated = (await tx.update(pages).set({ path: '/', kind: 'home', draftDocument: document, draftRevision: document.revision }).where(eq(pages.id, target.id)).returning())[0];
    void targetOldPath;
    return updated;
  });
}

export async function createPageCheckpoint(userId: string, pageId: string, kind = 'manual', db?: Db) {
  const database = db ?? await getDb();
  const page = (await database.select().from(pages).where(eq(pages.id, pageId)).limit(1))[0];
  if (!page) throw new ApiError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
  const project = await requireProject(userId, page.projectId, 'edit', database);
  return database.transaction(async (tx) => {
    await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.id, project.id), eq(projects.workspaceId, project.workspaceId))).for('update');
    const current = (await tx.select().from(pages).where(and(eq(pages.id, page.id), eq(pages.workspaceId, project.workspaceId))).limit(1))[0];
    if (!current) throw new ApiError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
    const number = (await tx.select({ value: max(pageVersions.versionNumber) }).from(pageVersions).where(eq(pageVersions.pageId, pageId)))[0]?.value || 0;
    return (await tx.insert(pageVersions).values({ id: createId('version'), workspaceId: page.workspaceId, projectId: page.projectId, pageId, versionNumber: number + 1, kind, document: current.draftDocument, sourceRevision: current.draftRevision, createdBy: userId }).returning())[0];
  });
}

export async function listPageVersions(userId: string, pageId: string, db?: Db) {
  const database = db ?? await getDb();
  const page = (await database.select().from(pages).where(eq(pages.id, pageId)).limit(1))[0];
  if (!page) throw new ApiError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
  await requireProject(userId, page.projectId, 'read', database);
  return database.select({ id: pageVersions.id, versionNumber: pageVersions.versionNumber, kind: pageVersions.kind, sourceRevision: pageVersions.sourceRevision, createdAt: pageVersions.createdAt }).from(pageVersions).where(and(eq(pageVersions.pageId, page.id), eq(pageVersions.workspaceId, page.workspaceId), eq(pageVersions.projectId, page.projectId))).orderBy(desc(pageVersions.versionNumber)).limit(50);
}

export async function restorePageVersion(userId: string, pageId: string, versionId: string, input: unknown, db?: Db) {
  const { baseRevision } = z.object({ baseRevision: z.number().int().nonnegative() }).parse(input);
  const database = db ?? await getDb();
  const existing = (await database.select().from(pages).where(eq(pages.id, pageId)).limit(1))[0];
  if (!existing) throw new ApiError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
  const project = await requireProject(userId, existing.projectId, 'edit', database);
  const version = (await database.select().from(pageVersions).where(and(eq(pageVersions.id, versionId), eq(pageVersions.pageId, existing.id), eq(pageVersions.workspaceId, project.workspaceId), eq(pageVersions.projectId, project.id))).limit(1))[0];
  if (!version) throw new ApiError(404, 'VERSION_NOT_FOUND', 'Version introuvable.');
  // A page restore must not silently roll back the site-wide design system on this page only.
  const restorableDocument = cloneDocument(version.document);
  restorableDocument.theme = normalizeThemeSettings(project.theme);
  const validation = validatePageDocument(restorableDocument);
  if (!validation.success) throw new ApiError(422, 'VERSION_INVALID', 'Cette version ne peut pas être restaurée avec le thème global actuel.', validation.issues);
  const document = cloneDocument(validation.data);
  document.pageId = existing.id;
  document.metadata = { ...document.metadata, title: existing.seoTitle || existing.name, description: existing.seoDescription, path: existing.path };
  document.revision = existing.draftRevision + 1;
  return database.transaction(async (tx) => {
    await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.id, project.id), eq(projects.workspaceId, project.workspaceId))).for('update');
    const updated = (await tx.update(pages).set({ draftDocument: document, draftRevision: document.revision, updatedAt: new Date() }).where(and(eq(pages.id, existing.id), eq(pages.workspaceId, project.workspaceId), eq(pages.projectId, project.id), eq(pages.draftRevision, baseRevision))).returning())[0];
    if (!updated) throw new ApiError(409, 'REVISION_CONFLICT', 'La page a changé depuis le chargement de l’historique.');
    await tx.update(projects).set({ draftRevision: project.draftRevision + 1, updatedAt: new Date() }).where(and(eq(projects.id, project.id), eq(projects.workspaceId, project.workspaceId)));
    const number = (await tx.select({ value: max(pageVersions.versionNumber) }).from(pageVersions).where(eq(pageVersions.pageId, existing.id)))[0]?.value || 0;
    await tx.insert(pageVersions).values({ id: createId('version'), workspaceId: project.workspaceId, projectId: project.id, pageId: existing.id, versionNumber: number + 1, kind: 'restore', document, sourceRevision: document.revision, createdBy: userId });
    return { page: updated, restoredFrom: version.versionNumber };
  });
}
