import { and, eq, gt, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { createId } from '@/lib/id';
import { slugify, absoluteAppUrl } from '@/lib/utils';
import { getDb, type Db } from '@/server/db';
import { authTokens, sessions, subscriptions, users, workspaceMembers, workspaces, plans } from '@/server/db/schema';
import type { User, Workspace } from '@/server/db/schema';
import { seedPlans } from '@/server/db/seed';
import { ApiError } from '@/server/http';
import { createToken, hashPassword, hashToken, safeEqual, verifyPassword } from '@/server/security/crypto';
import { sendEmail } from '@/server/mailer';
import { z } from 'zod';
import type { UiLocale } from '@/lib/i18n';
import { UI_LOCALE_COOKIE } from '@/server/locale';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(240),
  password: z.string().min(12).max(200),
  workspaceName: z.union([z.string().trim().min(2).max(100), z.literal('')]).optional(),
});
export const loginSchema = z.object({ email: z.string().trim().email().max(240), password: z.string().min(1).max(200) });
export type AuthContext = { user: User; sessionId: string; csrfToken: string | undefined };

function sessionCookieName(): string { return process.env.SESSION_COOKIE_NAME || 'woob_session'; }
function secureCookie(): boolean { return process.env.APP_ENV === 'production' || (process.env.APP_URL || '').startsWith('https://'); }

export function attachAuthCookies(response: NextResponse, token: string, csrfToken: string): void {
  const maxAge = Number(process.env.SESSION_TTL_DAYS || 14) * 86400;
  response.cookies.set(sessionCookieName(), token, { httpOnly: true, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge });
  response.cookies.set('woob_csrf', csrfToken, { httpOnly: false, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge });
}

export function attachLocaleCookie(response: NextResponse, locale: UiLocale): void {
  response.cookies.set(UI_LOCALE_COOKIE, locale, { httpOnly: true, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge: 365 * 86400 });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(sessionCookieName(), '', { httpOnly: true, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge: 0 });
  response.cookies.set('woob_csrf', '', { httpOnly: false, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function createSession(userId: string, db: Db): Promise<{ token: string; csrfToken: string; expiresAt: Date }> {
  const token = createToken();
  const csrfToken = createToken();
  const expiresAt = new Date(Date.now() + Number(process.env.SESSION_TTL_DAYS || 14) * 86400_000);
  await db.insert(sessions).values({ id: createId('session'), userId, tokenHash: hashToken(token), expiresAt });
  return { token, csrfToken, expiresAt };
}

export async function registerUser(input: z.input<typeof registerSchema>, db?: Db) {
  const data = registerSchema.parse(input);
  const database = db ?? await getDb();
  await seedPlans(database);
  const normalizedEmail = data.email.toLowerCase();
  const existing = await database.select({ id: users.id }).from(users).where(eq(users.normalizedEmail, normalizedEmail)).limit(1);
  if (existing.length) throw new ApiError(409, 'EMAIL_IN_USE', 'Un compte utilise déjà cet email.');
  const userId = createId('user');
  const workspaceId = createId('workspace');
  const passwordHash = await hashPassword(data.password);
  const freePlan = (await database.select().from(plans).where(eq(plans.code, 'free')).limit(1))[0];
  if (!freePlan) throw new Error('Le plan gratuit n’est pas initialisé.');
  await database.transaction(async (tx) => {
    await tx.insert(users).values({ id: userId, email: data.email, normalizedEmail, name: data.name, passwordHash, emailVerifiedAt: process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === 'true' ? null : new Date() });
    await tx.insert(workspaces).values({ id: workspaceId, name: data.workspaceName || `Espace de ${data.name}`, slug: `${slugify(data.name)}-${userId.slice(0, 8)}`, ownerId: userId });
    await tx.insert(workspaceMembers).values({ workspaceId, userId, role: 'owner', status: 'active' });
    await tx.insert(subscriptions).values({ id: createId('subscription'), workspaceId, planId: freePlan.id, provider: 'local', status: 'active' });
  });
  if (process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === 'true') {
    const token = await createAuthToken(userId, 'verify_email', 24, database);
    await sendEmail({ to: data.email, subject: 'Vérifiez votre compte Woob', text: `Bienvenue sur Woob. Vérifiez votre email : ${absoluteAppUrl(`/verify-email?token=${token}`)}` });
  }
  const user = (await database.select().from(users).where(eq(users.id, userId)).limit(1))[0]!;
  const workspace = (await database.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1))[0]!;
  const session = await createSession(userId, database);
  return { user, workspace, session };
}

export async function loginUser(input: z.input<typeof loginSchema>, db?: Db) {
  const data = loginSchema.parse(input);
  const database = db ?? await getDb();
  const user = (await database.select().from(users).where(eq(users.normalizedEmail, data.email.toLowerCase())).limit(1))[0];
  if (!user || user.status !== 'active' || !(await verifyPassword(user.passwordHash, data.password))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect.');
  }
  if (process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === 'true' && !user.emailVerifiedAt) {
    throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Vérifiez votre email avant de vous connecter.');
  }
  const session = await createSession(user.id, database);
  return { user, session };
}

export async function getCurrentAuth(db?: Db): Promise<AuthContext | null> {
  const store = await cookies();
  const token = store.get(sessionCookieName())?.value;
  if (!token) return null;
  const database = db ?? await getDb();
  const rows = await database.select({ user: users, sessionId: sessions.id }).from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()), eq(users.status, 'active')))
    .limit(1);
  return rows[0] ? { user: rows[0].user, sessionId: rows[0].sessionId, csrfToken: store.get('woob_csrf')?.value } : null;
}

