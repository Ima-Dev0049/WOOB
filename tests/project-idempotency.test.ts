import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, count, eq } from 'drizzle-orm';
import type { DatabaseContext } from '@/server/db';
import { createAccount, testDatabase } from './helpers/database';
import { createId } from '@/lib/id';
import {
  aiGenerations, pages, posts, products, projectCreationRequests, projectModules, projects,
  subscriptions, workspaceMembers, workspaces,
} from '@/server/db/schema';
import { generateProjectPreview } from '@/server/services/project-generation';
import { createProject } from '@/server/services/projects';

let context: DatabaseContext;
let previousProvider: string | undefined;
beforeAll(async () => {
  previousProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'demo';
  context = await testDatabase();
}, 60_000);
afterAll(async () => {
  await context.close();
  if (previousProvider === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = previousProvider;
});

async function creationCounts(workspaceId: string, projectId: string) {
  const whereProject = (table: typeof pages | typeof projectModules | typeof products | typeof posts) => and(eq(table.workspaceId, workspaceId), eq(table.projectId, projectId));
  const [projectRows] = await context.db.select({ value: count() }).from(projects).where(eq(projects.workspaceId, workspaceId));
  const [pageRows] = await context.db.select({ value: count() }).from(pages).where(whereProject(pages));
  const [moduleRows] = await context.db.select({ value: count() }).from(projectModules).where(whereProject(projectModules));
  const [productRows] = await context.db.select({ value: count() }).from(products).where(whereProject(products));
  const [postRows] = await context.db.select({ value: count() }).from(posts).where(whereProject(posts));
  const [generationRows] = await context.db.select({ value: count() }).from(aiGenerations).where(eq(aiGenerations.workspaceId, workspaceId));
  const [requestRows] = await context.db.select({ value: count() }).from(projectCreationRequests).where(eq(projectCreationRequests.workspaceId, workspaceId));
  return {
    projects: projectRows!.value, pages: pageRows!.value, modules: moduleRows!.value,
    products: productRows!.value, posts: postRows!.value,
    generations: generationRows!.value, requests: requestRows!.value,
  };
}

describe('reprise idempotente de la création de projet', () => {
  it('rejoue une prévisualisation sans dupliquer le projet ni consommer deux fois la génération', async () => {
    const account = await createAccount(context.db, 'project-replay@example.com', 'Project Replay');
    const selection = {
      name: 'Maison reprise', brief: 'Objets artisanaux et commandes manuelles.',
      siteTypeId: 'ecommerce-crafts', activityDomainId: 'art-crafts',
      designStyleId: 'warm-artisanal', moduleIds: ['forms', 'blog', 'catalog'] as ('forms' | 'blog' | 'catalog')[],
      locale: 'fr' as const,
    };
    const preview = await generateProjectPreview(account.user.id, account.workspace.id, selection, context.db);
    const requestId = createId('request');
    const input = { ...selection, generationId: preview.generationId, requestId };
    const first = await createProject(account.user.id, account.workspace.id, input, context.db);
    expect(first.replayed).toBe(false);
    expect(first.products.length).toBeGreaterThan(0);
    const before = await creationCounts(account.workspace.id, first.project.id);
    expect(before).toMatchObject({ projects: 1, requests: 1, generations: 1 });
    const generationBefore = (await context.db.select().from(aiGenerations).where(eq(aiGenerations.id, preview.generationId)))[0]!;

    const replay = await createProject(account.user.id, account.workspace.id, {
      ...input, moduleIds: [...selection.moduleIds].reverse(),
    }, context.db);
    expect(replay.replayed).toBe(true);
    expect(replay.project.id).toBe(first.project.id);
    expect(replay.pages.map((page) => page.id)).toEqual(first.pages.map((page) => page.id));
    expect(replay.modules.map((module) => module.id)).toEqual(first.modules.map((module) => module.id));
    expect(replay.products.map((product) => product.id)).toEqual(first.products.map((product) => product.id));
    expect(replay.posts.map((post) => post.id)).toEqual(first.posts.map((post) => post.id));
    expect(await creationCounts(account.workspace.id, first.project.id)).toEqual(before);
    const generationAfter = (await context.db.select().from(aiGenerations).where(eq(aiGenerations.id, preview.generationId)))[0]!;
    expect(generationAfter).toEqual(generationBefore);
    expect(generationAfter.projectId).toBe(first.project.id);

    await expect(createProject(account.user.id, account.workspace.id, {
      ...input, name: 'Une autre demande',
    }, context.db)).rejects.toMatchObject({ status: 409, code: 'PROJECT_CREATION_MISMATCH' });
    expect(await creationCounts(account.workspace.id, first.project.id)).toEqual(before);
  });

  it('protège aussi une création directe et refuse une autre charge avec la même clé', async () => {
    const account = await createAccount(context.db, 'direct-replay@example.com', 'Direct Replay');
    const requestId = createId('request');
    const input = { name: 'Projet direct', description: 'Sans prévisualisation', templateId: 'studio-business', requestId };
    const first = await createProject(account.user.id, account.workspace.id, input, context.db);
    const replay = await createProject(account.user.id, account.workspace.id, input, context.db);
    expect(first.replayed).toBe(false);
    expect(first.posts.length).toBeGreaterThan(0);
    expect(replay.replayed).toBe(true);
    expect(replay.project.id).toBe(first.project.id);
    expect(replay.pages.map((page) => page.id)).toEqual(first.pages.map((page) => page.id));
    expect(replay.posts.map((post) => post.id)).toEqual(first.posts.map((post) => post.id));
    expect(await creationCounts(account.workspace.id, first.project.id)).toMatchObject({ projects: 1, requests: 1, generations: 0 });
    await expect(createProject(account.user.id, account.workspace.id, { ...input, description: 'Charge modifiée' }, context.db))
      .rejects.toMatchObject({ status: 409, code: 'PROJECT_CREATION_MISMATCH' });
    expect(await creationCounts(account.workspace.id, first.project.id)).toMatchObject({ projects: 1, requests: 1, generations: 0 });
  });

  it('isole la même clé par workspace et par utilisateur', async () => {
    const account = await createAccount(context.db, 'workspace-replay@example.com', 'Workspace Replay');
    const other = await createAccount(context.db, 'other-replay@example.com', 'Other Replay');
    const secondWorkspaceId = createId('workspace');
    const subscription = (await context.db.select().from(subscriptions).where(eq(subscriptions.workspaceId, account.workspace.id)))[0]!;
    await context.db.insert(workspaces).values({
      id: secondWorkspaceId, name: 'Second espace', slug: `second-${createId()}`, ownerId: account.user.id,
    });
    await context.db.insert(workspaceMembers).values({ workspaceId: secondWorkspaceId, userId: account.user.id, role: 'owner', status: 'active' });
    await context.db.insert(subscriptions).values({ id: createId('subscription'), workspaceId: secondWorkspaceId, planId: subscription.planId, provider: 'local', status: 'active' });
    const requestId = createId('request');
    const input = { name: 'Projet isolé', description: '', templateId: 'studio-business', requestId };

    const first = await createProject(account.user.id, account.workspace.id, input, context.db);
    const secondWorkspace = await createProject(account.user.id, secondWorkspaceId, input, context.db);
    const otherUser = await createProject(other.user.id, other.workspace.id, input, context.db);
    expect(first.replayed).toBe(false);
    expect(secondWorkspace.replayed).toBe(false);
    expect(otherUser.replayed).toBe(false);
    expect(new Set([first.project.id, secondWorkspace.project.id, otherUser.project.id]).size).toBe(3);
    expect(secondWorkspace.project.workspaceId).toBe(secondWorkspaceId);
    expect(otherUser.project.workspaceId).toBe(other.workspace.id);
    expect((await createProject(account.user.id, account.workspace.id, input, context.db)).project.id).toBe(first.project.id);
    expect((await createProject(account.user.id, secondWorkspaceId, input, context.db)).project.id).toBe(secondWorkspace.project.id);
    expect((await createProject(other.user.id, other.workspace.id, input, context.db)).project.id).toBe(otherUser.project.id);
  });
});
