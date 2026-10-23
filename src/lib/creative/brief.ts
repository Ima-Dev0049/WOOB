import type { FunctionalModuleId, ProjectGenerationContext } from '@/lib/catalog/types';
import { projectBriefSchema } from './schema';
import type { ProjectBrief } from './types';

function truncate(value: string, maximum: number): string {
  return value.length > maximum ? `${value.slice(0, maximum - 1).trim()}…` : value;
}
function localized(locale: 'fr' | 'en', fr: string, en: string): string { return locale === 'en' ? en : fr; }

const NO_MOTION = /(?:\b(?:sans|aucune?|pas)\s+(?:d['’]\s*)?(?:animations?|mouvement))|(?:\b(?:no|without)\s+(?:animations?|motion))/i;
const REQUIRED_MOTION = /(?:\bavec\s+(?:des\s+)?animations?\b|\banimations?\s+(?:obligatoires?|essentielles?|requises?))|(?:\bwith\s+animations?\b|\banimations?\s+(?:required|essential))/i;

function defaultObjective(context: ProjectGenerationContext): string {
  if (context.modules.some((module) => module.id === 'reservations')) return localized(context.locale, `Présenter ${context.projectName} et faciliter les demandes de réservation.`, `Present ${context.projectName} and make reservation requests easy.`);
  if (context.modules.some((module) => module.id === 'catalog')) return localized(context.locale, `Présenter ${context.projectName}, ses produits et une commande manuelle claire.`, `Present ${context.projectName}, its products and a clear manual ordering path.`);
  if (context.modules.some((module) => module.id === 'blog')) return localized(context.locale, `Présenter ${context.projectName} et donner accès à ses contenus éditoriaux.`, `Present ${context.projectName} and make its editorial content accessible.`);
  return localized(context.locale, `Présenter ${context.projectName}, expliquer son offre et rendre la prochaine action évidente.`, `Present ${context.projectName}, explain its offer and make the next action obvious.`);
}

function acceptanceFor(id: FunctionalModuleId, locale: 'fr' | 'en'): string {
  const criteria: Record<FunctionalModuleId, { fr: string; en: string }> = {
    forms: { fr: 'Le formulaire valide les champs et produit un retour explicite de succès ou d’erreur.', en: 'The form validates fields and returns explicit success or error feedback.' },
    blog: { fr: 'Les articles publiés sont accessibles dans le rendu et conservés dans le snapshot.', en: 'Published posts are available in the renderer and retained in the snapshot.' },
    catalog: { fr: 'Les produits actifs sont affichés et la commande reste manuelle, sans paiement simulé.', en: 'Active products are displayed and ordering remains manual, with no simulated payment.' },
    reservations: { fr: 'La demande est enregistrée sans promettre une disponibilité en temps réel non vérifiée.', en: 'The request is recorded without claiming unverified real-time availability.' },
  };
  return localized(locale, criteria[id].fr, criteria[id].en);
}

/**
 * Transparent extraction from explicit fields and a small set of lexical rules.
 * It does not claim semantic understanding, document analysis or remote AI.
 */
export function createLocalProjectBrief(context: ProjectGenerationContext): ProjectBrief {
  const sourceText = context.brief.replace(/\s+/g, ' ').trim();
  const firstSentence = sourceText.match(/[^.!?]+[.!?]?/)?.[0].trim() || '';
  const audienceMatch = /(?:pour|destin[ée]\s+[àa]|for)\s+([^.;]{2,100})/i.exec(sourceText);
  const audience = truncate(audienceMatch?.[1]?.trim() || (context.activityDomain
    ? localized(context.locale, `Les publics intéressés par ${context.activityDomain.name.toLowerCase()}.`, `People interested in ${context.activityDomain.name.toLowerCase()}.`)
    : localized(context.locale, 'Les visiteurs qui veulent comprendre l’offre avant d’agir.', 'Visitors who want to understand the offer before acting.')), 300);
  const toneRules = [
    { pattern: /chaleur|chaleureu|accueil|warm|welcoming/i, fr: 'Chaleureux', en: 'Warm' },
    { pattern: /luxe|premium|raffin|luxury/i, fr: 'Raffiné', en: 'Refined' },
    { pattern: /audacieux|énergie|bold|energy/i, fr: 'Audacieux', en: 'Bold' },
    { pattern: /minimal|sobre|épuré|minimal/i, fr: 'Épuré', en: 'Minimal' },
    { pattern: /clair|pédagogique|accessible|clear|accessible/i, fr: 'Clair et accessible', en: 'Clear and accessible' },
  ];
  const explicitTones = toneRules.filter((rule) => rule.pattern.test(sourceText)).map((rule) => localized(context.locale, rule.fr, rule.en));
  const tone = explicitTones.length ? explicitTones : [context.designStyle.name];
  const noMotion = NO_MOTION.test(sourceText);
  const contradictoryMotion = noMotion && REQUIRED_MOTION.test(sourceText);
  const assumptions: ProjectBrief['assumptions'] = [];
  if (sourceText) assumptions.push({ id: 'value-proposition', description: localized(context.locale, 'La première phrase du brief sert de proposition de valeur de départ.', 'The first sentence of the brief is used as the starting value proposition.'), basis: localized(context.locale, 'Extraction locale, sans interprétation distante.', 'Local extraction, without remote interpretation.') });
  else assumptions.push({ id: 'value-proposition', description: localized(context.locale, 'L’objectif est déduit du nom, du catalogue et des modules choisis.', 'The objective is inferred from the name, catalog and selected modules.'), basis: localized(context.locale, 'Aucun brief libre fourni.', 'No free-form brief supplied.') });
  if (!audienceMatch) assumptions.push({ id: 'audience', description: localized(context.locale, 'L’audience est une hypothèse à confirmer, pas un fait extrait.', 'The audience is a hypothesis to confirm, not an extracted fact.'), basis: context.activityDomain?.name || context.designStyle.name });
  if (!explicitTones.length) assumptions.push({ id: 'tone', description: localized(context.locale, 'Le ton est provisoirement aligné sur le style visuel choisi.', 'The tone is temporarily aligned with the selected visual style.'), basis: context.designStyle.name });
  const missingInformation: ProjectBrief['missingInformation'] = [];
  if (!sourceText) missingInformation.push({ id: 'value-proposition', description: localized(context.locale, 'Une proposition de valeur rédigée par l’utilisateur.', 'A user-written value proposition.'), blocking: false });
  if (!audienceMatch) missingInformation.push({ id: 'audience', description: localized(context.locale, 'La validation de l’audience prioritaire.', 'Validation of the primary audience.'), blocking: false });
  if (!/\b\d+(?:[.,]\d+)?\s*(?:%|visiteurs?|leads?|ventes?|réservations?|clients?|sales?|bookings?)\b/i.test(sourceText)) missingInformation.push({ id: 'success-metric', description: localized(context.locale, 'Un indicateur commercial ou de conversion mesurable.', 'A measurable business or conversion indicator.'), blocking: false });
  const constraints = context.limitations.slice(0, 8).map((limitation) => truncate(limitation, 300));
  if (noMotion) constraints.push(localized(context.locale, 'Aucune animation automatique : contrainte explicite du brief.', 'No automatic animation: explicit brief constraint.'));
  const contradictions: ProjectBrief['contradictions'] = contradictoryMotion ? [{
    id: 'motion-conflict',
    description: localized(context.locale, 'Le brief demande à la fois des animations et l’absence d’animation.', 'The brief asks for both animations and no animation.'),
    resolution: localized(context.locale, 'La contrainte la plus restrictive est appliquée : aucune entrée automatique. Un arbitrage utilisateur reste nécessaire.', 'The most restrictive constraint is applied: no automatic entrance. User arbitration is still required.'),
    status: 'needs-input',
  }] : [];
  return projectBriefSchema.parse({
    schemaVersion: '1.0.0', engine: 'local-brief-rules-v1', sourceText,
    objective: truncate(firstSentence || defaultObjective(context), 500), industry: context.activityDomain?.name || null,
    audience: [audience], valueProposition: firstSentence ? truncate(firstSentence, 700) : null, tone,
    requiredPages: context.pages.map((page) => ({
      slug: page.path,
      purpose: page.path === '/' ? localized(context.locale, `Présenter ${context.projectName} et orienter vers les parcours prioritaires.`, `Present ${context.projectName} and lead to the priority journeys.`) : localized(context.locale, `Donner accès au parcours « ${page.name} ».`, `Provide access to the “${page.name}” journey.`),
      requiredSections: [...page.components],
    })),
    requiredFeatures: context.modules.map((module) => ({ id: module.id, description: module.description, priority: 'required', acceptanceCriteria: [acceptanceFor(module.id, context.locale)] })),
    constraints,
    preferences: [localized(context.locale, `Style visuel choisi : ${context.designStyle.name}.`, `Selected visual style: ${context.designStyle.name}.`), localized(context.locale, `Langue du contenu : ${context.locale === 'fr' ? 'français' : 'anglais'}.`, `Content language: ${context.locale === 'fr' ? 'French' : 'English'}.`)],
    references: [], assumptions, missingInformation, contradictions,
    successCriteria: [
      localized(context.locale, 'Toutes les pages et sections requises sont présentes dans les documents validés.', 'Every required page and section is present in the validated documents.'),
      localized(context.locale, 'Les fonctionnalités sélectionnées conservent un comportement réel et vérifiable.', 'Selected features retain real, verifiable behaviour.'),
      noMotion ? localized(context.locale, 'Aucune entrée automatique n’est générée.', 'No automatic entrance is generated.') : localized(context.locale, 'Le mouvement réduit est respecté et le contenu reste visible sans JavaScript.', 'Reduced motion is respected and content remains visible without JavaScript.'),
    ],
    motionPreference: noMotion ? 'disabled' : 'standard',
  });
}
