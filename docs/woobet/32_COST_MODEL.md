# 32 — Modèle de coûts et de capacité

## 1. Pourquoi un modèle plutôt que des prix inventés

Aucun devis fournisseur, prix de domaine, tarif IA, coût CDN ou salaire d'équipe n'a été vérifié dans cette mission. Le modèle ci-dessous identifie les unités à mesurer et les scénarios à chiffrer. Il ne présente pas de prix commercial ni une capacité garantie.

## 2. Unités de coût mensuelles

| Code | Unité | Source de mesure |
|---|---|---|
| `C_compute_studio` | Instance/heure ou requête/CPU du Studio | Facture + métriques de déploiement |
| `C_compute_api` | CPU/mémoire de l'API | Facture + utilisation |
| `C_render` | Milliseconde CPU ou requête de rendu public | Traces renderer et facture |
| `C_worker` | CPU/mémoire par type de job | Métriques de files |
| `C_db` | Instance, stockage, IOPS, PITR et sauvegardes | Console/facture DB |
| `C_redis` | Mémoire/nœuds/HA | Facture Redis |
| `C_object` | Go-mois par classe + requêtes | Inventaire objet et facture |
| `C_egress` | Go sortant origine/CDN/inter-région | Logs/facture edge |
| `C_cdn` | Requêtes, règles, WAF et fonctions edge | Facture CDN |
| `C_media` | Décodage/transformation/transcoding | Worker ou service média |
| `C_ai` | Unités d'entrée/sortie et autres appels | `ai_usage_records` + facture |
| `C_domains` | Domaines custom/TLS/DNS | Provider et nombre d'états actifs |
| `C_email` | Messages et pièces jointes | Provider email |
| `C_observability` | Go de logs/traces, métriques et rétention | Backend observabilité |
| `C_payments` | Pourcentage/fixe par transaction et litiges | PSP |
| `C_support` | Temps support par cohorte/incident | Outil support |
| `C_engineering` | Coût d'équipe, revue, CI et maintenance | Budget produit |

Les coûts fixes minimaux (HA, sauvegardes, monitoring, environnements) doivent être visibles même avec peu d'utilisateurs ; un modèle purement à l'usage les sous-estime.

## 3. Formules

```text
C_month = C_fixed_platform
        + N_render_requests × unit_render
        + Go_egress × unit_egress
        + Go_month_storage × unit_storage
        + Σ jobs(type) × unit_worker(type)
        + Σ ai_calls(model) × unit_ai(model)
        + N_custom_domains × unit_domain_tls
        + N_emails × unit_email
        + C_db + C_redis + C_observability + C_support

C_generation_valid = total_ai_and_worker_cost / generations_valid
C_generation_accepted = total_ai_and_worker_cost / generations_accepted
C_site_active_month = attributable_variable_cost / active_sites
Gross_margin = net_revenue - variable_costs - payment_fees - variable_support
```

Les coûts partagés sont alloués par une règle documentée (CPU, requêtes, stockage), pas arbitrairement au nombre de sites. Le taux de cache est déterminant : une requête CDN n'entraîne pas nécessairement un rendu.

## 4. Scénarios de volumétrie à simuler

Ces volumes servent uniquement à demander des devis et préparer des tests. Ils ne décrivent pas une capacité atteinte.

| Hypothèse | Pilote | Croissance | Charge élevée |
|---|---:|---:|---:|
| Workspaces | 50 | 1 000 | 10 000 |
| Sites publiés | 100 | 5 000 | 100 000 |
| Pages vues/mois | 1 M | 100 M | 5 Md |
| Hit ratio CDN | À mesurer, scénarios 70/90/97 % | Idem | Idem |
| Générations IA/mois | 1 000 | 100 000 | 2 M |
| Appels IA par génération acceptée | Mesurer plan + pages + réparations | Mesurer | Mesurer |
| Stockage original+variantes+bundles | Inventaire réel | Croissance par cohorte | Lifecycle critique |
| Publications/jour et rafale | Baseline bêta | Mesure production | Test T2 dédié |
| Rétention versions | Politique minimale puis offres | Selon plans | Coût différencié |
| Support | Tickets/site actif et temps/ticket | Suivi cohorte | Équipe dédiée |

