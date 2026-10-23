# WOOB — incrément vertical `scene3d`

Date : 2026-10-23. Branche : `arena/639e32e6-woob`.

Ce document décrit un **incrément limité et intégré** du studio créatif : une scène 3D procédurale, son contrat, son orchestration synchrone, son renderer, son édition, sa persistance et ses preuves. Il ne déclare ni le cahier des charges global ni les autres phases de la [feuille de route](./WOOB_CREATIVE_ENGINE_ROADMAP.md) terminés.

## 1. Diagnostic qui a conduit à ce lot

| Catégorie | Constat vérifié avant l’incrément |
| --- | --- |
| Existant | Brief, concepts, design system, documents JSON validés, registre, renderer, édition, historique, publication et trois démos publiques. |
| Réutilisable | Opérations d’arbre, aperçu IA sur clone, acceptation/annulation, undo/redo, sauvegarde par révision et snapshots publiés. |
| Incomplet | Motion limité aux entrées au viewport ; opérations IA synchrones ; qualité structurelle sans produit d’inspection visuelle automatique. |
| Absent | Aucune scène 3D, aucun descripteur de capacité avec budget/fallback, aucune file persistante de tâches longues. |
| Risqué | Charger WebGL sur chaque page, dupliquer les contextes, créer une boucle non suspendue, accepter des props arbitraires ou présenter un fallback comme un canvas actif. |

**Priorité choisie :** une seule capacité verticale `scene3d`. Les files persistantes, timelines avancées, preuves visuelles produit et corrections automatiques ne sont pas développées en parallèle.

## 2. Décision technique

- **Three.js `0.186.1`**, sans React Three Fiber. Le cycle de vie est explicite et une seule dépendance runtime est ajoutée ; `@types/three` reste en développement.
- Géométries procédurales uniquement : **aucun modèle distant, aucun shader arbitraire, aucun post-traitement et aucun code fourni par l’IA exécuté**.
- Le module Three est chargé par `import('./Scene3DRuntime')`, uniquement après l’approche du viewport et si le contexte autorise WebGL.
- Une scène maximum par page est imposée par l’orchestrateur **et** par la validation du document.
- Aucune migration, réinitialisation de base ou modification de fichier d’environnement sensible n’est nécessaire.

Le coût indiqué dans le catalogue est **qualitatif**, pas une mesure GPU, un coût monétaire ou une promesse Core Web Vitals.

## 3. Chemin vertical réel

```text
Demande explicite ou ajout manuel
  → scene3dCapabilityOperationSchema
  → runCreativeCapability (clone + insert/update/remove)
  → registre + opérations d’arbre + validatePageDocument
  → aperçu IA annulable, sans mutation du document source
  → application au brouillon + undo/redo
  → inspecteur + sauvegarde par révision
  → snapshot de publication
  → DocumentRenderer → Scene3D → import dynamique de Scene3DRuntime
  → canvas Three.js réel ou fallback statique explicite
```

`src/lib/creative/orchestrator.ts` est un **dispatcher local synchrone**. Il ne constitue pas une file de tâches, ne promet ni reprise ni annulation distante et ne remplace pas le lot d’orchestration persistante de la roadmap.

## 4. Contrat et catalogue

Le composant `scene3d` est enregistré dans `src/lib/document/registry.ts` avec des props strictes :

| Prop | Valeurs / rôle |
| --- | --- |
| `title`, `description` | Contenu visible et alternative textuelle de l’expérience. |
| `preset` | `orbital` ou `prism`, deux géométries procédurales réelles. |
| `quality` | `low` : 32 particules, DPR ≤ 1 ; `balanced` : 64 particules, DPR ≤ 1,5. |
| `autoRotate` | Rotation lente ; suspendue dans l’éditeur pour garder un canevas stable. |
| `interactive` | Rotation par boutons et pointeur ; n’affecte pas la disponibilité du bouton de pause automatique. |
| `fallbackAssetId`, `fallbackSrc` | Média ou URL de fallback, soumis aux contrôles existants. |
| `fallbackAlt` | Alternative de l’image/SVG statique. |

L’opération contrôlée accepte `kind: 'scene3d'`, `action: 'insert' | 'update' | 'remove'`, `targetId`, une position et des props partielles. Une mise à jour ne fusionne que les champs fournis : les autres réglages et blocs restent inchangés. Une suppression sans cible renvoie `422 SCENE3D_NOT_FOUND` dans l’agent local au lieu de créer une scène.

`src/lib/creative/capabilities.ts` expose le descripteur versionné : entrées, sorties, paramètres, dépendances, coût qualitatif, budgets, responsive, accessibilité, tests et fallback. `evaluateScene3DFit` empêche l’agent local de proposer la 3D pour un brief simplement « premium » : un signal explicite est requis.

