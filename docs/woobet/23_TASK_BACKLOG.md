# 23 — Backlog de tâches

## Mode d'emploi

Chaque tâche indique priorité (`P0` critique, `P1` V1, `P2` ultérieur), complexité (`S/M/L/XL`), dépendances, modules/fichiers cibles, critères, tests, risque et validation. Les chemins sont des cibles de conception, pas des fichiers existants. Toute tâche `L/XL` doit être redécoupée en PR révisables sans changer les invariants. La définition de prêt du document 19 s'applique à toutes.

## PHASE 0 — Audit, spécifications et décisions

### P00-T01 — Valider le périmètre, les hypothèses et les ADR — `P0`, `M`
- **Objet / modules :** revue produit de `docs/woobet/`, scope V1, coûts, langues, domaines et décisions ouvertes ; produire une baseline signée.
- **Dépendances :** dossier initial ; sponsor produit, architecture, design et ops disponibles.
- **Acceptation / tests :** chaque décision bloquante a statut/propriétaire ; aucune contradiction entre scope, roadmap et budget ; revue formelle consignée.
- **Risque / validation :** surpérimètre (R-01/R-16) ; validation par procès-verbal de gate P0 et ADR approuvés ou prototypes commandés.

### P00-T02 — Prototyper canvas, DnD et fidélité du renderer — `P0`, `L`
- **Objet / modules :** prototypes jetables `spikes/editor-renderer/`, comparaison dnd-kit/Pragmatic/framework, iframe, commandes, D1/D2.
- **Dépendances :** P00-T01 pour critères ; aucune fondation de production requise.
- **Acceptation / tests :** sélection, nested drag, clavier, texte, responsive, undo, CSS et captures public/preview ; profils et résultats publiés.
- **Risque / validation :** R-02/R-03 ; validation par rapport de benchmark et ADR-005/006 mis à jour, pas par démonstration subjective seule.

### P00-T03 — Prouver publication atomique et cycle DNS/TLS — `P0`, `L`
- **Objet / modules :** `spikes/publishing-dns/`, stockage immutable, pointeur transactionnel, zone DNS de test, provider edge et certificats.
- **Dépendances :** P00-T01 ; comptes sandbox et zone réellement contrôlée.
- **Acceptation / tests :** kill avant/après activation, rollback, Host inconnu, TXT, DNS incorrect/corrigé, TLS et renouvellement simulé sans affecter de production.
- **Risque / validation :** R-09/R-10/R-11/R-12 ; validation par logs, états, coûts/limites datés et ADR-008/010/011.

## PHASE 1 — Fondation du dépôt et qualité

### P01-T01 — Initialiser le monorepo et verrouiller la toolchain — `P0`, `M`
- **Objet / modules :** manifestes workspace, `apps/`, `packages/`, TypeScript strict, gestionnaire de paquets, lockfile et matrice de versions.
- **Dépendances :** P00-T01 ; versions datées de `30_REPOSITORY_AUDIT.md`.
- **Acceptation / tests :** installation propre reproductible, build d'un shell par application, licences et compatibilité documentées ; aucune implémentation métier prématurée.
- **Risque / validation :** incompatibilités majeures ; validation sur environnement neuf et CI avec cache vidé.

### P01-T02 — Créer la CI et les quality gates — `P0`, `M`
- **Objet / modules :** `.github/workflows/`, format, lint, types, tests, builds, scans secrets/dépendances, artefacts et protections de branche.
- **Dépendances :** P01-T01.
- **Acceptation / tests :** une régression volontaire bloque la PR ; aucun secret dans logs ; rapports et statuts requis visibles.
- **Risque / validation :** CI lente ou contournable ; validation par PR de test et revue des permissions du workflow.

### P01-T03 — Fournir les environnements locaux et d'intégration — `P0`, `M`
- **Objet / modules :** `docker/`, `compose`, configuration validée, PostgreSQL/Redis/S3 éphémères, seeds synthétiques et scripts de reset non production.
- **Dépendances :** P01-T01.
- **Acceptation / tests :** démarrage documenté sur environnement neuf ; tests DB réels ; reset impossible contre production par garde de configuration.
- **Risque / validation :** faux environnement peu représentatif ; validation par test d'intégration et revue des versions managées cibles.

### P01-T04 — Poser conventions de modules et observabilité de base — `P1`, `M`
- **Objet / modules :** `packages/config`, `api-contracts`, logger JSON, request ID, erreurs communes, limites d'imports et CODEOWNERS.
- **Dépendances :** P01-T01/T02.
- **Acceptation / tests :** import interdit et log sensible de test bloqués ; erreurs suivent le contrat ; documentation de contribution créée.
- **Risque / validation :** bureaucratie prématurée ; validation par revue développeur et mesure du temps de premier build.

