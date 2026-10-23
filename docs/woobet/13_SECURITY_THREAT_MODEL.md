# 13 — Sécurité, authentification et modèle de menace

## 1. Objectifs de sécurité

Priorités : confidentialité et intégrité des données de chaque workspace ; impossibilité de servir un brouillon ou un site d'un autre tenant ; disponibilité du service public ; traçabilité des actions sensibles ; aucun code utilisateur/IA exécuté dans une zone de confiance ; secrets hors documents, logs et navigateurs.

Le modèle couvre utilisateurs authentifiés malveillants, visiteurs anonymes, attaquants externes, contenus générés, intégrations compromises, erreurs d'exploitation et menaces internes. Il ne prétend pas éliminer tout risque.

## 2. Actifs et frontières

Actifs : sessions et identités ; documents privés ; soumissions ; médias ; domaines/TLS ; secrets d'intégration ; facturation ; artefacts de publication ; logs/audit ; capacités de calcul IA.

Frontières : navigateur ↔ edge ; Studio ↔ API ; API ↔ DB/Redis ; workers ↔ fournisseurs ; contenu public ↔ renderer ; upload ↔ stockage ; IA ↔ orchestrateur ; preview ↔ Studio ; administration interne ↔ production. Chaque entrée est non fiable jusqu'à validation et autorisation.

## 3. Authentification

### Inscription et connexion

- email normalisé avec bibliothèque et vérification de propriété ; réponse anti-énumération ;
- mot de passe avec politique de longueur, liste de mots de passe compromis si service validé, aucune règle de composition arbitraire excessive ;
- hash Argon2id avec paramètres calibrés sur les workers, sel via bibliothèque, pepper dans coffre si retenu ; aucun hash maison ;
- sessions opaques aléatoires ≥ 128 bits, seul hash en base ; rotation après connexion, élévation et récupération ;
- cookie `HttpOnly; Secure; Path=/; SameSite=Lax` ou `Strict` selon parcours OAuth ; domaine hôte uniquement ; expiration absolue + inactivité ;
- CSRF token ou pattern synchronizer/double-submit correctement validé pour toute mutation par cookie, en plus de vérification `Origin` et CORS restrictif ;
- récupération avec jeton unique court, hashé, invalidé après usage et après changement de mot de passe ; sessions révoquées ;
- OAuth/OIDC : `state`, `nonce`, PKCE lorsque applicable, allowlist de redirect URI, vérification signature/issuer/audience/expiry, liaison sans supposer qu'un email non vérifié prouve l'identité.

MFA devient requis pour admins internes et disponible pour offres sensibles ; récupération MFA protégée contre le social engineering. Les limites de tentatives combinent IP, compte et signaux sans permettre un verrouillage facile par un attaquant.

## 4. Autorisation et permissions

| Capacité | Owner | Admin | Editor | Contributor | Viewer |
|---|---:|---:|---:|---:|---:|
| Voir projets publiés/brouillons autorisés | Oui | Oui | Oui | Selon attribution | Oui |
| Modifier structure/design | Oui | Oui | Oui | Non ou contenu seul | Non |
| Modifier contenus attribués | Oui | Oui | Oui | Oui | Non |
| Publier/rollback | Oui | Oui | Oui si permission dédiée | Non | Non |
| Gérer médias | Oui | Oui | Oui | Contenu autorisé | Non |
| Gérer domaines/intégrations | Oui | Oui | Non par défaut | Non | Non |
| Gérer membres | Oui | Oui, sans se donner owner | Non | Non | Non |
| Facturation et plan | Oui | Selon permission explicite | Non | Non | Non |
| Supprimer/transférer workspace | Oui avec réauth | Non | Non | Non | Non |
| Voir audit | Oui | Oui selon portée | Non/limité | Non | Non |

Les rôles sont des ensembles de permissions ; `project.publish`, `billing.manage`, `members.manage`, `domains.manage`, `integrations.manage` peuvent être séparés. Un rôle personnalisé futur ne peut dépasser les permissions du créateur ni les capacités de son offre.

