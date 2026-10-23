# Vérifications Woob

## Commandes

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
# Contrôle global hors E2E :
npm run verify
```

Les tests Vitest créent des bases PGlite migrées en mémoire. Ils utilisent les vrais services et la persistance SQL, pas de faux repository. Les E2E écrivent dans la base du serveur local et ne doivent jamais cibler une production.

## Résultats effectivement exécutés le 2026-10-23

- `npm run verify` : typecheck et lint réussis, **8 fichiers et 34/34 tests Vitest réussis**, build Next.js réussi.
- `npm run test:e2e` : **19/19 scénarios Playwright réussis** avec Chromium, un worker.
- `npm run db:migrate` : migrations `0001` à `0005` appliquées à la base PGlite de prévisualisation.
- `npm run admin:grant -- platform-admin-e2e@example.com` : rôle plateforme persisté avec succès sur ce compte local existant.
- `npm audit --omit=dev` : **0 vulnérabilité** dans les dépendances de production.
- `npm audit` : **9 alertes (4 modérées, 5 hautes)** dans les outils de développement. Les corrections proposées rétrogradent des outils de façon incompatible ; aucun `--force` n’a été appliqué.
- Build : deux avertissements non bloquants de traçage Turbopack pour le stockage fichier dynamique.

Ces résultats sont des observations datées, pas une garantie sur un autre environnement.

## Couverture unitaire et intégration

- contrats des documents, six modèles techniques, opérations d’arbre, clés de prototype et URL dangereuses ;
- catalogue : 20 catégories, 212 variantes, 30 domaines et 150 sous-domaines, unicité, parents, relations, recherche accent-insensible, filtres, modules compatibles, création libre, contexte de génération, persistance et isolation du brouillon ;
- inscription/connexion, jetons à usage unique, isolation workspace, rôles et conflits de révision ;
- sauvegarde/relecture, snapshots, publication, dépublication, rollback et restauration de brouillon ;
- uploads locaux, signature binaire, isolation de lecture et protection des médias utilisés ;
- formulaires, réservations, commandes au prix serveur, stock et transitions ;
- IA démo, validation de propositions et refus d’URL `javascript:` ;
- quotas de domaines, DTO sans hash, IDN, conflits, admin/viewer, isolation et état DNS désactivé ;
- transitions DNS avec un **résolveur explicitement simulé**, sans prétendre vérifier un domaine externe ;
- refus du checkout et du webhook Stripe lorsque la configuration est absente ;
- administration : refus d’un owner ordinaire, allowlist, rôle explicite, métriques SQL et montants par devise/statut, auto-blocage interdit, sessions révoquées, suspensions effectives, réactivation, quotas après changement manuel d’offre, protection d’un abonnement externe et audit transactionnel.

## Couverture navigateur

Les 19 scénarios couvrent notamment :

- marketing et tarification anonymes ;
- création catalogue en six étapes : recherche, type restaurant, domaine alimentation, réservations, style artisanal, brief, aperçu réel, limites visibles, création et texte retrouvé dans l’éditeur ; les autres parcours utilisent aussi le raccourci vers la description et la prévisualisation obligatoire ;
- édition → sauvegarde → actualisation → texte retrouvé, publication et accès croisé refusé ;
- produit, article, activation de module et partage d’espace entre deux sessions ;
- IA démo : prévisualisation, application, persistance, puis erreurs honnêtes de domaine/paiement non configurés ;
- restauration d’un point de brouillon après rechargement ;
- upload, recherche et réutilisation d’un média persistant ;
- édition à 390 px, tiroirs, aperçu mobile, bouton de sauvegarde visible et absence de débordement horizontal ;
- audits `@axe-core/playwright` sur accueil, connexion, dashboard, éditeur, administration, wizard catalogue et aperçu, sans exclusion des violations détectées ;
- préférence anglaise persistée après rechargement, déconnexion et nouvelle connexion ;
- boucle du focus, Échap et restitution au déclencheur pour les dialogues projet, IA, historique et médias ;
- administration : page et API refusées à un owner ordinaire même avec CSRF, absence de `passwordHash` dans `/api/auth/me`, suspension/réactivation d’un compte avec session navigateur révoquée, changement manuel d’offre, modération workspace/projet, mobile à 390 px et audit axe de `/admin`.

L’audit axe automatisé ne constitue ni une conformité WCAG complète ni un test avec lecteur d’écran.

## E2E obligatoire à conserver

1. Créer un compte et un projet.
2. Ouvrir l’éditeur et sélectionner le titre Hero de l’accueil.
3. Modifier son texte dans l’inspecteur.
4. Sauvegarder et attendre la confirmation serveur.
5. Actualiser le navigateur.
6. Vérifier que le nouveau texte est toujours présent.

Un second compte doit recevoir 404 sur le projet/API du premier, et un `viewer` doit recevoir 403 en écriture. Aucun résultat E2E ne doit être déclaré avant exécution effective.

## Non couvert ici

Aucun appel OpenAI, SMTP, S3, PostgreSQL externe, Stripe, DNS public ou TLS réel n’a été exécuté. Les tests avec technologies d’assistance, les tests de charge et la restauration de sauvegardes d’un déploiement restent à réaliser sur leurs environnement et outillage réels.