## PHASE 2 — Authentification, utilisateurs et workspaces

### P02-T01 — Implémenter inscription, vérification et récupération — `P0`, `L`
- **Objet / modules :** `identity`, tables users/identities/sessions, emails transactionnels et jetons hashés.
- **Dépendances :** P01-T01–T04 ; provider email sandbox.
- **Acceptation / tests :** anti-énumération, expiration/rejeu, rotation et révocation ; tests de cookies/CSRF et Argon2id calibré.
- **Risque / validation :** prise de compte ; validation par revue sécurité et scénarios AC-IAM.

### P02-T02 — Implémenter sessions et OAuth/OIDC validé — `P1`, `L`
- **Objet / modules :** `identity`, endpoints session/logout, provider OIDC choisi et liaison de compte.
- **Dépendances :** P02-T01 ; documentation officielle du provider.
- **Acceptation / tests :** state/nonce/PKCE selon protocole, collisions d'email, logout global ; aucun token en stockage local/log.
- **Risque / validation :** liaison au mauvais compte ; validation par matrice de fournisseurs et tests de callback.

### P02-T03 — Implémenter workspaces, memberships et invitations — `P0`, `L`
- **Objet / modules :** `tenancy`, tables et endpoints, transaction dernier owner, RLS et contexte tenant.
- **Dépendances :** P02-T01 ; P01-T03.
- **Acceptation / tests :** rôles et invitations, expiration/révocation, isolation deux tenants et absence de contexte RLS.
- **Risque / validation :** IDOR/élévation ; validation par matrice RBAC automatisée et revue des requêtes.

### P02-T04 — Ajouter audit et administration minimale des accès — `P0`, `M`
- **Objet / modules :** `audit`, endpoints de sessions/membres, console support sans accès contenu.
- **Dépendances :** P02-T03.
- **Acceptation / tests :** rôles, sessions et invitations produisent des événements append-only sans secret ; accès support audité.
- **Risque / validation :** audit contournable ou trop verbeux ; validation par tentative d'update/delete refusée et inspection des données.

## PHASE 3 — Schéma de pages et moteur de rendu

### P03-T01 — Formaliser PageDocument et le validateur — `P0`, `L`
- **Objet / modules :** `packages/page-schema`, JSON Schema, types, erreurs, limites et fixtures D0–D3.
- **Dépendances :** P01-T01/T02 ; P00-T02 pour besoins du canvas.
- **Acceptation / tests :** exemples valides/invalides, fuzz, profondeur/taille/IDs/références ; aucune entrée exécutable.
- **Risque / validation :** schéma trop générique ; validation par revue frontend/IA/backend et tests de propriétés.

### P03-T02 — Créer registre et composants primitifs — `P0`, `L`
- **Objet / modules :** `component-registry`, `components-public`, page/section/container/text/heading/button/image.
- **Dépendances :** P03-T01.
- **Acceptation / tests :** contrat complet par composant, variantes, clavier, contenu vide/long/invalide et responsive ; bundles mesurés.
- **Risque / validation :** divergences de rendu ; validation par corpus visuel et revue accessibilité.

### P03-T03 — Implémenter migrations et compatibilité — `P0`, `L`
- **Objet / modules :** `page-schema/migrations`, golden files, rapports et politique de versions.
- **Dépendances :** P03-T01.
- **Acceptation / tests :** migration déterministe sans réseau, original intact, non-perte et rollback de code sur fenêtre définie.
- **Risque / validation :** R-14 ; validation par corpus de versions et test d'une migration volontairement impossible.

### P03-T04 — Construire projection et renderer public minimal — `P0`, `L`
- **Objet / modules :** `renderer-core`, `apps/site-renderer`, preview isolée et métadonnées.
- **Dépendances :** P03-T02 ; P02-T03 pour accès preview.
- **Acceptation / tests :** même projection preview/public, aucun champ interne/bundle éditeur, erreurs isolées et noindex preview.
- **Risque / validation :** R-03/R-07 ; validation par analyse des bundles, captures et tests Host/accès.

### P03-T05 — Persister projets, settings et brouillons — `P0`, `L`
- **Objet / modules :** `projects`, tables projects/settings/pages, API CRUD et révisions.
- **Dépendances :** P02-T03 ; P03-T01.
- **Acceptation / tests :** CRUD scopé, chemins et limites, optimistic locking, FK composites et pagination.
- **Risque / validation :** fuite/corruption ; validation par intégration PostgreSQL et concurrence.

