import { describe, expect, it } from 'vitest';
import { buildProjectDraft, withCreativeConcept } from '@/lib/catalog/generation';
import { designStyles } from '@/lib/catalog/capabilities';
import type { CreationSelection } from '@/lib/catalog/types';
import { applyCreativeDirection } from '@/lib/creative/engine';
import { evaluateCreativeQuality } from '@/lib/creative/quality';
import { creativeDirectionResultSchema } from '@/lib/creative/schema';
import { validatePageDocument } from '@/lib/document/validation';
import { auditThemeContrast, createDefaultDesignSystem } from '@/lib/document/design-system';
import { makeNode } from '@/lib/document/factory';
import { flattenNodes } from '@/lib/document/operations';
import type { PageDocument, PageNode } from '@/lib/document/types';

const restaurant: CreationSelection = {
  name: 'Maison Aïda', brief: 'Cuisine béninoise de saison, pour les familles et les voyageurs curieux. Une table chaleureuse et vivante.',
  siteTypeId: 'restaurant-classic', activityDomainId: 'food-agriculture', designStyleId: 'warm-artisanal', moduleIds: ['forms', 'reservations'], locale: 'fr',
};

function node(document: PageDocument, type: string): PageNode {
  const found = document.root.children?.find((child) => child.type === type);
  if (!found) throw new Error(`Missing ${type}`);
  return found;
}

