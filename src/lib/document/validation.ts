import { z } from 'zod';
import { COMPONENT_TYPES, STYLE_PROPERTIES } from './types';
import type { DesignSystem, NodeStyle, PageDocument, PageNode, SharedStyle, SiteSnapshot, StyleProperty } from './types';
import { componentRegistry } from './registry';
import { normalizeThemeSettings } from './design-system';

const safeKey = z.string().min(1).max(160).refine((key) => !['__proto__', 'prototype', 'constructor'].includes(key), 'Clé non autorisée');
const styleValue = z.union([z.string().max(300), z.number().finite().min(-100000).max(100000)]);
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale à six chiffres requise');
const fontSchema = z.string().trim().min(1).max(180).refine((value) => !/[;{}<>\\]/.test(value) && !/(?:url|expression|javascript|@import)\s*\(?/i.test(value), 'Police non autorisée');

const ENUM_VALUES: Partial<Record<StyleProperty, readonly string[]>> = {
  display: ['block', 'flex', 'grid', 'inline', 'inline-block', 'inline-flex', 'inline-grid', 'none', 'contents'],
  visibility: ['visible', 'hidden', 'collapse'],
  position: ['static', 'relative', 'absolute', 'fixed', 'sticky'],
  overflow: ['visible', 'hidden', 'clip', 'scroll', 'auto'], overflowX: ['visible', 'hidden', 'clip', 'scroll', 'auto'], overflowY: ['visible', 'hidden', 'clip', 'scroll', 'auto'],
  textAlign: ['left', 'center', 'right', 'justify', 'start', 'end'],
  textTransform: ['none', 'uppercase', 'lowercase', 'capitalize'],
  fontStyle: ['normal', 'italic', 'oblique'],
  borderStyle: ['none', 'solid', 'dashed', 'dotted', 'double'],
  objectFit: ['cover', 'contain', 'fill', 'none', 'scale-down'],
  flexDirection: ['row', 'column', 'row-reverse', 'column-reverse'],
  flexWrap: ['nowrap', 'wrap', 'wrap-reverse'],
  justifyContent: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'start', 'end'],
  alignItems: ['stretch', 'center', 'flex-start', 'flex-end', 'baseline', 'start', 'end'],
  alignContent: ['stretch', 'center', 'flex-start', 'flex-end', 'space-between', 'space-around'],
  alignSelf: ['auto', 'stretch', 'center', 'flex-start', 'flex-end', 'baseline'],
  justifySelf: ['auto', 'stretch', 'center', 'start', 'end'],
  backgroundRepeat: ['repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'space', 'round'],
  backgroundAttachment: ['scroll', 'fixed', 'local'],
  cursor: ['default', 'pointer', 'text', 'move', 'not-allowed', 'grab', 'grabbing'],
  animationName: ['none', 'woob-fade', 'woob-rise'],
  animationTimingFunction: ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear'],
  transitionTimingFunction: ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear'],
  animationDirection: ['normal', 'reverse', 'alternate', 'alternate-reverse'],
  animationFillMode: ['none', 'forwards', 'backwards', 'both'],
  hyphens: ['none', 'manual', 'auto'], overflowWrap: ['normal', 'break-word', 'anywhere'], boxSizing: ['border-box', 'content-box'],
};

function safeCssText(value: string): boolean {
  const text = value.trim();
  return text.length > 0 && text.length <= 300 && !/[<>;{}\\\u0000-\u001F]/.test(text)
    && !/(?:url|expression|javascript|@import|behavior|image-set|attr)\s*\(?/i.test(text);
}

/** Shared by Zod and the renderer as a defence-in-depth check. */
export function safeCss(property: string, value: string | number): boolean {
  if (!(STYLE_PROPERTIES as readonly string[]).includes(property)) return false;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return false;
    if (property === 'opacity' && (value < 0 || value > 1)) return false;
    if (property === 'fontWeight' && (value < 100 || value > 900)) return false;
    if (property === 'lineHeight' && (value < 0 || value > 5)) return false;
    if (['zIndex', 'order'].includes(property) && Math.abs(value) > 1000) return false;
    return true;
  }
  if (!safeCssText(value)) return false;
  const text = value.trim();
  const allowed = ENUM_VALUES[property as StyleProperty];
  if (allowed && !allowed.includes(text)) return false;
  if (property === 'backgroundImage' && text !== 'none' && !/^(?:linear-gradient|radial-gradient|conic-gradient|var)\(/i.test(text)) return false;
  if (property === 'fontFamily' && !fontSchema.safeParse(text).success) return false;
  if (property === 'transitionProperty' && text !== 'none' && text !== 'all') {
    const properties = text.split(',').map((item) => item.trim().replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()));
    if (properties.some((item) => !(STYLE_PROPERTIES as readonly string[]).includes(item))) return false;
  }
  return true;
}

function safeCssVariable(value: string | number): boolean {
  return typeof value === 'number' ? Number.isFinite(value) && Math.abs(value) <= 100000 : safeCssText(value);
}

export const nodeStyleSchema = z.partialRecord(z.enum(STYLE_PROPERTIES), styleValue).superRefine((styles, context) => {
  for (const [property, value] of Object.entries(styles)) {
    if (value !== undefined && !safeCss(property, value)) context.addIssue({ code: 'custom', path: [property], message: 'Valeur CSS non autorisée.' });
  }
});
const responsiveSchema = z.object({ tablet: nodeStyleSchema.optional(), mobile: nodeStyleSchema.optional() }).strict();
const stateSchema = z.partialRecord(z.enum(['hover', 'focus-visible', 'active', 'disabled']), nodeStyleSchema);
const responsiveStateSchema = z.object({ tablet: stateSchema.optional(), mobile: stateSchema.optional() }).strict();
const cssVariablesSchema = z.record(z.string().regex(/^--woob-[a-z0-9-]{1,80}$/), styleValue).superRefine((variables, context) => {
  for (const [key, value] of Object.entries(variables)) if (value !== undefined && !safeCssVariable(value)) context.addIssue({ code: 'custom', path: [key], message: 'Valeur de variable non autorisée.' });
});

const sharedStyleSchema: z.ZodType<SharedStyle> = z.object({
  id: safeKey,
  name: z.string().trim().min(1).max(80),
  componentType: z.enum(COMPONENT_TYPES).optional(),
  styles: nodeStyleSchema,
  responsive: responsiveSchema.optional(),
  states: stateSchema.optional(),
  responsiveStates: responsiveStateSchema.optional(),
}).strict() as z.ZodType<SharedStyle>;

const colorTokensSchema = z.object({
  primary: colorSchema, secondary: colorSchema, accent: colorSchema, background: colorSchema, surface: colorSchema,
  text: colorSchema, muted: colorSchema, heading: colorSchema, link: colorSchema, border: colorSchema,
  success: colorSchema, warning: colorSchema, danger: colorSchema, info: colorSchema, focus: colorSchema,
}).strict();
const shadowSchema = z.enum(['none', 'small', 'medium', 'large']);
const numberIn = (min: number, max: number) => z.number().finite().min(min).max(max);

export const designSystemSchema: z.ZodType<DesignSystem> = z.object({
  schemaVersion: z.literal('1.0.0'),
  name: z.string().trim().min(1).max(100),
  colorMode: z.enum(['light', 'dark', 'auto']),
  tokens: z.object({
    colors: colorTokensSchema,
    darkColors: colorTokensSchema,
    typography: z.object({
      bodyFont: fontSchema, headingFont: fontSchema, uiFont: fontSchema, monoFont: fontSchema,
      baseFontSize: numberIn(12, 24), scale: numberIn(1.05, 1.618), bodyLineHeight: numberIn(1.1, 2.2), headingLineHeight: numberIn(0.9, 1.8),
      letterSpacing: z.string().max(30).refine((value) => safeCssText(value)), paragraphMaxWidth: numberIn(280, 1400),
    }).strict(),
    spacing: z.object({ unit: numberIn(1, 24), section: numberIn(16, 240), container: numberIn(320, 1920), gutter: numberIn(8, 96), gap: numberIn(0, 120) }).strict(),
    radius: z.object({ small: numberIn(0, 80), medium: numberIn(0, 80), large: numberIn(0, 120), pill: numberIn(0, 999) }).strict(),
    shadows: z.object({ button: shadowSchema, card: shadowSchema, form: shadowSchema, overlay: shadowSchema }).strict(),
    breakpoints: z.object({ tablet: numberIn(481, 1600), mobile: numberIn(280, 1024) }).strict(),
  }).strict(),
  components: z.object({
    button: z.object({ radius: numberIn(0, 80), paddingX: numberIn(0, 80), paddingY: numberIn(0, 60), minHeight: numberIn(32, 120), fontWeight: numberIn(100, 900), hoverLift: numberIn(0, 12), uppercase: z.boolean() }).strict(),
    card: z.object({ radius: numberIn(0, 100), padding: numberIn(0, 120), borderWidth: numberIn(0, 12), shadow: shadowSchema }).strict(),
    form: z.object({ radius: numberIn(0, 80), borderWidth: numberIn(0, 12), minHeight: numberIn(32, 120), focusWidth: numberIn(1, 8) }).strict(),
  }).strict(),
  navigation: z.object({ sticky: z.boolean(), minHeight: numberIn(40, 180), linkGap: numberIn(4, 80) }).strict(),
  motion: z.object({ duration: numberIn(0, 2000), easing: z.enum(['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear']), entrance: z.enum(['none', 'fade', 'rise']), reducedMotion: z.enum(['respect', 'reduce']) }).strict(),
  styles: z.array(sharedStyleSchema).max(100),
}).strict().superRefine((design, context) => {
  if (design.tokens.breakpoints.mobile >= design.tokens.breakpoints.tablet) context.addIssue({ code: 'custom', path: ['tokens', 'breakpoints', 'mobile'], message: 'Le point de rupture mobile doit être inférieur à celui de la tablette.' });
  const ids = new Set<string>();
  for (const [index, style] of design.styles.entries()) {
    if (ids.has(style.id)) context.addIssue({ code: 'custom', path: ['styles', index, 'id'], message: 'Identifiant de style dupliqué.' });
    ids.add(style.id);
  }
}) as z.ZodType<DesignSystem>;

const nodeBase = z.object({
  id: safeKey,
  type: z.enum(COMPONENT_TYPES),
  version: z.literal(1),
  name: z.string().max(120).optional(),
  props: z.record(z.string(), z.unknown()),
  styleId: safeKey.optional(),
  styles: nodeStyleSchema,
  responsive: responsiveSchema.optional(),
  states: stateSchema.optional(),
  responsiveStates: responsiveStateSchema.optional(),
  cssVariables: cssVariablesSchema.optional(),
});

export const pageNodeSchema: z.ZodType<PageNode> = nodeBase.extend({
  children: z.lazy(() => pageNodeSchema.array().max(200)).optional(),
}) as z.ZodType<PageNode>;

export const themeSchema = z.object({
  primaryColor: colorSchema,
  secondaryColor: colorSchema,
  accentColor: colorSchema,
  backgroundColor: colorSchema,
  surfaceColor: colorSchema,
  textColor: colorSchema,
  mutedTextColor: colorSchema,
  fontFamily: fontSchema,
  headingFontFamily: fontSchema,
  baseFontSize: numberIn(12, 24),
  containerWidth: numberIn(320, 1920),
  radius: numberIn(0, 80),
  sectionSpacing: numberIn(16, 240),
  designSystem: designSystemSchema.optional(),
}).strict();

export const pageDocumentSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  documentId: safeKey,
  pageId: safeKey,
  revision: z.number().int().nonnegative(),
  metadata: z.object({
    title: z.string().max(180),
    description: z.string().max(500),
    path: z.string().regex(/^\/(?:[a-z0-9][a-z0-9-/]*)?$/).max(240),
  }).strict(),
  theme: themeSchema,
  root: pageNodeSchema,
}).strict();

