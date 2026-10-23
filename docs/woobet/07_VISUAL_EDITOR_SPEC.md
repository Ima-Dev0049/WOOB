# 07 — Spécification de l'éditeur visuel hybride

## 1. Objectif et invariants

L'éditeur manipule un document structuré par commandes. Le canvas en est une projection interactive. Les invariants sont : identifiants stables ; parents/enfants valides ; aucune propriété inconnue non préservée selon politique ; références résolubles ; sélection récupérable ; historique cohérent ; sauvegarde par révision ; rendu public sans outillage d'édition.

## 2. Expérience à deux niveaux

| Capacité | Simple | Avancé |
|---|---|---|
| Contenu | Texte, image, bouton, lien | Idem + champs dynamiques autorisés |
| Structure | Ajouter/déplacer/dupliquer sections et blocs sûrs | Arborescence, slots, nesting et contraintes |
| Style | Préréglages, couleurs, familles, espacements | Tokens, unités, grid/flex, position, états |
| Responsive | Aperçus et adaptations guidées | Overrides par propriété et héritage inspectable |
| Interactions | Liens, ancres, soumission | Actions déclaratives, conditions, visibilité |
| Données | Formulaire simple, collection prédéfinie | Bindings et requêtes limitées |
| Historique | Annuler/rétablir | Journal de commandes, checkpoints, diff |
| Risque | Options destructrices masquées | Avertissements et validation renforcée |

Le passage simple ↔ avancé conserve document, sélection et viewport. Les capacités avancées dépendent du rôle et de l'offre, mais une option cachée côté UI reste contrôlée par l'API.

## 3. Modèle de document pour l'édition

Chaque nœud : `id`, `type`, `version`, `props`, `styles`, `children`/slots, `overrides`, `visibility`, `interactions`, `meta`. Les IDs sont générés côté client ou serveur avec algorithme non prévisible si exposé, uniques dans le document. Les index ne sont pas persistés comme identité.

Les références (`assetId`, `pageId`, `collectionId`, `tokenId`) utilisent des IDs ; le rendu reçoit une projection résolue. Les nœuds supprimés sont retirés de la sélection et de l'historique futur. Les sections vérouillées par un template ou un rôle déclarent des capacités d'édition, pas seulement un attribut visuel.

## 4. Commandes

Interface conceptuelle :

```ts
type EditorCommand = {
  id: string;
  type: string;
  actorId: string;
  baseRevision: number;
  scope: { pageId: string; nodeIds?: string[] };
  payload: unknown;
  createdAt: string;
};

type CommandResult = {
  document: PageDocument;
  inverse?: EditorCommand;
  changedNodeIds: string[];
  issues: ValidationIssue[];
};
```

Commandes minimales : `insertNode`, `moveNode`, `removeNode`, `duplicateNode`, `updateProps`, `setStyle`, `resetStyle`, `setBreakpointOverride`, `updateText`, `replaceAsset`, `applyTheme`, `applyTemplatePatch`, `setInteraction`, `setVisibility`, `applyAiPatch`.

Une commande composite est atomique. Les commandes continues comme le drag utilisent un état transitoire puis un commit ; l'historique ne contient pas chaque pixel. `applyTheme` conserve les overrides compatibles et rapporte les pertes avant application.

## 5. Undo, redo et historique

- pile locale bornée en mémoire avec patches inverses ou snapshots structurels selon benchmark ;
- une nouvelle commande après undo vide la pile redo ;
- les opérations serveur (autosave) ne créent pas une commande utilisateur supplémentaire ;
- le diff IA accepté est une commande composite annulable ;
- les checkpoints serveur sont immuables et distincts de la pile locale ;
- après rechargement, seuls les checkpoints et éventuels journaux persistés explicitement sont récupérables ; aucune promesse de redo illimité.

La restauration d'un checkpoint crée une nouvelle révision de brouillon et un événement d'audit. Elle ne modifie pas la publication active tant qu'une nouvelle publication n'a pas lieu.

