# WOOBET — Résumé exécutif

**Document :** 00 — Résumé exécutif
**Version du dossier :** 1.0.0-proposition
**Date :** 2026-10-23
**Statut :** spécification pour revue ; aucune mise en œuvre ni capacité de production n'est déclarée acquise.

## 1. Objet

WOOBET est un projet de plateforme SaaS internationale permettant de créer, personnaliser, publier, héberger et administrer des sites et expériences numériques. Le produit visé associe un éditeur visuel progressif, un format de document versionné, un moteur de rendu commun, une génération et une modification assistées par IA, des templates extensibles et une chaîne de publication multi-tenant sécurisée.

Ce dossier est un cahier des charges technique et fonctionnel destiné à la revue produit, à l'estimation, aux prototypes et au développement. Il ne constitue ni une démonstration de faisabilité, ni un engagement commercial, ni une preuve de charge. Les éléments marqués **CIBLE** sont des seuils à tester. Les versions de dépendances relevées dans l'audit sont des observations datées, pas des compatibilités certifiées.

## 2. Constat de départ

**VÉRIFIÉ —** Le dépôt `Ima-Dev0049/WOOB`, à la révision inspectée, ne contient qu'un `README.md` portant le titre `# WOOB`. Il n'existe aucun code applicatif, schéma, test, manifeste de dépendances, pipeline ou architecture à préserver. Il n'y a donc pas de migration d'un système existant à planifier. L'historique Git et le fichier existant sont conservés.

**Conséquence —** les choix proposés constituent une architecture de départ. Ils doivent être confirmés par des ADR, des prototypes mesurés et les critères de sortie de la phase 0 avant de devenir des engagements d'implémentation.

## 3. Ambition et périmètre réel

Le cœur de WOOBET n'est pas une collection figée de modèles. C'est un système de composition régi par :

- un schéma de document stable et migrable ;
- un registre de composants typés et versionnés ;
- des design tokens, thèmes, variantes et règles responsive ;
- des contraintes de composition et une validation automatique ;
- des templates complets, de pages, de sections et des kits de marque ;
- un rendu public distinct du document et des outils d'édition ;
- des extensions métier disposant d'API explicites.

Un site vitrine, un blog, une boutique, une plateforme de réservation, un LMS ou une marketplace ne sont pas des variations équivalentes d'un même template. Les derniers exigent des données, transactions, permissions, workflows, intégrations et obligations réglementaires propres. La V1 publique proposée couvre le socle de création et de publication, les médias, les formulaires simples et les fondations de collections/extensions. Le e-commerce transactionnel, les réservations à disponibilité réelle, la formation avec progression et les marketplaces restent des modules à valider séparément.

## 4. Décisions structurantes recommandées

| Sujet | Recommandation | Motif principal | Condition de révision |
|---|---|---|---|
| Organisation | Monorepo TypeScript, monolithe backend modulaire | Réduire les coûts de coordination tout en traçant les frontières | Charge ou cycle de vie autonome démontré |
| Expériences | `studio`, `api`, `worker` et `site-renderer` dans un même dépôt | Isoler les visiteurs publics des outils de gestion sans microservices prématurés | Besoin de déploiement indépendant mesuré |
| Frontend | React + Next.js, avec prototypes de compatibilité | SSR/streaming, écosystème React et routage | Fidélité de rendu ou coût opérationnel insuffisant |
| Backend | NestJS, adaptateur HTTP retenu après benchmark | Modules, injection et contrats testables | Complexité non compensée ou performances insuffisantes |
| Données | PostgreSQL, migrations SQL revues, accès typé ; Drizzle recommandé sous réserve du spike | Transactions, contraintes, JSONB et RLS | Limites démontrées sur les requêtes ou migrations |
| Document | JSON versionné, JSON Schema + types TypeScript dérivés/contrôlés | Validation commune à l'IA, à l'éditeur et à la publication | Contraintes non exprimables ou coût de validation excessif |
| Édition | Commandes transactionnelles sur document ; DOM jamais source de vérité | Annulation, historique, tests et collaboration future | Prototype ne satisfaisant pas les budgets d'interaction |
| Glisser-déposer | Spike `dnd-kit` contre Pragmatic DnD et solution native | Accessibilité et contrôle sans surspécifier un framework | Résultats du prototype multi-appareils |
| IA | Ports fournisseurs, sorties structurées, validation et patchs limités | Éviter l'exécution de code et la dépendance irréversible | Qualité/coût/latence mesurés insuffisants |
| Publication | Bundles immuables + activation atomique d'un pointeur | Aucun site partiellement publié ; rollback rapide | Volume ou latence exigeant une autre stratégie |
| Rendu | SSR/rendu à la demande avec cache CDN au départ ; SSG sélectif ultérieur | Éviter une file de builds pour chaque petit site | Mesures de cache, coût et fraîcheur |
| Asynchrone | Redis + BullMQ pour tâches retryables, états durables en PostgreSQL | Domaines, médias, IA et publication ne sont pas synchrones | File devenue goulot ou besoins de file managée |
| Médias | Objet S3-compatible, origines immuables et variantes | Ne pas stocker les binaires dans PostgreSQL | Besoins de transformations ou de souveraineté |
| Authentification | Sessions opaques, cookies sécurisés, mots de passe Argon2id ; OAuth/OIDC validé par spike | Contrôle des sessions et des tenants sans confier l'autorisation au frontend | Exigences SSO/MFA ou coût d'exploitation |
| Facturation | Stripe Billing derrière un module interne d'entitlements | Webhooks idempotents et indépendance des quotas | Couverture pays/moyens de paiement insuffisante |

