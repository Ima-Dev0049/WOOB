# Architecture applicative

Woob est un **monolithe modulaire Next.js/React/TypeScript**. Les Server Components lisent les services ; les routes API appellent ces mêmes services pour les mutations clientes. Aucun microservice n’est requis.

## Carte du dépôt

- `src/lib/document` : contrat canonique, registre, validation, opérations pures, fabriques et propositions IA.
- `src/lib/templates.ts` : six modèles techniques historiques, conservés pour la compatibilité `templateId`.
- `src/lib/catalog` : types de sites, catégories, domaines/sous-domaines, modules réels, styles, recettes, recherche, validation et génération de documents.
- `src/components/renderer` : renderer commun au public, à l’aperçu, à l’éditeur et à l’aperçu IA.
- `src/components/editor` : canevas, structure, inspecteur, pages, thème et panneau IA.
- `src/components/app` : dashboard, publication, modules, membres, domaines et facturation.
- `src/components/admin` : console plateforme, métriques, registres et actions de modération.
- `src/server/auth` : sessions, jetons, CSRF, espaces actifs et RBAC.
- `src/server/services` : projets, quotas, publication, médias, métier, IA, membres, domaines, billing et administration plateforme.
- `src/server/db` : schéma Drizzle, connexion PostgreSQL/PGlite, migrations et seed des plans.
- `src/server/storage.ts`, `src/server/mailer.ts` : adaptateurs fichier/S3 et fichier/SMTP.
- `drizzle/` : migrations SQL versionnées (`0001` à `0005`).
- `tests/` : tests de persistance et parcours Playwright.

## Document et rendu

Une page possède un `PageDocument` et une révision. Le document est un arbre typé ; le HTML n’est pas le format de stockage. La validation inspecte l’entrée brute avant Zod pour refuser les clés de prototype, les profondeurs/volumes abusifs et les URL non autorisées. Chaque nœud est ensuite validé contre le schéma strict de son composant.

Le renderer utilise les éléments React et les composants connus. Il n’emploie pas `dangerouslySetInnerHTML`. Une proposition IA ne contient que des opérations `updateProps` ou `insertComponent`, validées puis appliquées à une copie pour l’aperçu. Elle ne peut ni injecter un type inconnu ni exécuter du code.

## Catalogue et création guidée

Le catalogue distingue les catégories/variantes de sites (`site-types.ts`), les domaines parents et feuilles (`activity-domains.ts`, `activity-subdomains.ts`), les modules réellement disponibles et les thèmes (`capabilities.ts`), ainsi que les recettes de pages (`blueprints.ts`). Chaque entrée possède un identifiant stable, des textes et mots-clés ; les sous-domaines et variantes référencent leur parent. `validateCatalog` contrôle unicité, parents, relations, templates, composants et compatibilité des modules.

La recherche normalise les accents et applique tous les termes. `resolveProjectCreation` choisit la recette et le style, filtre pages et composants selon les modules sélectionnés et refuse une capacité non supportée. Un type ou un domaine nul utilise la recette `custom` : le catalogue ne devient jamais une étape obligatoire. Les recommandations d’un domaine ne sont pas une contrainte de création.

`buildProjectDraft` produit des `PageDocument` validés avec de nouveaux identifiants et les props du registre/templates techniques. Le fournisseur de contenu ne retourne que quatre champs textuels validés ; il ne fournit ni HTML ni arbre de composants. Le contexte contient le brief, la langue, les choix, les pages et les descriptions/limites des capacités.

`POST /api/workspaces/[workspaceId]/project-preview` exige session, permission d’édition, CSRF, quota et rate limit. La génération `project_create` est journalisée avec `projectId` nullable. La création vérifie auteur, workspace, résultat et instantané de sélection, puis rattache la génération au projet dans la transaction ; une mise à jour conditionnelle `projectId IS NULL` en empêche la consommation concurrente ou répétée. `projects.catalog_selection` conserve l’instantané typé sans remplacer la table `project_modules`. Les appels historiques par `templateId` suivent toujours l’ancien chemin de création.

## Sauvegarde et publication

1. La sauvegarde exige `baseRevision` et vérifie l’identité page/document/chemin.
2. Une mise à jour conditionnelle rejette une révision obsolète. Les lectures de pages placent toujours `/` en premier, puis utilisent date, chemin et ID pour éviter un ordre ambigu lors d’insertions dans la même milliseconde.
3. La publication fige pages, navigation, modules, produits actifs et articles publiés dans un `SiteSnapshot` validé.
4. La transaction verrouille le projet, crée les versions de pages, déplace le pointeur actif et ajuste la visibilité des médias.
5. La route publique lit uniquement le snapshot actif, jamais le brouillon.
6. Un rollback clone un ancien snapshot dans une nouvelle publication ; il ne réécrit pas l’historique.

## Tenancy, auth et permissions

Chaque objet métier possède `workspaceId` et, lorsque pertinent, `projectId`. Les services résolvent d’abord la ressource puis le membership et la permission ; les ressources d’un autre tenant retournent `404` pour limiter la divulgation.