Chaque endpoint et job possède une politique explicite. Tests avec deux workspaces et chaque rôle ; refus par défaut ; vérification de la ressource ET de sa relation au workspace ; pas d'IDOR par UUID, export, recherche, asset ou webhook.

## 5. Menaces et contrôles

| Menace | Scénario | Prévention | Détection/test | Réponse |
|---|---|---|---|---|
| XSS stockée | Texte riche/SVG/JSON-LD injecte du script | Arbre de contenu, sanitation, échappement, CSP, SVG sûr | Payloads XSS, revue de sinks, CSP reports | Désactivation composant, purge caches, rotation si session exposée |
| XSS dans Studio | Aperçu ou contenu attaque la session | Origine preview isolée, cookie HttpOnly, postMessage strict | Tests d'origine et messages | Révocation, patch, audit |
| CSRF | Site tiers déclenche mutation cookie | SameSite, token, Origin, pas de mutation GET | Tests cross-site | Révoquer actions, corriger et audit |
| SSRF | Webhook/URL d'asset vise metadata ou DB | Fetcher isolé, DNS/IP checks à chaque redirect, egress deny, ports/taille/timeouts | IP privées, DNS rebinding, redirects | Stopper job, révoquer credentials si exposition |
| Injection SQL | Paramètres/JSON deviennent requête | ORM/paramètres, aucun SQL de document, migrations revues | Tests/fuzz, revue `EXPLAIN` | Containment, patch, audit |
| IDOR/BOLA | UUID d'un autre projet/asset | Scope workspace + RBAC + FK/RLS | Matrice automatisée deux tenants | Bloquer, journaliser, revoir accès |
| Élévation de privilège | Contributor change rôle/capacité via payload | DTO allowlist, politique serveur, dernier owner | Tests mass assignment | Révoquer sessions/rôle, audit |
| Fuite de secrets | Secret dans document, bundle ou log | `secret_ref`, DTO public, scanners, logs expurgés | Scan artefacts/logs | Rotation immédiate, purge, incident |
| Abus IA | Générations massives ou injection d'outils | Quotas, budgets, allowlist d'outils, sorties validées | Usage/coût, prompts d'attaque | Couper quota/provider, revue |
| Upload dangereux | Malware, polyglotte, bombe de compression | Type réel, limites, scan, décodage isolé, non-exécution | Corpus malveillant | Quarantaine, purge, notification |
| Lien malveillant | Phishing, `javascript:`, open redirect | Schémas autorisés, validation et réputation si disponible | Tests et signalements | Suspendre lien/site |
| Usurpation de domaine | Attaquant revendique un domaine ou homoglyphe | TXT, unicité, revérification, contrôles IDN | CT/DNS monitoring | Déroutage, suspension, preuve |
| Subdomain takeover | DNS orphelin vers ressource réaffectée | Nettoyage ordonné, inventaire et sondes | Scan DNS/routes | Retirer enregistrement/ressource |
| DoS/DDoS | Requêtes, documents ou files épuisent ressources | CDN/WAF, rate limits, tailles, concurrence, backpressure | Métriques saturation, tests de charge | Mode dégradé, throttling, scaling |
| Cache poisoning | Host ou paramètre contamine page publique | Host allowlist, clés normalisées, pas de champs internes | Tests host/query/cache | Purge ciblée, correction |
| Prompt injection | Contenu demande exfiltration/outil interdit | Outils minimaux, permissions externes au prompt, validation | Corpus adversarial | Refus, suppression outil |
| Supply chain | Dépendance/image compromise | Lockfile, revue, SBOM, signatures si possible, scan | CI et advisories | Pin/rollback/patch, rotation |
| Menace interne | Support lit un tenant sans motif | Moindre privilège, MFA, pas d'impersonation par défaut | Audit et revues d'accès | Révocation, procédure disciplinaire/légale |

