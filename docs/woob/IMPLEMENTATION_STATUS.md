# Woob — état réel d’implémentation

Mise à jour : 2026-10-23. Branche : `arena/639e32e6-woob`.

## Incrément courant — `font-catalog-500`

L’éditeur propose désormais **500 styles typographiques réellement sélectionnables : 50 familles variables × 10 graisses adaptées à leur axe `wght` réel**. Le sélecteur du texte et celui des titres comprennent recherche, catégories, aperçu à la demande et graisse ; la pile CSS personnalisée reste disponible. Les compteurs et options viennent du catalogue de données, sans duplication dans les composants.

Les 50 WOFF2 latin et leurs licences OFL sont locaux, avec paquet, version et SHA-256 consignés dans [FONT_CATALOG.md](FONT_CATALOG.md). Le document ne contient que famille et graisse : les `@font-face` et chemins sont générés depuis le catalogue, jamais depuis une URL utilisateur. Les poids sont optionnels dans le schéma `1.0.0`, donc les anciens thèmes restent valides et sans nouvelle requête. Une page publiée ne charge que les familles choisies, dédupliquées, et non le catalogue entier.

- `npm run verify` : TypeScript, ESLint, build et **86/86 Vitest dans 15 fichiers** réussis.
- `npm run test:e2e` : **40/40 Playwright** sur build de production en Chromium. Le parcours vérifie sélection, canvas, sauvegarde, rechargement, publication anonyme, deux WOFF2 200 et leurs `FontFace` à l’état `loaded`, sans troisième fonte dans le contexte public.
- Les tests couvrent les 500 identifiants uniques, les limites d’axes, les 50 signatures WOFF2 et licences, la déduplication CSS, les entrées hostiles et la compatibilité historique. Les audits axe du catalogue ouvert et des panneaux avancés/expert passent sans exclusion.
- Aucune nouvelle dépendance runtime, migration SQL, réinitialisation de base ou modification d’environnement sensible. Les deux avertissements Turbopack de stockage fichier et l’avertissement de configuration Vite restent non bloquants.
- **Limites :** style normal et sous-ensemble latin uniquement ; pas d’italiques, d’upload arbitraire ni de couverture universelle des scripts. Les glyphes absents utilisent le fallback. Validation navigateur limitée à Chromium, sans lecteur d’écran.

## Incrément précédent — `ai-idempotency`

Les générations IA `page_edit` acceptent désormais un `requestId` ou l’en-tête `Idempotency-Key`. Une empreinte SHA-256 lie la clé à la page, la consigne et le bloc ; la réutiliser pour une autre demande est refusée. Une réponse terminée est relue et validée puis renvoyée avec le même identifiant et le même résultat, sans nouvelle ligne ni nouveau décompte de quota. La route renvoie 200 pour ce replay et conserve 201 pour une nouvelle exécution.

Un bail de 120 secondes bloque les doublons actifs. Après expiration, une reprise atomique incrémente `attempts`, qui sert de fencing token contre la finalisation d’une ancienne exécution. Si la révision de la page a changé avant reprise, la génération échoue explicitement au lieu de changer de contexte. La migration additive `0007_blushing_the_spike.sql` conserve les anciennes lignes et la création de projet.

- `npm run verify` : TypeScript, ESLint, build et **80/80 Vitest dans 14 fichiers** réussis.
- `npm run test:e2e` : **39/39 Playwright** sur le build de production, en Chromium. Le nouveau parcours laisse le serveur terminer réellement, interrompt la première réponse navigateur, puis vérifie le même `id`, la même clé et `replayed:true` au second essai.
- Les tests unitaires couvrent le replay, l’empreinte différente, le bail actif, la reprise expirée et la révision de page modifiée. Les états de crash sont simulés en base : aucun test `SIGKILL` ou de coupure système n’est revendiqué.
- `npm ci --no-audit --no-fund` a restauré les 483 paquets verrouillés ; aucune nouvelle dépendance. Migration générée par Drizzle et appliquée au démarrage de la preview, sans réinitialisation de base ni modification d’environnement sensible.
- **Limite :** l’exécution reste liée à la requête, sans worker autonome. Si un processus s’arrête après une réponse du fournisseur mais avant l’enregistrement local, une reprise peut devoir rappeler ce fournisseur : l’exactly-once externe n’est pas garanti. Le lot ne couvre pas encore `project_create`.

