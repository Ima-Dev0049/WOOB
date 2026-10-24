import { and, desc, eq, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@/lib/id';
import {
  applicationModelSchema,
  applicationRecordSchema,
  buildApplicationRoutes,
  initialRecordStatus,
  roleCan,
  roleCanAction,
  workspaceRoleSchema,
  type ApplicationModel,
  type ApplicationObject,
  type ApplicationOperation,
  type ApplicationRecordData,
  type WorkspaceRole,
} from '@/lib/application/model';
import { requireProjectAccess } from '@/server/auth/tenancy';
import { getDb, type Db } from '@/server/db';
import { applicationModels, applicationRecords, projects, type ApplicationModelRow, type ApplicationRecordRow } from '@/server/db/schema';
import { ApiError } from '@/server/http';

const listOptionsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(48).optional(),
  ids: z.array(z.string().uuid()).min(1).max(100).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(100_000).default(0),
});

type Access = Awaited<ReturnType<typeof requireProjectAccess>>;
type ModelContext = { access: Access; row: ApplicationModelRow; role: WorkspaceRole };
type ObjectContext = ModelContext & { object: ApplicationObject };

async function currentModel(projectId: string, db: Db): Promise<ApplicationModelRow | undefined> {
  return (await db.select().from(applicationModels).where(and(eq(applicationModels.projectId, projectId), eq(applicationModels.current, true))).orderBy(desc(applicationModels.version)).limit(1))[0];
}

async function contextFromAccess(access: Access, db: Db): Promise<ModelContext> {
  const row = await currentModel(access.project.id, db);
  if (!row) throw new ApiError(404, 'APPLICATION_MODEL_NOT_FOUND', 'Aucun modèle d’application n’est configuré pour ce projet.');
  const parsedRole = workspaceRoleSchema.safeParse(access.member.role);
  if (!parsedRole.success) throw new ApiError(403, 'APPLICATION_ROLE_INVALID', 'Le rôle workspace n’est pas reconnu par le moteur applicatif.');
  return { access, row, role: parsedRole.data };
}

async function readContext(userId: string, projectId: string, permission: 'read' | 'edit' | 'members', db: Db): Promise<ModelContext> {
  return contextFromAccess(await requireProjectAccess(userId, projectId, permission, db), db);
}

async function lockProject(access: Access, db: Db): Promise<void> {
  const locked = (await db.select({ id: projects.id }).from(projects).where(and(
    eq(projects.id, access.project.id), eq(projects.workspaceId, access.project.workspaceId), isNull(projects.deletedAt), ne(projects.status, 'suspended'),
  )).for('update').limit(1))[0];
  if (!locked) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Projet introuvable.');
}

function objectFrom(model: ApplicationModel, objectKey: string): ApplicationObject {
  const object = model.objects.find((candidate) => candidate.key === objectKey);
  if (!object) throw new ApiError(404, 'APPLICATION_OBJECT_NOT_FOUND', 'Cet objet n’existe pas dans le modèle actif.');
  return object;
}

async function objectContext(userId: string, projectId: string, objectKey: string, permission: 'read' | 'edit', db: Db): Promise<ObjectContext> {
  const context = await readContext(userId, projectId, permission, db);
  return { ...context, object: objectFrom(context.row.model, objectKey) };
}

async function lockedObjectContext(userId: string, projectId: string, objectKey: string, db: Db): Promise<ObjectContext> {
  const access = await requireProjectAccess(userId, projectId, 'edit', db);
  await lockProject(access, db);
  const context = await contextFromAccess(access, db);
  return { ...context, object: objectFrom(context.row.model, objectKey) };
}

function authorize(context: ObjectContext, operation: ApplicationOperation): void {
  if (!roleCan(context.row.model, context.role, context.object.key, operation)) throw new ApiError(403, 'APPLICATION_PERMISSION_DENIED', 'Votre rôle ne permet pas cette opération sur cet objet.');
}

function authorizeAction(context: ObjectContext, actionKey: string): void {
  if (!roleCanAction(context.row.model, context.role, context.object.key, actionKey)) throw new ApiError(403, 'APPLICATION_PERMISSION_DENIED', 'Votre rôle ne permet pas cette action sur cet objet.');
}

async function touchProject(context: ModelContext, db: Db): Promise<void> {
  await db.update(projects).set({ updatedAt: new Date() }).where(and(eq(projects.id, context.access.project.id), eq(projects.workspaceId, context.access.project.workspaceId)));
}

