import { z } from 'zod';

export const workspaceRoleSchema = z.enum(['owner', 'admin', 'editor', 'contributor', 'viewer']);
export const applicationOperationSchema = z.enum(['read', 'create', 'update', 'delete']);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type ApplicationOperation = z.infer<typeof applicationOperationSchema>;

const keySchema = z.string().trim().min(1).max(48).regex(/^[a-z][a-z0-9-]*$/, 'Utilisez une clé technique en minuscules, chiffres et tirets.');
const labelSchema = z.string().trim().min(1).max(120);
const optionSchema = z.object({ value: keySchema, label: labelSchema });
const fieldTypeSchema = z.enum(['text', 'textarea', 'email', 'phone', 'integer', 'number', 'boolean', 'date', 'enum', 'relation']);

export const applicationFieldSchema = z.object({
  key: keySchema,
  label: labelSchema,
  type: fieldTypeSchema,
  required: z.boolean().default(false),
  help: z.string().trim().max(240).optional(),
  maxLength: z.number().int().min(1).max(20_000).optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  options: z.array(optionSchema).max(40).optional(),
  targetObject: keySchema.optional(),
  defaultValue: z.union([z.string().max(20_000), z.number().finite(), z.boolean()]).optional(),
}).superRefine((field, context) => {
  const textual = ['text', 'textarea', 'email', 'phone'].includes(field.type);
  if (!textual && field.maxLength !== undefined) context.addIssue({ code: 'custom', message: 'maxLength est réservé aux champs texte.', path: ['maxLength'] });
  if (!['integer', 'number'].includes(field.type) && (field.min !== undefined || field.max !== undefined)) context.addIssue({ code: 'custom', message: 'Les bornes sont réservées aux nombres.', path: ['min'] });
  if (field.min !== undefined && field.max !== undefined && field.min > field.max) context.addIssue({ code: 'custom', message: 'La borne minimale dépasse le maximum.', path: ['min'] });
  if (field.type === 'enum') {
    if (!field.options || field.options.length < 2) context.addIssue({ code: 'custom', message: 'Un champ enum exige au moins deux options.', path: ['options'] });
    const values = new Set<string>();
    for (const [index, option] of (field.options ?? []).entries()) {
      if (values.has(option.value)) context.addIssue({ code: 'custom', message: 'Les valeurs des options doivent être uniques.', path: ['options', index, 'value'] });
      values.add(option.value);
    }
  } else if (field.options !== undefined) context.addIssue({ code: 'custom', message: 'Les options sont réservées aux champs enum.', path: ['options'] });
  if (field.type === 'relation' && !field.targetObject) context.addIssue({ code: 'custom', message: 'Une relation exige un objet cible.', path: ['targetObject'] });
  if (field.type !== 'relation' && field.targetObject) context.addIssue({ code: 'custom', message: 'targetObject est réservé aux relations.', path: ['targetObject'] });
  if (field.defaultValue === undefined) return;
  const validType = (field.type === 'boolean' && typeof field.defaultValue === 'boolean')
    || (['integer', 'number'].includes(field.type) && typeof field.defaultValue === 'number')
    || (!['boolean', 'integer', 'number', 'relation'].includes(field.type) && typeof field.defaultValue === 'string');
  if (!validType) context.addIssue({ code: 'custom', message: 'La valeur par défaut ne correspond pas au type du champ.', path: ['defaultValue'] });
  if (field.type === 'integer' && typeof field.defaultValue === 'number' && !Number.isInteger(field.defaultValue)) context.addIssue({ code: 'custom', message: 'La valeur par défaut doit être un entier.', path: ['defaultValue'] });
  if (typeof field.defaultValue === 'number' && ((field.min !== undefined && field.defaultValue < field.min) || (field.max !== undefined && field.defaultValue > field.max))) context.addIssue({ code: 'custom', message: 'La valeur par défaut sort des bornes.', path: ['defaultValue'] });
  if (field.type === 'enum' && typeof field.defaultValue === 'string' && !field.options?.some((option) => option.value === field.defaultValue)) context.addIssue({ code: 'custom', message: 'La valeur par défaut doit être une option déclarée.', path: ['defaultValue'] });
});

