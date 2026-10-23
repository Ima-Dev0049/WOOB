import { describe, expect, it } from 'vitest';
import { defaultHomeDocument, makeNode } from '@/lib/document/factory';
import { getDesignSystem, withDesignSystem } from '@/lib/document/design-system';
import type { SiteSnapshot } from '@/lib/document/types';
import { buildPublicationPreflight, PAGE_ASSET_ERROR_BYTES, PAGE_ASSET_WARNING_BYTES } from '@/lib/publication/preflight';

function snapshotFixture(): SiteSnapshot {
  const pageId = 'page-preflight';
  const document = defaultHomeDocument(pageId);
  document.metadata.description = 'Description structurée suffisante pour le préflight.';
  return {
    projectId: 'project-preflight', publicationId: 'publication-preflight', publishedAt: new Date(0).toISOString(),
    name: 'Préflight', description: '', slug: 'preflight', defaultLocale: 'fr', theme: document.theme,
    pages: [{ id: pageId, path: '/', name: 'Accueil', seoTitle: 'Accueil', seoDescription: document.metadata.description, document }],
    navigation: [{ label: 'Accueil', path: '/' }], modules: [], products: [], posts: [],
  };
}

describe('préflight de publication déterministe', () => {
  it('accepte le document par défaut documenté et mesure un contraste accessible', () => {
    const report = buildPublicationPreflight(snapshotFixture(), []);
    expect(report.status).toBe('pass');
    expect(report.metrics.minimumContrast).toBeGreaterThanOrEqual(4.5);
    expect(report.issues.filter((issue) => issue.severity !== 'info')).toEqual([]);
    expect(report.metrics.maxPageAssetBytes).toBe(0);
  });

  it('applique les seuils de poids sans arrondi et bloque un média manquant', () => {
    const snapshot = snapshotFixture();
    const assetId = '00000000-0000-4000-8000-000000000001';
    const hero = snapshot.pages[0]!.document.root.children!.find((node) => node.type === 'hero')!;
    hero.props.imageAssetId = assetId;
    const atWarningBoundary = buildPublicationPreflight(snapshot, [{ id: assetId, fileName: 'hero.webp', byteSize: PAGE_ASSET_WARNING_BYTES }]);
    expect(atWarningBoundary.status).toBe('pass');
    const warning = buildPublicationPreflight(snapshot, [{ id: assetId, fileName: 'hero.webp', byteSize: PAGE_ASSET_WARNING_BYTES + 1 }]);
    expect(warning.status).toBe('warnings');
    expect(warning.issues.find((issue) => issue.id === `asset-budget-${snapshot.pages[0]!.id}`)?.severity).toBe('warning');
    const atErrorBoundary = buildPublicationPreflight(snapshot, [{ id: assetId, fileName: 'hero.webp', byteSize: PAGE_ASSET_ERROR_BYTES }]);
    expect(atErrorBoundary.status).toBe('warnings');
    const blocked = buildPublicationPreflight(snapshot, [{ id: assetId, fileName: 'hero.webp', byteSize: PAGE_ASSET_ERROR_BYTES + 1 }]);
    expect(blocked.status).toBe('blocked');
    const missing = buildPublicationPreflight(snapshot, []);
    expect(missing.status).toBe('blocked');
    expect(missing.issues.some((issue) => issue.id === `missing-asset-${assetId}`)).toBe(true);
  });

  it('compte les images produits sur une page catalogue, sans les attribuer aux autres pages', () => {
    const assetId = '00000000-0000-4000-8000-000000000002';
    const snapshot = snapshotFixture();
    snapshot.products = [{ id: 'product-1', name: 'Produit', slug: 'produit', description: '', priceCents: 1000, currency: 'EUR', inventory: null, imageAssetId: assetId }];
    const facts = [{ id: assetId, fileName: 'produit.webp', byteSize: PAGE_ASSET_WARNING_BYTES + 1 }];
    const hidden = buildPublicationPreflight(snapshot, facts);
    expect(hidden.status).toBe('pass');
    expect(hidden.metrics.managedAssetBytes).toBe(PAGE_ASSET_WARNING_BYTES + 1);
    expect(hidden.pages[0]!.assetBytes).toBe(0);
    snapshot.pages[0]!.document.root.children!.push(makeNode('products'));
    const visible = buildPublicationPreflight(snapshot, facts);
    expect(visible.status).toBe('warnings');
    expect(visible.pages[0]!.assetBytes).toBe(PAGE_ASSET_WARNING_BYTES + 1);
  });

  it('réutilise les erreurs de contraste et les avertissements SEO du contrôle structurel', () => {
    const snapshot = snapshotFixture();
    const document = snapshot.pages[0]!.document;
    document.metadata.description = '';
    expect(buildPublicationPreflight(snapshot, []).status).toBe('warnings');
    const design = getDesignSystem(document.theme);
    design.tokens.colors.link = design.tokens.colors.background;
    document.theme = withDesignSystem(document.theme, design);
    snapshot.theme = document.theme;
    const report = buildPublicationPreflight(snapshot, []);
    expect(report.status).toBe('blocked');
    expect(report.issues.some((issue) => issue.id.startsWith('contrast-') && issue.severity === 'error')).toBe(true);
  });
});
