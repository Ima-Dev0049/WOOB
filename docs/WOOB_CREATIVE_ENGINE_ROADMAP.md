# Woob Creative Engine — traçabilité et feuille de route

Date : 2026-10-23. Référentiel : cahier des charges **WOOB Creative Engine 1.0**. Branche : `arena/639e32e6-woob`.

Ce document complète l’[audit initial](./WOOB_CREATIVE_ENGINE_AUDIT.md) et le [guide des lots livrés](./WOOB_CREATIVE_ENGINE.md). **Livré** signifie qu’un comportement est relié au parcours réel et couvert par des preuves. **Partiel** signifie que des fondations existent mais que tous les critères du cahier des charges ne sont pas satisfaits. **Absent** ne doit jamais être lu comme une capacité simulée.

## 1. Cartographie des sous-moteurs

| Moteur | État vérifiable | Implémentation et preuves actuelles | Reste à faire / critère de sortie |
| --- | --- | --- | --- |
| `brief-engine` | **Partiel, incrément livré** | `creative/brief.ts`, schéma Zod, exigences, hypothèses, informations non bloquantes, contradiction motion, affichage wizard/projet, migration `0006`, snapshots ; `tests/brief-engine.test.ts`. | Édition structurée après création, références image/URL/document réellement ingérées, contradictions plus riches et confiance calibrée. Ne pas prétendre à une compréhension sémantique générale. |
| `concept-engine` | **Partiel, incrément livré** | `creative/engine.ts` : trois candidats locaux, compositions distinctes, pertinence, diversité et choix persisté ; tests créatifs et E2E. | Nombre configurable, nouvelle exploration à la demande, corpus plus large et évaluations humaines périodiques. |
| `art-direction-engine` | **Partiel** | Direction justifiée, palette corrigée pour le contraste, typographie et tokens existants appliqués aux documents. | Formes/textures/iconographie plus riches, variantes de design system et apprentissage seulement avec consentement. |
| `composition-engine` | **Partiel** | Cinq heroes, trois fonctionnalités, trois galeries et six traitements visuels dans le registre/renderer. | Composition ouverte à partir de règles et composants autorisés, proportions et profondeur plus variées, sans positions absolues systématiques. |
| `ux-engine` | **Partiel, fondations existantes** | Blueprints, pages/modules réels, routes, formulaires, navigation et limitations ; pages requises désormais traçables dans le brief. | Objectifs et parcours UX plus explicites, davantage d’états vides/erreur et tests dynamiques propres à chaque site. |
| `component-engine` | **Partiel, fondations existantes** | Registre strict, props validées, variantes éditables, document JSON sans HTML arbitraire ; descripteur complet de la capacité `scene3d` dans `creative/capabilities.ts`. | Étendre les contrats de dépendances/tests aux autres composants et générer de nouveaux composants uniquement dans un environnement isolé. |
| `motion-engine` | **Partiel, incrément livré** | Entrées `IntersectionObserver`, presets bornés, contrôle éditeur, reduced motion, contenu visible sans JS, contrainte « sans animation » effective. | Sorties, scroll, micro-interactions et transitions de pages au cas par cas, budgets de performance et annulation avancée. |
| `media-engine` | **Partiel, socle existant** | Uploads validés, assets privés/publics, réutilisation, alt, stockage local/S3 et images responsives limitées. | Recherche/génération, provenance/licences, recadrage, compression, vidéo et polices. Aucun média généré n’est déclaré. |
| `code-generation-engine` | **Absent pour du code libre** | WOOB produit des documents interprétés par un renderer contrôlé, ce qui évite aujourd’hui l’exécution de code non fiable. | Si du code libre est introduit : worker isolé, limites CPU/mémoire/réseau/secrets, compilation et tests avant tout succès. |
| `responsive-engine` | **Partiel** | Tokens, cascade desktop/tablette/mobile, exceptions locales, compositions adaptatives et parcours à 390 px. | Composition responsive générée plus riche, grands écrans, davantage de navigateurs/appareils et mesures de stabilité. |
| `visual-inspection-engine` | **Absent comme produit** | Inspections manuelles documentées et captures temporaires réellement examinées ; aucun drapeau automatique trompeur. | Captures persistées et privées, erreurs/overflow/images, diff contrôlé, preuves et inspection effective avant correction. |
| `functional-test-engine` | **Partiel, suite réelle** | 32 parcours Playwright couvrent création, édition, modules, sécurité, publication, responsive, motion et la capacité 3D. | Génération de parcours spécifiques au brief, exécution à la demande et rapports par version avec contrôles ignorés explicites. |
| `quality-engine` | **Partiel** | Rapport structurel : contrastes, SEO, breakpoints, exigences du brief, motion, diversité ; scans axe ciblés dans les E2E. | Rapport catégorisé avec preuves, exécutés/ignorés, performance laboratoire/terrain et portes critiques distinctes du score. |
| `editing-engine` | **Partiel, fondations existantes** | Édition ciblée, historique, presets, IA JSON prévisualisable/annulable, composition, motion et `scene3d` dans l’éditeur jusqu’à la publication. | Plan d’impact et dépendances plus explicites, autres commandes créatives spécialisées et comparaison visuelle des propositions. |
| `learning-engine` | **Absent** | Aucune collecte d’apprentissage ni entraînement sur les données utilisateurs. | Consentement, minimisation, rétention, évaluations explicites et calibration hors données privées par défaut. |