## PHASE 4 — Éditeur visuel simple

### P04-T01 — Construire store, commandes et historique — `P0`, `L`
- **Objet / modules :** `features/editor`, commandes insert/move/remove/update/duplicate et undo/redo.
- **Dépendances :** P03-T01/T05 ; P00-T02.
- **Acceptation / tests :** invariants, IDs stables, composites atomiques, piles redo et property tests.
- **Risque / validation :** perte/corruption ; validation par séquences aléatoires et comparaison à un modèle.

### P04-T02 — Intégrer canvas et sélection simple — `P0`, `L`
- **Objet / modules :** canvas/iframe, bridge typé, overlays et contenu/boutons/images.
- **Dépendances :** P03-T04 ; P04-T01.
- **Acceptation / tests :** édition de texte et remplacement média factice puis réel, focus, aucune injection, budgets D1.
- **Risque / validation :** sécurité du postMessage et fidélité ; validation multi-navigateurs et revue d'origine.

### P04-T03 — Ajouter insertion et déplacement accessible — `P0`, `L`
- **Objet / modules :** bibliothèque simple, DnD retenu, drop targets logiques et alternative clavier.
- **Dépendances :** P04-T01/T02.
- **Acceptation / tests :** 100 scénarios de slots/nesting, tactile selon scope, cible interdite expliquée et undo.
- **Risque / validation :** R-02 ; validation par taux de précision et tests utilisateurs/clavier.

### P04-T04 — Implémenter autosave initial et états UX — `P0`, `L`
- **Objet / modules :** synchronisation éditeur, API revisionnée, offline/error/saving/saved et reprise locale.
- **Dépendances :** P03-T05 ; P04-T01.
- **Acceptation / tests :** debounce, ordre des commandes, kill réseau/navigateur, aucun faux saved, conflit détecté.
- **Risque / validation :** R-22 ; validation par tests de coupure et inspection des révisions.

## PHASE 5 — Éditeur avancé et responsive

### P05-T01 — Ajouter arborescence et inspecteur avancé — `P1`, `L`
- **Objet / modules :** layers virtualisés, propriétés grid/flex/dimensions/espacements et héritage.
- **Dépendances :** P04-T02/T03.
- **Acceptation / tests :** sélection hiérarchique, reset d'override, champs typés et performance D2.
- **Risque / validation :** surcharge UX ; validation par tests designer et accessibilité tree.

### P05-T02 — Implémenter breakpoints et styles adaptatifs — `P1`, `L`
- **Objet / modules :** tokens, overrides, règles automatiques et viewports.
- **Dépendances :** P03-T02 ; P05-T01.
- **Acceptation / tests :** base/héritage/override distingués, largeurs intermédiaires, reset et corpus responsive.
- **Risque / validation :** cascade imprévisible ; validation par résolution de style déterministe et captures.

### P05-T03 — Ajouter états, animations et interactions déclaratives — `P1`, `L`
- **Objet / modules :** registry interactions, hover/focus/disabled, transitions et reduced motion.
- **Dépendances :** P04-T01 ; P05-T02.
- **Acceptation / tests :** aucune chaîne de code, clavier, reduced motion, actions limitées par capacités.
- **Risque / validation :** XSS/performance ; validation par payloads hostiles et profiling.

### P05-T04 — Résoudre conflits multi-onglets et gros documents — `P1`, `L`
- **Objet / modules :** BroadcastChannel, diff/rebase contrôlé, virtualisation et validation incrémentale.
- **Dépendances :** P04-T04 ; P05-T01.
- **Acceptation / tests :** deux onglets/acteurs, duplication/rebase sans écrasement, D2/D3 et soak 4 h.
- **Risque / validation :** perte/mémoire ; validation par scénarios de concurrence et heap snapshots.

## PHASE 6 — Templates et composants

### P06-T01 — Étendre tokens, variantes et kits de marque — `P1`, `L`
- **Objet / modules :** `design-tokens`, thèmes, résolution sémantique et contrôle de contraste.
- **Dépendances :** P03-T02 ; P05-T02 pour UI complète.
- **Acceptation / tests :** thèmes visuellement distincts, changements globaux contrôlés, migrations et licences de polices.
- **Risque / validation :** combinaisons incohérentes ; validation par règles de compatibilité et revue design.

