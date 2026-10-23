# 08 — Schéma de pages et moteur de rendu

## 1. Objectifs du format

Le `PageDocument` est le contrat central entre éditeur, IA, templates, validation et rendu. Il doit être déterministe, versionné, validable sans fournisseur externe, migrable, limité en taille et indépendant d'un framework UI. Le JSON canonique ne contient ni fonction, ni code, ni secret, ni HTML arbitraire.

Les artefacts associés sont `schemas/page-document-v1.schema.json`, `examples/page-document-v1.json` et les types TypeScript générés/contrôlés lors de la phase 3. L'exemple du dossier est une base de spécification, pas encore un validateur exécuté.

## 2. Documents distincts

| Document | Contenu | Visibilité |
|---|---|---|
| `DraftDocument` | Données d'édition, commentaires futurs, références internes, métadonnées de révision | Membres autorisés |
| `PreviewDocument` | Projection du brouillon avec capabilities simulées et jeton d'aperçu court | Auteurs autorisés ; noindex |
| `PublicPageDocument` | Contenu publiable, styles publics, références d'assets immuables, interactions autorisées | Renderer public et visiteurs selon rendu |
| `PublicationManifest` | Routes, locales, checksums, versions de schéma/renderer/composants, assets, redirections | Interne + projection nécessaire au routage |
| `TemplateDocument` | Structure et contenus d'exemple, dépendances et licence | Selon bibliothèque |

Un brouillon n'est jamais envoyé tel quel au renderer public. La projection retire commentaires, champs internes, IDs d'intégration et valeurs non publiées.

## 3. Structure conceptuelle v1

```json
{
  "schema": "https://schema.woobet.invalid/page-document/v1",
  "schemaVersion": "1.0.0",
  "documentId": "doc_01...",
  "pageId": "01...",
  "revision": 12,
  "metadata": {
    "title": {"fr": "Accueil"},
    "description": {"fr": "Description"},
    "path": {"fr": "/"},
    "robots": "index,follow"
  },
  "theme": {"themeId": "theme_01...", "version": "1.0.0", "overrides": {}},
  "root": {
    "id": "node_root",
    "type": "core.page",
    "version": "1.0.0",
    "props": {},
    "styles": {},
    "children": []
  },
  "assets": {},
  "dataBindings": {},
  "interactions": {},
  "capabilities": []
}
```

`schema.woobet.invalid` est volontairement un identifiant non résoluble de spécification ; il ne prétend pas qu'un domaine est configuré. La représentation finale peut utiliser un URI URN pour éviter toute confusion avec une ressource réseau.

## 4. Types TypeScript conceptuels

```ts
type LocalizedText = Record<string, string>;
type NodeId = string;

type BreakpointOverride = {
  breakpoint: string;
  styles: Record<string, string | number | null>;
  props?: Record<string, unknown>;
};

type PageNode = {
  id: NodeId;
  type: string;
  version: string;
  props: Record<string, unknown>;
  styles: Record<string, string | number>;
  children?: PageNode[];
  slots?: Record<string, PageNode[]>;
  overrides?: BreakpointOverride[];
  visibility?: VisibilityRule;
  interactions?: InteractionRef[];
};

type PageDocument = {
  schemaVersion: string;
  documentId: string;
  pageId: string;
  revision: number;
  metadata: PageMetadata;
  theme: ThemeReference;
  root: PageNode;
  assets: Record<string, AssetReference>;
  dataBindings: Record<string, DataBinding>;
  interactions: Record<string, DeclarativeInteraction>;
  capabilities: string[];
};
```

Ces types ne remplacent pas le schéma runtime. La stratégie recommandée est une source JSON Schema pour interchange et contrats, avec génération de types et validateurs ; si l'expressivité devient insuffisante, un schéma TypeScript runtime peut être source à condition de produire un JSON Schema complet et testé. L'ADR tranche après spike.

## 5. Invariants et validation

1. Versions semver et identifiants stables valides ; profondeur/nœuds/taille bornés.
2. `root` unique, arbre acyclique par construction, IDs uniques dans le document.
3. Chaque type/version existe dans le registre et ses props satisfont le schéma.
4. Parent, slots et enfants respectent les contraintes ; aucune référence circulaire de données non résolvable.
5. Chaque `assetId`, `pageId`, token, interaction et binding est déclaré et autorisé dans le workspace/projet.
6. Les styles appartiennent à une allowlist par composant ; unités et valeurs sont typées.
7. Les clés de locale sont déclarées dans le projet ; les fallback sont explicites.
8. Les chemins sont normalisés et uniques par locale au niveau du manifeste.
9. Les capacités demandées sont évaluées côté serveur ; leur simple présence ne les octroie pas.
10. Aucune clé `__proto__`, `constructor`, code, URL `javascript:` ou champ secret n'est acceptée.

Le validateur produit des erreurs stables et localisables. Les erreurs de prépublication incluent un chemin JSON et un `nodeId` lorsque possible.

## 6. Propriétés localisées et contenu riche

Les champs localisables sont déclarés par le composant ; tout texte n'est pas automatiquement un dictionnaire de toutes les locales. Le schéma peut représenter une valeur `{"type":"localized","values":{"fr":"...","en":"..."}}` ou des `translation_entries` externes selon le type de contenu. Le choix doit éviter de dupliquer les gros contenus structurés dans chaque page.

**Recommandation V1 :** petits textes de page dans le document ; contenus éditoriaux longs/réutilisables dans collections et `translation_entries`. Le manifeste fige les références et leurs versions. Le texte riche est un arbre limité (`paragraph`, `heading`, `link`, `strong`, etc.) avec sanitation à l'entrée et échappement à la projection.

