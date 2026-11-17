import { notFound } from 'next/navigation';
import { SitePortalExperience } from '@/components/portal/SitePortalExperience';
import { ApiError } from '@/server/http';
import { getSiteSession } from '@/server/services/site-identity';
import { getSitePortal, listSiteRequests } from '@/server/services/site-portal';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Espace du site' };

export default async function SitePortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let portal;
  try {
    portal = await getSitePortal(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const session = await getSiteSession(slug);
  const requests = session ? await listSiteRequests(slug, session.siteUser) : null;
  return <SitePortalExperience
    key={session?.siteUser.id ?? 'anonymous'}
    portal={portal}
    viewer={session ? { name: session.siteUser.name, email: session.siteUser.email } : null}
    initialRequests={requests}
  />;
}
