import type { CreativeDirection, MotionPreset, ProjectBrief } from '@/lib/creative/types';

export const COMPONENT_TYPES = [
  'page', 'section', 'heading', 'text', 'button', 'image',
  'hero', 'features', 'cta', 'contactForm', 'header', 'footer',
  'gallery', 'testimonials', 'pricing', 'faq', 'stats',
  'team', 'reservation', 'blog', 'products', 'contact', 'scene3d',
] as const;
export type ComponentType = typeof COMPONENT_TYPES[number];

export type Viewport = 'desktop' | 'tablet' | 'mobile';
export type EditorMode = 'simple' | 'advanced' | 'expert';
export type NodeMotionPreset = MotionPreset | 'parallax';
export const SCROLL_MOTION_COMPONENT_TYPES: readonly ComponentType[] = ['section', 'hero', 'features', 'gallery', 'stats', 'products', 'blog', 'image', 'heading', 'text', 'cta'];
export function supportsScrollMotion(type: ComponentType): boolean { return SCROLL_MOTION_COMPONENT_TYPES.includes(type); }
export type StyleState = 'hover' | 'focus-visible' | 'active' | 'disabled';
export type ShadowToken = 'none' | 'small' | 'medium' | 'large';
export interface NodeMotion {
  preset: NodeMotionPreset;
  trigger: 'in-view' | 'scroll';
  duration: number;
  delay: number;
  distance: number;
}

/** Only these declarations can enter the renderer. This is not an arbitrary CSS field. */
export const STYLE_PROPERTIES = [
  'color', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundAttachment', 'backgroundBlendMode',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textAlign', 'textTransform', 'textDecoration', 'textIndent', 'overflowWrap', 'hyphens',
  'width', 'minWidth', 'maxWidth', 'height', 'minHeight', 'maxHeight', 'aspectRatio', 'boxSizing',
  'display', 'visibility', 'opacity', 'overflow', 'overflowX', 'overflowY', 'position', 'top', 'right', 'bottom', 'left', 'zIndex',
  'flexDirection', 'flexWrap', 'flexGrow', 'flexShrink', 'flexBasis', 'justifyContent', 'alignItems', 'alignContent', 'alignSelf', 'justifySelf', 'order', 'gap', 'rowGap', 'columnGap',
  'gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'border', 'borderWidth', 'borderStyle', 'borderColor', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft', 'borderRadius',
  'boxShadow', 'outline', 'outlineColor', 'outlineOffset', 'filter', 'backdropFilter', 'transform', 'transformOrigin',
  'objectFit', 'objectPosition', 'cursor', 'caretColor', 'accentColor',
  'transitionProperty', 'transitionDuration', 'transitionTimingFunction', 'transitionDelay',
  'animationName', 'animationDuration', 'animationTimingFunction', 'animationDelay', 'animationIterationCount', 'animationDirection', 'animationFillMode',
] as const;
export type StyleProperty = typeof STYLE_PROPERTIES[number];
export type NodeStyle = Partial<Record<StyleProperty, string | number>>;
export type ResponsiveStyles = { tablet?: NodeStyle; mobile?: NodeStyle };
export type NodeStateStyles = Partial<Record<StyleState, NodeStyle>>;
export type ResponsiveStateStyles = { tablet?: NodeStateStyles; mobile?: NodeStateStyles };

export interface SharedStyle {
  id: string;
  name: string;
  componentType?: ComponentType;
  styles: NodeStyle;
  responsive?: ResponsiveStyles;
  states?: NodeStateStyles;
  responsiveStates?: ResponsiveStateStyles;
}

export interface ColorTokens {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  heading: string;
  link: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  focus: string;
}