export const applicationActionSchema = z.object({
  key: keySchema,
  label: labelSchema,
  from: z.array(keySchema).min(1).max(30),
  to: keySchema,
});

export const applicationObjectSchema = z.object({
  key: keySchema,
  label: labelSchema,
  pluralLabel: labelSchema,
  description: z.string().trim().max(300).optional(),
  titleField: keySchema,
  statusField: keySchema.optional(),
  columns: z.array(keySchema).min(1).max(12).optional(),
  fields: z.array(applicationFieldSchema).min(1).max(80),
  actions: z.array(applicationActionSchema).max(30).default([]),
});

const grantSchema = z.object({
  object: z.union([z.literal('*'), keySchema]),
  operations: z.array(applicationOperationSchema).min(1).max(4),
  actions: z.array(z.union([z.literal('*'), keySchema])).max(30).default([]),
});

export const applicationModelSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(''),
  objects: z.array(applicationObjectSchema).min(1).max(40),
  roles: z.array(z.object({ key: workspaceRoleSchema, label: labelSchema, grants: z.array(grantSchema).min(1).max(80) })).min(1).max(5),
}).superRefine((model, context) => {
  const objects = new Map<string, (typeof model.objects)[number]>();
  for (const [index, object] of model.objects.entries()) {
    if (objects.has(object.key)) context.addIssue({ code: 'custom', message: 'Les clés des objets doivent être uniques.', path: ['objects', index, 'key'] });
    objects.set(object.key, object);
    const fields = new Map<string, (typeof object.fields)[number]>();
    for (const [fieldIndex, field] of object.fields.entries()) {
      if (fields.has(field.key)) context.addIssue({ code: 'custom', message: 'Les clés des champs doivent être uniques.', path: ['objects', index, 'fields', fieldIndex, 'key'] });
      fields.set(field.key, field);
      if (field.type === 'relation' && field.targetObject && !model.objects.some((candidate) => candidate.key === field.targetObject)) context.addIssue({ code: 'custom', message: `Objet lié inconnu : ${field.targetObject}.`, path: ['objects', index, 'fields', fieldIndex, 'targetObject'] });
    }
    if (!fields.has(object.titleField)) context.addIssue({ code: 'custom', message: 'Le champ titre est introuvable.', path: ['objects', index, 'titleField'] });
    for (const [columnIndex, column] of (object.columns ?? []).entries()) {
      if (!fields.has(column)) context.addIssue({ code: 'custom', message: `Colonne inconnue : ${column}.`, path: ['objects', index, 'columns', columnIndex] });
      if ((object.columns ?? []).indexOf(column) !== columnIndex) context.addIssue({ code: 'custom', message: `Colonne dupliquée : ${column}.`, path: ['objects', index, 'columns', columnIndex] });
    }
    const actionKeys = new Set<string>();
    if (object.actions.length && !object.statusField) context.addIssue({ code: 'custom', message: 'Les actions exigent un champ de statut.', path: ['objects', index, 'statusField'] });
    if (object.statusField) {
      const status = fields.get(object.statusField);
      if (!status || status.type !== 'enum') context.addIssue({ code: 'custom', message: 'Le statut doit être un champ enum.', path: ['objects', index, 'statusField'] });
      if (status && typeof status.defaultValue !== 'string') context.addIssue({ code: 'custom', message: 'Le champ de statut exige une valeur initiale.', path: ['objects', index, 'fields', object.fields.indexOf(status), 'defaultValue'] });
      const allowed = new Set(status?.options?.map((option) => option.value));
      for (const [actionIndex, action] of object.actions.entries()) {
        if (actionKeys.has(action.key)) context.addIssue({ code: 'custom', message: 'Les clés des actions doivent être uniques.', path: ['objects', index, 'actions', actionIndex, 'key'] });
        actionKeys.add(action.key);
        if (!allowed.has(action.to)) context.addIssue({ code: 'custom', message: `Statut cible inconnu : ${action.to}.`, path: ['objects', index, 'actions', actionIndex, 'to'] });
        for (const [fromIndex, from] of action.from.entries()) if (!allowed.has(from)) context.addIssue({ code: 'custom', message: `Statut source inconnu : ${from}.`, path: ['objects', index, 'actions', actionIndex, 'from', fromIndex] });
        if (action.from.includes(action.to)) context.addIssue({ code: 'custom', message: 'Une action doit changer le statut.', path: ['objects', index, 'actions', actionIndex, 'to'] });
      }
    }
  }
  const roles = new Set<string>();
  for (const [roleIndex, role] of model.roles.entries()) {
    if (roles.has(role.key)) context.addIssue({ code: 'custom', message: 'Chaque rôle workspace ne peut être décrit qu’une fois.', path: ['roles', roleIndex, 'key'] });
    roles.add(role.key);
    for (const [grantIndex, grant] of role.grants.entries()) {
      if (new Set(grant.operations).size !== grant.operations.length) context.addIssue({ code: 'custom', message: 'Les opérations d’un grant doivent être uniques.', path: ['roles', roleIndex, 'grants', grantIndex, 'operations'] });
      if (role.key === 'viewer' && (grant.operations.some((operation) => operation !== 'read') || grant.actions.length)) context.addIssue({ code: 'custom', message: 'Un viewer workspace reste strictement en lecture.', path: ['roles', roleIndex, 'grants', grantIndex] });
      if (grant.object !== '*' && !objects.has(grant.object)) context.addIssue({ code: 'custom', message: `Objet de permission inconnu : ${grant.object}.`, path: ['roles', roleIndex, 'grants', grantIndex, 'object'] });
      if (grant.object === '*' && grant.actions.some((action) => action !== '*')) context.addIssue({ code: 'custom', message: 'Une action nommée exige un objet précis.', path: ['roles', roleIndex, 'grants', grantIndex, 'actions'] });
      if (grant.object !== '*') {
        const available = new Set(objects.get(grant.object)?.actions.map((action) => action.key));
        for (const [actionIndex, action] of grant.actions.entries()) if (action !== '*' && !available.has(action)) context.addIssue({ code: 'custom', message: `Action de permission inconnue : ${action}.`, path: ['roles', roleIndex, 'grants', grantIndex, 'actions', actionIndex] });
      }
    }
  }
});