### P06-T02 — Créer catalogue de composants V1 — `P1`, `XL`
- **Objet / modules :** navigation, grilles, cartes, galeries, formulaires visuels, FAQ, tarifs, témoignages et données simples.
- **Dépendances :** P03-T02 ; P06-T01.
- **Acceptation / tests :** contrat et matrice de tests pour chaque item ; capabilities métier explicites ; budget public.
- **Risque / validation :** quantité au détriment qualité ; validation par gates par famille, sans déclarer les modules métier actifs.

### P06-T03 — Implémenter templates versionnés et import/export — `P1`, `L`
- **Objet / modules :** `templates`, manifests, stockage, instanciation, diff et bibliothèques privées.
- **Dépendances :** P03-T03 ; P06-T02 ; media de base.
- **Acceptation / tests :** checksum, dépendances, licences, aucun secret, import invalide sans écriture et migration non destructive.
- **Risque / validation :** contenu malveillant/incompatible ; validation par archives adversariales et isolation tenant.

## PHASE 7 — Versions et récupération

### P07-T01 — Créer checkpoints et rétention — `P0`, `L`
- **Objet / modules :** `page_versions`, snapshots objet/DB, checkpoints pré-IA/template et lifecycle.
- **Dépendances :** P03-T05 ; P04-T04.
- **Acceptation / tests :** immutabilité, checksums, numérotation concurrente, rétention et versions référencées protégées.
- **Risque / validation :** croissance de stockage/perte ; validation par charge et purge de test.

### P07-T02 — Implémenter diff et restauration — `P1`, `L`
- **Objet / modules :** diff structurel, UI de comparaison et restauration comme nouvelle révision.
- **Dépendances :** P07-T01 ; P05-T04.
- **Acceptation / tests :** diff texte/style/structure/assets, restauration sans modifier publication active ni historique.
- **Risque / validation :** diff trompeur ; validation par golden diffs et test utilisateur.

### P07-T03 — Durcir reprise après interruption — `P0`, `L`
- **Objet / modules :** journal local borné, récupération, réconciliation et centre d'erreurs.
- **Dépendances :** P04-T04 ; P07-T01.
- **Acceptation / tests :** crash à chaque étape, stockage local indisponible, nouvelle révision externe ; aucune reprise silencieuse obsolète.
- **Risque / validation :** R-22 et données locales sensibles ; validation par revue de menace et coupures.

## PHASE 8 — Génération IA

### P08-T01 — Implémenter port provider, prompts et journaux d'usage — `P0`, `L`
- **Objet / modules :** `ai`, adaptateurs, configuration de modèles, secrets, timeout et `ai_usage_records`.
- **Dépendances :** P01-T04 ; P02-T03 ; documentation provider vérifiée.
- **Acceptation / tests :** contrats avec doubles et sandbox, erreurs/latences/usages, aucun prompt sensible dans logs.
- **Risque / validation :** capacités API supposées ; validation par tests de contrat datés et revue confidentialité.

### P08-T02 — Construire planificateur et génération structurée — `P1`, `XL`
- **Objet / modules :** SitePlan, pipeline, sélection de composants, artefacts et états de génération.
- **Dépendances :** P03-T01/T02 ; P08-T01.
- **Acceptation / tests :** brief restaurant, plan modifiable, documents valides, modules manquants signalés et reprise d'étape.
- **Risque / validation :** R-05/R-13 ; validation par corpus séparé et rapport de qualité.

### P08-T03 — Ajouter validation, réparation bornée et rendu de contrôle — `P0`, `L`
- **Objet / modules :** validateurs, réparation, assets/liens/responsive et scoring.
- **Dépendances :** P03-T03/T04 ; P08-T02.
- **Acceptation / tests :** sorties malformées/hostiles, budget de tentatives, aucun code exécuté, fallback sans modification.
- **Risque / validation :** réparation coûteuse ou invalide ; validation par fuzz et kill à chaque étape.

### P08-T04 — Implémenter budgets, quotas et évaluation IA — `P0`, `L`
- **Objet / modules :** réservation de crédits techniques, corpus, dashboards coût/latence/validité/acceptation.
- **Dépendances :** P08-T01–T03 ; observabilité de base.
- **Acceptation / tests :** concurrence sur dernier crédit, timeout avec coût, résultats versionnés et non-régression.
- **Risque / validation :** R-04 ; validation par scénario de budget et revue du coût par résultat accepté.

## PHASE 9 — Modification conversationnelle

### P09-T01 — Implémenter patchs IA à portée limitée — `P1`, `L`
- **Objet / modules :** réduction de contexte, patchs de commandes, `allowedOperations` et scope validator.
- **Dépendances :** P04-T01 ; P08-T02/T03.
- **Acceptation / tests :** style/texte/section/mobile, tout chemin hors scope rejeté et aucun privilège ajouté.
- **Risque / validation :** prompt injection/modification globale ; validation par corpus adversarial.

