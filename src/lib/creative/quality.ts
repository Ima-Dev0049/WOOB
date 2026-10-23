import { auditThemeContrast, contrastRatio, getDesignSystem } from '@/lib/document/design-system';
import type { PageDocument, PageNode } from '@/lib/document/types';
import type { CreativeDirectionResult, CreativeQualityIssue, CreativeQualityReport } from './types';

function visit(node: PageNode, callback: (node: PageNode) => void): void {
  callback(node);
  node.children?.forEach((child) => visit(child, callback));
}

/** Structural signals only. This function never claims screenshot, browser or human visual inspection. */
export function evaluateCreativeQuality(documents: PageDocument[], directions?: CreativeDirectionResult): CreativeQualityReport {
  const issues: CreativeQualityIssue[] = [];
  const contrasts = documents.flatMap((document) => {
    const design = getDesignSystem(document.theme);
    const colors = design.colorMode === 'dark' ? design.tokens.darkColors : design.tokens.colors;
    return [
      ...auditThemeContrast(document.theme).map((item) => ({ ...item, id: `${document.pageId}-${item.id}` })),
      { id: `${document.pageId}-cta-eyebrow`, label: `${document.metadata.path} · surtitre de l’appel à l’action`, ratio: contrastRatio('#FFFFFF', colors.secondary) },
    ];
  });
  const ratios = contrasts.map((item) => item.ratio).filter((ratio): ratio is number => ratio !== null);
  const minimumContrast = ratios.length ? Math.min(...ratios) : null;
  for (const item of contrasts) {
    if (item.ratio !== null && item.ratio < 4.5) issues.push({ id: `contrast-${item.id}`, severity: 'error', message: `${item.label} : ${item.ratio.toFixed(2)}:1, sous le seuil structurel de 4,5:1.` });
  }
  let motionNodes = 0;
  let heroLayout: CreativeQualityReport['metrics']['heroLayout'] = 'none';
  for (const document of documents) {
    visit(document.root, (node) => {
      if (node.motion) motionNodes += 1;
      if (heroLayout === 'none' && node.type === 'hero' && typeof node.props.layout === 'string') heroLayout = node.props.layout as CreativeQualityReport['metrics']['heroLayout'];
    });
    if (!document.metadata.description.trim()) issues.push({ id: `description-${document.pageId}`, severity: 'warning', message: `La page ${document.metadata.path} n’a pas de description SEO.` });
  }
  if (motionNodes > documents.length * 4) issues.push({ id: 'motion-budget', severity: 'warning', message: 'Le budget d’entrées animées dépasse quatre nœuds par page.' });
  const responsiveRules = documents.every((document) => {
    const { breakpoints } = getDesignSystem(document.theme).tokens;
    return breakpoints.mobile < breakpoints.tablet;
  });
  if (!responsiveRules) issues.push({ id: 'responsive-breakpoints', severity: 'error', message: 'Les points de rupture responsive sont incohérents.' });
  const genericPatterns: string[] = [];
  if (directions) {
    if (directions.diversity.uniqueCompositions < directions.candidates.length) genericPatterns.push('compositions-dupliquees');
    if (directions.diversity.uniquePalettes < 2) genericPatterns.push('palettes-interchangeables');
    if (directions.diversity.score < 80) issues.push({ id: 'creative-diversity', severity: 'warning', message: `Diversité des concepts limitée (${directions.diversity.score}/100).` });
  }
  if (documents.some((document) => !document.theme.creativeDirection)) issues.push({ id: 'direction-missing', severity: 'info', message: 'Certaines pages utilisent encore le thème historique sans direction créative.' });
  const score = Math.max(0, 100 - issues.reduce((total, issue) => total + (issue.severity === 'error' ? 25 : issue.severity === 'warning' ? 8 : 0), 0));
  return {
    scope: 'document-model', score, visualInspection: false,
    metrics: { minimumContrast, motionNodes, responsiveRules, creativeDiversity: directions?.diversity.score ?? null, pageCount: documents.length, heroLayout, genericPatterns },
    issues,
  };
}
