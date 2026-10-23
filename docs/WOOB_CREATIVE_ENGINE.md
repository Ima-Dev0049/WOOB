# Woob Creative Engine — architecture et guide

Date : 2026-10-23. Branche : `arena/639e32e6-woob`.

Ce document décrit **le premier incrément fonctionnel** du Creative Engine. Il ne présente pas les phases P2 à P4 de l’[audit](./WOOB_CREATIVE_ENGINE_AUDIT.md) comme terminées.

## 1. Capacités livrées

- Un plan `CreativeDirection` structuré et versionné avant la construction des pages : intention, public, émotion, personnalité, concept, palette et typographie justifiées, composition, médias, motion, conversion et contraintes.
- Trois concepts évalués par génération, un score de diversité et un choix explicite dans l’aperçu.
- Cinq familles de hero, trois compositions de fonctionnalités, trois compositions de galerie et six traitements de visuel, tous représentés par des props validées.
- Un thème et des documents existants enrichis sans migration destructive, sans HTML arbitraire et sans remplacer les choix fonctionnels du catalogue.
- Des entrées natives au viewport, bornées au hero et à deux sections par page lors de la génération, modifiables dans l’éditeur et compatibles avec undo/redo, copier/coller, reset, sauvegarde et publication.
- Un rapport de qualité **structurel**, clairement séparé d’une inspection visuelle.
- Un aperçu non interactif qui utilise le renderer public sans les contours de sélection de l’éditeur ni de vrais formulaires actifs.

## 2. Chemin brief → concept → site

```text
CreateProjectDialog
  → POST project-preview (session + CSRF + quota + membership + rate limit)
  → contenu local ou OpenAI existant
  → createLocalCreativeDirections (règles locales, aucun appel distant)
  → CreativeDirectionResult { 3 candidats, évaluations, diversité, selectedId }
  → buildProjectDraft + applyCreativeDirection
  → documents validés + CreativeQualityReport
  → aperçu : withCreativeConcept pour comparer les trois directions
  → création : generationId + creativeConceptId
  → readProjectGeneration revérifie workspace, utilisateur, snapshot et concept
  → reconstruction serveur du même concept, usage unique du generationId
  → pages/projet/thème JSONB → éditeur → snapshots → site publié
```

Le fournisseur de textes et le moteur de direction sont deux décisions distinctes. Dans ce lot, même si le fournisseur de textes OpenAI est configuré, les directions restent produites par `local-rules-v1`. Aucune direction distante n’est simulée ou déclarée.

## 3. Contrats

### `CreativeDirection`

Défini dans `src/lib/creative/types.ts`, validé dans `src/lib/creative/schema.ts` avec `schemaVersion: '1.0.0'`.

| Groupe | Contenu |
| --- | --- |
| Intention | brief repris comme intention, public extrait de signaux explicites, émotion, personnalité |
| Concept | nom, parti pris, justification et lien avec le style choisi |
| Palette | mode, sept couleurs et justification ; les couleurs de texte/lien sont corrigées si leur contraste est insuffisant |
| Typographie | deux familles maximum, échelle et justification |
| Composition | hero, fonctionnalités, galerie, rythme et justification |
| Médias | traitement et règle d’usage ; aucun média fictif n’est prétendu généré |
| Motion | preset, intensité, justification et contraintes de réduction |
| Conversion | objectif et action selon les modules réellement actifs |
| Limites | responsive, reduced motion, document éditable et notices fonctionnelles existantes |

`CreativeDirectionResult` ajoute trois évaluations, le concept sélectionné et `CreativeDiversityReport`. Les identifiants de concepts et leurs évaluations doivent être uniques et cohérents. Les polices, couleurs, tailles, durées et textes sont bornés.

### Document et motion

`ThemeSettings.creativeDirection` conserve l’intention originale. Les tokens du design system restent la source visuelle active : modifier un token dans l’éditeur ne réécrit pas rétroactivement l’histoire du concept.

`PageNode.motion` est facultatif :

```ts
{ preset: 'fade' | 'rise' | 'reveal' | 'scale',
  trigger: 'in-view', duration: 100…1600, delay: 0…1200, distance: 0…96 }
```

Les anciens documents sans direction, layout ou motion restent valides. Les nouvelles props sont optionnelles et le renderer possède des valeurs de repli.

## 4. Moteur local et diversité

`src/lib/creative/engine.ts` contient cinq archétypes : conversation claire, rituel éditorial, atlas immersif, signal monumental et scène produit. Le style choisi ancre le premier concept ; un ordre déterministe dérivé du nom et du brief varie les alternatives. Les modules et les mots explicites du brief contribuent à la pertinence.