### P09-T02 — Ajouter diff, acceptation et annulation IA — `P1`, `L`
- **Objet / modules :** UI de diff, commande composite, checkpoint pré-IA et historique.
- **Dépendances :** P07-T01/T02 ; P09-T01.
- **Acceptation / tests :** aperçu avant application, undo exact, variante et retour arrière ; rien n'est publié automatiquement.
- **Risque / validation :** acceptation trompeuse ; validation par tests utilisateurs et snapshots de révision.

### P09-T03 — Gérer révisions obsolètes et reprise conversationnelle — `P1`, `L`
- **Objet / modules :** baseRevision, régénération du patch, états et idempotence.
- **Dépendances :** P05-T04 ; P09-T01.
- **Acceptation / tests :** document modifié pendant génération, retry/timeout, double clic ; aucun écrasement ni double application.
- **Risque / validation :** R-22/R-04 ; validation par concurrence et rapprochement des coûts.

## PHASE 10 — Publication et sous-domaines

### P10-T01 — Implémenter prévol et snapshots de publication — `P0`, `XL`
- **Objet / modules :** `publishing`, validations projet/routes/assets/locales/capacités et publication_pages.
- **Dépendances :** P03-T05 ; P07-T01 ; médias prêts.
- **Acceptation / tests :** snapshot cohérent malgré édition ultérieure, rapports bloquants/warnings et taille/checksums.
- **Risque / validation :** R-11 ; validation par concurrence et corpus incomplet.

### P10-T02 — Construire bundles et activation atomique — `P0`, `XL`
- **Objet / modules :** workers, stockage immutable, manifests, pointer table, outbox et rollback.
- **Dépendances :** P10-T01 ; P00-T03.
- **Acceptation / tests :** kill à chaque étape, deux publications concurrentes, ancienne version servie jusqu'à activation, rollback sans toucher brouillon.
- **Risque / validation :** publication partielle ; validation par tests d'intégration et checksums publics.

### P10-T03 — Implémenter slugs et routage par Host — `P0`, `L`
- **Objet / modules :** `domains`, réservation/normalisation/réservés, routeur, cache et suspension.
- **Dépendances :** P02-T03 ; P10-T02 ; domaine de test configuré.
- **Acceptation / tests :** collisions, IDN/homoglyphes, Host forgé/inconnu, changement/cooldown, aucun fallback inter-tenant.
- **Risque / validation :** R-26 ; validation par tests DNS/HTTP et cache.

### P10-T04 — Ajouter sondes, caches et centre de publications — `P1`, `L`
- **Objet / modules :** invalidation par version, health checks, UI états/erreurs et notifications.
- **Dépendances :** P10-T02/T03 ; observabilité.
- **Acceptation / tests :** cache froid/chaud, sonde en échec, anti-flapping, erreur actionnable et audit.
- **Risque / validation :** stale content/fausse confirmation ; validation par panne simulée et inspection HTTP.

### P10-T05 — Livrer SEO, sitemaps, redirections et 404 — `P1`, `L`
- **Objet / modules :** metadata renderer, robots/sitemap, redirects et migration d'URL.
- **Dépendances :** P10-T03 ; locales de base.
- **Acceptation / tests :** canoniques, hreflang si locales, boucles, noindex preview, 404 et changement de slug.
- **Risque / validation :** indexation privée/SEO cassé ; validation par corpus de liens et requêtes publiques.

## PHASE 11 — Domaines personnalisés et certificats

### P11-T01 — Implémenter vérification de propriété — `P0`, `L`
- **Objet / modules :** domain_verifications, challenges TXT, polling et UX des états.
- **Dépendances :** P10-T03 ; provider DNS sandbox.
- **Acceptation / tests :** TXT multiples, expiration, nouveau challenge, doublon global, preuve non rejouable sur autre domaine.
- **Risque / validation :** usurpation ; validation par zone de test et revue sécurité.

### P11-T02 — Implémenter validation DNS et racine/www — `P1`, `L`
- **Objet / modules :** contrôles CNAME/A/AAAA/ALIAS selon provider, conflits, canonique et redirections.
- **Dépendances :** P11-T01.
- **Acceptation / tests :** propagation lente, CNAME conflictuel, apex/www, IDN, aucune cible inventée en configuration.
- **Risque / validation :** R-09 ; validation par matrice de configurations réelles de test.

