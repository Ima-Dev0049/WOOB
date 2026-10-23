# 26 — Critères d'acceptation vérifiables

## 1. Règle de preuve

Un critère est validé par un test automatisé, une inspection reproductible ou un exercice documenté, rattaché à une version et à un environnement. « Cela fonctionne » ou une capture isolée ne suffit pas. Les seuils marqués **cible** sont ceux du document 03 ; ils peuvent être recalibrés avant gel, pas ignorés après mesure.

## 2. Fondation et identité

| ID | Critère Given/When/Then | Preuve minimale | Tâches |
|---|---|---|---|
| AC-ENV-001 | Étant un environnement neuf, lorsque l'installation et la CI sont exécutées, alors les builds/tests sont reproductibles avec le lockfile et aucun secret requis en clair | Log CI + cache vidé | P01-T01/T02 |
| AC-IAM-001 | Étant une inscription, lorsque l'email n'est pas vérifié, alors les capacités protégées restent refusées et la réponse n'indique pas si un autre compte existe | Intégration + E2E | P02-T01 |
| AC-IAM-002 | Étant un jeton de récupération utilisé ou expiré, lorsqu'il est rejoué, alors il est refusé et les sessions restent révoquées | Test de rejeu | P02-T01 |
| AC-IAM-003 | Étant un changement de mot de passe/rôle sensible, lorsqu'il est confirmé, alors les sessions concernées sont révoquées/réévaluées et un audit sans secret existe | Intégration + audit | P02-T01/T04 |
| AC-TEN-001 | Étant deux workspaces A/B, lorsque A utilise un ID d'objet B sur chaque endpoint, alors aucune donnée B n'est retournée et les caches ne contiennent pas de fuite | Matrice API IDOR | P02-T03, tous modules |
| AC-TEN-002 | Étant une requête DB sans contexte tenant ou avec un autre tenant, lorsque RLS est active, alors aucune ligne tenant n'est accessible au rôle runtime | Tests PostgreSQL réels | P02-T03 |
| AC-TEN-003 | Étant le dernier owner, lorsqu'il se retire ou est rétrogradé, alors la transaction est refusée ; un transfert valide conserve au moins un owner | Concurrence + E2E | P02-T03 |
| AC-AUD-001 | Étant une action sensible, lorsqu'elle aboutit ou est refusée selon politique, alors acteur, action, ressource, date et request ID sont enregistrés sans secret et le rôle runtime ne peut pas modifier l'audit | Intégration append-only | P02-T04 |

## 3. Schéma, composants et rendu

| ID | Critère | Preuve minimale | Tâches |
|---|---|---|---|
| AC-SCH-001 | Étant les fixtures valides de chaque version supportée, lors de la validation/migration, alors le résultat respecte le schéma courant et l'original reste inchangé | Golden files + propriétés | P03-T01/T03 |
| AC-SCH-002 | Étant un document avec ID dupliqué, cycle, profondeur excessive, clé dangereuse ou type inconnu, lors de l'import/publication, alors il est rejeté avec code et chemin sans effet partiel | Tests négatifs/fuzz | P03-T01 |
| AC-SCH-003 | Étant une sortie non JSON ou un patch non conforme, lors du pipeline IA, alors aucune écriture du brouillon n'a lieu | Contrat IA | P08-T03/P09-T01 |
| AC-CMP-001 | Étant chaque composant stable, lors des tests contenu court/long/vide/invalide × breakpoints × clavier, alors il respecte son contrat et aucune erreur non contrôlée ne survient | Matrice composants | P03-T02/P06-T02 |
| AC-CMP-002 | Étant une dépendance/capacité absente, lors de l'insertion ou publication, alors le système bloque ou utilise le fallback explicitement défini sans simuler le service métier | Tests de capabilities | P06-T02/P16-T01 |
| AC-RND-001 | Étant le même document et les mêmes versions, lors du rendu preview et public, alors la projection et les captures sont équivalentes hors overlays documentés | Snapshots + captures | P03-T04 |
| AC-RND-002 | Étant une publication vitrine, lors de l'analyse du bundle visiteur, alors aucun module Studio/éditeur ni secret/champ interne n'est présent | Analyse artefacts | P03-T04/P12-T01 |
| AC-RND-003 | Étant un binding dynamique qui dépasse son timeout, lors du rendu, alors le fallback du composant est servi dans la deadline et le cache partagé n'est pas contaminé par une 5xx | Fault injection | P03-T04/P16-T02 |
| AC-RND-004 | Étant les profils de référence, lors des budgets de performance, alors les cibles NF-PERF/NF-WEB sont mesurées et tout écart est approuvé avant gate | Rapport de perf | P14-T04 |

