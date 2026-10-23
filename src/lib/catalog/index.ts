import { COMPONENT_TYPES } from '@/lib/document/types';
import { themeSchema } from '@/lib/document/validation';
import { getTemplate } from '@/lib/templates';
import { activityDomains } from './activity-domains';
import { activitySubdomains, allActivityDomains } from './activity-subdomains';
import { siteBlueprints } from './blueprints';
import { designStyles, functionalModules } from './capabilities';
import { siteCategories, siteTypes } from './site-types';
import { CatalogError, functionalModuleIds, type ActivityDomain, type CreationSelection, type FunctionalModuleId, type LocalizedText, type ResolvedCreation, type SiteType, type UiLanguage } from './types';

export { activityDomains } from './activity-domains';
export { activitySubdomains, allActivityDomains } from './activity-subdomains';
export { siteBlueprints } from './blueprints';
export { designStyles, functionalModules } from './capabilities';
export { siteCategories, siteTypes } from './site-types';
export { CatalogError, functionalModuleIds } from './types';
export type { ActivityDomain, CatalogSelectionSnapshot, CreationSelection, DesignStyle, FunctionalModule, FunctionalModuleId, LocalizedText, ProjectContent, ProjectGenerationContext, ResolvedCreation, SiteBlueprint, SiteCategory, SiteType, UiLanguage } from './types';

const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]));
const categoryMap = byId(siteCategories);
const typeMap = byId(siteTypes);
const domainMap = byId(allActivityDomains);
const parentDomainMap = byId(activityDomains);
const blueprintMap = byId(siteBlueprints);
const styleMap = byId(designStyles);
const moduleMap = byId(functionalModules);

export function localize(text: LocalizedText, locale: UiLanguage = 'fr'): string {
  return (locale === 'en' ? text.en : text.fr) || text.fr;
}

export function normalizeCatalogSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function matches(entry: { name: LocalizedText; description: LocalizedText; keywords: string[] }, query: string, related = ''): boolean {
  const tokens = normalizeCatalogSearch(query).split(' ').filter(Boolean);
  if (!tokens.length) return true;
  const haystack = normalizeCatalogSearch([entry.name.fr, entry.name.en || '', entry.description.fr, entry.description.en || '', ...entry.keywords, related].join(' '));
  return tokens.every((token) => haystack.includes(token));
}

export const getSiteCategory = (id: string) => categoryMap.get(id);
export const getSiteType = (id: string) => typeMap.get(id);
export const getActivityDomain = (id: string) => domainMap.get(id);
export const getSiteBlueprint = (id: string) => blueprintMap.get(id);
export const getDesignStyle = (id: string) => styleMap.get(id);
export const getFunctionalModule = (id: string) => moduleMap.get(id);

export function searchSiteTypes(options: { query?: string; categoryId?: string; domainId?: string } = {}): SiteType[] {
  return siteTypes.filter((type) => {
    if (options.categoryId && type.categoryId !== options.categoryId) return false;
    if (options.domainId && !domainMap.get(options.domainId)?.siteTypeIds.includes(type.id)) return false;
    return matches(type, options.query || '', categoryMap.get(type.categoryId)?.name.fr || '');
  });
}

export function searchActivityDomains(options: { query?: string; siteTypeId?: string; recommendedOnly?: boolean } = {}): ActivityDomain[] {
  return allActivityDomains.filter((domain) => {
    if (options.siteTypeId && options.recommendedOnly && !domain.siteTypeIds.includes(options.siteTypeId)) return false;
    return matches(domain, options.query || '', domain.parentId ? parentDomainMap.get(domain.parentId)?.name.fr || '' : '');
  });
}

export function getCatalogStats() {
  return { categories: siteCategories.length, siteTypes: siteTypes.length, domains: activityDomains.length, subdomains: activitySubdomains.length, domainEntries: allActivityDomains.length, styles: designStyles.length, modules: functionalModules.length, blueprints: siteBlueprints.length };
}

function duplicateIds(items: { id: string }[], label: string, issues: string[]) {
  const seen = new Set<string>();
  for (const item of items) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)) issues.push(`${label}: identifiant invalide ${item.id}`);
    if (seen.has(item.id)) issues.push(`${label}: identifiant dupliqué ${item.id}`);
    seen.add(item.id);
  }
}

