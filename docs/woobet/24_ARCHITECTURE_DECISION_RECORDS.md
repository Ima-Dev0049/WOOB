# 24 — Architecture Decision Records

## Convention

Statuts : **proposé** tant que le spike/gate n'est pas terminé ; **accepté** après revue ; **remplacé** par un nouvel ADR. Les décisions ci-dessous sont proposées pour le dépôt vierge. Elles ne décrivent pas une implémentation existante.

## ADR-001 — Monolithe modulaire plutôt que microservices

**Contexte/problème :** petite équipe initiale, nombreux modules couplés par transactions, besoin d'évolution sans complexité distribuée.
**Options :** microservices dès le départ ; monolithe sans frontières ; monolithe modulaire avec points d'entrée séparés.
**Décision :** monolithe backend modulaire, Studio/API/worker/renderer dans un monorepo.
**Raisons :** transactions locales, déploiement simple, refactorisation et observabilité plus faciles ; séparation publique conservée.
**Conséquences :** releases coordonnées, discipline de modules et risque de monolithe touffu ; CI de dépendances nécessaire.
**Risques :** scaling couplé et cycles cachés.
**Révision :** extraire seulement avec métrique de charge, disponibilité ou autonomie et contrat stable.

## ADR-002 — Next.js avec API NestJS séparée

**Contexte :** besoin SSR et React, API publique et jobs, contrats indépendants.
**Options :** Next full-stack seul ; SPA + Fastify/Nest ; Next Studio/renderer + Nest API ; autre framework SSR.
**Décision :** Next.js pour les deux frontends, NestJS pour API et workers, après spike de versions et d'adaptateur.
**Raisons :** rendu public optimisé, modules backend et séparation des responsabilités.
**Conséquences :** deux frameworks et plusieurs runtimes ; coût de formation et compatibilité à gérer.
**Risques :** complexité de cache Next, surarchitecture pour petit périmètre.
**Révision :** si les spikes montrent qu'un Next full-stack suffit sans compromettre frontières, ou que Nest n'apporte pas de valeur mesurable.

## ADR-003 — PostgreSQL et accès SQL explicite

**Contexte :** relations fortes, JSON de documents, RBAC/RLS, publication atomique et rapprochements financiers.
**Options :** PostgreSQL + Drizzle ; PostgreSQL + Prisma ; Kysely ; NoSQL hybride.
**Décision :** PostgreSQL ; Drizzle recommandé sous réserve du spike, migrations SQL revues.
**Raisons :** transactions, contraintes composites, JSONB et écosystème managé ; contrôle SQL pour RLS et requêtes critiques.
**Conséquences :** schéma et migrations à administrer ; mapping manuel plus visible ; JSON nécessite discipline.
**Risques :** RLS/pool mal configuré ; version de Prisma CLI/client observée non alignée sur le tag latest, ce qui impose de ne pas choisir par automatisme.
**Révision :** choisir Prisma/Kysely si productivité et fonctionnalités mesurées sont supérieures ; ajouter un store analytique si PostgreSQL ne convient plus aux événements.

## ADR-004 — JSON versionné comme format de page

**Contexte :** contrat commun IA/éditeur/templates/renderer et besoin de migration.
**Options :** HTML canonique ; AST propriétaire binaire ; JSON + JSON Schema ; AST d'un éditeur tiers.
**Décision :** JSON documenté, JSON Schema et types TS, migrations pures.
**Raisons :** portable, inspectable, validable et indépendant du DOM.
**Conséquences :** taille et coût de validation ; schéma à gouverner.
**Risques :** surenchère de genericité, migrations nombreuses.
**Révision :** si des contraintes ne sont pas exprimables ou si un standard existant couvre mieux les besoins avec export non destructif.

## ADR-005 — Renderer partagé, bundles publics séparés

