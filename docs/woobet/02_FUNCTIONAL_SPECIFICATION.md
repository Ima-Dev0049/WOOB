# 02 — Cahier des charges fonctionnel

## 1. Convention de spécification

Les exigences sont identifiées pour la traçabilité. **MUST** est requis pour le jalon indiqué, **SHOULD** est recommandé, **MAY** est optionnel. Les phases renvoient au document 22. Toute règle côté client est répétée côté serveur lorsqu'elle affecte sécurité, quotas ou intégrité.

| Priorité | Signification |
|---|---|
| P0 | Bloque la bêta ou crée un risque d'intégrité/sécurité |
| P1 | Requis pour la V1 publique proposée |
| P2 | Après V1 ou activation par offre/module |
| P3 | Exploratoire, aucune promesse |

## 2. Comptes, workspaces et administration

| ID | Exigence | Priorité/phase | Vérification principale |
|---|---|---|---|
| F-IAM-001 | Inscription email/mot de passe, vérification et reprise de vérification | P0 / 2 | Intégration + anti-énumération |
| F-IAM-002 | Connexion, déconnexion, révocation de toutes les sessions | P0 / 2 | Tests de session et cookie |
| F-IAM-003 | Récupération de compte à jeton unique, court et non journalisé | P0 / 2 | Expiration, rejeu, énumération |
| F-IAM-004 | OAuth/OIDC avec liaison explicite et gestion des collisions d'email | P1 / 2 | Matrice des identités |
| F-IAM-005 | Création de workspace, invitation, acceptation, expiration et révocation | P0 / 2 | Transactions et permissions |
| F-IAM-006 | Rôles owner, admin, editor, contributor, viewer ; rôles personnalisés futurs | P0 / 2 | Matrice RBAC et IDOR |
| F-IAM-007 | Transfert de propriété avec réauthentification et audit | P1 / 2 | Double contrôle, dernier owner |
| F-IAM-008 | MFA et SSO d'entreprise | P2 / 19 | Protocoles et récupération |

Un utilisateur peut appartenir à plusieurs workspaces. Toute ressource tenant est résolue dans le contexte d'un workspace choisi ; un identifiant de projet ne suffit jamais à déduire une autorisation.

## 3. Projets, pages et navigation

| ID | Exigence | Priorité/phase | Règles |
|---|---|---|---|
| F-PRJ-001 | Créer, renommer, dupliquer, archiver et supprimer un projet | P0 / 3 | Suppression différée et export avant purge |
| F-PRJ-002 | Définir thème, locales, navigation, SEO et paramètres du projet | P0 / 3 | Révision optimiste et validation |
| F-PAG-001 | Créer, dupliquer, réordonner, renommer et archiver des pages | P0 / 3 | Chemins uniques par locale et publication |
| F-PAG-002 | Définir page d'accueil, page 404, brouillon privé et état noindex | P1 / 10 | Une seule racine résolue par locale |
| F-PAG-003 | Modifier le document par commandes, autosave et checkpoints | P0 / 4–7 | Aucun DOM comme source de vérité |
| F-PAG-004 | Comparer des versions et restaurer sans effacer l'historique | P1 / 7 | Restauration = nouvelle version |
| F-NAV-001 | Menus internes/externes, ancres, libellés localisés et états actifs | P1 / 6 | Liens internes résolus par IDs, pas seulement URL |
| F-NAV-002 | Détecter liens internes cassés et cibles non publiées | P1 / 10 | Rapport bloquant ou avertissement explicite |

La duplication d'un projet copie les documents et métadonnées nécessaires mais jamais les secrets d'intégration, domaines actifs, abonnements ou journaux d'audit. Les médias sont réutilisés par référence comptabilisée ou copiés selon la politique de quota.

## 4. Bibliothèque de composants

### 4.1 Catégories minimales

Structure : container, section, grille, flex, colonnes, séparateur. Contenu : titre, texte riche limité, bouton, icône, image, vidéo, galerie, carrousel, tableau. Navigation : header, footer, menu, fil d'Ariane, recherche. Preuve/conversion : témoignage, tarif, FAQ, statistique, comparateur, CTA, logo cloud. Données : liste, carte, filtres, pagination, collection repeater. Formulaires : champs, choix, date, consentement, fichier selon module. Métier : produit, menu, réservation et autres seulement via capacités déclarées.

### 4.2 Contrat d'un composant

Chaque définition possède :