## Incrément précédent — `scroll-motion`

Le document accepte désormais un déclenchement `scroll` et un preset `parallax`, en conservant les entrées `in-view` existantes. `CreativeMotion` calcule une progression bornée avec des listeners passifs et un seul `requestAnimationFrame` par événement, sans boucle permanente. Le HTML SSR reste visible ; reduced-motion supprime la progression et les transformations, y compris lorsque la préférence change pendant la consultation.

L’inspecteur règle le déclenchement, le preset et l’amplitude jusqu’à 96 px. La navigation, les formulaires et la 3D sont exclus, avec trois effets scroll maximum par page. L’opération IA structurée `updateMotion` cible un bloc sur une copie validée ; l’aperçu peut être annulé, puis l’application utilise undo/redo, la sauvegarde par révision et le snapshot de publication existants. Le mode démo ne produit cet effet que sur demande explicite et ne l’ajoute pas automatiquement aux sites existants.

- `npm run verify` : TypeScript, ESLint, build et **77/77 Vitest dans 14 fichiers** réussis.
- `npm run test:e2e` : **38/38 Playwright** sur le build de production, en Chromium. Le nouveau parcours couvre prévisualisation/annulation, application, undo/redo, rechargement, publication, scroll réel, stabilité sans événement, reduced-motion initial et dynamique, et SSR sans JavaScript.
- Les tests structurels couvrent aussi les cibles interdites, le quatrième effet refusé, l’immutabilité avant acceptation et le retrait du motion sur copie.
- `npm ci --no-audit --no-fund` a restauré les **483 paquets verrouillés** ; aucune dépendance, migration ou réinitialisation de base n’a été ajoutée. Aucun appel OpenAI réel ni déploiement externe n’a été effectué.
- Les deux avertissements Turbopack de traçage filesystem dans `src/server/storage.ts` persistent sans bloquer le build.
- Validation limitée à Chromium et à des viewports émulés : Firefox, WebKit, appareils physiques, lecteur d’écran et mesure Core Web Vitals ne sont pas validés. Il ne s’agit pas d’une timeline de scroll libre.

## Incrément précédent — `surface-motion`

Une couche motion native et bornée améliore l’accueil, les tarifs et le tableau de bord sans changer la direction artistique : intro séquencée du hero et de l’aperçu produit, révélations une seule fois au scroll, header compact avec progression de lecture, micro-interactions et détails du bento. Les couleurs restent celles du design existant, aucune dépendance ni animation permanente n’est ajoutée. Les pictogrammes d’écrans qui dépendaient de glyphes absents sont désormais dessinés en CSS.

`MotionSurface` conserve le HTML SSR lisible sans JavaScript, utilise `IntersectionObserver`, révèle immédiatement le contenu sous reduced motion et nettoie observers/listeners. Les zones en attente restent dans l’arbre d’accessibilité et apparaissent au focus clavier. Après chaque entrée, l’état `entered` supprime les transformations résiduelles afin que les modales `position: fixed` du dashboard restent réellement viewport et cliquables.

- `npm run verify` : TypeScript, ESLint, build et **74/74 Vitest dans 14 fichiers** réussis.
- `npx playwright test` : **37/37 Playwright** sur le build de production, incluant axe, clavier, modales, éditeur, publication et 3D.
- Cinq scénarios motion ciblent le scroll, les ancres, reduced motion, le SSR sans JavaScript, le mobile à 390 px et les deux déclencheurs de modale du dashboard.
- Captures réelles desktop/mobile, bento animé et SSR, carte de démonstration et dashboard inspectées ; aucun débordement horizontal constaté dans ces scénarios.
- Aucune migration, réinitialisation de base, modification d’environnement sensible, nouvelle dépendance ou publication externe pour ce lot.
- Validation limitée à Chromium et à des viewports émulés : Firefox, WebKit, appareils physiques, lecteur d’écran et mesure Core Web Vitals ne sont pas validés.

## Incrément précédent — `scene3d`

La capacité procédurale est intégrée au registre, à l’orchestrateur synchrone, à l’agent prévisualisable, à l’éditeur, à la persistance, au renderer public et à la démo Atelier Ligne. Three.js est différé, borné, suspendu hors viewport et remplacé par un fallback sous reduced motion ou indisponibilité WebGL. Voir [../WOOB_SCENE3D.md](../WOOB_SCENE3D.md) pour le contrat et les limites.

