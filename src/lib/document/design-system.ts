import {
  DEFAULT_THEME,
  type ColorTokens,
  type DesignSystem,
  type NodeStateStyles,
  type NodeStyle,
  type NodeMotion,
  type PageNode,
  type ResponsiveStateStyles,
  type ResponsiveStyles,
  type ShadowToken,
  type StyleProperty,
  type StyleState,
  type ThemeSettings,
  type Viewport,
} from './types';

const SHADOWS: Record<ShadowToken, string> = {
  none: 'none',
  small: '0 1px 2px rgb(15 23 42 / 8%)',
  medium: '0 10px 30px rgb(15 23 42 / 12%)',
  large: '0 24px 70px rgb(15 23 42 / 18%)',
};

export function createDefaultDesignSystem(theme: ThemeSettings = DEFAULT_THEME): DesignSystem {
  const colors: ColorTokens = {
    primary: theme.primaryColor,
    secondary: theme.secondaryColor,
    accent: theme.accentColor,
    background: theme.backgroundColor,
    surface: theme.surfaceColor,
    text: theme.textColor,
    muted: theme.mutedTextColor,
    heading: theme.textColor,
    link: theme.primaryColor,
    border: '#D8DDE5',
    success: '#237A57',
    warning: '#9A5B13',
    danger: '#B42318',
    info: '#175CD3',
    focus: theme.primaryColor,
  };
  return {
    schemaVersion: '1.0.0',
    name: 'Thème du site',
    colorMode: 'light',
    tokens: {
      colors,
      darkColors: {
        ...colors,
        background: '#10141B', surface: '#19212B', text: '#F2F5F9', muted: '#B2BDCA', heading: '#F8FAFC',
        secondary: '#E9E4FF', border: '#3A4655', focus: '#B9A7FF',
      },
      typography: {
        bodyFont: theme.fontFamily,
        headingFont: theme.headingFontFamily,
        uiFont: theme.fontFamily,
        monoFont: 'ui-monospace, SFMono-Regular, Consolas, monospace',
        baseFontSize: theme.baseFontSize,
        scale: 1.25,
        bodyLineHeight: 1.65,
        headingLineHeight: 1.12,
        letterSpacing: '-0.02em',
        paragraphMaxWidth: 800,
      },
      spacing: { unit: 4, section: theme.sectionSpacing, container: theme.containerWidth, gutter: 32, gap: 20 },
      radius: { small: Math.max(0, Math.round(theme.radius / 2)), medium: theme.radius, large: Math.min(80, theme.radius * 2), pill: 999 },
      shadows: { button: 'none', card: 'none', form: 'none', overlay: 'medium' },
      breakpoints: { tablet: 1024, mobile: 640 },
    },
    components: {
      button: { radius: Math.max(0, Math.round(theme.radius / 2)), paddingX: 20, paddingY: 11, minHeight: 44, fontWeight: 700, hoverLift: 0, uppercase: false },
      card: { radius: theme.radius, padding: 27, borderWidth: 1, shadow: 'none' },
      form: { radius: Math.max(0, Math.round(theme.radius / 2)), borderWidth: 1, minHeight: 44, focusWidth: 3 },
    },
    navigation: { sticky: false, minHeight: 80, linkGap: 24 },
    motion: { duration: 180, easing: 'ease-out', entrance: 'none', reducedMotion: 'respect' },
    styles: [],
  };
}

export function getDesignSystem(theme: ThemeSettings): DesignSystem {
  return theme.designSystem ?? createDefaultDesignSystem(theme);
}

/** Keeps the legacy flat fields and the structured tokens from drifting apart. */
export function normalizeThemeSettings(theme: ThemeSettings): ThemeSettings {
  const designSystem = structuredClone(getDesignSystem(theme));
  const { colors, typography, spacing, radius } = designSystem.tokens;
  return {
    ...theme,
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    accentColor: colors.accent,
    backgroundColor: colors.background,
    surfaceColor: colors.surface,
    textColor: colors.text,
    mutedTextColor: colors.muted,
    fontFamily: typography.bodyFont,
    headingFontFamily: typography.headingFont,
    baseFontSize: typography.baseFontSize,
    containerWidth: spacing.container,
    radius: radius.medium,
    sectionSpacing: spacing.section,
    designSystem,
  };
}

