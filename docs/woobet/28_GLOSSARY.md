# 28 — Glossaire

| Terme | Définition WOOBET |
|---|---|
| AC / critère d'acceptation | Condition vérifiable liée à une exigence et une preuve |
| ADR | Architecture Decision Record : contexte, options, décision, conséquences et révision |
| Asset | Métadonnées d'un média ; le binaire est dans le stockage objet |
| Asset publié | Copie ou référence immuable autorisée pour une publication, avec URL pérenne |
| Audit log | Événement append-only d'une action sensible, sans secret ni contenu inutile |
| Binding | Liaison déclarative entre une propriété/composant et une donnée autorisée |
| Breakpoint | Point de rupture nommé du thème pour les overrides responsive |
| Brouillon | Document courant mutable avec révision optimiste ; non visible publiquement |
| Bundle de publication | Ensemble immutable de documents, manifeste et artefacts nécessaires au rendu |
| Canal/canary | Déploiement progressif sur une portion contrôlée avant généralisation |
| Capacité (`capability`) | Fonction technique accordée par module, plan et permission ; non auto-accordée par le document |
| Checkpoint | Version immuable d'un brouillon à un instant donné |
| Collection | Modèle de données métier limité avec champs et records validés |
| Commande | Mutation atomique et validée du document, utilisée par éditeur et IA |
| Composant | Type/version enregistré avec props, styles, contraintes, rendu et accessibilité |
| Composant personnalisé | Composant déclaratif ou package revu ; ne signifie pas script arbitraire |
| Contrat API | DTO, erreurs, règles de concurrence et compatibilité exposés aux consommateurs |
| Contributor | Rôle de contribution de contenu sans droits structurels/publication par défaut |
| CWV | Core Web Vitals : LCP, INP et CLS, mesurés en labo et/ou terrain |
| Design token | Valeur nommée primitive, sémantique ou de composant utilisée pour la cohérence visuelle |
| DLQ | File d'échecs terminaux nécessitant inspection et rejeu contrôlé |
| Document public | Projection du brouillon sans données internes, destinée au renderer public |
| Domaine canonique | Hôte principal vers lequel les variantes sont redirigées |
| Domaine custom | FQDN appartenant à un utilisateur et vérifié avant activation |
| Draft revision | Compteur de concurrence du brouillon, non version immuable |
| DTO | Objet de transfert validé à la frontière, distinct de l'entité DB |
| Éditeur avancé | Mode exposant arbre, styles, responsive et interactions sans changer le document |
| Éditeur simple | Mode guidé de modifications sûres de contenu, sections et préréglages |
| Entitlement | Droit effectif booléen/numérique calculé depuis plan, add-ons, état et overrides |
| Epic | Ensemble cohérent de fonctionnalités/tâches dans une phase |
| Extension | Package versionné déclarant composants, permissions, événements et configuration |
| Fallback | Comportement de secours défini en cas de donnée/composant/provider indisponible |
| Feature flag | Commutateur de release avec propriétaire, portée et expiration |
| FQDN | Nom de domaine pleinement qualifié, normalisé pour le routage |
| Gate | Revue de phase avec preuves et décision go/no-go |
| Hébergement multi-tenant | Partage contrôlé d'infrastructure avec isolation des données et ressources |
| Idempotence | Propriété garantissant qu'une intention rejouée ne produit pas d'effet dupliqué |
| IDN | Nom de domaine internationalisé, traité en U-label/A-label avec contrôles |
| Invariant | Règle qui doit rester vraie après chaque opération |
| ISR | Régénération statique incrémentale, seulement si cohérence démontrée |
| JSON Schema | Contrat de validation runtime du document JSON |
| Locale | Langue/région BCP 47 d'un contenu ou de l'interface |
| Manifeste | Index immutable d'une publication/template avec versions, routes et checksums |
| Migration | Transformation versionnée de schéma DB/document, testée et réversible par stratégie |
| Module métier | Service spécialisé avec règles et données propres, au-delà du composant visuel |
| Monolithe modulaire | Application déployée ensemble avec frontières de domaine explicites |
| Noindex | Directive d'indexation ; ne remplace pas une protection d'accès |
| Outbox | Événements persistés dans la transaction métier avant distribution asynchrone |
| Owner | Propriétaire du workspace avec permissions de transfert/facturation/suppression |
| Page | Identité logique contenant un brouillon et des versions |
| PageDocument | Arbre JSON versionné de nœuds, styles, références et métadonnées |
| Plan | Offre versionnée regroupant entitlements ; ne contient pas nécessairement un prix fixe |
| Preview | Rendu de brouillon autorisé, isolé et non indexé |
| Projet | Site ou expérience appartenant à un workspace |
| Publication | Intention et résultat versionné d'un snapshot site complet |
| Publication active | Bundle actuellement résolu par le pointeur de projet |
| Public Suffix List | Liste influençant l'isolation des cookies/domaines ; ajout non supposé |
| Quota | Limite d'usage avec période, source, alerte et politique à la limite |
| RBAC | Contrôle d'accès par rôles et permissions serveur |
| Renderer | Moteur de projection et rendu du document public |
| Renderer compatibility | Versions de moteur/composants capables de lire une publication |
| RLS | Row Level Security PostgreSQL, seconde barrière après autorisation applicative |
| Rollback | Nouvelle activation vers un bundle antérieur ; ne modifie pas le brouillon |
| RPO | Perte de données maximale visée en durée |
| RTO | Durée maximale visée de rétablissement |
| Schéma de page | Version du contrat PageDocument et de ses règles |
| SEO technique | URL, métadonnées, indexation, performance et structure ; aucun classement garanti |
| Session opaque | Jeton aléatoire dont seul le hash est persisté, révocable côté serveur |
| SitePlan | Plan structuré produit/validé avant génération IA du site |
| Slug | Label normalisé de site/page utilisé dans les URLs |
| SLO | Objectif de niveau de service mesuré ; distinct d'une garantie contractuelle |
| SSR | Rendu côté serveur à la demande |
| SSG | Génération statique à l'avance |
| Studio | Interface SaaS de gestion et d'édition, distincte des sites publiés |
| Template | Structure/thème réutilisable avec version, dépendances et licence |
| Tenant | Espace d'isolation correspondant au workspace dans le modèle actuel |
| Token (design) | Voir Design token ; à ne pas confondre avec jeton de sécurité |
| Token (sécurité) | Secret/jeton d'accès ou de challenge, jamais stocké brut si un hash suffit |
| U-label/A-label | Formes Unicode/ASCII punycode d'un nom de domaine internationalisé |
| Version publiée | Snapshot immuable référencé par une publication |
| Webhook | Notification HTTP signée, idempotente et rejouable selon contrat |
| Workspace | Frontière de tenant, membres, projets, usage et facturation |
| Worker | Processus asynchrone à identité et permissions minimales |
