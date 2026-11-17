import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { rateLimit, requestIp } from '@/server/security/rate-limit';
import { attachSiteCookies, loginSiteUser } from '@/server/services/site-identity';

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  return api(async () => {
    const { slug } = await context.params;
    rateLimit(`${requestIp(request)}:site-login:${slug}`, { max: 10, windowMs: 900_000 });
    const result = await loginSiteUser(slug, await request.json());
    const response = NextResponse.json({
      siteUser: { id: result.siteUser.id, name: result.siteUser.name, email: result.siteUser.email },
      project: { name: result.project.name, slug: result.project.slug },
    });
    attachSiteCookies(response, result.session.token, result.session.csrfToken);
    return noStore(response);
  });
}
