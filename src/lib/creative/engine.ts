import type { ProjectGenerationContext } from '@/lib/catalog/types';
import { contrastRatio, getDesignSystem, normalizeThemeSettings, withDesignSystem } from '@/lib/document/design-system';
import type { PageDocument, PageNode, ThemeSettings } from '@/lib/document/types';
import { createLocalProjectBrief } from './brief';
import { creativeDirectionResultSchema } from './schema';
import type { CreativeDirection, CreativeDirectionResult, CreativeEvaluation, HeroLayout, MotionPreset, ProjectBrief } from './types';

type PaletteRecipe = 'origin' | 'tinted' | 'nocturne' | 'pulse';
type Archetype = {
  id: string;
  name: { fr: string; en: string };
  concept: { fr: string; en: string };
  personality: { fr: string[]; en: string[] };
  heroLayout: HeroLayout;
  featuresLayout: 'cards' | 'editorial' | 'minimal' | 'bento';
  galleryLayout: 'grid' | 'editorial' | 'filmstrip';
  rhythm: 'compact' | 'balanced' | 'airy';
  treatment: 'plain' | 'organic' | 'framed' | 'orbital' | 'duotone' | 'product' | 'ledger';
  motion: MotionPreset;
  intensity: 'subtle' | 'expressive';
  palette: PaletteRecipe;
  headingFont: string;
  scale: 'monumental' | 'editorial' | 'balanced';
  keywords: string[];
};