**Contexte :** fidélité aperçu/publication et absence d'outillage chez les visiteurs.
**Options :** deux renderers indépendants ; canvas DOM copié en HTML ; `renderer-core` commun avec adaptateurs édition/public.
**Décision :** projection commune, packages publics/editor séparés, publication de documents immuables.
**Raisons :** même sémantique sans envoyer le Studio.
**Conséquences :** adaptateurs et tests de fidélité nécessaires.
**Risques :** différences CSS/navigateur et anciennes versions de renderer.
**Révision :** si le coût de compatibilité dépasse celui de artefacts HTML/statiques pour certains sites.

## ADR-006 — Éditeur par commandes, DnD après spike

**Contexte :** undo/redo, IA ciblée, historique, responsive et collaboration future.
**Options :** mutations DOM ; framework d'éditeur complet ; commandes sur document + DnD spécialisé.
**Décision :** commandes transactionnelles ; premier candidat `dnd-kit`, comparé à Pragmatic DnD et framework tiers ; iframe de preview à prototyper.
**Raisons :** invariants et testabilité ; éviter lock-in avant preuves.
**Conséquences :** développement spécifique important ; pont iframe complexe.
**Risques :** fluidité, accessibilité, sélection et texte riche.
**Révision :** choisir un framework existant s'il démontre fidélité, export, migration et coût total inférieur.

## ADR-007 — IA orchestrée par étapes et sorties structurées

**Contexte :** qualité variable, coût et fournisseurs changeants.
**Options :** appel monomodèle unique ; multi-agents ; pipeline plan/génération/validation/réparation.
**Décision :** pipeline déterministe avec port provider, un provider initial et secondaire évalué ; pas de code exécuté.
**Raisons :** contrôle de portée, reprise, métriques et remplacement.
**Conséquences :** plusieurs appels et latence ; prompts/schémas versionnés.
**Risques :** coût des réparations et fausse confiance dans JSON valide.
**Révision :** ajouter multi-modèles/agents seulement avec gain sur corpus aveugle et coût accepté.

## ADR-008 — Publication atomique par bundles immuables

**Contexte :** éviter les versions partielles et permettre rollback.
**Options :** mise à jour en place ; build direct sur le site actif ; préparation immutable + pointeur atomique.
**Décision :** manifeste/artefacts sous nouvel ID, puis pointer table transactionnelle.
**Raisons :** cohérence et audit, reprise après crash.
**Conséquences :** stockage de versions et lifecycle ; routage par manifeste.
**Risques :** cache ancien, sonde et flapping.
**Révision :** conserver le principe même si la technologie de stockage/rendu change.

## ADR-009 — SSR avec cache avant SSG massif

**Contexte :** beaucoup de sites/pages/locales et trafic inconnu.
**Options :** SSG complet ; SSR à la demande ; ISR ; CSR.
**Décision :** SSR + CDN par défaut, SSG sélectif après mesure.
**Raisons :** éviter files de builds et stockage systématiques ; routes dynamiques possibles.
**Conséquences :** origine à scaler et protéger ; cache complexe.
**Risques :** cold cache, coût compute et stale content.
**Révision :** SSG pour segments stables/fort trafic ; ISR si atomicité démontrée.

## ADR-010 — Infrastructure hybride managée

**Contexte :** équipe limitée et exigences edge/DB/objet.
**Options :** Kubernetes ; VMs ; PaaS/serverless ; conteneurs + services managés + CDN.
**Décision :** hybride dans une région primaire, conteneurs stateless et PostgreSQL/Redis/objet managés.
**Raisons :** réduire l'ops tout en gardant portabilité des applications.
**Conséquences :** dépendances et coûts variables ; pas de multi-région initial.
**Risques :** lock-in edge/custom domains, egress.
**Révision :** si coût ou souveraineté justifie auto-hébergement, ou si PaaS couvre toutes les preuves à moindre coût.

## ADR-011 — DNS/TLS via provider managé à évaluer