### P11-T03 — Intégrer provisionnement et renouvellement TLS — `P0`, `L`
- **Objet / modules :** `CertificateProvider`, états provisioning/error/active, inventory et alertes d'expiration.
- **Dépendances :** P00-T03 ; P11-T02.
- **Acceptation / tests :** émission, retry borné, renouvellement anticipé, certificat expiré et aucune clé privée en DB/log.
- **Risque / validation :** R-10 ; validation par sandbox et exercice de certificat expiré.

### P11-T04 — Gérer suspension, suppression et réattribution — `P0`, `L`
- **Objet / modules :** machine à états, déroutage, nettoyage provider, cooldown et abuse.
- **Dépendances :** P11-T01–T03.
- **Acceptation / tests :** suppression pendant provisioning, reprise après erreur, nouveau propriétaire sans ancien contenu, audit complet.
- **Risque / validation :** takeover/fuite ; validation par scénarios de cycle de vie et sondes externes.

## PHASE 12 — Hébergement et CDN

### P12-T01 — Durcir cache edge et isolation des origines — `P0`, `L`
- **Objet / modules :** CDN/WAF, clés de cache, assets immuables, cookies et règles preview/private.
- **Dépendances :** P10-T04 ; P11-T03 pour custom.
- **Acceptation / tests :** Host/query poisoning, réponses privées non partagées, purge par version et bundle Studio absent.
- **Risque / validation :** fuite cache/coût ; validation par tests HTTP et review de configuration.

### P12-T02 — Mettre en place IaC, sauvegardes et restauration — `P0`, `L`
- **Objet / modules :** `infra/`, comptes/environnements, PITR, versioning objet et runbooks.
- **Dépendances :** P01-T03 ; P00-T03 ; architecture provider.
- **Acceptation / tests :** environnement reproductible, restauration DB/objets/pointeurs mesurée, accès sauvegarde restreint.
- **Risque / validation :** R-21 ; validation par restore drill avec RPO/RTO consignés.

### P12-T03 — Benchmarker et dimensionner les services — `P1`, `L`
- **Objet / modules :** tests renderer/API/workers/DB/Redis, autoscaling et modèle de coût.
- **Dépendances :** P12-T01/T02 ; corpus T1/T2/T3.
- **Acceptation / tests :** p50/p95/p99, saturation, hit ratios, coût par site/publication et goulets documentés.
- **Risque / validation :** promesse de scale non prouvée ; validation par rapport répétable et seuils de scaling.

## PHASE 13 — Internationalisation

### P13-T01 — Internationaliser Studio, API et emails — `P1`, `L`
- **Objet / modules :** catalogues, dates/nombres, erreurs codées, pluriels et templates email.
- **Dépendances :** P01-T01 ; P02-T01 ; choix des langues.
- **Acceptation / tests :** clés manquantes, expansion, pluriels, fallback et emails dans la bonne locale.
- **Risque / validation :** traductions en dur ; validation par extraction CI et revue native des langues de lancement.

### P13-T02 — Implémenter contenus et URLs localisés — `P1`, `XL`
- **Objet / modules :** locales, translation_entries, slugs, fallback et manifests.
- **Dépendances :** P03-T05 ; P10-T05.
- **Acceptation / tests :** unicité par locale, publication sélective, canonique/hreflang/sitemap et changement de slug.
- **Risque / validation :** duplication SEO/perte de traduction ; validation par corpus multilingue.

### P13-T03 — Ajouter RTL, fuseaux et traduction assistée — `P2`, `L`
- **Objet / modules :** propriétés logiques, direction, dates DST, traduction IA brouillon.
- **Dépendances :** P13-T02 ; P08-T02 pour IA.
- **Acceptation / tests :** arabe/hébreu si activé, texte mixte, DST, source_hash et revue humaine.
- **Risque / validation :** support annoncé incomplet ; validation par navigateurs/lecteurs d'écran et revue linguistique.

## PHASE 14 — Analytics, sécurité et performances

### P14-T01 — Compléter traces, métriques, alertes et runbooks — `P0`, `L`
- **Objet / modules :** OpenTelemetry, dashboards, SLO, centre d'incidents et runbooks.
- **Dépendances :** parcours P2–P12 ; backend d'observabilité choisi.
- **Acceptation / tests :** trace API→worker, alerte déclenchée en exercice, logs expurgés et coût de télémétrie borné.
- **Risque / validation :** angles morts/alert fatigue ; validation par game day.

### P14-T02 — Instrumenter analytics produit respectueux — `P1`, `M`
- **Objet / modules :** événements versionnés, funnel, consentement et rétention.
- **Dépendances :** P04/P08/P10 ; registre de confidentialité.
- **Acceptation / tests :** premier site/publication, abandon et conversion mesurés sans contenu ; déduplication et suppression.
- **Risque / validation :** R-27 ; validation par revue DPO/produit et requêtes de cohorte.

