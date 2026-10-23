import OpenAI from 'openai';
import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@/lib/id';
import { aiProposalSchema, applyAiProposal, type AiProposal } from '@/lib/document/ai';
import { designSystemSchema, findNode, nodeMotionSchema, nodeStyleSchema } from '@/lib/document/validation';
import { supportsScrollMotion } from '@/lib/document/types';
import { getDesignSystem } from '@/lib/document/design-system';
import { flattenNodes } from '@/lib/document/operations';
import { evaluateScene3DFit } from '@/lib/creative/scene3d';
import { getDb, type Db } from '@/server/db';
import { aiGenerations, pages } from '@/server/db/schema';
import { ApiError } from '@/server/http';
import { requireProject } from '@/server/auth/tenancy';
import { assertAiQuota } from './quotas';

const requestSchema = z.object({ instruction: z.string().trim().min(3).max(1000), selectedNodeId: z.string().max(160).optional(), requestId: z.string().uuid().optional() });
type AiRequest = z.infer<typeof requestSchema>;

function demoProposal(page: typeof pages.$inferSelect, request: AiRequest): AiProposal {
  const subject = request.instruction.replace(/[<>]/g, '').slice(0, 180);
  const selected = request.selectedNodeId ? findNode(page.draftDocument.root, request.selectedNodeId) : undefined;
  const sceneFit = evaluateScene3DFit(request.instruction);
  if (sceneFit.eligible) {
    const existing = flattenNodes(page.draftDocument.root).find((node) => node.type === 'scene3d');
    const target = selected?.type === 'scene3d' ? selected : existing;
    if (target && /(?:supprim|retir)/i.test(request.instruction)) {
      return { summary: 'Suppression locale de la scène 3D, à confirmer dans l’aperçu.', operations: [{ kind: 'scene3d', action: 'remove', targetId: target.id, position: 'after', props: {} }] };
    }
    if (!target && /(?:supprim|retir)/i.test(request.instruction)) throw new ApiError(422, 'SCENE3D_NOT_FOUND', 'Aucune scène 3D à supprimer sur cette page.');
    const props = {
      ...(/prisme/i.test(request.instruction) ? { preset: 'prism' as const } : /orbite|orbital/i.test(request.instruction) ? { preset: 'orbital' as const } : {}),
      ...(/équilibr|equilibr/i.test(request.instruction) ? { quality: 'balanced' as const } : /économe|econome/i.test(request.instruction) ? { quality: 'low' as const } : {}),
      ...(/sans rotation|statique/i.test(request.instruction) ? { autoRotate: false } : /rotation automatique/i.test(request.instruction) ? { autoRotate: true } : {}),
      ...(/sans interaction/i.test(request.instruction) ? { interactive: false } : /interaction|manuel/i.test(request.instruction) ? { interactive: true } : {}),
    };
    if (target) {
      return { summary: 'Configuration locale de la scène 3D existante, sans toucher aux autres blocs.', operations: [{ kind: 'scene3d', action: 'update', targetId: target.id, position: 'after', props: Object.keys(props).length ? props : { interactive: true } }] };
    }
    return { summary: 'Scène 3D procédurale bornée, proposée localement et visible avant acceptation.', operations: [{ kind: 'scene3d', action: 'insert', targetId: selected?.id || page.draftDocument.root.id, position: selected && selected.type !== 'page' ? 'after' : 'inside', props }] };
  }
  const motionRequested = /(?:parallax|parallaxe|scroll|d[ée]filement|mouvement|motion|animation|animer|anim[ée]e?)/i.test(request.instruction);
  if (motionRequested) {
    if (!selected || selected.type === 'page') throw new ApiError(422, 'MOTION_TARGET_REQUIRED', 'Sélectionnez un bloc précis avant de demander une modification de motion.');
    const remove = /(?:d[ée]sactiv|supprim|retir|enlev)/i.test(request.instruction) || /\bsans\s+(?:animation|mouvement|motion|parallaxe)/i.test(request.instruction);
    if (remove) return { summary: 'Suppression locale du motion du bloc sélectionné, à confirmer dans l’aperçu.', operations: [{ kind: 'updateMotion', nodeId: selected.id, motion: null }] };
    const scroll = /(?:parallax|parallaxe|scroll|d[ée]filement)/i.test(request.instruction);
    if (scroll && !supportsScrollMotion(selected.type)) throw new ApiError(422, 'MOTION_TARGET_UNSUPPORTED', 'La navigation, les formulaires et la 3D ne peuvent pas recevoir de motion lié au défilement.');
    if (scroll && flattenNodes(page.draftDocument.root).filter((node) => node.id !== selected.id && node.motion?.trigger === 'scroll').length >= 3) throw new ApiError(422, 'MOTION_BUDGET_EXCEEDED', 'Cette page contient déjà trois effets liés au défilement.');
    const distanceMatch = request.instruction.match(/(\d{1,3})\s*(?:px|pixels?)/i);
    const distance = Math.min(96, Math.max(0, Number(distanceMatch?.[1] ?? selected.motion?.distance ?? (scroll ? 48 : 24))));
    if (scroll) return { summary: 'Parallaxe locale bornée sur le bloc sélectionné, sans modifier les autres blocs.', operations: [{ kind: 'updateMotion', nodeId: selected.id, motion: { preset: 'parallax', trigger: 'scroll', duration: selected.motion?.duration ?? 460, delay: 0, distance } }] };
    const preset = /fondu/i.test(request.instruction) ? 'fade' : /r[ée]v[ée]lation|reveal/i.test(request.instruction) ? 'reveal' : /[ée]chelle|scale/i.test(request.instruction) ? 'scale' : 'rise';
    return { summary: 'Entrée animée locale sur le bloc sélectionné, à confirmer dans l’aperçu.', operations: [{ kind: 'updateMotion', nodeId: selected.id, motion: { preset, trigger: 'in-view', duration: selected.motion?.duration ?? 460, delay: selected.motion?.delay ?? 0, distance } }] };
  }
  if (/(?:th[èe]me|palette|couleur|sombre|dark mode)/i.test(request.instruction)) {
    const designSystem = structuredClone(getDesignSystem(page.draftDocument.theme));
    const direction = /luxe|premium/i.test(request.instruction) ? 'luxe' : /nature|durable|bio/i.test(request.instruction) ? 'nature' : /tech|digital|logiciel/i.test(request.instruction) ? 'technologie' : 'personnalisée';
    const palettes = {
      luxe: { primary: '#76552B', secondary: '#24201D', accent: '#C59A52' },
      nature: { primary: '#2F6B4F', secondary: '#19382C', accent: '#8FAF72' },
      technologie: { primary: '#365CF5', secondary: '#111B3C', accent: '#36C5F0' },
      personnalisée: { primary: designSystem.tokens.colors.primary, secondary: designSystem.tokens.colors.secondary, accent: designSystem.tokens.colors.accent },
    } as const;
    Object.assign(designSystem.tokens.colors, palettes[direction]);
    designSystem.tokens.colors.link = designSystem.tokens.colors.primary;
    designSystem.tokens.colors.focus = designSystem.tokens.colors.primary;
    designSystem.tokens.darkColors.primary = designSystem.tokens.colors.primary;
    designSystem.tokens.darkColors.link = designSystem.tokens.colors.primary;
    designSystem.colorMode = /automatique|auto/i.test(request.instruction) ? 'auto' : /sombre|dark/i.test(request.instruction) ? 'dark' : 'light';
    designSystem.name = `Palette ${direction}`;
    return { summary: `Proposition locale d’un thème complet ${direction}, sans appel distant.`, operations: [{ kind: 'updateTheme', designSystem }] };
  }
  if (selected && /(?:arrondi|ombre|survol)/i.test(request.instruction)) {
    const styles = {
      ...(/arrondi/i.test(request.instruction) ? { borderRadius: '24px' } : {}),
      ...(/ombre/i.test(request.instruction) ? { boxShadow: '0 16px 40px rgb(15 23 42 / 18%)' } : {}),
      ...(/survol/i.test(request.instruction) ? { transform: 'translateY(-2px)' } : {}),
    };
    return { summary: 'Proposition locale de style structuré sur le composant sélectionné.', operations: [{ kind: 'updateStyle', nodeId: selected.id, viewport: /mobile/i.test(request.instruction) ? 'mobile' : /tablette/i.test(request.instruction) ? 'tablet' : 'desktop', ...(/survol/i.test(request.instruction) ? { state: 'hover' as const } : {}), styles }] };
  }
  if (selected && ['heading', 'hero', 'text', 'cta'].includes(selected.type)) {
    if (selected.type === 'heading') return { summary: 'Proposition locale de reformulation du titre sélectionné.', operations: [{ kind: 'updateProps', nodeId: selected.id, props: { text: `${subject} : une approche claire et utile` } }] };
    if (selected.type === 'hero') return { summary: 'Proposition locale pour le hero, sans appel à un modèle distant.', operations: [{ kind: 'updateProps', nodeId: selected.id, props: { eyebrow: 'Une nouvelle perspective', title: subject, description: 'Une présentation concise de votre valeur, avec une invitation simple à découvrir votre univers et à passer à l’action.' } }] };
    if (selected.type === 'text') return { summary: 'Proposition locale de paragraphe éditorial.', operations: [{ kind: 'updateProps', nodeId: selected.id, props: { text: `${subject}. Découvrez une approche attentive, des réalisations soignées et un échange simple pour donner vie à vos ambitions.` } }] };
    return { summary: 'Proposition locale pour l’appel à l’action.', operations: [{ kind: 'updateProps', nodeId: selected.id, props: { title: subject, description: 'Parlons de votre prochaine étape et construisons une expérience qui vous ressemble.', buttonLabel: 'Commencer' } }] };
  }
  return { summary: 'Nouvelle section générée localement à partir de votre consigne.', operations: [{ kind: 'insertComponent', targetId: selected?.id || page.draftDocument.root.id, position: selected ? 'after' : 'inside', component: 'section', props: { title: subject, description: 'Une section ajoutée en mode démo. Vous pouvez modifier chaque détail avant de la conserver.' } }] };
}