- Au moment de sa livraison : **74/74 Vitest**, **32/32 Playwright**, TypeScript, ESLint et build réussis ; la suite courante est désormais de 40 scénarios Playwright.
- Captures 3D réelles à 1440/390 px inspectées ; smoke HTTP et audit axe ciblé réussis.
- `npm audit --omit=dev` : 0 vulnérabilité ; 4 alertes modérées de développement conservées sans correctif forcé.
- Aucune migration, réinitialisation de base, modification d’environnement sensible ou publication externe pour ce lot.

## Résultats historiques du socle

Le tableau ci-dessous conserve les mesures du socle antérieur ; les totaux courants sont ceux de la section `font-catalog-500` ci-dessus et des guides créatifs.

| Vérification | Résultat constaté |
| --- | --- |
| TypeScript strict | `npm run typecheck` : réussi dans le dernier `npm run verify` |
| ESLint | `npm run lint` : réussi dans le dernier `npm run verify` |
| Vitest / PGlite migré | **49/49 tests réussis**, 10 fichiers |
| Playwright / Chromium | **22/22 scénarios réussis** sur le build de production après arrêt/redémarrage |
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
- Couche `surface-motion` partagée par l’accueil, les tarifs et le dashboard : entrées bornées, révélations one-shot, header de lecture, interactions clavier/survol, fallback SSR et reduced motion, sans transformations résiduelles sur les ancêtres de modales.
- Motion de document `scroll-motion` : parallaxe et presets de progression sur blocs compatibles, trois effets/page, inspecteur, IA `updateMotion` prévisualisable, historique, persistance et publication ; aucune boucle permanente, cible fragile ou activation automatique sur l’existant.
- Sessions opaques hashées, cookies, CSRF double-submit, consommation atomique des jetons, RBAC serveur et isolation par workspace. Les réponses `/api/auth/me` sont limitées au profil utile et ne contiennent plus le hash du mot de passe.
- Administration plateforme `/admin`, distincte du rôle `admin` d’un workspace : rôle persisté `users.platformRole` ou allowlist `PLATFORM_ADMIN_EMAILS`, sans promotion automatique. Statistiques SQL globales, activité sur 14 jours, utilisateurs, espaces, projets, offres, modération, attribution manuelle d’offre et journal `admin_audit_logs` transactionnel. Les valeurs de commandes restent ventilées par devise et statut, sans les assimiler à un chiffre d’affaires encaissé.
- Espaces partagés : ajout de comptes existants, rôles owner/admin/editor/contributor/viewer, suspension/réactivation et sélecteur d’espace actif validé côté serveur.
- Dashboard, projets, six modèles techniques historiques, pages, SEO, paramètres et quotas serveur. L’accueil est toujours la première page, avec un ordre stable même lors d’insertions dans la même milliseconde.
- **Catalogue universel intégré à la création** : 20 catégories, 212 variantes de sites, 30 domaines et 150 sous-domaines avec identifiants stables et parents, 21 recettes, 6 styles et 4 modules réellement implémentés. Les relations sont validées ; la recherche ignore les accents et les filtres sont pilotés par les données, sans liste propre au composant.
- **Parcours de création en six étapes** : type, domaine, fonctionnalités, style, description/langue, prévisualisation puis éditeur. Le site sur mesure, l’absence de domaine et le raccourci direct vers la description ne bloquent jamais la création. Les recommandations restent indicatives et les combinaisons libres sont acceptées.
- Génération de projet : le brief, le type, le domaine, les modules, les pages et les limites forment un contexte structuré. Seuls quatre champs textuels sont acceptés du fournisseur ; les documents, pages et composants viennent du registre. La prévisualisation utilise le renderer de l’éditeur. La sélection est persistée dans `projects.catalog_selection` par la migration `0005` ; les anciens appels `templateId` restent fonctionnels.
- Éditeur visuel : sélection, inspecteur, structure, ajout/déplacement/duplication, collections, styles responsive, thèmes, médias, undo/redo, points de restauration et sauvegarde avec révision optimiste.
- **Catalogue typographique local** : 50 familles variables et 500 couples famille/graisse, recherche et filtres, graisses bornées par axe, piles personnalisées conservées, assets OFL locaux, chargement à la demande et rendu commun du brouillon au site publié.
- Édition mobile utilisable à 390 px : tiroirs de blocs/propriétés, aperçu responsive et sauvegarde conservée dans la barre d’actions.
- Document canonique versionné et validé ; registre de composants ; renderer commun sans HTML arbitraire ni `dangerouslySetInnerHTML` ; contrôle des clés de prototype et des URL dangereuses, y compris dans les propriétés imbriquées.
- Aperçu privé, multipage, publication par `SiteSnapshot`, dépublication, historique et rollback sans mélanger brouillon et version publique.
- Médias PNG/JPEG/WebP/GIF : signature du contenu, taille/quota, chemins confinés, accès privé/public et protection contre la suppression d’un média utilisé. Pilotes fichier et S3 présents.
- Modules métier : messages, demandes de réservation, commandes manuelles, catalogue, articles et activation de modules. Prix relus côté serveur, lignes de panier consolidées, stock transactionnel et restauration à l’annulation.
- IA structurée : propositions JSON limitées aux opérations du registre, quota/journal, aperçu isolé avant application, mode démo local explicitement étiqueté et adaptateur OpenAI configurable. Pour la création, le brouillon généré est lié au workspace et à son auteur, vérifié contre la sélection et consommable une seule fois ; le mode local ne fait aucun appel distant.
- Idempotence des propositions `page_edit` : clé scoped workspace/utilisateur, empreinte de requête, replay validé, bail de 120 s, reprise atomique avec fencing et protection de révision. L’exécution reste synchrone dans la requête ; aucun worker autonome ni exactly-once fournisseur n’est déclaré.
- Capacité `scene3d` : opérations `insert/update/remove` validées sur clone, une scène par page, presets procéduraux Three.js, inspecteur, undo/redo, sauvegarde/publication, pause/reprise, suspension et fallback. L’orchestration est synchrone ; aucune tâche longue persistante n’est déclarée.
- Domaines : normalisation IDN avec rejet des chemins/ports, quotas, conflit 409, DTO sans hash interne, jeton TXT hashé, instructions affichées une fois et resolver DNS seulement si activé. Aucun succès TLS/routage simulé.
- Facturation : utilisation et offres, checkout Stripe conditionnel, webhook signé et idempotent. Le retour navigateur ne change jamais le plan ; seul un abonnement confirmé peut le faire.
- i18n : dictionnaires typés français/anglais sur shell, dashboard, création de projet, paramètres/membres, authentification et console admin, avec préférence persistée et langue de connexion conservée après déconnexion.
- Accessibilité clavier : focus initial, boucle Tab/Shift+Tab, Échap et restitution au déclencheur pour les dialogues projet, IA, historique et médias ; icônes décoratives retirées des noms accessibles concernés.

