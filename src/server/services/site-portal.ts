import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@/lib/id';
import {
  publicIntakeEligible,
  publicIntakeFields,
  publicIntakeSettingsSchema,
  type PortalChoice,
  type PortalField,
  type PublicIntakeSettings,
  type SitePortal,
  type SitePortalItem,
} from '@/lib/application/intake';
import {
  applicationRecordSchema,
  initialRecordStatus,
  type ApplicationModel,
  type ApplicationObject,
} from '@/lib/application/model';
import { requireProjectAccess } from '@/server/auth/tenancy';
import { getDb, type Db } from '@/server/db';
import { applicationModels, applicationRecords, projects, type Project, type SiteUser } from '@/server/db/schema';
import { ApiError } from '@/server/http';
import { siteProjectBySlug } from './site-identity';

async function currentModel(projectId: string, db: Db) {
  return (await db.select().from(applicationModels).where(and(eq(applicationModels.projectId, projectId), eq(applicationModels.current, true))).limit(1))[0];
}

function intakeOf(project: Project) {
  const parsed = publicIntakeSettingsSchema.safeParse(project.publicIntake);
  if (!parsed.success || !parsed.data.enabled || !parsed.data.objectKey) return null;
  return parsed.data;
}

function publicObject(model: ApplicationModel, objectKey: string): ApplicationObject {
  const object = model.objects.find((candidate) => candidate.key === objectKey);
  if (!object || !publicIntakeEligible(object)) throw new ApiError(409, 'SITE_INTAKE_UNAVAILABLE', 'Ce formulaire public n’est plus disponible.');
  return object;
}

async function relationChoices(project: Project, target: ApplicationObject, db: Db): Promise<PortalChoice[]> {
  const rows = await db.select({ id: applicationRecords.id, data: applicationRecords.data }).from(applicationRecords)
    .where(and(
      eq(applicationRecords.projectId, project.id),
      eq(applicationRecords.workspaceId, project.workspaceId),
      eq(applicationRecords.objectKey, target.key),
    ))
    .orderBy(desc(applicationRecords.createdAt))
    .limit(100);
  return rows.map((row) => ({ value: row.id, label: String(row.data[target.titleField] ?? row.id) }));
}

/**
 * Public form definition: labels, types and choice lists only. The model, the workspace and the
 * other records are never exposed by this payload.
 */
export async function getSitePortal(slug: string, db?: Db): Promise<SitePortal> {
  const database = db ?? await getDb();
  const project = await siteProjectBySlug(slug, database);
  const settings = intakeOf(project);
  if (!settings) throw new ApiError(404, 'SITE_NOT_FOUND', 'Ce portail est introuvable ou fermé.');
  const row = await currentModel(project.id, database);
  if (!row) throw new ApiError(409, 'SITE_INTAKE_UNAVAILABLE', 'Ce formulaire public n’est pas encore configuré.');
  const object = publicObject(row.model, settings.objectKey!);
  const fields: PortalField[] = [];
  for (const field of publicIntakeFields(object)) {
    if (field.type === 'relation') {
      const target = row.model.objects.find((candidate) => candidate.key === field.targetObject);
      if (!target) continue;
      fields.push({
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        ...(field.help ? { help: field.help } : {}),
        relation: { targetObject: target.key, targetLabel: target.pluralLabel, options: await relationChoices(project, target, database) },
      });
    } else {
      fields.push({
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        ...(field.help ? { help: field.help } : {}),
        ...(field.options ? { options: field.options.map((option) => ({ value: option.value, label: option.label })) } : {}),
      });
    }
  }
  return {
    enabled: true,
    project: { name: project.name, slug: project.slug },
    title: settings.title?.trim() || object.pluralLabel,
    intro: settings.intro?.trim() || '',
    objectKey: object.key,
    objectLabel: object.pluralLabel,
    fields,
  };
}

async function portalContext(slug: string, siteUser: SiteUser, db: Db) {
  const project = await siteProjectBySlug(slug, db);
  if (project.id !== siteUser.projectId || project.workspaceId !== siteUser.workspaceId || siteUser.status !== 'active') {
    throw new ApiError(403, 'SITE_ACCESS_DENIED', 'Ce compte n’appartient pas à ce site.');
  }
  const settings = intakeOf(project);
  if (!settings) throw new ApiError(404, 'SITE_NOT_FOUND', 'Ce portail est introuvable ou fermé.');
  const row = await currentModel(project.id, db);
  if (!row) throw new ApiError(409, 'SITE_INTAKE_UNAVAILABLE', 'Ce formulaire public n’est pas encore configuré.');
  return { project, settings, model: row.model, object: publicObject(row.model, settings.objectKey!) };
}

/**
 * Creates one managed record from the public portal. Field choice, types and relations are
 * revalidated on the server, and the initial status is always the model's own default.
 */
