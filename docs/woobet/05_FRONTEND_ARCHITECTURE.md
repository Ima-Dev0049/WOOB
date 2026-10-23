# 05 — Architecture frontend

## 1. Périmètre et applications

Deux frontends distincts partagent uniquement des primitives publiques explicitement choisies :

- **Studio** : authentification, dashboard, onboarding, gestion des projets, éditeur, médias, domaines, facturation et administration ;
- **Site renderer** : HTML/CSS/JS des visiteurs, aperçu publiable et interactions déclaratives.

Le partage du schéma et du renderer de base favorise la fidélité ; le partage aveugle de composants React du Studio est interdit. La CI vérifie le graphe d'imports et les bundles publics.

## 2. Stack recommandée et alternatives

| Besoin | Options | Recommandation conditionnelle | Raisons et réserves |
|---|---|---|---|
| Langage | TypeScript, JavaScript | TypeScript strict | Contrats partagés et refactoring ; ne remplace pas validation runtime |
| UI | React, Vue/Svelte/Solid | React | Recrutement, écosystème et Next.js ; aucune supériorité absolue supposée |
| Framework | Next.js, Remix/React Router framework, Vite SPA + SSR dédié | Next.js après spike | SSR, streaming, routes et bundling ; complexité de versions/cache à maîtriser |
| État serveur | TanStack Query, RTK Query, fetch wrappers | TanStack Query pour lectures mutables du Studio | Cache/invalidation ; ne pas y stocker le document d'édition |
| État document | Store commandé spécifique, Redux, Zustand | Store spécifique à frontière simple ; implémentation choisie au spike | Les commandes et sélection ont des invariants propres |
| Formulaires | Formulaires contrôlés + schéma, Formik, React Hook Form | À choisir par benchmark d'inspecteurs | Le schéma de propriété pilote les formulaires ; éviter deux sources de vérité |
| Accessibilité | Primitives maison, Radix, React Aria | Primitives accessibles éprouvées, choix par composant | Ne pas réinventer focus/clavier ; styles indépendants |
| Tests | Vitest/Jest, Testing Library, Playwright | Vitest + Testing Library + Playwright après compatibilité | Unité, composant et E2E ; versions datées dans l'audit |

Les numéros `latest` observés ne doivent pas être copiés automatiquement dans un manifeste. Une matrice React/Next/TypeScript/Nest/Drizzle est testée puis verrouillée par lockfile.

## 3. Découpage du Studio

```text
apps/studio/
  app/                       # routes et shells, pas de logique domaine
  features/
    dashboard/
    onboarding/
    project-settings/
    editor/
      canvas/
      inspector/
      layers/
      library/
      history/
      responsive/
    media/
    domains/
    billing/
  shared/
    api-client/
    ui/
    accessibility/
    telemetry/
packages/
  page-schema/
  renderer-core/
  components-public/
  components-editor/
  design-tokens/
```

Les routes utilisent des boundaries de chargement/erreur. Les fonctionnalités avancées et le code d'édition volumineux sont chargés à la demande. Les modules facturation/domaines n'entrent pas dans le chunk initial du canvas.

## 4. Canaux de données

| Donnée | Source de vérité | État client | Invalidation |
|---|---|---|---|
| Session et permissions | API/DB | Query courte durée + réponse serveur | Connexion, changement de rôle, 401/403 |
| Liste de projets | API/DB | Cache serveur paginé | Mutation et événements ciblés |
| Document de la page ouverte | `pages.draft_revision` via API | Store d'édition commandé | Commande locale puis accusé ou conflit |
| Checkpoints/publications | API/DB/objet | Query | Événement de version/publication |
| Assets | API/DB/objet | Query + état d'upload | Upload, variante prête, suppression |
| État de domaine | API/DB + tâches | Query avec polling adaptatif ou événement | Transition d'état |
| Préférences UI locales | Stockage local non sensible | Store local | Explicite ; pas de contenu sensible par défaut |

Le cache TanStack Query n'est jamais considéré comme preuve d'enregistrement du document. Le store d'édition conserve `baseRevision`, commandes non accusées et état de synchronisation.

## 5. Modèle d'état de l'éditeur

```text
EditorState
  document: PageDocument
  schemaVersion: string
  baseRevision: integer
  selection: SelectionPath[]
  hover: NodeId | null
  breakpoint: BreakpointId
  mode: simple | advanced
  viewport: ViewportConfig
  history: PastCommand[] / FutureCommand[]
  pending: EnqueuedCommand[]
  saveState: localDirty | saving | saved | offline | conflict | error
  capabilities: CapabilitySet
  validation: ValidationIssue[]
```

Les nœuds sont adressés par IDs stables, jamais par seuls index de tableau. Une commande calcule le nouveau document et les problèmes de validation de manière synchrone pour les interactions courantes ; les validations coûteuses sont différées sans bloquer la saisie.

## 6. Boucle de rendu du canvas

Deux options doivent être prototypées :

1. **Canvas dans la même origine, composants contrôlés et styles isolés.** Plus simple et potentiellement fidèle, mais risque de collision CSS et de gestion des événements.
2. **Canvas dans iframe avec origine d'aperçu séparée et protocole `postMessage` typé.** Meilleure isolation, mais complexité accrue pour sélection, glisser-déposer, focus et mesures.

**Recommandation provisoire :** iframe pour l'aperçu de page et le contenu potentiellement non fiable, avec le même `renderer-core` que la publication ; un pont d'édition ajoute overlays et métadonnées sans modifier le document. L'origine d'aperçu n'a pas les cookies Studio. Le spike doit prouver la précision du drag, le clavier et les performances. Un canvas same-origin reste possible uniquement pour un sous-ensemble strictement assaini.