const SYSTEM_FONT = 'Inter, Avenir, "Segoe UI", Helvetica, Arial, sans-serif';
const EDITORIAL_FONT = 'Georgia, "Times New Roman", serif';
const SPACE_FONT = '"Space Grotesk", Inter, ui-sans-serif, system-ui, sans-serif';
const ARCHETYPES: Archetype[] = [
  {
    id: 'editorial-ritual', name: { fr: 'Rituel éditorial', en: 'Editorial ritual' },
    concept: { fr: 'Une lecture en chapitres, avec un titre expressif et des preuves disposées comme dans un magazine.', en: 'A chapter-like reading experience, with expressive type and evidence arranged like a magazine.' },
    personality: { fr: ['éditorial', 'précis', 'chaleureux'], en: ['editorial', 'precise', 'warm'] },
    heroLayout: 'editorial', featuresLayout: 'editorial', galleryLayout: 'editorial', rhythm: 'airy', treatment: 'framed', motion: 'reveal', intensity: 'subtle', palette: 'origin', headingFont: EDITORIAL_FONT, scale: 'editorial', keywords: ['histoire', 'story', 'éditorial', 'magazine', 'artisan', 'restaurant', 'culture'],
  },
  {
    id: 'immersive-atlas', name: { fr: 'Atlas immersif', en: 'Immersive atlas' },
    concept: { fr: 'Un décor profond et une progression contemplative qui laissent les images porter l’atmosphère.', en: 'A deep setting and contemplative progression that let imagery carry the atmosphere.' },
    personality: { fr: ['immersif', 'sensible', 'assuré'], en: ['immersive', 'sensitive', 'confident'] },
    heroLayout: 'immersive', featuresLayout: 'minimal', galleryLayout: 'filmstrip', rhythm: 'airy', treatment: 'duotone', motion: 'fade', intensity: 'subtle', palette: 'nocturne', headingFont: SYSTEM_FONT, scale: 'editorial', keywords: ['immersion', 'immersive', 'voyage', 'travel', 'nature', 'photographe', 'photography', 'audacieux'],
  },
  {
    id: 'monumental-signal', name: { fr: 'Signal monumental', en: 'Monumental signal' },
    concept: { fr: 'Un manifeste typographique, peu de blocs et de grands silences pour rendre la promesse mémorable.', en: 'A typographic manifesto, fewer blocks and generous silence to make the promise memorable.' },
    personality: { fr: ['monumental', 'minimal', 'radical'], en: ['monumental', 'minimal', 'bold'] },
    heroLayout: 'monumental', featuresLayout: 'minimal', galleryLayout: 'editorial', rhythm: 'airy', treatment: 'organic', motion: 'rise', intensity: 'expressive', palette: 'tinted', headingFont: EDITORIAL_FONT, scale: 'monumental', keywords: ['luxe', 'luxury', 'minimal', 'manifeste', 'premium', 'mode', 'fashion', 'architecture'],
  },
  {
    id: 'product-stage', name: { fr: 'Scène produit', en: 'Product stage' },
    concept: { fr: 'Une scène compacte qui rapproche le produit, ses bénéfices et l’action sans détour décoratif.', en: 'A compact stage that brings product, benefits and action together without decorative detours.' },
    personality: { fr: ['tangible', 'direct', 'soigné'], en: ['tangible', 'direct', 'polished'] },
    heroLayout: 'product-stage', featuresLayout: 'cards', galleryLayout: 'grid', rhythm: 'compact', treatment: 'product', motion: 'scale', intensity: 'subtle', palette: 'tinted', headingFont: SYSTEM_FONT, scale: 'balanced', keywords: ['produit', 'product', 'boutique', 'shop', 'objet', 'commande', 'catalogue'],
  },
  {
    id: 'clear-conversation', name: { fr: 'Conversation claire', en: 'Clear conversation' },
    concept: { fr: 'Une composition en deux temps qui répond d’abord aux questions puis ouvre une relation simple.', en: 'A two-part composition that answers key questions before opening a simple conversation.' },
    personality: { fr: ['clair', 'utile', 'accessible'], en: ['clear', 'useful', 'accessible'] },
    heroLayout: 'split', featuresLayout: 'cards', galleryLayout: 'grid', rhythm: 'balanced', treatment: 'orbital', motion: 'rise', intensity: 'subtle', palette: 'origin', headingFont: SYSTEM_FONT, scale: 'balanced', keywords: ['service', 'conseil', 'consulting', 'formation', 'education', 'santé', 'health', 'contact'],
  },
  {
    id: 'operations-pulse', name: { fr: 'Pulse métrique', en: 'Metric pulse' },
    concept: { fr: 'Un centre de commande visuel qui hiérarchise les activités en panneaux lisibles, sans transformer les fonctions en décor.', en: 'A visual control centre that organises activity into readable panels without turning functions into decoration.' },
    personality: { fr: ['modulaire', 'réactif', 'précis'], en: ['modular', 'responsive', 'precise'] },
    heroLayout: 'operations', featuresLayout: 'bento', galleryLayout: 'grid', rhythm: 'balanced', treatment: 'ledger', motion: 'rise', intensity: 'subtle', palette: 'pulse', headingFont: SPACE_FONT, scale: 'editorial', keywords: ['gestion', 'management', 'dashboard', 'opérations', 'operations', 'école', 'school', 'restaurant', 'entreprise', 'suivi'],
  },
];

