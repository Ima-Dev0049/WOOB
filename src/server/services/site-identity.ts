import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { z } from 'zod';
import { createId } from '@/lib/id';
import { publicIntakeSettingsSchema } from '@/lib/application/intake';
import { getDb, type Db } from '@/server/db';
import { projects, siteSessions, siteUsers, type Project, type SiteUser } from '@/server/db/schema';
import { ApiError } from '@/server/http';
import { createToken, hashPassword, hashToken, safeEqual, verifyPassword } from '@/server/security/crypto';

export const SITE_SESSION_COOKIE = 'woob_site_session';
export const SITE_CSRF_COOKIE = 'woob_site_csrf';

export const siteRegisterSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(240),
  password: z.string().min(12).max(200),
});
export const siteLoginSchema = z.object({
  email: z.string().trim().email().max(240),
  password: z.string().min(1).max(200),
});

export type SiteAuthContext = { siteUser: SiteUser; project: Project; csrfTokenHash: string };

function secureCookie(): boolean {
  return process.env.APP_ENV === 'production' || (process.env.APP_URL || '').startsWith('https://');
}

function sessionTtlDays(): number {
  return Number(process.env.SITE_SESSION_TTL_DAYS || 7);
}

export function attachSiteCookies(response: NextResponse, token: string, csrfToken: string): void {
  const maxAge = sessionTtlDays() * 86400;
  response.cookies.set(SITE_SESSION_COOKIE, token, { httpOnly: true, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge });
  response.cookies.set(SITE_CSRF_COOKIE, csrfToken, { httpOnly: false, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge });
}

export function clearSiteCookies(response: NextResponse): void {
  response.cookies.set(SITE_SESSION_COOKIE, '', { httpOnly: true, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge: 0 });
  response.cookies.set(SITE_CSRF_COOKIE, '', { httpOnly: false, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge: 0 });
}

/** The portal is only open on an active, non-suspended project that enabled its intake. */
export async function siteProjectBySlug(slug: string, db: Db): Promise<Project> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) throw new ApiError(404, 'SITE_NOT_FOUND', 'Ce portail est introuvable.');
  const project = (await db.select().from(projects).where(and(
    eq(projects.slug, slug),
    isNull(projects.deletedAt),
    ne(projects.status, 'suspended'),
  )).limit(1))[0];
  const intake = project ? publicIntakeSettingsSchema.safeParse(project.publicIntake) : null;
  if (!project || !intake?.success || !intake.data.enabled) throw new ApiError(404, 'SITE_NOT_FOUND', 'Ce portail est introuvable ou fermé.');
  return project;
}

async function createSiteSession(siteUser: SiteUser, db: Db) {
  const token = createToken();
  const csrfToken = createToken();
  const expiresAt = new Date(Date.now() + sessionTtlDays() * 86400_000);
  await db.insert(siteSessions).values({
    id: createId('site-session'),
    siteUserId: siteUser.id,
    workspaceId: siteUser.workspaceId,
    projectId: siteUser.projectId,
    tokenHash: hashToken(token),
    csrfTokenHash: hashToken(csrfToken),
    expiresAt,
  });
  return { token, csrfToken, expiresAt };
}

/** Resolves one site session by token and slug; a Studio session is never accepted here. */
export async function resolveSiteSession(slug: string, token: string, db: Db): Promise<SiteAuthContext | null> {
  if (!token) return null;
  const rows = await db.select({ siteUser: siteUsers, project: projects, csrfTokenHash: siteSessions.csrfTokenHash })
    .from(siteSessions)
    .innerJoin(siteUsers, eq(siteSessions.siteUserId, siteUsers.id))
    .innerJoin(projects, and(eq(projects.id, siteSessions.projectId), eq(projects.workspaceId, siteSessions.workspaceId)))
    .where(and(
      eq(siteSessions.tokenHash, hashToken(token)),
      eq(projects.slug, slug),
      gt(siteSessions.expiresAt, new Date()),
      eq(siteUsers.status, 'active'),
      isNull(projects.deletedAt),
      ne(projects.status, 'suspended'),
    ))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { siteUser: row.siteUser, project: row.project, csrfTokenHash: row.csrfTokenHash };
}

export async function getSiteSession(slug: string, db?: Db): Promise<SiteAuthContext | null> {
  const database = db ?? await getDb();
  const store = await cookies();
  const token = store.get(SITE_SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveSiteSession(slug, token, database);
}

export async function requireSiteSession(slug: string, db?: Db): Promise<SiteAuthContext> {
  const session = await getSiteSession(slug, db);
  if (!session) throw new ApiError(401, 'SITE_UNAUTHENTICATED', 'Connectez-vous à l’espace de ce site pour continuer.');
  return session;
}

export async function registerSiteUser(slug: string, input: unknown, db?: Db) {
  const data = siteRegisterSchema.parse(input);
  const database = db ?? await getDb();
  const project = await siteProjectBySlug(slug, database);
  const normalizedEmail = data.email.toLowerCase();
  const existing = (await database.select({ id: siteUsers.id }).from(siteUsers).where(and(
    eq(siteUsers.projectId, project.id),
    eq(siteUsers.normalizedEmail, normalizedEmail),
  )).limit(1))[0];
  if (existing) throw new ApiError(409, 'SITE_EMAIL_IN_USE', 'Un compte de ce site utilise déjà cet email.');
  const siteUserId = createId('site-user');
  const inserted = (await database.insert(siteUsers).values({
    id: siteUserId,
    workspaceId: project.workspaceId,
    projectId: project.id,
    email: data.email,
    normalizedEmail,
    name: data.name,
    passwordHash: await hashPassword(data.password),
  }).returning())[0]!;
  return { siteUser: inserted, project, session: await createSiteSession(inserted, database) };
}

export async function loginSiteUser(slug: string, input: unknown, db?: Db) {
  const data = siteLoginSchema.parse(input);
  const database = db ?? await getDb();
  const project = await siteProjectBySlug(slug, database);
  const siteUser = (await database.select().from(siteUsers).where(and(
    eq(siteUsers.projectId, project.id),
    eq(siteUsers.normalizedEmail, data.email.toLowerCase()),
  )).limit(1))[0];
  if (!siteUser || siteUser.status !== 'active' || !(await verifyPassword(siteUser.passwordHash, data.password))) {
    throw new ApiError(401, 'SITE_INVALID_CREDENTIALS', 'Email ou mot de passe incorrect pour ce site.');
  }
  return { siteUser, project, session: await createSiteSession(siteUser, database) };
}

export async function logoutSiteUser(db?: Db): Promise<void> {
  const database = db ?? await getDb();
  const store = await cookies();
  const token = store.get(SITE_SESSION_COOKIE)?.value;
  if (token) await database.delete(siteSessions).where(eq(siteSessions.tokenHash, hashToken(token)));
}

/**
 * Binds the request to one site session: the header token must hash to the value stored with the
 * session, and a cross-origin browser request is rejected. The Studio CSRF cookie is ignored.
 */
export async function assertSiteCsrf(request: Request, session: SiteAuthContext): Promise<void> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, 'ORIGIN_REJECTED', 'Origine de requête non autorisée.');
  const headerToken = request.headers.get('x-csrf-token') || '';
  if (!headerToken || !safeEqual(hashToken(headerToken), session.csrfTokenHash)) {
    throw new ApiError(403, 'CSRF_REJECTED', 'La session de sécurité a expiré. Rechargez la page.');
  }
}