export type ApplicationModel = z.infer<typeof applicationModelSchema>;
export type ApplicationObject = ApplicationModel['objects'][number];
export type ApplicationField = ApplicationObject['fields'][number];
export type ApplicationAction = ApplicationObject['actions'][number];
export type ApplicationRecordData = Record<string, unknown>;

/** Resolves the same bounded, unique column list for the inspector and runtime table. */
export function applicationColumnKeys(object: ApplicationObject): string[] {
  const available = new Set(object.fields.map((field) => field.key));
  return (object.columns ?? [object.titleField, ...object.fields.map((field) => field.key)])
    .filter((key, index, values) => available.has(key) && values.indexOf(key) === index)
    .slice(0, 12);
}

function fieldValueSchema(field: ApplicationField): z.ZodTypeAny {
  const requiredText = (max: number) => z.string().trim().min(1).max(max);
  switch (field.type) {
    case 'text': return requiredText(field.maxLength ?? 240);
    case 'textarea': return requiredText(field.maxLength ?? 10_000);
    case 'email': return z.string().trim().email().max(field.maxLength ?? 320);
    case 'phone': return z.string().trim().regex(/^[+0-9().\s-]{3,32}$/, 'Numéro de téléphone invalide.').max(field.maxLength ?? 32);
    case 'integer': { let schema = z.number().int(); if (field.min !== undefined) schema = schema.min(field.min); if (field.max !== undefined) schema = schema.max(field.max); return schema; }
    case 'number': { let schema = z.number().finite(); if (field.min !== undefined) schema = schema.min(field.min); if (field.max !== undefined) schema = schema.max(field.max); return schema; }
    case 'boolean': return z.boolean();
    case 'date': return z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, 'Date invalide.');
    case 'enum': return z.enum((field.options ?? []).map((option) => option.value) as [string, ...string[]]);
    case 'relation': return z.uuid();
  }
}

