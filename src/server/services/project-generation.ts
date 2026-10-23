import OpenAI from 'openai';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@/lib/id';
import { CatalogError, resolveProjectCreation, type CatalogSelectionSnapshot } from '@/lib/catalog';
import { buildProjectDraft, buildProjectGenerationPrompt, createLocalProjectContent, createProjectGenerationContext, creationSelectionSchema, projectContentSchema, sameCatalogSnapshot } from '@/lib/catalog/generation';
import { functionalModuleIds, type ProjectContent, type ProjectGenerationContext } from '@/lib/catalog/types';
import { creativeDirectionResultSchema } from '@/lib/creative/schema';
import type { CreativeDirectionResult } from '@/lib/creative/types';
import { getDb, type Db } from '@/server/db';
import { aiGenerations } from '@/server/db/schema';
import { ApiError } from '@/server/http';
import { requireMembership } from '@/server/auth/tenancy';
import { assertAiQuota } from './quotas';

const snapshotSchema = z.object({
  version: z.literal(1),
  siteTypeId: z.string().nullable(),
  activityDomainId: z.string().nullable(),
  designStyleId: z.string(),
  blueprintId: z.string(),
  templateId: z.string(),
  locale: z.enum(['fr', 'en']),
  moduleIds: z.array(z.enum(functionalModuleIds)),
}).strict();
const storedOutputSchema = z.object({ content: projectContentSchema, snapshot: snapshotSchema, creative: creativeDirectionResultSchema }).strict();

function resolveOrApiError(input: z.output<typeof creationSelectionSchema>) {
  try {
    return resolveProjectCreation(input);
  } catch (error) {
    if (error instanceof CatalogError) throw new ApiError(422, error.code, error.message);
    throw error;
  }
}

function contentJsonSchema() {
  return {
    type: 'object', additionalProperties: false,
    required: ['heroEyebrow', 'heroTitle', 'heroDescription', 'seoDescription'],
    properties: {
      heroEyebrow: { type: 'string', maxLength: 180 },
      heroTitle: { type: 'string', maxLength: 240 },
      heroDescription: { type: 'string', maxLength: 1200 },
      seoDescription: { type: 'string', maxLength: 300 },
    },
  };
}

async function openAiProjectContent(context: ProjectGenerationContext): Promise<{ content: ProjectContent; model: string; inputUnits: number; outputUnits: number }> {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) throw new ApiError(503, 'AI_NOT_CONFIGURED', 'Configurez OPENAI_API_KEY et OPENAI_MODEL, ou choisissez AI_PROVIDER=demo.');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL,
    input: [
      { role: 'system', content: 'Tu produis uniquement quatre champs textuels pour un site Woob. Aucun HTML, markdown, script, témoignage, prix ou capacité non listée. Le JSON doit respecter le schéma.' },
      { role: 'user', content: buildProjectGenerationPrompt(context) },
    ],
    text: { format: { type: 'json_schema', name: 'woob_project_content', strict: true, schema: contentJsonSchema() } },
  });
  return {
    content: projectContentSchema.parse(JSON.parse(response.output_text)),
    model: process.env.OPENAI_MODEL,
    inputUnits: response.usage?.input_tokens || 0,
    outputUnits: response.usage?.output_tokens || 0,
  };
}

export async function generateProjectPreview(userId: string, workspaceId: string, input: unknown, db?: Db) {
  const data = creationSelectionSchema.parse(input);
  const database = db ?? await getDb();
  await requireMembership(userId, workspaceId, 'edit', database);
  await assertAiQuota(workspaceId, database);
  const resolved = resolveOrApiError(data);
  const context = createProjectGenerationContext(data, resolved);
  const provider = process.env.AI_PROVIDER === 'openai' ? 'openai' : 'demo';
  const generationId = createId('generation');
  const prompt = buildProjectGenerationPrompt(context);
  await database.insert(aiGenerations).values({
    id: generationId, workspaceId, projectId: null, requestedBy: userId, kind: 'project_create', provider,
    model: provider === 'demo' ? 'local-project-v1' : process.env.OPENAI_MODEL || 'unconfigured',
    state: 'processing', prompt,
  });
  try {
    const result = provider === 'demo'
      ? { content: createLocalProjectContent(context), model: 'local-project-v1', inputUnits: 0, outputUnits: 0 }
      : await openAiProjectContent(context);
    const draft = buildProjectDraft(data, result.content, resolved);
    await database.update(aiGenerations).set({
      state: 'completed', output: { content: result.content, snapshot: draft.snapshot, creative: draft.creative }, model: result.model,
      inputUnits: result.inputUnits, outputUnits: result.outputUnits, completedAt: new Date(),
    }).where(and(eq(aiGenerations.id, generationId), eq(aiGenerations.workspaceId, workspaceId)));
    return { generationId, provider, model: result.model, demo: provider === 'demo', draft };
  } catch (error) {
    await database.update(aiGenerations).set({
      state: 'failed', errorCode: error instanceof ApiError ? error.code : 'PROVIDER_OR_VALIDATION_ERROR', completedAt: new Date(),
    }).where(and(eq(aiGenerations.id, generationId), eq(aiGenerations.workspaceId, workspaceId)));
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, 'PROJECT_GENERATION_FAILED', 'La génération a échoué ou sa réponse est invalide. Aucun projet n’a été créé.');
  }
}

export async function readProjectGeneration(userId: string, workspaceId: string, generationId: string, expected: CatalogSelectionSnapshot, db: Db, conceptId?: string): Promise<{ content: ProjectContent; creative: CreativeDirectionResult }> {
  const row = (await db.select().from(aiGenerations).where(and(
    eq(aiGenerations.id, generationId), eq(aiGenerations.workspaceId, workspaceId), eq(aiGenerations.requestedBy, userId),
    eq(aiGenerations.kind, 'project_create'), eq(aiGenerations.state, 'completed'), isNull(aiGenerations.projectId),
  )).limit(1))[0];
  if (!row) throw new ApiError(404, 'GENERATION_NOT_FOUND', 'Cette prévisualisation est introuvable ou a déjà été utilisée.');
  const parsed = storedOutputSchema.safeParse(row.output);
  if (!parsed.success) throw new ApiError(409, 'GENERATION_INVALID', 'Cette prévisualisation ne contient pas un résultat réutilisable.');
  if (!sameCatalogSnapshot(parsed.data.snapshot, expected)) throw new ApiError(409, 'GENERATION_SELECTION_MISMATCH', 'La sélection a changé. Générez une nouvelle prévisualisation.');
  if (conceptId && !parsed.data.creative.candidates.some((candidate) => candidate.conceptId === conceptId)) throw new ApiError(422, 'CONCEPT_NOT_FOUND', 'Ce concept ne fait pas partie de la prévisualisation.');
  return { content: parsed.data.content, creative: conceptId ? { ...parsed.data.creative, selectedId: conceptId } : parsed.data.creative };
}
