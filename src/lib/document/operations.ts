import { createId } from '@/lib/id';
import { cloneDocument, findNode } from './validation';
import type { PageNode } from './types';

export function findParent(root: PageNode, nodeId: string, parent: PageNode | null = null): PageNode | null | undefined {
  if (root.id === nodeId) return parent;
  for (const child of root.children || []) {
    const result = findParent(child, nodeId, root);
    if (result !== undefined) return result;
  }
  return undefined;
}

export function removeNode(root: PageNode, nodeId: string): PageNode | null {
  if (root.id === nodeId) return null;
  const parent = findParent(root, nodeId);
  if (!parent?.children) return null;
  const index = parent.children.findIndex((node) => node.id === nodeId);
  if (index < 0) return null;
  return parent.children.splice(index, 1)[0] || null;
}

export function insertNode(root: PageNode, node: PageNode, targetId: string, position: 'before' | 'after' | 'inside' = 'after'): boolean {
  if (findNode(root, node.id)) return false;
  if (position === 'inside') {
    const target = findNode(root, targetId);
    if (!target || !['page', 'section'].includes(target.type)) return false;
    target.children ??= [];
    target.children.push(node);
    return true;
  }
  const parent = findParent(root, targetId);
  if (!parent?.children) return false;
  const index = parent.children.findIndex((child) => child.id === targetId);
  if (index < 0) return false;
  parent.children.splice(position === 'before' ? index : index + 1, 0, node);
  return true;
}

export function moveNode(root: PageNode, nodeId: string, targetId: string, position: 'before' | 'after' | 'inside' = 'before'): boolean {
  if (nodeId === targetId || root.id === nodeId) return false;
  const source = findNode(root, nodeId);
  const target = findNode(root, targetId);
  if (!source || !target || findNode(source, targetId)) return false;
  const originalParent = findParent(root, nodeId);
  const originalIndex = originalParent?.children?.findIndex((node) => node.id === nodeId) ?? -1;
  const removed = removeNode(root, nodeId);
  if (!removed) return false;
  if (insertNode(root, removed, targetId, position)) return true;
  if (originalParent?.children && originalIndex >= 0) originalParent.children.splice(originalIndex, 0, removed);
  return false;
}

export function moveNodeBy(root: PageNode, nodeId: string, direction: -1 | 1): boolean {
  const parent = findParent(root, nodeId);
  if (!parent?.children) return false;
  const index = parent.children.findIndex((node) => node.id === nodeId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= parent.children.length) return false;
  const [node] = parent.children.splice(index, 1);
  if (!node) return false;
  parent.children.splice(target, 0, node);
  return true;
}

export function duplicateNode(root: PageNode, nodeId: string): PageNode | null {
  const source = findNode(root, nodeId);
  if (!source || root.id === nodeId) return null;
  const copy = cloneDocument(source);
  const renew = (node: PageNode) => { node.id = createId('node'); node.children?.forEach(renew); };
  renew(copy);
  if (!insertNode(root, copy, nodeId, 'after')) return null;
  return copy;
}

export function flattenNodes(root: PageNode): PageNode[] {
  const result: PageNode[] = [];
  const visit = (node: PageNode) => { result.push(node); node.children?.forEach(visit); };
  visit(root);
  return result;
}
