import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocumentRenderer } from '@/components/renderer/DocumentRenderer';
import { demoShowcases } from '@/lib/demos/showcases';
import { getDemoSite } from '@/lib/demos/sites';
import { validatePageDocument } from '@/lib/document/validation';
import type { PageNode } from '@/lib/document/types';

function collectStrings(value: unknown, key: string, output: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, key, output);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [childKey, child] of Object.entries(value)) {
    if (childKey === key && typeof child === 'string') output.push(child);
    collectStrings(child, key, output);
  }
}

function flatten(nodes: PageNode[]): PageNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
}

describe('démonstrations publiques Woob', () => {
  it('expose exactement les trois réalisations de l’accueil', () => {
    expect(demoShowcases.map((demo) => [demo.slug, demo.name, demo.type])).toEqual([
      ['king-food', 'King Food', 'Restaurant'],
      ['atelier-ligne', 'Atelier Ligne', 'Portfolio'],
      ['studio-cap', 'Studio Cap', 'Formation'],
    ]);
    expect(getDemoSite('inconnu')).toBeUndefined();
  });

  it.each(demoShowcases)('construit $name avec des documents, médias et liens valides', (showcase) => {
    const site = getDemoSite(showcase.slug);
    expect(site).toBeDefined();
    expect(site?.name).toBe(showcase.name);
    expect(site?.defaultLocale).toBe('fr');
    expect(site?.pages.some((page) => page.path === '/')).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'public', showcase.image.slice(1)))).toBe(true);

    const serialized = JSON.stringify(site);
    for (const forbidden of ['Alex Martin', 'contact@example.com', 'Votre adresse', '+00 00', '98 %', '10+']) {
      expect(serialized).not.toContain(forbidden);
    }

    const paths = new Set(site?.pages.map((page) => page.path));
    for (const page of site?.pages ?? []) {
      expect(validatePageDocument(page.document).success).toBe(true);
      const nodes = flatten(page.document.root.children ?? []);
      expect(nodes.some((node) => ['testimonials', 'stats', 'team', 'pricing', 'contact'].includes(node.type))).toBe(false);

      const images: string[] = [];
      collectStrings(page.document.root.props, 'src', images);
      collectStrings(page.document.root.children ?? [], 'src', images);
      collectStrings(page.document.root.children ?? [], 'imageUrl', images);
      for (const image of images.filter(Boolean)) {
        expect(image.startsWith('/images/demos/')).toBe(true);
        expect(existsSync(resolve(process.cwd(), 'public', image.slice(1)))).toBe(true);
      }

      const hrefs: string[] = [];
      collectStrings(page.document.root.children ?? [], 'href', hrefs);
      collectStrings(page.document.root.children ?? [], 'primaryHref', hrefs);
      collectStrings(page.document.root.children ?? [], 'secondaryHref', hrefs);
      collectStrings(page.document.root.children ?? [], 'buttonHref', hrefs);
      for (const href of hrefs.filter((value) => value.startsWith('/'))) {
        expect(paths.has(href.split('#')[0] || '/')).toBe(true);
      }
    }
  });

  it.each(demoShowcases)('rend $name en mode démo sans action métier active', (showcase) => {
    const site = getDemoSite(showcase.slug)!;
    for (const page of site.pages) {
      const html = renderToStaticMarkup(createElement(DocumentRenderer, {
        document: page.document,
        context: { mode: 'demo', site, projectId: site.projectId, slug: site.slug },
      }));
      expect(html).toContain(`href="/demos/${site.slug}`);
      expect(html).not.toContain('href="/s/');
      expect(html).not.toContain('<form');
      const businessNodes = flatten(page.document.root.children ?? []).filter((node) => ['contactForm', 'reservation'].includes(node.type));
      if (businessNodes.length) {
        expect(html).toContain('data-demo-inactive="true"');
        expect(html).toContain('Mode démonstration.');
      }
    }
  });
});