async function validateRelations(context: ObjectContext, data: ApplicationRecordData, db: Db): Promise<void> {
  for (const field of context.object.fields) {
    if (field.type !== 'relation' || typeof data[field.key] !== 'string') continue;
    const target = (await db.select({ id: applicationRecords.id }).from(applicationRecords).where(and(
      eq(applicationRecords.id, data[field.key] as string),
      eq(applicationRecords.projectId, context.access.project.id),
      eq(applicationRecords.workspaceId, context.access.project.workspaceId),
      eq(applicationRecords.objectKey, field.targetObject!),
    )).limit(1))[0];
    if (!target) throw new ApiError(422, 'APPLICATION_RELATION_INVALID', `La relation « ${field.label} » ne désigne pas un enregistrement valide de ce projet.`);
  }
}

async function recordFrom(context: ObjectContext, recordId: string, db: Db): Promise<ApplicationRecordRow> {
  const record = (await db.select().from(applicationRecords).where(and(
    eq(applicationRecords.id, recordId),
    eq(applicationRecords.projectId, context.access.project.id),
    eq(applicationRecords.workspaceId, context.access.project.workspaceId),
    eq(applicationRecords.objectKey, context.object.key),
  )).limit(1))[0];
  if (!record) throw new ApiError(404, 'APPLICATION_RECORD_NOT_FOUND', 'Enregistrement introuvable dans cet objet.');
  return record;
}

async function listFromContext(context: ObjectContext, input: unknown, db: Db) {
  authorize(context, 'read');
  const options = listOptionsSchema.parse(input);
  if (options.status && !context.object.statusField) throw new ApiError(422, 'APPLICATION_FILTER_UNSUPPORTED', 'Cet objet ne possède pas de filtre de statut.');
  const statusField = context.object.statusField ? context.object.fields.find((field) => field.key === context.object.statusField) : undefined;
  if (options.status && statusField?.type === 'enum' && !statusField.options?.some((option) => option.value === options.status)) throw new ApiError(422, 'APPLICATION_FILTER_INVALID', 'Ce statut n’existe pas dans le modèle.');
  const conditions: SQL[] = [and(
    eq(applicationRecords.projectId, context.access.project.id),
    eq(applicationRecords.workspaceId, context.access.project.workspaceId),
    eq(applicationRecords.objectKey, context.object.key),
  )!];
  if (options.q) conditions.push(sql`${applicationRecords.data}::text ILIKE ${`%${options.q}%`}`);
  if (options.status && context.object.statusField) conditions.push(sql`${applicationRecords.data} ->> ${context.object.statusField} = ${options.status}`);
  if (options.ids) conditions.push(inArray(applicationRecords.id, options.ids));
  const where = and(...conditions);
  const [records, count] = await Promise.all([
    db.select().from(applicationRecords).where(where).orderBy(desc(applicationRecords.createdAt), desc(applicationRecords.id)).limit(options.limit).offset(options.offset),
    db.select({ value: sql<number>`count(*)::int` }).from(applicationRecords).where(where),
  ]);
  return { records, total: count[0]?.value ?? 0, limit: options.limit, offset: options.offset };
}

function assertModelCompatibility(model: ApplicationModel, records: ApplicationRecordRow[]): void {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  for (const record of records) {
    const object = model.objects.find((candidate) => candidate.key === record.objectKey);
    if (!object) throw new ApiError(409, 'APPLICATION_MODEL_INCOMPATIBLE', `La version supprimerait l’objet « ${record.objectKey} » alors qu’il contient des données.`);
    const result = applicationRecordSchema(object, 'stored').safeParse(record.data);
    if (!result.success) throw new ApiError(409, 'APPLICATION_MODEL_INCOMPATIBLE', `La version est incompatible avec l’enregistrement ${record.id} de « ${object.label} ».`, { recordId: record.id, objectKey: record.objectKey, path: result.error.issues[0]?.path.join('.') });
    for (const field of object.fields) {
      if (field.type !== 'relation' || typeof record.data[field.key] !== 'string') continue;
      const target = recordsById.get(record.data[field.key] as string);
      if (!target || target.objectKey !== field.targetObject) throw new ApiError(409, 'APPLICATION_MODEL_INCOMPATIBLE', `La version invaliderait la relation « ${field.label} » de l’enregistrement ${record.id}.`, { recordId: record.id, objectKey: record.objectKey, path: [field.key] });
    }
  }
}