## 6. Sélection et arborescence

`Selection` contient des IDs ordonnés, le nœud d'ancre et le mode (contenu/structure). La sélection traverse visuellement les niveaux avec un raccourci ou clic modifié ; un breadcrumb indique la hiérarchie. Les overlays sont calculés à partir des rectangles mesurés mais ne sont pas stockés dans le document.

L'arborescence est virtualisée, supporte clavier, renommage de calque, visibilité, verrouillage et drag avec indicateur de slot valide. Les nœuds cachés restent accessibles dans l'arborescence avec état explicite.

## 7. Glisser-déposer : comparaison obligatoire

| Solution | Forces attendues à vérifier | Limites/risques | Protocole de décision |
|---|---|---|---|
| `dnd-kit` | Modularité React, capteurs, accessibilité annoncée par le projet | Gestion manuelle des collisions, iframe, nested slots et animations à prouver | Prototype D1/D2, clavier, touch, iframe, perf |
| Pragmatic DnD | Primitives navigateur, approche légère et flexible | Plus de travail pour certains comportements et accessibilité ; intégration React à évaluer | Même prototype et effort de maintenance |
| HTML5 Drag and Drop natif seul | Peu de dépendances | Limites tactile, iframe, contrôle et cohérence | Non recommandé seul pour l'éditeur complexe |
| Framework d'éditeur tout-en-un | Gain possible de temps sur blocs/canvas | Modèle de document imposé, lock-in, rendu public et migrations | Évaluer seulement avec export complet et tests de fidélité |

**Recommandation provisoire :** `dnd-kit` comme premier candidat, sans décision définitive avant le spike. Le README du paquet consulté confirme son positionnement de bibliothèque React de drag-and-drop performante et accessible, pas son adéquation aux besoins WOOBET.

Le système de drop utilise des **drop targets logiques** (`parentId`, `slot`, `index`, `before/after`) calculés depuis le modèle, pas seulement la position DOM. Une prévisualisation montre le résultat ; une cible interdite est expliquée. Une alternative « déplacer avant/après/dans » au clavier est obligatoire.

## 8. Édition de texte

Le texte simple est une chaîne avec échappement. Le texte riche utilise un arbre limité ou un sous-document versionné, avec balises/attributs autorisés. Lexical, TipTap/ProseMirror ou une solution native doivent être comparés sur sérialisation déterministe, IME, copier-coller, clavier mobile, accessibilité et poids. L'éditeur riche ne stocke jamais du HTML arbitraire comme format canonique.

La sélection texte et la sélection de nœud sont deux modes distincts. Une frappe ne déclenche pas une sauvegarde réseau ; un debounce regroupe les changements et la file de commandes conserve l'ordre.

## 9. Panneau de propriétés

Groupes : contenu, layout, espacements, typographie, couleurs, bordures/ombres, position, responsive, visibilité, interactions, accessibilité, données, avancé. Chaque champ expose valeur effective, source héritée et override. Les erreurs sont affichées près du champ et dans une liste globale navigable.

Le CSS personnalisé contrôlé (P2) est limité à une portée par projet/composant, parsé par AST, propriétés/valeurs en allowlist ou denylist de sécurité insuffisante seule, pas de chargement de ressources arbitraires, et jamais considéré comme sûr contre tous les abus sans isolation. Les scripts personnalisés sont un autre produit de sécurité (P3).

## 10. Responsive et styles

Le document contient un style de base et des overrides nommés par breakpoint du thème. Exemple conceptuel : base `columns=3`, mobile `columns=1`. L'ordre des breakpoints et la stratégie mobile-first sont fixés dans le schéma. Les modifications automatiques ne créent pas d'override invisible.

Tests : largeurs intermédiaires, texte long, zoom, RTL, contenu absent, images non chargées, clavier et orientation. Les largeurs de canvas ne sont pas des user agents ; la validation finale utilise Playwright sur navigateurs réels.

## 11. Animations et interactions

