import { eq } from 'drizzle-orm';
import { getDb, type Db } from '@/server/db';
import { users } from '@/server/db/schema';
import type { User } from '@/server/db/schema';
import { ApiError } from '@/server/http';

type AdminIdentity = Pick<User, 'normalizedEmail' | 'platformRole' | 'status'>;

function configuredAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function isPlatformAdmin(user: AdminIdentity): boolean {
  if (user.status !== 'active') return false;
  return user.platformRole === 'admin' || configuredAdminEmails().includes(user.normalizedEmail.toLowerCase());
}

export async function requirePlatformAdmin(userId: string, db?: Db): Promise<User> {
  const database = db ?? await getDb();
  const user = (await database.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user || !isPlatformAdmin(user)) throw new ApiError(403, 'PLATFORM_ADMIN_REQUIRED', 'Cette zone est réservée aux administrateurs de la plateforme.');
  return user;
}
