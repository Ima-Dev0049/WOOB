# 15 — Extensions et modules métier

## 1. Principe d'extensibilité

Le moteur de création fournit documents, rendu, collections, identité de gestion, formulaires, permissions, événements, API et webhooks. Un module métier ajoute un domaine avec ses propres invariants et souvent une identité d'utilisateur final. Installer un composant visuel ne suffit jamais à créer le service correspondant.

Les modules sont versionnés et déclarent leurs capacités. Le socle V1 livre le contrat d'extension et des pilotes limités ; chaque module transactionnel a un cahier des charges, des tests et une gate de lancement propres.

## 2. Manifeste d'extension

```json
{
  "extensionKey": "woobet.forms",
  "version": "1.0.0",
  "apiRange": ">=1.0.0 <2.0.0",
  "components": [{"key": "forms.contact", "version": "1.0.0"}],
  "permissions": ["forms.submissions.read", "notifications.email.send"],
  "eventsConsumed": ["FormSubmissionCreated"],
  "eventsProduced": ["FormSubmissionAccepted"],
  "dataModels": [],
  "configurationSchema": {},
  "limits": {"requestsPerMinute": 60},
  "uninstallPolicy": "retain-data-until-purge"
}
```

Exemple conceptuel, non enregistrement d'une extension existante. Permissions exactes, granulaires et présentées en langage compréhensible. Une mise à jour demandant plus de droits exige une nouvelle approbation. Les packages sont signés/checksumés et analysés.

## 3. API stables et cycle de vie

- API d'extension versionnée ; aucune table interne directement exposée ;
- événements avec version, ID, timestamp, tenant et données minimales ;
- webhooks signés et rejouables ; SDK futur généré depuis contrats ;
- états `available → installed → active → suspended → uninstalling → removed` ;
- désinstallation : arrêt du trafic, export, révocation secrets/webhooks, traitement des données, fallback des composants ;
- compatibilité : `apiRange`, schéma de page et versions de composants ; canary sur projet de test ;
- erreurs d'extension isolées, timeouts, quotas et circuit breaker ; pas de crash du site entier.

Les extensions internes de WOOBET suivent le même contrat autant que possible, mais peuvent avoir des privilèges de plateforme explicitement listés.

## 4. Niveaux de composants personnalisés

| Niveau | Capacité | Risque | Cible |
|---|---|---|---|
| L0 | Composition de primitives et props | Faible | V1 |
| L1 | Composant déclaratif enregistré par WOOBET/agence, sans code arbitraire | Modéré | V1/P2 |
| L2 | CSS contrôlé et bindings avancés | Modéré/élevé | P2 après parseur et isolation |
| L3 | Package de code revu, signé, compilé par WOOBET | Élevé | Écosystème partenaire futur |
| L4 | Script utilisateur arbitraire sandboxé | Très élevé | P3, origine et runtime séparés |

Le L4 n'est pas requis pour personnaliser les sites V1. Il exige isolation CPU/mémoire/réseau, absence de cookies sensibles, CSP, limitation d'origine, kill switch et modèle de sécurité dédié.

## 5. Formulaires et marketing — socle V1

### Fonctions V1

Champs texte/email/téléphone/date/choix/fichier selon risques ; validation serveur ; consentement et liens de confidentialité ; messages localisés ; stockage chiffré ou référence sécurisée ; notification ; export et rétention ; anti-spam proportionné ; événements `form_submitted`, `lead_created` si module ; webhook sortant.

### Dépendances

Email transactionnel, stockage sécurisé, quotas, consentement et politique de confidentialité. Les intégrations CRM/newsletter exigent OAuth ou clés en coffre, mapping de champs, gestion des doubles opt-ins et erreurs.

### Hors V1 complète

Campagnes multicanales, automation visuelle générale, lead scoring, A/B testing à grande échelle et attribution avancée. Les événements de conversion sont minimisés et soumis au consentement ; aucune promesse d'attribution exacte.

## 6. E-commerce — module futur complet

| Sous-domaine | Spécifications indispensables | Dépendances et risques |
|---|---|---|
| Catalogue | Produits, variantes, options, prix, devises, médias, SEO, publication | Collections typées et règles d'unicité |
| Prix/taxes | Listes de prix, dates, taxes par juridiction, arrondis | Moteur fiscal externe ou règles validées ; aucune formule générique improvisée |
| Stock | Quantités, réservations, backorder, concurrence | Transactions et intégration logistique |
| Panier | Identité invité/compte, expiration, recalcul serveur | Ne jamais faire confiance au prix du navigateur |
| Commande | Machine à états, lignes figées, adresses, numéros, audit | Transactions, idempotence et export comptable |
| Paiement | Intents/sessions, 3DS selon provider, remboursement, webhooks | PSP, PCI : hosted fields/page pour minimiser scope |
| Livraison | Zones, tarifs, transporteurs, suivi | APIs et adresses ; fuseaux |
| Coupons | Règles, cumul, limites, période | Conflits et fraude |
| Clients/retours | Comptes, historique, retours/remboursements | Auth des utilisateurs finaux, confidentialité |
| Notifications | Confirmation, expédition, échec | Email et templates localisés |