## 4. Éditeur et versions

| ID | Critère | Preuve minimale | Tâches |
|---|---|---|---|
| AC-EDT-001 | Étant une séquence aléatoire de commandes valides, lors d'undo complet puis redo complet, alors les invariants restent vrais et les états sont équivalents selon la sémantique définie | Property tests | P04-T01 |
| AC-EDT-002 | Étant 100 scénarios de drop nested/slots, lors du drag ou de l'alternative clavier, alors parent/slot/index résultants correspondent à la cible affichée | E2E + clavier | P04-T03 |
| AC-EDT-003 | Étant un changement local, lorsque l'état `saved` apparaît, alors le serveur a confirmé la révision correspondante ; hors ligne ce statut ne peut apparaître | Tests réseau | P04-T04 |
| AC-EDT-004 | Étant deux révisions concurrentes, lors de la seconde sauvegarde, alors un conflit est retourné et aucune modification n'est écrasée silencieusement | Concurrence API/E2E | P04-T04/P05-T04 |
| AC-EDT-005 | Étant D1/D2, lors des interactions de référence, alors les budgets p95 de sélection/saisie/drag sont satisfaits sur le matériel consigné | Profils reproductibles | P04-T02/P05-T04 |
| AC-EDT-006 | Étant une session de 4 h et 1 000 commandes, lors du soak, alors aucune croissance mémoire non bornée ni duplication de listeners n'est observée au-delà de la tolérance fixée | Soak + heaps | P05-T04 |
| AC-EDT-007 | Étant un style hérité et un override mobile, lors du changement de breakpoint/reset, alors la source effective est correcte et seule la propriété visée change | Unités + captures | P05-T02 |
| AC-VER-001 | Étant un checkpoint, lors d'une restauration, alors une nouvelle révision est créée, l'historique demeure et la publication active ne change pas | Intégration + E2E | P07-T02 |
| AC-VER-002 | Étant un crash avant/après accusé d'autosave, lors de la reprise, alors l'utilisateur retrouve un état cohérent et tout changement non confirmé est explicitement identifié | Kill tests | P07-T03 |

## 5. IA

| ID | Critère | Preuve minimale | Tâches |
|---|---|---|---|
| AC-AI-001 | Étant un brief restaurant multilingue, lors de la génération, alors plan, pages, thème, navigation et SEO sont proposés ; réservation réelle est marquée module requis si absente | Cas de référence + revue | P08-T02 |
| AC-AI-002 | Étant une sortie nécessitant réparation, lors du pipeline, alors les tentatives sont bornées, l'échec est visible et aucun résultat invalide n'est appliqué | Fault injection | P08-T03 |
| AC-AI-003 | Étant une instruction limitée à une section, lorsque le patch touche une autre section ou un privilège, alors le patch entier est refusé et journalisé | Corpus adversarial | P09-T01 |
| AC-AI-004 | Étant un patch accepté, lors d'undo, alors le document revient exactement à l'état avant commande composite ; aucune publication automatique n'a lieu | E2E + snapshot | P09-T02 |
| AC-AI-005 | Étant une révision modifiée pendant la génération, lors de l'application, alors le patch obsolète est refusé/réanalysé sans écrasement | Concurrence | P09-T03 |
| AC-AI-006 | Étant un budget/crédit restant insuffisant ou deux requêtes concurrentes, lors de la réservation, alors le hard cap est respecté et les ajustements sont rapprochés | Intégration atomique | P08-T04/P15-T03 |
| AC-AI-007 | Étant le jeu de test aveugle versionné, lors d'une release IA, alors validité, acceptation, fidélité, latence et coût sont comparés à la baseline et les régressions critiques bloquent | Rapport d'évaluation | P08-T04 |