- `componentId` stable, namespacé, par exemple `core.hero` ; `version` semver ;
- `kind` (`primitive`, `layout`, `composite`, `dynamic`, `business`, `custom`) ;
- `propsSchema`, valeurs par défaut et exemples valides/invalides ;
- variantes nommées et slots/enfants autorisés ;
- contraintes de parent, profondeur, nombre d'enfants et contenu ;
- points de personnalisation : tokens, styles, classes d'état et champs localisables ;
- règles responsive et comportement à chaque breakpoint ;
- événements autorisés et actions qu'ils peuvent déclencher ;
- dépendances de capacités (`media.read`, `forms.submit`, etc.) ;
- règles d'accessibilité, nom accessible, clavier et alternatives ;
- rendu de secours en cas de données absentes ou d'erreur ;
- migrations depuis les versions antérieures et politique de retrait ;
- visibilité des bundles et dépendances de rendu public.

**F-CMP-001 (P0/3–6) —** le serveur et le renderer rejettent un type/version inconnu selon une politique explicite. **F-CMP-002 —** une mise à jour du registre ne réécrit pas silencieusement les documents publiés. **F-CMP-003 —** chaque composant V1 dispose d'au moins un test de rendu, clavier, responsive, contenu vide/long et erreur.

### 4.3 Exemple normatif simplifié : `core.hero`

| Champ | Spécification |
|---|---|
| Propriétés | `eyebrow`, `title`, `body`, `mediaRef`, `primaryAction`, `secondaryAction`, `layout`, `height`, `contentWidth`, `align`, `tone`, `spacing`, `decorative` |
| Défauts | `layout=media-end`, `height=auto`, `contentWidth=container`, `align=start`, `spacing=section.md` ; textes vides non publiés comme faux contenu |
| Variantes | `media-end`, `media-background`, `centered`, `split` ; chaque variante respecte le même schéma sémantique |
| Contraintes | Un seul titre de niveau choisi selon contexte ; média de fond décoratif ; deux actions maximum en mode simple |
| Responsive | Ordre du média et du texte configurable ; aucun chevauchement obligatoire ; tailles via tokens fluides |
| Événements | Navigation et action déclarée seulement ; pas de JavaScript libre |
| Accessibilité | Contrastes AA, alternatives d'image, cible de bouton explicite, aucun texte essentiel dans une image |
| Erreur | Média absent : mise en page sans média ; action invalide : avertissement d'édition et action absente au public |
| Migration | Toute propriété renommée possède une migration pure et testée avant chargement |

## 5. Design tokens, thèmes et variantes

**F-THM-001 (P0/3–6) —** les tokens sont organisés en trois couches : primitives (palette brute), sémantiques (`surface.default`, `text.primary`, `action.primary.bg`) et composants (`hero.title.size`). Les documents référencent prioritairement les tokens sémantiques.

**F-THM-002 —** un thème définit couleurs, typographies, espacements, rayons, bordures, ombres, tailles de conteneur, breakpoints, transitions et mode sombre éventuel. Les valeurs ont des types et contraintes ; les contrastes critiques sont contrôlés.

**F-THM-003 —** l'ordre de résolution de style est : défaut du composant → variante → thème/tokens → style global autorisé → style d'instance → override de breakpoint → état interactif. La cascade réelle doit rester déterministe et inspectable ; les règles spécifiques priment selon ce modèle, sans `!important` utilisateur dans le socle.

**F-THM-004 —** les kits de marque regroupent logo, tokens, polices licenciées et exemples d'usage. Une police externe n'est pas supposée libre de droits.

## 6. Templates et bibliothèques

| ID | Exigence | Détails |
|---|---|---|
| F-TPL-001 | Templates de site, page, section et bloc | Manifeste, aperçu, version, dépendances, locales et licence |
| F-TPL-002 | Variantes de style et modèles sectoriels | Le secteur ajoute structure/contenu, pas une fausse capacité métier |
| F-TPL-003 | Bibliothèques privées de workspace/agence | RBAC, quotas, audit, export |
| F-TPL-004 | Import/export signé par checksum et validé | Aucun secret ou donnée personnelle dans l'archive |
| F-TPL-005 | Mise à jour non destructive | Diff, migration explicite, possibilité de rester sur une version |
| F-TPL-006 | Templates communautaires et marché | P2/P3 : modération, licence, attribution, revenus, retrait et scan |

Un manifeste identifie `templateId`, `version`, `schemaRange`, `componentDependencies`, `assetLicenses`, `defaultLocales`, `requiredCapabilities`, `author`, `license`, `checksum`. L'import échoue avant écriture si une dépendance obligatoire manque.

## 7. Éditeur simple et avancé

### Mode simple — P0/P1 phases 4–6

