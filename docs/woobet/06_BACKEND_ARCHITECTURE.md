# 06 — Architecture backend

## 1. Responsabilités

Le backend fournit les contrats REST, l'authentification, l'autorisation, les transactions tenant, les commandes de document, l'orchestration des versions/publications/domaines, les quotas, les webhooks et l'accès contrôlé aux fournisseurs. Il ne sert pas de proxy générique vers Internet et n'exécute pas de code généré.

## 2. Monolithe modulaire

NestJS est recommandé comme cadre initial pour son organisation en modules et son injection, sous réserve de validation de la version et de l'adaptateur HTTP. Les alternatives sont une application Fastify structurée sans Nest, Hono, ou un backend dans Next.js. Nest est retenu pour les frontières et la testabilité, non pour sa popularité.

```text
src/
  main.ts
  app.module.ts
  modules/
    identity/
      domain/
      application/
      infrastructure/
      presentation/
    tenancy/
    projects/
    editor/
    media/
    ai/
    publishing/
    domains/
    billing/
    entitlements/
    audit/
  platform/
    database/
    queue/
    object-storage/
    cache/
    observability/
    secrets/
```

- **domain** : entités, value objects, règles et erreurs sans framework ;
- **application** : cas d'usage, transactions, ports et politiques ;
- **infrastructure** : PostgreSQL, Redis, S3, fournisseurs ;
- **presentation** : contrôleurs, DTO, gardes et mapping des erreurs.

Le worker importe les cas d'usage applicatifs, pas les contrôleurs. Les dépendances intermodules passent par des ports exportés. Les cycles sont bloqués en CI.

## 3. API et erreurs

Préfixe `/v1`, JSON UTF-8, OpenAPI versionné. Les identifiants sont des UUIDv7 ou équivalents triables validés ; le choix final doit être compatible DB et bibliothèques. Les timestamps sont UTC RFC 3339 ; les montants sont entiers en unités mineures.

Erreur commune :

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "Le brouillon a changé depuis son chargement.",
    "requestId": "01...",
    "details": {"currentRevision": 42},
    "retryable": false
  }
}
```

Le message localisé est construit à partir du code et de paramètres sûrs ; le serveur peut fournir un message par défaut. Les traces internes ne sont pas exposées. Codes : validation, authentification, permission, conflit, quota, état invalide, dépendance indisponible et erreur interne.

## 4. Contexte de requête et autorisation

```text
Request
  -> requestId / traceId
  -> session ou credential API
  -> actorId
  -> workspaceId résolu depuis la route et l'appartenance
  -> rôle + permissions effectives + entitlements
  -> politique de limitation