## 6. Publication, domaines et SEO

| ID | Critère | Preuve minimale | Tâches |
|---|---|---|---|
| AC-PUB-001 | Étant une édition après le snapshot, lors de la construction, alors le bundle correspond au snapshot initial et non au nouveau brouillon | Concurrence + checksums | P10-T01 |
| AC-PUB-002 | Étant un kill avant écriture, pendant bundle, avant activation et après activation, lors de la reprise, alors aucune version partielle n'est servie et l'état permet retry/rollback sûr | Fault injection à chaque étape | P10-T02 |
| AC-PUB-003 | Étant deux publications concurrentes, lors de leur activation, alors une seule publication active est résolue et l'ordre est conforme aux intentions/révisions | Test transactionnel | P10-T02 |
| AC-PUB-004 | Étant une publication active défaillante, lors d'un rollback, alors le pointeur vise un bundle sain, le brouillon reste inchangé et l'opération est auditée | E2E sous trafic | P10-T02 |
| AC-PUB-005 | Étant le cache CDN, lors d'une activation, alors les nouvelles requêtes résolvent la nouvelle clé sans mélange d'assets et les réponses privées ne sont pas partagées | Tests HTTP edge | P10-T04/P12-T01 |
| AC-DOM-001 | Étant deux tenants réservant le même slug/domaine, lors de la transaction, alors un seul aboutit et l'autre reçoit un conflit sans fuite d'information | Contrainte + concurrence | P10-T03/P11-T01 |
| AC-DOM-002 | Étant un Host inconnu/forgé, lors du routage, alors aucun site par défaut n'est servi et aucune clé de cache inter-tenant n'est créée | Tests Host/cache | P10-T03 |
| AC-DOM-003 | Étant un domaine sans preuve ou avec DNS invalide, lors du provisionnement, alors il ne devient pas actif ; après correction la reprise respecte la machine à états | DNS zone de test | P11-T01/T02 |
| AC-DOM-004 | Étant un certificat proche d'expiration ou une émission en échec, lors du worker, alors retry/backoff et alertes se déclenchent sans boucle ni clé privée journalisée | Sandbox + exercice | P11-T03 |
| AC-DOM-005 | Étant un domaine supprimé puis réattribué, lors de son activation par un nouveau projet, alors aucun contenu ni cache de l'ancien projet n'est servi | Cycle de vie E2E | P11-T04 |
| AC-SEO-001 | Étant preview/staging, lors d'une requête, alors l'accès est protégé et les réponses sont non indexables ; aucune preview n'apparaît dans un sitemap public | Tests HTTP | P03-T04/P10-T05 |
| AC-SEO-002 | Étant des pages localisées et un changement d'URL, lors de la publication, alors canoniques, hreflang réciproques, sitemap et redirections sans boucle sont cohérents | Corpus multilingue | P10-T05/P13-T02 |

## 7. Médias, i18n, extensions et facturation