function jsonSchema() {
  const designSystem = z.toJSONSchema(designSystemSchema, { io: 'input' });
  const nodeStyle = z.toJSONSchema(nodeStyleSchema, { io: 'input' });
  const nodeMotion = z.toJSONSchema(nodeMotionSchema, { io: 'input' });
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
            { type: 'object', additionalProperties: false, required: ['kind', 'designSystem'], properties: { kind: { const: 'updateTheme' }, designSystem } },
            { type: 'object', additionalProperties: false, required: ['kind', 'nodeId', 'viewport', 'styles'], properties: { kind: { const: 'updateStyle' }, nodeId: { type: 'string' }, viewport: { enum: ['desktop', 'tablet', 'mobile'] }, state: { enum: ['hover', 'focus-visible', 'active', 'disabled'] }, styles: nodeStyle } },
            { type: 'object', additionalProperties: false, required: ['kind', 'nodeId', 'motion'], properties: { kind: { const: 'updateMotion' }, nodeId: { type: 'string' }, motion: { anyOf: [nodeMotion, { type: 'null' }] } } },
            { type: 'object', additionalProperties: false, required: ['kind', 'action', 'targetId', 'position', 'props'], properties: { kind: { const: 'scene3d' }, action: { enum: ['insert', 'update', 'remove'] }, targetId: { type: 'string' }, position: { enum: ['before', 'after', 'inside'] }, props: { type: 'object', additionalProperties: true } } },
          ],
        },
      },
    },
  };
}

