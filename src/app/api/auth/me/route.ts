import { NextResponse } from 'next/server';
import { api, ApiError, noStore } from '@/server/http';
import { assertCsrf, attachLocaleCookie, getUserWorkspaces, requireUser } from '@/server/auth';
import { getDb } from '@/server/db';
import { users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { User } from '@/server/db/schema';

function publicUser(user: User) {
  return { id: user.id, name: user.name, email: user.email, uiLocale: user.uiLocale, timezone: user.timezone };
}

export async function GET() {
  return api(async () => {
    const auth = await requireUser();
    const workspaces = await getUserWorkspaces(auth.user.id);
    return noStore(NextResponse.json({ user: publicUser(auth.user), workspaces }));
  });
}

export async function PATCH(request: Request) {
  return api(async () => {
    const auth = await requireUser();
    await assertCsrf(request);
    const input = z.object({ name: z.string().trim().min(2).max(100), uiLocale: z.enum(['fr', 'en']), timezone: z.string().min(1).max(80) }).parse(await request.json());
    const db = await getDb();
    const updated = (await db.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, auth.user.id)).returning())[0];
    if (!updated) throw new ApiError(404, 'USER_NOT_FOUND', 'Compte utilisateur introuvable.');
    const response = NextResponse.json({ user: publicUser(updated) });
    attachLocaleCookie(response, input.uiLocale);
    return noStore(response);
  });
}