## Lot personnalisation intégré

- **Design system `1.0.0` compatible avec les documents existants** : tokens de couleurs claires/sombres, typographie et échelle, espacements, rayons, ombres, largeurs, breakpoints, boutons, cartes, formulaires, navigation et mouvement. Les anciens champs plats sont conservés et synchronisés ; aucune migration destructive ni nouveau numéro de document n’a été nécessaire (`src/lib/document/types.ts`, `design-system.ts`, `validation.ts`).
- **Cascade unique et déterministe** : valeurs par défaut → tokens globaux → style réutilisable → exceptions locales → adaptations tablette/mobile → états. La cascade du preset est résolue avant celle locale afin qu’une exception volontaire ne soit pas perdue sur un autre écran. Les états `hover`, `focus-visible`, `active` et `disabled` sont rendus par le même moteur.
- **Trois modes réels dans l’éditeur** : simple pour les réglages courants, avancé pour dimensions/layout/bordures/animation/états/presets, expert pour effets et variables `--woob-*`. Les groupes avancés sont repliés ; aucun HTML, sélecteur libre ou script n’est exposé.
- **Gestes de style reliés au document** : copier/coller, réinitialisation complète ou par propriété, création et affectation de presets, application d’un preset aux blocs du même type sans effacer leurs exceptions locales. Les actions passent par l’historique undo/redo et la sauvegarde ordinaire.
- **Persistance globale transactionnelle** : un changement de thème met à jour le projet et les thèmes JSONB des pages sans réécrire leurs racines. Les révisions des autres pages augmentent pour empêcher un onglet obsolète d’écraser le nouveau thème. La comparaison est structurelle et ne dépend pas de l’ordre des clés JSONB. Les presets encore référencés sont conservés.
- **Redémarrage local contrôlé** : `scripts/next.cjs` coordonne les signaux Next avec la fermeture PGlite. Un test ferme puis rouvre une base sur disque et retrouve le compte écrit ; le serveur de production a aussi été arrêté/redémarré avec un site publié, son thème, sa variable experte et sa règle mobile retrouvés. Cela ne couvre pas `SIGKILL` ni une coupure système.
- **Versions cohérentes** : restaurer une page restaure son contenu et ses styles locaux avec le thème global actuel, au lieu de réintroduire un ancien thème sur une seule page. Un snapshot publié restauré reste, lui, un snapshot complet immuable.
- **Renderer commun réel** : variables CSS et règles responsives/état sont appliqués dans le canevas, l’aperçu privé, l’aperçu IA et le site publié. Les styles d’un bouton ou d’une image ciblent aussi l’élément interne pertinent. Les préférences de réduction des animations sont respectées et un mode de réduction forcée est disponible.
- **Contrôles et diagnostic** : propriétés/valeurs CSS allowlistées, dégradés sans `url()`, variables expertes restreintes, références de presets vérifiées, ratios de contraste des paires principales affichés en mode expert. Le diagnostic ne prétend pas analyser les contrastes sur images ou dégradés.
- **IA visuelle structurée** : `updateTheme` et `updateStyle` rejoignent les opérations existantes, avec les mêmes schémas que l’éditeur, application sur une copie, aperçu avec le nouveau thème, annulation avant application puis undo/redo après application. Le mode démo produit localement des palettes et styles déterministes ; aucun appel distant n’est simulé.