**Socle réutilisable V1 :** pages produit non transactionnelles et collections catalogue simples. **Ne pas appeler « boutique »** une page avec bouton de paiement sans commandes, rapprochement et webhooks. La V1 e-commerce complète est exclue tant que les invariants d'argent, stock et paiement n'ont pas leur propre dossier.

## 7. Restaurants, hôtels et réservations

Socle V1 : menus/cartes comme collections, catégories, prix avec devise, horaires et fuseau, galeries, témoignages, carte via intégration, liens externes de réservation clairement identifiés.

Module réservation futur : ressources/tables/chambres, capacités, créneaux, fuseaux/DST, disponibilités, durées, buffers, réservations, modifications/annulations, liste d'attente, acomptes/no-show, notifications et consiliation. La disponibilité doit être transactionnelle pour éviter la double réservation ; un simple formulaire n'est pas une réservation confirmée. Les hôtels ajoutent tarifs par nuit, inventaire et channel managers ; ce n'est pas le même module qu'un restaurant.

## 8. Écoles et formations

Socle V1 : pages de formations, programme, formateurs, formulaire de demande et paiement externe éventuel clairement délimité.

Module LMS futur : cours/sections/leçons, contenus privés, comptes apprenants, inscriptions, règles d'accès, progression idempotente, quiz et tentatives, certificats, paiements, éventuellement vidéo protégée. Permissions et analytics de progression ont des exigences de confidentialité. Une page « cours » publique n'est pas un LMS.

## 9. Collections et applications métier

### Socle Collections

Champs : texte, texte riche limité, nombre entier/décimal contrôlé, booléen, date/datetime avec fuseau, énumération, asset, relation, utilisateur/référence si module. Chaque champ a required, unicité éventuelle, bornes, localisation et permission. Les records ont brouillon/publié/archivé et révision.

Les composants dynamiques déclarent une requête : collection, filtre AST, tri, pagination et champs autorisés. Le serveur compile vers une requête paramétrée avec limite et timeout. Les utilisateurs ne fournissent ni SQL ni URLs d'API internes.

### Workflows futurs

Machine à états typée : déclencheur, conditions, actions, retries, délai, permissions et journal. Les actions externes passent par outbox/idempotence. Une exécution ne peut pas s'auto-déclencher sans limite de profondeur. Le moteur général de workflow est P2/P3 ; les workflows V1 sont des machines codées et testées (publication, domaine, facturation).

### Utilisateurs finaux et espaces membres

Ils ne réutilisent pas `users` du Studio par défaut. Une table/service d'identité par site ou par plateforme d'utilisateurs finaux est nécessaire avec namespace de tenant, sessions séparées, cookies sur domaines appropriés et règles de récupération. Les permissions de records sont évaluées côté serveur. Ce domaine exige un ADR avant développement.

## 10. Annuaires, immobilier, emploi et petites annonces

Socle : collections, fiches, filtres et formulaires. Modules nécessaires : ingestion/import, modération, recherche full-text/géographique, signalement, expiration des annonces, comptes contributeurs, paiements éventuels et conformité. La géolocalisation exige index et fournisseur adaptés ; elle n'est pas simulée par un champ texte.

## 11. Marketplaces

Une marketplace multi-vendeurs nécessite onboarding/KYC, comptes vendeurs, catalogue et stock multi-tenant, commandes multi-parties, commissions, payouts, litiges, remboursements, fraude, modération, fiscalité et support. Elle doit être spécifiée comme produit/module distinct avec un PSP supportant effectivement les flux et pays visés. Aucun composant marketplace V1 ne prétend couvrir ces obligations.

## 12. Dashboards, outils métier et applications SaaS

Le socle peut produire des interfaces de collections, formulaires et tableaux de bord publics ou protégés après module d'identité. Les applications réelles exigent API, règles métier, transactions, rôles de record, audit, imports/exports, files et SLA. WOOBET peut devenir un hôte d'applications, mais chaque domaine applicatif conserve un service de règles testables en dehors du document visuel.

## 13. Matrice de readiness

| Module | Socle visuel V1 | Service transactionnel V1 | Condition future |
|---|---|---|---|
| Vitrine/blog/formulaire | Oui | Formulaire simple, oui | Durcissement et confidentialité |
| Catalogue/menu | Oui, collections limitées | Non applicable | Recherche et volume |
| Marketing avancé | Événements simples | Non | Consentement, intégrations, attribution |
| Réservation | Présentation/lien externe | Non | Concurrency/disponibilité/notifications |
| E-commerce | Vitrine produit | Non | Paiement, taxes, commandes, stocks |
| LMS | Pages cours publiques | Non | Comptes, accès, progression |
| Membres/portail | Maquettes publiques seulement | Non | Identité finale et record ACL |
| Marketplace | Aucune promesse | Non | Produit annexe et conformité |
| Scripts/extensions publiques | Déclaratif seulement | Non | Sandbox et écosystème |

## 14. Critères d'acceptation communs à tout module

Invariants métier écrits ; machine à états ; permissions ; données/migrations ; idempotence ; erreurs ; quotas ; coût ; i18n/fuseaux/devises ; accessibilité ; audit ; tests de concurrence et de reprise ; runbook ; désinstallation/export ; sécurité et obligations légales revues. Sans ces éléments, le module reste une démo et ne peut pas être présenté comme prêt pour production.
