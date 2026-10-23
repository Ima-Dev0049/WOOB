# Woob — état réel d’implémentation

Mise à jour : 2026-10-23. Branche : `arena/639e32e6-woob`.

## Résultats effectivement exécutés

| Vérification | Résultat constaté |
| --- | --- |
| TypeScript strict | `npm run typecheck` : réussi dans le dernier `npm run verify` |
| ESLint | `npm run lint` : réussi dans le dernier `npm run verify` |
| Vitest / PGlite migré | **34/34 tests réussis**, 8 fichiers |
| Playwright / Chromium | **19/19 scénarios réussis** lors de la dernière suite complète |
| Build Next.js | `npm run build` : réussi ; 2 avertissements de traçage du stockage fichier |
| Migrations | `npm run db:migrate` réussi ; `0001` à `0005` appliquées à la base PGlite de prévisualisation |
| Attribution admin | `npm run admin:grant -- platform-admin-e2e@example.com` réussi sur un compte local existant |
| Audit npm production | `npm audit --omit=dev` : **0 vulnérabilité** |
| Audit npm complet | **9 alertes (4 modérées, 5 hautes)** dans les outils de développement ; aucun correctif forcé/rétrogradant appliqué |
| Déploiement externe | **Non effectué** |

Les durées varient selon les exécutions ; elles ne sont pas des engagements de performance.

Incident local conservé : après un arrêt interne de PGlite sur l’ancien `.woob-data`, ce répertoire n’a été ni supprimé ni réinitialisé. La prévisualisation utilise désormais `.woob-data-runtime`, migré jusqu’à `0005`. Il s’agit d’une nouvelle base locale, pas d’une récupération ou d’une restauration de l’ancienne.

## Développé et intégré

- Site marketing, catalogue de tarifs sans prix payant inventé, inscription, connexion, déconnexion, récupération et vérification email.
- Sessions opaques hashées, cookies, CSRF double-submit, consommation atomique des jetons, RBAC serveur et isolation par workspace. Les réponses `/api/auth/me` sont limitées au profil utile et ne contiennent plus le hash du mot de passe.
- Administration plateforme `/admin`, distincte du rôle `admin` d’un workspace : rôle persisté `users.platformRole` ou allowlist `PLATFORM_ADMIN_EMAILS`, sans promotion automatique. Statistiques SQL globales, activité sur 14 jours, utilisateurs, espaces, projets, offres, modération, attribution manuelle d’offre et journal `admin_audit_logs` transactionnel. Les valeurs de commandes restent ventilées par devise et statut, sans les assimiler à un chiffre d’affaires encaissé.
- Espaces partagés : ajout de comptes existants, rôles owner/admin/editor/contributor/viewer, suspension/réactivation et sélecteur d’espace actif validé côté serveur.
- Dashboard, projets, six modèles techniques historiques, pages, SEO, paramètres et quotas serveur. L’accueil est toujours la première page, avec un ordre stable même lors d’insertions dans la même milliseconde.
- **Catalogue universel intégré à la création** : 20 catégories, 212 variantes de sites, 30 domaines et 150 sous-domaines avec identifiants stables et parents, 21 recettes, 6 styles et 4 modules réellement implémentés. Les relations sont validées ; la recherche ignore les accents et les filtres sont pilotés par les données, sans liste propre au composant.
- **Parcours de création en six étapes** : type, domaine, fonctionnalités, style, description/langue, prévisualisation puis éditeur. Le site sur mesure, l’absence de domaine et le raccourci direct vers la description ne bloquent jamais la création. Les recommandations restent indicatives et les combinaisons libres sont acceptées.
- Génération de projet : le brief, le type, le domaine, les modules, les pages et les limites forment un contexte structuré. Seuls quatre champs textuels sont acceptés du fournisseur ; les documents, pages et composants viennent du registre. La prévisualisation utilise le renderer de l’éditeur. La sélection est persistée dans `projects.catalog_selection` par la migration `0005` ; les anciens appels `templateId` restent fonctionnels.
- Éditeur visuel : sélection, inspecteur, structure, ajout/déplacement/duplication, collections, styles responsive, thèmes, médias, undo/redo, points de restauration et sauvegarde avec révision optimiste.
- Édition mobile utilisable à 390 px : tiroirs de blocs/propriétés, aperçu responsive et sauvegarde conservée dans la barre d’actions.
- Document canonique versionné et validé ; registre de composants ; renderer commun sans HTML arbitraire ni `dangerouslySetInnerHTML` ; contrôle des clés de prototype et des URL dangereuses, y compris dans les propriétés imbriquées.
- Aperçu privé, multipage, publication par `SiteSnapshot`, dépublication, historique et rollback sans mélanger brouillon et version publique.
- Médias PNG/JPEG/WebP/GIF : signature du contenu, taille/quota, chemins confinés, accès privé/public et protection contre la suppression d’un média utilisé. Pilotes fichier et S3 présents.
- Modules métier : messages, demandes de réservation, commandes manuelles, catalogue, articles et activation de modules. Prix relus côté serveur, lignes de panier consolidées, stock transactionnel et restauration à l’annulation.
- IA structurée : propositions JSON limitées aux opérations du registre, quota/journal, aperçu isolé avant application, mode démo local explicitement étiqueté et adaptateur OpenAI configurable. Pour la création, le brouillon généré est lié au workspace et à son auteur, vérifié contre la sélection et consommable une seule fois ; le mode local ne fait aucun appel distant.
- Domaines : normalisation IDN avec rejet des chemins/ports, quotas, conflit 409, DTO sans hash interne, jeton TXT hashé, instructions affichées une fois et resolver DNS seulement si activé. Aucun succès TLS/routage simulé.
- Facturation : utilisation et offres, checkout Stripe conditionnel, webhook signé et idempotent. Le retour navigateur ne change jamais le plan ; seul un abonnement confirmé peut le faire.
- i18n : dictionnaires typés français/anglais sur shell, dashboard, création de projet, paramètres/membres, authentification et console admin, avec préférence persistée et langue de connexion conservée après déconnexion.
- Accessibilité clavier : focus initial, boucle Tab/Shift+Tab, Échap et restitution au déclencheur pour les dialogues projet, IA, historique et médias ; icônes décoratives retirées des noms accessibles concernés.

