# 18 — UX/UI et design system WOOBET

## 1. Principes d'expérience

WOOBET doit paraître rapide, professionnel et accessible sans masquer la complexité réelle. Les principes sont : une action principale par vue ; langage métier avant jargon ; disclosure progressive ; états toujours visibles ; réversibilité ; raccourcis en complément, jamais en unique moyen ; aucune fausse confirmation de sauvegarde/publication ; densité adaptée au desktop et parcours mobiles limités mais utiles.

## 2. Deux identités indépendantes

Le **design system du SaaS** (WOOBET Studio) possède tokens, composants, iconographie et ton propres. Le **design system des sites créés** appartient aux thèmes utilisateurs. Les tokens d'un site ne modifient jamais le Studio. Les aperçus de carte/template utilisent des assets contrôlés pour ne pas injecter le thème dans l'interface de gestion.

## 3. Architecture de navigation

- barre globale : sélecteur de workspace, recherche/commandes, tâches, aide, notifications, compte ;
- navigation de workspace : dashboard, projets, templates, médias, membres, usages/facturation selon permissions ;
- navigation projet : vue d'ensemble, pages, éditeur, collections si activées, domaines, publications, intégrations, réglages ;
- fil d'Ariane et retour prévisible ; l'éditeur est un mode focus avec sortie explicite ;
- administration interne physiquement séparée, jamais un simple item caché.

La recherche n'affiche que les objets autorisés. Le sélecteur de workspace indique clairement le contexte avant toute action sensible.

## 4. Dashboard et onboarding

Le dashboard répond : où reprendre, quel est l'état de mes sites, quelles tâches demandent mon attention, quel est mon usage ? Il évite les graphiques sans décision associée.

Onboarding : création de workspace → langue du site → objectif → point de départ (brief/template/vide) → plan ou structure → premier document → aperçu → publication. L'utilisateur peut quitter et reprendre. Une checklist mesure la première publication mais n'impose pas l'IA. Les domaines custom et offres avancées apparaissent au moment pertinent.

## 5. Éditeur : disposition

Desktop : barre supérieure (projet/page, historique, viewport, aperçu, état sauvegarde, publier) ; panneau gauche (pages, sections, arborescence) ; canvas central ; inspecteur droit ; barre inférieure facultative pour problèmes et tâches. Panneaux repliables et largeur réglable bornée.

En simple, gauche = sections/blocs recommandés et droite = quelques groupes de propriétés. En avancé, arborescence, tokens, états et overrides sont disponibles. Un bouton ne change pas de place entre les modes.

Mobile : consultation, édition de contenu simple et publication selon tests ; le drag complexe et l'édition avancée peuvent être déclarés non optimisés plutôt que fournir une expérience trompeuse. Les exigences tactiles et alternatives au drag restent nécessaires pour les fonctions activées.

## 6. Bibliothèque et insertion

Recherche, catégories, aperçus, informations de compatibilité et tags. L'insertion propose des emplacements valides et respecte le contenu existant. Les composants métier indiquent les modules requis avant insertion ; un composant de démonstration est étiqueté comme tel.

Les templates affichent licence, version, dépendances, locales et aperçu responsive. Changer de modèle ouvre un diff des effets sur contenu, styles, pages et assets ; aucune application immédiate sans possibilité d'annuler.

## 7. Panneau de propriétés

Chaque contrôle a libellé, aide contextuelle, valeur effective et source d'héritage. Les unités et limites sont visibles. Les champs avancés sont groupés et recherchables. Les modifications dangereuses ne sont pas cachées dans des menus ambigus.

Les erreurs de validation relient le champ et le nœud canvas. Une icône seule ne porte jamais une information critique ; tooltip et nom accessible sont obligatoires.

## 8. Dialogues, notifications et tâches

Dialogue pour décision courte et destructive ; panneau pour configuration longue ; page dédiée pour domaines/facturation. Le focus entre, reste et revient correctement ; `Escape` ne perd pas sans avertissement des changements importants.

Toasts pour confirmations non critiques, bannières pour états persistants, centre de tâches pour opérations longues. Les messages incluent ce qui s'est passé, l'objet, l'action possible et un code de support si nécessaire. Les erreurs ne blâment pas l'utilisateur.

## 9. États obligatoires de chaque écran

Chargement initial avec skeleton stable ; actualisation en arrière-plan ; état vide avec action ; aucun résultat avec suppression de filtres ; erreur avec retry ; offline ; permission refusée ; quota atteint ; contenu archivé ; conflit ; maintenance. Les skeletons ne simulent pas une progression réelle ; les tâches longues indiquent les étapes connues sans pourcentage inventé.

## 10. Tokens du Studio

Primitives : couleurs, espacements 4/8 px à valider, échelle typographique, rayons, ombres, z-index, mouvement. Sémantiques : `surface.canvas`, `surface.panel`, `text.primary`, `text.muted`, `border.default`, `action.primary`, `state.success/warning/danger/info`, `focus.ring`. Composants : bouton, input, select, tabs, dialog, toast, menu, table, tree, badge, tooltip, popover, slider, color field, code/diff.

Le z-index est une échelle contrôlée pour éviter la guerre des valeurs. Les animations courtes et réductibles ; le focus n'est pas implémenté par une ombre insuffisamment contrastée.

## 11. Clair, sombre et contraste

Les deux modes sont conçus par tokens sémantiques, pas inversion automatique. Le choix suit système par défaut avec override. Contraste AA pour texte/contrôles, états non portés uniquement par couleur, images et icônes vérifiées dans les deux modes. Les thèmes de sites ont leurs propres contrôles de contraste dans le prévol.

## 12. Accessibilité et raccourcis

Clavier : navigation entre régions, tree, dialogues, menus, insertion/déplacement alternatif, undo/redo, sauvegarde explicite et aperçu. Les raccourcis sont affichés, configurables si conflits et ne capturent pas la saisie de texte. Ils tiennent compte des conventions macOS/Windows et des lecteurs d'écran.

Cibles tactiles, zoom 200 %, reflow, reduced motion, annonces ARIA mesurées pour éviter le bruit. Le canvas visuel possède une alternative structurelle par arborescence et formulaires.

## 13. Contenu et ton

Termes cohérents définis dans le glossaire : projet, page, brouillon, checkpoint, publication, domaine, workspace. « Enregistré » signifie serveur confirmé ; « Publié » signifie version active vérifiée selon état ; « Prêt » ne veut pas dire actif. Les textes techniques sont traduisibles et les formats régionaux respectés.

## 14. Éviter la surcharge

Disclosure progressive ; valeurs par défaut sûres ; recommandations contextuelles ; recherche de commandes ; panneaux adaptés à la sélection ; permissions qui retirent les options inutiles ; pas plus d'une action primaire ; regroupement des tâches rares ; espaces de travail et modèles de départ ; sauvegarde des préférences de densité. Les tests mesurent le temps de tâches et les erreurs, pas seulement la satisfaction déclarative.

## 15. Recherche UX et critères

Protocoles sur cinq à huit participants par persona pour les premiers tours, sans prétendre à une représentativité statistique : créer une page, modifier un Hero, corriger mobile, inviter un membre, publier, connecter un domaine, rollback. Mesurer réussite sans aide, temps, erreurs, points d'abandon et compréhension des états.

Gate bêta : parcours débutant réalisé sans intervention pour les tâches critiques du protocole, aucun défaut d'accessibilité bloquant connu, aucun état de sauvegarde/publication trompeur. Les seuils de temps sont établis après baseline plutôt qu'inventés maintenant.
