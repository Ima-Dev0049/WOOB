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
export type ApplicationTypedFieldInput = ApplicationTextFieldInput & { type: 'text' | 'integer' | 'number' | 'boolean' | 'date'; min?: number; max?: number; defaultValue?: number | string };
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
  const dated = input.type === 'date';
  if (!numeric && (input.min !== undefined || input.max !== undefined)) throw new Error('Les bornes sont réservées aux champs numériques.');
  if (!numeric && !dated && input.defaultValue !== undefined) throw new Error('La valeur par défaut configurable est réservée aux champs numériques et aux dates.');
  if (input.defaultValue !== undefined && ((numeric && typeof input.defaultValue !== 'number') || (dated && typeof input.defaultValue !== 'string'))) throw new Error('La valeur par défaut ne correspond pas au type du champ.');
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
        ...((numeric || dated) && input.defaultValue !== undefined ? { defaultValue: input.defaultValue } : {}),
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

export type ApplicationFieldEditInput = {
  objectKey: string;
  fieldKey: string;
  label?: string | undefined;
  min?: number | null | undefined;
  max?: number | null | undefined;
  defaultValue?: number | string | boolean | null | undefined;
};

/**
 * Edits one draft field without changing its key, its stored values or any role grant.
 * `undefined` keeps a setting, `null` removes it; the parsed schema revalidates bounds and defaults.
 */
export function updateApplicationDraftField(model: ApplicationModel, input: ApplicationFieldEditInput): ApplicationModel {
  const target = model.objects.find((object) => object.key === input.objectKey);
  if (!target) throw new Error('Objet cible introuvable dans le brouillon.');
  const field = target.fields.find((candidate) => candidate.key === input.fieldKey);
  if (!field) throw new Error('Champ cible introuvable dans le brouillon.');
  if (field.type === 'relation') throw new Error('Une relation ne peut pas être modifiée depuis le brouillon.');
  const numeric = field.type === 'integer' || field.type === 'number';
  const dated = field.type === 'date';
  const boolean = field.type === 'boolean';
  const touchesBounds = input.min !== undefined || input.max !== undefined;
  const touchesDefault = input.defaultValue !== undefined;
  if (field.key === target.statusField && (touchesBounds || touchesDefault)) throw new Error('Le champ de statut conserve sa valeur initiale.');
  if (touchesBounds && !numeric) throw new Error('Les bornes sont réservées aux champs numériques.');
  if (touchesDefault && !numeric && !dated && !boolean) throw new Error('La valeur par défaut configurable est réservée aux champs numériques, aux dates et aux booléens.');
  if (input.label !== undefined && !input.label.trim()) throw new Error('Le libellé du champ est obligatoire.');
  const candidate: Record<string, unknown> = { ...field };
  if (input.label !== undefined) candidate.label = input.label.trim();
  if (numeric) {
    if (input.min !== undefined) {
      if (input.min === null) delete candidate.min;
      else candidate.min = input.min;
    }
    if (input.max !== undefined) {
      if (input.max === null) delete candidate.max;
      else candidate.max = input.max;
    }
  }
  if (touchesDefault) {
    if (input.defaultValue === null) delete candidate.defaultValue;
    else if (numeric && typeof input.defaultValue !== 'number') throw new Error('La valeur par défaut doit être un nombre.');
    else if (dated && typeof input.defaultValue !== 'string') throw new Error('La valeur par défaut doit être une date.');
    else if (boolean && typeof input.defaultValue !== 'boolean') throw new Error('La valeur par défaut doit être un booléen.');
    else candidate.defaultValue = input.defaultValue;
  }
  return applicationModelSchema.parse({
    ...model,
    objects: model.objects.map((object) => object.key === target.key
      ? { ...object, fields: object.fields.map((current) => current.key === field.key ? candidate : current) }
      : object),
  });
}

export type ApplicationFieldRemovalInput = { objectKey: string; fieldKey: string };

/**
 * Removes one draft field and its column reference only. The server still refuses a field
 * that already holds data, and the title and status fields stay mandatory.
 */
export function removeApplicationDraftField(model: ApplicationModel, input: ApplicationFieldRemovalInput): ApplicationModel {
  const target = model.objects.find((object) => object.key === input.objectKey);
  if (!target) throw new Error('Objet cible introuvable dans le brouillon.');
  const field = target.fields.find((candidate) => candidate.key === input.fieldKey);
  if (!field) throw new Error('Champ cible introuvable dans le brouillon.');
  if (field.key === target.titleField) throw new Error('Le champ titre ne peut pas être supprimé.');
  if (field.key === target.statusField) throw new Error('Le champ de statut ne peut pas être supprimé.');
  if (target.fields.length <= 1) throw new Error('Un objet doit conserver au moins un champ.');
  return applicationModelSchema.parse({
    ...model,
    objects: model.objects.map((object) => {
      if (object.key !== target.key) return object;
      const fields = object.fields.filter((candidate) => candidate.key !== field.key);
      if (!object.columns) return { ...object, fields };
      const columns = object.columns.filter((key) => key !== field.key);
      return { ...object, fields, columns: columns.length ? columns : [object.titleField] };
    }),
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