La diversité n’est pas une impression subjective :

- 65 % : signatures de composition uniques (hero + collections + rythme) ;
- 20 % : palettes effectives uniques ;
- 15 % : signatures de motion uniques.

Le score de pertinence et le score de diversité répondent à des questions différentes. Aucun des deux ne mesure la beauté ou la conversion réelle.

Le moteur est volontairement transparent : il ne prétend pas inférer un public absent du brief ni comprendre une marque comme le ferait une équipe de direction artistique.

## 5. Application au design system et aux documents

`applyCreativeDirectionToTheme` enrichit le design system existant : palette active, typographie, espacement de sections et durée. Les presets partagés, breakpoints et réglages de composants sont conservés.

`applyCreativeDirection` :

- ajoute la direction au thème de chaque page ;
- remplit seulement les layouts absents ;
- ajoute seulement le motion absent ;
- ne réécrit ni les textes, ni les styles locaux, ni les exceptions tablette/mobile, ni le motion manuel ;
- limite la génération à un hero et deux sections animées par page.

Ainsi, une décision globale ne détruit pas une exception locale et une modification mobile n’écrase pas l’ordinateur.

## 6. Renderer et compositions

Les props sont déclarées dans `src/lib/document/registry.ts` et rendues par `DocumentRenderer.tsx`.

| Composant | Variantes |
| --- | --- |
| Hero | `split`, `editorial`, `immersive`, `monumental`, `product-stage` |
| Fonctionnalités | `cards`, `editorial`, `minimal` |
| Galerie | `grid`, `editorial`, `filmstrip` |
| Traitement visuel | `plain`, `organic`, `framed`, `orbital`, `duotone`, `product` |

Les variantes utilisent des classes contrôlées et les tokens existants. Aucun HTML ou CSS libre n’est introduit. Les règles tablette/mobile réduisent les compositions asymétriques et préservent une galerie horizontale lorsqu’elle est intentionnelle. La navigation mobile reste disponible sous forme de liens enveloppés.

L’aperçu du wizard emploie `mode: 'preview'` avec `interactive: false` : liens et formulaires n’exécutent pas d’action, mais les classes et styles sont ceux du site publié.

## 7. Motion natif

`CreativeMotion.tsx` utilise `IntersectionObserver`, sans nouvelle dépendance.

1. Le HTML serveur est visible par défaut : sans JavaScript, aucun contenu n’est masqué.
2. Après hydratation, les nœuds ayant un motion sont observés et reçoivent un état `pending`.
3. À l’entrée dans le viewport, l’état devient `visible`, une animation CSS joue une fois et l’observation du nœud cesse.
4. `prefers-reduced-motion`, le réglage de réduction du thème ou l’absence d’`IntersectionObserver` révèle immédiatement le contenu.
5. Les propriétés individuelles `translate` et `scale` composent avec un `transform` local au lieu de l’écraser.

Les formulaires, la navigation, le footer et la lecture courante ne reçoivent pas d’animation automatique. Le motion est une entrée, pas une animation permanente ou une scène WebGL.

### Commandes dans l’éditeur

- Hero : **Composition créative** et **Traitement du visuel**.
- Fonctionnalités/galerie : **Composition**.
- Tout bloc : **Entrée au viewport**, puis style d’entrée ; les modes avancé/expert exposent durée, délai et distance utile.
- **Copier/Coller/Tout réinitialiser** inclut le motion dans le snapshot de style.
- Toutes ces modifications passent par `commit`, donc par l’historique undo/redo et la validation serveur.

Le changement de concept complet se fait pendant la création. Après création, ce lot offre les contrôles de composition et de motion, pas un nouveau sélecteur global de concept dans l’éditeur.

## 8. Qualité structurelle et inspection visuelle

`src/lib/creative/quality.ts` vérifie uniquement des signaux calculables :

- contrastes texte/fond, texte secondaire, surface, liens, bouton principal et CTA ;
- descriptions SEO non vides ;
- cohérence des breakpoints ;
- budget de nœuds animés ;
- diversité des concepts et signatures répétées.

`visualInspection` est toujours `false` dans ce rapport. Le score ne constitue ni un audit WCAG complet, ni une mesure esthétique, ni une preuve de performance.

Une inspection visuelle manuelle a néanmoins été réalisée séparément sur six captures réelles (trois concepts × desktop/mobile). Elle a permis de corriger le texte des CTA masqué par la cascade des liens, les contours d’éditeur dans l’aperçu et la navigation mobile masquée. Axe a ensuite détecté et permis de corriger un contraste d’`eyebrow` dans le CTA. Ces corrections sont couvertes par les parcours Playwright ; les captures temporaires ne sont pas versionnées.

