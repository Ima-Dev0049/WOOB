import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, type Db } from '@/server/db';
import { users, workspaceMembers, workspaces } from '@/server/db/schema';
import { ApiError } from '@/server/http';
import { requireMembership } from '@/server/auth/tenancy';

const assignableRole = z.enum(['admin', 'editor', 'contributor', 'viewer']);
type AssignableRole = z.infer<typeof assignableRole>;
type MemberRow = typeof workspaceMembers.$inferSelect;
function assertHierarchy(actorRole: string, target: Pick<MemberRow, 'role'> | undefined, nextRole: AssignableRole, ownerId: string, targetUserId?: string) {
  if (targetUserId === ownerId || target?.role === 'owner') throw new ApiError(403, 'OWNER_PROTECTED', 'Le propriétaire ne peut pas être modifié depuis cette interface.');
  if (actorRole === 'admin' && (target?.role === 'admin' || nextRole === 'admin')) throw new ApiError(403, 'ADMIN_HIERARCHY', 'Un administrateur ne peut pas gérer un autre administrateur ni attribuer ce rôle.');
}

export async function listMembers(userId: string, workspaceId: string, db?: Db) {
  const database = db ?? await getDb();
  await requireMembership(userId, workspaceId, 'read', database);
  const workspace = (await database.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1))[0];
  if (!workspace) throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Espace introuvable.');
  const rows = await database.select({ member: workspaceMembers, user: { id: users.id, name: users.name, email: users.email } }).from(workspaceMembers).innerJoin(users, eq(workspaceMembers.userId, users.id)).where(eq(workspaceMembers.workspaceId, workspaceId)).orderBy(asc(workspaceMembers.createdAt));
  return { ownerId: workspace.ownerId, members: rows.map((row) => ({ ...row.member, user: row.user })) };
}

export async function addExistingMember(actorId: string, workspaceId: string, input: unknown, db?: Db) {
  const data = z.object({ email: z.string().trim().email().max(240), role: assignableRole }).parse(input);
  const database = db ?? await getDb();
  const actor = await requireMembership(actorId, workspaceId, 'members', database);
  const workspace = (await database.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1))[0];
  if (!workspace) throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Espace introuvable.');
  const user = (await database.select().from(users).where(and(eq(users.normalizedEmail, data.email.toLowerCase()), eq(users.status, 'active'))).limit(1))[0];
  if (!user) throw new ApiError(422, 'EXISTING_ACCOUNT_REQUIRED', 'Aucun compte actif ne correspond à cet email. L’invitation de nouveaux comptes par email n’est pas configurée.');
  const existing = (await database.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id))).limit(1))[0];
  assertHierarchy(actor.role, existing, data.role, workspace.ownerId, user.id);
  if (existing?.status === 'active') throw new ApiError(409, 'MEMBER_EXISTS', 'Ce compte est déjà membre de l’espace.');
  if (existing) {
    await database.update(workspaceMembers).set({ role: data.role, status: 'active' }).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)));
  } else {
    await database.insert(workspaceMembers).values({ workspaceId, userId: user.id, role: data.role, status: 'active' });
  }
  return { userId: user.id, role: data.role, status: 'active' };
}

export async function updateMemberRole(actorId: string, workspaceId: string, targetUserId: string, input: unknown, db?: Db) {
  const role = assignableRole.parse(input);
  const database = db ?? await getDb();
  const actor = await requireMembership(actorId, workspaceId, 'members', database);
  const workspace = (await database.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1))[0];
  const target = (await database.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, targetUserId))).limit(1))[0];
  if (!workspace || !target) throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Membre introuvable.');
  assertHierarchy(actor.role, target, role, workspace.ownerId, targetUserId);
  await database.update(workspaceMembers).set({ role }).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, targetUserId)));
}

export async function suspendMember(actorId: string, workspaceId: string, targetUserId: string, db?: Db) {
  const database = db ?? await getDb();
  const actor = await requireMembership(actorId, workspaceId, 'members', database);
  const workspace = (await database.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1))[0];
  const target = (await database.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, targetUserId))).limit(1))[0];
  if (!workspace || !target) throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Membre introuvable.');
  assertHierarchy(actor.role, target, 'viewer', workspace.ownerId, targetUserId);
  await database.update(workspaceMembers).set({ status: 'suspended' }).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, targetUserId)));
}