## 6. Isolation multi-tenant

Contrôles cumulés : membership et permissions ; `workspace_id` sur chaque ressource ; FK composites ; requêtes scopées ; RLS ; comptes DB minimaux ; clés d'objet et politiques ; cache par portée ; tests. Les exports et recherche sont souvent oubliés et doivent passer le même service d'autorisation.

Le renderer public n'a accès qu'à des artefacts publiés et à un index de routage. Les jobs de preview utilisent un token court lié à project/révision/audience et aucun cookie Studio dans l'iframe. Les domaines utilisateurs n'ont pas accès aux cookies ou service workers du domaine de gestion.

## 7. Contenu et HTML/CSS

Le HTML est produit par React/échappement et un assainisseur pour le sous-ensemble riche. Les URLs autorisent `https`, `http` selon politique, `mailto`/`tel` validés et chemins internes ; `javascript`, `data` actif et `file` sont refusés. Les CSS personnalisés sont P2, parsés et contraints ; la sécurité ne repose pas sur une simple blacklist de mots.

CSP public dépend des capacités : `default-src 'self'`, origines d'assets précises, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors` selon produit, scripts avec nonce/hash. Les intégrations tierces nécessitent un rapport d'impact ; `unsafe-inline` et `unsafe-eval` sont évités. Les iframes tierces sont sandboxées et listées.

## 8. Uploads et fichiers

Extension et MIME déclaré ne suffisent pas : magic bytes, décodage réel, limites de pixels/durée/taille, antivirus si disponible, quarantaine avant `ready`. Les originaux privés ne sont pas publics avant publication d'une copie. Les SVG sont assainis et servis en `img` ou convertis ; aucun actif exécutable sur une origine sensible. Les noms de fichiers sont normalisés et le stockage utilise des IDs.

## 9. Protection des API et sites

Rate limits à plusieurs niveaux, quotas concurrents, body size, timeouts, pagination, complexité de recherche et de bindings. Captcha/preuve de travail seulement si nécessaire et accessible ; ne pas en faire la seule protection. WAF complète mais ne remplace pas les contrôles applicatifs.

Les formulaires publics ont jetons d'idempotence, honeypot/timing éventuel, validation serveur, limites par IP/site, notifications bornées et rétention. Les messages d'erreur ne révèlent pas les destinataires ou configurations.

## 10. Secrets et chiffrement

Secrets dans gestionnaire dédié, identité de service, accès par worker, rotation et audit. Les clés TLS privées restent chez le provider ou coffre spécialisé. Chiffrement au repos fournisseur vérifié ; chiffrement applicatif pour soumissions et champs très sensibles avec gestion de clés/version. TLS partout, HSTS après validation de tous les sous-domaines et stratégie de publication ; ne pas activer `includeSubDomains`/preload sans analyse.

## 11. Journalisation et réponse à incident

Événements sensibles : login/récupération, rôles, invitations, export, publication/rollback, domaine, intégration, plan/quota, suppression, suspension, accès support. Audit append-only, heure fiable, acteur, ressource, request ID et motif ; jamais secrets ni contenu complet.

Processus : détection → tri/sévérité → containment (clés, domaine, tenant, worker) → éradication → restauration → communication selon obligations → post-mortem sans blâme → actions suivies. Contacts et délais réglementaires sont à définir avec conseil juridique avant lancement.

## 12. Tests et gates de sécurité

SAST, SCA, secrets, IaC et images en CI ; DAST ciblé ; tests auth/RBAC/RLS/IDOR ; corpus XSS/SSRF/uploads ; tests de cache et Host ; revue manuelle des flux critiques ; pentest indépendant avant lancement public et après changement majeur. Les findings critiques/high selon politique bloquent ; exceptions limitées et approuvées.

Aucune case « sécurisé » n'est cochée sur la seule base de ce document : seuls les rapports de tests et preuves d'exploitation comptent.
