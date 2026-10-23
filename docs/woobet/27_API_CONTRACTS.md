# 27 — Contrats API WOOBET

## 1. Principes

API REST JSON sous `/v1`, OpenAPI versionné, DTO distincts du modèle ORM. Les endpoints ci-dessous sont des contrats **proposés**, pas des services disponibles. Le fichier `contracts/openapi.yaml` fournit un extrait normatif de départ pour les conventions et parcours critiques.

Conventions : UTF-8 ; timestamps RFC 3339 UTC ; UUID en chemin ; pagination par curseur opaque ; `limit` borné ; `Idempotency-Key` sur créations à effet ; `If-Match` ou `baseRevision` sur mutations concurrentes ; codes d'erreur stables ; aucune donnée sensible dans les URLs/logs.

## 2. Authentification et contexte

- cookie de session Studio pour les routes de gestion + protection CSRF ;
- credentials API futurs avec scopes et expiration pour intégrations ;
- `workspaceId` dans le chemin des routes tenant ; l'API résout membership et rôle ;
- les routes publiques de sites ne partagent pas les credentials Studio ;
- réponses 401 (non authentifié), 403 (permission), 404 éventuellement utilisée pour ne pas révéler une ressource étrangère selon politique, 409 (révision/état), 422 (validation), 429 (quota), 503 (dépendance temporaire).

## 3. Enveloppes et pagination

Succès de ressource : l'objet directement avec `id`, `revision` si pertinent. Collection :

```json
{
  "items": [{"id": "01...", "name": "Projet"}],
  "page": {"nextCursor": "opaque", "hasMore": true}
}
```

Erreur : objet du document 06 avec `code`, `message`, `requestId`, `details`, `retryable`. Les détails de validation sont une liste bornée `{path,code,messageKey,params}`. Aucun stack trace.

## 4. Endpoints de gestion

| Méthode et chemin | Permission | Effet / réponse | Concurrence et limites |
|---|---|---|---|
| `POST /v1/auth/register` | Public | Inscription anti-énumération | Rate limit ; email verification |
| `POST /v1/auth/login` | Public | Session/cookie | CSRF après session, throttling |
| `POST /v1/auth/logout` | Authentifié | Révocation | Idempotent |
| `GET /v1/me` | Authentifié | Profil et workspaces résumés | Pas de secrets |
| `GET /v1/workspaces/{workspaceId}/projects` | `projects.read` | Page de projets | Cursor, filtres bornés |
| `POST /v1/workspaces/{workspaceId}/projects` | `projects.create` + quota | Projet initial | Idempotency-Key |
| `GET /v1/workspaces/{workspaceId}/projects/{projectId}` | `projects.read` | Métadonnées et capacités | Scope tenant |
| `PATCH .../projects/{projectId}` | `projects.update` | Mise à jour paramètres | `If-Match: "revision"` |
| `DELETE .../projects/{projectId}` | `projects.delete` | Corbeille | Idempotence + confirmation |
| `POST .../projects/{projectId}/duplicate` | `projects.create` | Tâche de duplication | Exclut domaines/secrets |
| `GET .../projects/{projectId}/pages` | `pages.read` | Pages sans documents complets | Pagination |
| `POST .../projects/{projectId}/pages` | `pages.create` | Page valide vide/template | Idempotency-Key |
| `GET .../pages/{pageId}/draft` | `pages.read` | Document + révision + ETag | Pas de cache partagé |
| `PUT .../pages/{pageId}/draft` | `pages.edit` | Remplacement/commandes selon content type | `baseRevision`, 409 |
| `POST .../pages/{pageId}/commands` | `pages.edit` | Commande/batch atomique | `baseRevision`, taille bornée |
| `POST .../pages/{pageId}/checkpoints` | `pages.checkpoint` | Snapshot immuable | Idempotency-Key |
| `GET .../pages/{pageId}/versions` | `pages.read` | Versions paginées | Métadonnées seulement |
| `POST .../pages/{pageId}/restore` | `pages.restore` | Nouvelle révision de brouillon | `sourceVersionId`, baseRevision |

Les chemins avec `...` dans ce tableau abrègent `/v1/workspaces/{workspaceId}/projects/{projectId}` uniquement pour lisibilité ; l'OpenAPI utilise les chemins complets. `PUT draft` peut être limité au document complet tandis que `commands` est préféré pour l'éditeur. Un seul protocole canonique sera retenu en phase 4 pour éviter deux sémantiques divergentes.

