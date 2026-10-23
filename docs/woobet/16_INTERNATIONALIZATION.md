# 16 — Internationalisation

## 1. Deux domaines de langue distincts

La langue du **Studio** est une préférence de l'utilisateur (`users.ui_locale`) ; les langues d'un **site** sont des données du projet (`locales`, contenus et traductions). Changer l'une ne change jamais l'autre. La devise, le fuseau et le format régional sont également indépendants de la langue : un utilisateur peut gérer en français un site anglais affichant des USD et des horaires à New York.

## 2. Interface de gestion

- clés de messages stables, jamais de texte source comme identifiant de traduction ;
- catalogue par locale avec pluriels, genres lorsque nécessaire, interpolation typée et règles ICU validées par la bibliothèque choisie ;
- `next-intl` et `react-intl` sont des candidates ; la compatibilité Next/React et le support des messages sont testés avant sélection ;
- formats de dates/nombres via APIs de locale ; fuseau explicite dans les écrans métier ;
- fallback `fr → en` ou autre chaîne configurée, affiché aux traducteurs, sans mélange silencieux dans une phrase ;
- extraction en CI et contrôle de clés manquantes/obsolètes ; aucune concaténation de fragments pour construire une phrase ;
- emails et erreurs utilisent les mêmes catalogues ou un package partagé adapté.

La locale initiale proposée est définie par le produit ; le dossier est rédigé en français mais n'impose pas le français comme seule langue V1. Les langues de lancement sont une décision ouverte de contenu et de support.

## 3. Contenus de sites

Un projet déclare une locale par défaut et des locales additionnelles avec `code`, direction, fallback et statut. Les petits textes de composants sont localisés dans le document ; les contenus éditoriaux réutilisables utilisent `translation_entries` ou des records localisés. Les assets peuvent varier par locale et posséder des alt texts localisés.

Une page peut être : non commencée, en traduction, prête, publiée ou obsolète par rapport à la source. La traduction IA produit un brouillon avec `ai_generation_id` et `source_hash`. Une modification de la source marque les traductions potentiellement obsolètes sans les effacer.

Le fallback public est explicite : soit afficher la locale par défaut avec canonique correcte et indication éditoriale, soit ne pas publier la route localisée. Ne pas produire plusieurs URLs au contenu identique sans stratégie canonique/hreflang.

## 4. URLs localisées

Stratégie recommandée : préfixe de chemin `/fr/...`, `/en/...` pour les locales non par défaut et politique configurable pour la locale par défaut. Le manifeste assure l'unicité `(locale,path)`. Les slugs sont localisés mais liés à une page stable par ID.

Le sitemap et chaque page listent les alternatives hreflang réciproques publiées ; `x-default` pointe vers une page choisie. Les changements de locale ou de structure d'URL créent des redirections et une revue SEO. Les domaines par langue sont une option future, non nécessaire à la V1.

## 5. Formats régionaux, fuseaux et devises

- dates stockées en UTC pour les instants ; une réservation de future génération stocke aussi le fuseau IANA et parfois l'heure locale voulue pour gérer DST ;
- dates sans heure (`LocalDate`) pour anniversaires ou menus selon sémantique ; ne pas les convertir arbitrairement en UTC ;
- nombres et pourcentages formatés par locale ; les valeurs persistées restent numériques ;
- montants en unités mineures + devise ISO 4217 ; une locale ne détermine pas la devise ;
- adresses, noms et numéros de téléphone ne suivent pas un format unique mondial ; validation adaptée au pays et usage ;
- calendriers et premier jour de semaine via bibliothèque de locale ; semaines de facturation en UTC clairement indiquées si nécessaire.

Exemple de test DST : une réservation à 02:30 lors d'un changement d'heure peut être inexistante ou ambiguë ; le module doit refuser ou demander un choix, pas trancher silencieusement.

## 6. RTL et bidirectionnel

Le document public pose `lang` et `dir` au niveau approprié ; les composants utilisent propriétés logiques CSS (`margin-inline`, `inset-inline`) plutôt que gauche/droite lorsque possible. Les icônes directionnelles peuvent être inversées, mais pas les icônes universelles ni les médias.

Le Studio doit rester utilisable en RTL si une locale RTL est activée ; sinon cette capacité n'est pas annoncée. Tests : arbre, navigation, sliders, breadcrumbs, carrousels, mixed text, chiffres, URLs et champs isolés avec contrôles Unicode bidi contre le spoofing.

## 7. SEO et emails multilingues

Chaque route a titre, description, alt, canonique et données structurées dans sa locale. Les traductions automatiques ne sont pas présentées comme relues. Les emails transactionnels choisissent la locale du destinataire avec fallback, fuseau d'affichage et liens vers la bonne langue ; les jetons ne figurent pas dans les analytics.

## 8. Régionalisation juridique et facturation

Consentement, bannières, politique de confidentialité, mentions légales, cookies et rétention varient selon juridiction. WOOBET fournit des emplacements et configurations, pas un avis juridique automatique. Les textes par défaut doivent être revus par des professionnels pour les marchés ciblés.

La facturation enregistre adresse/pays, devise, taxes et identifiants requis selon le prestataire et la juridiction. Les prix, invoices et remboursements ne sont pas convertis par simple arrondi visuel. La résidence des données et les transferts IA/analytics sont documentés séparément de la traduction.

## 9. Accessibilité linguistique

`lang` sur le document et passages en langue différente ; titres et messages compréhensibles ; expansion de texte testée (+30 à +100 % selon langue) ; pas de texte essentiel dans les images ; polices couvrant les scripts ; line-break et truncation non destructifs ; lecteurs d'écran testés sur les langues de lancement.

## 10. Implémentation technique

Le Studio charge les catalogues par locale et route ; les sites ne chargent que les textes nécessaires à la route. Les catalogues ont version/checksum et fallback. Les locales sont validées contre BCP 47 à l'aide d'une bibliothèque, les fuseaux contre la base IANA et les devises contre ISO. Les traductions de contenu ne passent pas dans les URLs signées ou logs.

## 11. Tests

Clés manquantes et pluriels ; allemand long, français, anglais, arabe/hébreu si activés, langues CJK si activées ; slugs Unicode et IDN ; fallback ; hreflang réciproque ; dates DST ; montants JPY sans décimales et devise à trois décimales si supportée ; email dans la bonne langue ; suppression d'une locale référencée ; import/export ; tri et recherche ; expansion de l'UI ; RTL mixte.

## 12. Décisions de lancement

Langues Studio et langues de documentation/support, stratégie de préfixe pour la locale par défaut, locales RTL activées, pays de facturation, textes juridiques, région de données et fournisseurs de traduction restent des décisions produit/ops. Elles sont listées dans le registre des décisions ouvertes et ne doivent pas être codées en dur.
