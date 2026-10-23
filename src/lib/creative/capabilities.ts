import { z } from 'zod';

const capabilityContractSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.literal('1.0.0'),
  status: z.literal('implemented'),
  intent: z.string().min(1),
  inputs: z.array(z.string().min(1)).min(1),
  outputs: z.array(z.string().min(1)).min(1),
  parameters: z.array(z.string().min(1)).min(1),
  dependencies: z.array(z.string().min(1)),
  estimatedCost: z.object({ tier: z.enum(['low', 'medium', 'high']), basis: z.string().min(1) }).strict(),
  budgets: z.array(z.string().min(1)).min(1),
  responsive: z.string().min(1),
  accessibility: z.array(z.string().min(1)).min(1),
  tests: z.array(z.string().min(1)).min(1),
  fallback: z.string().min(1),
  orchestration: z.literal('synchronous-local'),
}).strict();

export type CreativeCapabilityContract = z.infer<typeof capabilityContractSchema>;

/** Descriptors must name behavior that is wired to the real renderer and editor. */
export const creativeCapabilities = z.array(capabilityContractSchema).parse([
  {
    id: 'scene3d',
    version: '1.0.0',
    status: 'implemented',
    intent: 'Ajouter une sculpture procédurale uniquement lorsqu’elle sert une intention explicite.',
    inputs: ['PageDocument 1.0.0', 'Scene3DCapabilityOperation validé', 'Préférence reduced-motion du navigateur'],
    outputs: ['PageDocument validé', 'Canvas WebGL ou fallback statique', 'États observables de chargement, pause et suspension'],
    parameters: ['preset: orbital | prism', 'quality: low | balanced', 'autoRotate', 'interactive', 'fallback image et alternative'],
    dependencies: ['three 0.186.1 chargé dynamiquement', 'registre de composants Woob', 'IntersectionObserver et ResizeObserver'],
    estimatedCost: { tier: 'medium', basis: 'Coût qualitatif : un contexte WebGL, géométries procédurales et aucun téléchargement de modèle. Aucune mesure GPU ou monétaire n’est revendiquée.' },
    budgets: ['Une scène par page', '32 ou 64 particules', 'DPR plafonné à 1 ou 1,5', 'Aucune boucle hors viewport, onglet masqué ou pause'],
    responsive: 'Composition texte/scène en deux colonnes puis une colonne sur mobile ; canvas borné par son conteneur.',
    accessibility: ['Alternative texte visible', 'Canvas décoratif exclu de l’arbre accessible', 'Contrôles clavier natifs', 'Fallback sans WebGL sous reduced-motion'],
    tests: ['tests/scene3d.test.ts', 'tests/business-ai.test.ts', 'tests/e2e/scene3d.spec.ts'],
    fallback: 'Image validée ou illustration SVG statique ; le contenu et les contrôles essentiels ne dépendent pas de WebGL.',
    orchestration: 'synchronous-local',
  },
]);

export function getCreativeCapability(id: string): CreativeCapabilityContract | undefined {
  return creativeCapabilities.find((capability) => capability.id === id);
}