async function openAiProposal(page: typeof pages.$inferSelect, request: AiRequest): Promise<{ proposal: AiProposal; model: string; inputUnits: number; outputUnits: number }> {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) throw new ApiError(503, 'AI_NOT_CONFIGURED', 'Configurez OPENAI_API_KEY et OPENAI_MODEL, ou choisissez AI_PROVIDER=demo.');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 });
  const response = await client.responses.create({ model: process.env.OPENAI_MODEL, input: [{ role: 'system', content: 'Tu produis uniquement une proposition JSON pour un éditeur de site. N’invente pas d’ID. N’utilise que les composants et propriétés présents dans le document, ou les capacités structurées scene3d et updateMotion lorsqu’elles sont explicitement demandées. Pour updateMotion, cible uniquement le composant sélectionné, utilise motion:null pour le retirer, et respecte trois effets scroll maximum par page ; jamais sur navigation, formulaire ou scene3d. Aucun HTML, script ou URL javascript.' }, { role: 'user', content: `Consigne : ${request.instruction}\nComposant sélectionné : ${request.selectedNodeId || 'racine'}\nDocument : ${JSON.stringify(page.draftDocument)}` }], text: { format: { type: 'json_schema', name: 'woob_page_proposal', strict: true, schema: jsonSchema() } } });
  const parsed = aiProposalSchema.parse(JSON.parse(response.output_text));
  return { proposal: parsed, model: process.env.OPENAI_MODEL, inputUnits: response.usage?.input_tokens || 0, outputUnits: response.usage?.output_tokens || 0 };
}

