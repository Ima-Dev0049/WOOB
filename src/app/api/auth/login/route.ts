import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { attachAuthCookies, attachLocaleCookie, loginUser } from '@/server/auth';
import { rateLimit, requestIp } from '@/server/security/rate-limit';

export async function POST(request: Request) {
  return api(async () => {
    rateLimit(`${requestIp(request)}:login`, { max: 10, windowMs: 15 * 60_000 });
    const result = await loginUser(await request.json());
    const response = NextResponse.json({ user: { id: result.user.id, name: result.user.name, email: result.user.email } });
    attachAuthCookies(response, result.session.token, result.session.csrfToken);
    attachLocaleCookie(response, result.user.uiLocale === 'en' ? 'en' : 'fr');
    return noStore(response);
  });
}
