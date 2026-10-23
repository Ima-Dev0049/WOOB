import { describe, expect, it } from 'vitest';
import { createPageDocument, makeNode } from '@/lib/document/factory';
import { safeHref, validatePageDocument, findNode } from '@/lib/document/validation';
import { duplicateNode, insertNode, moveNode, removeNode } from '@/lib/document/operations';
import { siteTemplates } from '@/lib/templates';

 describe('contrat de document et sécurité', () => {
  it('valide les six modèles sectoriels', () => {
    for (const template of siteTemplates) for (const page of template.pages) {
      const document = createPageDocument({ name: page.name, path: page.path, theme: template.theme, nodes: page.nodes });
      const result = validatePageDocument(document);
      expect(result.issues, `${template.id}:${page.path}`).toEqual([]);
      expect(result.success).toBe(true);
    }
  });
  it('refuse un composant inconnu et les clés de prototype', () => {
    const document = createPageDocument();
    const result = validatePageDocument({ ...document, root: { ...document.root, type: 'script' } });
    expect(result.success).toBe(false);
    const polluted = JSON.parse(JSON.stringify(document));
    polluted.root.props = JSON.parse('{"__proto__":"x"}');
    expect(validatePageDocument(polluted).success).toBe(false);
  });
  it('neutralise les URL dangereuses', () => {
    expect(safeHref('javascript:alert(1)')).toBe('#');
    expect(safeHref('data:text/html,x')).toBe('#');
    expect(safeHref('//evil.example')).toBe('#');
    expect(safeHref('/contact')).toBe('/contact');
    expect(safeHref('https://example.com')).toBe('https://example.com');
  });
 });

describe('opérations de l’éditeur', () => {
  it('insère, déplace, duplique avec de nouveaux IDs et supprime', () => {
    const document = createPageDocument({ nodes: [makeNode('heading', { text: 'Original', level: 2 })] });
    const heading = document.root.children![0]!;
    const text = makeNode('text');
    expect(insertNode(document.root, text, heading.id, 'after')).toBe(true);
    expect(document.root.children!.map((node) => node.id)).toEqual([heading.id, text.id]);
    expect(moveNode(document.root, text.id, heading.id, 'before')).toBe(true);
    expect(document.root.children![0]!.id).toBe(text.id);
    const copy = duplicateNode(document.root, heading.id);
    expect(copy).not.toBeNull();
    expect(copy!.id).not.toBe(heading.id);
    expect(findNode(document.root, copy!.id)).toBeDefined();
    expect(removeNode(document.root, text.id)?.id).toBe(text.id);
    expect(validatePageDocument(document).success).toBe(true);
  });
  it('interdit de déplacer un parent dans son propre enfant', () => {
    const section = makeNode('section');
    const document = createPageDocument({ nodes: [section] });
    const child = makeNode('text');
    insertNode(document.root, child, section.id, 'inside');
    expect(moveNode(document.root, section.id, child.id, 'inside')).toBe(false);
  });
});
