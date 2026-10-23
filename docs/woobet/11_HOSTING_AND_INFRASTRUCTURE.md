# 11 — Hébergement et infrastructure cloud

## 1. Exigences d'infrastructure

L'infrastructure doit isoler gestion et sites publics, servir des bundles immuables, absorber des trafics non prévisibles, exécuter des tâches longues, gérer des domaines/c TLS, sauvegarder les données et exposer des métriques de coût. Aucun fournisseur n'est présélectionné comme acquis ; les offres, régions, limites et prix doivent être vérifiés par devis et prototypes.

## 2. Comparaison des stratégies

| Stratégie | Coût et efficacité | Complexité opérationnelle | Sécurité/limites | Conditions d'usage/migration |
|---|---|---|---|---|
| Conteneurs mutualisés contrôlés + SSR | Bon point de départ, calcul partagé | Modérée | Isolation applicative et quotas essentiels ; noisy neighbor | Défaut V1 ; scaling horizontal puis files/cache |
| Rendu serverless à la demande | Coût variable, scaling géré | Faible à modérée | Cold starts, limites durée/mémoire, coût par requête et observabilité | Si corpus compatible et coût mesuré ; éviter tâches longues |
| SSG complet | CDN peu coûteux à la lecture | Builds, stockage et invalidations | Surface d'origine réduite ; explosion pages×locales×versions | Sites stables sélectionnés ; migration par manifeste |
| ISR/hébergement frontend managé | Intégration rapide | Dépendance plateforme | Sémantique de cache/version à prouver, lock-in | Si atomicité et multi-domaines démontrées |
| Kubernetes auto-hébergé | Contrôle et potentiel à grande échelle | Élevée : control plane, réseau, sécurité, upgrades | Plus de responsabilités ; pas nécessaire au départ | Seulement avec équipe et économie démontrées |
| VM auto-hébergées | Contrôle simple initial | Haute disponibilité et maintenance manuelles | Patchs, capacité, sauvegardes à gérer | Contrainte de coût/souveraineté ; migration conteneurs possible |
| Hybride : managé données/edge + conteneurs | Compromis recommandé | Modérée | Plusieurs responsabilités à tracer | Architecture de référence |

Le mot « mutualisé » ne signifie pas hébergement web partagé classique avec PHP/FTP ; il désigne des runtimes WOOBET partagés et contrôlés. Aucun code arbitraire utilisateur n'y est exécuté.

## 3. Architecture de référence

| Composant | Rôle | Exigences de déploiement |
|---|---|---|
| Studio | UI de gestion | Instances stateless, origine séparée, cookies restreints |
| API | Contrats, auth, transactions | Au moins deux instances pour rolling sans interruption si le fournisseur le permet ; limites et timeouts |
| PostgreSQL managé | Source de vérité | HA selon offre, PITR, chiffrement, connexion poolée, rôles minimaux |
| Worker publication | Prévol/bundle/activation | Concurrence bornée, identité de service, reprise après kill |
| Worker IA/médias/domaines | Tâches externes et lourdes | Files séparées, quotas et accès réseau minimaux |
| Routeur de domaines | Résolution Host → publication | Cache borné, aucun fallback inter-tenant, hôtes fiables |
| Site renderer | SSR public | Sans secrets Studio, scaling indépendant, timeouts de bindings |
| Stockage objet | Assets et bundles | Versioning, lifecycle, chiffrement, clés par tenant/publication |
| CDN/WAF | Cache, TLS, protection edge | Clés de cache contrôlées, bypass privé, logs et règles testées |
| Redis managé | Cache, rate limits, BullMQ | Mémoire/éviction surveillées ; pas source de vérité métier |
| File de tâches | Distribution asynchrone | Persistance adaptée, retry/DLQ, métriques d'âge |
| Certificats | Émission/renouvellement TLS | Provider managé de préférence après comparaison ; alertes |
| Logs/métriques/traces | Observabilité | Rétention, expurgation, alertes et coût contrôlés |
| Sauvegardes | Reprise | Compte/région séparés si possible, immuabilité et tests |

## 4. Topologie réseau et origines

- `studio.<zone-contrôlée>` : Studio et cookies de gestion ;
- `api.<zone-contrôlée>` : API, accès limité et CORS strict ;
- `<zone-de-publication>` : sites utilisateurs, sans cookie Studio ;
- `<zone-preview>` : aperçu authentifié et non indexé ;
- `<zone-assets>` : assets publics immuables ; assets privés via autorisation séparée ;
- réseau privé vers DB/Redis lorsque disponible ; aucun accès public direct ;
- workers avec egress contrôlé par catégorie de tâche ; le renderer n'a pas accès aux metadata endpoints cloud.

L'accès sortant générique est limité pour réduire SSRF/exfiltration. Les tâches qui récupèrent des URLs utilisateurs passent par un fetcher isolé avec résolution IP et limites.

## 5. Multi-tenancy et isolation des ressources

### Données

Toutes les lignes tenant portent `workspace_id`, avec clés étrangères composites pour empêcher une référence croisée. Les cas d'usage filtrent explicitement et RLS fournit une seconde barrière. Le rôle runtime n'a pas les droits de contourner RLS. Les opérations d'administration utilisent un rôle distinct et une procédure auditée.