export async function getApplicationModel(userId: string, projectId: string, db?: Db) {
  const database = db ?? await getDb();
  const access = await requireProjectAccess(userId, projectId, 'read', database);
  const row = await currentModel(projectId, database);
  return {
    project: access.project,
    role: access.member.role,
    canManage: ['owner', 'admin'].includes(access.member.role),
    model: row?.model ?? null,
    version: row?.version ?? 0,
    routes: row ? buildApplicationRoutes(row.model) : [],
  };
}

export async function saveApplicationModel(userId: string, projectId: string, input: unknown, db?: Db) {
  const payload = z.object({ model: z.unknown(), baseVersion: z.number().int().min(0).nullable() }).parse(input);
  const model = applicationModelSchema.parse(payload.model);
  const database = db ?? await getDb();
  return database.transaction(async (tx) => {
    const access = await requireProjectAccess(userId, projectId, 'members', tx);
    // Every model or record write takes the same project lock to preserve cross-record invariants.
    await lockProject(access, tx);
    const current = await currentModel(projectId, tx);
    const version = current?.version ?? 0;
    if ((payload.baseVersion ?? 0) !== version) throw new ApiError(409, 'APPLICATION_MODEL_REVISION_CONFLICT', 'Le modèle a changé. Rechargez sa dernière version avant de réessayer.');
    if (current) {
      const existingRecords = await tx.select().from(applicationRecords).where(and(eq(applicationRecords.projectId, projectId), eq(applicationRecords.workspaceId, access.project.workspaceId)));
      assertModelCompatibility(model, existingRecords);
      await tx.update(applicationModels).set({ current: false }).where(and(eq(applicationModels.id, current.id), eq(applicationModels.workspaceId, access.project.workspaceId), eq(applicationModels.current, true)));
    }
    const inserted = (await tx.insert(applicationModels).values({
      id: createId('application-model'), workspaceId: access.project.workspaceId, projectId, version: version + 1,
      current: true, model, createdBy: userId,
    }).returning())[0]!;
    await tx.update(projects).set({ updatedAt: new Date() }).where(and(eq(projects.id, projectId), eq(projects.workspaceId, access.project.workspaceId)));
    return inserted;
  });
}

export async function getApplicationDashboard(userId: string, projectId: string, db?: Db) {
  const database = db ?? await getDb();
  const access = await requireProjectAccess(userId, projectId, 'read', database);
  const row = await currentModel(projectId, database);
  if (!row) return { project: access.project, role: access.member.role as WorkspaceRole, canManage: ['owner', 'admin'].includes(access.member.role), model: null, version: 0, objects: [] };
  const parsedRole = workspaceRoleSchema.parse(access.member.role);
  const context: ModelContext = { access, row, role: parsedRole };
  const readable = row.model.objects.filter((object) => roleCan(row.model, parsedRole, object.key, 'read'));
  const objects = await Promise.all(readable.map(async (object) => ({
    object,
    ...(await listFromContext({ ...context, object }, { limit: 100, offset: 0 }, database)),
  })));
  return { project: access.project, role: parsedRole, canManage: ['owner', 'admin'].includes(access.member.role), model: row.model, version: row.version, objects };
}

export async function listApplicationRecords(userId: string, projectId: string, objectKey: string, input: unknown, db?: Db) {
  const database = db ?? await getDb();
  return listFromContext(await objectContext(userId, projectId, objectKey, 'read', database), input, database);
}

export async function getApplicationRecord(userId: string, projectId: string, objectKey: string, recordId: string, db?: Db) {
  const database = db ?? await getDb();
  const context = await objectContext(userId, projectId, objectKey, 'read', database);
  authorize(context, 'read');
  return recordFrom(context, recordId, database);
}

export async function createApplicationRecord(userId: string, projectId: string, objectKey: string, input: unknown, db?: Db) {
  const database = db ?? await getDb();
  return database.transaction(async (tx) => {
    const context = await lockedObjectContext(userId, projectId, objectKey, tx);
    authorize(context, 'create');
    const data = applicationRecordSchema(context.object, 'create').parse(input) as ApplicationRecordData;
    if (context.object.statusField) {
      const initialStatus = initialRecordStatus(context.object);
      if (!initialStatus) throw new ApiError(422, 'APPLICATION_STATUS_INVALID', 'Le modèle ne définit pas de statut initial valide.');
      data[context.object.statusField] = initialStatus;
    }
    await validateRelations(context, data, tx);
    const inserted = (await tx.insert(applicationRecords).values({
      id: createId('application-record'), workspaceId: context.access.project.workspaceId, projectId,
      objectKey: context.object.key, data, createdBy: userId,
    }).returning())[0]!;
    await touchProject(context, tx);
    return inserted;
  });
}

