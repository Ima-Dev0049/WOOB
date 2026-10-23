import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedSite } from '@/server/services/publishing';
import { SitePage } from '@/components/renderer/SitePage';

async function getSite(slug: string) { return getPublishedSite(slug); }
function pagePath(parts?: string[]): string { return parts?.length ? `/${parts.join('/')}` : '/'; }

export async function generateMetadata({ params }: { params: Promise<{ slug: string; path?: string[] }> }): Promise<Metadata> {
  const { slug, path } = await params;
  const site = await getSite(slug);
  const page = site?.pages.find((candidate) => candidate.path === pagePath(path));
  if (!site || !page) return { title: 'Site introuvable' };
  return { title: page.seoTitle || page.name, description: page.seoDescription || site.description, alternates: { canonical: `/s/${slug}${page.path === '/' ? '' : page.path}` }, robots: { index: true, follow: true } };
}

export default async function PublishedPage({ params }: { params: Promise<{ slug: string; path?: string[] }> }) {
  const { slug, path } = await params;
  const site = await getSite(slug);
  const currentPath = pagePath(path);
  if (!site || !site.pages.some((page) => page.path === currentPath)) notFound();
  return <SitePage site={site} path={currentPath} />;
}