## 9. Persistance et sécurité

- Le résultat `ai_generations.output` contient `content`, `snapshot` et `creative` validés.
- Le client envoie seulement `creativeConceptId` à la création, pas une direction arbitraire à faire confiance.
- Le serveur retrouve les candidats journalisés, vérifie le concept et reconstruit les documents.
- Une erreur de concept ne consomme pas la génération ; une création réussie conserve le mécanisme transactionnel d’usage unique.
- Le thème du projet et chaque page conservent la direction, puis les snapshots de publication la transportent sans chemin de rendu parallèle.
- Aucun schéma de base n’a été supprimé ou réinitialisé et aucune migration n’est nécessaire pour ces champs JSONB.
- Les contrôles existants de workspace, RBAC, session, CSRF, quota, rate-limit, CSS et URL restent en place.

## 10. Vérification reproductible

```bash
npm ci
npm run verify
npx vitest run tests/creative-engine.test.ts tests/catalog.test.ts
npx playwright test tests/e2e/creative-engine.spec.ts
npm run test:e2e
```

Pour réutiliser un serveur de **test de production** au lieu du serveur Playwright, ses variables doivent correspondre à l’environnement de test. Exemple local uniquement, sur la base existante :

```bash
TRUST_PROXY=true \
PLATFORM_ADMIN_EMAILS=platform-admin-e2e@example.com \
WOOB_DATA_DIR=.woob-data \
npm run start -- --hostname 0.0.0.0 --port 3000
```

Ne pas utiliser cette allowlist comme configuration de production réelle, ne pas désactiver le rate-limit et ne pas réinitialiser la base pour obtenir une suite verte.

Résultats du 2026-10-23 sur ce lot :

- TypeScript strict : réussi ;
- ESLint : réussi ;
- Vitest : **56/56 tests dans 11 fichiers** ;
- build Next.js de production : réussi, avec les deux avertissements de traçage filesystem déjà connus dans `storage.ts` ;
- Playwright contre le build de production : **23/23 parcours** ;
- six briefs/styles comparés dans les tests de répétition et six captures réelles examinées sur trois concepts et deux viewports ;
- scans axe ciblés et existants sans violation dans les portées testées, sans certification WCAG globale.

`npm ci` a également signalé 9 vulnérabilités de dépendances (4 modérées, 5 élevées). Elles n’ont pas été corrigées par un `audit fix --force` destructif et restent un sujet de maintenance distinct.

## 11. Limites et extension

### Limites actuelles

- Cinq archétypes et trois candidats par génération ; pas encore un système ouvert illimité.
- Heuristiques locales, pas de direction artistique distante ni de compréhension sémantique garantie.
- Le visuel abstrait de secours reste partagé : de vrais assets sont nécessaires pour des identités riches. Aucun pipeline d’images génératives n’est branché.
- Pas de pipeline automatique de screenshots, diff visuel, Lighthouse/INP/LCP, scènes au scroll, WebGL ou transitions de pages.
- Pas de nouvelle commande conversationnelle spécialisée en direction artistique ; l’IA structurée d’édition existante est conservée.
- Les contrastes calculés et scans axe ne remplacent pas une revue clavier, lecteur d’écran, contenu et design réels.

### Ajouter une composition

1. Ajouter la valeur dans les unions de `creative/types.ts` et les schémas Zod correspondants.
2. Ajouter la prop optionnelle et le contrôle dans `document/registry.ts`.
3. Ajouter le rendu et les styles responsive dans `DocumentRenderer.tsx`, `globals.css` et, si nécessaire, les breakpoints de `themeGlobalCss`.
4. Définir le comportement reduced motion et le repli des anciens documents.
5. Ajouter les tests de validation, diversité, persistance, publication et au moins une vérification navigateur réelle.

### Ajouter un fournisseur de directions distant

Réutiliser `creativeDirectionResultSchema`, exiger exactement les mêmes candidats bornés, journaliser le fournisseur et le modèle, ne jamais accepter de code exécutable et conserver une erreur explicite si la réponse est invalide. Le fournisseur distant de textes actuel ne constitue pas une implémentation de cette extension.

### Étendre la qualité

Un nouveau score doit préciser ses entrées et ses limites. Une inspection dite « visuelle » exige un rendu réellement capturé puis examiné ; une fonction qui lit seulement le document ne doit jamais activer `visualInspection`.
