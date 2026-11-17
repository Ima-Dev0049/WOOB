import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { rateLimit, requestIp } from '@/server/security/rate-limit';
import { assertSiteCsrf, requireSiteSession } from '@/server/services/site-identity';
import { listSiteRequests, submitSiteRequest } from '@/server/services/site-portal';

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  return api(async () => {
    const { slug } = await context.params;
    const session = await requireSiteSession(slug);
    return noStore(NextResponse.json(await listSiteRequests(slug, session.siteUser)));
  });
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  return api(async () => {
    const { slug } = await context.params;
    const session = await requireSiteSession(slug);
    await assertSiteCsrf(request, session);
    rateLimit(`${requestIp(request)}:site-request:${slug}`, { max: 12, windowMs: 3600_000 });
    const result = await submitSiteRequest(slug, session.siteUser, await request.json());
    return noStore(NextResponse.json({ request: result }, { status: 201 }));
  });
}
