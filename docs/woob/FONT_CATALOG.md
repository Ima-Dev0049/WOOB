# Catalogue typographique local — 500 styles

Mise à jour : 2026-10-23. Lot : `font-catalog-500`.

## Périmètre réel

- **500 styles sélectionnables = 50 familles variables × 10 graisses par famille.** Un style est un couple famille/graisse, pas une famille distincte.
- Les dix positions sont calculées à l’intérieur de l’axe `wght` réel de chaque fonte. Les poids courants sont privilégiés, puis des positions intermédiaires sont ajoutées si nécessaire. Aucune plage 100–900 n’est inventée pour une famille plus limitée.
- Les assets comprennent le style **normal**, sous-ensemble **latin**. Les italiques, autres axes variables, scripts cyrilliques/grecs et extensions latines ne sont pas inclus. Un glyphe absent retombe sur la pile de fallback ; aucune couverture linguistique universelle n’est revendiquée.
- La saisie d’une pile CSS personnalisée reste disponible. L’upload de fontes arbitraires n’est pas implémenté.

## Intégration

- `src/lib/fonts/catalog.ts` est la source de données : identité, catégorie, plage variable, paquet/version de provenance et calcul des 500 options. Le sélecteur et les compteurs sont alimentés par ce catalogue, sans liste parallèle dans les composants.
- `src/components/editor/FontFamilyField.tsx` fournit recherche, catégories, aperçu à la demande et choix de graisse pour le texte et les titres.
- `bodyFontWeight` et `headingFontWeight` sont optionnels dans le design system `1.0.0`. Les anciens documents restent valides et ne déclenchent aucun nouveau téléchargement.
- Les changements utilisent la sauvegarde, les révisions, les snapshots de publication et le renderer existants. Aucune migration SQL n’est nécessaire.
- Les `@font-face` sont produits uniquement à partir du catalogue. Le document ne peut fournir ni chemin de fichier ni URL de fonte. Une famille utilisée pour le texte et les titres est dédupliquée.
- Une page publiée charge au maximum les familles choisies pour le texte et les titres, pas les 50 assets. L’inspecteur peut charger la famille sélectionnée et celle explicitement survolée ou focalisée pour son aperçu.
- Les 50 WOFF2 représentent **1 835 224 octets** au total ; ce volume n’est pas envoyé à chaque visiteur. Il n’y a aucune dépendance npm ou CDN de polices au runtime.

## Ajouter ou remplacer une famille

1. Vérifier la licence, la présence d’un vrai axe variable `wght` et le sous-ensemble nécessaire. Conserver la licence et l’attribution.
2. Ajouter `public/fonts/<id>.woff2` et `public/fonts/licenses/<id>.txt`. Ne jamais enregistrer une URL distante dans un document.
3. Ajouter ou modifier une entrée de `FONT_FAMILIES` avec son identifiant stable, son nom, sa catégorie, ses bornes réelles et son paquet/version d’origine.
4. Les contrôles et le nombre de styles se mettent à jour depuis les données. Adapter les assertions de quantité dans `tests/fonts.test.ts` uniquement lorsque le changement de taille du catalogue est intentionnel.
5. Exécuter les tests unitaires, le build et le parcours `tests/e2e/fonts.spec.ts`. Vérifier le chargement réel dans Chromium et l’absence de téléchargement du catalogue entier.

## Preuves du lot

- `npm test` : **86/86 tests dans 15 fichiers**. Les tests du catalogue vérifient les 500 identifiants uniques, les dix graisses bornées, les signatures WOFF2, les licences, la compatibilité historique et l’absence d’URL arbitraire.
- `npm run test:e2e` : **40/40 scénarios Playwright** en Chromium sur build de production. Le parcours typographique choisit Fraunces 600 et Playfair Display 800, vérifie le canvas, la sauvegarde, le rechargement, la publication et deux réponses WOFF2 200. Les deux `FontFace` publiques sont à l’état `loaded` et aucun autre fichier du catalogue n’est demandé par le contexte anonyme.
- Les contrôles axe du catalogue ouvert et des panneaux avancés/expert passent sans exclusion de règle. Cela ne remplace pas un test avec lecteur d’écran.

## Provenance et intégrité des assets

Les paquets Fontsource variables indiqués ci-dessous ont été téléchargés depuis le registre npm ; l’intégrité SHA-512 des archives a été comparée à `dist.integrity` avant extraction. Leurs métadonnées indiquent toutes `https://github.com/google/fonts` comme source et `OFL-1.1` comme licence. Le texte complet de chaque licence est conservé dans `public/fonts/licenses/`. Les empreintes ci-dessous sont les SHA-256 des WOFF2 effectivement intégrés.