## Comportements vérifiés par tests

- Idempotence IA : replay d’une réponse terminée sans doublon, refus d’une autre consigne avec la même clé, doublon actif refusé, bail expiré repris avec `attempts=2`, révision de page modifiée refusée et interruption réseau navigateur suivie d’un replay HTTP 200 identique.
- Motion de surface : révélation et état final statique, progression/compactage du header, ancre non masquée, contenu SSR sans JavaScript, reduced motion, largeur mobile, liens accessibles avant révélation et modales fixes ouvertes depuis le header comme depuis l’état vide du dashboard.
- Motion scroll de document : parallaxe IA annulée sans effet puis appliquée, undo/redo, amplitude conservée après rechargement, snapshot publié, progression réelle sans boucle, reduced-motion initial/dynamique et contenu SSR visible ; validation des cibles et du budget de trois effets.
- Design system : compatibilité d’un ancien document, normalisation idempotente, héritage desktop/tablette/mobile, priorité des exceptions, états, copie/reset, références de presets, dégradés sûrs, variables expertes, entrées CSS/URL hostiles et contrastes.
- Typographie : 50 familles et 500 styles uniques, dix graisses dans chaque plage réelle, signatures et licences des 50 assets, anciens thèmes sans requête, déduplication des `@font-face`, rejet d’URL injectée ; parcours Fraunces 600/Playfair Display 800 persisté et publié avec fontes réellement chargées.
- Persistance du thème sur deux pages : exception locale et racine préservées, révision obsolète refusée, restauration avec thème actuel, preset et tokens retrouvés dans le snapshot publié.
- Parcours navigateur de personnalisation : boutons stylés, preset partagé, copier/coller/reset, variable expert dans le padding, undo/redo, sauvegarde/rechargement, thème global, publication anonyme à 390 px et largeur mobile calculée.
- IA de thème : aperçu local sans mutation, annulation sans effet, application, undo/redo, sauvegarde/rechargement et mode sombre retrouvé. Scan axe sur toutes les sections avancées/expert et la palette automatique ouvertes.
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
- L’idempotence `page_edit` ne remplace pas une file de travaux : pas de worker autonome, pas de reprise sans nouvelle requête et pas de garantie exactly-once chez un fournisseur externe dans la fenêtre réponse fournisseur/enregistrement local. `project_create` n’est pas encore couvert.
- Les offres payantes restent sans montant configuré. Aucun prix n’a été inventé pour rendre le checkout artificiellement utilisable.
- Les domaines personnalisés ne sont pas encore routés par l’application et aucune émission TLS n’est incluse. La disponibilité d’un domaine chez un registrar n’est jamais présumée.
- Le français et l’anglais fonctionnent sur le shell, le dashboard, les libellés du wizard de création, les paramètres/membres, l’authentification et la console admin. De nombreuses variantes et entrées sectorielles utilisent encore le français comme fallback ; l’éditeur, les autres écrans du back-office, le marketing, les modèles et de nombreux messages serveur restent à traduire.
- Les audits axe automatisés ne remplacent pas une revue manuelle, un lecteur d’écran ou une certification WCAG. Aucun test avec lecteur d’écran n’a été réalisé.
- Les registres admin affichent les 100 entrées récentes et les 50 derniers audits ; la recherche actuelle filtre ce lot côté navigateur. Une pagination/recherche SQL est nécessaire pour administrer exhaustivement de très gros annuaires.
- La limitation de débit est en mémoire par instance. PGlite et les pilotes fichier ne conviennent pas à une production multi-instance.
- La collaboration ajoute seulement des comptes déjà inscrits ; il n’y a pas d’invitation email pour un nouvel utilisateur.
- Réservations sans moteur de disponibilité complet ; commandes sans encaissement, taxes, expédition ou logistique. Ces modules ne remplacent pas un ERP, LMS ou une marketplace.
- Les variantes du catalogue nommées marketplace, SaaS, LMS, portail patient, billetterie, dons ou paiement produisent seulement l’architecture éditoriale et les modules affichés comme disponibles. Leurs limites sont présentées dans le wizard ; aucun backend de ce type n’est simulé.
- Le catalogue typographique local couvre seulement le style normal et le sous-ensemble latin ; l’upload de fontes, les italiques et les autres sous-ensembles ne sont pas implémentés. Le lot personnalisation ne comprend pas encore les images/vidéos de fond, le recadrage média, les carrousels/lightbox, les timelines de scroll libres, le CSS arbitraire ou les scripts tiers. La parallaxe et les presets de progression bornés du lot `scroll-motion` ne constituent pas un éditeur de timeline. Les presets sont enregistrés par projet ; il n’existe pas encore de bibliothèque partagée entre projets ni de gestion visuelle complète de leur cycle de vie. L’application multiple cible les blocs d’un même type, pas une sélection arbitraire multiple.
- Le diagnostic de contraste couvre quatre paires par palette active, en hexadécimal. Il ne vérifie pas tous les états, images, dégradés ou composants et ne remplace pas un audit manuel.
- Le build PDF de la documentation de référence n’est pas livré ; les neuf SVG déjà produits restent des documents de référence, pas des tests applicatifs.

