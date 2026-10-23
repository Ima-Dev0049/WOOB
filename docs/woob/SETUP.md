# Installation locale

## Prérequis

- Node.js 22 ou supérieur et npm.
- Aucun compte externe pour le mode autonome.
- PostgreSQL uniquement si vous ne souhaitez pas utiliser PGlite.

## Démarrage autonome

```bash
npm ci
cp .env.example .env.local
npm run db:migrate
npm run dev
```

L’application écoute par défaut sur `http://localhost:3000`. Dans Arena, elle est liée à `0.0.0.0:3000` pour la prévisualisation.

Le fichier `.env.local` n’est pas suivi par Git. Ne mettez aucune clé secrète dans une variable `NEXT_PUBLIC_*`.

## Pilotes locaux par défaut

| Fonction | Valeur locale | Réalité |
| --- | --- | --- |
| Base | PGlite dans `.woob-data` | Base SQL et migrations réelles, mono-processus |
| Médias | `STORAGE_DRIVER=file`, `STORAGE_LOCAL_DIR=.woob-storage` | Fichiers réels sur le disque local |
| Email | `EMAIL_DRIVER=file` | Messages `.txt` dans `.woob-outbox`, aucun envoi réseau |
| IA | `AI_PROVIDER=demo` | Propositions de gabarits locaux, étiquette « DÉMO LOCALE » |
| Facturation | Clés Stripe vides | Plan gratuit utilisable, paiement indisponible |
| DNS | `DNS_VERIFICATION_ENABLED=false` | Aucun TXT distant vérifié |

Sans copie du fichier d’environnement, le stockage fichier utilise `.woob-uploads`. Tous ces répertoires sont ignorés par Git et ne doivent pas contenir de données de production non sauvegardées.

Les liens de récupération sont lisibles dans `.woob-outbox`. Cela permet de tester le parcours local mais ne prouve pas la délivrabilité SMTP.

## PostgreSQL

Renseigner `DATABASE_URL`, puis appliquer les migrations avant le démarrage :

```bash
npm run db:migrate
npm run dev
```

- `PGSSL=require` active TLS et vérifie le certificat par défaut.
- `PGSSL=disable` désactive TLS uniquement pour un réseau maîtrisé.
- `PGSSL_REJECT_UNAUTHORIZED=false` est un contournement à éviter ; il ne doit pas être la valeur par défaut d’une production.

La connexion PostgreSQL externe et ses paramètres TLS n’ont pas été testés depuis cet environnement.

**PGlite :** arrêter le serveur avant d’exécuter une nouvelle migration depuis un second processus, puis le redémarrer. Cela évite qu’un processus long-lived conserve l’ancien schéma. Ne pas utiliser PGlite comme base partagée multi-instance.

## Administration plateforme

Aucun administrateur plateforme n’est créé à l’inscription et le rôle `admin` d’un workspace ne suffit pas. Après avoir créé le compte par le parcours normal, attribuer explicitement le rôle persistant :

```bash
# Avec PGlite, arrêter d’abord le serveur Next.
npm run admin:grant -- email@example.com
# Puis redémarrer le serveur.
```

La commande charge `.env`/`.env.local`, exige un compte déjà inscrit et utilise la même base que l’application. Alternative de configuration, sans écriture en base :

```dotenv
PLATFORM_ADMIN_EMAILS=admin@example.com,second-admin@example.com
```

La page `/admin` et ses API restent interdites aux autres comptes. Ne jamais renseigner une allowlist de démonstration en production.

## OpenAI — optionnel

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

La clé reste côté serveur. La consigne et le document sont alors transmis au fournisseur. Sans cette configuration, conserver `AI_PROVIDER=demo`. Aucun appel OpenAI réel n’a été validé dans le présent bilan.

## S3 et SMTP — optionnels

Compléter les variables `S3_*` et choisir `STORAGE_DRIVER=s3`, ou les variables `SMTP_*` et choisir `EMAIL_DRIVER=smtp`. Les identifiants S3, l’endpoint et `S3_FORCE_PATH_STYLE` dépendent du fournisseur réel. Tester le bucket, les permissions, le chiffrement et la délivrabilité avant de déclarer ces intégrations disponibles.

## Stripe — optionnel

Le checkout nécessite :

- `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` ;
- `APP_URL` absolu en HTTP(S) ;
- un `stripePriceId` sur le plan (variables `STRIPE_PRO_PRICE_ID` / `STRIPE_BUSINESS_PRICE_ID` reprises par le seed) ;
- un montant mensuel réel `monthlyPriceCents` configuré en base.

Le dépôt ne fournit aucun montant payant fictif. Le webhook à configurer est `/api/billing/stripe/webhook`. Ne jamais activer un plan depuis le paramètre de retour du navigateur.

## Proxy et rate limit

Par défaut, `TRUST_PROXY=false` et un en-tête `X-Forwarded-For` envoyé par un client ne change pas le bucket de rate limit. Ne passer à `true` que derrière un proxy qui supprime et réécrit cet en-tête.

## Vérifications

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
# ou, hors E2E :
npm run verify
```

Les tests Vitest utilisent PGlite en mémoire. Les E2E écrivent de vrais comptes/projets dans la base du serveur local : **ne jamais les pointer vers une production**. Playwright réutilise le serveur du port 3000 ou en démarre un avec `TRUST_PROXY=true` pour isoler les buckets de test. Ses scénarios admin utilisent l’allowlist de test `platform-admin-e2e@example.com` ; un serveur réutilisé doit avoir la même valeur de test, jamais une valeur reprise en production.

Dernier résultat local daté du 2026-10-23 : `npm run verify` réussi avec 34/34 tests, puis 19/19 E2E ; migrations `0001` à `0005` et attribution admin par CLI également exécutées. Les détails et avertissements sont consignés dans `TESTING.md` et `IMPLEMENTATION_STATUS.md`.

Pour utiliser un Chromium système :

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/chemin/vers/chrome npm run test:e2e
```

Sinon, le setup fourni prépare le Chromium `@sparticuz/chromium` utilisé dans cet environnement.