### P14-T03 — Exécuter campagne sécurité et pentest — `P0`, `L`
- **Objet / modules :** tous les modules, scans, DAST, corpus menace et audit des accès.
- **Dépendances :** P10–P12 ; parcours critiques stabilisés.
- **Acceptation / tests :** matrice menace, IDOR/XSS/SSRF/cache/upload ; findings corrigés ou exception approuvée limitée.
- **Risque / validation :** R-06/R-07/R-19/R-20 ; validation par rapport indépendant et retest.

### P14-T04 — Optimiser les budgets de performance — `P1`, `L`
- **Objet / modules :** Studio, renderer, DB, assets et bundles.
- **Dépendances :** P12-T03 ; P14-T01.
- **Acceptation / tests :** cibles D1/D2 et CWV corpus, soak 4 h, aucune régression budgétaire non justifiée.
- **Risque / validation :** optimisation prématurée ; validation par profils avant/après et rapports de laboratoire/terrain distingués.

## PHASE 15 — Facturation et quotas

### P15-T01 — Implémenter plans, entitlements et compteurs — `P0`, `L`
- **Objet / modules :** `billing`, `entitlements`, plans/quotas/counters/overrides et API de décision.
- **Dépendances :** P02-T03 ; métriques P08/P10/P12.
- **Acceptation / tests :** limites concurrentes, période/fuseau, overrides expirants, aucune décision basée sur le nom du plan côté client.
- **Risque / validation :** contournement/dépassement ; validation par property tests et deux tenants.

### P15-T02 — Intégrer PSP et webhooks de facturation — `P1`, `L`
- **Objet / modules :** adaptateur PaymentProvider, checkout hébergé, subscriptions/invoices et réconciliation.
- **Dépendances :** P15-T01 ; contrat provider et sandbox.
- **Acceptation / tests :** signature/corps brut, doublons/désordre/perte, essai/upgrade/downgrade/impayé/remboursement.
- **Risque / validation :** état financier faux ; validation par matrice provider et rapprochement.

### P15-T03 — Ajouter crédits IA et politiques de dépassement — `P1`, `L`
- **Objet / modules :** réservation/régularisation, alertes, hard caps et UI d'usage.
- **Dépendances :** P08-T04 ; P15-T01/T02.
- **Acceptation / tests :** dernier crédit, crash après appel, remboursement de réservation et dépassement seulement avec consentement.
- **Risque / validation :** R-04/R-17 ; validation par simulation de marge et concurrence.

### P15-T04 — Définir cycle d'expiration et protection des sites — `P1`, `M`
- **Objet / modules :** grâce, lecture seule, annulation, export, dépublication éventuelle et notifications.
- **Dépendances :** P15-T02 ; P10-T02.
- **Acceptation / tests :** aucune suppression brutale, downgrade au-dessus du quota, rollback de statut après paiement et parcours d'export.
- **Risque / validation :** perte client/contentieux ; validation par revue produit/juridique et scénarios E2E.

## PHASE 16 — Extensions métier

### P16-T01 — Formaliser et implémenter le contrat d'extensions — `P1`, `L`
- **Objet / modules :** manifests, permissions, versions, installation, webhooks et désinstallation.
- **Dépendances :** P03-T01 ; P02-T03 ; P10-T02.
- **Acceptation / tests :** droits additionnels réapprouvés, API incompatible refusée, fallback et export à la désinstallation.
- **Risque / validation :** privilèges excessifs ; validation par extension de test hostile et revue de contrat.

### P16-T02 — Livrer Collections et bindings limités — `P1`, `XL`
- **Objet / modules :** data_collections/records, champs typés, requêtes AST, composants liste/carte et permissions.
- **Dépendances :** P03-T04 ; P15-T01 ; P16-T01.
- **Acceptation / tests :** validation, relations contrôlées, pagination/timeout, aucun SQL utilisateur, isolation et rendu dynamique.
- **Risque / validation :** devenir un faux ERP ; validation par scope de pilote et corpus de requêtes hostiles.

### P16-T03 — Livrer formulaires sécurisés et événements marketing simples — `P1`, `L`
- **Objet / modules :** form_submissions, validation serveur, consentement, notification, export/rétention et webhooks.
- **Dépendances :** P16-T01 ; email ; P15-T01.
- **Acceptation / tests :** spam/rate limits, payload chiffré, double soumission, aucune fuite dans logs, suppression/export.
- **Risque / validation :** R-19/R-24 ; validation par revue confidentialité et tests d'abus.

