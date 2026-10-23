# Déploiement

Aucun déploiement public n’a été effectué depuis cet environnement.

Pour une cible Node.js persistante : configurer PostgreSQL, `DATABASE_URL`, `APP_URL`, `APP_ENV=production`, un stockage objet ou un volume durable et un pilote SMTP. Exécuter les migrations, les vérifications et `npm run build`, puis `npm start` derrière un proxy TLS.

Avant l’ouverture, appliquer notamment la migration `0004_platform_admin`, créer un compte par le parcours normal puis attribuer explicitement son rôle avec `npm run admin:grant -- email@example.com` depuis un job d’administration autorisé sur la même base. `PLATFORM_ADMIN_EMAILS` est une alternative de configuration. Ne jamais reprendre le compte ou l’allowlist des tests Playwright, et ne pas confondre ce rôle plateforme avec le rôle `admin` d’un workspace.

PGlite et les répertoires locaux ne constituent pas une stratégie de production multi-instance. Les cookies deviennent `Secure` en production. Le proxy doit transmettre l’hôte et l’origine sans désactiver les contrôles CSRF. Le journal `admin_audit_logs` doit être inclus dans les sauvegardes et sa rétention définie selon la politique d’exploitation.

Les domaines personnalisés exigent une plateforme capable de router les hôtes et d’émettre les certificats. La seule création d’une ligne en base ne configure ni DNS ni TLS. Stripe exige des clés serveur, des webhooks signés et un traitement idempotent avant toute activation.

Sauvegardes, supervision, limitation de débit distribuée et tests de restauration restent à configurer selon la cible réelle.

Le build local du 2026-10-23 réussit, avec deux avertissements de traçage pour le stockage fichier dynamique. Cela ne valide ni l’empaquetage d’une plateforme donnée ni la persistance d’un volume. La prochaine étape externe est un staging autorisé avec PostgreSQL, stockage partagé et SMTP ; Stripe/OpenAI et le couple DNS/TLS doivent ensuite être validés séparément dans leurs environnements de test, sans dépense ni publication implicite.