export function validateCatalog(): string[] {
  const issues: string[] = [];
  duplicateIds(siteCategories, 'catégories', issues);
  duplicateIds(siteTypes, 'types', issues);
  duplicateIds(allActivityDomains, 'domaines et sous-domaines', issues);
  duplicateIds(siteBlueprints, 'blueprints', issues);
  duplicateIds(designStyles, 'styles', issues);
  duplicateIds(functionalModules, 'modules', issues);
  for (const entry of [...siteCategories, ...siteTypes, ...allActivityDomains, ...designStyles, ...functionalModules]) {
    if (!entry.name.fr.trim() || !entry.description.fr.trim()) issues.push(`${entry.id}: nom ou description vide`);
  }
  for (const category of siteCategories) if (!blueprintMap.has(category.blueprintId)) issues.push(`${category.id}: blueprint ${category.blueprintId} absent`);
  for (const type of siteTypes) {
    if (!categoryMap.has(type.categoryId) || type.parentId !== type.categoryId) issues.push(`${type.id}: catégorie ${type.categoryId} invalide`);
    if (!blueprintMap.has(type.blueprintId)) issues.push(`${type.id}: blueprint ${type.blueprintId} absent`);
  }
  for (const domain of allActivityDomains) {
    if (domain.parentId && !parentDomainMap.has(domain.parentId)) issues.push(`${domain.id}: domaine parent ${domain.parentId} absent`);
    if (new Set(domain.siteTypeIds).size !== domain.siteTypeIds.length) issues.push(`${domain.id}: relation de type dupliquée`);
    if (domain.siteTypeIds.length < 2) issues.push(`${domain.id}: au moins deux types sont attendus`);
    for (const typeId of domain.siteTypeIds) if (!typeMap.has(typeId)) issues.push(`${domain.id}: type ${typeId} absent`);
  }
  for (const capability of functionalModules) {
    if (capability.availability !== 'implemented') issues.push(`${capability.id}: module non disponible exposé`);
    for (const component of capability.componentTypes) if (!COMPONENT_TYPES.includes(component)) issues.push(`${capability.id}: composant ${component} absent`);
  }
  for (const style of designStyles) {
    const result = themeSchema.safeParse(style.theme);
    if (!result.success) issues.push(`${style.id}: thème invalide`);
  }
  for (const blueprint of siteBlueprints) {
    if (!getTemplate(blueprint.templateId)) issues.push(`${blueprint.id}: modèle ${blueprint.templateId} absent`);
    if (!blueprint.supportedModuleIds.length) issues.push(`${blueprint.id}: aucun module supporté`);
    for (const moduleId of [...blueprint.supportedModuleIds, ...blueprint.recommendedModuleIds]) if (!moduleMap.has(moduleId)) issues.push(`${blueprint.id}: module ${moduleId} absent`);
    for (const moduleId of blueprint.recommendedModuleIds) if (!blueprint.supportedModuleIds.includes(moduleId)) issues.push(`${blueprint.id}: recommandation ${moduleId} non supportée`);
    const paths = new Set<string>();
    const pageIds = new Set<string>();
    for (const page of blueprint.pages) {
      if (!page.path.startsWith('/') || paths.has(page.path)) issues.push(`${blueprint.id}: chemin absent ou dupliqué ${page.path}`);
      if (pageIds.has(page.id)) issues.push(`${blueprint.id}: page dupliquée ${page.id}`);
      paths.add(page.path); pageIds.add(page.id);
      if (page.requiredModuleId && !blueprint.supportedModuleIds.includes(page.requiredModuleId)) issues.push(`${blueprint.id}/${page.id}: module requis non supporté`);
      for (const component of page.components) {
        if (!COMPONENT_TYPES.includes(component)) issues.push(`${blueprint.id}/${page.id}: composant ${component} invalide`);
        const owner = functionalModules.find((module) => module.componentTypes.includes(component));
        if (owner && !blueprint.supportedModuleIds.includes(owner.id)) issues.push(`${blueprint.id}/${page.id}: ${component} nécessite ${owner.id}`);
      }
    }
    if (paths.size && !paths.has('/')) issues.push(`${blueprint.id}: page d’accueil absente`);
  }
  return issues;
}

export function assertCatalogValid(): void {
  const issues = validateCatalog();
  if (issues.length) throw new CatalogError('CATALOG_INVALID', issues.join('\n'));
}

function requiredModuleForComponent(component: string): FunctionalModuleId | undefined {
  return functionalModules.find((module) => module.componentTypes.some((type) => type === component))?.id;
}

export function resolveProjectCreation(selection: CreationSelection): ResolvedCreation {
  const siteType = selection.siteTypeId ? typeMap.get(selection.siteTypeId) ?? null : null;
  if (selection.siteTypeId && !siteType) throw new CatalogError('SITE_TYPE_NOT_FOUND', 'Ce type de site n’existe pas dans le catalogue.');
  const domain = selection.activityDomainId ? domainMap.get(selection.activityDomainId) ?? null : null;
  if (selection.activityDomainId && !domain) throw new CatalogError('ACTIVITY_DOMAIN_NOT_FOUND', 'Ce domaine d’activité n’existe pas dans le catalogue.');
  const blueprint = siteType ? blueprintMap.get(siteType.blueprintId) : blueprintMap.get('custom');
  if (!blueprint) throw new CatalogError('BLUEPRINT_NOT_FOUND', 'La recette de création associée est introuvable.');
  const style = styleMap.get(selection.designStyleId || 'professional-clear');
  if (!style) throw new CatalogError('DESIGN_STYLE_NOT_FOUND', 'Ce style visuel n’existe pas.');
  const requestedModuleIds = new Set(selection.moduleIds || blueprint.recommendedModuleIds);
  const selectedModuleIds = functionalModuleIds.filter((moduleId) => requestedModuleIds.has(moduleId));
  for (const moduleId of selectedModuleIds) {
    if (!functionalModuleIds.includes(moduleId) || !blueprint.supportedModuleIds.includes(moduleId)) {
      throw new CatalogError('MODULE_UNSUPPORTED', `Le module ${moduleId} n’est pas compatible avec ce type de site ou son implémentation actuelle.`);
    }
  }
  const pages = blueprint.pages.filter((page) => !page.requiredModuleId || selectedModuleIds.includes(page.requiredModuleId)).map((page) => ({
    ...page,
    components: page.components.filter((component) => {
      const moduleId = requiredModuleForComponent(component);
      return !moduleId || selectedModuleIds.includes(moduleId);
    }),
  }));
  if (!pages.some((page) => page.path === '/')) throw new CatalogError('HOME_REQUIRED', 'La recette doit conserver une page d’accueil.');
  const notices = [blueprint.notice, siteType?.notice].filter((notice): notice is LocalizedText => Boolean(notice));
  return {
    siteType,
    category: siteType ? categoryMap.get(siteType.categoryId) || null : null,
    domain,
    blueprint,
    style,
    templateId: blueprint.templateId,
    locale: selection.locale === 'en' ? 'en' : 'fr',
    selectedModuleIds,
    pages,
    recommendedByDomain: Boolean(!siteType || !domain || domain.siteTypeIds.includes(siteType.id)),
    notices,
  };
}
