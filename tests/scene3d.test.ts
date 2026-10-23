import { describe, expect, it } from 'vitest';
import { creativeCapabilities, getCreativeCapability } from '@/lib/creative/capabilities';
import { evaluateScene3DFit, SCENE3D_BUDGET } from '@/lib/creative/scene3d';
import { runCreativeCapability } from '@/lib/creative/orchestrator';
import { applyAiProposal } from '@/lib/document/ai';
import { createPageDocument, makeNode } from '@/lib/document/factory';
import { flattenNodes } from '@/lib/document/operations';
import { collectAssetIds, findNode, validatePageDocument } from '@/lib/document/validation';
import type { PageDocument } from '@/lib/document/types';

function scenes(document: PageDocument) {
  return flattenNodes(document.root).filter((node) => node.type === 'scene3d');
}

describe('catalogue et décision 3D', () => {
  it('décrit une capacité bornée et ne l’active pas pour un brief premium générique', () => {
    expect(creativeCapabilities).toHaveLength(1);
    expect(getCreativeCapability('scene3d')).toMatchObject({ id: 'scene3d', status: 'implemented', orchestration: 'synchronous-local' });
    expect(getCreativeCapability('inconnue')).toBeUndefined();
    expect(evaluateScene3DFit('Un portfolio premium, éditorial et haut de gamme').eligible).toBe(false);
    expect(evaluateScene3DFit('Ajoute une scène 3D orbitale').eligible).toBe(true);
    expect(evaluateScene3DFit('Surtout sans 3D').eligible).toBe(false);
    expect(SCENE3D_BUDGET).toMatchObject({ maxPerPage: 1, particles: { low: 32, balanced: 64 } });
  });
});

describe('orchestration verticale de scene3d', () => {
  it('insère, configure et supprime une scène sans muter le document source', () => {
    const heading = makeNode('heading', { text: 'Projets', level: 1 });
    const original = createPageDocument({ nodes: [heading] });
    const serialized = JSON.stringify(original);
    const inserted = runCreativeCapability(original, 'scene3d', {
      kind: 'scene3d', action: 'insert', targetId: heading.id, position: 'after',
      props: { title: 'Orbite', quality: 'balanced', fallbackSrc: '/images/demos/portfolio-project.jpg' },
    });
    expect(JSON.stringify(original)).toBe(serialized);
    expect(scenes(inserted)).toHaveLength(1);
    const scene = scenes(inserted)[0]!;
    expect(scene.props).toMatchObject({ title: 'Orbite', quality: 'balanced', preset: 'orbital', autoRotate: true, fallbackAlt: expect.any(String) });

    const updated = runCreativeCapability(inserted, 'scene3d', {
      kind: 'scene3d', action: 'update', targetId: scene.id, props: { autoRotate: false, preset: 'prism' },
    });
    expect(findNode(updated.root, scene.id)?.props).toMatchObject({ title: 'Orbite', quality: 'balanced', autoRotate: false, preset: 'prism' });
    expect(findNode(updated.root, heading.id)?.props.text).toBe('Projets');
    const removed = runCreativeCapability(updated, 'scene3d', { kind: 'scene3d', action: 'remove', targetId: scene.id });
    expect(scenes(removed)).toHaveLength(0);
    expect(scenes(updated)).toHaveLength(1);
  });

  it('refuse un second contexte, les props inconnues et les URL de fallback dangereuses', () => {
    const original = createPageDocument({ nodes: [makeNode('scene3d')] });
    const scene = scenes(original)[0]!;
    expect(() => runCreativeCapability(original, 'scene3d', { kind: 'scene3d', action: 'insert', targetId: original.root.id, position: 'inside' })).toThrow(/déjà une scène 3D/);
    expect(() => runCreativeCapability(original, 'scene3d', { kind: 'scene3d', action: 'update', targetId: scene.id, props: { preset: 'inconnu' } })).toThrow();
    expect(() => runCreativeCapability(original, 'scene3d', { kind: 'scene3d', action: 'update', targetId: scene.id, props: { fallbackSrc: 'javascript:alert(1)' } })).toThrow();
    expect(() => runCreativeCapability(original, 'scene3d', { kind: 'scene3d', action: 'update', targetId: scene.id, props: { onBeforeRender: 'alert(1)' } })).toThrow();

    const duplicated = createPageDocument({ nodes: [makeNode('scene3d'), makeNode('scene3d')] });
    expect(validatePageDocument(duplicated).success).toBe(false);
    expect(validatePageDocument(duplicated).issues.map((issue) => issue.message)).toContain('Une page est limitée à une scène 3D pour maîtriser le budget graphique.');
  });

  it('relie la proposition IA à l’orchestrateur et collecte le média de fallback', () => {
    const original = createPageDocument({ nodes: [makeNode('heading', { text: 'Original', level: 2 })] });
    const preview = applyAiProposal(original, {
      summary: 'Ajouter une scène contrôlée',
      operations: [{ kind: 'scene3d', action: 'insert', targetId: original.root.id, position: 'inside', props: { fallbackAssetId: '7c2e09b3-81db-4f3f-a64f-cabff8a1e932' } }],
    });
    expect(scenes(original)).toHaveLength(0);
    expect(scenes(preview)).toHaveLength(1);
    expect(collectAssetIds(preview).has('7c2e09b3-81db-4f3f-a64f-cabff8a1e932')).toBe(true);
  });
});