| ID | Critère | Preuve minimale | Tâches |
|---|---|---|---|
| AC-MED-001 | Étant un fichier au MIME mensonger/SVG actif/image géante, lors du traitement, alors il est refusé/quaranténé sans exécution ni épuisement du worker | Corpus malveillant | Media avant P10 ; P14-T03 |
| AC-MED-002 | Étant un asset privé de B, lorsque A demande l'original ou une variante, alors l'accès est refusé ; après publication seule la copie publique prévue est accessible | Intégration IAM/HTTP | Media + P12-T01 |
| AC-MED-003 | Étant un asset référencé par une publication, lors d'une demande de suppression, alors le système bloque ou conserve la copie requise ; aucune URL signée temporaire n'est publiée | Références + purge | P07/P10/media |
| AC-I18N-001 | Étant les langues de lancement, lors des parcours, alors aucune clé manquante critique, troncature bloquante ou mauvais format de date/nombre n'est présent | CI catalogues + E2E | P13-T01 |
| AC-I18N-002 | Étant une date DST et une devise sans décimales, lors du formatage/calcul, alors l'instant/fuseau et le montant entier restent exacts ou l'ambiguïté est demandée | Unités/localisation | P13-T03 |
| AC-EXT-001 | Étant une extension demandant de nouveaux droits ou une API incompatible, lors de la mise à jour, alors elle reste inactive jusqu'à approbation et le site conserve un fallback sûr | Contrat extension | P16-T01 |
| AC-FRM-001 | Étant une double soumission ou un payload invalide/spam, lors du POST public, alors validation/idempotence/limits sont appliquées et aucun payload n'apparaît dans les logs | Intégration + abus | P16-T03 |
| AC-BIL-001 | Étant des webhooks dupliqués/désordonnés et un événement perdu, lors du rapprochement, alors l'état local correspond à l'état provider sans double effet | Sandbox + job | P15-T02 |
| AC-BIL-002 | Étant un downgrade au-dessus des quotas ou une expiration, lors de la transition, alors aucune ressource n'est supprimée brutalement et les capacités suivent la politique de grâce | E2E | P15-T04 |

## 8. Exploitation et lancement

| ID | Critère | Preuve minimale | Tâches |
|---|---|---|---|
| AC-OPS-001 | Étant une sauvegarde à un point choisi, lors de la restauration isolée, alors contraintes, objets, pointeurs et sites de test sont cohérents et RPO/RTO réels sont consignés | Restore drill | P12-T02 |
| AC-OPS-002 | Étant une perte Redis, lors de la reprise, alors les sites publics restent dégradés selon design et les intentions outbox peuvent être rejouées sans double effet | Game day | P12-T02/P14-T01 |
| AC-OPS-003 | Étant une alerte critique, lors du game day, alors elle atteint le bon responsable avec runbook et l'incident est clôturé par une revue | Exercice d'alerte | P14-T01 |
| AC-OPS-004 | Étant un déploiement avec migration, lors du canary puis rollback, alors ancien/nouveau code lisent les données prévues et les publications anciennes restent rendables | Exercice CD | P18-T02 |
| AC-A11Y-001 | Étant les parcours critiques, lors des tests clavier et lecteur d'écran, alors ils sont réalisables sans piège de focus et les défauts automatiques/manuels bloquants sont résolus | Rapport manuel + auto | P14/P17 |
| AC-BETA-001 | Étant le gate bêta, lors de la revue, alors tous les critères P0 applicables ont une preuve à jour et toute exception a risque, propriétaire et expiration | Dossier de gate | P17-T02 |
| AC-LAUNCH-001 | Étant l'ouverture progressive, lors d'un seuil d'arrêt dépassé, alors le rollout s'arrête et le rollback/mode dégradé est exécuté selon runbook | Répétition + release | P18-T02/T03 |

## 9. Règle de couverture

Avant bêta, chaque exigence P0 doit référencer au moins un critère ci-dessus ou un critère annexe. Les critères sans tâche implémentée restent `not_run`, jamais `passed`. Les résultats utilisent `not_run`, `passed`, `failed`, `blocked`, `waived_with_expiry`. Le présent dossier initialise tous les critères à **not_run**.
