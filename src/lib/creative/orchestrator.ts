import { z } from 'zod';
import { createId } from '@/lib/id';
import { createNode, scene3dPropsSchema } from '@/lib/document/registry';
import { insertNode, removeNode } from '@/lib/document/operations';
import { cloneDocument, findNode, validatePageDocument, walkNodes } from '@/lib/document/validation';
import type { PageDocument } from '@/lib/document/types';

export const scene3dCapabilityOperationSchema = z.object({
  kind: z.literal('scene3d'),
  action: z.enum(['insert', 'update', 'remove']),
  targetId: z.string().min(1).max(160),
  position: z.enum(['before', 'after', 'inside']).default('after'),
  props: scene3dPropsSchema.partial().default({}),
}).strict();

export type Scene3DCapabilityOperation = z.infer<typeof scene3dCapabilityOperationSchema>;

function applyScene3D(document: PageDocument, input: unknown): PageDocument {
  const operation = scene3dCapabilityOperationSchema.parse(input);
  const next = cloneDocument(document);
  if (operation.action === 'insert') {
    let count = 0;
    walkNodes(next.root, (node) => { if (node.type === 'scene3d') count += 1; });
    if (count >= 1) throw new Error('Cette page contient déjà une scène 3D. Modifiez-la plutôt que d’ajouter un second contexte WebGL.');
    const node = createNode('scene3d', createId('node'));
    node.props = { ...node.props, ...operation.props };
    if (!insertNode(next.root, node, operation.targetId, operation.position)) throw new Error('Le point d’insertion de la scène 3D est invalide.');
  } else {
    const node = findNode(next.root, operation.targetId);
    if (!node || node.type !== 'scene3d') throw new Error('La scène 3D ciblée est introuvable.');
    if (operation.action === 'update') {
      if (!Object.keys(operation.props).length) throw new Error('La mise à jour de la scène 3D est vide.');
      node.props = { ...node.props, ...operation.props };
    } else {
      if (Object.keys(operation.props).length) throw new Error('La suppression d’une scène 3D n’accepte aucune propriété.');
      if (!removeNode(next.root, node.id)) throw new Error('La scène 3D n’a pas pu être supprimée.');
    }
  }
  const validation = validatePageDocument(next);
  if (!validation.success) throw new Error(validation.issues[0]?.message || 'La scène 3D produit un document invalide.');
  return validation.data;
}

/**
 * Small synchronous dispatcher: no queue or remote job is implied. Every branch
 * returns a new validated document and leaves the input untouched on failure.
 */
export function runCreativeCapability(document: PageDocument, capabilityId: 'scene3d', operation: unknown): PageDocument {
  if (capabilityId !== 'scene3d') throw new Error('Capacité créative inconnue.');
  return applyScene3D(document, operation);
}