## 5. Commandes de brouillon

Requête :

```json
{
  "baseRevision": 41,
  "commandId": "01...",
  "type": "updateProps",
  "scope": {"nodeIds": ["node_hero"]},
  "payload": {"props": {"title": {"fr": "Nouveau titre"}}}
}
```

Réponse `200` : `{pageId, revision:42, checksum, savedAt, issues:[]}`. `409 REVISION_CONFLICT` fournit `currentRevision` mais pas automatiquement le document si l'utilisateur n'y a pas droit. `422 COMMAND_INVALID` contient les chemins. Une commande IA passe par le même validateur après acceptation, avec acteur utilisateur et provenance IA dans l'audit.

## 6. Médias

| Méthode | Effet | Règles |
|---|---|---|
| `POST .../assets/uploads` | Crée intention d'upload | Quota réservé, taille/type, réponse `assetId`, `uploadUrl`, `expiresAt`, headers requis |
| `POST .../assets/{assetId}/complete` | Déclare fin d'upload | Vérification serveur obligatoire ; ne marque pas `ready` directement |
| `GET .../assets` | Liste paginée | Filtres type/dossier/tag/statut |
| `GET .../assets/{assetId}` | Métadonnées | URL privée séparée et courte si demandée |
| `PATCH .../assets/{assetId}` | Alt/tags/dossier/licence | Révision et validation |
| `DELETE .../assets/{assetId}` | Corbeille | Refus/rapport si références actives |
| `POST .../assets/{assetId}/variants` | Demande une variante autorisée | Spec hash/idempotence, quota CPU |

L'URL signée n'est pas journalisée et n'apparaît pas dans le document de page. Les assets publics sont résolus par le manifeste de publication.

## 7. IA

| Méthode | Effet | Réponse/état |
|---|---|---|
| `POST .../ai/plans` | Analyse et plan candidat | `202 generationId,state=queued` |
| `POST .../ai/generations` | Génération depuis plan/révision | `202`, budget réservé |
| `GET .../ai/generations/{generationId}` | État, progression par étapes, erreurs et usage résumé | Pas de prompt complet par défaut |
| `POST .../ai/generations/{generationId}:cancel` | Annulation best effort | Annulation n'efface pas coût déjà engagé |
| `GET .../ai/generations/{generationId}/result` | Plan/documents/diff validés | Expiration et permission |
| `POST .../ai/patches` | Patch ciblé sur baseRevision | `202` |
| `POST .../ai/patches/{generationId}:apply` | Applique après acceptation | baseRevision + scope revalidés, commande atomique |

Les opérations longues retournent 202 et un état consultable ; l'UI peut recevoir des événements, mais le GET reste source de reprise. Les corps contiennent `idempotencyKey` ou en-tête, budget maximal accepté et options de confidentialité autorisées.

## 8. Publications

### `POST .../publications`

Requête : `{sourceRevision, requestedCheckpointIds?, note?}` + `Idempotency-Key`. Le serveur vérifie `publish` et quota, crée `preparing`, retourne `202 {publicationId,number,state}`.

### `GET .../publications/{publicationId}`

Retourne état, étapes `{code,state,startedAt,endedAt,errorCode?}`, sourceRevision, manifest public limité et dates. Il ne donne pas d'URL signée interne.

### `POST .../publications/{publicationId}:activate`

Réservé au workflow ou à une activation manuelle après `ready`, selon politique. Le worker utilise une identité de service, pas cet endpoint public. Pour un utilisateur, `POST .../projects/{projectId}/rollback` avec `{targetPublicationId,basePointerRevision}` crée une nouvelle activation. Le rollback n'est pas une suppression.

Transitions : `preparing → validating → building → ready → activating → active` ; branches `failed`, `cancelled`, puis `superseded` pour ancienne active. Les retries utilisent la même intention et ne créent pas de nouvelle publication sauf demande explicite.

## 9. Domaines

