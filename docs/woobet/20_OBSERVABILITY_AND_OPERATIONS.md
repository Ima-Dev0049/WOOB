# 20 — Observabilité, analytics et opérations

## 1. Trois domaines de mesure

1. **Technique :** santé, latence, saturation, erreurs, files, coûts.
2. **Produit :** activation, usage, publication, rétention et abandon.
3. **Métier :** abonnements, marge, quotas, support et abus.

Ces domaines ont des finalités, rétentions et droits d'accès différents. Ils partagent des identifiants de corrélation lorsque c'est nécessaire, sans exposer les contenus.

## 2. Logs structurés

Format JSON : `timestamp`, `level`, `service`, `version`, `environment`, `event`, `requestId`, `traceId`, `jobId`, `workspaceId` selon politique, `projectId`, `publicationId`, `domainId`, `status`, `errorCode`, `durationMs`. Les IDs techniques facilitent le support ; les user agents et IP sont minimisés/tronqués.

Interdits : mots de passe, cookies, tokens, secrets, prompts/réponses IA complets par défaut, contenu des formulaires, corps de webhook de paiement, document de page complet, données de carte. Les pipelines testent des patterns de fuite et appliquent redaction avant export.

## 3. Métriques techniques

| Domaine | Métriques minimales | Alertes initiales à calibrer |
|---|---|---|
| API | Rate, errors, duration par route/code ; DB latency/connections | SLO burn rate, hausse 5xx, saturation |
| Studio | Web errors, Web Vitals de l'app, échecs API | Crash loops, erreur après release |
| Renderer | Hits/misses, latence origine/CDN, fallbacks, 4xx/5xx | Disponibilité, chute hit rate, hausse fallback |
| Publication | Durée par étape, succès/échec, rollbacks, âge des intentions | Publication bloquée, taux d'échec |
| Files | Profondeur, âge du plus ancien, retries, DLQ, concurrency | Âge > seuil de parcours, DLQ > 0 critique selon file |
| IA | Latence, coût, validité, taux fournisseur, quota refusé | Budget burn, qualité/validité en chute |
| Domaines/TLS | États, délais, échecs DNS, `days_to_expiry` | Certificat proche expiration, actifs en erreur |
| Médias | Uploads, scan/processing, stockage, orphelins | Backlog, coût ou échecs de traitement |
| DB/Redis/objet | IOPS, CPU, locks, stockage, mémoire, évictions | Saturation et espace restant |
| Facturation | Webhooks en retard, rapprochements, impayés | Divergence provider/local |

Les labels à haute cardinalité (hostname, userId, URL brute) sont évités dans le système de métriques ; ils vont dans logs/traces expurgés si nécessaire.

## 4. Traces et erreurs

OpenTelemetry est recommandé comme couche d'instrumentation après validation des SDK, avec backend à choisir. Les traces traversent API → DB/outbox → worker → provider via contexte de tâche, sans transmettre de données sensibles. Les spans incluent publication, génération et domaine avec attributs bornés.

Les erreurs frontend/backend regroupent par fingerprint, release et environnement. Source maps privées, échantillonnage des transactions et liens vers runbooks. Une alerte n'est pas créée pour chaque erreur utilisateur 4xx attendue.

## 5. Événements produit

Schéma : `event_name`, `event_version`, `occurred_at`, `actor_pseudonym`, `workspace_pseudonym`, `project_id` selon nécessité, `session_pseudonym`, `properties` en allowlist, `source`, `consent_context`. Événements envoyés par serveur pour les faits critiques afin d'éviter les bloqueurs de publicité et manipulations.

| Événement | Propriétés autorisées | Question mesurée |
|---|---|---|
| `workspace_created` | source, locale UI | Activation du compte |
| `project_created` | origin=blank/template/ai, template_category | Point de départ |
| `first_document_valid` | duration_since_project, origin | Temps vers une base utilisable |
| `editor_command_completed` | command_category, mode, complexity_bucket | Usage simple/avancé ; pas de contenu |
| `ai_generation_ready` | kind, validity, latency_bucket, cost_bucket | Valeur et coût IA |
| `ai_result_applied` / `ai_result_rejected` | reason_category | Acceptation |
| `preview_opened` | breakpoint, page_type | Contrôle avant publication |
| `publication_succeeded` | duration, page_count_bucket, first_publication | Première mise en ligne |
| `domain_activated` | kind, duration, attempt_count | Friction DNS |
| `rollback_completed` | reason_category | Qualité et récupération |
| `quota_reached` | metric, plan_code | Limites et conversion |
| `subscription_activated` | plan, interval, currency | Conversion sans montant inutile |
| `editor_abandoned` | last_step, save_state, duration_bucket | Abandon ; défini avec fenêtre précise |

La rétention est mesurée par cohortes d'inscription/première publication avec définitions d'utilisateur actif explicites. Les conversions ne sont pas attribuées à l'IA sans protocole causal.

## 6. Dashboards

- **Astreinte :** disponibilité, SLO, files, erreurs, certificats, saturation et incidents.
- **Publication :** file d'intentions, étapes, échecs par code, rollback et cache.
- **IA/coûts :** validité, acceptation, latence, coût par route/modèle et budget.
- **Produit :** funnel inscription → projet → document → aperçu → publication ; temps et abandons.
- **Tenant support :** états techniques autorisés d'un projet avec accès audité, pas contenu par défaut.
- **SaaS :** MRR/ARR calculés avec définitions, churn, usage, marge variable et créances.

## 7. Alertes et astreinte

Sévérités : SEV1 fuite/interruption majeure, SEV2 parcours critique dégradé, SEV3 capacité/risque imminent, SEV4 anomalie non urgente. Chaque alerte a seuil, fenêtre, destinataire, runbook, silence contrôlé et test. Les notifications utilisent deux canaux pour les incidents graves si nécessaire.

L'astreinte, les fuseaux, l'escalade et les objectifs de réponse sont définis avant lancement. Une petite équipe ne doit pas promettre 24/7 sans rotation réelle.

## 8. Opérations courantes

Rejouer une tâche depuis son ID après vérification d'idempotence ; suspendre un site ; invalider un cache par publication ; révoquer sessions ; faire une revue de domaine ; exporter des données ; appliquer un override de quota temporaire ; purger une DLQ après traitement ; faire une rotation de secret. Chaque action a permissions, confirmation, audit et runbook.

## 9. Confidentialité et rétention

Registre des événements, finalité, base légale, durée et accès. Analytics produit essentiel limité ; analytics marketing optionnel et consenti selon juridiction. IP et user agents réduits ; pas de fingerprinting caché. Suppression d'un utilisateur propagée aux systèmes analytics dans la mesure des obligations et de l'agrégation irréversible.

## 10. Coût de l'observabilité

Budgets d'ingestion par service, sampling adaptatif, rétentions différenciées et métriques à cardinalité contrôlée. Les incidents peuvent augmenter temporairement le sampling avec plafond. Les coûts sont inclus dans le modèle SaaS ; désactiver toute télémétrie pour économiser n'est pas une stratégie acceptable.

## 11. Runbooks minimaux avant bêta

API/renderer indisponible ; DB saturée ; Redis perdu ; publication bloquée ; ancien site servi après activation ; certificat expiré ; domaine malveillant ; coût IA anormal ; provider IA down ; file/DLQ ; fuite de secret ; webhook paiement perdu ; sauvegarde/restauration ; rollback de release. Chaque runbook indique symptômes, impact, vérifications, actions, communication et clôture.