export interface DesignSystem {
  schemaVersion: '1.0.0';
  name: string;
  colorMode: 'light' | 'dark' | 'auto';
  tokens: {
    colors: ColorTokens;
    darkColors: ColorTokens;
    typography: {
      bodyFont: string;
      headingFont: string;
      /** Explicit catalog opt-in; legacy themes keep their historical browser weights. */
      bodyFontWeight?: number | undefined;
      headingFontWeight?: number | undefined;
      uiFont: string;
      monoFont: string;
      baseFontSize: number;
      scale: number;
      bodyLineHeight: number;
      headingLineHeight: number;
      letterSpacing: string;
      paragraphMaxWidth: number;
    };
    spacing: { unit: number; section: number; container: number; gutter: number; gap: number };
    radius: { small: number; medium: number; large: number; pill: number };
    shadows: { button: ShadowToken; card: ShadowToken; form: ShadowToken; overlay: ShadowToken };
    breakpoints: { tablet: number; mobile: number };
  };
  components: {
    button: { radius: number; paddingX: number; paddingY: number; minHeight: number; fontWeight: number; hoverLift: number; uppercase: boolean };
    card: { radius: number; padding: number; borderWidth: number; shadow: ShadowToken };
    form: { radius: number; borderWidth: number; minHeight: number; focusWidth: number };
  };
  navigation: { sticky: boolean; minHeight: number; linkGap: number };
  motion: { duration: number; easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear'; entrance: 'none' | 'fade' | 'rise'; reducedMotion: 'respect' | 'reduce' };
  styles: SharedStyle[];
}

export interface ThemeSettings {
  /** Legacy flat fields remain for document 1.0 compatibility and are synchronized with tokens. */
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  fontFamily: string;
  headingFontFamily: string;
  baseFontSize: number;
  containerWidth: number;
  radius: number;
  sectionSpacing: number;
  designSystem?: DesignSystem | undefined;
  /** Original, justified art direction. Tokens remain the live visual source of truth. */
  creativeDirection?: CreativeDirection | undefined;
}

export const DEFAULT_THEME: ThemeSettings = {
  primaryColor: '#7C5CFC', secondaryColor: '#1D2033', accentColor: '#FF7A59',
  backgroundColor: '#FAFAF8', surfaceColor: '#FFFFFF', textColor: '#1D2033', mutedTextColor: '#667085',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', headingFontFamily: 'Georgia, serif',
  baseFontSize: 16, containerWidth: 1180, radius: 18, sectionSpacing: 80,
};

export interface PageNode {
  id: string;
  type: ComponentType;
  version: number;
  name?: string;
  props: Record<string, unknown>;
  /** Optional reference to a reusable style in the global design system. */
  styleId?: string;
  /** Local exceptions always win over the referenced reusable style. */
  styles: NodeStyle;
  responsive?: ResponsiveStyles;
  states?: NodeStateStyles;
  responsiveStates?: ResponsiveStateStyles;
  /** Expert-only, scoped custom properties. Names and values are validated. */
  cssVariables?: Record<string, string | number>;
  /** Optional native in-view or bounded scroll choreography; absent means static content. */
  motion?: NodeMotion;
  children?: PageNode[];
}

export interface PageDocument {
  schemaVersion: '1.0.0';
  documentId: string;
  pageId: string;
  revision: number;
  metadata: { title: string; description: string; path: string };
  theme: ThemeSettings;
  root: PageNode;
}

export interface SiteSnapshot {
  projectId: string;
  publicationId: string;
  publishedAt: string;
  name: string;
  description: string;
  slug: string;
  defaultLocale: string;
  theme: ThemeSettings;
  /** Present for Creative Engine projects; legacy snapshots remain valid without it. */
  creativeBrief?: ProjectBrief | undefined;
  pages: { id: string; path: string; name: string; seoTitle: string; seoDescription: string; document: PageDocument }[];
  navigation: { label: string; path: string }[];
  modules: string[];
  products: { id: string; name: string; slug: string; description: string; priceCents: number; currency: string; inventory: number | null; imageAssetId?: string | null }[];
  posts: { id: string; title: string; slug: string; excerpt: string; content: string; publishedAt: string | null }[];
}
