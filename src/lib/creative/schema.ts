import { z } from 'zod';
import type { CreativeDirection, CreativeDirectionResult } from './types';

const text = (max: number) => z.string().trim().min(1).max(max);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const font = z.string().trim().min(1).max(180).refine((value) => !/[;{}<>\\]/.test(value) && !/(?:url|expression|javascript|@import)\s*\(?/i.test(value));

export const creativeDirectionSchema: z.ZodType<CreativeDirection> = z.object({
  schemaVersion: z.literal('1.0.0'),
  engine: z.enum(['local-rules-v1', 'openai-structured-v1']),
  conceptId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  name: text(100), intent: text(500), audience: text(300), emotion: text(240),
  personality: z.array(text(60)).min(2).max(5), concept: text(700), rationale: text(700),
  palette: z.object({
    mode: z.enum(['light', 'dark']), primary: color, secondary: color, accent: color,
    background: color, surface: color, text: color, muted: color, rationale: text(500),
  }).strict(),
  typography: z.object({
    headingFont: font, bodyFont: font, scale: z.enum(['monumental', 'editorial', 'balanced']), rationale: text(500),
  }).strict(),
  composition: z.object({
    heroLayout: z.enum(['split', 'editorial', 'immersive', 'monumental', 'product-stage']),
    featuresLayout: z.enum(['cards', 'editorial', 'minimal']), galleryLayout: z.enum(['grid', 'editorial', 'filmstrip']),
    rhythm: z.enum(['compact', 'balanced', 'airy']), rationale: text(500),
  }).strict(),
  imagery: z.object({ treatment: z.enum(['plain', 'organic', 'framed', 'orbital', 'duotone', 'product']), guidance: text(500) }).strict(),
  motion: z.object({ preset: z.enum(['fade', 'rise', 'reveal', 'scale']), intensity: z.enum(['subtle', 'expressive']), rationale: text(500) }).strict(),
  conversion: z.object({ goal: text(300), action: text(120) }).strict(),
  constraints: z.array(text(240)).min(3).max(8),
}).strict() as z.ZodType<CreativeDirection>;

export const creativeDirectionResultSchema: z.ZodType<CreativeDirectionResult> = z.object({
  candidates: z.array(creativeDirectionSchema).length(3),
  selectedId: z.string().max(80),
  evaluations: z.array(z.object({ conceptId: z.string().max(80), score: z.number().min(0).max(100), reasons: z.array(z.string().max(240)).max(8) }).strict()).length(3),
  diversity: z.object({ score: z.number().min(0).max(100), uniqueCompositions: z.number().int().min(0).max(3), uniquePalettes: z.number().int().min(0).max(3), sharedDecisions: z.array(z.string().max(240)).max(8) }).strict(),
}).strict().superRefine((result, context) => {
  const ids = new Set(result.candidates.map((candidate) => candidate.conceptId));
  if (ids.size !== result.candidates.length) context.addIssue({ code: 'custom', path: ['candidates'], message: 'Concepts dupliqués.' });
  if (!ids.has(result.selectedId)) context.addIssue({ code: 'custom', path: ['selectedId'], message: 'Concept sélectionné introuvable.' });
  if (result.evaluations.some((evaluation) => !ids.has(evaluation.conceptId))) context.addIssue({ code: 'custom', path: ['evaluations'], message: 'Évaluation sans concept.' });
  const evaluationIds = new Set(result.evaluations.map((evaluation) => evaluation.conceptId));
  if (evaluationIds.size !== result.evaluations.length || [...ids].some((id) => !evaluationIds.has(id))) context.addIssue({ code: 'custom', path: ['evaluations'], message: 'Chaque concept doit avoir une unique évaluation.' });
}) as z.ZodType<CreativeDirectionResult>;

export function selectedCreativeDirection(result: CreativeDirectionResult): CreativeDirection {
  const parsed = creativeDirectionResultSchema.parse(result);
  return parsed.candidates.find((candidate) => candidate.conceptId === parsed.selectedId)!;
}