### Exécution

Aucun site publié ne lit les variables d'environnement, secrets, fichiers internes ou autres tenants. Le renderer reçoit des credentials limités au contenu public/index de routage. Les workers ont des rôles IAM différents : media ne lit pas la facturation ; IA ne lit que les artefacts du job ; TLS ne lit pas les documents.

### Objets et caches

Clés d'objets incluant workspace/project ne remplacent pas les politiques IAM. Les URLs publiques ne sont utilisées que pour les copies de publication. Les clés de cache incluent tenant/publication lorsque la réponse n'est pas strictement publique. Les recherches et exports incluent toujours le workspace.

### Ressources

Quotas et rate limits par IP, utilisateur, workspace, site et type de tâche ; concurrence bornée ; poids des documents ; limites de temps CPU/requête ; files de priorité pour éviter qu'un tenant ne bloque les autres. Les quotas techniques initiaux sont testés puis exposés comme entitlements configurables.

## 6. Publication statique, dynamique et CDN

Le défaut est SSR avec cache CDN. Le cache HTML public est clé sur publication et route ; un déploiement active une nouvelle clé plutôt que de purger instantanément tout le réseau. Les anciennes clés expirent. Les assets ont noms hashés et `Cache-Control: immutable` ; les documents de gestion sont `no-store` selon sensibilité.

Le SSG sélectif est déclenché par profil de trafic et coût. Le passage SSR ↔ SSG ne change pas les URL ni le manifeste logique. Les modules dynamiques doivent déclarer leurs besoins de fraîcheur, personnalisation et cache.

## 7. Provisionnement et environnements

Infrastructure as Code recommandée (Terraform/OpenTofu ou outil du fournisseur après comparaison), état protégé, revue des plans et séparation des comptes. Aucun outil n'est installé dans le dépôt à ce stade ; la phase 1 choisit après un spike.

Environnements : local reproductible via conteneurs, CI éphémère, staging isolé avec domaines de test, production. Les données de production ne sont pas copiées vers staging sans anonymisation et approbation. Les ressources portent tags `project`, `environment`, `owner`, `cost-center`.

## 8. Sauvegarde et reprise

- PostgreSQL : snapshots automatisés + journaux/PITR si offre validée ; chiffrement ; accès restreint ;
- objets : versioning, rétention, réplication si le RPO l'exige ; lifecycle qui respecte les bundles actifs/référencés ;
- configuration : IaC et manifests versionnés ; secrets régénérables via procédure, non sauvegardés en clair dans les artefacts ;
- Redis : reconstructible sauf file/état explicitement durable ; BullMQ et outbox permettent reprise ;
- DNS : export des configurations et procédure de restauration chez un autre provider si possible.

Runbooks : perte DB, perte Redis, objet corrompu, CDN indisponible, provider IA indisponible, fuite de secret, certificat expiré, région perdue. RPO/RTO cibles dans le document 03 ; tests avant bêta et périodiques.

## 9. Supervision et alertes

Santé : disponibilité par origine, latence, erreurs, saturations CPU/mémoire/connexions, latence DB, profondeur et âge des files, échecs/DLQ, taux de cache, age des bundles, certificats proches d'expiration, coût IA et stockage. Sondes externes sur plusieurs régions si le budget le permet.

Alertes actionnables avec sévérité, propriétaire et runbook. Les seuils initiaux sont révisés après observation pour éviter alert fatigue. Les informations de tenant dans les dashboards restent limitées.

## 10. Mises à jour et montée en capacité

Rolling deployments, migrations compatibles, feature flags, canary sur renderer/API, rollback d'artefact applicatif. Les releases de renderer vérifient les anciennes publications. Les workers sont drainés ; les tâches reprennent sans double effet.

Ordre de scaling : mesurer → optimiser cache/requêtes → augmenter concurrence contrôlée → répliques stateless → pool DB/lecture si nécessaire → files et autoscaling → extraction/partitionnement seulement avec justification. Les tests de charge incluent trafic en rafale et distribution très concentrée sur quelques sites.

## 11. Coûts et limites

Postes : instances minimum, calcul SSR, CPU workers, stockage DB/objet, PITR, bande passante CDN et egress, requêtes de cache, transformations d'images, domaines TLS, emails, monitoring et support. Les tarifs et free tiers ne sont pas présumés permanents.

Chaque architecture candidate reçoit un modèle à trois volumes (pilote, croissance, charge élevée) avec unités et devis datés. Les conditions de migration comprennent coût d'egress, compatibilité S3/DNS/TLS, réentraînement et double écriture temporaire. Voir document 32.

## 12. Conditions de décision fournisseur

Un fournisseur est retenu seulement après preuve : domaines custom et wildcard nécessaires, certificats, cache par clé/version, Host correct, limites de temps/taille, logs, région, sauvegardes, prix, sortie et sécurité. Une offre qui ne permet pas l'isolation des origines ou le routage exigé est éliminée même si son coût initial est faible.
