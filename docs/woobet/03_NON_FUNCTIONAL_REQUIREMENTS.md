# 03 — Exigences non fonctionnelles

## 1. Statut des valeurs

Les valeurs ci-dessous sont des **cibles de conception et budgets de test**, non des mesures effectuées. Le matériel, le réseau, le corpus, la distribution du trafic, la version et les conditions de chaque test doivent être consignés. Un SLO public ne pourra être proposé qu'après observation en bêta.

## 2. Profils de charge de référence

| Profil | Document et usage | Intérêt |
|---|---|---|
| D0 — minimal | 1 page, 5 sections, 10 composants, contenus courts | Régression de base |
| D1 — courant | 8 pages, 30 sections/page, 150 nœuds/page, 20 médias | Développement et CI de performance |
| D2 — complexe | 30 pages, 80 sections/page, 500 nœuds/page, variantes responsive et 3 locales | Limites éditeur/renderer |
| D3 — stress | 1 000 nœuds/page, textes très longs, 100 médias, règles nombreuses | Dégradation contrôlée ; pas nécessairement autorisé |
| T1 — public | 90 % hits cache, 10 % rendu/origine, distribution de sites non uniforme | Capacité et coût |
| T2 — publication | Rafales de publications et rollbacks simultanés | Atomicité, files, invalidation |
| T3 — IA | Générations longues, retries, timeouts et quotas | Coût et résilience |

Les tailles maximales initiales proposées sont des **garde-fous à valider** : 1 Mo JSON compressé par page publique, 5 000 nœuds par page rejetés, alerte au-delà de 1 000, 100 pages par projet au socle, 20 MiB par image source et 200 MiB par vidéo si le module vidéo est activé. Ces valeurs ne sont pas des quotas commerciaux et peuvent changer après benchmarks.

## 3. Performance éditeur

| ID | Cible initiale | Mesure et conditions |
|---|---|---|
| NF-PERF-001 | Retour visuel d'une saisie ou sélection < 100 ms p95 | D1, poste de référence, sans attendre le réseau |
| NF-PERF-002 | Déplacement d'un bloc < 100 ms p95 pour la mise à jour locale ; 60 fps visés pendant l'animation | D1/D2, profiling sans outils dégradant la mesure |
| NF-PERF-003 | Ouverture d'un projet D1 < 3 s p95 après shell chargé | Réseau de test défini ; données paginées |
| NF-PERF-004 | Autosave accusé < 2 s p95 | Charge normale, hors offline ; conflit exclu et mesuré séparément |
| NF-PERF-005 | Aucune croissance mémoire non bornée après 4 h et 1 000 commandes | Heap snapshots avant/après, tolérance fixée par spike |
| NF-PERF-006 | Validation complète d'une page D1 < 500 ms p95 côté serveur | Hors génération de bundle et réseau fournisseur |

Le rejet d'une page D3 doit être compréhensible et ne jamais bloquer l'onglet. Les animations respectent `prefers-reduced-motion`.

## 4. Performance des sites publiés

- **NF-WEB-001 :** le JavaScript de l'éditeur, du Studio, des secrets et du SDK d'administration est absent du bundle visiteur ; vérification automatisée des artefacts et de leurs source maps publiques.
- **NF-WEB-002 :** budget initial à confirmer par template : ≤ 170 KiB de JavaScript compressé pour une page vitrine courante, hors module interactif explicitement mesuré ; ≤ 100 KiB de CSS compressé ; images responsives dimensionnées. Un dépassement exige justification, pas dissimulation.
- **NF-WEB-003 :** sur le corpus de templates V1 et profils réseau/appareil définis, viser LCP ≤ 2,5 s, INP ≤ 200 ms et CLS ≤ 0,1 au 75e percentile. Les mesures labo et terrain sont distinguées.
- **NF-WEB-004 :** rendu d'une page avec hit cache CDN sans appel à PostgreSQL ; miss cache avec budget serveur p95 initial < 800 ms hors intégration dynamique.
- **NF-WEB-005 :** les requêtes de données dynamiques ont timeout, pagination et cache bornés ; une intégration lente ne bloque pas indéfiniment le document principal.

