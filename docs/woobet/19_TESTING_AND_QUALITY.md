# 19 — Stratégie de tests et qualité

## 1. Objectif

Les tests doivent prouver les invariants critiques : isolation, non-perte, rendu conforme, publication atomique, reprise et sécurité. La couverture de lignes est indicative ; elle ne remplace pas la couverture des risques. Aucun test n'est déclaré exécuté dans cette mission documentaire.

## 2. Pyramide et environnements

| Niveau | Outils candidats | Portée | Quand |
|---|---|---|---|
| Unitaires | Vitest + runner Node pour backend | Domaine, commandes, migrations, tokens, calculs de quota | Chaque PR |
| Propriétés/fuzz | fast-check ou équivalent validé | Documents, patches, slugs, redirections, migrations | PR/nightly selon durée |
| Composants | Testing Library + Playwright component si retenu | UI, accessibilité, états et renderer | PR |
| Intégration | PostgreSQL/Redis/S3 local en conteneurs | ORM, RLS, transactions, outbox, stockage | PR |
| Contrat API | OpenAPI + tests de schéma | DTO, erreurs, compatibilité clients | PR |
| Contrat fournisseur | Doubles + environnement sandbox | IA, paiement, DNS/TLS, email | PR avec doubles ; scheduled sandbox |
| E2E | Playwright | Parcours Studio/public sur navigateurs | PR critique + nightly complet |
| Visuel | Playwright screenshots + outil calibré | Fidélité et responsive | PR composants + nightly corpus |
| Sécurité | SAST/SCA/secrets/DAST + tests manuels | Menaces du document 13 | PR + nightly + avant release |
| Charge | k6/Gatling/Locust après comparaison | API, renderer, publication, files | Nightly léger + release complet |
| Restauration | Scripts IaC/runbooks | DB, objets, secrets, pointeurs | Avant bêta + trimestriel |
| Migration | Environnements éphémères | DB et schéma de pages | PR migration + release |

Les outils sont des recommandations à valider avec la stack verrouillée. Les tests utilisent des données synthétiques ; jamais de copie brute de production.

## 3. Corpus de documents et sites

Fixtures versionnées pour chaque version de schéma et composant : D0–D3 ; textes courts/longs/absents/invalides ; caractères Unicode, emoji, RTL et CJK selon support ; images manquantes/lentes ; liens cassés ; thèmes contrastés/non conformes ; bindings qui timeout ; documents anciens ; templates avec dépendances absentes ; sorties IA malformées et adversariales.

Le corpus visuel utilise des navigateurs et largeurs fixes, polices contrôlées et animations désactivées. Les seuils de diff sont calibrés par composant ; masquer de grandes zones pour faire passer un test est interdit sans revue.

## 4. Scénarios critiques

### Édition et données

1. Saisie, undo/redo, reload : seul le dernier état confirmé est présenté comme sauvegardé.
2. Deux onglets modifient la même page : 409 et résolution, aucun last-write-wins silencieux.
3. Kill du worker après outbox : reprise sans double publication/email/facture.
4. Migration d'un document ancien : original intact, nouveau valide, rollback applicatif possible.
5. Composant avec contenu long/vide : pas de crash ni débordement bloquant.

### Isolation et sécurité

6. Utilisateur A avec ID d'un projet/asset/version/export de B : 403/404 sans fuite, y compris cache et logs.
7. RLS activée avec mauvais/absent contexte : aucune ligne tenant.
8. Contributor tente `role=owner`, publication ou domaine : refus serveur.
9. SVG/HTML/JSON-LD malveillant : aucune exécution dans Studio/public.
10. URL webhook vers loopback, IP privée, redirect et DNS rebinding : refus.
11. Host inconnu ou forgé : aucun site par défaut et pas de cache poisoning.
12. Preview sans autorisation : pas d'accès et `noindex`.

### Publication et domaines

13. Échec avant bundle, avant activation, après activation : ancienne version ou rollback contrôlé, jamais de manifeste partiel.
14. Deux publications concurrentes : ordre explicite et une seule active.
15. Rollback pendant trafic : réponses cohérentes par publication, pas de mélange d'assets.
16. Deux tenants réservent le même slug : une seule contrainte unique réussit.
17. Domaine TXT valide puis DNS incorrect : pas d'activation ; reprise après correction.
18. Certificat proche d'expiration : alerte et renouvellement, pas de boucle ACME.
19. Suppression/réattribution de domaine : ancien contenu non servi au nouveau propriétaire sans publication explicite.

### IA, facturation et quotas

20. Sortie IA invalide puis réparation bornée : aucune application avant validation.
21. Patch IA hors sélection : rejet complet et audit.
22. Timeout provider après possible appel : coût/état rapprochés, retry borné.
23. Webhook paiement dupliqué/désordonné : entitlements corrects et une seule facture locale.
24. Deux générations consomment le dernier crédit : réservation atomique, pas de solde négatif non autorisé.

## 5. Accessibilité

Automatisation avec axe ou équivalent, puis tests manuels : clavier seul, NVDA/Firefox et VoiceOver/Safari selon matrice, zoom/reflow, contraste, reduced motion, erreurs, focus, tree et drag alternatif. Les composants publics sont testés avec contenus réels, pas seulement des exemples vides. Les défauts de contenu utilisateur sont distingués des défauts de composant.

## 6. Performance et charge

Tests de latence avec D1/D2 ; soak éditeur 4 h ; API avec distributions réalistes ; renderer avec hits/misses ; rafales de publications ; files IA lentes ; DB avec volumétrie ; cache froid ; uploads et transformations. Enregistrer version, ressources, données, taux d'erreur, p50/p95/p99, saturation et coût.

Un test de charge n'est pas lancé contre des fournisseurs externes sans autorisation et quotas. Les dépendances sont simulées pour certains scénarios, puis testées séparément en sandbox.

## 7. Tests de restauration et sinistre

Restaurer PostgreSQL à un timestamp dans un environnement isolé ; restaurer/réconcilier objets et bundles ; rejouer outbox ; recréer cache Redis ; vérifier domaines et pointeurs ; contrôler qu'un site publié correspond au manifeste. Mesurer RPO/RTO réel et documenter les écarts. Exercice de perte d'une région/provider selon le niveau de reprise retenu.

## 8. CI et quality gates

PR : format, lint, types, unités, contrats, intégration critique, build, tests de schéma, sécurité rapide, budgets de bundle. Main/nightly : navigateurs, corpus complet, charge légère, scans étendus. Release : E2E complet, migrations sur copie synthétique volumétrique, restore drill selon cadence, canary, smoke public et rollback.

Un test flaky ne doit pas être simplement retiré jusqu'à verte : quarantaine avec propriétaire et délai, tout en gardant les tests P0 bloquants via une stratégie fiable. Les artefacts comprennent traces, captures, logs expurgés, seed de fuzz et versions.

## 9. Définition de prêt d'une fonctionnalité

Exigence et permission définies ; états UX ; métriques/logs ; erreurs ; unités/intégration/E2E pertinents ; accessibilité ; i18n ; quotas/coûts ; documentation ; migration/rollback ; aucune régression P0/P1 ; acceptance IDs liés. Une feature flag ne supprime pas ces obligations pour le code activé.

## 10. Couverture de traçabilité

`31_REQUIREMENTS_TRACEABILITY.md` relie exigences, risques, tâches, tests et critères. La CI peut vérifier que chaque exigence P0 a au moins un test ou une inspection formelle. Les preuves de bêta sont archivées avec la version du produit et du corpus.
