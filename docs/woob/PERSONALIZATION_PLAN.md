# Personnalisation — audit et plan de livraison

Date de l’audit : 2026-10-23. Ce document distingue les faits constatés dans le dépôt des capacités en cours de livraison. Il ne transforme pas les pistes ci-dessous en fonctionnalités terminées.

## État des lieux vérifiable avant le lot

| Domaine | État | Preuves et risques |
|---|---|---|
| Document structuré | Fonctionnel, limité | `src/lib/document/types.ts`, `validation.ts` : schéma `1.0.0`, registre et styles locaux allowlistés. |
| Thème | Partiel | Palette et quelques dimensions dans chaque `PageDocument`; pas de tokens complets ni de presets réutilisables. |
| Responsive | Partiel | Surcharges tablette/mobile dans les nœuds et CSS généré ; pas de cascade explicite tablette → mobile ni de styles d’état. |
| Éditeur | Partiel | Modes simple/avancé, inspection contextuelle et historique local ; pas de mode expert, copie de style ou application multi-blocs. |
| Persistance/publication | Partiel, risque P0 | Sauvegarde par révision et snapshots publiés existants. Le thème modifié dans une page n’était pas propagé au thème projet lu par `SitePage`. |
| IA | Partiel | Propositions validées et prévisualisées, mais opérations limitées au contenu et à l’insertion ; l’aperçu ne recevait pas les variables du thème proposé. |
| Sécurité | Fonctionnel sur le périmètre existant | Allowlists de propriétés/valeurs et URL contrôlées. Aucun CSS ou script arbitraire n’est accepté. |
| Accessibilité | Partiel | Focus modal et réduction CSS globale des animations ; pas de diagnostic de contraste lié au thème ni de tokens de focus. |

## Lot P0–P1 retenu

1. **Contrat compatible** : ajouter un `DesignSystem` versionné au thème existant, normaliser les anciens documents sans migration destructive et conserver les anciennes couleurs comme source de dérivation.
2. **Cascade déterministe** : valeurs par défaut → tokens globaux → style réutilisable → surcharge locale → adaptations ordinateur/tablette/mobile → état interactif. Les surcharges locales ne sont pas effacées par un changement global.
3. **Rendu commun** : résolution partagée par l’éditeur, l’aperçu privé, la proposition IA et le site publié ; variables CSS contrôlées, points de rupture et réduction des animations.
4. **Édition progressive** : mode simple pour les réglages essentiels, avancé pour les styles et presets, expert pour les propriétés supplémentaires et variables CSS `--woob-*` validées. Aucun champ de script ou de HTML brut.
5. **Gestes de productivité** : copier/coller, réinitialiser les surcharges, créer un style réutilisable et l’appliquer aux blocs du même type.
6. **Persistance globale sûre** : lors d’un changement de thème, mise à jour transactionnelle du projet et des pages avec incrément des révisions ; les racines et exceptions locales restent celles de la base. Les autres onglets détectent le conflit au lieu d’écraser les données.
7. **IA structurée** : opérations de thème et de style validées par les mêmes schémas, aperçu avant application, annulation par fermeture et undo après application.
8. **Preuves** : propriétés de cascade, entrées hostiles, compatibilité, propagation entre pages, sauvegarde/rechargement, snapshot publié, undo/redo et parcours navigateur.

## Roadmap au-delà du lot

- **P2** : variantes de composants plus riches, gestion visuelle des presets partagés entre projets, import/export signé d’un thème, audit de contraste étendu aux états et aux dégradés.
- **P3** : collaboration en temps réel avec présence et résolution de conflits, commentaires, permissions éditoriales plus fines, historique visuel comparatif.
- **P4** : animations orchestrées accessibles, règles conditionnelles métier, extensions et scripts tiers isolés après politique de sécurité explicite, marketplace de thèmes et parcours utilisateurs avancés.

Restent volontairement hors de ce lot : CSS/HTML arbitraire, exécution de code généré, scripts tiers dans le contexte principal, moteur d’animation libre, effets visuels non nécessaires et prétention à couvrir l’ensemble des systèmes avancés de la demande.