Ces budgets ne s'appliquent pas uniformément à une application métier riche ; chaque module reçoit son propre budget avant acceptation.

## 5. Disponibilité et résilience

| Service | Cible interne de départ | Dégradation attendue |
|---|---|---|
| Lecture de sites publiés | 99,9 % mensuel à étudier après bêta | Ancien bundle servi en cas de panne de l'API de gestion |
| Studio/API de gestion | 99,5 % initial interne | Édition locale limitée ; aucune fausse confirmation de sauvegarde |
| Publication | 99 % des demandes valides aboutissent sans intervention hors dépendance externe, à mesurer | Échec explicite, ancienne version conservée |
| IA | Pas de SLO indépendant initial | File, retry, fournisseur alternatif si activé, création manuelle toujours possible |
| DNS/TLS | Dépendant fournisseur et propagation | États visibles ; renouvellement anticipé et alertes |

**NF-REL-001 :** une panne du Studio ne doit pas rendre indisponibles les bundles déjà publiés si le renderer et le stockage restent sains. **NF-REL-002 :** toute tâche asynchrone est idempotente ou protégée par une clé d'effet unique. **NF-REL-003 :** un retry n'active jamais deux publications pour une même intention.

## 6. Sauvegarde, reprise et rétention

Cibles initiales du service de gestion : **RPO ≤ 15 min**, **RTO ≤ 4 h**, à confirmer selon fournisseur et région. Pour les sites publics, les bundles immuables et leur index doivent permettre une reconstruction. Les sauvegardes PostgreSQL combinent snapshots et restauration à un point dans le temps si disponible ; les objets ont versioning/rétention et protection contre suppression accidentelle.

Un test de restauration est réalisé avant bêta puis au moins trimestriellement ; il vérifie les données, les objets, les secrets nécessaires, les pointeurs de publication et les domaines dans un environnement isolé. Une sauvegarde jamais restaurée n'est pas considérée comme une preuve de reprise. Les durées de rétention des versions, logs, soumissions et assets supprimés sont configurables et documentées par plan et obligation légale.

## 7. Sécurité et isolation

- **NF-SEC-001 :** 100 % des requêtes de ressources tenant passent par une autorisation serveur et un scope workspace ; tests IDOR systématiques.
- **NF-SEC-002 :** RLS PostgreSQL en défense en profondeur sur les tables tenant, rôle applicatif sans `BYPASSRLS`, contexte fixé par transaction.
- **NF-SEC-003 :** chiffrement TLS en transit ; chiffrement fournisseur au repos ; secrets dans un gestionnaire dédié ; rotation testée.
- **NF-SEC-004 :** enregistrement d'audit append-only pour changements de rôle, domaine, publication, facturation, intégration, export et suspension.
- **NF-SEC-005 :** CSP et isolation d'origine entre Studio, contenu public et éventuel contenu non fiable ; aucun cookie de session Studio envoyé au domaine de publication.
- **NF-SEC-006 :** dépendances scannées, images de conteneur non root, SBOM et correctifs selon gravité.
- **NF-SEC-007 :** les entrées de webhook, uploads, URLs distantes et sorties IA sont non fiables et validées.

Le détail des abus et réponses figure dans le document 13.

## 8. Accessibilité

**NF-A11Y-001 :** le Studio vise WCAG 2.2 AA pour les parcours P0/P1 ; les composants publics fournissent les primitives nécessaires mais la qualité du contenu final reste aussi contrôlée par les outils et l'utilisateur.

Clavier complet pour les actions critiques ; alternatives au glisser-déposer ; focus visible ; dialogues avec focus piégé/restauré ; annonces de sauvegarde non intrusives ; contrastes ; cibles tactiles ; zoom 200 % ; réduction de mouvement ; langue et titres ; erreurs reliées aux champs. Les tests automatiques ne suffisent pas : revues manuelles lecteur d'écran et navigation clavier sont obligatoires sur le corpus.