const STYLE_ARCHETYPE: Record<string, string> = {
  'professional-clear': 'clear-conversation', 'minimal-luxury': 'monumental-signal', 'warm-artisanal': 'editorial-ritual',
  'editorial-modern': 'editorial-ritual', 'bold-creative': 'immersive-atlas', 'natural-organic': 'immersive-atlas',
  'pulse-management': 'operations-pulse',
};

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) { result ^= value.charCodeAt(index); result = Math.imul(result, 16777619); }
  return result >>> 0;
}
function hex(value: string): [number, number, number] {
  const match = /^#([\da-f]{6})$/i.exec(value);
  if (!match) return [0, 0, 0];
  return [0, 2, 4].map((offset) => Number.parseInt(match[1]!.slice(offset, offset + 2), 16)) as [number, number, number];
}
function mix(left: string, right: string, amount: number): string {
  const a = hex(left); const b = hex(right);
  return `#${a.map((channel, index) => Math.round(channel + (b[index]! - channel) * amount).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}
function readable(base: string, background: string, minimum = 4.5): string {
  const target = (contrastRatio('#FFFFFF', background) ?? 0) >= (contrastRatio('#000000', background) ?? 0) ? '#FFFFFF' : '#000000';
  let result = base;
  for (let step = 0; step < 20 && (contrastRatio(result, background) ?? 0) < minimum; step += 1) result = mix(result, target, 0.12);
  return (contrastRatio(result, background) ?? 0) >= minimum ? result : target;
}
function truncate(value: string, maximum: number): string { return value.length > maximum ? `${value.slice(0, maximum - 1).trim()}…` : value; }
function localized(locale: 'fr' | 'en', fr: string, en: string): string { return locale === 'en' ? en : fr; }

function paletteFor(recipe: PaletteRecipe, theme: ThemeSettings, locale: 'fr' | 'en'): CreativeDirection['palette'] {
  const mode = recipe === 'nocturne' || recipe === 'pulse' ? 'dark' : 'light';
  const background = mode === 'dark' ? mix(theme.secondaryColor, '#05080D', 0.48) : recipe === 'tinted' ? mix(theme.backgroundColor, theme.primaryColor, 0.035) : theme.backgroundColor;
  const surface = mode === 'dark' ? mix(background, '#FFFFFF', 0.075) : mix(theme.surfaceColor, theme.primaryColor, recipe === 'tinted' ? 0.045 : 0.012);
  const text = mode === 'dark' ? '#F7F5F0' : readable(theme.textColor, background);
  const muted = readable(mode === 'dark' ? mix(text, background, 0.28) : theme.mutedTextColor, background);
  const primarySeed = recipe === 'pulse' ? mix(theme.primaryColor, '#D8FF8A', 0.82) : theme.primaryColor;
  let primary = readable(primarySeed, background);
  primary = readable(primary, surface);
  if (mode === 'light') primary = readable(primary, '#FFFFFF');
  const secondary = readable(theme.secondaryColor, '#FFFFFF');
  const accent = recipe === 'pulse' ? readable(readable(theme.accentColor, background), surface) : theme.accentColor;
  const rationale = recipe === 'pulse'
    ? localized(locale, 'Un fond encre et des accents lime éclaircis structurent les panneaux sans sacrifier le contraste.', 'An ink background and lightened lime accents structure the panels without sacrificing contrast.')
    : localized(locale, recipe === 'nocturne' ? 'Un fond nocturne et des accents éclaircis pour préserver les contrastes.' : recipe === 'tinted' ? 'Une teinte de la couleur choisie irrigue les surfaces sans remplacer la couleur texte.' : 'La couleur du style choisi reste le repère principal, corrigée si nécessaire pour le contraste.', recipe === 'nocturne' ? 'A night background and lightened accents preserve contrast.' : recipe === 'tinted' ? 'A tint of the selected colour flows through surfaces without replacing text colour.' : 'The selected style colour remains the main anchor, adjusted only when contrast requires it.');
  return { mode, primary, secondary, accent, background, surface, text, muted, rationale };
}

function briefSignals(context: ProjectGenerationContext) {
  const brief = context.brief.replace(/\s+/g, ' ').trim();
  const emotional = /chaleur|chaleureu|accueil|warm|welcoming/i.test(brief) ? localized(context.locale, 'Chaleur et proximité', 'Warmth and closeness')
    : /luxe|premium|raffin|luxury/i.test(brief) ? localized(context.locale, 'Calme et distinction', 'Calm and distinction')
      : /audacieux|énergie|bold|energy/i.test(brief) ? localized(context.locale, 'Énergie et confiance', 'Energy and confidence')
        : localized(context.locale, 'Clarté et confiance', 'Clarity and confidence');
  return { brief, emotional };
}

function conversionFor(context: ProjectGenerationContext): CreativeDirection['conversion'] {
  if (context.modules.some((module) => module.id === 'reservations')) return { goal: localized(context.locale, 'Transformer l’intérêt en demande de réservation.', 'Turn interest into a reservation request.'), action: localized(context.locale, 'Demander une réservation', 'Request a reservation') };
  if (context.modules.some((module) => module.id === 'catalog')) return { goal: localized(context.locale, 'Faire découvrir les produits puis faciliter une commande manuelle.', 'Help visitors discover products and place a manual order.'), action: localized(context.locale, 'Découvrir les produits', 'Explore products') };
  if (context.modules.some((module) => module.id === 'blog')) return { goal: localized(context.locale, 'Faire lire un contenu puis ouvrir le contact.', 'Encourage reading before opening contact.'), action: localized(context.locale, 'Lire puis échanger', 'Read and get in touch') };
  return { goal: localized(context.locale, 'Expliquer la valeur et conduire vers une prise de contact.', 'Explain the value and lead to contact.'), action: localized(context.locale, 'Nous contacter', 'Get in touch') };
}

export function measureCreativeDiversity(candidates: CreativeDirection[]) {
  const compositions = new Set(candidates.map((candidate) => [candidate.composition.heroLayout, candidate.composition.featuresLayout, candidate.composition.galleryLayout, candidate.composition.rhythm].join(':')));
  const palettes = new Set(candidates.map((candidate) => Object.values(candidate.palette).filter((value) => value.startsWith('#')).join(':')));
  const motions = new Set(candidates.map((candidate) => `${candidate.motion.preset}:${candidate.motion.intensity}:${candidate.motion.enabled !== false}`));
  const count = Math.max(1, candidates.length);
  const sharedDecisions: string[] = [];
  for (const [label, values] of [['typographie', candidates.map((candidate) => candidate.typography.headingFont)], ['rythme', candidates.map((candidate) => candidate.composition.rhythm)], ['médias', candidates.map((candidate) => candidate.imagery.treatment)]] as const) {
    if (new Set(values).size === 1) sharedDecisions.push(label);
  }
  return { score: Math.round(((compositions.size / count) * 0.65 + (palettes.size / count) * 0.2 + (motions.size / count) * 0.15) * 100), uniqueCompositions: compositions.size, uniquePalettes: palettes.size, sharedDecisions };
}

/** Deterministic, transparent rules: no remote AI call and no claim of semantic understanding beyond these signals. */
export function createLocalCreativeDirections(context: ProjectGenerationContext, baseTheme: ThemeSettings, briefInput?: ProjectBrief): CreativeDirectionResult {
  const projectBrief = briefInput || createLocalProjectBrief(context);
  const preferredId = STYLE_ARCHETYPE[context.designStyle.id] || 'clear-conversation';
  const preferred = ARCHETYPES.find((candidate) => candidate.id === preferredId)!;
  const offset = hash(`${context.projectName}:${context.brief}`) % (ARCHETYPES.length - 1);
  const alternatives = ARCHETYPES.filter((candidate) => candidate.id !== preferredId);
  const ordered = [preferred, ...alternatives.slice(offset), ...alternatives.slice(0, offset)].slice(0, 3);
  const signals = briefSignals(context);
  const haystack = `${context.brief} ${context.activityDomain?.name || ''} ${context.siteType?.name || ''}`.toLowerCase();
  const candidates = ordered.map((archetype): CreativeDirection => {
    const en = context.locale === 'en';
    const moduleFit = archetype.id === 'product-stage' && context.modules.some((module) => module.id === 'catalog');
    return {
      schemaVersion: '1.0.0', engine: 'local-rules-v1', conceptId: archetype.id, name: localized(context.locale, archetype.name.fr, archetype.name.en),
      intent: truncate(projectBrief.objective, 500),
      audience: projectBrief.audience[0]!, emotion: signals.emotional, personality: [...(en ? archetype.personality.en : archetype.personality.fr)],
      concept: localized(context.locale, archetype.concept.fr, archetype.concept.en),
      rationale: truncate(localized(context.locale, `Le style « ${context.designStyle.name} » fournit l’ancrage visuel ; le brief détermine le rythme et la priorité de conversion.`, `The “${context.designStyle.name}” style anchors the visuals; the brief guides rhythm and conversion priority.`), 700),
      palette: paletteFor(archetype.palette, baseTheme, context.locale),
      typography: { headingFont: archetype.headingFont, bodyFont: SYSTEM_FONT, scale: archetype.scale, rationale: archetype.scale === 'monumental' ? localized(context.locale, 'Un grand contraste typographique porte le manifeste ; le texte courant reste sobre.', 'Strong typographic contrast carries the manifesto while body copy stays quiet.') : localized(context.locale, 'La hiérarchie distingue titres et lecture courante sans multiplier les familles.', 'The hierarchy separates headings and reading without multiplying font families.') },
      composition: { heroLayout: archetype.heroLayout, featuresLayout: archetype.featuresLayout, galleryLayout: archetype.galleryLayout, rhythm: archetype.rhythm, rationale: localized(context.locale, archetype.concept.fr, archetype.concept.en) },
      imagery: { treatment: archetype.treatment, guidance: localized(context.locale, 'Utiliser des médias réels et décrits par un texte alternatif ; le traitement reste secondaire.', 'Use real media with alternative text; treatment remains secondary.') },
      motion: { preset: archetype.motion, intensity: archetype.intensity, enabled: projectBrief.motionPreference !== 'disabled', rationale: projectBrief.motionPreference === 'disabled' ? localized(context.locale, 'Le brief interdit les animations automatiques : aucune entrée n’est ajoutée.', 'The brief forbids automatic animation: no entrance is added.') : localized(context.locale, 'Une entrée sur le hero et au plus deux sections : la navigation, les formulaires et la lecture restent stables.', 'One hero entrance and at most two section entrances: navigation, forms and reading stay stable.') },
      conversion: conversionFor(context),
      constraints: [
        localized(context.locale, 'Compositions responsives sans chevauchement de texte.', 'Responsive compositions without text overlap.'),
        localized(context.locale, 'Respect de prefers-reduced-motion et contenu visible sans JavaScript.', 'Respect prefers-reduced-motion and keep content visible without JavaScript.'),
        localized(context.locale, 'Aucun HTML arbitraire : chaque décision reste éditable dans le document.', 'No arbitrary HTML: every decision remains editable in the document.'),
        ...(moduleFit ? [localized(context.locale, 'La commande reste manuelle, sans paiement simulé.', 'Ordering remains manual, with no simulated payment.')] : []),
        ...projectBrief.constraints.slice(0, 2),
      ],
    };
  });
  const evaluations: CreativeEvaluation[] = candidates.map((candidate) => {
    const archetype = ARCHETYPES.find((item) => item.id === candidate.conceptId)!;
    const matches = archetype.keywords.filter((keyword) => haystack.includes(keyword)).length;
    let score = 58 + Math.min(12, matches * 4) + (candidate.conceptId === preferredId ? 22 : 0) + (signals.brief.length >= 40 ? 4 : 0);
    const reasons = [candidate.conceptId === preferredId ? localized(context.locale, 'Fidélité au style sélectionné', 'Aligned with the selected style') : localized(context.locale, 'Alternative de composition distincte', 'Distinct composition alternative')];
    if (matches) reasons.push(localized(context.locale, `${matches} signal(aux) du brief`, `${matches} brief signal(s)`));
    if (candidate.conceptId === 'product-stage' && context.modules.some((module) => module.id === 'catalog')) { score += 10; reasons.push(localized(context.locale, 'Adapté au catalogue', 'Suited to the catalog')); }
    if (candidate.conceptId === 'editorial-ritual' && context.modules.some((module) => module.id === 'blog')) { score += 6; reasons.push(localized(context.locale, 'Adapté à la lecture', 'Suited to reading')); }
    return { conceptId: candidate.conceptId, score: Math.min(100, score), reasons };
  });
  const selectedId = [...evaluations].sort((left, right) => right.score - left.score || ordered.findIndex((item) => item.id === left.conceptId) - ordered.findIndex((item) => item.id === right.conceptId))[0]!.conceptId;
  return creativeDirectionResultSchema.parse({ candidates, selectedId, evaluations, diversity: measureCreativeDiversity(candidates) });
}

export function directionFromResult(result: CreativeDirectionResult, conceptId = result.selectedId): CreativeDirection {
  const parsed = creativeDirectionResultSchema.parse(result);
  const direction = parsed.candidates.find((candidate) => candidate.conceptId === conceptId);
  if (!direction) throw new Error('CONCEPT_NOT_FOUND');
  return direction;
}

export function applyCreativeDirectionToTheme(themeInput: ThemeSettings, direction: CreativeDirection): ThemeSettings {
  const theme = normalizeThemeSettings(themeInput);
  const design = structuredClone(getDesignSystem(theme));
  const palette = direction.palette;
  const active = {
    ...design.tokens.colors, primary: palette.primary, secondary: palette.secondary, accent: palette.accent,
    background: palette.background, surface: palette.surface, text: palette.text, muted: palette.muted,
    heading: palette.text, link: palette.primary, focus: palette.primary,
    border: mix(palette.text, palette.background, 0.82),
  };
  if (palette.mode === 'dark') design.tokens.darkColors = active; else design.tokens.colors = active;
  design.name = direction.name;
  design.colorMode = palette.mode;
  design.tokens.typography.headingFont = direction.typography.headingFont;
  design.tokens.typography.bodyFont = direction.typography.bodyFont;
  design.tokens.typography.uiFont = direction.typography.bodyFont;
  design.tokens.typography.scale = direction.typography.scale === 'monumental' ? 1.45 : direction.typography.scale === 'editorial' ? 1.3 : 1.22;
  design.tokens.typography.headingLineHeight = direction.typography.scale === 'monumental' ? 0.96 : 1.08;
  design.tokens.spacing.section = direction.composition.rhythm === 'airy' ? 112 : direction.composition.rhythm === 'compact' ? 64 : 88;
  design.motion = { ...design.motion, entrance: 'none', duration: direction.motion.intensity === 'expressive' ? 520 : 360, reducedMotion: 'respect' };
  return withDesignSystem(theme, { ...design, ...(palette.mode === 'dark' ? { tokens: { ...design.tokens, colors: { ...design.tokens.colors, primary: theme.primaryColor, secondary: theme.secondaryColor, accent: theme.accentColor } } } : {}) });
}

function withCreativeNode(node: PageNode, direction: CreativeDirection, budget: { sections: number }, brief?: ProjectBrief): PageNode {
  const next: PageNode = { ...node, props: { ...node.props }, ...(node.children ? { children: node.children.map((child) => withCreativeNode(child, direction, budget, brief)) } : {}) };
  if (node.type === 'hero') {
    next.props.layout ??= direction.composition.heroLayout;
    next.props.visualTreatment ??= direction.imagery.treatment;
  }
  if (node.type === 'features') next.props.layout ??= direction.composition.featuresLayout;
  if (node.type === 'gallery') next.props.layout ??= direction.composition.galleryLayout;
  const eligible = node.type === 'hero' || (['features', 'gallery', 'stats', 'products', 'blog'].includes(node.type) && budget.sections < 2);
  if (eligible && !next.motion && direction.motion.enabled !== false && brief?.motionPreference !== 'disabled') {
    if (node.type !== 'hero') budget.sections += 1;
    const sequence = node.type === 'hero' ? 0 : budget.sections;
    next.motion = { preset: direction.motion.preset, trigger: 'in-view', duration: direction.motion.intensity === 'expressive' ? 620 : 460, delay: sequence * 90, distance: direction.motion.preset === 'rise' ? 24 : direction.motion.preset === 'reveal' ? 12 : 0 };
  }
  return next;
}

/** Fills semantic composition gaps and preserves local/responsive styles, existing props and manual motion. */
export function applyCreativeDirection(document: PageDocument, direction: CreativeDirection, brief?: ProjectBrief): PageDocument {
  return {
    ...document,
    theme: { ...applyCreativeDirectionToTheme(document.theme, direction), creativeDirection: structuredClone(direction) },
    root: withCreativeNode(document.root, direction, { sections: 0 }, brief),
  };
}