const AI_LEASE_MS = 120_000;
type AiGeneration = typeof aiGenerations.$inferSelect;
type AiProposalResult = { id: string; requestId: string; proposal: AiProposal; provider: string; model: string; demo: boolean; replayed: boolean };

function fingerprint(pageId: string, request: AiRequest): string {
  return createHash('sha256').update(JSON.stringify({ pageId, instruction: request.instruction, selectedNodeId: request.selectedNodeId ?? null })).digest('hex');
}

function completedResult(row: AiGeneration): AiProposalResult {
  if (!row.requestKey) throw new ApiError(500, 'AI_RESULT_INVALID', 'La génération journalisée ne contient pas sa clé de reprise.');
  const parsed = aiProposalSchema.safeParse(row.output);
  if (!parsed.success) throw new ApiError(500, 'AI_RESULT_INVALID', 'La génération journalisée ne contient pas une proposition réutilisable.');
  return { id: row.id, requestId: row.requestKey, proposal: parsed.data, provider: row.provider, model: row.model, demo: row.provider === 'demo', replayed: true };
}

async function executeAiGeneration(database: Db, row: AiGeneration, page: typeof pages.$inferSelect, request: AiRequest, attempt: number): Promise<AiProposalResult> {
  if (!row.requestKey) throw new ApiError(500, 'AI_RESULT_INVALID', 'La génération à exécuter ne contient pas sa clé de reprise.');
  try {
    const result = row.provider === 'demo' ? { proposal: demoProposal(page, request), model: 'local-template-v1', inputUnits: 0, outputUnits: 0 } : await openAiProposal(page, request);
    applyAiProposal(page.draftDocument, result.proposal);
    const completed = await database.update(aiGenerations).set({
      state: 'completed', output: result.proposal, model: result.model, errorCode: null, inputUnits: result.inputUnits, outputUnits: result.outputUnits, leaseExpiresAt: null, completedAt: new Date(),
    }).where(and(eq(aiGenerations.id, row.id), eq(aiGenerations.state, 'processing'), eq(aiGenerations.attempts, attempt))).returning();
    if (!completed[0]) throw new ApiError(409, 'AI_GENERATION_SUPERSEDED', 'Une reprise plus récente a remplacé cette exécution.');
    return { id: row.id, requestId: row.requestKey, proposal: result.proposal, provider: row.provider, model: result.model, demo: row.provider === 'demo', replayed: false };
  } catch (error) {
    await database.update(aiGenerations).set({ state: 'failed', errorCode: error instanceof ApiError ? error.code : 'PROVIDER_OR_VALIDATION_ERROR', leaseExpiresAt: null, completedAt: new Date() })
      .where(and(eq(aiGenerations.id, row.id), eq(aiGenerations.state, 'processing'), eq(aiGenerations.attempts, attempt)));
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, 'AI_GENERATION_FAILED', 'La génération a échoué ou sa réponse n’est pas valide. Aucune modification n’a été appliquée.');
  }
}

