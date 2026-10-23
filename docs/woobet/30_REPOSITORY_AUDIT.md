# 30 — Audit du dépôt et vérifications d'environnement

## 1. Périmètre et méthode

Inspection effectuée le **2026-10-23** dans `/home/user/WOOB`, branche `arena/639e32e6-woob`, à la révision de départ `45f610d17290a3396bc58cfcbe6c4fd26ec67c45`. Commandes locales : `git status`, `git log`, `git ls-files`, listing de racine et lecture du README. Aucun fichier n'a été supprimé, aucun historique réinitialisé et aucune autre branche utilisée.

## 2. Faits vérifiés avant création documentaire

| Élément | Constat |
|---|---|
| Fichiers suivis | Uniquement `README.md` |
| Contenu | `# WOOB` |
| Code applicatif | Aucun |
| Manifeste npm/Python | Aucun |
| Tests, CI, Docker, IaC | Aucun |
| Schéma/base de données | Aucun |
| Documentation d'architecture | Aucune avant ce dossier |
| Historique visible | Commit initial `45f610d` ; checkout shallow/grafté indiqué par Git |
| État de la branche | Propre avant les ajouts documentaires |

**Qualité du code existant :** non évaluable, faute de code. **À conserver :** le README et l'historique. **À remplacer :** rien. Le nom du dépôt WOOB ne détermine pas à lui seul les noms de packages futurs ; le produit spécifié est WOOBET.

## 3. Outils locaux observés

| Outil | Version/état au moment de l'audit |
|---|---|
| Node.js | `v22.22.3` |
| npm | `10.9.8` |
| Python | `3.11.2` |
| pip | `23.0.1` |
| pnpm | Non trouvé dans PATH |
| pandoc / wkhtmltopdf / weasyprint / Chromium / LibreOffice / Graphviz | Non trouvés dans PATH à l'audit initial |
| Polices | DejaVu Sans/Serif/Mono disponibles |

L'absence d'un outil dans PATH n'est pas une preuve qu'il ne peut pas être installé. Le PDF est produit par l'outillage documentaire ajouté dans ce dossier ; ses versions et sa procédure sont consignées dans le rapport de génération.

## 4. Accès réseau et sources

L'environnement autorise les connexions sortantes vers des hôtes limités, dont `registry.npmjs.org`, `github.com`, `api.github.com`, `pypi.org` et les hôtes de paquets associés. Il n'offre pas un accès général garanti aux sites de documentation. Les métadonnées et README publiés avec les paquets npm ont été consultés via `npm view`. Les API précises des fournisseurs cloud, IA, DNS et paiement n'ont donc pas été affirmées comme vérifiées ; elles restent des spikes avec documentation officielle à consulter lorsque l'accès est disponible.

README consultés : `@nestjs/core` (description du cadre et adaptateurs Express/Fastify annoncés par le paquet) et `@dnd-kit/core` (positionnement React, performance/accessibilité annoncés par le projet). Ces descriptions ne sont pas des preuves d'adéquation WOOBET.

## 5. Versions npm observées le 2026-10-23

Les valeurs ci-dessous proviennent des `dist-tags` du registre npm à la date indiquée. Elles ne sont **ni des versions installées, ni des recommandations automatiques, ni une matrice de compatibilité testée**.

| Paquet | Tag `latest` observé | Commentaire |
|---|---|---|
| `typescript` | 7.0.2 | Tags beta/next également présents ; compatibilité à tester |
| `react` / `react-dom` | 19.3.1 | Backports et canaux canary existent |
| `next` | 16.4.2 | Plusieurs lignes backport visibles ; lire les guides de migration avant choix |
| `@nestjs/core` | 12.2.0 | Tags legacy/old/next présents |
| `prisma` | 8.0.0-rc.27 | Le tag latest observé pointe ici sur une RC ; `prev` = 7.10.1 |
| `@prisma/client` | 7.10.1 | Divergence CLI/client à analyser si Prisma est candidat |
| `drizzle-orm` | 0.45.4 | De nombreux tags expérimentaux ; ne pas les utiliser implicitement |
| `zod` | 4.6.7 | Validation runtime candidate |
| `bullmq` | 6.4.0 | Contrat worker à tester |
| `ioredis` | 6.0.0 | Compatibilité BullMQ/Redis à tester |
| `@dnd-kit/core` | 6.3.1 | Premier candidat de spike, non choix final |
| `@dnd-kit/sortable` | 10.0.0 | Compatibilité avec core à vérifier |
| `react-aria-components` | 1.22.1 | Candidate pour primitives accessibles |
| `@xyflow/react` | 12.12.0 | Pertinent pour graphes, pas nécessairement pour canvas de pages |
| `lexical` | 0.52.0 | Candidat texte riche seulement |
| `yjs` | 13.6.33 | Collaboration future ; non requis V1 |
| `vitest` | 5.0.5 | Compatibilité Node/TypeScript à vérifier |
| `@playwright/test` | 1.64.1 | Navigateurs non présents à l'audit |
| `eslint` | 10.13.0 | Plugins et configuration à valider |
| `prettier` | 3.9.10 | Version candidate après matrice |
| `@tanstack/react-query` | 5.104.5 | État serveur Studio seulement |
| `next-intl` | 4.14.9 | Candidat i18n ; compatibilité Next à tester |
| `react-intl` | 12.1.5 | Alternative i18n |
| `openai` | 7.43.0 | SDK seulement ; capacités de modèles non vérifiées |
| `@anthropic-ai/sdk` | 1.1.0 | SDK seulement ; aucune capacité supposée |
| `stripe` | 23.0.1 | SDK seulement ; fonctionnalités pays/Billing à vérifier |
| `jose` | 6.2.13 | Primitive JOSE si nécessaire, pas session complète |
| `argon2` | 0.45.1 | Binding et paramètres à valider sur runtime |

Une commande erronée `npm view dnd-kit/core` (paquet non scoped) a rencontré une erreur de connexion SSH vers GitHub ; elle n'a pas été utilisée comme source. La requête correcte `@dnd-kit/core` a fourni la valeur ci-dessus.

## 6. Conséquences pour l'architecture

- Aucun héritage technique n'impose React, Nest ou un ORM ; ce sont des recommandations.
- Les prototypes de phase 0 sont obligatoires avant de verrouiller les choix d'éditeur et de publication.
- Les versions doivent être choisies par matrice testée, lockfile et politique de correctifs, non par `npm install latest` généralisé.
- Les capacités cloud/DNS/TLS/IA/paiement et les prix doivent être vérifiés dans des comptes sandbox et la documentation officielle correspondante.
- Aucun test de performance, sécurité ou rendu n'a été exécuté sur une plateforme WOOBET inexistante.

## 7. Limites de cet audit

L'audit n'inclut pas de pénétration de fournisseurs, de validation de nom de domaine, de devis, de benchmark ou de revue juridique. Les résultats npm peuvent changer après la date. Les fichiers ajoutés ensuite par cette mission sont documentaires et ne constituent pas la fondation applicative de la phase 1.