Ajouter/réordonner/supprimer/dupliquer des sections ; déplacer les blocs autorisés ; éditer texte et boutons ; remplacer médias ; modifier couleurs, typographies et espacements parmi des choix sûrs ; changer de template par aperçu de migration ; prévisualiser ; annuler/rétablir ; autosave. Les actions destructrices demandent une confirmation proportionnée et restent réversibles lorsque possible.

### Mode avancé — P1 phase 5

Arborescence et sélection hiérarchique ; panneau de propriétés ; largeur/hauteur/min/max ; alignement ; marges/padding ; positionnement restreint ; grid/flex ; breakpoints ; styles hérités ; variables ; états hover/focus/active/disabled ; animations et transitions ; visibilité ; interactions déclaratives ; historique détaillé ; raccourcis ; gestion des conflits. La gestion libre de calques n'est pas requise sauf prototype démontrant une valeur supérieure à sa complexité.

### Exigences transverses

- **F-EDT-001 :** chaque commande porte `commandId`, `actorId`, `baseRevision`, `timestamp`, `scope`, `payload` et inverse ou mécanisme d'inversion.
- **F-EDT-002 :** l'autosave distingue `localDirty`, `saving`, `saved`, `offline`, `conflict`, `error` ; un indicateur « enregistré » ne s'affiche qu'après accusé serveur.
- **F-EDT-003 :** la récupération locale chiffrée/protégée selon la menace est proposée après interruption, jamais appliquée au-dessus d'une révision plus récente sans diff.
- **F-EDT-004 :** deux onglets reçoivent une notification de révision ; la V1 utilise verrouillage optimiste et résolution utilisateur, pas CRDT implicite.
- **F-EDT-005 :** les gros documents sont chargés par page et par composants visibles ; les opérations ne parcourent pas inutilement tout le projet.

## 8. Responsive

Trois presets initiaux sont proposés : mobile, tablette, desktop, avec valeurs techniques définies par le thème plutôt que codées en dur dans les documents. Les breakpoints ne prétendent pas représenter tous les appareils. Le renderer utilise des règles adaptatives et des conteneurs lorsque pertinent.

Un style de base est hérité ; un override ne contient que les propriétés divergentes. Une adaptation automatique (par exemple passage de grille à une colonne) est une règle du composant, visible dans l'aperçu, et ne doit pas être confondue avec un override utilisateur. L'utilisateur peut réinitialiser un override et inspecter son origine.

## 9. Intelligence artificielle

| ID | Exigence | Priorité/phase | Garantie |
|---|---|---|---|
| F-AI-001 | Générer plan, arborescence, pages, sections, thème, contenu initial, navigation et SEO | P1 / 8 | Sortie structurée validée ; aperçu avant acceptation |
| F-AI-002 | Proposer des visuels et leurs métadonnées | P1 / 8 | Origine/licence ; aucune URL privée pérenne |
| F-AI-003 | Modifier style, section, mobile, page, formulaire, thème ou lisibilité par conversation | P1 / 9 | Patch limité à la sélection/révision |
| F-AI-004 | Créer une variante et revenir à la précédente | P1 / 9 | Nouvelle version, diff et undo |
| F-AI-005 | Traduire un contenu | P2 / 13 | Brouillon, locale cible et revue humaine |
| F-AI-006 | Annuler une tâche et reprendre après erreur fournisseur | P1 / 8–9 | Idempotence, étapes reprises sans double facturation interne |
| F-AI-007 | Budget, quota, logs et évaluation | P0 / 8 | Refus gracieux avant dépassement ; coût réel du fournisseur rapproché |

L'IA ne peut pas changer rôles, domaines, secrets, plan de facturation ou publication sans une commande utilisateur distincte et les permissions adéquates.

## 10. Médias

Import par upload direct autorisé, organisation en dossiers/tags, recherche, réutilisation, métadonnées, texte alternatif, droits d'usage, variantes, recadrage focal, compression et suppression contrôlée. Formats initiaux : JPEG, PNG, WebP, SVG assaini, AVIF si le pipeline le valide ; vidéo via formats et capacité explicitement supportés. Les types sont déduits du contenu et non de la seule extension. Les SVG actifs, scripts, macros et polyglottes sont traités selon le modèle de menace.

**F-MED-001 :** un média publié dispose d'une URL publique stable ou d'une copie de publication immuable ; jamais d'URL signée expirant dans un document public. **F-MED-002 :** une suppression référencée est bloquée ou précédée d'une migration. **F-MED-003 :** les assets générés par IA portent origine, modèle/fournisseur si disponible, date et informations de licence connues.

## 11. Publication, domaines et SEO