export async function generateAiProposal(userId: string, pageId: string, input: unknown, db?: Db): Promise<AiProposalResult> {
  const parsed = requestSchema.parse(input);
  const requestId = parsed.requestId ?? createId('request');
  const request: AiRequest = { ...parsed, requestId };
  const requestHash = fingerprint(pageId, request);
  const database = db ?? await getDb();
  const page = (await database.select().from(pages).where(eq(pages.id, pageId)).limit(1))[0];
  if (!page) throw new ApiError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
  const project = await requireProject(userId, page.projectId, 'edit', database);
  const findExisting = async () => (await database.select().from(aiGenerations).where(and(
    eq(aiGenerations.workspaceId, project.workspaceId), eq(aiGenerations.requestedBy, userId), eq(aiGenerations.requestKey, requestId),
  )).limit(1))[0];
  const resolveExisting = async (row: AiGeneration): Promise<AiProposalResult> => {
    if (row.kind !== 'page_edit' || row.pageId !== pageId || row.requestHash !== requestHash) throw new ApiError(409, 'AI_REQUEST_MISMATCH', 'Cette clé de reprise a déjà été utilisée pour une autre demande.');
    if (row.state === 'completed') return completedResult(row);
    if (row.state === 'failed') throw new ApiError(409, 'AI_GENERATION_ALREADY_FAILED', 'Cette demande a déjà échoué. Relancez une nouvelle proposition.');
    if (row.state !== 'processing') throw new ApiError(409, 'AI_GENERATION_STATE_INVALID', 'Cette génération ne peut pas être reprise.');
    if (row.leaseExpiresAt && row.leaseExpiresAt.getTime() > Date.now()) throw new ApiError(409, 'AI_GENERATION_IN_PROGRESS', 'Une génération identique est déjà en cours. Patientez avant de renvoyer la demande.', { retryAfterMs: Math.max(1000, row.leaseExpiresAt.getTime() - Date.now()) });
    if (row.baseRevision !== null && row.baseRevision !== page.draftRevision) {
      await database.update(aiGenerations).set({ state: 'failed', errorCode: 'AI_PAGE_CHANGED', leaseExpiresAt: null, completedAt: new Date() })
        .where(and(eq(aiGenerations.id, row.id), eq(aiGenerations.state, 'processing'), eq(aiGenerations.attempts, row.attempts)));
      throw new ApiError(409, 'AI_PAGE_CHANGED', 'La page a changé depuis la demande initiale. Créez une nouvelle proposition.');
    }
    const attempt = row.attempts + 1;
    const claimed = await database.update(aiGenerations).set({ attempts: attempt, output: null, errorCode: null, completedAt: null, leaseExpiresAt: new Date(Date.now() + AI_LEASE_MS) })
      .where(and(eq(aiGenerations.id, row.id), eq(aiGenerations.state, 'processing'), eq(aiGenerations.attempts, row.attempts))).returning();
    if (!claimed[0]) throw new ApiError(409, 'AI_GENERATION_IN_PROGRESS', 'Une reprise identique vient de commencer. Patientez avant de renvoyer la demande.');
    return executeAiGeneration(database, row, page, request, attempt);
  };

  const existing = await findExisting();
  if (existing) return resolveExisting(existing);
  await assertAiQuota(project.workspaceId, database);
  const provider = process.env.AI_PROVIDER === 'openai' ? 'openai' : 'demo';
  const inserted = await database.insert(aiGenerations).values({
    id: createId('generation'), workspaceId: project.workspaceId, projectId: project.id, pageId, requestedBy: userId, kind: 'page_edit', provider,
    model: provider === 'demo' ? 'local-template-v1' : process.env.OPENAI_MODEL || 'unconfigured', state: 'processing', prompt: request.instruction,
    requestKey: requestId, requestHash, selectedNodeId: request.selectedNodeId ?? null, baseRevision: page.draftRevision, attempts: 1, leaseExpiresAt: new Date(Date.now() + AI_LEASE_MS),
  }).onConflictDoNothing().returning();
  if (inserted[0]) return executeAiGeneration(database, inserted[0], page, request, 1);
  const concurrent = await findExisting();
  if (!concurrent) throw new ApiError(500, 'AI_GENERATION_CONFLICT', 'La génération n’a pas pu être journalisée.');
  return resolveExisting(concurrent);
}
