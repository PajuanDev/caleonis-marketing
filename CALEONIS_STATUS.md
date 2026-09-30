# Caléonis Marketing — état vérifié au 30 septembre 2026

## Version effectivement déployée

Dépôt : `PajuanDev/caleonis-marketing`, branche `main`.
Commit applicatif : `c910659f01ef1eca1470b5c2608a8d2c23756b30`.
Déploiement Railway actif vérifié : `d21622e3-4aae-4ba9-84fb-6a2d3722f542`, statut `SUCCESS`.
Adresse : `https://caleonis-marketing-production.up.railway.app` ; connexion : `/auth/login`.

Cette version inclut désormais le correctif de portée des cookies Railway, ainsi que les deux corrections de compilation décrites ci-dessous. L'ancienne version `8009ebbf` n'est plus la version à présenter comme actuelle.

Le contrôle Railway `/healthz` a réussi le 30 septembre 2026 à 11:58:24 UTC. Des sondes locales distinctes ont ensuite reçu HTTP 200 du frontend (4200), du backend (3000) et du contrôle Temporal de l'orchestrateur (3002), à 11:58:30 UTC. Le journal de démarrage du backend confirme son écoute sur le port 3000 ; son journal PM2 d'erreur était vide au moment de la sonde.

Cela valide le démarrage technique, pas la connexion utilisateur complète ni une publication sur un réseau social.

## Corrections de cette reprise

- `81d3fb55400df33d3d5dca0efc2707cec6cc319d` : les cookies d'un hôte `*.up.railway.app` sont limités à cet hôte, au lieu de `.railway.app`. Ce correctif est inclus dans le commit applicatif déployé.
- `1229d8a13a1bbc3cfca91079be50286c9e80c697` : compilation frontend avec `next build --webpack`, pour dépasser l'échec de résolution des polices de Turbopack. Un premier build a ensuite échoué sur un fichier interne de jsdom absent du bundle.
- `c910659f01ef1eca1470b5c2608a8d2c23756b30` : `serverExternalPackages: ['isomorphic-dompurify', 'jsdom']`, afin de préserver les fichiers chargés par jsdom côté serveur. La sanitisation HTML n'a pas été désactivée.
- Les trois tests de transformation de marque et les six tests du vrai helper de cookies passent. Les compilations frontend, backend et orchestrateur ont réussi.

Le premier conteneur du commit c910659f, déploiement `8868e2ad-d5bd-42ff-a79e-f2626bdf520f`, est resté en échec de disponibilité sans confirmation de démarrage du backend. Une relance du même code, avec des sondes locales ponctuelles, a démarré correctement. La cause exacte du premier démarrage bloqué n'a pas été établie : ne pas lui attribuer une correction causale non démontrée.

Les sondes locales se sont terminées. La commande de démarrage configurée a été rétablie à `bash /app/var/caleonis/start.sh` pour les prochains déploiements et leur variable de diagnostic a été vidée, sans relancer inutilement l'application fonctionnelle. Les healthchecks et garde-fous de stockage sont conservés.

## Vérifications d'accès réellement exécutées

Le contrôle externe ponctuel `84bcb29d-a993-4b66-8e28-4d9aee1c9768`, exécuté après la mise en ligne, a reçu à 11:59:30 UTC :

- `/healthz` : HTTP 200, `{"status":"ready"}`.
- `/auth/login` : HTTP 200.
- `/api/auth/can-register` : HTTP 200, `{"register":false}`.

Le navigateur automatisé a atteint `/auth/login` et lu le titre « Connexion — Caléonis Marketing ». Cependant, l'attente de `input[name="email"]` a expiré après 25 secondes. Le test complet de formulaire, les captures et les vérifications mobile qui suivaient n'ont donc PAS abouti. Une tentative d'enrichissement du script de diagnostic a été bloquée par l'outil d'édition ; le script initial est resté inchangé. Un statut SUCCESS de provisionnement du vérificateur ne constitue pas une réussite de son test navigateur.

