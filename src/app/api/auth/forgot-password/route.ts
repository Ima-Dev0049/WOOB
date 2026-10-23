import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { requestPasswordReset } from '@/server/auth';
import { rateLimit, requestIp } from '@/server/security/rate-limit';

export async function POST(request: Request) {
  return api(async () => {
    rateLimit(`${requestIp(request)}:forgot`, { max: 5, windowMs: 3600_000 });
    const body = await request.json() as { email?: string };
    if (body.email) await requestPasswordReset(body.email);
    return noStore(NextResponse.json({ ok: true, message: 'Si un compte correspond, un lien de récupération a été préparé.' }));
  });
}
