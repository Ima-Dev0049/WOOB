import { NextResponse } from 'next/server';
import { api, noStore } from '@/server/http';
import { assertCsrf, clearAuthCookies, logoutUser } from '@/server/auth';

export async function POST(request: Request) {
  return api(async () => {
    await assertCsrf(request);
    await logoutUser();
    const response = NextResponse.json({ ok: true });
    clearAuthCookies(response);
    return noStore(response);
  });
}
