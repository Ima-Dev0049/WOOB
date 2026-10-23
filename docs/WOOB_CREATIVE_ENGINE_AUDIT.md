# Audit du moteur créatif Woob

Date : 2026-10-23. Branche : `arena/639e32e6-woob`. Point de départ : `9f88f35`.

L’implémentation des lots livrés et leurs vérifications sont décrites dans [WOOB_CREATIVE_ENGINE.md](./WOOB_CREATIVE_ENGINE.md). La correspondance avec le cahier des charges 1.0 et les capacités encore absentes est tenue dans [WOOB_CREATIVE_ENGINE_ROADMAP.md](./WOOB_CREATIVE_ENGINE_ROADMAP.md).

Mise à jour : le brief-engine local, sa migration additive et la vérification des exigences ont ensuite été implémentés. L’audit ci-dessous conserve le constat initial afin de ne pas réécrire l’historique.

## 1. Périmètre et méthode

L’audit suit le chemin réel du brief, sans supposer qu’une capacité documentée existe dans le code : routes API, services de génération, catalogue, registre de composants, schéma JSON, renderer, éditeur, persistance et publication ont été lus. Les dix images fournies servent de références de principes — typographie monumentale, compositions éditoriales, profondeur, mise en scène produit et rythme — et non de maquettes à copier.

## 2. Chemin d’une demande au point de départ

1. `CreateProjectDialog.tsx` collecte nom, type, domaine, modules réels, l’un des six styles et un brief facultatif.
2. `POST /api/workspaces/[workspaceId]/project-preview` vérifie session, CSRF, quota, appartenance et limitation de débit avant `generateProjectPreview`.
3. `project-generation.ts` choisit `demo` ou `openai`. Le mode démo produit localement quatre textes. Le chemin OpenAI demande également seulement `heroEyebrow`, `heroTitle`, `heroDescription` et `seoDescription` ; aucune direction artistique n’est demandée.
4. `buildProjectDraft` résout un blueprint et un template, clone les props de ses nœuds et remplace principalement les textes du hero. Les six thèmes de `capabilities.ts` restent des palettes fixes choisies par l’utilisateur.
5. Le document validé est prévisualisé avec `DocumentRenderer`, puis reconstruit à la création. Le résultat consommable est journalisé dans `ai_generations` et lié au projet dans une transaction.
6. `projects.ts`, `publishing.ts` et les snapshots conservent le document structuré. L’éditeur et le site public utilisent le même renderer. Cette chaîne est réelle et doit être conservée.
7. L’IA d’édition (`services/ai.ts`, `document/ai.ts`) propose des opérations JSON validées sur une copie : props, insertion, thème ou style. Elle ne possède ni génération de composant libre ni évaluation visuelle.

## 3. Ce qui fonctionne et ne doit pas être remplacé

- Monolithe Next.js/React/TypeScript strict, PostgreSQL/PGlite et migrations Drizzle.
- Document versionné, registre strict, validation des props/CSS/URL et pas de HTML arbitraire.
- Catalogue dynamique : 20 catégories, 212 variantes, 30 domaines, 150 sous-domaines, 21 blueprints et quatre modules réellement implémentés.
- Design system structuré, cascade responsive, presets, exceptions locales, undo/redo et rendu partagé.
- Création avec aperçu obligatoire, générations à usage unique, quotas, RBAC, CSRF et limitation de débit.
- Persistance, historique, publication par snapshots et isolation multi-tenant.
- Dernier état vérifié consigné avant ce lot : 49 tests Vitest et 22 scénarios Playwright ; ces totaux seront re-mesurés après les changements.

## 4. Causes vérifiables des résultats génériques