export async function updateApplicationRecord(userId: string, projectId: string, objectKey: string, recordId: string, input: unknown, db?: Db) {
  const database = db ?? await getDb();
  return database.transaction(async (tx) => {
    const context = await lockedObjectContext(userId, projectId, objectKey, tx);
    authorize(context, 'update');
    const current = await recordFrom(context, recordId, tx);
    const data = applicationRecordSchema(context.object, 'update').parse(input) as ApplicationRecordData;
    if (context.object.statusField) data[context.object.statusField] = current.data[context.object.statusField];
    await validateRelations(context, data, tx);
    const updated = (await tx.update(applicationRecords).set({ data, updatedAt: new Date() }).where(and(
      eq(applicationRecords.id, current.id), eq(applicationRecords.projectId, projectId), eq(applicationRecords.workspaceId, context.access.project.workspaceId), eq(applicationRecords.objectKey, context.object.key),
    )).returning())[0]!;
    await touchProject(context, tx);
    return updated;
  });
}

export async function deleteApplicationRecord(userId: string, projectId: string, objectKey: string, recordId: string, db?: Db) {
  const database = db ?? await getDb();
  return database.transaction(async (tx) => {
    const context = await lockedObjectContext(userId, projectId, objectKey, tx);
    authorize(context, 'delete');
    const current = await recordFrom(context, recordId, tx);
    const related = await tx.select().from(applicationRecords).where(and(eq(applicationRecords.projectId, projectId), eq(applicationRecords.workspaceId, context.access.project.workspaceId)));
    for (const candidate of related) {
      if (candidate.id === current.id) continue;
      const candidateObject = objectFrom(context.row.model, candidate.objectKey);
      for (const field of candidateObject.fields) {
        if (field.type === 'relation' && field.targetObject === context.object.key && candidate.data[field.key] === current.id) throw new ApiError(409, 'APPLICATION_RECORD_REFERENCED', `Impossible de supprimer « ${context.object.label} » : un enregistrement de « ${candidateObject.label} » l’utilise encore.`);
      }
    }
    await tx.delete(applicationRecords).where(and(eq(applicationRecords.id, current.id), eq(applicationRecords.projectId, projectId), eq(applicationRecords.workspaceId, context.access.project.workspaceId), eq(applicationRecords.objectKey, context.object.key)));
    await touchProject(context, tx);
    return { deleted: true as const, id: current.id };
  });
}

export async function executeApplicationAction(userId: string, projectId: string, objectKey: string, recordId: string, actionKey: string, db?: Db) {
  const database = db ?? await getDb();
  return database.transaction(async (tx) => {
    const context = await lockedObjectContext(userId, projectId, objectKey, tx);
    authorizeAction(context, actionKey);
    const action = context.object.actions.find((candidate) => candidate.key === actionKey);
    if (!action) throw new ApiError(404, 'APPLICATION_ACTION_NOT_FOUND', 'Cette action n’existe pas dans le modèle actif.');
    const current = await recordFrom(context, recordId, tx);
    const statusField = context.object.statusField;
    if (!statusField) throw new ApiError(409, 'APPLICATION_STATUS_UNSUPPORTED', 'Cet objet ne possède pas de processus de statut.');
    const status = current.data[statusField];
    if (typeof status !== 'string' || !action.from.includes(status)) throw new ApiError(409, 'APPLICATION_TRANSITION_INVALID', `L’action « ${action.label} » n’est pas disponible depuis le statut actuel.`);
    const data = { ...current.data, [statusField]: action.to };
    const updated = (await tx.update(applicationRecords).set({ data, updatedAt: new Date() }).where(and(
      eq(applicationRecords.id, current.id), eq(applicationRecords.projectId, projectId), eq(applicationRecords.workspaceId, context.access.project.workspaceId), eq(applicationRecords.objectKey, context.object.key),
      sql`${applicationRecords.data} ->> ${statusField} = ${status}`,
    )).returning())[0];
    if (!updated) throw new ApiError(409, 'APPLICATION_TRANSITION_CONFLICT', 'Le statut a changé pendant l’action. Rechargez l’enregistrement avant de réessayer.');
    await touchProject(context, tx);
    return updated;
  });
}