Le `postMessage` impose : origine exacte, schéma de message, `source` vérifiée, identifiant de session d'aperçu, aucune capacité d'appel API arbitraire, limitation de fréquence et révocation à la fermeture.

## 7. Inspecteur et schémas de propriétés

Le registre expose une description d'inspecteur distincte du schéma de données : widget, libellé traduit, groupe, condition de visibilité, unité, min/max, aide, niveau simple/avancé. La validation reste dans `propsSchema`.

- une propriété absente signifie héritage lorsque le contrat le prévoit ;
- « réinitialiser » supprime l'override plutôt que copier la valeur actuelle ;
- les unités CSS sont limitées par propriété ;
- les références de médias, pages, collections et tokens utilisent des IDs résolus ;
- les changements continus (slider/color) sont regroupés en une commande d'historique au commit, tout en offrant un aperçu temporaire fluide.

## 8. Design system du Studio

Le Studio possède ses propres tokens et composants, indépendants des thèmes créés par les utilisateurs. Couches : primitives accessibles, composants génériques, patterns produit, features. Le thème d'un site ne doit jamais modifier les boutons de l'éditeur.

Le mode sombre du Studio est une préférence d'interface ; le mode sombre d'un site est un thème de document. Les deux sont testés séparément. Les libellés sont traduits par clés et les formats régionaux via une couche i18n.

## 9. Renderer public

Le renderer résout récursivement les nœuds vers des composants enregistrés. Il ne consulte pas de code fourni par un document. Les props passent par une projection qui retire les champs internes et valide les capacités.

- contenu texte échappé par défaut ; HTML riche limité à une liste de balises/attributs et assaini ;
- liens normalisés avec schémas autorisés ; `rel` approprié ;
- CSS généré à partir de valeurs typées ; pas d'interpolation brute dans `<style>` ;
- médias servis avec dimensions, `srcset`/variantes et lazy loading sauf LCP ;
- erreur de composant isolée par boundary ; en production, fallback sobre et identifiant de diagnostic ;
- données dynamiques échouées : fallback défini par le composant et en-têtes de cache non contaminés par une erreur temporaire.

Le même arbre de projection alimente aperçu, tests de conformité et publication. Les overlays d'édition ne font pas partie du HTML public.

## 10. Responsive et mesures

Le canvas peut simuler une largeur mais ne doit pas prétendre reproduire parfaitement tous les navigateurs. Les règles de container sont testées dans de vrais navigateurs. L'utilisateur peut inspecter styles hérités, overrides et adaptations automatiques. Les changements de viewport ne changent pas le document sauf commande explicite.

## 11. Gestion des erreurs et reprise

- erreurs de route : page d'erreur avec action et ID de corrélation ;
- 401 : réauthentification sans perdre le brouillon local non sensible ;
- 403 : message de permission, aucune boucle de retry ;
- 409 : conflit de révision avec comparaison et choix ;
- 422 : problèmes de validation reliés aux nœuds ;
- 429 : backoff et information de quota ;
- offline : file bornée de commandes, état visible, aucune promesse de synchronisation automatique sans résolution ;
- crash du canvas : boundary, sauvegarde locale de secours chiffrée si possible et rechargement contrôlé.

Les rapports d'erreur frontend excluent contenus de page, tokens et données personnelles par défaut. Les source maps sont privées.

## 12. Performance frontend

Techniques attendues : virtualisation de l'arborescence et des grandes listes ; mémorisation par ID/version ; sélection en dehors de l'arbre de document ; validation incrémentale ; workers Web pour diff/validation lourde après mesure ; chargement différé des inspecteurs ; image de canvas dimensionnée ; évitement des mutations profondes et clones complets par frappe.

Toute optimisation structurelle partagée (par exemple Immer) est choisie après benchmark ; les copies structurelles ne sont pas supposées gratuites. Les budgets sont ceux du document 03.

## 13. Sécurité frontend

Cookies Studio `HttpOnly`, `Secure`, `SameSite` adapté ; protection CSRF pour requêtes mutables ; CSP avec nonces/hashes et sans `unsafe-eval` ; URLs de callback en allowlist ; aucun jeton dans le stockage local ; pas de secrets dans les variables `NEXT_PUBLIC_*` ; sanitation des contenus ; isolation de l'aperçu ; contrôle des origines ; dépendances verrouillées.

La vérification des permissions dans l'UI améliore l'expérience mais ne constitue jamais un contrôle de sécurité.

## 14. Tests frontend

- schéma → inspecteur : rendu de tous les types et états ;
- commandes : unités, propriétés, invariants, undo/redo ;
- composants : clavier, focus, contrastes, contenus vides/longs/invalides ;
- canvas : sélection et drag à plusieurs niveaux et breakpoints ;
- fidélité : snapshots HTML/CSS et captures multi-navigateurs entre aperçu et publication ;
- longévité : scénario de quatre heures, fuites et listeners ;
- E2E : création, édition, sauvegarde, conflit, reprise, publication et rollback.

## 15. Conditions de sortie du spike frontend

Un prototype jetable doit démontrer sur D1 et D2 : sélection dans iframe, drag vertical/horizontal et clavier, édition de texte, override responsive, undo/redo, autosave avec conflit, absence de collision CSS, et fidélité avec le renderer public. Les résultats et profils sont ajoutés à l'ADR avant choix définitif du framework de drag et de la topologie du canvas.