export type DocumentIssue = { path: string; message: string };
export type DocumentValidation =
  | { success: true; data: PageDocument; issues: DocumentIssue[] }
  | { success: false; issues: DocumentIssue[]; error?: Error };

export function safeHref(value: unknown): string {
  if (typeof value !== 'string') return '#';
  const href = value.trim();
  if (!href || href.length > 2048 || /[\u0000-\u001F]/.test(href)) return '#';
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  if (href.startsWith('#')) return href;
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  return '#';
}

function inspectJson(value: unknown, path: string, issues: DocumentIssue[], depth = 0): void {
  if (depth > 30) { issues.push({ path, message: 'Profondeur JSON excessive.' }); return; }
  if (Array.isArray(value)) { value.forEach((entry, index) => inspectJson(entry, `${path}.${index}`, issues, depth + 1)); return; }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) issues.push({ path: `${path}.${key}`, message: 'Clé potentiellement dangereuse.' });
      if (/(?:href|src|imageUrl)$/i.test(key) && typeof entry === 'string' && entry.trim() && entry.trim() !== '#' && safeHref(entry) === '#') issues.push({ path: `${path}.${key}`, message: 'Protocole ou URL non autorisé.' });
      inspectJson(entry, `${path}.${key}`, issues, depth + 1);
    }
  }
}