export async function requireUser(db?: Db): Promise<AuthContext> {
  const auth = await getCurrentAuth(db);
  if (!auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Connectez-vous pour continuer.');
  return auth;
}

export async function logoutUser(db?: Db): Promise<void> {
  const auth = await getCurrentAuth(db);
  if (auth) {
    const database = db ?? await getDb();
    await database.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, auth.sessionId));
  }
}

export async function assertCsrf(request: Request): Promise<void> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, 'ORIGIN_REJECTED', 'Origine de requête non autorisée.');
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieToken = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith('woob_csrf='))?.split('=')[1] || '';
  const headerToken = request.headers.get('x-csrf-token') || '';
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, decodeURIComponent(headerToken))) {
    throw new ApiError(403, 'CSRF_REJECTED', 'La session de sécurité a expiré. Rechargez la page.');
  }
}

async function createAuthToken(userId: string, kind: 'verify_email' | 'password_reset', hours: number, db: Db): Promise<string> {
  const token = createToken();
  await db.insert(authTokens).values({ id: createId('token'), userId, kind, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + hours * 3600_000) });
  return token;
}

export async function requestPasswordReset(emailInput: string, db?: Db): Promise<void> {
  const database = db ?? await getDb();
  const email = z.string().email().parse(emailInput).toLowerCase();
  const user = (await database.select().from(users).where(eq(users.normalizedEmail, email)).limit(1))[0];
  if (!user) return;
  const token = await createAuthToken(user.id, 'password_reset', 1, database);
  await sendEmail({ to: user.email, subject: 'Réinitialisation de votre mot de passe Woob', text: `Ce lien expire dans une heure : ${absoluteAppUrl(`/reset-password?token=${token}`)}` });
}

export async function resetPassword(token: string, passwordInput: string, db?: Db): Promise<void> {
  const password = z.string().min(12).max(200).parse(passwordInput);
  const database = db ?? await getDb();
  const record = (await database.select().from(authTokens).where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.kind, 'password_reset'), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date()))).limit(1))[0];
  if (!record) throw new ApiError(400, 'RESET_TOKEN_INVALID', 'Ce lien est invalide ou expiré.');
  const passwordHash = await hashPassword(password);
  await database.transaction(async (tx) => {
    const consumed = await tx.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.id, record.id), isNull(authTokens.usedAt))).returning();
    if (!consumed.length) throw new ApiError(400, 'RESET_TOKEN_INVALID', 'Ce lien est invalide ou expiré.');
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, record.userId));
    await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, record.userId), isNull(sessions.revokedAt)));
  });
}

export async function verifyEmail(token: string, db?: Db): Promise<void> {
  const database = db ?? await getDb();
  const record = (await database.select().from(authTokens).where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.kind, 'verify_email'), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date()))).limit(1))[0];
  if (!record) throw new ApiError(400, 'VERIFY_TOKEN_INVALID', 'Ce lien est invalide ou expiré.');
  await database.transaction(async (tx) => {
    const consumed = await tx.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.id, record.id), isNull(authTokens.usedAt))).returning();
    if (!consumed.length) throw new ApiError(400, 'VERIFY_TOKEN_INVALID', 'Ce lien est invalide ou expiré.');
    await tx.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, record.userId));
  });
}

export async function getUserWorkspaces(userId: string, db?: Db): Promise<Workspace[]> {
  const database = db ?? await getDb();
  return database.select({ workspace: workspaces }).from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.status, 'active'), eq(workspaces.status, 'active')))
    .then((rows) => rows.map((row) => row.workspace));
}

export async function getActiveWorkspace(userId: string, db?: Db): Promise<Workspace | undefined> {
  const available = await getUserWorkspaces(userId, db);
  const selected = (await cookies()).get('woob_workspace')?.value;
  return available.find((workspace) => workspace.id === selected) || available[0];
}
