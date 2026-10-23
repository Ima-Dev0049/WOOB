import { evaluateCreativeQuality } from '@/lib/creative/quality';
import type { SiteSnapshot } from '@/lib/document/types';
import { collectAssetIds, walkNodes } from '@/lib/document/validation';

export const PAGE_ASSET_WARNING_BYTES = 1_500_000;
export const PAGE_ASSET_ERROR_BYTES = 5_000_000;

export interface PublicationPreflightIssue {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface PublicationPreflightReport {
  scope: 'structural-and-managed-assets';
  status: 'pass' | 'warnings' | 'blocked';
  visualInspection: false;
  issues: PublicationPreflightIssue[];
  metrics: {
    pageCount: number;
    minimumContrast: number | null;
    motionNodes: number;
    scene3dPages: number;
    managedAssetCount: number;
    managedAssetBytes: number;
    maxPageAssetBytes: number;
  };
  budgets: { pageAssetWarningBytes: number; pageAssetErrorBytes: number; assetScope: 'managed-only' };
  pages: { id: string; path: string; assetCount: number; assetBytes: number; motionNodes: number; scene3dCount: number }[];
}

export type PublicationAssetFacts = { id: string; byteSize: number; fileName: string };

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} Mo`;
}

/** Deterministic preflight only: no Lighthouse, LCP, screenshot or network-performance claim. */
export function buildPublicationPreflight(snapshot: SiteSnapshot, assetFacts: PublicationAssetFacts[]): PublicationPreflightReport {
  const structural = evaluateCreativeQuality(snapshot.pages.map((page) => page.document), undefined, snapshot.creativeBrief);
  const assetsById = new Map(assetFacts.map((asset) => [asset.id, asset]));
  const referencedIds = new Set<string>();
  const pages = snapshot.pages.map((page) => {
    const ids = collectAssetIds(page.document);
    let motionNodes = 0;
    let scene3dCount = 0;
    let hasProducts = false;
    walkNodes(page.document.root, (node) => {
      if (node.motion) motionNodes += 1;
      if (node.type === 'scene3d') scene3dCount += 1;
      if (node.type === 'products') hasProducts = true;
    });
    if (hasProducts) for (const product of snapshot.products) if (product.imageAssetId) ids.add(product.imageAssetId);
    for (const id of ids) referencedIds.add(id);
    const assetBytes = [...ids].reduce((total, id) => total + (assetsById.get(id)?.byteSize ?? 0), 0);
    return { id: page.id, path: page.path, assetCount: ids.size, assetBytes, motionNodes, scene3dCount };
  });
  // Keep the same publication asset scope as the existing visibility update.
  for (const product of snapshot.products) if (product.imageAssetId) referencedIds.add(product.imageAssetId);
  const issues: PublicationPreflightIssue[] = [...structural.issues];
  for (const id of [...referencedIds].sort()) {
    if (!assetsById.has(id)) issues.push({ id: `missing-asset-${id}`, severity: 'error', message: `Un média référencé est introuvable ou supprimé (${id}).` });
  }
  for (const page of pages) {
    if (page.assetBytes > PAGE_ASSET_ERROR_BYTES) {
      issues.push({ id: `asset-budget-${page.id}`, severity: 'error', message: `${page.path} référence ${formatMegabytes(page.assetBytes)} de médias managés, au-delà du maximum de ${formatMegabytes(PAGE_ASSET_ERROR_BYTES)} par page.` });
    } else if (page.assetBytes > PAGE_ASSET_WARNING_BYTES) {
      issues.push({ id: `asset-budget-${page.id}`, severity: 'warning', message: `${page.path} référence ${formatMegabytes(page.assetBytes)} de médias managés. Le seuil d’alerte est de ${formatMegabytes(PAGE_ASSET_WARNING_BYTES)} par page.` });
    }
  }
  const managedAssetBytes = assetFacts.reduce((total, asset) => total + asset.byteSize, 0);
  const status = issues.some((issue) => issue.severity === 'error') ? 'blocked' : issues.some((issue) => issue.severity === 'warning') ? 'warnings' : 'pass';
  return {
    scope: 'structural-and-managed-assets', status, visualInspection: false, issues,
    metrics: {
      pageCount: pages.length,
      minimumContrast: structural.metrics.minimumContrast,
      motionNodes: structural.metrics.motionNodes,
      scene3dPages: pages.filter((page) => page.scene3dCount > 0).length,
      managedAssetCount: assetFacts.length,
      managedAssetBytes,
      maxPageAssetBytes: Math.max(0, ...pages.map((page) => page.assetBytes)),
    },
    budgets: { pageAssetWarningBytes: PAGE_ASSET_WARNING_BYTES, pageAssetErrorBytes: PAGE_ASSET_ERROR_BYTES, assetScope: 'managed-only' },
    pages,
  };
}
