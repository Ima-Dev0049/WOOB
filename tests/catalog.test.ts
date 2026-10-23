import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { DatabaseContext } from '@/server/db';
import { createAccount, testDatabase } from './helpers/database';
import { activityDomains, allActivityDomains, designStyles, functionalModules, getCatalogStats, searchActivityDomains, searchSiteTypes, siteCategories, siteTypes, validateCatalog, resolveProjectCreation } from '@/lib/catalog';
import { buildProjectDraft, buildProjectGenerationPrompt } from '@/lib/catalog/generation';
import { generateProjectPreview } from '@/server/services/project-generation';
import { createProject } from '@/server/services/projects';
import { aiGenerations } from '@/server/db/schema';

let context: DatabaseContext;
beforeAll(async () => { context = await testDatabase(); process.env.AI_PROVIDER = 'demo'; }, 60_000);
afterAll(async () => { await context.close(); });

describe('catalogue universel typé', () => {
  it('garantit les identifiants uniques, les relations et les capacités réellement disponibles', () => {
    expect(getCatalogStats()).toEqual({ categories: 20, siteTypes: 212, domains: 30, subdomains: 150, domainEntries: 180, styles: 6, modules: 4, blueprints: 21 });
    expect(validateCatalog()).toEqual([]);
    for (const entries of [siteCategories, siteTypes, allActivityDomains, designStyles, functionalModules]) {
      expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    }
    for (const domain of allActivityDomains) expect(domain.siteTypeIds.length).toBeGreaterThanOrEqual(2);
    for (const domain of allActivityDomains.filter((entry) => entry.parentId)) expect(activityDomains.some((parent) => parent.id === domain.parentId)).toBe(true);
    expect(functionalModules.every((module) => module.availability === 'implemented')).toBe(true);
  });

  it('recherche sans accent et combine catégorie, domaine et recommandations', () => {
    expect(searchSiteTypes({ query: 'medecin' }).map((type) => type.id)).toContain('health-medical-practice');
    expect(searchSiteTypes({ query: 'restauration', categoryId: 'restaurant' }).length).toBeGreaterThan(0);
    expect(searchSiteTypes({ domainId: 'food-agriculture', query: 'producteur' }).map((type) => type.id)).toContain('restaurant-producer');
    expect(searchActivityDomains({ query: 'intelligence artificielle' }).map((domain) => domain.id)).toContain('technology');
    expect(searchActivityDomains({ query: 'sante mentale' }).map((domain) => domain.id)).toContain('health-sciences-mental');
    expect(searchActivityDomains({ siteTypeId: 'restaurant-classic', recommendedOnly: true }).map((domain) => domain.id)).toContain('food-agriculture');
    expect(searchActivityDomains({ siteTypeId: 'restaurant-classic', recommendedOnly: true }).map((domain) => domain.id)).not.toContain('finance-insurance');
  });

  it('résout les pages selon les modules et refuse une capacité incompatible', () => {
    const resolved = resolveProjectCreation({ name: 'Table test', siteTypeId: 'restaurant-classic', moduleIds: ['reservations'] });
    expect(resolved.selectedModuleIds).toEqual(['reservations']);
    expect(resolved.pages.map((page) => page.path)).toContain('/reservation');
    expect(resolved.pages.map((page) => page.path)).not.toContain('/commander');
    expect(resolved.pages.flatMap((page) => page.components)).not.toContain('contactForm');
    expect(() => resolveProjectCreation({ name: 'Marketplace', siteTypeId: 'marketplace-c2c', moduleIds: ['catalog'] })).toThrowError(expect.objectContaining({ code: 'MODULE_UNSUPPORTED' }));
  });

  it('construit un document valide sans type ni domaine et transmet tout le contexte au générateur', () => {
    const draft = buildProjectDraft({ name: 'Projet libre', brief: '', siteTypeId: null, activityDomainId: null, designStyleId: 'minimal-luxury', moduleIds: [], locale: 'en' });
    expect(draft.resolved.siteType).toBeNull();
    expect(draft.resolved.domain).toBeNull();
    expect(draft.resolved.selectedModuleIds).toEqual([]);
    expect(draft.pages.some((page) => page.path === '/')).toBe(true);
    expect(draft.pages.flatMap((page) => page.document.root.children || []).map((node) => node.type)).not.toContain('products');
    expect(draft.content.heroDescription).toContain('Discover Projet libre');
    const prompt = buildProjectGenerationPrompt(draft.context);
    expect(prompt).toContain('minimal-luxury');
    expect(prompt).toContain('"locale":"en"');
    expect(prompt).toContain('"modules":[]');
  });
});

