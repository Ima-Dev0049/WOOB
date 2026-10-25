import { applicationModelSchema, type ApplicationModel } from './model';

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
export type ApplicationTypedFieldInput = ApplicationTextFieldInput & { type: 'text' | 'integer' | 'number' | 'date' };

function applicationKeyBase(value: string, prefix: 'objet' | 'champ'): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const prefixed = /^[a-z]/.test(slug) ? slug : `${prefix}${slug ? `-${slug}` : ''}`;
  return prefixed.slice(0, 48).replace(/-+$/g, '') || prefix;
}

export function uniqueApplicationKey(value: string, existingKeys: readonly string[], prefix: 'objet' | 'champ' = 'objet'): string {
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
      }],
    } : object),
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