function validateNode(node: PageNode, path: string, issues: DocumentIssue[], ids: Set<string>, depth: number, styles: SharedStyle[]): number {
  if (ids.has(node.id)) issues.push({ path: `${path}.id`, message: `Identifiant dupliqué : ${node.id}` });
  ids.add(node.id);
  if (depth > 16) issues.push({ path, message: 'Profondeur maximale du document dépassée.' });
  if (node.type === 'page' && path !== 'root') issues.push({ path: `${path}.type`, message: 'Le type page est réservé à la racine.' });
  if (node.styleId) {
    const shared = styles.find((style) => style.id === node.styleId);
    if (!shared) issues.push({ path: `${path}.styleId`, message: `Style réutilisable introuvable : ${node.styleId}` });
    else if (shared.componentType && shared.componentType !== node.type) issues.push({ path: `${path}.styleId`, message: 'Ce style est réservé à un autre type de composant.' });
  }
  if (node.type !== 'page') {
    const definition = componentRegistry[node.type];
    if (!definition) issues.push({ path: `${path}.type`, message: `Composant inconnu : ${node.type}` });
    else {
      const propsResult = definition.propsSchema.safeParse(node.props);
      if (!propsResult.success) for (const issue of propsResult.error.issues) issues.push({ path: `${path}.props.${issue.path.join('.')}`, message: issue.message });
    }
  }
  let count = 1;
  node.children?.forEach((child, index) => { count += validateNode(child, `${path}.children.${index}`, issues, ids, depth + 1, styles); });
  return count;
}