Ces lignes sont des recommandations de conception ; elles ne signifient pas que les produits sont déjà provisionnés. Les détails et alternatives figurent dans les ADR (document 24).

## 5. Architecture fonctionnelle en une vue

1. L'utilisateur rejoint un **workspace**, crée un **project** et part d'un brief, d'un template ou d'une page vide.
2. L'IA éventuelle produit un plan puis un document candidat. Celui-ci est validé contre le schéma et le registre ; aucun code arbitraire n'est exécuté.
3. L'éditeur transforme le brouillon uniquement par des commandes validées. Chaque sauvegarde utilise une révision optimiste ; les checkpoints sont immuables.
4. La publication fige les pages, le thème, les routes, les locales et les références médias dans un bundle vérifiable. Un manifeste et des checksums relient les artefacts.
5. Le routeur public résout un `Host` normalisé vers un domaine actif, puis vers la publication active. Le renderer ne reçoit que le document public et les capacités autorisées.
6. Les caches sont invalidés par identifiant de publication ; l'ancien bundle reste disponible pour un rollback.
7. Les événements d'audit, métriques, traces et usages alimentent l'exploitation sans enregistrer de secrets ou de contenus sensibles inutiles.

## 6. Résultats attendus de la V1 publique

**Inclus, sous réserve des gates :** comptes et workspaces ; RBAC ; création de pages et navigation ; éditeur simple puis avancé essentiel ; responsive desktop/tablette/mobile ; bibliothèque initiale de composants ; thèmes et tokens ; templates ; médias ; autosave, versions et rollback ; génération IA et modifications ciblées ; publication sur sous-domaine ; domaines personnalisés et TLS ; SEO technique ; i18n du socle ; formulaires simples ; facturation et entitlements ; observabilité et sécurité ; documentation d'exploitation.

**Explicitement hors promesse V1 :** collaboration temps réel multi-utilisateur ; marketplace de templates ; scripts utilisateurs arbitraires ; marketplace multi-vendeurs ; e-commerce complet ; LMS complet ; réservation transactionnelle complète ; haute disponibilité multi-région active-active ; objectifs de millions de sites non testés.

## 7. Exigences non fonctionnelles majeures

Les cibles initiales comprennent notamment : isolation de chaque requête par workspace et RLS en défense en profondeur ; publication atomique ; p95 des interactions courantes de l'éditeur inférieur à 100 ms sur le matériel de référence ; autosave accusé sous 2 s au p95 hors dégradation réseau ; rendu public sans bundle d'édition ; Core Web Vitals mesurés sur un corpus représentatif ; sauvegardes testées ; RPO cible ≤ 15 min et RTO cible ≤ 4 h pour le service de gestion initial ; journal d'audit des opérations sensibles. Ces valeurs sont des budgets de conception, non des résultats observés.

## 8. Coûts, capacité et économie

Aucun prix commercial n'est fixé. Le modèle distingue les revenus récurrents des coûts variables : tokens IA, calcul de rendu, bande passante, stockage, transformations d'images, emails, certificats, observabilité et support. Chaque plan déclare des **entitlements** et des quotas techniques versionnés. Les compteurs d'usage et les budgets IA doivent précéder l'ouverture commerciale.

La capacité n'est jamais déduite du seul nombre de lignes de schéma. Elle sera établie par des tests de charge avec des distributions de sites, trafic, documents, caches et tâches. Le document 32 fournit les formules de coût unitaire et les scénarios à renseigner avec des devis datés.

## 9. Risques dominants

- complexité de l'éditeur et fidélité aperçu/publication ;
- qualité visuelle et sémantique variable des générations IA ;
- fuite inter-tenant ou exposition de contenu non publié ;
- abus, coûts IA et épuisement des files ;
- erreurs DNS, certificats et domaines malveillants ;
- migrations du schéma de pages et compatibilité des templates ;
- périmètre métier trop vaste avant validation du moteur ;
- dépendances fournisseurs et incertitude des coûts.

Les mitigations comprennent des prototypes éliminatoires, des corpora de tests, des bundles immuables, une autorisation serveur systématique, RLS, quotas, limites de tâches, machine à états DNS, canary, rollback et réduction explicite du scope V1.

## 10. Pilotage et prochaine étape

Le chemin critique est : décisions → fondation → identité/tenants → schéma/renderer → éditeur → versions → publication → domaines/hébergement → durcissement → bêta. L'IA, les templates et l'i18n peuvent être prototypés en parallèle mais ne contournent aucun gate de sécurité ou de publication.

Les cinq premières tâches sont `P00-T01` (gel du périmètre et des hypothèses), `P00-T02` (spikes d'édition/rendu), `P00-T03` (preuve de publication et DNS), `P01-T01` (monorepo et toolchain), puis `P01-T02` (CI et quality gates). Leur ordre exact respecte les dépendances du backlog : les spikes peuvent utiliser des prototypes jetables mais ne doivent pas devenir implicitement le socle.

La mission suivante consiste à faire approuver les ADR et décisions ouvertes, exécuter les prototypes de phase 0, mettre à jour les estimations, puis démarrer la phase 1. La procédure reproductible de revue et de génération du PDF est décrite dans `README.md` et `33_DELIVERY_REPORT.md`.
