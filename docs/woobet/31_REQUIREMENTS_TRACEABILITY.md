# 31 — Matrice de traçabilité

## 1. Usage

Cette matrice relie les exigences structurantes aux spécifications, tâches, critères et risques. Elle ne remplace pas la matrice détaillée qui sera générée depuis les identifiants dans la phase 1. Tous les critères sont initialement `not_run`.

| Exigence/capacité | Spécification | Tâches principales | Critères/preuves | Risques |
|---|---|---|---|---|
| F-IAM-001–004 Identité | 02, 06, 13 | P02-T01/T02 | AC-IAM-001/002/003 | R-06, R-23 |
| F-IAM-005–007 Tenancy/RBAC | 02, 12, 13 | P02-T03/T04 | AC-TEN-001/003, AC-AUD-001 | R-06 |
| F-PRJ/PAG Documents | 02, 08, 12 | P03-T01/T05 | AC-SCH-001/002 | R-14, R-22 |
| F-CMP Registre | 02, 08 | P03-T02, P06-T02 | AC-CMP-001/002 | R-03, R-16 |
| F-THM Thèmes/tokens | 02, 07, 08 | P05-T02, P06-T01 | AC-EDT-007, corpus visuel | R-05 |
| F-TPL Templates | 02, 14 | P06-T03 | Import/checksum/licence + AC-CMP | R-14, R-20 |
| F-EDT Commandes | 02, 05, 07 | P04-T01–T04 | AC-EDT-001/003 | R-02, R-22 |
| Mode avancé/responsive | 05, 07 | P05-T01–T04 | AC-EDT-002/005/006/007 | R-02, R-18 |
| Versions/reprise | 07, 12 | P07-T01–T03 | AC-VER-001/002, AC-EDT-004 | R-21, R-22 |
| F-AI-001 Génération | 02, 09 | P08-T01–T03 | AC-AI-001/002/007 | R-04, R-05, R-13 |
| F-AI-003/004 Patchs | 02, 09 | P09-T01–T03 | AC-AI-003/004/005 | R-04, R-22 |
| F-AI-007 Coûts/quotas | 09, 17, 20 | P08-T04, P15-T03 | AC-AI-006/007 | R-04, R-17 |
| F-MED Médias | 02, 14, 12 | Media transverse + P10/P14 | AC-MED-001/002/003 | R-20 |
| Publication atomique | 04, 10, 12 | P10-T01/T02 | AC-PUB-001/002/003/004 | R-11, R-21 |
| Sous-domaines/routage | 10, 13 | P10-T03/T04 | AC-PUB-005, AC-DOM-001/002 | R-26 |
| Domaines custom/TLS | 10, 11 | P11-T01–T04 | AC-DOM-003/004/005 | R-09, R-10 |
| SEO/indexation | 08, 10, 16 | P10-T05, P13-T02 | AC-SEO-001/002 | R-07 |
| Hébergement/cache | 04, 11 | P12-T01–T03 | AC-PUB-005, charge et coûts | R-08, R-12, R-15 |
| Internationalisation | 16, 12 | P13-T01–T03 | AC-I18N-001/002, AC-SEO-002 | R-18, R-24 |
| NF-SEC Isolation | 03, 12, 13 | P02-T03, P14-T03 | AC-TEN-001/002, AC-MED-002 | R-06, R-07 |
| NF-PERF Éditeur | 03, 05, 07 | P05-T04, P14-T04 | AC-EDT-005/006, AC-RND-004 | R-02, R-15 |
| NF-WEB Public | 03, 08, 11 | P03-T04, P12-T03 | AC-RND-002/004 | R-03, R-15 |
| NF-A11Y Accessibilité | 03, 07, 18 | P04–P06, P14/P17 | AC-A11Y-001 | R-18 |
| NF-REL Résilience | 03, 06, 21 | P10-T02, P12-T02 | AC-PUB-002, AC-OPS-001/002 | R-11, R-21 |
| Audit/observabilité | 13, 20 | P02-T04, P14-T01/T02 | AC-AUD-001, AC-OPS-003 | R-25, R-27 |
| Facturation/entitlements | 17, 12, 27 | P15-T01–T04 | AC-BIL-001/002, AC-AI-006 | R-17, R-24 |
| Extensions | 15, 27 | P16-T01 | AC-EXT-001 | R-06, R-16 |
| Collections | 12, 15 | P16-T02 | AC-RND-003 + requêtes hostiles | R-08, R-16 |
| Formulaires | 02, 13, 15 | P16-T03 | AC-FRM-001 | R-19, R-24 |
| Déploiement/restauration | 21 | P12-T02, P18-T02 | AC-OPS-001/002/004 | R-21, R-23 |
| Bêta/lancement | 19, 22, 26 | P17-T01–T03, P18-T01–T03 | AC-BETA-001, AC-LAUNCH-001 | R-25, R-17 |

## 2. Couverture des chapitres demandés

| Demande | Documents |
|---|---|
| Fonctionnel/non fonctionnel | 02, 03 |
| Architecture globale/frontend/backend | 04, 05, 06 |
| Moteur de création/éditeur/renderer | 07, 08, 15 |
| IA | 09 |
| URL/domaines/publication/hébergement | 10, 11 |
| Base de données/ERD/migrations | 12, `examples/0001_core.sql` |
| Sécurité/authentification | 13 |
| Médias | 14 |
| Extensions métier | 15 |
| Internationalisation/monetisation/UX | 16, 17, 18 |
| Tests/observabilité/déploiement | 19, 20, 21 |
| Roadmap/backlog/ADR/risques | 22, 23, 24, 25 |
| Acceptation/API/glossaire | 26, 27, 28 |
| Décisions ouvertes/audit/coûts | 29, 30, 32 |

## 3. Règles de maintien

Toute nouvelle exigence reçoit un ID stable, une phase, un propriétaire, un critère et un test/inspection. Une tâche terminée sans preuve reste ouverte au gate. Une exigence supprimée est marquée `rejected` avec motif plutôt que retirée silencieusement de l'historique. Les annexes de modules transactionnels doivent rejoindre cette matrice avant leur développement.