Pour chaque scénario, calculer au moins trois distributions : beaucoup de petits sites peu visités, quelques sites très populaires, et rafale de générations/publications. La moyenne seule masque les coûts de pointe.

## 5. Coût IA par opération

```text
C_gen = C_plan
      + Σ C_page_generation
      + Σ C_repairs
      + C_structural_validation_workers
      + C_optional_visual_review
      + C_failed_generation_allocated
```

Le coût des échecs et des générations rejetées doit être alloué au produit, pas caché. Les optimisations possibles sont : meilleurs plans, génération incrémentale, prompts/contextes réduits, modèle adapté à la tâche, moins de réparations, cache public sûr et création manuelle. Réduire la qualité de validation pour économiser n'est pas une optimisation acceptable.

## 6. Coût de publication et hébergement

Le SSR déplace le coût vers les rendus/misses cache ; le SSG le déplace vers les builds et le stockage. Comparer par cohorte :

```text
C_SSR_site = renders × unit_render + origin_egress + cache_operations
C_SSG_site = builds × unit_build + stored_pages × unit_storage + CDN
```

Choisir le SSG quand le coût total et la fraîcheur sont meilleurs, pas seulement parce que le CDN est moins cher. Les domaines custom ajoutent souvent un coût fixe par hôte qui peut dominer celui d'un petit site gratuit.

## 7. Coûts d'ingénierie et complexité

| Chantier | Complexité | Coûts souvent oubliés |
|---|---|---|
| Éditeur hybride | XL | Accessibilité, navigateurs, texte/IME, soak, support et dette de compatibilité |
| Renderer/schéma | L/XL | Migrations, corpus, anciennes versions et fidélité |
| IA | L/XL | Évaluation humaine, prompts, monitoring, confidentialité et échecs |
| Domaines/TLS | L | Support utilisateur, DNS hétérogènes, rate limits et abus |
| Multi-tenant/security | Transverse | Tests deux tenants, revues, pentest, incidents et audits |
| Facturation | L | Webhooks, rapprochement, fiscalité, remboursements et support |
| Modules métier | XL chacun | Règles métier, concurrence, conformité et maintenance longue |
| Observabilité/ops | L continu | Astreinte, runbooks, game days, rétention et coût d'ingestion |

Le scénario d'équipe doit inclure produit, design, QA, sécurité, ops et support, pas seulement le nombre de développeurs. Les fourchettes du document 22 excluent les modules transactionnels complets.

## 8. Données à collecter pendant les spikes et la bêta

- millisecondes CPU et mémoire par rendu D0–D3, hit/miss et locale ;
- durée/coût worker par publication et asset ;
- stockage moyen/p95 par site, par version et par variante ;
- tokens/appels/coût par étape IA et taux d'acceptation ;
- trafic/egress par site et distribution de popularité ;
- coût fixe minimal des environnements et de la HA ;
- logs/traces par requête et coût de rétention ;
- tickets par parcours, notamment domaines et facturation ;
- taux d'échec et reprises qui doublent les coûts externes.

## 9. Règles de décision économique

Aucun plan « illimité » sans hard cap et politique d'abus. Aucun dépassement facturé sans consentement et plafond. Les coûts d'observabilité et de sauvegarde ne sont pas supprimés pour améliorer artificiellement la marge. Un fournisseur est comparé sur coût total, migration, egress, support et risque, pas sur le tarif d'entrée.

Avant P15, produire trois devis datés et un tableur avec variables, sensibilité ±50 % sur IA/trafic/stockage, marge par cohorte et coût du plan gratuit. Avant P18, remplacer les hypothèses par les distributions de bêta et documenter les écarts.