La connexion interactive reste à confirmer dans le navigateur du propriétaire. Ne pas annoncer une validation de navigation, d'authentification de bout en bout, de séparation entre organisations ou de publication réelle.

Une requête SQL ponctuelle, exécutée en transaction READ ONLY avec délais bornés, a confirmé une organisation et un utilisateur, ainsi que l'existence d'un compte LOCAL activé correspondant à l'adresse du propriétaire. Aucun mot de passe, hash ou jeton n'a été lu, et aucun compte, rôle ou mot de passe n'a été créé ou modifié par cette reprise. Les inscriptions sont fermées. Aucun identifiant personnel supplémentaire n'est enregistré dans ce document public.

## Infrastructure conservée

Projet Railway `b39ac92f-ffcd-4cf5-9698-41b1c05a20ce`, environnement `2a7e9409-5747-4b39-a9db-5083dcdbf3af`.

| Service | ID | Persistance |
| --- | --- | --- |
| Postgres | `89f82b02-ad13-4941-a2ef-1307f3deffae` | Volume `ce15ade9-377f-47f2-b160-01ac042e1487`, 1024 MB, `/var/lib/postgresql/data` |
| Redis | `6772c8cb-ac0b-4998-b29b-49881cf8a890` | Volume `ace32472-2a1f-48ab-a79d-2ff5047607b1`, 1024 MB, `/data`, authentification et AOF |
| Temporal | `7ab1c833-4d4c-499b-b3bb-50f3a9b5da81` | Bases PostgreSQL `temporal` et `temporal_visibility`, namespace `default` |
| Application | `0a2b86b8-5a33-4b98-9ed6-cb7ba6adcd94` | Volume `d13dfa41-c3a7-4c24-94f5-a09459d616f7`, 1024 MB, `/uploads` |

Les quatre services sont en statut SUCCESS au dernier contrôle. Les volumes sont attachés. Les services de données restent privés ; seul le port 5000 de l'application est exposé publiquement. Caléonis Réception et les autres projets n'ont pas été modifiés.

La région actuelle reste `sfo`. Avant données clients : revoir la région, les droits SQL, les sauvegardes/restaurations, le budget et l'isolation des organisations. Un volume persistant n'est pas une sauvegarde.

## Nettoyage des vérificateurs temporaires

- `caleonis-db-check-temp` (`e4aee422-53e9-4fc8-a21d-38db25f31225`) : le contrôle en lecture seule est terminé ; sa référence à la base et sa requête ont été vidées. Ce service est absent de la liste des services au dernier contrôle.
- `caleonis-verification-temp` (`2ded3c9c-4275-4248-9cc2-55976ec7ff44`) : test terminé avec échec d'attente du formulaire, sans volume ni domaine public, redémarrage automatique désactivé. Sa suppression est préparée dans le patch `aae5f7a0-556e-4fb5-af74-a9d17fd92d63` (une modification restante). La suppression doit être validée dans Railway avec la vérification à deux facteurs demandée par la plateforme. Ne pas supprimer les quatre services applicatifs ni leurs volumes.

## Déploiement et suite

L'action `redeploy` peut reprendre un ancien snapshot. La modification de `CALEONIS_RELEASE` avec déploiement activé a permis de construire le dernier main ; toujours vérifier le `meta.commitHash` réel. Les changements limités aux Markdown à la racine sont exclus des watch paths (`**`, `!/*.md`).

Aucune clé IA, connexion OAuth sociale, configuration Stripe ou fournisseur d'e-mail n'a été ajoutée pendant cette reprise. Aucun e-mail, aucune campagne et aucune publication externe n'ont été envoyés. Les secrets techniques restent dans Railway.

Prochain jalon : confirmer la connexion dans le navigateur du propriétaire et investiguer le formulaire si nécessaire ; puis tester les médias persistants, configurer l'IA et un canal social expressément autorisé, et vérifier une publication. Le rebranding exhaustif, les campagnes enrichies, le profil marketing complet et la connexion à Caléonis OS ne sont pas livrés par ce bootstrap. L'application reste un pilote technique, pas une V1 commerciale entièrement validée.