## 2. Fondations transverses

| Exigence | État | Faits et limites |
| --- | --- | --- |
| Séparation intention / conception / implémentation / exécution | **Partiel** | `ProjectBrief`, `CreativeDirection`, `PageDocument` et site navigateur sont distincts. Le brief n’est pas encore une spécification projet complète et éditable couvrant toutes les interactions. |
| Design system versionné | **Partiel** | Schéma `1.0.0`, tokens et presets partagés ; pas de versions indépendantes multiples avec comparaison complète. |
| Orchestrateur et tâches | **Partiel synchrone ; absent pour les tâches longues** | `runCreativeCapability` orchestre `scene3d` sur clone avec validation ; `ai_generations` journalise les opérations synchrones. Toujours aucune file persistante, annulation ou reprise générale. |
| Versions et publication | **Partiel avancé** | Révisions, checkpoints, restauration, snapshots immuables, dépublication et rollback publié existent. Pas de version projet complète couvrant chaque artefact créatif. |
| Sécurité et isolation tenant | **Fondations vérifiées** | Sessions, CSRF, RBAC, quotas, rate-limit, validation CSS/URL/uploads et tests d’accès horizontal. Aucun code utilisateur arbitraire n’est exécuté. |
| Performance | **Budgets 3D ; absent comme mesure Creative Engine** | `scene3d` borne contextes, particules, DPR et boucles. Aucun LCP/INP/CLS, budget de génération ou profil mémoire n’est déclaré. Les tests de fonctionnement ne sont pas des mesures Core Web Vitals. |
| Observabilité | **Partiel** | États et erreurs de génération en base ; pas de contrat complet de corrélation, métriques de durée/coût ou artefacts par étape. |
| Accessibilité | **Partiel vérifié** | Contrastes calculés, reduced motion, parcours clavier, scans axe ciblés et fallback 3D sans canvas sous reduced motion. Pas de certification WCAG globale ni de revue lecteur d’écran exhaustive. |

## 3. Lots prioritaires et dépendances

### Lot A — P0 : orchestration persistante et idempotente

**Sous-lot livré, sans clôturer le lot A :** la création `project_create` rejoue désormais une création terminée avec une clé UUID, une empreinte normalisée et un journal transactionnel isolé par workspace/utilisateur. Le wizard réessaie avec la même clé après une réponse perdue ; les créations directes sont couvertes et une charge différente est refusée. La migration `0009_loose_robin_chapel.sql` et les preuves figurent dans `docs/woob/IMPLEMENTATION_STATUS.md`. Cela ne fournit toujours ni contrat de job, heartbeat, annulation, budgets, file durable ou worker autonome.

- **Fichiers probables :** `server/db/schema.ts`, nouvelle migration, services de génération, routes de tâches, wizard et tests d’intégration.
- **Modifications :** contrat de job, transitions d’état autorisées, idempotency key, heartbeat, annulation, reprise et budgets ; conserver les générations actuelles comme historique compatible.
- **Dépendances :** aucune nouvelle technologie par défaut ; évaluer d’abord une file PostgreSQL et un worker séparé. PGlite reste local et mono-processus.
- **Risques :** doubles exécutions, worker sans persistance, faux statut `cancelled` alors que le fournisseur travaille encore, secrets dans les journaux.
- **Tests :** interruption/reprise, annulation, concurrence, quotas, isolation horizontale, reprise sans doublon et expiration.
- **Critère de sortie :** une génération réelle peut être suivie, annulée et reprise sans dupliquer projet, page ou consommation.

