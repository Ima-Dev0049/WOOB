import { describe, expect, it } from 'vitest';
import { buildProjectDraft } from '@/lib/catalog/generation';
import type { CreationSelection } from '@/lib/catalog/types';
import { projectBriefSchema } from '@/lib/creative/schema';
import { evaluateCreativeQuality } from '@/lib/creative/quality';
import { validatePageDocument, walkNodes } from '@/lib/document/validation';

const selection: CreationSelection = {
  name: 'Maison Aïda',
  brief: 'Cuisine béninoise de saison, pour les familles et les voyageurs curieux. Une table chaleureuse et vivante.',
  siteTypeId: 'restaurant-classic', activityDomainId: 'food-agriculture', designStyleId: 'warm-artisanal', moduleIds: ['forms', 'reservations'], locale: 'fr',
};

describe('brief-engine local et traçable', () => {
  it('conserve les exigences explicites et distingue les hypothèses non bloquantes', () => {
    const draft = buildProjectDraft(selection);
    const brief = draft.brief;
    expect(projectBriefSchema.safeParse(brief).success).toBe(true);
    expect(brief.sourceText).toBe(selection.brief);
    expect(brief.objective).toContain('Cuisine béninoise');
    expect(brief.valueProposition).toContain('Cuisine béninoise');
    expect(brief.audience[0]).toContain('familles');
    expect(brief.tone).toContain('Chaleureux');
    expect(brief.industry).toBe(draft.context.activityDomain?.name);
    expect(brief.requiredPages.map((page) => page.slug)).toEqual(draft.resolved.pages.map((page) => page.path));
    expect(brief.requiredFeatures.map((feature) => feature.id)).toEqual(['forms', 'reservations']);
    expect(brief.requiredFeatures.every((feature) => feature.priority === 'required' && feature.acceptanceCriteria.length > 0)).toBe(true);
    expect(brief.assumptions.map((assumption) => assumption.id)).toContain('value-proposition');
    expect(brief.assumptions.map((assumption) => assumption.id)).not.toContain('audience');
    expect(brief.missingInformation.every((item) => !item.blocking)).toBe(true);
    expect(brief.references).toEqual([]);
    expect(draft.creative.candidates.every((candidate) => candidate.intent === brief.objective && candidate.audience === brief.audience[0])).toBe(true);
    expect(draft.quality.metrics.briefRequirements).toBe(true);
  });

  it('rend les absences explicites sans bloquer une architecture personnalisée', () => {
    const draft = buildProjectDraft({ name: 'Projet libre', brief: '', siteTypeId: null, activityDomainId: null, designStyleId: 'minimal-luxury', moduleIds: [], locale: 'en' });
    expect(draft.brief.valueProposition).toBeNull();
    expect(draft.brief.objective).toContain('Present Projet libre');
    expect(draft.brief.assumptions.map((item) => item.id)).toEqual(expect.arrayContaining(['value-proposition', 'audience', 'tone']));
    expect(draft.brief.missingInformation.map((item) => item.id)).toEqual(expect.arrayContaining(['value-proposition', 'audience', 'success-metric']));
    expect(draft.brief.requiredPages.length).toBeGreaterThan(0);
    expect(draft.brief.requiredFeatures).toEqual([]);
  });

  it('signale une contradiction motion et applique la contrainte la plus restrictive dans le rendu structuré', () => {
    const draft = buildProjectDraft({ ...selection, brief: 'Un site avec des animations mais sans animation, pour les familles. Une expérience chaleureuse.' });
    expect(draft.brief.contradictions).toHaveLength(1);
    expect(draft.brief.contradictions[0]).toMatchObject({ id: 'motion-conflict', status: 'needs-input' });
    expect(draft.brief.motionPreference).toBe('disabled');
    expect(draft.creative.candidates.every((candidate) => candidate.motion.enabled === false)).toBe(true);
    expect(draft.quality.metrics.motionNodes).toBe(0);
    for (const page of draft.pages) {
      expect(validatePageDocument(page.document).success).toBe(true);
      walkNodes(page.document.root, (node) => expect(node.motion).toBeUndefined());
    }
    const unambiguous = buildProjectDraft({ ...selection, brief: 'Un site sans animation, pour les familles.' });
    expect(unambiguous.brief.motionPreference).toBe('disabled');
    expect(unambiguous.brief.contradictions).toEqual([]);
    expect(unambiguous.quality.metrics.motionNodes).toBe(0);
  });

  it('détecte une exigence de page perdue au lieu de la marquer comme satisfaite', () => {
    const draft = buildProjectDraft(selection);
    const documents = structuredClone(draft.pages.map((page) => page.document));
    const home = documents.find((document) => document.metadata.path === '/')!;
    home.root.children = (home.root.children || []).filter((node) => node.type !== 'hero');
    const report = evaluateCreativeQuality(documents, draft.creative, draft.brief);
    expect(report.metrics.briefRequirements).toBe(false);
    expect(report.issues.some((issue) => issue.id === 'brief-section-/-hero' && issue.severity === 'error')).toBe(true);
    expect(report.score).toBeLessThan(draft.quality.score);
  });

  it('rejette les références non sûres au lieu de les intégrer au brief', () => {
    const invalid = structuredClone(buildProjectDraft(selection).brief);
    invalid.references.push({ type: 'url', url: 'javascript:alert(1)', description: 'Référence non fiable' });
    expect(projectBriefSchema.safeParse(invalid).success).toBe(false);
    const missingAsset = structuredClone(buildProjectDraft(selection).brief);
    missingAsset.references.push({ type: 'image', description: 'Image sans asset contrôlé' });
    expect(projectBriefSchema.safeParse(missingAsset).success).toBe(false);
  });
});