## Comportements vérifiés par tests

- Parcours obligatoire : sélection d’un titre Hero, modification, sauvegarde, actualisation et texte retrouvé ; publication et lecture anonyme.
- Double refus d’accès croisé `404` entre comptes, refus `viewer`, conflit de révision et isolation des snapshots.
- Publication, dépublication et rollback ; les modifications du brouillon ne changent pas le snapshot actif.
- Points de brouillon : création, restauration dans une nouvelle révision, historique conservé et contenu retrouvé après rechargement.
- Validation des six modèles techniques, opérations d’arbre, pollution `__proto__`, URL `javascript:` et propriétés IA arbitraires.
- Catalogue : unicité globale, parents et relations des 180 entrées sectorielles, capacités implémentées, recherche sans accent, filtres combinés, retrait des pages/composants selon les modules et refus d’un module incompatible. La création libre sans type ni domaine produit aussi un document valide.
- Génération de projet en PGlite : brief et choix présents dans le contexte journalisé, thème/pages/modules persistés, aperçu lié au projet, refus de réutilisation croisée ou avec une sélection modifiée. Le scénario navigateur parcourt les six étapes avec restaurant, domaine alimentation, réservations, style artisanal et brief retrouvé dans l’éditeur.
- Commandes avec lignes dupliquées, total serveur, décrément/restauration du stock, transitions interdites et paiement toujours `unpaid`.
- Formulaires, réservations et notes ; IA démo prévisualisée, appliquée et journalisée sans modification avant application.
- Domaines : quota, IDN, chemins/ports invalides, conflit 409, rôles admin/viewer, isolation, hash absent des DTO et refus de vérification quand le DNS est désactivé. Les transitions du TXT sont testées avec un resolver simulé, pas un domaine public.
- Refus de checkout/webhook Stripe non configurés sans modifier l’abonnement.
- Gestion des membres et partage réel d’un projet entre deux sessions navigateur.
- Upload local réel, faux PNG et SVG refusés, lecture inter-compte refusée, média utilisé protégé, recherche et réutilisation dans l’éditeur après rechargement.
- Parcours mobile à 390 px : panneaux, changement de viewport, sauvegarde/rechargement et absence de débordement horizontal.
- Audits `@axe-core/playwright` sur accueil, connexion, dashboard, éditeur, administration, sélection du catalogue et aperçu généré, sans violation retenue ni exclusion de règle dans ces scénarios.
- Changement de langue : anglais appliqué, conservé après rechargement/déconnexion et retrouvé après une nouvelle connexion.
- Clavier : focus contenu dans les quatre dialogues, fermeture par Échap et focus restitué au bouton d’origine, y compris avec une cible initiale de formulaire.
- Administration : owner ordinaire refusé même avec CSRF valide, allowlist et rôle explicite, absence d’élévation automatique, protection contre l’auto-blocage, suspension utilisateur avec révocation de toutes les sessions, blocage effectif des accès tenant et sites publics pendant les suspensions workspace/projet, réactivation et audit.
- Changement manuel d’offre avec quotas immédiatement relus, aucun paiement créé et refus d’écraser un abonnement externe. Parcours navigateur de suspension/réactivation et audit axe de la console admin.
- Récupération : ancien mot de passe refusé, nouveau accepté, jeton rejoué refusé ; confiance `X-Forwarded-For` désactivée par défaut.
- Back-office navigateur : création de produit/article, activation de module et absence de `pageerror` dans ce scénario.

