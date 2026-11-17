import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { rateLimit, requestIp } from '@/server/security/rate-limit';
import { attachSiteCookies, registerSiteUser } from '@/server/services/site-identity';

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  return api(async () => {
    const { slug } = await context.params;
    rateLimit(`${requestIp(request)}:site-register:${slug}`, { max: 8, windowMs: 3600_000 });
    const result = await registerSiteUser(slug, await request.json());
    const response = NextResponse.json({
      siteUser: { id: result.siteUser.id, name: result.siteUser.name, email: result.siteUser.email },
      project: { name: result.project.name, slug: result.project.slug },
    }, { status: 201 });
    attachSiteCookies(response, result.session.token, result.session.csrfToken);
    return noStore(response);
  });
}