export async function submitSiteRequest(slug: string, siteUser: SiteUser, input: unknown, db?: Db) {
  const payload = z.object({ data: z.record(z.string(), z.unknown()) }).parse(input);
  const database = db ?? await getDb();
  const { project, object } = await portalContext(slug, siteUser, database);
  const fields = publicIntakeFields(object);
  const allowed = new Set(fields.map((field) => field.key));
  const rejected = Object.keys(payload.data).filter((key) => !allowed.has(key));
  if (rejected.length) throw new ApiError(422, 'SITE_FIELD_NOT_PUBLIC', 'Certains champs ne font pas partie de ce formulaire public.', { fields: rejected });
  const parsed = applicationRecordSchema(object, 'create').safeParse(payload.data);
  if (!parsed.success) {
    throw new ApiError(422, 'SITE_REQUEST_INVALID', parsed.error.issues[0]?.message ?? 'Vérifiez les informations du formulaire.', {
      fields: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  const data: Record<string, unknown> = { ...parsed.data };
  for (const field of fields) {
    if (field.type !== 'relation' || typeof data[field.key] !== 'string') continue;
    const exists = (await database.select({ id: applicationRecords.id }).from(applicationRecords).where(and(
      eq(applicationRecords.id, data[field.key] as string),
      eq(applicationRecords.projectId, project.id),
      eq(applicationRecords.workspaceId, project.workspaceId),
      eq(applicationRecords.objectKey, field.targetObject!),
    )).limit(1))[0];
    if (!exists) throw new ApiError(422, 'SITE_RELATION_INVALID', `La relation « ${field.label} » ne désigne pas un choix valide de ce site.`);
  }
  const status = initialRecordStatus(object);
  if (object.statusField && status) data[object.statusField] = status;
  const record = (await database.insert(applicationRecords).values({
    id: createId('application-record'),
    workspaceId: project.workspaceId,
    projectId: project.id,
    objectKey: object.key,
    data,
    createdBy: null,
    siteUserId: siteUser.id,
  }).returning())[0]!;
  return { id: record.id, status, createdAt: record.createdAt.toISOString() };
}

/** Only the connected end user's own requests are returned, newest first. */
export async function listSiteRequests(slug: string, siteUser: SiteUser, db?: Db) {
  const database = db ?? await getDb();
  const { project, object } = await portalContext(slug, siteUser, database);
  const rows = await database.select({ id: applicationRecords.id, data: applicationRecords.data, createdAt: applicationRecords.createdAt })
    .from(applicationRecords)
    .where(and(
      eq(applicationRecords.siteUserId, siteUser.id),
      eq(applicationRecords.projectId, project.id),
      eq(applicationRecords.workspaceId, project.workspaceId),
      eq(applicationRecords.objectKey, object.key),
    ))
    .orderBy(desc(applicationRecords.createdAt))
    .limit(20);
  const statusField = object.fields.find((field) => field.key === object.statusField);
  const labels = new Map(statusField?.options?.map((option) => [option.value, option.label]) ?? []);
  const items: SitePortalItem[] = rows.map((row) => {
    const status = object.statusField ? String(row.data[object.statusField] ?? '') || null : null;
    return {
      id: row.id,
      title: String(row.data[object.titleField] ?? 'Demande'),
      status,
      statusLabel: status ? labels.get(status) ?? status : null,
      createdAt: row.createdAt.toISOString(),
    };
  });
  return { objectLabel: object.pluralLabel, items };
}

/** Studio-side configuration; it only names an eligible object of the current model. */
export async function savePublicIntake(userId: string, projectId: string, input: unknown, db?: Db): Promise<PublicIntakeSettings> {
  const database = db ?? await getDb();
  const access = await requireProjectAccess(userId, projectId, 'edit', database);
  const settings = publicIntakeSettingsSchema.parse(input);
  const row = await currentModel(projectId, database);
  const object = settings.objectKey ? row?.model.objects.find((candidate) => candidate.key === settings.objectKey) : undefined;
  if (settings.enabled && (!object || !publicIntakeEligible(object))) {
    throw new ApiError(422, 'PUBLIC_INTAKE_OBJECT_INVALID', 'Choisissez un objet du modèle actif qui possède un statut et un formulaire public possible.');
  }
  const next: PublicIntakeSettings = {
    enabled: settings.enabled,
    ...(object ? { objectKey: object.key } : {}),
    title: settings.title?.trim() || object?.pluralLabel || '',
    intro: settings.intro?.trim() || '',
  };
  await database.update(projects).set({ publicIntake: next, updatedAt: new Date() }).where(and(
    eq(projects.id, projectId),
    eq(projects.workspaceId, access.project.workspaceId),
  ));
  return next;
}
