# 25 — Registre des risques

## Méthode

Probabilité (**P**) et impact (**I**) de 1 (faible) à 5 (critique). Score brut `P×I` : 1–6 faible, 8–12 modéré, 15–25 élevé. Le score résiduel est réévalué après preuve de mitigation, pas supposé maintenant. Propriétaire = rôle à attribuer, pas personne nommée.

| ID | Risque | P | I | Signal déclencheur | Mitigation préventive | Plan de contingence | Propriétaire |
|---|---|---:|---:|---|---|---|---|
| R-01 | Architecture trop complexe pour l'équipe | 4 | 5 | Délais de build, onboarding long, bugs transverses | Monolithe modulaire, scope V1, ADR et spikes, revue de simplicité | Réduire apps/packages, geler modules, renfort ciblé | Lead architecture |
| R-02 | Éditeur trop difficile/fluidité insuffisante | 4 | 5 | Budgets D1/D2 dépassés, DnD imprécis | Prototype éliminatoire, commandes, profiling, périmètre simple d'abord | Framework alternatif, réduire nesting/animations | Lead frontend |
| R-03 | Fidélité aperçu/publié insuffisante | 3 | 5 | Diffs visuels et CSS divergents | Renderer-core commun, corpus navigateurs, isolation CSS | Bloquer publication de composants, corriger rendu | Frontend/renderer |
| R-04 | Coûts IA non maîtrisés | 4 | 4 | Coût/acceptation en hausse, retries fréquents | Budgets, quotas, pipeline simple, cache sélectif, grilles datées | Désactiver routes/modèles coûteux, passer en manuel | IA + FinOps |
| R-05 | Sites IA visuellement médiocres | 4 | 4 | Rejets et corrections élevés | Contraintes de composition, corpus, revue humaine, thèmes sûrs | Limiter génération à plan/contenu, templates curatés | Produit + IA + design |
| R-06 | Fuite entre workspaces | 2 | 5 | Test IDOR/RLS ou rapport utilisateur | RBAC serveur, FK composites, RLS, tests deux tenants | Isolation service, révocation, incident et notification | Security + backend |
| R-07 | Brouillon ou secret exposé publiquement | 2 | 5 | Scan artefact/log ou cache privé | Projection publique, DTO, `secret_ref`, origines et caches séparés | Dépublier, purger, rotation, incident | Security + publishing |
| R-08 | Abus de ressources/DoS | 4 | 4 | Saturation, files et facture | Rate limits, tailles, concurrence, WAF, hard caps | Mode dégradé, suspension tenant, scaling | Ops |
| R-09 | Erreurs DNS et activation abusive | 4 | 4 | États `error`, taux d'échec élevé | Machine à états, preuve TXT, résolveurs, UX guidée | Déroutage sûr, support et reprise manuelle | Domains/Ops |
| R-10 | Certificats expirés ou émission bloquée | 3 | 5 | `days_to_expiry`, rate limits ACME | Provider managé, renouvellement anticipé, alertes et backoff | Ancien domaine/maintenance contrôlée, runbook provider | Ops |
| R-11 | Publication partielle/incohérente | 2 | 5 | Checksums/sondes ou mélange d'assets | Bundles immuables, pointeur transactionnel, kill tests | Rollback au bundle sain, geler activations | Publishing |
| R-12 | Dépendance fournisseur cloud/edge | 3 | 4 | Prix/limites ou incident fournisseur | Ports, IaC, formats ouverts, export et veille | Migration planifiée ; mode origine dégradé si préparé | Architecture/Ops |
| R-13 | Dépendance à un fournisseur IA | 4 | 3 | Indisponibilité ou changement de modèle | Abstraction, corpus multi-provider, création manuelle | Route secondaire ou désactivation IA | IA |
| R-14 | Migrations de schéma difficiles | 4 | 4 | Corpus ancien en échec, rollback impossible | Migrations pures, golden files, expand/contract | Lire ancienne version, geler release, restauration | Schema/Backend |
| R-15 | Performances dégradées avec la croissance | 4 | 4 | p95, DB, misses et coût en hausse | Budgets, cache, pagination, profiling et tests de charge | Throttling, scaling, optimisation ciblée | Performance/Ops |
| R-16 | Périmètre métier trop ambitieux | 5 | 4 | Modules entamés sans socle stable | Readiness matrix, hors-scope explicite, gates | Reporter e-commerce/LMS/marketplace, livrer socle | Directeur produit |
| R-17 | Monétisation/marge insuffisante | 3 | 5 | Marge négative par cohorte, usage gratuit élevé | Coût unitaire, entitlements, quotas et étude prix | Ajuster offres/limits, réduire coûts, stopper features coûteuses | Produit/Finance |
| R-18 | UX surchargée et faible activation | 4 | 4 | Abandons et temps de tâche élevés | Disclosure progressive, tests utilisateurs, onboarding | Simplifier parcours, masquer avancé, templates guidés | Design/Produit |
| R-19 | Contenu malveillant/phishing hébergé | 4 | 5 | Signalements, réputation domaine | Vérification, abuse pipeline, rate limits, suspension | Takedown, préservation preuves, recours | Trust & Safety |
| R-20 | Upload malveillant ou fuite de média privé | 3 | 5 | Scan positif ou accès non autorisé | Quarantaine, type réel, IAM, URL publiée seulement après publication | Quarantaine/purge, rotation, incident | Media/Security |
| R-21 | Perte de données ou restauration impossible | 2 | 5 | Sauvegarde en échec, RPO/RTO dépassé | PITR, objet versionné, restore drills | Restauration, reconstruction outbox/bundles, communication | Ops |
| R-22 | Conflits d'édition et perte de modifications | 3 | 5 | 409 fréquents, faux état saved | Révisions optimistes, autosave honnête, reprise et tests kill | Dupliquer brouillon, checkpoint et support | Editor/Backend |
| R-23 | Vulnérabilité supply chain | 4 | 4 | Advisory ou paquet compromis | Lockfile, SCA/SBOM, revue, permissions CI | Pin/rollback, patch, rotation | Engineering/Security |
| R-24 | Non-conformité vie privée/fiscalité | 3 | 5 | Revue juridique ou demande réglementaire | Minimisation, registre, DPA, revue pays, PSP adapté | Suspendre marché/feature, remédiation et conseil | Produit/Legal/DPO |
| R-25 | Manque de capacité support/astreinte | 4 | 4 | Backlog support, alertes sans réponse | Runbooks, scope de service réaliste, cohortes limitées | Réduire bêta/offres, support renforcé | Ops/Support |
| R-26 | Subdomain takeover/routage vers mauvais site | 2 | 5 | DNS orphelin ou Host fallback | Inventaire, nettoyage, aucun fallback, sondes | Déroutage, purge cache, incident | Domains/Security |
| R-27 | Analytics excessive ou non fiable | 3 | 3 | Événements dupliqués/coûts/cardinalité | Schémas versionnés, allowlist, métriques serveur | Couper événements non essentiels, recalculer | Data/Produit |
| R-28 | Qualité des tests/flakiness | 3 | 4 | Retries fréquents, releases malgré régressions | Seeds/artefacts, environnements isolés, quarantaine gouvernée | Bloquer P0, corriger infrastructure de test | QA |

## Priorités immédiates

Les risques R-01, R-02, R-05, R-06, R-11, R-16 et R-22 conditionnent le chemin critique. Les spikes de phase 0 doivent produire des preuves sur l'éditeur, le renderer, la publication et l'isolation. Les risques R-09/R-10 exigent un prototype sur une zone DNS réellement contrôlée mais sans utiliser le domaine de production envisagé.

## Revue

Le registre est revu à chaque gate et incident. Chaque mitigation possède une tâche ou un contrôle vérifiable. Un score ne remplace pas l'analyse : toute fuite inter-tenant ou exposition de secret est traitée comme priorité critique même si sa probabilité estimée est faible.
