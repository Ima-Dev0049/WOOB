import type { SiteSnapshot } from '@/lib/document/types';
import { themeCssVariables, themeGlobalCss } from '@/lib/document/design-system';
import { DocumentRenderer, type RenderMode } from './DocumentRenderer';

export function SitePage({ site, path, mode = 'public' }: { site: SiteSnapshot; path: string; mode?: RenderMode }) {
  const page = site.pages.find((candidate) => candidate.path === path);
  if (!page) return null;
  // Page themes are synchronized globally at save time; using the validated page copy also keeps old snapshots renderable.
  const theme = page.document.theme;
  return <main className="published-site woob-theme" style={themeCssVariables(theme) as React.CSSProperties} lang={site.defaultLocale}>
    <style>{themeGlobalCss(theme)}</style>
    <DocumentRenderer document={page.document} context={{ mode, site, projectId: site.projectId, slug: site.slug }} />
  </main>;
}