Les exigences détaillées sont dans le document 10. Fonctionnellement : validation de prévol ; création du bundle ; vérifications ; activation atomique ; routage ; invalidation ; sonde ; confirmation ; rollback. L'utilisateur distingue brouillon, checkpoint, publication en cours, active, échouée et archivée.

Sous-domaines : réservation, normalisation ASCII, longueur et caractères, liste de noms réservés, unicité globale, anti-squatting, changement avec redirection temporaire, suspension et purge. Domaines personnalisés : preuve de propriété, DNS, TLS, états, erreurs, renouvellement, racine/www, suppression et prévention des doublons.

SEO : titres/descriptions, canoniques, Open Graph, robots, sitemap par site/locale, redirections 301/302, 404 personnalisée, `noindex` pour brouillons/prévisualisations, hreflang et données structurées seulement avec schémas valides. Aucun résultat de classement n'est garanti.

## 12. Collections et extensions

**F-COL-001 (P1/P2 phase 16) —** un workspace peut définir des collections limitées : champs typés, validation, identifiant, slug, dates, statut, locale et relations contrôlées. Les requêtes publiques sont déclaratives, limitées et compilées ; aucun SQL utilisateur.

**F-EXT-001 —** une extension possède manifeste, version, permissions, schéma de configuration, événements consommés, composants fournis, limites et politique de désinstallation. Les secrets restent dans le coffre et ne sont jamais exposés au renderer ou au navigateur.

**F-EXT-002 —** les webhooks sortants ont signature, horodatage, ID de livraison, retry avec backoff, dead letter et protection SSRF. Les scripts et composants arbitraires sont P3, isolés sur origine séparée avec budget CPU/mémoire/réseau ; ils ne sont pas une conséquence implicite du composant personnalisé déclaratif.

## 13. Formulaires et capacités métier V1

Le socle V1 propose formulaires de contact/prospect : schéma de champs, validation, consentement, stockage chiffré selon classification, notification, export et rétention. Il ne prétend pas fournir campagnes marketing complètes, automation générale, réservation ou paiement.

Les modules e-commerce, réservation, formation, marketing et applications métier disposent chacun d'un cahier des charges annexe avant activation. Les fonctionnalités et dépendances sont détaillées dans le document 15.

## 14. Internationalisation

Interface de gestion traduite par clés ; contenu localisé par entrées ; formats de nombres/date selon locale et fuseau explicite ; devises ISO et montants entiers ; RTL testé avant activation ; slugs localisés ; hreflang ; emails par locale ; politiques régionales. Le fallback de traduction est visible dans l'éditeur et journalisé dans le manifeste de publication.

## 15. Facturation, offres et quotas

Plans Gratuit, Personnel, Professionnel, Business, Agence et Entreprise sont des **conteneurs d'entitlements**, pas des prix figés. Le système gère essai, abonnement, changement, prorata délégué au prestataire mais rapproché localement, annulation, impayé, expiration, remboursement enregistré et webhooks idempotents.

Quotas : sites, pages, stockage, taille de média, trafic, requêtes, tâches, crédits IA, formulaires, domaines et intégrations. Les dépassements peuvent bloquer, avertir ou facturer selon une politique explicite ; aucun prélèvement variable sans consentement et plafond. Les sites déjà publiés ne sont pas supprimés automatiquement à l'expiration : une politique de grâce, dégradation et export est définie.

## 16. Notifications, recherche et exports

- notifications in-app et email pour publication, domaine, invitation, facturation et échec de tâche ;
- centre de tâches avec progression et erreur actionnable ;
- recherche dans projets/pages/assets par workspace, avec filtre tenant en base ;
- export des documents, manifestes et médias selon quota ; format versionné ;
- suppression et export de données personnelles selon procédure, sans promettre l'effacement immédiat des sauvegardes avant expiration.

## 17. Exigences d'administration interne

Console interne séparée, moindre privilège et MFA : consulter états techniques, suspendre un site abusif, rejouer une tâche sans dupliquer ses effets, gérer noms réservés, suivre quotas et incidents. Toute impersonation est interdite par défaut ; si une assistance avec accès au contenu est introduite, elle exige consentement, durée limitée, motif et audit inviolable.

## 18. Hors périmètre explicite de la V1

Collaboration temps réel, marché communautaire, exécution de scripts arbitraires, multi-région actif-actif, moteur complet d'automation, e-commerce/LMS/marketplace complets, import pixel-perfect de sites tiers, garantie SEO ou de revenus. Ces éléments restent dans la vision mais ne doivent pas bloquer ni fragiliser le socle.
