import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertSiteCsrf, clearSiteCookies, getSiteSession, logoutSiteUser } from '@/server/services/site-identity';

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  return api(async () => {
    const { slug } = await context.params;
    const session = await getSiteSession(slug);
    if (session) {
      await assertSiteCsrf(request, session);
      await logoutSiteUser();
    }
    const response = NextResponse.json({ ok: true });
    clearSiteCookies(response);
    return noStore(response);
  });
}
