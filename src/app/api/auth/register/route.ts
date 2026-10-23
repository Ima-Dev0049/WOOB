import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { attachAuthCookies, attachLocaleCookie, registerUser } from '@/server/auth';
import { rateLimit, requestIp } from '@/server/security/rate-limit';

export async function POST(request: Request) {
  return api(async () => {
    rateLimit(`${requestIp(request)}:register`, { max: 8, windowMs: 3600_000 });
    const result = await registerUser(await request.json());
    const response = NextResponse.json({ user: { id: result.user.id, name: result.user.name, email: result.user.email }, workspace: result.workspace }, { status: 201 });
    attachAuthCookies(response, result.session.token, result.session.csrfToken);
    attachLocaleCookie(response, 'fr');
    return noStore(response);
  });
}