export function validatePageDocument(input: unknown): DocumentValidation {
  const issues: DocumentIssue[] = [];
  inspectJson(input, 'document', issues);
  const parsed = pageDocumentSchema.safeParse(input);
  if (!parsed.success) return { success: false, issues: [...issues, ...parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))] };
  const document = parsed.data;
  document.theme = normalizeThemeSettings(document.theme);
  const design = document.theme.designSystem!;
  const ids = new Set<string>();
  const nodeCount = validateNode(document.root, 'root', issues, ids, 0, design.styles);
  if (nodeCount > 1500) issues.push({ path: 'root', message: 'La page dépasse 1 500 composants.' });
  if (document.root.type !== 'page') issues.push({ path: 'root.type', message: 'La racine doit être de type page.' });
  if (JSON.stringify(document).length > 2_000_000) issues.push({ path: 'document', message: 'Le document dépasse la limite de 2 Mo.' });
  if (issues.length) return { success: false, issues };
  return { success: true, data: document, issues: [] };
}

export function assertValidPageDocument(input: unknown): PageDocument {
  const result = validatePageDocument(input);
  if (!result.success) {
    const error = new Error('Document de page invalide') as Error & { issues?: DocumentIssue[] };
    error.name = 'DocumentValidationError'; error.issues = result.issues; throw error;
  }
  return result.data;
}

export function validateSiteSnapshot(snapshot: SiteSnapshot): DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const themeResult = themeSchema.safeParse(snapshot.theme);
  if (!themeResult.success) issues.push(...themeResult.error.issues.map((issue) => ({ path: `theme.${issue.path.join('.')}`, message: issue.message })));
  else snapshot.theme = normalizeThemeSettings(themeResult.data);
  const paths = new Set<string>();
  if (!snapshot.pages.length) issues.push({ path: 'pages', message: 'Au moins une page est requise.' });
  if (!snapshot.pages.some((page) => page.path === '/')) issues.push({ path: 'pages', message: 'Une page d’accueil / est requise.' });
  for (const page of snapshot.pages) {
    if (paths.has(page.path)) issues.push({ path: `pages.${page.id}.path`, message: 'Route en double.' });
    paths.add(page.path);
    const result = validatePageDocument(page.document);
    if (!result.success) issues.push(...result.issues.map((issue) => ({ path: `pages.${page.id}.${issue.path}`, message: issue.message })));
    else page.document = result.data;
  }
  for (const item of snapshot.navigation) if (!paths.has(item.path)) issues.push({ path: `navigation.${item.path}`, message: 'Lien de navigation cassé.' });
  return issues;
}

export function collectAssetIds(document: PageDocument): Set<string> {
  const ids = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
      if ((key === 'assetId' || key === 'imageAssetId') && typeof entry === 'string' && entry) ids.add(entry);
      else visit(entry);
    }
  };
  visit(document.root);
  return ids;
}

export function walkNodes(root: PageNode, callback: (node: PageNode, parent?: PageNode) => void, parent?: PageNode): void {
  callback(root, parent); root.children?.forEach((child) => walkNodes(child, callback, child));
}

export function findNode(root: PageNode, nodeId: string): PageNode | undefined {
  let found: PageNode | undefined;
  walkNodes(root, (node) => { if (node.id === nodeId) found = node; });
  return found;
}

export function cloneDocument<T>(value: T): T { return structuredClone(value); }