## 9. Maintenabilité et évolutivité

- modules avec API publique interne et dépendances orientées vers le domaine ;
- aucun import transversal arbitraire entre modules, contrôlé par règles de lint ;
- contrats OpenAPI et schémas versionnés ; compatibilité testée sur les deux dernières versions majeures de documents encore supportées selon politique ;
- migrations de base expansives/contractantes et rollback applicatif possible ;
- feature flags avec propriétaire, date d'expiration et nettoyage ;
- complexité et duplication surveillées sans transformer les métriques en objectifs absolus ;
- ADR pour toute décision affectant plusieurs modules ou difficile à reverser.

**NF-MNT-001 :** une nouvelle capacité de composant ne nécessite pas de modification du cœur de commande si elle tient dans le contrat d'extension. **NF-MNT-002 :** une ancienne publication reste rendable par un bundle/renderer compatible ou par une reconstruction contrôlée ; aucune mise à jour de dépendance ne doit réécrire silencieusement les anciennes versions.

## 10. Compatibilité

Deux dernières versions majeures des navigateurs evergreen définies au moment de la release, Safari/iOS et Chrome/Android sur appareils de référence ; la matrice exacte est figée en phase 1. Les formulaires publics et contenus essentiels doivent conserver une dégradation acceptable sans certaines fonctionnalités JS lorsque le mode de rendu le permet. Aucune compatibilité IE n'est prévue.

## 11. Internationalisation et localisation technique

UTF-8 de bout en bout ; normalisation Unicode documentée ; collation et recherche testées ; identifiants de locale BCP 47 ; fuseaux IANA ; devises ISO 4217 ; montants en unités mineures ; tri et formats via bibliothèques de locale, jamais concaténation codée en dur. Les noms de domaine internationaux sont convertis en A-label avec affichage U-label et contrôles d'homoglyphes.

## 12. Confidentialité et gouvernance

Minimisation des événements ; finalités et rétentions documentées ; options de consentement pour analytics non essentiels ; DPA et registre des sous-traitants avant lancement ; région de stockage et transferts évalués ; procédure d'export/suppression ; contenus envoyés à l'IA exclus par défaut lorsqu'ils ne sont pas nécessaires. Les journaux techniques ne contiennent ni mot de passe, ni jeton, ni secret, ni contenu de formulaire brut.

## 13. Observabilité

Logs JSON avec timestamp, niveau, service, environnement, `requestId`, `traceId`, `workspaceId` pseudonymisé/haché selon politique, `projectId`, code d'erreur et état de tâche ; métriques RED/USE ; traces sur API, publication, IA et domaines ; erreurs frontend échantillonnées avec source maps privées ; dashboards par service et par parcours.

Les alertes sont reliées à un runbook et évaluées sur leur utilité. Les métriques de coût par génération, publication, site actif et trafic sont obligatoires avant tarification à l'usage.

## 14. Capacité et montée en charge

La montée en capacité se fait par mesures : taux de hit CDN, CPU renderer, latence DB, connexions, profondeur/âge des files, coût par tâche, stockage et bande passante. Les premières stratégies sont cache, optimisation de requêtes, limites, files et scaling horizontal stateless. Le partitionnement de base ou l'extraction de services ne sont envisagés qu'avec un seuil et un runbook.

## 15. Critères de refus de mise en production

Toute fuite inter-tenant connue ; publication non atomique ; rollback non testé ; secret exposé ; absence de restauration réussie ; régression P0 de sauvegarde ; budget de sécurité ou d'accessibilité critique non résolu ; coût IA non plafonné ; certificats sans alerte ; ou incapacité à distinguer brouillon et publication. Une dérogation exige propriétaire, durée, risque résiduel et approbation formelle.