## 7. Registre de composants

Le registre logique contient : identifiant, versions, schéma, migrations, renderer public, adaptateur d'édition, manifeste d'assets, règles de composition, capacités et statut (`experimental`, `stable`, `deprecated`, `retired`). Les mappings de code résident dans le bundle applicatif ; la base ne stocke pas de code exécutable.

Une publication enregistre les versions exactes. Deux stratégies sont possibles pour les anciennes publications : conserver l'artefact HTML/statique ou le bundle de renderer compatible ; ou reconstruire avec migrations. La V1 privilégie des bundles de documents immuables + politique de compatibilité du renderer et tests sur corpus. La rétention des anciens renderers doit être bornée et annoncée.

## 8. Migrations de schéma

Une migration est une fonction pure `document[n] -> document[n+1]`, déterministe, idempotente sur son domaine d'entrée, sans réseau, testée sur corpus et accompagnée d'un rapport. Elle ne consulte pas le fournisseur IA.

Processus : détecter version → vérifier qu'elle est supportée → copier → appliquer les migrations successives → valider → comparer les invariants → sauvegarder comme nouvelle révision. Une publication ancienne n'est pas migrée en place. Une migration impossible laisse l'original intact et exige une action.

Tests de compatibilité : golden files de chaque version, propriétés de non-perte, migration aller sur corpus, rendu avant/après, templates et documents IA. Les rollbacks de code doivent pouvoir lire les documents écrits par la version précédente selon une fenêtre de compatibilité définie.

## 9. Règles de rendu

1. Résoudre le manifeste, la locale, le thème et les références immuables.
2. Vérifier le schéma public et le budget de complexité.
3. Construire un arbre de projection : composant enregistré + props assainies + enfants.
4. Appliquer styles/tokens et générer des classes/styles contrôlés.
5. Charger seulement les données dynamiques autorisées avec deadline.
6. Produire head/SEO, HTML, CSS et scripts d'interaction nécessaires.
7. En cas d'erreur : fallback du composant ; page d'erreur contrôlée si racine impossible ; logs par ID, sans contenu.

Le rendu doit être déterministe pour les mêmes document, locale, versions et données. Les valeurs aléatoires, dates implicites et données personnelles ne doivent pas contaminer un cache partagé.

## 10. Gestion d'erreurs

| Erreur | Éditeur | Prévol | Public |
|---|---|---|---|
| Composant inconnu | Placeholder bloquant et migration | Bloquant | Ancienne publication ; fallback si nouvelle déjà active |
| Prop invalide | Champ/node en erreur | Bloquant si rendu impossible | Valeur par défaut seulement si contrat sûr |
| Asset manquant | Sélecteur et alerte | Bloquant ou warning selon obligatoire | Alternative/fallback sans URL cassée |
| Donnée dynamique indisponible | État simulé identifié | Non testé exhaustivement | Fallback + timeout + métrique |
| Lien interne cassé | Navigation vers cible | Bloquant pour lien obligatoire | Lien désactivé ou 404 contrôlée |
| Version non supportée | Proposition migration/export | Bloquant | Renderer compatible ou ancienne version |

Les fallbacks ne doivent pas masquer une corruption systémique : le taux de fallback est une métrique et une alerte.

## 11. Taille, complexité et cache

Limites proposées dans le document 03. Le manifeste contient taille et checksum de chaque artefact. Les caches sont indexés par `publicationId + route + locale + rendererVersion + variant`. L'invalidation par tags ou clés de version évite une purge globale. Les assets immuables ont cache long ; le HTML a une politique de fraîcheur courte ou validation selon plateforme.

## 12. Comparaison SSR/SSG/ISR/CSR

Le SSR à la demande avec cache CDN est le défaut proposé pour éviter un build par site. Le SSG est préférable pour certains sites stables après mesure du coût de builds et de stockage. L'ISR est un mécanisme dépendant de la plateforme, à n'utiliser que si la cohérence des versions et les invalidations sont démontrées. Le CSR est réservé aux îlots interactifs et applications privées, pas au contenu SEO principal.

Pour un site avec comptes/membres, les parties publiques et privées ont des caches séparés ; les réponses privées sont `private, no-store` selon cas. Aucun document privé n'est inclus dans un payload préchargé public.

## 13. SEO et sécurité du contenu

Le head est généré depuis les métadonnées validées : titre, description, canonique absolue sur le domaine actif, hreflang, robots, Open Graph et JSON-LD validé. Les chaînes sont échappées ; JSON-LD n'autorise pas de script utilisateur. Le HTML riche est assaini, les URLs contrôlées et les SVG servis de façon non active ou assainie.

Les réponses d'aperçu portent `noindex, nofollow`, protection d'accès et en-têtes empêchant la mise en cache partagée. Un aperçu ne doit pas être indexé par simple obfuscation d'URL.

## 14. Tests de conformité

- JSON Schema positifs/négatifs et fuzzing borné ;
- propriétés des migrations et golden files ;
- chaque composant × contenu court/long/vide/invalide × breakpoints × locales/RTL ;
- snapshots HTML et accessibilité ;
- fuite de champs internes/secrets dans la projection ;
- absence de bundle d'édition ;
- déterminisme et checksums ;
- ancienne version rendue après upgrade ;
- timeout de binding et fallback ;
- performance et cache hit/miss.

## 15. Artefacts à implémenter en phase 3

Schéma formel, types, validateur, registre minimal (`core.page`, `core.section`, `core.text`, `core.heading`, `core.button`, `core.image`, `core.container`), migrations fictives de test, projection publique, renderer SSR, corpus et rapports. La phase ne passe pas à l'éditeur complet avant que ces contrats soient stables et testés.
