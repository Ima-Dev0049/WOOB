import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SitePage } from '@/components/renderer/SitePage';
import { getDemoSite } from '@/lib/demos/sites';
import { demoShowcases } from '@/lib/demos/showcases';

type DemoParams = Promise<{ slug: string; path?: string[] }>;

function pagePath(parts?: string[]): string {
  return parts?.length ? `/${parts.join('/')}` : '/';
}

export function generateStaticParams() {
  return demoShowcases.map((demo) => ({ slug: demo.slug }));
}

export async function generateMetadata({ params }: { params: DemoParams }): Promise<Metadata> {
  const { slug, path } = await params;
  const site = getDemoSite(slug);
  const currentPath = pagePath(path);
  const page = site?.pages.find((candidate) => candidate.path === currentPath);
  if (!site || !page) return { title: 'Démonstration introuvable · Woob', robots: { index: false, follow: false } };
  return {
    title: `${page.seoTitle} · Démo Woob`,
    description: page.seoDescription,
    alternates: { canonical: `/demos/${slug}${page.path === '/' ? '' : page.path}` },
    robots: { index: false, follow: true },
  };
}

export default async function DemoPage({ params }: { params: DemoParams }) {
  const { slug, path } = await params;
  const site = getDemoSite(slug);
  const currentPath = pagePath(path);
  if (!site || !site.pages.some((page) => page.path === currentPath)) notFound();
  return <>
    <div className="demo-notice-bar">
      <Link href="/#templates">← <span>Toutes les démos</span></Link>
      <p><strong>{site.name} · Démo Woob</strong><span>Contenu de démonstration · actions métier inactives</span></p>
      <Link href="/register">Créer mon espace de gestion <span aria-hidden="true">→</span></Link>
    </div>
    <SitePage site={site} path={currentPath} mode="demo" />
  </>;
}