export function withDesignSystem(theme: ThemeSettings, designSystem: DesignSystem): ThemeSettings {
  return normalizeThemeSettings({ ...theme, designSystem });
}

export function themeCssVariables(theme: ThemeSettings, forcedMode?: 'light' | 'dark'): Record<string, string> {
  const design = getDesignSystem(theme);
  const mode = forcedMode ?? design.colorMode;
  const colors = mode === 'dark' ? design.tokens.darkColors : design.tokens.colors;
  const { typography, spacing, radius, shadows } = design.tokens;
  const { button, card, form } = design.components;
  const size = (power: number) => `${Math.round(typography.baseFontSize * typography.scale ** power * 100) / 100}px`;
  return {
    '--site-primary': colors.primary,
    '--site-secondary': colors.secondary,
    '--site-accent': colors.accent,
    '--site-bg': colors.background,
    '--site-surface': colors.surface,
    '--site-text': colors.text,
    '--site-muted': colors.muted,
    '--site-heading': colors.heading,
    '--site-link': colors.link,
    '--site-border': colors.border,
    '--site-success': colors.success,
    '--site-warning': colors.warning,
    '--site-danger': colors.danger,
    '--site-info': colors.info,
    '--site-focus': colors.focus,
    '--site-font': typography.bodyFont,
    '--site-heading-font': typography.headingFont,
    '--site-ui-font': typography.uiFont,
    '--site-mono-font': typography.monoFont,
    '--site-base-font-size': `${typography.baseFontSize}px`,
    '--site-font-size-sm': size(-1),
    '--site-font-size-h3': size(2),
    '--site-font-size-h2': size(4),
    '--site-font-size-h1': size(5),
    '--site-body-line-height': String(typography.bodyLineHeight),
    '--site-heading-line-height': String(typography.headingLineHeight),
    '--site-heading-letter-spacing': typography.letterSpacing,
    '--site-paragraph-width': `${typography.paragraphMaxWidth}px`,
    '--site-space-unit': `${spacing.unit}px`,
    '--site-radius': `${radius.medium}px`,
    '--site-radius-sm': `${radius.small}px`,
    '--site-radius-lg': `${radius.large}px`,
    '--site-radius-pill': `${radius.pill}px`,
    '--site-container': `${spacing.container}px`,
    '--site-section-spacing': `${spacing.section}px`,
    '--site-gutter': `${spacing.gutter}px`,
    '--site-gap': `${spacing.gap}px`,
    '--site-button-radius': `${button.radius}px`,
    '--site-button-padding-x': `${button.paddingX}px`,
    '--site-button-padding-y': `${button.paddingY}px`,
    '--site-button-min-height': `${button.minHeight}px`,
    '--site-button-font-weight': String(button.fontWeight),
    '--site-button-hover-lift': `${button.hoverLift}px`,
    '--site-button-shadow': SHADOWS[shadows.button],
    '--site-button-transform': button.uppercase ? 'uppercase' : 'none',
    '--site-card-radius': `${card.radius}px`,
    '--site-card-padding': `${card.padding}px`,
    '--site-card-border-width': `${card.borderWidth}px`,
    '--site-card-shadow': SHADOWS[card.shadow],
    '--site-form-radius': `${form.radius}px`,
    '--site-form-border-width': `${form.borderWidth}px`,
    '--site-form-min-height': `${form.minHeight}px`,
    '--site-form-focus-width': `${form.focusWidth}px`,
    '--site-overlay-shadow': SHADOWS[shadows.overlay],
    '--site-nav-height': `${design.navigation.minHeight}px`,
    '--site-nav-gap': `${design.navigation.linkGap}px`,
    '--site-motion-duration': `${design.motion.reducedMotion === 'reduce' ? 0 : design.motion.duration}ms`,
    '--site-motion-easing': design.motion.easing,
    colorScheme: design.colorMode === 'auto' && !forcedMode ? 'light dark' : mode === 'dark' ? 'dark' : 'light',
  };
}