describe('génération et persistance du parcours catalogue', () => {
  const selection = {
    name: 'Maison du goût', brief: 'Cuisine béninoise de saison et accueil chaleureux.',
    siteTypeId: 'restaurant-classic', activityDomainId: 'food-agriculture',
    designStyleId: 'warm-artisanal', moduleIds: ['forms', 'reservations'] as ('forms' | 'reservations')[], locale: 'fr' as const,
  };

  it('utilise le brief et les choix dans le contexte puis crée exactement le brouillon prévisualisé', async () => {
    const account = await createAccount(context.db, 'catalog@example.com', 'Catalogue');
    const preview = await generateProjectPreview(account.user.id, account.workspace.id, selection, context.db);
    expect(preview.demo).toBe(true);
    expect(preview.draft.content.heroDescription).toBe(selection.brief);
    expect(preview.draft.resolved.style.id).toBe('warm-artisanal');
    const logged = (await context.db.select().from(aiGenerations).where(eq(aiGenerations.id, preview.generationId)))[0]!;
    expect(logged.prompt).toContain('restaurant-classic');
    expect(logged.prompt).toContain('food-agriculture');
    expect(logged.prompt).toContain('warm-artisanal');
    expect(logged.prompt).toContain('Cuisine béninoise');
    expect(logged.prompt).toContain('Aucune disponibilité');

    const details = await createProject(account.user.id, account.workspace.id, { ...selection, generationId: preview.generationId }, context.db);
    expect(details.project.catalogSelection).toMatchObject({ siteTypeId: 'restaurant-classic', activityDomainId: 'food-agriculture', designStyleId: 'warm-artisanal' });
    expect(details.project.theme.primaryColor).toBe('#8B3A3A');
    expect(details.modules.map((module) => module.key).sort()).toEqual(['forms', 'reservations']);
    expect(details.pages.map((page) => page.path).sort()).toEqual(preview.draft.pages.map((page) => page.path).sort());
    expect(details.pages.map((page) => page.path)).not.toContain('/commander');
    expect(details.products).toEqual([]);
    expect(details.posts).toEqual([]);
    expect((await context.db.select().from(aiGenerations).where(eq(aiGenerations.id, preview.generationId)))[0]!.projectId).toBe(details.project.id);
    await expect(createProject(account.user.id, account.workspace.id, { ...selection, generationId: preview.generationId }, context.db)).rejects.toMatchObject({ status: 404 });
  });

  it('refuse la réutilisation croisée ou avec une sélection modifiée', async () => {
    const account = await createAccount(context.db, 'catalog-owner@example.com', 'Catalogue Owner');
    const other = await createAccount(context.db, 'catalog-other@example.com', 'Catalogue Other');
    const preview = await generateProjectPreview(account.user.id, account.workspace.id, selection, context.db);
    await expect(createProject(other.user.id, other.workspace.id, { ...selection, generationId: preview.generationId }, context.db)).rejects.toMatchObject({ status: 404 });
    await expect(createProject(account.user.id, account.workspace.id, { ...selection, designStyleId: 'editorial-modern', generationId: preview.generationId }, context.db)).rejects.toMatchObject({ status: 409, code: 'GENERATION_SELECTION_MISMATCH' });
    const stillPending = (await context.db.select().from(aiGenerations).where(and(eq(aiGenerations.id, preview.generationId), eq(aiGenerations.workspaceId, account.workspace.id))))[0]!;
    expect(stillPending.projectId).toBeNull();
  });
});
