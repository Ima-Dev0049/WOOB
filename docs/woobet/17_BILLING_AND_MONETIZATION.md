# 17 — Facturation et monétisation

## 1. Objectif économique

WOOBET doit relier les offres à des droits et coûts mesurables, sans rendre le produit gratuit inutilisable ni exposer les clients à des dépassements imprévisibles. Aucun prix n'est fixé dans ce dossier : les coûts fournisseurs, taxes, moyens de paiement, support et willingness-to-pay doivent être étudiés.

## 2. Catalogue d'offres

| Offre | Cible fonctionnelle possible | Variables à décider |
|---|---|---|
| Gratuit | Découverte, site sur sous-domaine, marque WOOBET éventuelle | Sites/pages/stockage, crédits IA d'essai, rétention, support communautaire |
| Personnel | Site individuel et domaine custom | Domaines, médias, versions, IA mensuelle |
| Professionnel | Outils avancés, plus de contenu et intégrations | Collaborateurs, formulaires, analytics, quotas |
| Business | Sites dynamiques et modules additionnels | Collections, utilisateurs finaux, trafic, modules |
| Agence | Multi-clients, bibliothèques privées et collaboration | Workspaces, sièges, projets, marque blanche éventuelle |
| Entreprise | Sécurité, contrat et support | SSO, audit, résidence, SLA, DPA, quotas dédiés |

Ces lignes décrivent des segmentations, pas des engagements de disponibilité. Les fonctionnalités sont des feature keys indépendantes du nom du plan.

## 3. Entitlements et quotas

Un **entitlement** est une capacité booléenne ou numérique effective calculée par : plan versionné + add-ons + overrides approuvés + état de l'abonnement + limites techniques de sécurité. Les modules consultent ce service avant l'action, pas un champ `planName` dans le frontend.

Exemples de clés : `projects.max`, `pages.per_project`, `storage.bytes`, `assets.max_source_bytes`, `domains.custom.max`, `ai.credits.monthly`, `forms.submissions.monthly`, `bandwidth.bytes.monthly`, `versions.retention_days`, `editor.advanced`, `templates.private`, `integrations.custom`, `support.tier`.

Chaque quota a période, source de mesure, seuil d'alerte, politique à la limite (`warn`, `block_new`, `degrade`, `bill_with_consent`) et hard cap technique. « Illimité » n'existe pas sans limite d'abus et politique d'usage équitable.

## 4. Cycle d'abonnement

```text
trialing → active → past_due → grace → paused/read_only → canceled
                  ↘ canceled_at_period_end → expired
```

Les états exacts sont mappés depuis le provider sans copier aveuglément son vocabulaire. Les webhooks sont signés, persistés, dédupliqués et traités dans l'ordre pertinent à l'aide des dates/versions d'objet. Un événement retardé ne doit pas réactiver un abonnement annulé.

Le provider reste la source des prélèvements ; PostgreSQL est la source des entitlements applicatifs après rapprochement. Un job périodique compare abonnements/factures locaux et distants pour détecter webhooks perdus.

## 5. Essais, changements et annulations

- essai avec durée et éligibilité explicites ; aucune carte exigée sauf parcours clairement annoncé ;
- upgrade : nouvelles limites après confirmation de l'événement, prorata affiché par le provider ;
- downgrade : effet immédiat ou fin de période selon contrat ; ne jamais supprimer automatiquement les ressources excédentaires ; mode lecture seule ou choix de ressources ;
- annulation : accès jusqu'à fin payée, export et information sur les sites/domaines ;
- impayé : grâce, notifications, limitation progressive ; les sites publics ne sont pas supprimés sans préavis ;
- remboursement : statut enregistré et entitlements recalculés selon politique ; pas de suppression de facture ;
- expiration : politique de dépublication éventuelle configurable, testée et communiquée ; domaines custom ne doivent pas rediriger vers un concurrent ou une page dangereuse.

## 6. Crédits IA et coûts variables

Un crédit IA est une unité produit, pas nécessairement un token. La grille versionnée associe opération/modèle/coût estimé. Le service réserve avant exécution, régularise après usage, rembourse les réservations sur échec selon politique et plafonne les retries. Le client voit l'opération et la consommation, sans détails techniques inutiles.

Le coût par génération **acceptée** inclut appels de planification, réparations et contrôles. Les autres coûts variables : trafic, stockage, transformations, emails, domaines/TLS et modules tiers. Les frais de dépassement exigent activation, prix visible, plafond et alertes ; sinon le quota bloque seulement les nouvelles consommations.

## 7. Factures et paiements

Stripe Billing est le premier candidat derrière `PaymentProvider`, car il couvre les abonnements dans de nombreux marchés ; ses capacités pays/taxes/paiements doivent être vérifiées pour les marchés WOOBET. Alternatives : Paddle/Merchant of Record, Adyen ou prestataire régional ; comparaison juridique et fiscale nécessaire. Aucune capacité de ces plateformes n'est présumée sans documentation.

Ne jamais stocker les numéros de carte ; utiliser les surfaces hébergées du PSP. Enregistrer références, statut, devise, montants, taxe, dates et document de facture. Les webhooks de paiement n'ont pas accès aux documents de pages.

## 8. Marge et modèle unitaire

Pour une période et une cohorte :

```text
Marge brute = revenus nets récurrents + dépassements encaissés
              - IA - rendu/calcul - CDN/egress - stockage - médias
              - email/DNS/TLS - paiement - observabilité variable - support variable

Coût par site actif = coûts variables attribuables / sites actifs
Coût par utilisateur IA = coût total des appels / utilisateurs actifs IA
```

Les coûts fixes d'ingénierie et de support sont analysés séparément de la marge brute mais inclus dans le pilotage. Les free tiers ne sont pas une stratégie pérenne. Trois scénarios de trafic et de taux d'utilisation IA sont simulés dans le document 32.

## 9. Anti-abus et équité

Le plan gratuit a limites de création de comptes/projets, vérification email, rate limits et gestion des contenus abusifs. Les quotas évitent aussi les runaway costs. Une réduction ne doit pas encourager le support de phishing ou de spam. Les procédures de suspension conservent les preuves nécessaires et offrent un canal de recours.

## 10. Événements et audit

`trial_started`, `subscription_activated`, `plan_changed`, `payment_failed`, `grace_started`, `quota_warning`, `quota_blocked`, `credits_reserved`, `credits_adjusted`, `subscription_canceled`, `invoice_paid`, `refund_recorded`. Les événements de facturation contiennent montants/devise nécessaires mais pas de données de carte ni contenus de site.

## 11. Tests

Webhook dupliqué/désordonné/signé avec corps altéré ; événement perdu puis rapprochement ; upgrade pendant génération IA ; réservation et crash ; downgrade au-dessus du quota ; dernier site actif après expiration ; remboursement ; changement de devise non autorisé en cours ; deux onglets de checkout ; retry de paiement ; utilisateur sans permission `billing.manage` ; export de facture d'un autre workspace ; prix/provider indisponible.

## 12. Décisions commerciales ouvertes

Prix et devises, pays, Merchant of Record ou non, taxes, politique gratuit/essai, limites par offre, dépassements, grâce et dépublication, marque WOOBET, rétention des versions, support, commissions futures du marché de templates. Ces décisions exigent étude client, devis fournisseurs et revue juridique ; elles ne bloquent pas le développement du moteur d'entitlements configurable.
