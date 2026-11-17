import { z } from 'zod';
import type { ApplicationField, ApplicationObject } from './model';

export type PortalChoice = { value: string; label: string };

export type PortalField = {
  key: string;
  label: string;
  type: ApplicationField['type'];
  required: boolean;
  help?: string;
  options?: PortalChoice[];
  relation?: { targetObject: string; targetLabel: string; options: PortalChoice[] };
};

export type SitePortal = {
  enabled: true;
  project: { name: string; slug: string };
  title: string;
  intro: string;
  objectKey: string;
  objectLabel: string;
  fields: PortalField[];
};

export type SitePortalItem = {
  id: string;
  title: string;
  status: string | null;
  statusLabel: string | null;
  createdAt: string;
};

/**
 * Configuration of the per-site end-user portal. It only names an existing managed object:
 * the public form fields are always derived from the model, never stored twice.
 */
export const publicIntakeSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  objectKey: z.string().trim().regex(/^[a-z][a-z0-9-]*$/, 'Clé d’objet invalide.').max(48).optional(),
  title: z.string().trim().max(120).optional(),
  intro: z.string().trim().max(500).optional(),
});

export type PublicIntakeSettings = z.infer<typeof publicIntakeSettingsSchema>;

/** A bounded public form: twelve fields at most, status excluded, relations included as choice lists. */
export const PUBLIC_INTAKE_FIELD_LIMIT = 12;

export function publicIntakeFields(object: ApplicationObject): ApplicationField[] {
  if (!object.statusField) return [];
  const candidates = object.fields.filter((field) => field.key !== object.statusField);
  const required = candidates.filter((field) => field.required);
  const optional = candidates.filter((field) => !field.required);
  const selected = [...required, ...optional];
  if (required.length > PUBLIC_INTAKE_FIELD_LIMIT) return [];
  return selected.slice(0, PUBLIC_INTAKE_FIELD_LIMIT);
}

/** Only a bounded object with a status keeps a moderation workflow in the Studio back-office. */
export function publicIntakeEligible(object: ApplicationObject): boolean {
  return publicIntakeFields(object).length > 0;
}
