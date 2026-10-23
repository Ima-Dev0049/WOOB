import type { ComponentType, ThemeSettings } from '@/lib/document/types';

export type UiLanguage = 'fr' | 'en';
export type LocalizedText = { fr: string; en?: string };
export type CatalogEntry = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  keywords: string[];
  parentId?: string;
};

export const functionalModuleIds = ['forms', 'blog', 'catalog', 'reservations'] as const;
export type FunctionalModuleId = (typeof functionalModuleIds)[number];

export type FunctionalModule = Omit<CatalogEntry, 'id'> & {
  id: FunctionalModuleId;
  availability: 'implemented';
  componentTypes: Exclude<ComponentType, 'page'>[];
};

export type SiteCategory = CatalogEntry & { blueprintId: string };
export type SiteType = CatalogEntry & {
  categoryId: string;
  blueprintId: string;
  notice?: LocalizedText;
};

export type ActivityDomain = CatalogEntry & {
  siteTypeIds: string[];
};

export type DesignStyle = CatalogEntry & {
  theme: ThemeSettings;
};

export type PageRecipe = {
  id: string;
  name: LocalizedText;
  path: string;
  components: Exclude<ComponentType, 'page'>[];
  requiredModuleId?: FunctionalModuleId;
};

export type SiteBlueprint = {
  id: string;
  templateId: string;
  recommendedModuleIds: FunctionalModuleId[];
  supportedModuleIds: FunctionalModuleId[];
  pages: PageRecipe[];
  notice?: LocalizedText;
};

export type CreationSelection = {
  name: string;
  brief?: string | undefined;
  siteTypeId?: string | null | undefined;
  activityDomainId?: string | null | undefined;
  designStyleId?: string | undefined;
  moduleIds?: FunctionalModuleId[] | undefined;
  locale?: UiLanguage | undefined;
};

export type CatalogSelectionSnapshot = {
  version: 1;
  siteTypeId: string | null;
  activityDomainId: string | null;
  designStyleId: string;
  blueprintId: string;
  templateId: string;
  locale: UiLanguage;
  moduleIds: FunctionalModuleId[];
};

export type ResolvedCreation = {
  siteType: SiteType | null;
  category: SiteCategory | null;
  domain: ActivityDomain | null;
  blueprint: SiteBlueprint;
  style: DesignStyle;
  templateId: string;
  locale: UiLanguage;
  selectedModuleIds: FunctionalModuleId[];
  pages: PageRecipe[];
  recommendedByDomain: boolean;
  notices: LocalizedText[];
};

export type ProjectContent = {
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  seoDescription: string;
};

export type ProjectGenerationContext = {
  projectName: string;
  brief: string;
  locale: UiLanguage;
  siteType: { id: string; name: string } | null;
  activityDomain: { id: string; name: string } | null;
  designStyle: { id: string; name: string };
  modules: { id: FunctionalModuleId; name: string; description: string }[];
  pages: { path: string; name: string; components: string[] }[];
  limitations: string[];
};

export class CatalogError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'CatalogError';
  }
}
