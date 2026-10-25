import { applicationModelSchema, type ApplicationModel } from './model';

export type SimpleApplicationObjectInput = {
  label: string;
  pluralLabel: string;
  key: string;
  description: string;
};

function applicationKeyBase(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const prefixed = /^[a-z]/.test(slug) ? slug : `objet${slug ? `-${slug}` : ''}`;
  return prefixed.slice(0, 48).replace(/-+$/g, '') || 'objet';
}

export function uniqueApplicationKey(value: string, existingKeys: readonly string[]): string {
  const base = applicationKeyBase(value);
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
