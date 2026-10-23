import { z } from 'zod';
import { createPageDocument, makeNode } from '@/lib/document/factory';
import type { PageDocument, PageNode } from '@/lib/document/types';
import { assertValidPageDocument, cloneDocument } from '@/lib/document/validation';
import { createId } from '@/lib/id';
import { getTemplate, type TemplatePost, type TemplateProduct } from '@/lib/templates';
import { assertCatalogValid, getFunctionalModule, localize, resolveProjectCreation } from './index';
import { CatalogError, functionalModuleIds, type CatalogSelectionSnapshot, type CreationSelection, type ProjectContent, type ProjectGenerationContext, type ResolvedCreation } from './types';

export const creationSelectionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  brief: z.string().trim().max(2000).optional().default(''),
  siteTypeId: z.string().max(100).nullable().optional(),
  activityDomainId: z.string().max(100).nullable().optional(),
  designStyleId: z.string().max(100).optional(),
  moduleIds: z.array(z.enum(functionalModuleIds)).max(functionalModuleIds.length).optional(),
  locale: z.enum(['fr', 'en']).optional().default('fr'),
});

export const projectContentSchema = z.object({
  heroEyebrow: z.string().trim().min(1).max(180),
  heroTitle: z.string().trim().min(1).max(240),
  heroDescription: z.string().trim().min(1).max(1200),
  seoDescription: z.string().trim().min(1).max(300),
}).strict();

export type GeneratedProjectPage = {
  id: string;
  name: string;
  path: string;
  seoTitle: string;
  seoDescription: string;
  document: PageDocument;
};

export type GeneratedProjectDraft = {
  selection: CreationSelection;
  resolved: ResolvedCreation;
  context: ProjectGenerationContext;
  snapshot: CatalogSelectionSnapshot;
  content: ProjectContent;
  pages: GeneratedProjectPage[];
  products: TemplateProduct[];
  posts: TemplatePost[];
};

export function createCatalogSnapshot(resolved: ResolvedCreation): CatalogSelectionSnapshot {
  return {
    version: 1,
    siteTypeId: resolved.siteType?.id || null,
    activityDomainId: resolved.domain?.id || null,
    designStyleId: resolved.style.id,
    blueprintId: resolved.blueprint.id,
    templateId: resolved.templateId,
    locale: resolved.locale,
    moduleIds: [...resolved.selectedModuleIds],
  };
}

export function createProjectGenerationContext(selection: CreationSelection, resolved = resolveProjectCreation(selection)): ProjectGenerationContext {
  const locale = resolved.locale;
  return {
    projectName: selection.name,
    brief: selection.brief || '',
    locale,
    siteType: resolved.siteType ? { id: resolved.siteType.id, name: localize(resolved.siteType.name, locale) } : null,
    activityDomain: resolved.domain ? { id: resolved.domain.id, name: localize(resolved.domain.name, locale) } : null,
    designStyle: { id: resolved.style.id, name: localize(resolved.style.name, locale) },
    modules: resolved.selectedModuleIds.map((id) => {
      const capability = getFunctionalModule(id)!;
      return { id, name: localize(capability.name, locale), description: localize(capability.description, locale) };
    }),
    pages: resolved.pages.map((page) => ({ path: page.path, name: localize(page.name, locale), components: [...page.components] })),
    limitations: resolved.notices.map((notice) => localize(notice, locale)),
  };
}

export function buildProjectGenerationPrompt(context: ProjectGenerationContext): string {
  return [
    context.locale === 'en' ? 'Write concise, honest starter copy in English.' : 'Rédige des textes de départ concis et honnêtes en français.',
    'Return only the requested text fields. No HTML, markdown, scripts, fabricated customer proof, prices or operational claims.',
    'The site type, activity domain, visual style, modules and page architecture below are mandatory context. Respect every listed limitation.',
    JSON.stringify(context),
  ].join('\n\n');
}