## État local de la preview

La preview courante utilise `.woob-data-runtime-v2`, initialisée par les migrations puis les parcours de test. L’ancienne `.woob-data-runtime`, devenue illisible après un arrêt brutal avec un WAL sans checkpoint valide, est conservée ainsi que `.woob-data-runtime-before-production-diagnostic`. Aucune réparation destructive ni restauration de ces anciennes données n’est déclarée ; le changement de répertoire est local à cette preview et ne fait pas partie du schéma applicatif.

## Prochaine priorité

Après les incréments `scene3d`, `surface-motion`, `scroll-motion`, `ai-idempotency` et `font-catalog-500`, la priorité d’architecture est d’étendre la reprise idempotente à `project_create`, puis d’évaluer un worker durable si une exécution sans requête devient nécessaire. Les preuves navigateur produit et corrections ciblées à cycles bornés restent nécessaires. La 3D reste limitée à deux presets procéduraux, sans timeline, modèles importés ni mesure Core Web Vitals. Les travaux déjà recensés restent ouverts : pagination/recherche SQL admin, traduction de l’éditeur et du reste du back-office, revue avec lecteur d’écran. Avec autorisation et comptes externes, un staging PostgreSQL/SMTP/S3 reste nécessaire pour tester sauvegardes et restauration, puis Stripe/OpenAI en sandbox et une plateforme DNS/TLS. Aucune dépense, publication ou validation externe n’est implicite.