| Famille | Paquet | Version | Axe `wght` | SHA-256 du WOFF2 latin |
| --- | --- | --- | --- | --- |
| Inter | `@fontsource-variable/inter` | 5.3.0 | 100–900 | `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62` |
| Roboto | `@fontsource-variable/roboto` | 5.3.0 | 100–900 | `1404ca348bd75ef836f4dd8b6f2cc719458642d1237c368296b2fc652dca47dc` |
| Open Sans | `@fontsource-variable/open-sans` | 5.3.0 | 300–800 | `d8e4fe0452aa2076429a9bb5d8757d00a994dd95986cf950e9a1a371b9a072a0` |
| Montserrat | `@fontsource-variable/montserrat` | 5.3.0 | 100–900 | `06b16db7a969135d48d38c49183be7fb88d4452e2a3011957c7851941f4e4879` |
| Nunito | `@fontsource-variable/nunito` | 5.3.0 | 200–1000 | `ba344451eab25b217a165363b1982048a5e5830a0daf36577973955a04cac793` |
| Nunito Sans | `@fontsource-variable/nunito-sans` | 5.3.0 | 200–1000 | `29e3890496844a9ea81975c52771c587c872b4eb317026422d1995b88d21b57d` |
| Work Sans | `@fontsource-variable/work-sans` | 5.3.0 | 100–900 | `1dd49afc07fb2231b2ff686cbf007725fb2742271bb1f28ebd98f22a0d817343` |
| Source Sans 3 | `@fontsource-variable/source-sans-3` | 5.3.1 | 200–900 | `19143dca075972bc84e3fd9eab7416dd40cc565dccb2435a044bdfabe060c7d5` |
| DM Sans | `@fontsource-variable/dm-sans` | 5.3.0 | 100–1000 | `9fea608a947e67020c33cad9a6fe3d60c54119dfb8cff87768a8117a15ed7543` |
| Manrope | `@fontsource-variable/manrope` | 5.3.0 | 200–800 | `a30ddcd349703aff7464c34bef3fffdff405ee50c113440d7c8693c02d210972` |
| Urbanist | `@fontsource-variable/urbanist` | 5.3.0 | 100–900 | `7981ef90c246352c7c217081b8d9337b9c95e9d17ae126bf56b0d3753d1e5ffb` |
| Figtree | `@fontsource-variable/figtree` | 5.3.0 | 300–900 | `4ba7d3d096695818fe0686be4f1e82c6b05134e18a22260336130335027462dd` |
| Public Sans | `@fontsource-variable/public-sans` | 5.3.0 | 100–900 | `5ed4d31c988e73b258894244f209069ebe77dc7e564861954b21198b6de90d68` |
| IBM Plex Sans | `@fontsource-variable/ibm-plex-sans` | 5.3.0 | 100–700 | `e2291e842cf5af167122a22881a740c7f2dda7716f1e8cd76680264f4a859470` |
| Noto Sans | `@fontsource-variable/noto-sans` | 5.3.0 | 100–900 | `51ca196f49a33e79e7870ff88ebd2829a3f627a51e7d690986618f0e7ad2b52d` |
| Roboto Condensed | `@fontsource-variable/roboto-condensed` | 5.3.0 | 100–900 | `8d230115e58faa2ed303bee567b91d1a792e0c958a0118998b53648b2ab7c057` |
| Roboto Flex | `@fontsource-variable/roboto-flex` | 5.3.0 | 100–1000 | `8aabd65a22003f488ba7d2da8a8155a7f90e195ab2a11cd006615d00a0ee5eff` |
| Outfit | `@fontsource-variable/outfit` | 5.3.0 | 100–900 | `6c18d579fd87c3776be068b762cbc83fde3acb543d49eabd3ade842eb987e887` |
| Lexend | `@fontsource-variable/lexend` | 5.3.0 | 100–900 | `b7e7538f59bff1812841d7627f8e49e70fe86438f9f7b397a028c0d05301c874` |
| Space Grotesk | `@fontsource-variable/space-grotesk` | 5.3.0 | 300–700 | `0640890476fc1198ab4de571fb658de443c4d85b66466ec09534a8737ab1ce9d` |
| Sora | `@fontsource-variable/sora` | 5.3.0 | 100–800 | `fa26406eeda9a3c6ec3d9ea8813c3045d6dc755e30c716d5c094e8ef43be5a7f` |
| Josefin Sans | `@fontsource-variable/josefin-sans` | 5.3.0 | 100–700 | `21efe1559a026f9ad7f880772917faa3a621186688e8e79e0568e4308c0bafa9` |
| Exo 2 | `@fontsource-variable/exo-2` | 5.3.0 | 100–900 | `4a259dde317e08aa5d37e6eb684e222ae833516b2a0fccba36ee5e36224f16be` |
| Oswald | `@fontsource-variable/oswald` | 5.3.0 | 200–700 | `bd73278ee0c50041b91b4c03d1229e35b501637f46b6409e7da2d3a758446ea5` |
| Rubik | `@fontsource-variable/rubik` | 5.3.0 | 300–900 | `691cd1d9b4c0cdf31a1dcf04259c86f92c85e69f6622abab7964d81e36890691` |
| Instrument Sans | `@fontsource-variable/instrument-sans` | 5.3.0 | 400–700 | `2ee17598a98d8a59e4df8152d015bec9ab8e4d5672cc0ab42bef806b568e3971` |
| Geist | `@fontsource-variable/geist` | 5.3.0 | 100–900 | `19f9c92546aa300c312235e3125af1b81394d8db9a4bc4a425cd5b641d2d54e1` |
| Red Hat Text | `@fontsource-variable/red-hat-text` | 5.3.0 | 300–700 | `59826f39dcb265c6aa94d978cc0941a083df5acc7f447324ecf6f58ad19d6b7c` |
| Merriweather | `@fontsource-variable/merriweather` | 5.3.0 | 300–900 | `4fbe8dd9c23b1fd62a988bb8a69b8e692d810f773d9ef6ebca2ba2760c7b11ee` |
| Playfair Display | `@fontsource-variable/playfair-display` | 5.3.0 | 400–900 | `e0c764a8e9e1cce92163c55bac4b2ad6cd4cf8c696ce2289ab5c41565e65b7e2` |
| Fraunces | `@fontsource-variable/fraunces` | 5.3.0 | 100–900 | `7f9d191d999336d3b9790afa72e1358e50a13b06d4f289341e92a311967a80f9` |
| Libre Baskerville | `@fontsource-variable/libre-baskerville` | 5.3.0 | 400–700 | `22219fb90e3b9bd28debd1825fe8d9a0154a0e31f8b3fa601ac1a0a5aa5e6d1b` |
| Lora | `@fontsource-variable/lora` | 5.3.0 | 400–700 | `ddb8c66035104e233fc024669183aad3738b6daa16deee2ebb1241bd0f98ace1` |
| Crimson Pro | `@fontsource-variable/crimson-pro` | 5.3.0 | 200–900 | `20ce4189b9e41b3439a2a36dd63deff44b6d91182532202cb96b65521b4a3c23` |
| Source Serif 4 | `@fontsource-variable/source-serif-4` | 5.3.1 | 200–900 | `382475f38242c52d42a3e5ff8dc69b5d73f10d0d21e4550b5fe232984688779a` |
| Bitter | `@fontsource-variable/bitter` | 5.3.0 | 100–900 | `0efe0fbe6068354f3fad5a88bf31384051206652468eaa22232119354e7ea423` |
| Cormorant Garamond | `@fontsource-variable/cormorant-garamond` | 5.3.0 | 300–700 | `d80df8ff5aecd299a61549f9e29ab1ed0b9b05f4ea71d50fe978e07d5240b235` |
| EB Garamond | `@fontsource-variable/eb-garamond` | 5.3.0 | 400–800 | `88603384163d301aebd5bd769832a8bfe3c9004ec24178417b9817f0ad32c63b` |
| Noto Serif | `@fontsource-variable/noto-serif` | 5.3.0 | 100–900 | `46281456234014ceb2a79bff447245de0f76b8d803be0738972ed374c3206c5b` |
| Noto Serif Display | `@fontsource-variable/noto-serif-display` | 5.3.0 | 100–900 | `5343443b8fd91607b1b610a5a5a68ed74b682c28825d2c19a9f0ee6f04b36a60` |
| Rokkitt | `@fontsource-variable/rokkitt` | 5.3.0 | 100–900 | `df3335298079d5883568705eb045bc1572731243ba626696711e122cc7c7b8ab` |
| Cormorant | `@fontsource-variable/cormorant` | 5.3.0 | 300–700 | `766e1b19fa74895763cef708f4b360b887e5a836725869ca672a0753bf19bd53` |
| Noto Sans Display | `@fontsource-variable/noto-sans-display` | 5.3.0 | 100–900 | `08d9318fa95d11e7da7c9d7819c9e9826f9c304220c01c6f7d963057f292978b` |
| Red Hat Display | `@fontsource-variable/red-hat-display` | 5.3.0 | 300–900 | `f7a7830b81e351f89b91f0201de71c8d937e25df5a3e31ecca9b4ee877abedb7` |
| Cinzel | `@fontsource-variable/cinzel` | 5.3.0 | 400–900 | `09941fb1c169c38fd414536b37690057fc01b3117a5c63dd6571186540c8f370` |
| Fira Code | `@fontsource-variable/fira-code` | 5.3.0 | 300–700 | `771bf4b79a97fc005d12866168bd39d868a9dd3d5903008fe8b796723c8a56f4` |
| JetBrains Mono | `@fontsource-variable/jetbrains-mono` | 5.3.0 | 100–800 | `18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e` |
| Source Code Pro | `@fontsource-variable/source-code-pro` | 5.3.1 | 200–900 | `8b774aaa5137a38ef40f4ac9d36db9a5eee152b2f66589dfdc82ff007fc87135` |
| Geist Mono | `@fontsource-variable/geist-mono` | 5.3.0 | 100–900 | `684ad5b531f81d43c1e8c7038262d5db7cdc1f68006e04d6c7769efa8d33c8cc` |
| Inconsolata | `@fontsource-variable/inconsolata` | 5.3.0 | 200–900 | `4914e68b98699a8f3d5d552fe60fd7a1c2cb631a0f66f0a148392f161d3155ab` |
Aucun appel Google Fonts ou autre CDN n’est effectué par le renderer. Les versions et empreintes figent la provenance du lot ; une mise à jour doit être revue comme un changement d’assets.