export function applicationRecordSchema(object: ApplicationObject, mode: 'create' | 'update' | 'stored') {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of object.fields) {
    if (mode !== 'stored' && field.key === object.statusField) continue;
    let schema = fieldValueSchema(field);
    if (mode === 'create' && field.defaultValue !== undefined) schema = schema.default(field.defaultValue);
    else if (!field.required) schema = schema.optional();
    shape[field.key] = schema;
  }
  return z.object(shape).strict();
}

export function initialRecordStatus(object: ApplicationObject): string | undefined {
  if (!object.statusField) return undefined;
  const status = object.fields.find((field) => field.key === object.statusField);
  return typeof status?.defaultValue === 'string' ? status.defaultValue : undefined;
}

function matchingGrants(model: ApplicationModel, role: WorkspaceRole, objectKey: string) {
  return model.roles.find((candidate) => candidate.key === role)?.grants.filter((grant) => grant.object === '*' || grant.object === objectKey) ?? [];
}

export function roleCan(model: ApplicationModel, role: WorkspaceRole, objectKey: string, operation: ApplicationOperation): boolean {
  if (role === 'viewer' && operation !== 'read') return false;
  return matchingGrants(model, role, objectKey).some((grant) => grant.operations.includes(operation));
}

export function roleCanAction(model: ApplicationModel, role: WorkspaceRole, objectKey: string, actionKey: string): boolean {
  if (role === 'viewer') return false;
  return matchingGrants(model, role, objectKey).some((grant) => grant.actions.includes('*') || grant.actions.includes(actionKey));
}

export type ApplicationRoute = {
  id: string;
  label: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  objectKey: string;
  operation?: ApplicationOperation;
  actionKey?: string;
  roles: WorkspaceRole[];
};

export function buildApplicationRoutes(model: ApplicationModel): ApplicationRoute[] {
  const rolesFor = (objectKey: string, operation?: ApplicationOperation, actionKey?: string) => model.roles.filter((role) => operation ? roleCan(model, role.key, objectKey, operation) : roleCanAction(model, role.key, objectKey, actionKey!)).map((role) => role.key);
  return model.objects.flatMap((object) => {
    const routes: ApplicationRoute[] = [
      { id: `${object.key}.list`, label: `Lister : ${object.pluralLabel}`, method: 'GET', objectKey: object.key, operation: 'read', roles: rolesFor(object.key, 'read') },
      { id: `${object.key}.create`, label: `Créer : ${object.label}`, method: 'POST', objectKey: object.key, operation: 'create', roles: rolesFor(object.key, 'create') },
      { id: `${object.key}.update`, label: `Modifier : ${object.label}`, method: 'PATCH', objectKey: object.key, operation: 'update', roles: rolesFor(object.key, 'update') },
      { id: `${object.key}.delete`, label: `Supprimer : ${object.label}`, method: 'DELETE', objectKey: object.key, operation: 'delete', roles: rolesFor(object.key, 'delete') },
    ];
    for (const action of object.actions) routes.push({ id: `${object.key}.actions.${action.key}`, label: `${action.label} : ${object.label}`, method: 'POST', objectKey: object.key, actionKey: action.key, roles: rolesFor(object.key, undefined, action.key) });
    return routes;
  });
}
