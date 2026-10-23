import { z } from 'zod';
import { COMPONENT_TYPES, type StyleProperty } from './types';
import type { PageDocument } from './types';
import { cloneDocument, designSystemSchema, findNode, nodeStyleSchema, validatePageDocument } from './validation';
import { createNode } from './registry';
import { insertNode } from './operations';
import { setNodeStyle, withDesignSystem } from './design-system';
import { createId } from '@/lib/id';
import { runCreativeCapability, scene3dCapabilityOperationSchema } from '@/lib/creative/orchestrator';

export const aiProposalSchema = z.object({
  summary: z.string().min(3).max(500),
  operations: z.array(z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('updateProps'), nodeId: z.string().min(1).max(160), props: z.record(z.string(), z.unknown()) }).strict(),
    z.object({ kind: z.literal('insertComponent'), targetId: z.string().min(1).max(160), position: z.enum(['before', 'after', 'inside']), component: z.enum(COMPONENT_TYPES.filter((type) => type !== 'page')), props: z.record(z.string(), z.unknown()) }).strict(),
    z.object({ kind: z.literal('updateTheme'), designSystem: designSystemSchema }).strict(),
    z.object({ kind: z.literal('updateStyle'), nodeId: z.string().min(1).max(160), viewport: z.enum(['desktop', 'tablet', 'mobile']).default('desktop'), state: z.enum(['hover', 'focus-visible', 'active', 'disabled']).optional(), styles: nodeStyleSchema }).strict(),
    scene3dCapabilityOperationSchema,
  ])).min(1).max(10),
}).strict();
export type AiProposal = z.infer<typeof aiProposalSchema>;

export function applyAiProposal(document: PageDocument, input: unknown): PageDocument {
  const proposal = aiProposalSchema.parse(input);
  let next = cloneDocument(document);
  for (const operation of proposal.operations) {
    if (operation.kind === 'updateProps') {
      const node = findNode(next.root, operation.nodeId);
      if (!node || node.type === 'page') throw new Error('Le composant à modifier est introuvable.');
      node.props = { ...node.props, ...operation.props };
    } else if (operation.kind === 'insertComponent') {
      const node = createNode(operation.component, createId('node'));
      node.props = { ...node.props, ...operation.props };
      if (!insertNode(next.root, node, operation.targetId, operation.position)) throw new Error('Le point d’insertion proposé est invalide.');
    } else if (operation.kind === 'updateTheme') {
      next.theme = withDesignSystem(next.theme, operation.designSystem);
    } else if (operation.kind === 'scene3d') {
      next = runCreativeCapability(next, 'scene3d', operation);
    } else {
      const node = findNode(next.root, operation.nodeId);
      if (!node) throw new Error('Le composant à styliser est introuvable.');
      for (const [property, value] of Object.entries(operation.styles)) {
        if (value !== undefined) setNodeStyle(node, property as StyleProperty, value, operation.viewport, operation.state);
      }
    }
  }
  const validation = validatePageDocument(next);
  if (!validation.success) throw new Error(validation.issues[0]?.message || 'La proposition IA est invalide.');
  return validation.data;
}
