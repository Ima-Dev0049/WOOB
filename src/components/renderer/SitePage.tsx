import type { SiteSnapshot } from '@/lib/document/types';
import { DocumentRenderer, type RenderMode } from './DocumentRenderer';

export function SitePage({ site, path, mode = 'public' }: { site: SiteSnapshot; path: string; mode?: RenderMode }) {
  const page = site.pages.find((candidate) => candidate.path === path);
  if (!page) return null;
  const theme = site.theme;
  const variables = {
    '--site-primary': theme.primaryColor,
    '--site-secondary': theme.secondaryColor,
    '--site-accent': theme.accentColor,
    '--site-bg': theme.backgroundColor,
    '--site-surface': theme.surfaceColor,
    '--site-text': theme.textColor,
    '--site-muted': theme.mutedTextColor,
    '--site-font': theme.fontFamily,
    '--site-heading-font': theme.headingFontFamily,
    '--site-radius': `${theme.radius}px`,
    '--site-container': `${theme.containerWidth}px`,
    '--site-section-spacing': `${theme.sectionSpacing}px`,
  } as React.CSSProperties;
  return <main className="published-site" style={variables} lang={site.defaultLocale}><DocumentRenderer document={page.document} context={{ mode, site, projectId: site.projectId, slug: site.slug }} /></main>;
}