| Priorité | Constat | Preuve | Conséquence |
| --- | --- | --- | --- |
| P0 | Aucun modèle de direction artistique n’existe entre le brief et le document. | `project-generation.ts`, `catalog/generation.ts` | Le fournisseur rédige du texte mais ne raisonne pas sur public, émotion, concept, composition ou motion. |
| P0 | Un seul hero en deux colonnes et un visuel circulaire par défaut. | `DocumentRenderer.tsx`, `globals.css` `.wb-hero`, `.hero-art` | Des secteurs différents reçoivent la même silhouette visuelle. |
| P0 | Six palettes/styles fixes, choisis manuellement, sans justification issue du brief. | `catalog/capabilities.ts` | Le style est une recette sectorielle et non une identité construite. |
| P1 | Les collections sont majoritairement des grilles de cartes identiques. | renderer `features`, `pricing`, `blog`, `products`, `.card-grid.three` | Rythme répétitif et sections interchangeables. |
| P1 | Le motion global applique le même `fade` ou `rise` à tous les `.wb-node`. | `design-system.ts` `themeGlobalCss` | Effet décoratif uniforme, sans intention ni déclenchement contextualisé. |
| P1 | Aucune phase de candidats, comparaison de diversité ou auto-évaluation n’existe. | services de génération | La première composition devient le résultat final sans contrôle créatif. |
| P1 | L’éditeur contrôle des transitions CSS mais pas une chorégraphie native persistée. | `StyleInspector.tsx`, types de nœud | Le réglage du mouvement reste technique et peu lisible. |
| P2 | Les compositions abstraites ne sont pas des médias générés et aucun pipeline d’images créatives n’est branché. | `hero-art`, assets locaux/S3 | Les références immersives ne peuvent être reproduites honnêtement sans vrais assets. |
| P2 | Aucun inspecteur visuel automatique, compareur de screenshots ou contrôle de performance animée n’est intégré à la génération. | `project-generation.ts`, tests | Un score structurel ne doit pas être présenté comme une preuve de beauté. |
| P2 | Pas de WebGL/3D, narration au scroll ou transitions de pages spécifiques. | dépendances et renderer | Ces capacités relèvent de lots ultérieurs justifiés, pas d’une dépendance ajoutée par défaut. |

## 5. Sécurité, erreurs et limites

Les entrées sont bornées, les documents et propositions sont validés, les URL actives sont limitées et les opérations IA ne contiennent pas de code exécutable. Les erreurs de génération sont journalisées sans créer de projet. Les tests couvrent l’isolation et les parcours principaux. Il faut préserver ces garanties pour les nouveaux champs, notamment les variantes de composition et de motion.

Aucun fournisseur distant, outil de capture visuelle automatique, WebGL ou service de génération d’images n’est vérifié dans cet environnement. Le mode local doit être décrit comme un moteur de règles déterministes, jamais comme une réponse d’un modèle distant.

## 6. Plan par phases

### P0 — Direction artistique et anti-répétition, premier lot implémenté

- Contrat `CreativeDirection` versionné : intention, public, émotion, personnalité, concept, palette justifiée, typographie, composition, imagerie, motion, conversion et contraintes.
- Trois candidats locaux distincts, évaluation mesurable et sélection. Le fournisseur distant existant reste limité aux textes ; une direction OpenAI structurée reste une extension ultérieure.
- Direction persistée dans le thème global existant, propagée aux pages et snapshots sans migration destructive.
- Choix du concept dans l’aperçu et création du même concept validé côté serveur.
- Variantes éditables de hero et de collections dans le registre actuel.

### P1 — Motion et qualité, premier lot implémenté

- Motion de nœud validé, révélations à l’entrée dans le viewport avec API native, aucune dépendance GSAP/Motion/WebGL.
- Désactivation en l’absence de JavaScript et respect de `prefers-reduced-motion` ; contrôles dans l’éditeur.
- Rapport structurel : contrastes, descriptions SEO, charge de motion, responsive déclaré et risques de répétition. Aucun score présenté comme une preuve esthétique.
- Tests sur briefs contrastés, persistance, publication, choix de concept, mobile et mouvement réduit.

### P2 — Itération visuelle réelle

- Captures automatiques multi-viewports après génération, inspection effectivement réalisée, erreurs navigateur et liens.
- Comparaison de versions et corrections ciblées, avec budget et prévention des boucles.
- Bibliothèque d’assets créatifs et traitements d’images responsives.

### P3 — Narration avancée

- Scènes au scroll, transitions de pages et compositions produit plus riches, après mesures de performance.
- Variantes de composants supplémentaires uniquement lorsqu’un concept les justifie.

### P4 — 3D et outils spécialisés

- Évaluer WebGL/3D ou une bibliothèque motion par cas d’usage, coût, accessibilité et maintenance. Aucun ajout par défaut.

## 7. Critères du premier incrément

- Deux briefs très différents produisent des directions et silhouettes réellement distinctes.
- Le concept choisi dans l’aperçu est retrouvé après création, rechargement et publication.
- Les nouvelles variantes restent éditables et compatibles avec les anciens documents.
- Le motion est borné, non permanent et désactivable ; il ne déplace pas la mise en page.
- Les tests automatisés mesurent ce qu’ils vérifient réellement ; une inspection navigateur est documentée séparément.
