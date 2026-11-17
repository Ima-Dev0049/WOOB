# ADR-001 — Identité des utilisateurs finaux par site

- **Statut :** accepté pour un premier incrément, révisable.
- **Décision ouverte liée :** OD-20 « Identité des utilisateurs finaux » (`docs/woobet/29_OPEN_DECISIONS.md`).
- **Date :** 2026-10-23. **Branche :** `arena/639e32e6-woob`.

## Contexte

Les dashboards Woob ne servent que les membres d'un workspace. Les personnes qui fréquentent un site — étudiants, clients, patients, secrétaires d'un établissement — n'ont aucune identité propre. Le cahier des charges interdit de réutiliser les sessions Studio et exige un ADR avant d'ouvrir des espaces membres.

Trois options étaient ouvertes : service d'identité par site, pool multi-tenant partagé, fédération externe. La validation staging (PostgreSQL/S3/SMTP/Stripe/OpenAI réels) reste hors de portée de cet environnement : aucune de ces briques n'est revendiquée comme vérifiée.

## Décision

**Un service d'identité par site**, isolé par projet :

1. Une table `site_users` dont l'unicité est `(project_id, normalized_email)` et dont la clé étrangère composite garantit l'appartenance au workspace du projet. Le même email peut exister sur deux sites sans créer de compte commun.
2. Une table `site_sessions` liée au compte, au projet et au workspace ; le cookie `woob_site_session` est `httpOnly` et **distinct** du cookie Studio `woob_session`. Le cookie CSRF `woob_site_csrf` est distinct de `woob_csrf`.
3. Un portail public `/portail/{slug}` où une personne crée son compte, dépose une demande et suit ses propres demandes.
4. Un formulaire public **déduit du modèle** : un objet existant qui possède un statut, ses champs requis puis optionnels (12 maximum), les relations exposées comme listes de libellés. Aucun formulaire parallèle n'est stocké.
5. Le statut initial vient du modèle et le serveur le réapplique ; le Studio modère ensuite avec les transitions existantes.

## Alternatives écartées

- **Pool multi-tenant partagé** : un compte unique pour plusieurs sites simplifie le parcours, mais multiplie les surfaces d'accès horizontal et les migrations de consentement. Reporté.
- **Fédération OIDC** : dépend d'un fournisseur externe non vérifiable ici, et impose des décisions de conservation et de mapping non tranchées.
- **Demandes anonymes seulement** : plus simple, mais ne permet ni suivi personnel, ni limitation par compte, ni séparation des dossiers.

## Conséquences et garde-fous

- Les requêtes d'écriture du portail vérifient l'origine, un jeton d'en-tête dont le hachage correspond à celui stocké avec la session, et un rate limit par IP et par slug.
- Une session est résolue par jeton **et** par slug : un jeton d'un site ne vaut rien sur un autre, et un jeton Studio ne vaut rien sur le portail (testé).
- La liste des demandes est filtrée par `site_user_id` : un compte ne voit jamais les dossiers d'un autre (testé).
- Le serveur revalide les champs publics, les types, les relations et le statut ; une clé hors formulaire est refusée en 422.
- La configuration du portail exige une permission d'édition sur le projet ; un non-membre est refusé.
- Le portail s'ouvre dès que le formulaire est activé : **aucune publication du site vitrine n'est exigée** dans cet incrément.

## Limites assumées

- Pas de vérification d'email, pas de réinitialisation de mot de passe, pas de MFA, pas d'invitation pour les utilisateurs finaux.
- Pas de rattachement automatique des demandes à un dossier existant, pas de messagerie, pas de pièces jointes et pas de notification.
- Un seul objet public par projet ; les relations exposées montrent au plus 100 libellés récents.
- Le hachage argon2id et les sessions sont testés sur PGlite ; PostgreSQL externe, multi-instance et charge ne sont pas validés.
- Aucun partage d'identité entre sites, aucune fédération, aucune migration d'un compte local vers un fournisseur externe.