describe('Creative Engine local et structuré', () => {
  it('produit trois concepts réellement distincts, évalués et traçables avant les documents', () => {
    const draft = buildProjectDraft(restaurant);
    expect(draft.creative.candidates).toHaveLength(3);
    expect(draft.creative.evaluations).toHaveLength(3);
    expect(draft.creative.diversity.uniqueCompositions).toBe(3);
    expect(draft.creative.diversity.score).toBeGreaterThanOrEqual(80);
    expect(new Set(draft.creative.candidates.map((candidate) => candidate.composition.heroLayout)).size).toBe(3);
    expect(draft.creative.candidates.every((candidate) => candidate.engine === 'local-rules-v1' && candidate.constraints.length >= 3)).toBe(true);
    expect(creativeDirectionResultSchema.safeParse(draft.creative).success).toBe(true);
    expect(draft.quality.visualInspection).toBe(false);
    expect(draft.quality.scope).toBe('document-model');
    expect(draft.quality.metrics.minimumContrast).toBeGreaterThanOrEqual(4.5);
    expect(draft.quality.metrics.motionNodes).toBeLessThanOrEqual(draft.pages.length * 3);
    for (const page of draft.pages) expect(validatePageDocument(page.document).success).toBe(true);
    for (const candidate of draft.creative.candidates) {
      const candidateDraft = withCreativeConcept(draft, candidate.conceptId);
      expect(candidateDraft.quality.metrics.minimumContrast).toBeGreaterThanOrEqual(4.5);
      expect(candidateDraft.quality.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    }
  });

  it('utilise les signaux explicites du brief et les modules sans prétendre à une IA distante', () => {
    const draft = buildProjectDraft(restaurant);
    const selected = draft.creative.candidates.find((candidate) => candidate.conceptId === draft.creative.selectedId)!;
    expect(selected.intent).toContain('Cuisine béninoise');
    expect(selected.audience).toContain('familles');
    expect(selected.emotion).toBe('Chaleur et proximité');
    expect(selected.conversion.goal).toContain('réservation');
    expect(selected.motion.rationale).toContain('au plus deux sections');
    const english = buildProjectDraft({ ...restaurant, name: 'Aïda House', locale: 'en' });
    expect(english.creative.candidates[0]!.palette.rationale).toMatch(/colour|contrast/);
    expect(english.creative.candidates[0]!.engine).toBe('local-rules-v1');
  });

  it('change de concept dans le document réel sans changer les textes du brief', () => {
    const draft = buildProjectDraft(restaurant);
    const alternative = draft.creative.candidates.find((candidate) => candidate.conceptId !== draft.creative.selectedId)!;
    const switched = withCreativeConcept(draft, alternative.conceptId);
    const hero = node(switched.pages.find((page) => page.path === '/')!.document, 'hero');
    expect(switched.creative.selectedId).toBe(alternative.conceptId);
    expect(hero.props.layout).toBe(alternative.composition.heroLayout);
    expect(hero.props.title).toBe(draft.content.heroTitle);
    expect(switched.pages[0]!.document.theme.creativeDirection?.conceptId).toBe(alternative.conceptId);
    expect(switched.content).toEqual(draft.content);
    expect(() => withCreativeConcept(draft, 'concept-inexistant')).toThrow();
  });

  it('préserve les exceptions locales, responsive et le motion manuel lors d’une direction globale', () => {
    const draft = buildProjectDraft(restaurant);
    const document = structuredClone(draft.pages[0]!.document);
    const hero = node(document, 'hero');
    hero.props.layout = 'monumental';
    hero.props.title = 'Exception éditoriale conservée';
    hero.styles = { padding: '17px' };
    hero.responsive = { mobile: { padding: '9px' } };
    hero.motion = { preset: 'fade', trigger: 'in-view', duration: 300, delay: 20, distance: 0 };
    const alternative = draft.creative.candidates.find((candidate) => candidate.composition.heroLayout !== 'monumental')!;
    const result = applyCreativeDirection(document, alternative);
    const resultHero = node(result, 'hero');
    expect(resultHero.props.layout).toBe('monumental');
    expect(resultHero.props.title).toBe('Exception éditoriale conservée');
    expect(resultHero.styles).toEqual({ padding: '17px' });
    expect(resultHero.responsive).toEqual({ mobile: { padding: '9px' } });
    expect(resultHero.motion).toEqual(hero.motion);
    expect(result.theme.creativeDirection?.conceptId).toBe(alternative.conceptId);
    expect(validatePageDocument(result).success).toBe(true);
  });

  it('intègre Pulse métrique au catalogue, aux documents et au préréglage éditeur', () => {
    const draft = buildProjectDraft({ ...restaurant, name: 'Maison Pulse', designStyleId: 'pulse-management' });
    expect(draft.resolved.style.id).toBe('pulse-management');
    expect(draft.creative.selectedId).toBe('operations-pulse');
    expect(draft.creative.diversity.uniqueCompositions).toBe(3);
    const home = draft.pages.find((page) => page.path === '/')!.document;
    expect(node(home, 'hero').props).toMatchObject({ layout: 'operations', visualTreatment: 'ledger' });
    const featuresPage = draft.pages.find((page) => page.document.root.children?.some((child) => child.type === 'features'))!;
    expect(node(featuresPage.document, 'features').props.layout).toBe('bento');
    expect(home.theme.creativeDirection?.conceptId).toBe('operations-pulse');
    expect(home.theme.designSystem?.colorMode).toBe('dark');
    expect(home.theme.designSystem?.tokens.typography.headingFont).toContain('Space Grotesk');
    expect(draft.quality.metrics.minimumContrast).toBeGreaterThanOrEqual(4.5);
    for (const page of draft.pages) expect(validatePageDocument(page.document).success).toBe(true);

    const preset = designStyles.find((style) => style.id === 'pulse-management')!;
    const editorDesign = createDefaultDesignSystem(preset.theme);
    expect(editorDesign.colorMode).toBe('light');
    expect(auditThemeContrast({ ...preset.theme, designSystem: editorDesign }).every((item) => item.ratio === null || item.ratio >= 4.5)).toBe(true);
  });

  it('mesure la non-répétition sur sept briefs et sept styles au lieu de valider un seul exemple', () => {
    const styles = ['professional-clear', 'minimal-luxury', 'warm-artisanal', 'editorial-modern', 'bold-creative', 'natural-organic', 'pulse-management'];
    const drafts = styles.map((designStyleId, index) => buildProjectDraft({
      name: `Projet distinct ${index + 1}`, brief: [`Conseil clair pour des associations locales.`, `Maison de couture minimale et premium.`, `Céramique artisanale chaleureuse.`, `Magazine d’analyses culturelles.`, `Studio audacieux pour la musique.`, `Voyages nature immersifs.`, `Suivi modulaire des opérations d’une école.`][index],
      siteTypeId: null, activityDomainId: null, designStyleId, moduleIds: [], locale: 'fr',
    }));
    const heroes = drafts.map((draft) => node(draft.pages.find((page) => page.path === '/')!.document, 'hero').props.layout);
    const uniqueRatio = new Set(heroes).size / heroes.length;
    const compositions = new Set(drafts.flatMap((draft) => draft.creative.candidates.map((candidate) => `${candidate.composition.heroLayout}:${candidate.composition.featuresLayout}:${candidate.composition.galleryLayout}`)));
    expect(uniqueRatio).toBeGreaterThanOrEqual(0.6);
    expect(new Set(heroes).size).toBeGreaterThanOrEqual(4);
    expect(compositions.size).toBeGreaterThanOrEqual(5);
  });

  it('signale les contrastes et valide le motion sans confondre contrôle structurel et inspection visuelle', () => {
    const draft = buildProjectDraft(restaurant);
    const broken = structuredClone(draft.pages[0]!.document);
    const design = broken.theme.designSystem!;
    const colors = design.colorMode === 'dark' ? design.tokens.darkColors : design.tokens.colors;
    colors.text = colors.background;
    const report = evaluateCreativeQuality([broken], draft.creative);
    expect(report.visualInspection).toBe(false);
    expect(report.issues.some((issue) => issue.id.startsWith('contrast-') && issue.severity === 'error')).toBe(true);
    expect(report.score).toBeLessThan(draft.quality.score);
    const invalidMotion = structuredClone(draft.pages[0]!.document);
    node(invalidMotion, 'hero').motion = { preset: 'rise', trigger: 'in-view', duration: 0, delay: 0, distance: 24 };
    expect(validatePageDocument(invalidMotion).success).toBe(false);
    const overAnimated = structuredClone(draft.pages.map((page) => page.document));
    const animateTree = (current: PageNode): void => {
      current.motion = { preset: 'fade', trigger: 'in-view', duration: 400, delay: 0, distance: 0 };
      current.children?.forEach(animateTree);
    };
    overAnimated.forEach((page) => animateTree(page.root));
    expect(evaluateCreativeQuality(overAnimated).issues.filter((issue) => issue.id === 'motion-budget')).toHaveLength(1);
    const invalidFont = structuredClone(draft.creative);
    invalidFont.candidates[0]!.typography.headingFont = 'Inter; background:url(https://example.com/x)';
    expect(creativeDirectionResultSchema.safeParse(invalidFont).success).toBe(false);
  });
});

describe('Motion lié au défilement', () => {
  const parallax = { preset: 'parallax', trigger: 'scroll', duration: 460, delay: 0, distance: 64 } as const;

  it('valide une parallaxe bornée sans transformer les entrées existantes', () => {
    const document = structuredClone(buildProjectDraft(restaurant).pages[0]!.document);
    expect(flattenNodes(document.root).some((item) => item.motion?.trigger === 'scroll')).toBe(false);
    node(document, 'hero').motion = parallax;
    expect(validatePageDocument(document).success).toBe(true);
    const incompatible = structuredClone(document);
    node(incompatible, 'hero').motion = { ...parallax, trigger: 'in-view' };
    expect(validatePageDocument(incompatible).success).toBe(false);
  });

  it('refuse les formulaires et un quatrième effet scroll sur une page', () => {
    const document = structuredClone(buildProjectDraft(restaurant).pages[0]!.document);
    const form = makeNode('contactForm');
    form.motion = parallax;
    document.root.children!.push(form);
    const invalidTarget = validatePageDocument(document);
    expect(invalidTarget.success).toBe(false);
    expect(invalidTarget.issues.some((issue) => issue.path.endsWith('.motion'))).toBe(true);

    const overBudget = structuredClone(buildProjectDraft(restaurant).pages[0]!.document);
    for (let index = 0; index < 4; index += 1) {
      const heading = makeNode('heading', { text: `Titre scroll ${index + 1}`, level: 2 });
      heading.motion = { ...parallax, preset: index % 2 ? 'rise' : 'parallax' };
      overBudget.root.children!.push(heading);
    }
    const result = validatePageDocument(overBudget);
    expect(result.success).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes('trois effets'))).toBe(true);
  });
});
