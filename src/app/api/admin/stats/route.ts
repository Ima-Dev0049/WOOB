import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { api, noStore } from '@/server/http';
import { rateLimit } from '@/server/security/rate-limit';
import { getAdminDashboard } from '@/server/services/admin';

export async function GET() {
  return api(async () => {
    const auth = await requireUser();
    rateLimit(`admin:stats:${auth.user.id}`);
    const data = await getAdminDashboard(auth.user.id);
    return noStore(NextResponse.json(data));
  });
}