Les animations utilisent des presets typés : propriété, durée, easing token, déclencheur et réduction de mouvement. Interdire les animations de layout coûteuses par défaut. Les interactions déclaratives : `navigate`, `scrollTo`, `openDialog`, `submitForm`, `setLocalState`, `callExtension` si autorisé. Elles ont des arguments validés et aucune chaîne de code.

Une action côté visiteur ne peut appeler qu'un endpoint de capacité publique prévu ; les secrets et URLs internes restent côté serveur.

## 12. Autosave, onglets et conflits

Machine d'état : `clean → dirty → saving → saved` ; branches `offline`, `error`, `conflict`. Un debounce et un intervalle maximal déclenchent la sauvegarde ; `beforeunload` avertit si des changements ne sont pas confirmés. Les accusés portent révision et checksum.

Deux onglets : `BroadcastChannel` ou événement équivalent signale révision/présence, sans transfert de secrets. Si une révision externe arrive avec des changements locaux, l'onglet arrête l'autosave et propose : voir le diff, dupliquer le brouillon, ou appliquer ses commandes sur la nouvelle base si la transformation est validée. La V1 ne promet pas de fusion automatique générale.

La collaboration temps réel future pourrait utiliser Yjs/Automerge, mais un CRDT ne résout pas seul la sémantique des composants, permissions, historique et publication. Son introduction exige un ADR et une migration du protocole de commandes.

## 13. Chargement de gros documents

Pages chargées à la demande ; arbre de projet paginé ; virtualisation ; composants et inspecteurs lazy ; validation incrémentale ; assets sous forme de références ; aperçus de pages non visibles désactivés. Les nœuds hors viewport peuvent être rendus de façon simplifiée si cela ne compromet pas mesure et sélection.

Au-delà des limites de document, l'utilisateur reçoit une explication et des actions (scinder page, réduire nesting/assets) plutôt qu'un gel. Les quotas sont appliqués avant que la mémoire navigateur ne soit épuisée.

## 14. Validation

Niveaux : schéma syntaxique ; registre/version ; invariants d'arbre ; références ; capacité/permission ; accessibilité ; responsive ; prépublication. Issues : `code`, `severity`, `nodeId`, `path`, `messageKey`, `params`, `fixSuggestion`. Les erreurs bloquantes de publication sont distinctes des avertissements d'édition.

Un document peut être sauvegardé comme brouillon avec certains problèmes de contenu, mais jamais avec une structure que le renderer ne peut pas interpréter. Les critères exacts de blocage sont versionnés.

## 15. Tests de qualité mesurables

| Test | Critère initial |
|---|---|
| Fidélité | Même arbre de projection ; captures à largeurs définies ; diff visuel sous seuil calibré, exclusions limitées aux overlays |
| Fluidité | Budgets NF-PERF-001/002 ; aucune tâche > 200 ms répétée sur D1 sans justification |
| Drag | 100 scénarios nested/slots/breakpoints ; cible logique exacte ; alternative clavier équivalente |
| Conservation | Kill navigateur/réseau/serveur ; aucune perte au-delà de la fenêtre explicitement indiquée ; aucun faux « saved » |
| Concurrence | Deux onglets/acteurs ; conflit détecté ; pas d'écrasement silencieux |
| Erreurs | Composant/média/provider invalide ; erreur isolée et récupération |
| Accessibilité | Parcours clavier complet, lecteur d'écran sur scénarios, AA aux contrastes |
| Complexité | D1/D2/D3 ; chargement borné et rejet gracieux au-delà des limites |
| Stabilité | Soak 4 h, 1 000 commandes, plusieurs undo/redo et changements de pages ; listeners/timers sans croissance non bornée |

## 16. Ce qui n'est pas décidé

Bibliothèque DnD finale, éditeur riche, topologie iframe définitive, bibliothèque de store, collaboration future, moteur de sandbox. Les choix sont subordonnés aux résultats des prototypes et documentés dans `29_OPEN_DECISIONS.md`.