export function createLocalProjectContent(context: ProjectGenerationContext): ProjectContent {
  const brief = context.brief.replace(/\s+/g, ' ').trim();
  const domain = context.activityDomain?.name;
  const type = context.siteType?.name;
  const eyebrow = [domain, type].filter(Boolean).join(' · ') || (context.locale === 'en' ? 'A custom website' : 'Un site sur mesure');
  const fallback = context.locale === 'en'
    ? `Discover ${context.projectName}, its approach and its services, then get in touch to discuss your project.`
    : `Découvrez ${context.projectName}, son approche et ses services, puis échangez avec son équipe sur votre projet.`;
  const heroDescription = brief || fallback;
  return projectContentSchema.parse({
    heroEyebrow: eyebrow.slice(0, 180),
    heroTitle: context.projectName.slice(0, 240),
    heroDescription: heroDescription.slice(0, 1200),
    seoDescription: (brief || fallback).slice(0, 300),
  });
}

function sourceNode(templateId: string, pagePath: string, type: string) {
  const template = getTemplate(templateId)!;
  const samePage = template.pages.find((page) => page.path === pagePath);
  return samePage?.nodes.find((node) => node.type === type) || template.pages.flatMap((page) => page.nodes).find((node) => node.type === type);
}


export function buildProjectDraft(selection: CreationSelection, contentInput?: ProjectContent, resolvedInput?: ResolvedCreation): GeneratedProjectDraft {
  assertCatalogValid();
  const resolved = resolvedInput || resolveProjectCreation(selection);
  const context = createProjectGenerationContext(selection, resolved);
  const content = projectContentSchema.parse(contentInput || createLocalProjectContent(context));
  const template = getTemplate(resolved.templateId);
  if (!template) throw new CatalogError('TEMPLATE_NOT_FOUND', 'Le modèle technique associé est introuvable.');
  const locale = resolved.locale;
  const conversionPath = resolved.pages.find((page) => page.requiredModuleId === 'reservations')?.path
    || (resolved.pages.some((page) => page.path === '/contact') ? '/contact' : resolved.pages.find((page) => page.path !== '/')?.path || '/');
  const pages = resolved.pages.map((recipe): GeneratedProjectPage => {
    const pageId = createId('page');
    const nodes = recipe.components.map((type): PageNode => {
      const source = sourceNode(resolved.templateId, recipe.path, type);
      const node = makeNode(type, source ? cloneDocument(source.props) : {});
      if (source) node.styles = cloneDocument(source.styles);
      if (type === 'header') {
        node.props.logoText = selection.name;
        node.props.ctaLabel = locale === 'en' ? 'Get in touch' : 'Nous contacter';
        node.props.ctaHref = resolved.pages.some((page) => page.path === '/contact') ? '/contact' : conversionPath;
      }
      if (type === 'hero') {
        node.props.eyebrow = content.heroEyebrow;
        node.props.title = content.heroTitle;
        node.props.description = content.heroDescription;
        node.props.primaryLabel = locale === 'en' ? 'Discover' : 'Découvrir';
        node.props.primaryHref = conversionPath;
        node.props.secondaryLabel = '';
        node.props.secondaryHref = '';
      }
      if (type === 'heading') {
        node.props.text = localize(recipe.name, locale);
        node.props.level = 1;
      }
      if (type === 'text') node.props.text = content.heroDescription;
      if (type === 'reservation') node.props.serviceName = (resolved.siteType ? localize(resolved.siteType.name, locale) : selection.name).slice(0, 300);
      if (type === 'cta') {
        node.props.buttonHref = conversionPath;
        node.props.buttonLabel = locale === 'en' ? 'Start a conversation' : 'Parlons de votre projet';
      }
      if (type === 'footer') {
        node.props.text = selection.name;
        node.props.links = resolved.pages.slice(0, 5).map((page) => ({ label: localize(page.name, locale), href: page.path }));
      }
      return node;
    });
    const name = localize(recipe.name, locale);
    const document = createPageDocument({ pageId, name, path: recipe.path, theme: resolved.style.theme, nodes });
    document.metadata.description = content.seoDescription;
    assertValidPageDocument(document);
    return {
      id: pageId,
      name,
      path: recipe.path,
      seoTitle: `${selection.name} — ${name}`.slice(0, 180),
      seoDescription: content.seoDescription,
      document,
    };
  });
  return {
    selection,
    resolved,
    context,
    snapshot: createCatalogSnapshot(resolved),
    content,
    pages,
    products: resolved.selectedModuleIds.includes('catalog') ? cloneDocument(template.products) : [],
    posts: resolved.selectedModuleIds.includes('blog') ? cloneDocument(template.posts) : [],
  };
}

export function sameCatalogSnapshot(left: CatalogSelectionSnapshot, right: CatalogSelectionSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
