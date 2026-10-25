import { applicationModelSchema, type ApplicationField, type ApplicationModel } from './model';

export const applicationFieldTypeLabels = {
  text: 'Texte court',
  textarea: 'Texte long',
  email: 'Email',
  phone: 'Téléphone',
  integer: 'Nombre entier',
  number: 'Nombre décimal',
  boolean: 'Booléen',
  date: 'Date',
  enum: 'Liste de choix',
  relation: 'Relation',
} as const satisfies Record<ApplicationField['type'], string>;

export type SimpleApplicationObjectInput = {
  label: string;
  pluralLabel: string;
  key: string;
  description: string;
};

export type ApplicationTextFieldInput = {
  objectKey: string;
  label: string;
  key: string;
};

export type ApplicationRelationFieldInput = ApplicationTextFieldInput & { targetObject: string };
export type ApplicationTypedFieldInput = ApplicationTextFieldInput & { type: 'text' | 'integer' | 'number' | 'date'; min?: number; max?: number; defaultValue?: number };
export type ApplicationEnumFieldInput = ApplicationTextFieldInput & { options: string[] };
export type ApplicationTransitionInput = ApplicationTextFieldInput & { from: string; to: string };
export type ApplicationColumnsInput = { objectKey: string; columns: string[] };

function applicationKeyBase(value: string, prefix: 'objet' | 'champ' | 'action' | 'option'): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const prefixed = /^[a-z]/.test(slug) ? slug : `${prefix}${slug ? `-${slug}` : ''}`;
  return prefixed.slice(0, 48).replace(/-+$/g, '') || prefix;
}

export function uniqueApplicationKey(value: string, existingKeys: readonly string[], prefix: 'objet' | 'champ' | 'action' | 'option' = 'objet'): string {
  const base = applicationKeyBase(value, prefix);
  const existing = new Set(existingKeys);
  let candidate = base;
  for (let index = 2; existing.has(candidate); index += 1) {
    const suffix = `-${index}`;
    candidate = `${base.slice(0, 48 - suffix.length).replace(/-+$/g, '')}${suffix}`;
  }
  return candidate;
}

/** Creates a validated draft without mutating the active model or widening any role grant. */
export function addSimpleApplicationObject(model: ApplicationModel, input: SimpleApplicationObjectInput): ApplicationModel {
  const key = uniqueApplicationKey(input.key.trim() || input.label, model.objects.map((object) => object.key));
  return applicationModelSchema.parse({
    ...model,
    objects: [
      ...model.objects,
      {
        key,
        label: input.label.trim(),
        pluralLabel: input.pluralLabel.trim(),
        description: input.description.trim(),
        titleField: 'nom',
        columns: ['nom'],
        fields: [{ key: 'nom', label: 'Nom', type: 'text', required: true, maxLength: 160 }],
        actions: [],
      },
    ],
  });
}

/** Adds one optional text field while preserving existing columns, actions and grants. */
export function addOptionalApplicationTextField(model: ApplicationModel, input: ApplicationTextFieldInput): ApplicationModel {
  return addOptionalApplicationTypedField(model, { ...input, type: 'text' });
}

/** Adds a supported scalar without rewriting existing records or table columns. */
export function addOptionalApplicationTypedField(model: ApplicationModel, input: ApplicationTypedFieldInput): ApplicationModel {
  const target = model.objects.find((object) => object.key === input.objectKey);
  if (!target) throw new Error('Objet cible introuvable dans le brouillon.');
  const numeric = input.type === 'integer' || input.type === 'number';
  if (!numeric && (input.min !== undefined || input.max !== undefined)) throw new Error('Les bornes sont réservées aux champs numériques.');
  if (!numeric && input.defaultValue !== undefined) throw new Error('La valeur par défaut configurable est réservée aux champs numériques.');
  const key = uniqueApplicationKey(input.key.trim() || input.label, target.fields.map((field) => field.key), 'champ');
  return applicationModelSchema.parse({
    ...model,
    objects: model.objects.map((object) => object.key === target.key ? {
      ...object,
      fields: [...object.fields, {
        key,
        label: input.label.trim(),
        type: input.type,
        required: false,
        ...(input.type === 'text' ? { maxLength: 160 } : {}),
        ...(numeric && input.min !== undefined ? { min: input.min } : {}),
        ...(numeric && input.max !== undefined ? { max: input.max } : {}),
        ...(numeric && input.defaultValue !== undefined ? { defaultValue: input.defaultValue } : {}),
      }],
    } : object),
  });
}