## 5. Cycle de vie, suspension et fallback

1. Le HTML serveur contient le texte et le fallback, mais **aucun canvas**.
2. Un premier observateur arme le chargement à 240 px du viewport ; un second mesure la visibilité réelle.
3. Three.js est importé puis initialisé. L’état `ready` n’apparaît qu’après la création et le premier rendu effectifs.
4. La boucle `requestAnimationFrame` fonctionne seulement si la scène est visible, l’onglet visible, la rotation automatique active et la pause inactive.
5. Sortir du viewport, masquer l’onglet ou mettre en pause annule la frame. Les rotations manuelles font un rendu à la demande.
6. Un changement de preset/qualité ou un démontage libère frames, observers, listeners, géométries, matériaux et contexte WebGL.
7. `prefers-reduced-motion: reduce`, le réglage `designSystem.motion.reducedMotion: 'reduce'`, le wizard non interactif, une indisponibilité WebGL ou une perte de contexte conservent le contenu et le fallback. Aucun état `ready` n’est simulé.

Les attributs `data-scene3d-state`, `data-scene-running`, `data-scene-rotation` et `data-scene3d-paused` rendent ces comportements observables dans les tests. Ils ne constituent pas une mesure de fréquence d’images ou de mémoire.

## 6. Édition, agent et démonstration

- L’inspecteur édite le titre, la description, le preset, le budget, les deux modes de rotation et le fallback.
- L’agent local peut insérer, configurer ou supprimer la capacité via la même opération validée. L’aperçu ne modifie pas le canevas avant acceptation.
- Le parcours testé comprend annulation de la première proposition, nouvelle proposition, application, undo/redo, modification des props, sauvegarde, rechargement et publication locale.
- `/demos/atelier-ligne/projets` contient **Orbite 01**, insérée par l’orchestrateur. Son fallback réutilise une image locale de la démo.
- Les actions métier des trois démos restent inactives et leurs onze pages sont préservées.

## 7. Preuves exécutées le 2026-10-23

| Contrôle | Résultat |
| --- | --- |
| `npm run verify` | TypeScript strict, ESLint, **74/74 Vitest dans 14 fichiers**, build Next.js de production réussis. |
| `npm run test:e2e` | **32/32 Playwright** contre le build de production. |
| WebGL réel | Canvas Three initialisé, rotation manuelle observable, pause/reprise et boucle suspendue hors viewport. |
| Agent vertical | Aperçu sans mutation, annulation, application, undo/redo, persistance et publication locale ; rotation manuelle désactivée tout en conservant la pause publique. |
| Reduced motion | Préférence système : fallback visible, contenu conservé et zéro canvas initialisé ; réduction forcée du thème vérifiée également dans le rendu SSR. |
| Accessibilité automatisée | Page « Projets » incluse dans le parcours axe des démos, sans violation dans cette portée ; aucune certification WCAG globale. |
| Inspection visuelle ciblée | Captures réelles du build de production à **1440 et 390 px** examinées ; sculpture visible, contrôles lisibles, pas de débordement. Les titres longs ont reçu `overflow-wrap:anywhere`. |
| Smoke HTTP | Accueil, démo et page Projets `200` ; image `200` ; slug inconnu `404`. Fallback SSR présent, canvas SSR `0`. |
| Dépendances | `npm audit --omit=dev` : **0 vulnérabilité**. Audit complet : **4 alertes modérées** dans la chaîne de développement `drizzle-kit/esbuild`. Aucun correctif forcé/rétrogradant appliqué. |
| Diff | `git diff --check` sans erreur. |

Les avertissements Vite natif et les deux traçages filesystem de `src/server/storage.ts` restent non bloquants et connus. Aucun appel OpenAI, déploiement public, profil GPU ou test avec lecteur d’écran n’a été réalisé.

## 8. Limites et prochaine priorité

- Une scène par page, deux presets procéduraux ; pas de modèles importés, scènes au scroll, timeline, physiques, XR ou éditeur de graphe 3D.
- Le fallback est une image/SVG, pas une capture automatique du canvas.
- Les budgets sont des garde-fous d’implémentation, pas des mesures LCP/INP/CLS ou de consommation énergétique.
- Le catalogue contient une capacité `scene3d` réellement branchée ; il ne prétend pas encore décrire tous les moteurs du cahier des charges.
- L’orchestration reste synchrone. La prochaine priorité d’architecture demeure la file persistante/idempotente, puis les preuves navigateur produit et les corrections bornées, selon la roadmap existante.
