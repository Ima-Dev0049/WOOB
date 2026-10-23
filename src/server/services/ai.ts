import OpenAI from 'openai';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@/lib/id';
import { aiProposalSchema, applyAiProposal, type AiProposal } from '@/lib/document/ai';
import { findNode } from '@/lib/document/validation';
import { getDb, type Db } from '@/server/db';
import { aiGenerations, pages } from '@/server/db/schema';
import { ApiError } from '@/server/http';
import { requireProject } from '@/server/auth/tenancy';
import { assertAiQuota } from './quotas';

const requestSchema = z.object({ instruction: z.string().trim().min(3).max(1000), selectedNodeId: z.string().max(160).optional() });
type AiRequest = z.infer<typeof requestSchema>;

function demoProposal(page: typeof pages.$inferSelect, request: AiRequest): AiProposal {
  const subject = request.instruction.replace(/[<>]/g, '').slice(0, 180);
  const selected = request.selectedNodeId ? findNode(page.draftDocument.root, request.selectedNodeId) : undefined;
  if (selected && ['heading', 'hero', 'text', 'cta'].includes(selected.type)) {
    if (selected.type === 'heading') return { summary: 'Proposition locale de reformulation du titre sélectionné.', operations: [{ kind: 'updateProps', nodeId: selected.id, props: { text: `${subject} : une approche claire et utile` } }] };
    if (selected.type === 'hero') return { summary: 'Proposition locale pour le hero, sans appel à un modèle distant.', operations: [{ kind: 'updateProps', nodeId: selected.id, props: { eyebrow: 'Une nouvelle perspective', title: subject, description: 'Une présentation concise de votre valeur, avec une invitation simple à découvrir votre univers et à passer à l’action.' } }] };
    if (selected.type === 'text') return { summary: 'Proposition locale de paragraphe éditorial.', operations: [{ kind: 'updateProps', nodeId: selected.id, props: { text: `${subject}. Découvrez une approche attentive, des réalisations soignées et un échange simple pour donner vie à vos ambitions.` } }] };
    return { summary: 'Proposition locale pour l’appel à l’action.', operations: [{ kind: 'updateProps', nodeId: selected.id, props: { title: subject, description: 'Parlons de votre prochaine étape et construisons une expérience qui vous ressemble.', buttonLabel: 'Commencer' } }] };
  }
  return { summary: 'Nouvelle section générée localement à partir de votre consigne.', operations: [{ kind: 'insertComponent', targetId: selected?.id || page.draftDocument.root.id, position: selected ? 'after' : 'inside', component: 'section', props: { title: subject, description: 'Une section ajoutée en mode démo. Vous pouvez modifier chaque détail avant de la conserver.' } }] };
}

function jsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'operations'],
    properties: {
      summary: { type: 'string' },
      operations: {
        type: 'array',
        maxItems: 10,
        items: {
          anyOf: [
            { type: 'object', additionalProperties: false, required: ['kind', 'nodeId', 'props'], properties: { kind: { const: 'updateProps' }, nodeId: { type: 'string' }, props: { type: 'object', additionalProperties: true } } },
            { type: 'object', additionalProperties: false, required: ['kind', 'targetId', 'position', 'component', 'props'], properties: { kind: { const: 'insertComponent' }, targetId: { type: 'string' }, position: { enum: ['before', 'after', 'inside'] }, component: { type: 'string' }, props: { type: 'object', additionalProperties: true } } },
          ],
        },
      },
    },
  };
}

async function openAiProposal(page: typeof pages.$inferSelect, request: AiRequest): Promise<{ proposal: AiProposal; model: string; inputUnits: number; outputUnits: number }> {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) throw new ApiError(503, 'AI_NOT_CONFIGURED', 'Configurez OPENAI_API_KEY et OPENAI_MODEL, ou choisissez AI_PROVIDER=demo.');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 });
  const response = await client.responses.create({ model: process.env.OPENAI_MODEL, input: [{ role: 'system', content: 'Tu produis uniquement une proposition JSON pour un éditeur de site. N’invente pas d’ID. N’utilise que les composants et propriétés présents dans le document. Aucun HTML, script ou URL javascript.' }, { role: 'user', content: `Consigne : ${request.instruction}\nComposant sélectionné : ${request.selectedNodeId || 'racine'}\nDocument : ${JSON.stringify(page.draftDocument)}` }], text: { format: { type: 'json_schema', name: 'woob_page_proposal', strict: true, schema: jsonSchema() } } });
  const parsed = aiProposalSchema.parse(JSON.parse(response.output_text));
  return { proposal: parsed, model: process.env.OPENAI_MODEL, inputUnits: response.usage?.input_tokens || 0, outputUnits: response.usage?.output_tokens || 0 };
}

export async function generateAiProposal(userId: string, pageId: string, input: unknown, db?: Db) {
  const request = requestSchema.parse(input);
  const database = db ?? await getDb();
  const page = (await database.select().from(pages).where(eq(pages.id, pageId)).limit(1))[0];
  if (!page) throw new ApiError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
  const project = await requireProject(userId, page.projectId, 'edit', database);
  await assertAiQuota(project.workspaceId, database);
  const provider = process.env.AI_PROVIDER === 'openai' ? 'openai' : 'demo';
  const generationId = createId('generation');
  await database.insert(aiGenerations).values({ id: generationId, workspaceId: project.workspaceId, projectId: project.id, requestedBy: userId, kind: 'page_edit', provider, model: provider === 'demo' ? 'local-template-v1' : process.env.OPENAI_MODEL || 'unconfigured', state: 'processing', prompt: request.instruction });
  try {
    const result = provider === 'demo' ? { proposal: demoProposal(page, request), model: 'local-template-v1', inputUnits: 0, outputUnits: 0 } : await openAiProposal(page, request);
    applyAiProposal(page.draftDocument, result.proposal);
    await database.update(aiGenerations).set({ state: 'completed', output: result.proposal, model: result.model, inputUnits: result.inputUnits, outputUnits: result.outputUnits, completedAt: new Date() }).where(and(eq(aiGenerations.id, generationId), eq(aiGenerations.workspaceId, project.workspaceId)));
    return { id: generationId, proposal: result.proposal, provider, model: result.model, demo: provider === 'demo' };
  } catch (error) {
    await database.update(aiGenerations).set({ state: 'failed', errorCode: error instanceof ApiError ? error.code : 'PROVIDER_OR_VALIDATION_ERROR', completedAt: new Date() }).where(eq(aiGenerations.id, generationId));
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, 'AI_GENERATION_FAILED', 'La génération a échoué ou sa réponse n’est pas valide. Aucune modification n’a été appliquée.');
  }
}