function safeVariableValue(value: string): boolean {
  return value.length <= 300 && !/[;{}<>\\]/.test(value) && !/(?:url|expression|javascript|@import)\s*\(?/i.test(value);
}

function declarations(variables: Record<string, string>, important = false): string {
  return Object.entries(variables).filter(([key, value]) => /^--[a-z0-9-]+$/.test(key) && safeVariableValue(value)).map(([key, value]) => `${key}:${value}${important ? '!important' : ''}`).join(';');
}

/** Controlled global CSS: every value originates in the validated token model. */
export function themeGlobalCss(theme: ThemeSettings): string {
  const design = getDesignSystem(theme);
  const dark = design.colorMode === 'auto'
    ? `@media (prefers-color-scheme:dark){.woob-theme{${declarations(themeCssVariables(theme, 'dark'), true)}}}`
    : '';
  const navigation = design.navigation.sticky
    ? '.woob-theme .wb-node-header{position:sticky;top:0;z-index:30;background:var(--site-bg)}'
    : '';
  const entrance = design.motion.entrance === 'none' ? '' : `.woob-theme .wb-node{animation:woob-${design.motion.entrance} var(--site-motion-duration) var(--site-motion-easing) both}`;
  const reduced = '.woob-theme *,.woob-theme *::before,.woob-theme *::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;transition-delay:0ms!important}.woob-theme [data-motion-preset]{animation:none!important;clip-path:none!important;scale:none!important;translate:none!important}.woob-theme [data-motion-state="pending"]{opacity:1!important}';
  return `
    .woob-theme{color-scheme:light dark}
    .woob-theme .wb-page{padding-left:var(--site-gutter);padding-right:var(--site-gutter)}
    .woob-theme .published-site,.woob-theme.canvas-document{font-size:var(--site-base-font-size);line-height:var(--site-body-line-height)}
    .woob-theme h1,.woob-theme h2,.woob-theme h3{color:var(--site-heading);line-height:var(--site-heading-line-height);letter-spacing:var(--site-heading-letter-spacing)}
    .woob-theme h1{font-size:var(--site-font-size-h1)}.woob-theme h2{font-size:var(--site-font-size-h2)}.woob-theme h3{font-size:var(--site-font-size-h3)}
    .woob-theme a{color:var(--site-link)}.woob-theme .eyebrow{color:var(--site-primary)}.woob-theme .muted{color:var(--site-muted)}
    .woob-theme .button.primary{color:#fff}.woob-theme .button.light{color:#17231f}.woob-theme .creative-mode-dark .button.primary{color:var(--site-bg)}.woob-theme .wb-cta .eyebrow{color:#fff}
    .woob-theme .wb-text{line-height:var(--site-body-line-height);max-width:var(--site-paragraph-width)}
    .woob-theme .button{border-radius:var(--site-button-radius);padding:var(--site-button-padding-y) var(--site-button-padding-x);min-height:var(--site-button-min-height);font-weight:var(--site-button-font-weight);box-shadow:var(--site-button-shadow);text-transform:var(--site-button-transform);transition:transform var(--site-motion-duration) var(--site-motion-easing),box-shadow var(--site-motion-duration) var(--site-motion-easing)}
    .woob-theme .button:hover{transform:translateY(calc(-1 * var(--site-button-hover-lift)))}
    .woob-theme :is(.feature-card,.pricing-card,.post-card,.product-card){border-radius:var(--site-card-radius);padding:var(--site-card-padding);border-width:var(--site-card-border-width);box-shadow:var(--site-card-shadow)}
    .woob-theme :is(input,textarea,select){border-radius:var(--site-form-radius);border-width:var(--site-form-border-width);min-height:var(--site-form-min-height)}
    .woob-theme :is(a,button,input,textarea,select,summary):focus-visible{outline:var(--site-form-focus-width) solid var(--site-focus);outline-offset:3px}
    .woob-theme .wb-header{min-height:var(--site-nav-height)}.woob-theme .wb-header nav{gap:var(--site-nav-gap)}
    .woob-theme .order-popover{box-shadow:var(--site-overlay-shadow)}
    ${navigation}${entrance}${dark}
    @keyframes woob-fade{from{opacity:0}to{opacity:1}}@keyframes woob-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @media (max-width:${design.tokens.breakpoints.tablet}px){.woob-theme .wb-hero{grid-template-columns:1fr;min-height:0}.woob-theme .wb-hero :is(.hero-copy,.hero-visual){grid-area:auto;margin:0;max-width:none;width:100%}.woob-theme .wb-hero .hero-copy{padding-bottom:0}.woob-theme .wb-hero-monumental .hero-copy>p{margin-left:0}.woob-theme .wb-hero-immersive :is(.hero-image,.hero-art),.woob-theme .wb-hero-immersive .hero-visual{min-height:420px}.woob-theme .card-grid.three{grid-template-columns:repeat(2,minmax(0,1fr))}.woob-theme .features-editorial{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media (max-width:${design.tokens.breakpoints.mobile}px){.woob-theme .wb-page{padding-left:calc(var(--site-gutter) * .65);padding-right:calc(var(--site-gutter) * .65)}.woob-theme :is(.card-grid.three,.card-grid.two,.gallery-grid,.stats-grid){grid-template-columns:1fr}.woob-theme .gallery-filmstrip{grid-template-columns:none;grid-auto-columns:82%}.woob-theme .features-editorial .feature-card:first-child,.woob-theme .gallery-editorial>:first-child{grid-row:auto;min-height:0}.woob-theme .wb-hero-monumental .hero-copy h1{font-size:clamp(46px,15vw,72px)}.woob-theme .wb-hero-immersive :is(.hero-image,.hero-art),.woob-theme .wb-hero-immersive .hero-visual{min-height:340px}.woob-theme .treatment-orbital::after{right:0}.woob-theme .wb-header{align-items:flex-start;flex-direction:column}.woob-theme .wb-cta,.woob-theme .wb-section.tinted{padding:calc(var(--site-card-padding) * 1.25)}}
    @media (prefers-reduced-motion:reduce){${reduced}}
    ${design.motion.reducedMotion === 'reduce' ? reduced : ''}
  `;
}

function sharedStyle(node: PageNode, design: DesignSystem) {
  return node.styleId ? design.styles.find((style) => style.id === node.styleId) : undefined;
}

/** Desktop → tablet → mobile; local exceptions win at every tier. */
export function resolveNodeStyle(node: PageNode, viewport: Viewport, design: DesignSystem): NodeStyle {
  const shared = sharedStyle(node, design);
  // Resolve the reusable cascade first, then the local cascade: a deliberate local exception is never lost on another device.
  const resolved: NodeStyle = { ...shared?.styles };
  if (viewport !== 'desktop') Object.assign(resolved, shared?.responsive?.tablet);
  if (viewport === 'mobile') Object.assign(resolved, shared?.responsive?.mobile);
  Object.assign(resolved, node.styles);
  if (viewport !== 'desktop') Object.assign(resolved, node.responsive?.tablet);
  if (viewport === 'mobile') Object.assign(resolved, node.responsive?.mobile);
  return resolved;
}

export function resolveNodeStateStyle(node: PageNode, viewport: Viewport, state: StyleState, design: DesignSystem): NodeStyle {
  const shared = sharedStyle(node, design);
  const resolved: NodeStyle = { ...shared?.states?.[state] };
  if (viewport !== 'desktop') Object.assign(resolved, shared?.responsiveStates?.tablet?.[state]);
  if (viewport === 'mobile') Object.assign(resolved, shared?.responsiveStates?.mobile?.[state]);
  Object.assign(resolved, node.states?.[state]);
  if (viewport !== 'desktop') Object.assign(resolved, node.responsiveStates?.tablet?.[state]);
  if (viewport === 'mobile') Object.assign(resolved, node.responsiveStates?.mobile?.[state]);
  return resolved;
}

export function setNodeStyle(node: PageNode, property: StyleProperty, value: string | number | null, viewport: Viewport, state?: StyleState): void {
  let styles: NodeStyle;
  if (state) {
    if (viewport === 'desktop') {
      node.states ??= {};
      styles = node.states[state] ??= {};
    } else {
      node.responsiveStates ??= {};
      const states: NodeStateStyles = node.responsiveStates[viewport] ??= {};
      styles = states[state] ??= {};
    }
  } else if (viewport === 'desktop') {
    styles = node.styles;
  } else {
    node.responsive ??= {};
    styles = node.responsive[viewport] ??= {};
  }
  if (value === null || value === '') delete styles[property];
  else styles[property] = value;
}

export interface NodeStyleSnapshot {
  styleId?: string;
  styles: NodeStyle;
  responsive?: ResponsiveStyles;
  states?: NodeStateStyles;
  responsiveStates?: ResponsiveStateStyles;
  cssVariables?: Record<string, string | number>;
  motion?: NodeMotion;
}

export function copyNodeStyle(node: PageNode): NodeStyleSnapshot {
  return structuredClone({
    ...(node.styleId ? { styleId: node.styleId } : {}),
    styles: node.styles,
    ...(node.responsive ? { responsive: node.responsive } : {}),
    ...(node.states ? { states: node.states } : {}),
    ...(node.responsiveStates ? { responsiveStates: node.responsiveStates } : {}),
    ...(node.cssVariables ? { cssVariables: node.cssVariables } : {}),
    ...(node.motion ? { motion: node.motion } : {}),
  });
}

export function pasteNodeStyle(node: PageNode, snapshot: NodeStyleSnapshot): void {
  const copy = structuredClone(snapshot);
  if (copy.styleId) node.styleId = copy.styleId;
  else delete node.styleId;
  node.styles = copy.styles;
  if (copy.responsive) node.responsive = copy.responsive; else delete node.responsive;
  if (copy.states) node.states = copy.states; else delete node.states;
  if (copy.responsiveStates) node.responsiveStates = copy.responsiveStates; else delete node.responsiveStates;
  if (copy.cssVariables) node.cssVariables = copy.cssVariables; else delete node.cssVariables;
  if (copy.motion) node.motion = copy.motion; else delete node.motion;
}

export function resetNodeStyle(node: PageNode): void {
  delete node.styleId;
  node.styles = {};
  delete node.responsive;
  delete node.states;
  delete node.responsiveStates;
  delete node.cssVariables;
  delete node.motion;
}

function luminance(hex: string): number | null {
  const match = /^#([\da-f]{6})$/i.exec(hex);
  if (!match) return null;
  const value = match[1]!;
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function contrastRatio(foreground: string, background: string): number | null {
  const first = luminance(foreground); const second = luminance(background);
  if (first === null || second === null) return null;
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function auditThemeContrast(theme: ThemeSettings) {
  const design = getDesignSystem(theme);
  const palettes = design.colorMode === 'light' ? [['Clair', design.tokens.colors] as const] : design.colorMode === 'dark' ? [['Sombre', design.tokens.darkColors] as const] : [['Clair', design.tokens.colors] as const, ['Sombre', design.tokens.darkColors] as const];
  return palettes.flatMap(([label, colors]) => [
    { id: `${label}-text`, label: `${label} · texte / fond`, ratio: contrastRatio(colors.text, colors.background) },
    { id: `${label}-muted`, label: `${label} · texte secondaire / fond`, ratio: contrastRatio(colors.muted, colors.background) },
    { id: `${label}-surface`, label: `${label} · texte / surface`, ratio: contrastRatio(colors.text, colors.surface) },
    { id: `${label}-link`, label: `${label} · lien / fond`, ratio: contrastRatio(colors.link, colors.background) },
  ]);
}