## PHASE 17 — Bêta privée

### P17-T01 — Préparer onboarding, support et statut — `P0`, `M`
- **Objet / modules :** guides, centre d'aide, support interne, status page, feedback et cohortes.
- **Dépendances :** parcours V1 stabilisés ; P14-T01/T02.
- **Acceptation / tests :** parcours documentés, IDs de corrélation, recours abus, exercice support et aucune promesse non validée.
- **Risque / validation :** R-25 ; validation par simulation de tickets et revue des textes publics.

### P17-T02 — Exécuter les gates de pré-bêta — `P0`, `L`
- **Objet / modules :** tests complets, pentest/retest, restore drill, charge, accessibilité, coûts et revue juridique.
- **Dépendances :** P14/P15/P16 ; P12-T02.
- **Acceptation / tests :** tous les critères P0 du document 26 ont preuves ; exceptions avec propriétaire/expiration.
- **Risque / validation :** lancement sur démos ; validation par go/no-go signé et artefacts de release.

### P17-T03 — Conduire la cohorte et corriger — `P0`, `XL`
- **Objet / modules :** onboarding de cohortes, analyse funnel, support, corrections et releases contrôlées.
- **Dépendances :** P17-T01/T02.
- **Acceptation / tests :** succès de création/publication, stabilité, coût et satisfaction mesurés ; aucun P0 ouvert ; rapports par cohorte.
- **Risque / validation :** biais d'échantillon et scope creep ; validation par critères de sortie définis avant cohorte.

## PHASE 18 — Lancement public

### P18-T01 — Finaliser offres, documents et processus commerciaux — `P1`, `M`
- **Objet / modules :** prix approuvés hors dossier technique, CGU/confidentialité, facturation, remboursement et support.
- **Dépendances :** P15 ; P17-T03 ; revue juridique/finance.
- **Acceptation / tests :** entitlements identiques aux offres publiées, parcours achat/annulation/export et coûts/marge revus.
- **Risque / validation :** R-17/R-24 ; validation par go/no-go produit/finance/juridique.

### P18-T02 — Préparer release, rollback et communication — `P0`, `M`
- **Objet / modules :** notes de release, canary, status, incident comms et plan de retour.
- **Dépendances :** P17-T02/T03.
- **Acceptation / tests :** répétition de lancement et rollback, contacts/astreinte actifs, smoke et dashboards prêts.
- **Risque / validation :** incident public ; validation par game day et signature ops.

### P18-T03 — Ouvrir progressivement et surveiller — `P0`, `L`
- **Objet / modules :** flags/invitations ou ouverture par cohortes, SLO, abuse, coûts et support.
- **Dépendances :** P18-T01/T02.
- **Acceptation / tests :** seuils d'arrêt respectés, rapports quotidiens initiaux, aucune capacité non testée annoncée.
- **Risque / validation :** saturation et réputation ; validation par revue post-lancement et critères de stabilité définis.

## PHASE 19 — Évolutions à grande échelle

### P19-T01 — Optimiser ou extraire sur preuves de charge — `P2`, `XL`
- **Objet / modules :** cache, SSG sélectif, read models, partitionnement ou extraction d'un service candidat.
- **Dépendances :** P18-T03 ; mesures de production et ADR nouveau.
- **Acceptation / tests :** bénéfice coût/SLO mesuré, migration et rollback, aucune régression d'isolation.
- **Risque / validation :** microservices prématurés ; validation par business case et avant/après.

### P19-T02 — Évaluer collaboration temps réel et écosystème — `P2`, `XL`
- **Objet / modules :** spike CRDT/présence, marketplace de templates, extensions partenaires et sandbox séparée.
- **Dépendances :** P18 ; ADR sécurité/données ; besoins utilisateurs démontrés.
- **Acceptation / tests :** prototypes et menaces, migration de commandes, licences/modération ; aucune activation sans gate dédié.
- **Risque / validation :** complexité et exécution de code ; validation par ADR et pilote séparé.

### P19-T03 — Spécifier les modules transactionnels et la résilience avancée — `P2`, `XL`
- **Objet / modules :** annexes e-commerce/réservation/LMS/membres, multi-région si SLO contractuel.
- **Dépendances :** P16 ; P18 ; étude de marché et exigences légales.
- **Acceptation / tests :** invariants, concurrency, paiement/disponibilité/progression, RPO/RTO et coûts avant développement complet.
- **Risque / validation :** R-16/R-21/R-24 ; validation par cahiers annexes approuvés et prototypes de risque principal.