/** Adds an optional enum with unique labels and deterministic option values, without creating a process status. */
export function addOptionalApplicationEnumField(model: ApplicationModel, input: ApplicationEnumFieldInput): ApplicationModel {
  const target = model.objects.find((object) => object.key === input.objectKey);
  if (!target) throw new Error('Objet cible introuvable dans le brouillon.');
  if (input.options.length < 2 || input.options.length > 40) throw new Error('Choisissez entre 2 et 40 options.');
  const labels = new Set<string>();
  const values: string[] = [];
  const options = input.options.map((option) => {
    const label = option.trim();
    if (!label) throw new Error('Les options ne peuvent pas être vides.');
    const normalized = label.toLowerCase();
    if (labels.has(normalized)) throw new Error('Les libellés des options doivent être uniques.');
    labels.add(normalized);
    const value = uniqueApplicationKey(label, values, 'option');
    values.push(value);
    return { value, label };
  });
  const key = uniqueApplicationKey(input.key.trim() || input.label, target.fields.map((field) => field.key), 'champ');
  return applicationModelSchema.parse({
    ...model,
    objects: model.objects.map((object) => object.key === target.key ? {
      ...object,
      fields: [...object.fields, { key, label: input.label.trim(), type: 'enum', required: false, options }],
    } : object),
  });
}

/** Adds one single-source transition while preserving statuses, actions and role grants. */
export function addApplicationTransition(model: ApplicationModel, input: ApplicationTransitionInput): ApplicationModel {
  const target = model.objects.find((object) => object.key === input.objectKey);
  if (!target) throw new Error('Objet du processus introuvable dans le brouillon.');
  const status = target.fields.find((field) => field.key === target.statusField);
  if (!status || status.type !== 'enum' || !status.options) throw new Error('Cet objet ne possède pas de statut utilisable.');
  const statuses = new Set(status.options.map((option) => option.value));
  if (!statuses.has(input.from) || !statuses.has(input.to)) throw new Error('Les statuts source et cible doivent appartenir au processus.');
  if (input.from === input.to) throw new Error('La transition doit changer de statut.');
  const key = uniqueApplicationKey(input.key.trim() || input.label, target.actions.map((action) => action.key), 'action');
  return applicationModelSchema.parse({
    ...model,
    objects: model.objects.map((object) => object.key === target.key ? {
      ...object,
      actions: [...object.actions, { key, label: input.label.trim(), from: [input.from], to: input.to }],
    } : object),
  });
}

/** Replaces only one object's visible columns, preserving every field, record and grant. */
export function setApplicationObjectColumns(model: ApplicationModel, input: ApplicationColumnsInput): ApplicationModel {
  const target = model.objects.find((object) => object.key === input.objectKey);
  if (!target) throw new Error('Objet du tableau introuvable dans le brouillon.');
  if (!input.columns.length || input.columns.length > 12) throw new Error('Choisissez entre 1 et 12 colonnes.');
  if (new Set(input.columns).size !== input.columns.length) throw new Error('Une colonne ne peut apparaître qu’une fois.');
  const available = new Set(target.fields.map((field) => field.key));
  if (input.columns.some((key) => !available.has(key))) throw new Error('Chaque colonne doit correspondre à un champ de cet objet.');
  return applicationModelSchema.parse({
    ...model,
    objects: model.objects.map((object) => object.key === target.key ? { ...object, columns: [...input.columns] } : object),
  });
}

/** Adds one optional relation without changing existing fields, columns, actions or grants. */
export function addOptionalApplicationRelationField(model: ApplicationModel, input: ApplicationRelationFieldInput): ApplicationModel {
  const source = model.objects.find((object) => object.key === input.objectKey);
  const linked = model.objects.find((object) => object.key === input.targetObject);
  if (!source) throw new Error('Objet source introuvable dans le brouillon.');
  if (!linked) throw new Error('Objet lié introuvable dans le brouillon.');
  const key = uniqueApplicationKey(input.key.trim() || input.label, source.fields.map((field) => field.key), 'champ');
  return applicationModelSchema.parse({
    ...model,
    objects: model.objects.map((object) => object.key === source.key ? {
      ...object,
      fields: [...object.fields, { key, label: input.label.trim(), type: 'relation', required: false, targetObject: linked.key }],
    } : object),
  });
}
