import { createId } from '@/lib/id';
import { DEFAULT_THEME } from './types';
import type { PageDocument, PageNode, ThemeSettings } from './types';
import { createNode } from './registry';
import type { ComponentType } from './types';

export function makeNode(type: Exclude<ComponentType, 'page'>, props: Record<string, unknown> = {}): PageNode {
  const node = createNode(type, createId('node'));
  node.props = { ...node.props, ...props };
  return node;
}

export function createPageDocument({
  pageId = createId('page'),
  name = 'Accueil',
  path = '/',
  theme = DEFAULT_THEME,
  nodes = [],
  revision = 0,
}: {
  pageId?: string;
  name?: string;
  path?: string;
  theme?: ThemeSettings;
  nodes?: PageNode[];
  revision?: number;
} = {}): PageDocument {
  return {
    schemaVersion: '1.0.0',
    documentId: createId('doc'),
    pageId,
    revision,
    metadata: { title: name, description: '', path },
    theme: structuredClone(theme),
    root: {
      id: createId('root'),
      type: 'page',
      version: 1,
      name: 'Page',
      props: {},
      styles: {},
      children: nodes,
    },
  };
}

export function defaultHomeDocument(pageId?: string): PageDocument {
  return createPageDocument({
    ...(pageId ? { pageId } : {}),
    nodes: [
      makeNode('header'),
      makeNode('hero'),
      makeNode('features'),
      makeNode('testimonials'),
      makeNode('cta'),
      makeNode('contactForm'),
      makeNode('footer'),
    ],
  });
}