### Lot B — P1 : contrôles navigateur et preuves visuelles

- **Fichiers probables :** module `quality/browser`, worker isolé, stockage d’artefacts, routes de rapport, UI de résultats et fixtures Playwright.
- **Modifications :** captures multi-viewports, erreurs navigateur, overflow, liens/images, états reduced motion, preuves privées, contrôles exécutés/ignorés et expiration des artefacts.
- **Dépendances :** lot A pour les tâches longues ; Playwright déjà présent, mais son exécution serveur doit être isolée et limitée.
- **Risques :** SSRF, captures de secrets, coût CPU, non-déterminisme, fausse inspection esthétique par une fonction qui ne regarde aucune image.
- **Tests :** défauts volontaires détectés, liens internes seulement, timeout, nettoyage, accès tenant et non-divulgation des artefacts.
- **Critère de sortie :** un défaut navigateur démontrable produit une preuve et ne peut pas être marqué réussi sans nouveau contrôle.

### Lot C — P1 : correction ciblée avec budget

- **Modifications :** plan de correction structuré, éléments/dépendances touchés, proposition prévisualisable, acceptation/annulation, nombre de cycles borné et nouvelle exécution des contrôles affectés.
- **Dépendances :** lot B et historique existant.
- **Tests :** préservation des exceptions locales, refus d’une correction invalide, budget épuisé, rollback et absence de régression.
- **Critère de sortie :** corriger un défaut réel sans réécriture globale ni boucle infinie.

### Lot D — P1/P2 : références et médias créatifs

- **Modifications :** ingestion contrôlée des références, provenance/licences, traitement d’images et variantes responsives.
- **Risques :** droits d’usage, SSRF, fichiers malveillants, coûts fournisseurs et copie de références.
- **Critère de sortie :** une référence autorisée influence des décisions structurées sans copier du code ni prétendre posséder des droits non vérifiés.

### Lot E — incrément vertical `scene3d` livré

- Contrat strict, descripteur de capacité, dispatcher synchrone, rendu Three.js différé, deux presets, édition et publication.
- Une scène par page, 32/64 particules, DPR borné, pause/reprise, suspension hors viewport/onglet et nettoyage explicite.
- Fallback SSR/image/SVG, reduced motion sans canvas, agent local prévisualisable et démo Atelier Ligne.
- Preuves et limites : [WOOB_SCENE3D.md](./WOOB_SCENE3D.md). Ce lot ne livre ni modèles importés, ni timeline, ni file persistante, ni mesure Core Web Vitals.

### Lots ultérieurs

Narration avancée, 3D/WebGL plus riches au cas par cas, évaluateurs multimodaux explicitement identifiés, calibration humaine et apprentissage consenti. Aucun de ces éléments n’est une dépendance des lots A à C.

## 4. Portes de validation permanentes

1. Aucun score visuel ne compense une erreur de sécurité, une fonctionnalité essentielle cassée ou une exigence obligatoire absente.
2. Tout rapport distingue contrôles exécutés, ignorés et échoués, avec preuves.
3. Une inspection dite visuelle exige un rendu réellement capturé puis examiné ; un test DOM seul reste un test DOM.
4. Les corrections sont ciblées, réversibles et suivies d’un nouveau contrôle.
5. Aucun code généré non fiable ne rejoint le processus principal.
6. Les migrations restent additives et les données existantes ne sont jamais réinitialisées pour obtenir une suite verte.

## 5. Dernière base vérifiée

- TypeScript, ESLint et build de production : réussis dans `npm run verify`.
- Vitest : **74/74 tests dans 14 fichiers**.
- Playwright : **32/32 parcours** sur le build de production.
- Migration historique `0006_creative_brief` : **42 projets avant/après** sur la base locale existante ; aucune nouvelle migration pour `scene3d`.
- Captures du brief, concepts et démos examinées séparément ; deux captures 3D production à 1440/390 px ajoutées. Ce ne sont pas des pipelines visuels automatiques.