Les rôles de workspace sont `owner`, `admin`, `editor`, `contributor`, `viewer`. Ils ne donnent aucun droit sur la plateforme. Les administrateurs ne peuvent pas modifier le propriétaire ni gérer d’autres administrateurs. La suspension conserve l’historique. Le cookie `woob_workspace` ne choisit un espace actif que s’il appartient réellement à l’utilisateur.

Les sessions et jetons de récupération sont stockés hashés. La consommation d’un jeton utilise une mise à jour atomique `used_at IS NULL`. Les mutations authentifiées exigent le double-submit CSRF et une origine cohérente. `X-Forwarded-For` n’est utilisé pour le rate limit que si `TRUST_PROXY=true`.

## Administration plateforme

Le rôle `users.platformRole=admin` ou une appartenance à `PLATFORM_ADMIN_EMAILS` autorise `/admin`. Aucun owner, premier inscrit ou administrateur de workspace n’est promu implicitement. La commande `npm run admin:grant -- email@example.com` affecte explicitement un compte existant ; une allowlist reste une décision de configuration et n’écrit pas de rôle en base.

Les routes `/api/admin/*` exigent session, rôle plateforme, CSRF en mutation et limitation de débit. Les modifications d’utilisateur, workspace, projet ou abonnement écrivent leur audit dans la même transaction. Suspendre un utilisateur révoque toutes ses sessions. Un workspace suspendu est exclu des accès membres et du rendu public ; un projet suspendu est exclu du back-office et du rendu public. La réactivation d’un projet ne restaure `published` que si une publication active existe.

Les métriques sont calculées en SQL sur toute la base. Les montants de commandes sont groupés par devise et par statut de paiement : ils ne constituent pas une mesure de revenu encaissé. L’attribution manuelle d’une offre change l’abonnement local et les quotas sans créer de transaction ; elle est refusée si un identifiant d’abonnement externe existe.

## Modules métier et cohérence

- Les formulaires et services de réservation sont validés contre le snapshot réellement publié.
- Les commandes re-lisent produits, prix, devise et stock dans une transaction avec verrouillage.
- Les lignes d’un même produit sont consolidées avant les contrôles ; le stock est décrémenté depuis la ligne verrouillée.
- Les transitions de commande sont limitées ; l’annulation restaure le stock et ne modifie jamais `paymentStatus`.
- Les changements de catalogue/articles/modules modifient le prochain snapshot, pas rétroactivement les sites déjà publiés.

## i18n et accessibilité clavier

`src/lib/i18n.ts` contient des dictionnaires français/anglais typés ; l’anglais doit conserver exactement la forme du dictionnaire français à la compilation. La préférence `uiLocale` pilote le shell, le dashboard, la création de projet, les paramètres/membres, l’authentification et la console admin. Un cookie `woob_locale` HttpOnly, non sensible, conserve ce choix pour l’écran de connexion après déconnexion ; il ne remplace ni la session ni les contrôles de workspace.

Les dialogues projet, IA, historique et médias utilisent `useModalFocus` : cible initiale explicite, boucle Tab/Shift+Tab, fermeture par Échap et restitution du focus au déclencheur. Ces comportements sont testés dans Chromium, mais ne constituent pas un audit avec lecteur d’écran. Les autres surfaces et messages restent à traduire progressivement.

## Médias, IA et quotas

Les uploads sont limités par taille et par plan, détectés par signature binaire et écrits sous une clé confinée au workspace/projet. Le SVG est refusé. La publication rend publics seulement les assets utilisés ; la dépublication les repasse en privé.

Les quotas projets, pages, stockage, IA et domaines sont appliqués côté serveur. Le mode IA `demo` utilise des gabarits locaux et zéro appel distant. Le mode `openai` transmet la consigne et le document au fournisseur configuré, impose une réponse JSON et journalise le résultat.

## Domaines et facturation

Un domaine personnalisé est une intention de configuration. Woob conserve le hash du jeton TXT, pas le jeton en clair après la réponse initiale ; les DTO de création, liste et vérification ne renvoient pas ce hash. Les chemins, ports et hôtes ambigus sont refusés avant normalisation IDN, et les conflits d’unicité deviennent une erreur 409. La vérification utilise le resolver DNS seulement lorsqu’elle est activée. `dns_verified` ne signifie ni routage ni TLS actif.

Stripe est un adaptateur conditionnel : le checkout exige une clé serveur, un prix de plan et `APP_URL`. Le webhook vérifie la signature, enregistre l’ID d’événement pour l’idempotence et synchronise l’abonnement dans une transaction. Le succès navigateur reste `pending` et n’accorde aucun quota.

## Persistance et exploitation

PostgreSQL est la cible de production, avec TLS configurable via `PGSSL=require`. PGlite fournit une base autonome locale et des bases en mémoire pour les tests. Les migrations sont exécutées à l’initialisation et par `npm run db:migrate`. Les commandes migration, seed et attribution admin chargent le même environnement `.env`/`.env.local` que Next. Avec PGlite, arrêter le serveur avant ces commandes.

Le rate limit et les pilotes fichier sont locaux à une instance. Une exploitation distribuée nécessite PostgreSQL, stockage partagé, limiteur partagé, sauvegardes et supervision ; ces ressources ne sont pas simulées dans le dépôt.