**Contexte :** domaines custom, vérification et renouvellements à grande échelle.
**Options :** custom hostnames CDN ; ACME interne/Caddy ; certificats importés.
**Décision :** préférer une offre managée si elle passe les tests ; conserver machine à états et adaptateur internes.
**Raisons :** réduire la complexité ACME et edge.
**Conséquences :** coût par domaine et dépendance API ; aucune cible DNS inventée.
**Risques :** limites, délai, migration et détournement.
**Révision :** internaliser si économie/contrôle le justifient avec expertise et rate limits maîtrisés.

## ADR-012 — Stockage objet S3-compatible et variantes

**Contexte :** médias et bundles volumineux, URLs pérennes.
**Options :** PostgreSQL blobs ; disque local ; objet S3 + CDN ; service média complet.
**Décision :** objet S3-compatible, DB pour métadonnées, CDN pour copies publiques.
**Raisons :** durabilité, cycle de vie et scaling.
**Conséquences :** cohérence DB/objet à gérer et transformations à construire.
**Risques :** orphelins, fuites d'objets privés, coût d'egress.
**Révision :** service média managé si coût total et fonctionnalités meilleurs ; jamais de liens temporaires dans le public.

## ADR-013 — Sessions opaques et autorisation interne

**Contexte :** multi-workspace, révocation et cookies sécurisés.
**Options :** Auth.js/managé ; JWT stateless ; sessions opaques maison avec bibliothèques éprouvées ; provider d'identité complet.
**Décision :** sessions opaques persistées, Argon2id et OIDC via bibliothèque validée ; autorisations WOOBET internes.
**Raisons :** révocation simple et contrôle du modèle tenant.
**Conséquences :** responsabilité de sécurité et stockage de session ; OAuth à intégrer.
**Risques :** erreurs d'implémentation d'identité.
**Révision :** provider managé si coût/risque et exigences SSO/MFA favorables ; ne jamais écrire de cryptographie maison.

## ADR-014 — Facturation derrière un port et entitlements locaux

**Contexte :** plans multiples, coûts variables et webhooks.
**Options :** logique Stripe directe dans chaque module ; provider unique sans abstraction ; module Billing + Entitlements interne.
**Décision :** Stripe premier candidat derrière port ; droits locaux calculés et audités.
**Raisons :** cohérence des quotas et possibilité de changer de PSP.
**Conséquences :** rapprochement et mapping nécessaires ; abstraction ne rend pas la migration gratuite.
**Risques :** webhooks perdus/désordonnés et fiscalité.
**Révision :** Merchant of Record/provider régional si couverture ou conformité supérieure.

## ADR-015 — Redis/BullMQ avec outbox PostgreSQL

**Contexte :** tâches IA, domaines, médias et publication.
**Options :** jobs SQL ; BullMQ ; file managée ; Kafka.
**Décision :** BullMQ/Redis pour distribution, outbox DB pour durabilité des intentions et idempotence.
**Raisons :** adapté Node, retries/priorités, faible complexité initiale.
**Conséquences :** exploitation Redis et DLQ ; reconstruction nécessaire.
**Risques :** perte Redis, doubles effets et files encombrées.
**Révision :** jobs SQL si volume faible et simplicité meilleure ; file managée/streaming si charge et garanties changent.

## ADR-016 — Versionnement et pins après matrice de compatibilité

**Contexte :** versions `latest` observées le 2026-10-23, certaines tags de prerelease.
**Options :** prendre latest ; reprendre des versions de mémoire ; interroger, choisir une matrice stable et verrouiller.
**Décision :** créer en phase 0/1 une matrice de compatibilité, lire les guides officiels, tester puis fixer lockfile et politique de support.
**Raisons :** reproductibilité et sécurité ; les versions seules ne prouvent pas la compatibilité.
**Conséquences :** effort initial de validation et mises à jour planifiées.
**Risques :** retard de correctifs si pins trop anciens.
**Révision :** à chaque release majeure ou advisory, avec tests et ADR si rupture d'architecture.
