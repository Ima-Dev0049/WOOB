# 14 — Médias, ressources et stockage

## 1. Cycle de vie

`requested → uploading → uploaded → scanning → processing → ready → published/referenced → deleted → purged`. Un asset n'est sélectionnable pour publication qu'en état `ready` ou copié dans un bundle validé. Les erreurs laissent l'original en quarantaine et n'exposent pas d'URL publique.

## 2. Bibliothèque média

Fonctions : upload simple/multiple avec reprise si le stockage le permet ; dossiers et tags ; recherche par nom/type/date ; filtres d'usage ; grille/liste ; métadonnées ; alt text localisé ; point focal ; licence/source ; remplacement avec analyse des références ; duplication et suppression contrôlée.

Les vues « utilisé dans » proviennent des références de brouillon et des manifests de publication. La déduplication par checksum se fait uniquement dans le même workspace et selon politique de confidentialité ; un hash ne doit pas permettre de découvrir l'existence d'un fichier chez un autre client.

## 3. Upload sécurisé

1. L'API vérifie permission, quota réservé, nom, taille déclarée et type demandé.
2. Elle crée l'asset `uploading` et une URL signée courte à objet précis, avec taille/type imposés si le provider le permet.
3. Le client envoie directement à l'objet ; aucune donnée ne transite inutilement par l'API.
4. Le worker vérifie taille réelle, checksum, magic bytes et décodage ; scan antivirus selon type et risque.
5. Les images sont décodées dans un environnement limité en CPU/mémoire ; EXIF/GPS et métadonnées inutiles sont expurgés sur les dérivés.
6. Les variantes sont créées ; l'original passe `ready` ; le quota est régularisé.

Les URLs signées d'upload/download privé expirent et ne sont jamais écrites dans un document. Les limites initiales sont des garde-fous à tester : images 20 MiB et nombre de pixels borné, vidéos 200 MiB si activées, nombre de fichiers par requête borné. Les quotas commerciaux restent configurables.

## 4. Formats et transformations

| Type | Entrée initiale | Sortie et règles |
|---|---|---|
| Image photo | JPEG, PNG, WebP ; AVIF si décodeur validé | WebP/AVIF selon support et coût + fallback ; largeurs responsives |
| Image avec transparence | PNG, WebP | WebP/AVIF ou PNG selon résultat ; ne pas dégrader l'alpha |
| Icône/illustration | SVG assaini, PNG | SVG inerte en `img` ou raster ; scripts/foreignObject/ressources distantes traités |
| Animation | GIF éventuellement | Conversion vidéo/WebP animé après validation ; respecter mouvement |
| Vidéo | MP4/WebM avec codecs explicitement testés | Streaming/transcoding seulement si module ; poster et sous-titres |
| Document | PDF si nécessaire | Download depuis origine contrôlée, `Content-Disposition`, scan ; pas d'aperçu actif implicite |
| Police | WOFF2 et licence | Hébergement contrôlé, `font-display`, subsets ; formats exotiques refusés |

Le choix AVIF/WebP est mesuré par image : gain de poids contre CPU et latence. Les transformations sont exprimées par une spécification canonique (`width`, `height`, `fit`, `focal`, `format`, `quality`) hashée ; pas d'URL de transformation avec paramètres illimités exposant un oracle de coût.

## 5. URLs et accès

- original privé : objet non public, téléchargement autorisé après RBAC et URL signée courte ;
- dérivé privé : identique ;
- asset public publié : copie ou promotion dans un préfixe public immutable, servi par CDN avec URL stable hashée ;
- asset supprimé du brouillon mais utilisé par publication : conservé jusqu'à expiration de la publication et grâce ;
- asset dynamique non publié : jamais accessible par simple guess de clé.

Les réponses définissent `Content-Type` réel, `X-Content-Type-Options: nosniff`, cache adapté et `Content-Disposition` pour téléchargements. Les CORS du bucket n'autorisent que les origines et méthodes nécessaires.

## 6. Livraison responsive et performance

Le renderer connaît dimensions, ratio et variantes pour éviter CLS. Il produit `srcset`/`sizes` ou `<picture>` selon le composant, lazy-load sous la ligne de flottaison, priorité élevée mesurée pour l'image LCP et placeholders légers. Les images décoratives ont alt vide ; les images informatives exigent une alternative, sans imposer un alt généré comme vérité.

Les vidéos ne sont pas préchargées par défaut ; sous-titres et contrôles clavier sont requis. Les médias externes ne sont pas supposés permanents : l'utilisateur doit importer ou déclarer une intégration gérée, avec politique de panne.

## 7. Références et suppression

Une référence peut venir d'un brouillon, checkpoint, template, publication ou collection. La suppression demande un rapport de références : bloquer si active, proposer remplacement ou confirmer la suppression des références modifiables. Les publications immuables ne sont pas réécrites ; leurs assets restent disponibles pendant leur rétention.

Une tâche d'orphelins compare inventory objet et DB/manifests dans les deux sens : objet sans ligne, ligne sans objet, variante non référencée, upload abandonné. Elle marque puis purge après délai, jamais sur un seul listing eventualisé sans règle de cohérence. Les suppressions massives sont paginées et auditées.

## 8. Stockage et quotas

Le stockage facturable distingue originaux, variantes, bundles et corbeille. Les réservations d'upload empêchent un dépassement concurrent ; les échecs libèrent la réservation. Les métriques sont rapprochées de l'inventaire objet. Les dépassements ne cassent pas les assets déjà publiés sans politique de grâce explicite.

Les bundles et assets immuables utilisent lifecycle par rétention. La sauvegarde/versioning est configurée selon RPO. Les clés de chiffrement et accès IAM suivent le moindre privilège.

## 9. Droits et assets IA

Chaque asset conserve source (`upload`, `stock`, `generated`, `external_import`), auteur/fournisseur si connu, licence ou mention « droits non confirmés », date et preuve associée. La bibliothèque signale les droits manquants avant publication selon politique ; WOOBET ne peut pas garantir juridiquement tout contenu utilisateur.

Les visuels IA enregistrent la génération et les informations disponibles. Les suggestions de banque d'images sont importées avec licence et attribution si requise. Aucun lien temporaire de fournisseur IA n'est utilisé comme ressource publique pérenne.

## 10. Tests

Fichier renommé, MIME mensonger, SVG scripté, image géante/bombe, EXIF GPS, fichier tronqué, double upload, quota concurrent, retry worker, variant absent, original supprimé pendant traitement, publication avec asset en quarantaine, cache après remplacement, orphelins, droits manquants, alt long/multilingue, srcset sur navigateurs réels. Vérifier qu'un asset privé d'un workspace B reste inaccessible avec l'URL ou l'ID obtenu par le workspace A.