| Méthode | Effet synchrone | Travail asynchrone |
|---|---|---|
| `POST .../domains` | Normalise, vérifie doublon/permission, crée pending/challenge | Non |
| `POST .../domains/{domainId}/verification-challenges` | Nouveau challenge, ancien révoqué | Vérification TXT planifiée |
| `POST .../domains/{domainId}:verify` | Demande une tentative | DNS lookup et transition |
| `GET .../domains/{domainId}` | Retourne état/version/instructions sûres | Polling UI avec backoff |
| `POST .../domains/{domainId}:provision` | Valide état, crée intention | DNS, TLS, déploiement edge |
| `POST .../domains/{domainId}:suspend` | Permission et état | Déroutage contrôlé |
| `DELETE .../domains/{domainId}` | Marque suppression demandée | Déroutage/TLS/nettoyage puis removed |

Réponse d'état : `{hostname,asciiHostname,state,stateVersion,isCanonical,instructions:[{type,recordName,recordValue,ttl?}],lastError:{code,retryable,checkedAt}}`. Les instructions sensibles de challenge sont visibles uniquement aux rôles domaine. Le client ne peut pas soumettre `state=active`.

## 10. Templates, locales et extensions

- `GET/POST /v1/templates` et `/v1/templates/{id}/versions` : portée système/privée déterminée par permissions ; import avec manifest/checksum ;
- `POST .../projects/{id}/template-previews` : calcule diff sans écrire ; `POST .../template-applications` : applique avec baseRevision et checkpoint ;
- `GET/POST/PATCH/DELETE .../locales` : suppression seulement avec migration ; `POST .../translation-jobs` pour traduction IA ;
- `GET/POST .../extension-installations`, `PATCH ...:permissions`, `DELETE ...` : changements de droits explicitement approuvés ;
- `GET/POST .../webhooks`, `GET .../webhook-deliveries`, `POST .../webhook-deliveries/{id}:retry` : target revalidée et audit.

## 11. Facturation et usage

`GET .../billing/subscription`, `POST .../billing/checkout-sessions`, `POST .../billing/portal-sessions`, `GET .../billing/invoices`, `GET .../usage`, `GET .../entitlements`. Seul `billing.manage` initie les sessions ; les URLs hébergées sont courtes et ne sont pas journalisées. Les plans disponibles sont publics ou authentifiés selon produit, mais les overrides sont admin/owner audités.

Webhook provider : endpoint dédié sans session, signature sur raw body, anti-rejeu et persistance avant traitement. Il ne partage pas la même politique CORS/CSRF que l'API Studio. Les événements sont traités selon `provider_event_id` unique.

## 12. Formulaires publics et webhooks sortants

`POST /public/v1/sites/{siteKey}/forms/{formKey}/submissions` utilise une clé publique non secrète + domaine/publication et règles du formulaire ; jamais de workspaceId deviné comme seule autorisation. Réponse anti-énumération et idempotence par `submissionId`. CORS limité aux domaines actifs du site ; rate limit et taille.

Les webhooks sortants ont en-têtes conceptuels `X-Woobet-Event-Id`, `X-Woobet-Timestamp`, `X-Woobet-Signature` ; algorithme et rotation précisés dans la documentation développeur après implémentation. La vérification exige le corps brut et une tolérance de temps.

## 13. Versionnement et compatibilité

- `/v1` pour changements compatibles ; nouvelle version majeure pour rupture ;
- champs additifs optionnels possibles après revue ; clients doivent ignorer les champs inconnus sauf protocole strict interne ;
- suppression/renommage avec dépréciation, `Sunset` si adopté et documentation ;
- commandes, événements et webhooks ont leur propre `version` ;
- OpenAPI diff en CI ; tests consommateurs sur les contrats publiés ;
- erreurs et codes d'état font partie du contrat.

## 14. Sécurité et limites communes

Body size par route ; profondeur JSON ; nombre de commandes/nœuds ; timeouts ; curseurs non devinables ; CORS par origine Studio ; CSRF ; cache `no-store` pour données privées ; ETag faibles/forts selon contenu. Les limites effectives sont publiées via en-têtes/documentations seulement si elles ne facilitent pas une attaque ; les erreurs 429 indiquent `retryAfter` lorsque pertinent.

## 15. Contrat OpenAPI et génération

`contracts/openapi.yaml` est un extrait volontairement limité aux santé, projets, drafts, publications et domaines pour éviter de présenter tous les endpoints comme finalisés. Les serveurs utilisent des variables et un domaine `.invalid`, aucun environnement réel n'est affirmé. En phase 1/2, ce fichier est complété, validé par un linter, puis les clients/types sont générés et testés contre l'implémentation.