## Partiel, absent ou dépendant d’un service externe

- **Aucun déploiement public, PostgreSQL externe, S3, SMTP, appel OpenAI, paiement Stripe, DNS public ou certificat TLS n’a été vérifié.** Leur code ou leurs variables ne valent pas preuve d’intégration.
- L’IA démo est testée ; le fournisseur OpenAI ne l’est pas. Le pilote email fichier ne transmet aucun email.
- Les offres payantes restent sans montant configuré. Aucun prix n’a été inventé pour rendre le checkout artificiellement utilisable.
- Les domaines personnalisés ne sont pas encore routés par l’application et aucune émission TLS n’est incluse. La disponibilité d’un domaine chez un registrar n’est jamais présumée.
- Le français et l’anglais fonctionnent sur le shell, le dashboard, les libellés du wizard de création, les paramètres/membres, l’authentification et la console admin. De nombreuses variantes et entrées sectorielles utilisent encore le français comme fallback ; l’éditeur, les autres écrans du back-office, le marketing, les modèles et de nombreux messages serveur restent à traduire.
- Les audits axe automatisés ne remplacent pas une revue manuelle, un lecteur d’écran ou une certification WCAG. Aucun test avec lecteur d’écran n’a été réalisé.
- Les registres admin affichent les 100 entrées récentes et les 50 derniers audits ; la recherche actuelle filtre ce lot côté navigateur. Une pagination/recherche SQL est nécessaire pour administrer exhaustivement de très gros annuaires.
- La limitation de débit est en mémoire par instance. PGlite et les pilotes fichier ne conviennent pas à une production multi-instance.
- La collaboration ajoute seulement des comptes déjà inscrits ; il n’y a pas d’invitation email pour un nouvel utilisateur.
- Réservations sans moteur de disponibilité complet ; commandes sans encaissement, taxes, expédition ou logistique. Ces modules ne remplacent pas un ERP, LMS ou une marketplace.
- Les variantes du catalogue nommées marketplace, SaaS, LMS, portail patient, billetterie, dons ou paiement produisent seulement l’architecture éditoriale et les modules affichés comme disponibles. Leurs limites sont présentées dans le wizard ; aucun backend de ce type n’est simulé.
- Le build PDF de la documentation de référence n’est pas livré ; les neuf SVG déjà produits restent des documents de référence, pas des tests applicatifs.

## Prochaine priorité

En local, ajouter pagination et recherche SQL aux annuaires admin, puis étendre les dictionnaires à l’éditeur, au reste du back-office et au marketing, puis réaliser une revue avec lecteur d’écran sans présumer son résultat. Avec autorisation et comptes externes, créer ensuite un staging PostgreSQL/SMTP/S3 pour tester sauvegardes et restauration, puis valider séparément Stripe/OpenAI en sandbox et une plateforme DNS/TLS. Aucune dépense, publication ou validation externe n’est implicite.
