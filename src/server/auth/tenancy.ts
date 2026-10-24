import { and, eq, isNull, ne } from 'drizzle-orm';
import { getDb, type Db } from '@/server/db';
import { projects, workspaceMembers, workspaces } from '@/server/db/schema';
import type { Project } from '@/server/db/schema';
import { ApiError } from '@/server/http';

export const ROLE_PERMISSIONS = {
  owner: ['read', 'edit', 'publish', 'delete', 'billing', 'members', 'domains'],
  admin: ['read', 'edit', 'publish', 'delete', 'members', 'domains'],
  editor: ['read', 'edit', 'publish'],
  contributor: ['read', 'edit'],
  viewer: ['read'],
} as const;

export type Permission = (typeof ROLE_PERMISSIONS.owner)[number];

export async function requireMembership(userId: string, workspaceId: string, permission: Permission = 'read', db?: Db) {
  const database = db ?? await getDb();
  const member = (await database.select({ member: workspaceMembers }).from(workspaceMembers)
    .innerJoin(workspaces, and(eq(workspaces.id, workspaceMembers.workspaceId), eq(workspaces.status, 'active')))
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId), eq(workspaceMembers.status, 'active')))
    .limit(1))[0]?.member;
  if (!member) throw new ApiError(404, 'WORKSPACE_NOT_FOUND', 'Espace de travail introuvable.');
  const role = member.role as keyof typeof ROLE_PERMISSIONS;
  const permissions: readonly string[] = ROLE_PERMISSIONS[role] || [];
  if (!permissions.includes(permission)) throw new ApiError(403, 'PERMISSION_DENIED', 'Votre rôle ne permet pas cette action.');
  return member;
}

export async function requireProjectAccess(userId: string, projectId: string, permission: Permission = 'read', db?: Db) {
  const database = db ?? await getDb();
  const project = (await database.select().from(projects).where(and(eq(projects.id, projectId), isNull(projects.deletedAt), ne(projects.status, 'suspended'))).limit(1))[0];
  if (!project) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Projet introuvable.');
  const member = await requireMembership(userId, project.workspaceId, permission, database);
  return { project, member };
}

export async function requireProject(userId: string, projectId: string, permission: Permission = 'read', db?: Db): Promise<Project> {
  return (await requireProjectAccess(userId, projectId, permission, db)).project;
}
