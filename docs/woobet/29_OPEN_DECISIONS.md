# 29 — Registre des décisions ouvertes et hypothèses

## 1. Règle

Une décision ouverte possède un propriétaire de rôle, une échéance de gate et une recommandation provisoire réversible. Elle ne doit pas être masquée par une valeur codée en dur. Les options non retenues restent visibles si elles changent les coûts ou la migration.

| ID | Question | Options et conséquences | Recommandation provisoire | Propriétaire / gate |
|---|---|---|---|---|
| OD-01 | Domaines réellement contrôlés et zone de publication | `.com`, `.app` ou autre ; disponibilité, marque, PSL et coût variables | Ne rien annoncer ; paramétrer la zone ; tester sur un domaine dédié | Produit + Ops / P00 |
| OD-02 | Cloud, CDN et offre custom hostnames | PaaS, conteneurs + CDN, providers multiples ; lock-in/coût/TLS différents | Hybride managé après spike DNS/TLS/cache | Architecture + Ops / P00 |
| OD-03 | Région et résidence des données | Une région initiale ou plusieurs ; coût et latence | Une région primaire avec sauvegardes distantes ; pays cibles à valider | Produit + Legal + Ops / P00/P12 |
| OD-04 | Matrice de versions JS | Latest stable, versions backport ou majeures antérieures ; compatibilité non démontrée | Matrice minimale testée puis lockfile ; ne pas prendre automatiquement `latest` | Lead technique / P01 |
| OD-05 | Gestionnaire de paquets/monorepo | npm workspaces, pnpm, Turborepo/Nx ; outillage et cache différents | Choisir le plus simple qui passe CI ; pnpm seulement si bénéfice démontré | Lead technique / P01 |
| OD-06 | ORM et migrations | Drizzle, Prisma, Kysely ; RLS et transactions à prouver | Drizzle + SQL après spike ; Prisma reste candidat | Backend / P01 |
| OD-07 | Adaptateur HTTP Nest | Express ou Fastify ; performance et écosystème | Benchmark et compatibilité avant choix | Backend / P01 |
| OD-08 | DnD et topologie canvas | dnd-kit, Pragmatic, framework ; iframe ou same-origin | Spike éliminatoire P00-T02 ; dnd-kit premier candidat | Frontend / P00/P04 |
| OD-09 | Éditeur de texte riche | Lexical, TipTap/ProseMirror, natif limité | Commencer texte simple ; comparer sérialisation/IME/accessibilité | Frontend / P04 |
| OD-10 | Store d'état et mutations | Store spécifique, Redux, Zustand, Immer | Frontière spécifique ; implémentation selon profils, pas selon popularité | Frontend / P04 |
| OD-11 | Source du schéma | JSON Schema source ou schéma TS runtime générateur | JSON Schema pour interchange ; spike expressiveté/performance | Architecture / P03 |
| OD-12 | Index public de routage | DB vues restreintes ou index objet/cache répliqué | Préférer artefacts publics/index isolé si latence et cohérence suffisantes | Publishing + Ops / P10 |
| OD-13 | Stratégie anciennes publications | Renderer compatible, versions de renderer ou artefacts statiques | Compatibilité testée + bundles immuables ; SSG sélectif possible | Renderer / P10/P12 |
| OD-14 | Fournisseur(s) IA et modèles | Un ou plusieurs, local/managé ; qualité/coût/résidence | Un primaire derrière port, secondaire testé avant dépendance commerciale | IA + DPO / P08 |
| OD-15 | Seuils quantitatifs de lancement IA | Validité, acceptation, qualité, coût et latence | Fixer après baseline sur corpus aveugle ; ne pas inventer un taux maintenant | IA + Produit / P08/P17 |
| OD-16 | Langues Studio et RTL | Français/anglais d'abord ou plus ; support et traduction coûtent | Décider marchés de lancement ; architecture prête sans activer un support incomplet | Produit / P13 |
| OD-17 | Plans, prix et pays de facturation | Gratuit/essai, devises, PSP/MoR, taxes | Moteur configurable ; prix après coûts/étude/juridique | Produit + Finance / P15/P18 |
| OD-18 | Quotas techniques finaux | Tailles, pages, trafic, rétention, concurrence | Valeurs de test provisoires ; ajuster après D0–D3/T1–T3 | Performance + Produit / P12/P15 |
| OD-19 | Politique d'expiration des sites | Lecture seule, dépublication, grâce et export | Ne jamais supprimer brutalement ; décision contractuelle avant facturation | Produit + Legal / P15 |
| OD-20 | Identité des utilisateurs finaux | Service par site, pool multi-tenant ou fédération | Ne pas réutiliser les sessions Studio ; ADR avant espaces membres | Security + Backend / P16/P19 |
| OD-21 | Sandbox de code utilisateur | Aucun code, packages revus ou runtime isolé | Aucun script arbitraire V1 ; P3 avec menace et budget dédiés | Security / P19 |
| OD-22 | Collaboration temps réel | Verrou optimiste, présence seule ou CRDT | V1 optimiste ; CRDT après preuve de besoin et migration de protocole | Produit + Editor / P19 |
| OD-23 | Organisation au-dessus des workspaces | Workspace = client, ou organisation agence avec sous-workspaces | Commencer workspace tenant ; prototyper UX agence avant ajout | Produit + Backend / P02/P15 |
| OD-24 | Analytics et observabilité hébergés | Managé, self-hosté, hybride ; coût/résidence/rétention | OpenTelemetry et stockage choisi après coût de cardinalité | Ops + DPO / P14 |
| OD-25 | Niveau de service et astreinte | Best effort, SLO interne, SLA 24/7 | Ne pas promettre 24/7 sans rotation ; définir après bêta | Ops + Direction / P17/P18 |

## 2. Hypothèses retenues pour pouvoir concevoir

- **H-01 :** le premier produit est un SaaS multi-workspace à locataire explicite, non une installation on-premise par client.
- **H-02 :** le périmètre V1 se concentre sur le moteur de création et la publication ; les modules transactionnels complets sont reportés.
- **H-03 :** l'équipe peut provisionner des environnements sandbox cloud/DNS/PSP/IA pour les preuves.
- **H-04 :** les documents de pages restent bornés ; les très grandes applications nécessitent décomposition et services métier.
- **H-05 :** les sites publics sont majoritairement cacheables, mais aucune distribution de trafic réelle n'est encore connue.
- **H-06 :** le produit peut fonctionner manuellement si l'IA est indisponible.
- **H-07 :** les langues, devises et fuseaux doivent être dynamiques même si les marchés initiaux sont limités.
- **H-08 :** les obligations juridiques précises seront revues par des professionnels pour les pays ciblés.

Si une hypothèse est invalidée, les ADR et la roadmap associés doivent être révisés avant de poursuivre sur la même base.