```

Le contrôleur ne fait pas confiance à un `workspaceId` du corps. Chaque requête SQL tenant inclut le prédicat workspace et s'exécute dans une transaction avec contexte RLS lorsque la table est protégée. Les tâches worker portent un contexte signé/interne minimal et revalident l'état au moment de l'exécution ; elles n'héritent pas aveuglément d'un rôle utilisateur obsolète.

## 5. Transactions, idempotence et concurrence

- mise à jour de brouillon : `WHERE id=? AND workspace_id=? AND draft_revision=?`, puis incrément ; conflit 409 si zéro ligne ;
- réservation de slug/domaine : contrainte unique normalisée en base, pas un simple check-then-insert ;
- publication : intention persistée, snapshot cohérent, artefact immutable, activation transactionnelle ;
- webhook : contrainte unique sur `provider_event_id`, payload protégé, puis traitement ; réponse rapide après persistance selon exigences du fournisseur ;
- effet externe : clé d'idempotence fournisseur si disponible + table d'opérations pour éviter doublon local ;
- outbox : insérée dans la même transaction que la donnée ; publication au broker après commit ; consommateur idempotent.

Redis ne garantit pas seul l'unicité d'un effet métier. Les verrous distribués ont TTL et fencing token lorsqu'un effet critique pourrait reprendre après expiration.

## 6. Files et workers

| File | Exemples | Timeout/retry | Idempotence et DLQ |
|---|---|---|---|
| `ai` | plan, génération, patch | Timeout fournisseur + deadline globale ; retries seulement sur erreurs retryables | `generationId`, étapes persistées ; coût connu enregistré |
| `media` | scan, variantes, purge | Retries bornés, backoff+jitter | `assetId + variantSpecHash` |
| `publishing` | prévol, bundle, activation, sonde | Peu de retries automatiques pour activation | `publicationId`, checksums, pointeur conditionnel |
| `domains` | TXT/DNS/TLS/routage | Poll planifié avec backoff et expiration | `domainId + attempt + desiredState` |
| `notifications` | emails et in-app | Retry provider ; préférences revérifiées | `notificationId` |
| `webhooks` | livraisons sortantes | Exponentiel, jitter, DLQ | `deliveryId`, signature et horodatage |
| `billing` | rapprochement et entitlements | Rejouable depuis événements | Event ID unique |

Chaque tâche a un type/version, payload minimal, tenant, priorité, deadline, tentative et clé d'unicité. Les payloads ne contiennent ni secret, ni document complet si une référence suffit. Une DLQ nécessite alerte, inspection et procédure de rejeu.

## 7. Outbox et événements

Événements métier : `ProjectCreated`, `PageCheckpointCreated`, `PublicationRequested`, `PublicationActivated`, `DomainStateChanged`, `AssetReady`, `SubscriptionChanged`, `UsageLimitReached`. Chaque événement a `eventId`, `type`, `version`, `occurredAt`, `workspaceId`, `aggregateId`, `correlationId` et données minimales.

Les événements ne remplacent pas les commandes. Les consommateurs doivent tolérer duplication et ordre non garanti entre agrégats. L'ordre éventuel par agrégat est documenté et vérifié avec un numéro de version.

## 8. Accès aux données

Drizzle ORM est recommandé à titre conditionnel pour conserver des requêtes SQL proches du modèle et utiliser des migrations SQL explicites. Prisma reste une option si le spike démontre un meilleur coût de développement et la prise en charge requise des transactions, RLS, contraintes composites et migrations. Un query builder tel que Kysely est une alternative. Aucun ORM n'est autorisé à masquer une requête `N+1` ou une absence de prédicat tenant.

Conventions : transactions explicites dans les cas d'usage ; requêtes critiques revues avec `EXPLAIN` ; pagination curseur ; limites obligatoires ; colonnes JSONB indexées seulement après besoin mesuré ; migrations expansives puis contractantes ; compte de migration distinct du rôle runtime.

## 9. Cache

Redis peut contenir sessions à accès rapide si la persistance DB reste prévue, rate limits, cache de domaines/publications, verrous courts et données BullMQ. Les clés ont version, tenant et TTL. Le cache n'est jamais une autorisation : une entrée de permission doit être courte et invalidée sur changement, ou la permission est relue.

Le cache public utilise des clés normalisées incluant domaine, chemin, locale, publication et variantes de négociation nécessaires. Il ne met pas en commun une réponse personnalisée entre visiteurs. Une erreur 500 ou une réponse privée n'est pas placée dans un cache partagé.

## 10. Fournisseurs externes

Chaque intégration implémente un port interne : `AiProvider`, `ObjectStorage`, `DnsProvider`, `CertificateProvider`, `PaymentProvider`, `EmailProvider`, `ImageProcessor`. Les DTO fournisseurs restent dans l'adaptateur. Timeouts, retries, circuit breaker si justifié, limites de concurrence, métriques et mapping d'erreurs sont obligatoires.

La stratégie de remplacement ne signifie pas que tous les fournisseurs sont interchangeables sans effort : les différences de DNS, TLS et IA sont documentées et testées par contrat. Aucune capacité non vérifiée d'un fournisseur n'est supposée.

## 11. Endpoints publics et internes

Les API des utilisateurs finaux des sites sont séparées de l'API Studio lorsque le module le nécessite. Elles ont identité, rate limit et autorisations propres ; un cookie Studio n'est jamais accepté comme preuve pour un espace membre. Les endpoints internes de worker ne sont pas exposés publiquement ; ils utilisent identité de service et réseau privé lorsque disponible.

## 12. Sécurité des intégrations et webhooks

Les URLs de callback et cibles webhook sont validées contre SSRF : schémas HTTPS, résolution DNS et filtrage des adresses privées/loopback/link-local à chaque redirection, plage IP réévaluée, ports limités, timeouts, taille de réponse et désactivation des redirects par défaut. Les validations ne reposent pas sur une regex de hostname.

Les webhooks entrants vérifient signature sur le corps brut, tolérance d'horodatage, rejeu et identifiant d'événement. Les sortants signent corps + timestamp + ID et ne contiennent que les données consenties.

## 13. Recherche et analytics

La V1 utilise PostgreSQL pour les recherches de gestion bornées par workspace. Un moteur externe n'est introduit que si les besoins de recherche publique/full-text/multilingue dépassent les résultats mesurés. Les événements analytics partent par outbox vers un stockage adapté ; ils ne ralentissent pas le rendu public.

## 14. Configuration et secrets

Schéma de configuration au démarrage : URLs publiques, origines, DB, Redis, S3, clés de chiffrement, providers, limites et flags. Les secrets proviennent d'un gestionnaire de secrets ou variables injectées par la plateforme ; jamais Git, documents de page, logs ou bundle client. Rotation : double clé pendant transition si possible, invalidation des sessions selon le type de secret et test de reprise.

## 15. Tests backend

Unités de domaine ; tests de propriétés des commandes/migrations ; intégration PostgreSQL/Redis réels en environnement éphémère ; contrats fournisseurs avec enregistrements assainis ; concurrence et idempotence ; RLS avec deux workspaces ; API OpenAPI ; reprise worker ; kill à chaque étape de publication ; webhooks dupliqués/désordonnés ; charge et soak.

## 16. Limites du monolithe et extraction

Un module peut être extrait si au moins une condition est démontrée : scaling très différent, besoin de disponibilité isolée, frontière de sécurité forte, équipe autonome avec release indépendante. Le coût ajouté inclut contrats réseau, tracing, retries, versionnement, données et runbooks. Les tables ne sont pas partagées avec un nouveau service sans stratégie de propriété des données.
