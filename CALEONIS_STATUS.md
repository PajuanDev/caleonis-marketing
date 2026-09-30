# Caléonis Marketing — état vérifié au 30 septembre 2026

Ce document distingue l'infrastructure créée, la version ayant démarré et les corrections non encore déployées. Caléonis Réception et les autres projets n'ont pas été modifiés.

## Infrastructure réellement créée

Projet Railway `b39ac92f-ffcd-4cf5-9698-41b1c05a20ce`, environnement production `2a7e9409-5747-4b39-a9db-5083dcdbf3af`, workspace `pajuandev's Projects`.

| Service | ID | Persistance |
| --- | --- | --- |
| Postgres | `89f82b02-ad13-4941-a2ef-1307f3deffae` | Volume `ce15ade9-377f-47f2-b160-01ac042e1487`, 1024 MB, `/var/lib/postgresql/data` |
| Redis | `6772c8cb-ac0b-4998-b29b-49881cf8a890` | Volume `ace32472-2a1f-48ab-a79d-2ff5047607b1`, 1024 MB, `/data`, AOF et authentification |
| Temporal | `7ab1c833-4d4c-499b-b3bb-50f3a9b5da81` | PostgreSQL persistant, bases `temporal` et `temporal_visibility`, namespace `default` |
| Application | `0a2b86b8-5a33-4b98-9ed6-cb7ba6adcd94` | Volume `d13dfa41-c3a7-4c24-94f5-a09459d616f7`, 1024 MB, `/uploads` |

Postgres, Redis et Temporal sont en statut SUCCESS, avec journaux de démarrage vérifiés. Les volumes sont réellement attachés. Les services de données ne sont pas exposés publiquement. Seule l'application a un domaine public, vers le port 5000.
Région actuelle : `sfo`, pas Europe. La région, les sauvegardes/restaurations et la séparation des droits SQL doivent être revues avant données clients. Temporal et l'application utilisent des bases distinctes sur le même serveur PostgreSQL du pilote.

## Dernière version réellement démarrée

Dépôt `PajuanDev/caleonis-marketing`, branche `main`.
Déploiement `4d75198c-5f07-474d-9f19-c7305121001c`, commit `8009ebbf23f6d3ddec1f33c1de2045f1803a8e83`.
Statut SUCCESS revérifié. Le journal Railway indique `[1/1] Healthcheck succeeded!` le 30 septembre 2026 à 11:13:31 UTC, après démarrage des composants.
Adresse attribuée : `https://caleonis-marketing-production.up.railway.app`.

Le contrôle `/healthz` passe par Nginx et vérifie une réponse du frontend, de l'API et du contrôle Temporal de l'orchestrateur. Ce résultat ne constitue PAS un test de connexion utilisateur, de navigation interactive, de conservation d'un upload après redéploiement ou de publication sur un réseau social. Aucun test navigateur externe n'a pu être exécuté.

Cette version inclut l'identité initiale Caléonis, le retrait des témoignages/chiffres commerciaux amont, les liens de code source et les correctifs de démarrage. Il ne s'agit pas d'un rebranding exhaustif ni d'une V1 commerciale validée.

## Corrections réellement enregistrées

- `05ae5b5d4ff9cfcac7c6e6102e960c9bc2e65e1d` : installation avec `NODE_ENV=development pnpm install --frozen-lockfile`, après échec de `--prod=false`.
- `8009ebbf23f6d3ddec1f33c1de2045f1803a8e83` : Nginx utilise `error_log stderr` sous PM2 ; le précédent `/dev/stderr` empêchait le démarrage de la passerelle. Le journal d'accès local non borné est désactivé.
- Le schéma applicatif Prisma a été initialisé sans acceptation automatique de perte de données.
- La configuration effective Railway a été fixée explicitement : Dockerfile.caleonis, commande `bash /app/var/caleonis/start.sh`, `/healthz` avec délai de 600 secondes et branche main.
- L'API a refusé la définition de `railwayConfigFile` en indiquant la dépréciation de Config as Code. Ne pas compter uniquement sur railway.toml lors d'un nouveau déploiement.
- Watch paths : `**`, puis `!/*.md`, pour éviter de reconstruire lors de modifications des seuls Markdown à la racine.

## Dernière mise à jour : sécurité des cookies, NON DÉPLOYÉE

Le helper amont calculait `.railway.app` comme domaine de cookie, trop large pour des instances sans lien. Le premier correctif `allowPrivateDomains: true` a échoué aux tests car les données embarquées de tldts ne contiennent pas encore le suffixe Railway.
Le commit `81d3fb55400df33d3d5dca0efc2707cec6cc319d` limite explicitement les cookies des hôtes `*.up.railway.app` à l'hôte exact, tout en conservant le comportement des domaines personnalisés.
Les six tests exécutant le vrai helper, dans `var/caleonis/cookie-domain.test.mjs`, PASSENT dans le déploiement `bdf535c8-ab41-41e1-883b-eca52f9c679e`. Les trois tests de transformation de marque passent également.

Cependant, ce déploiement a ensuite ÉCHOUÉ pendant la compilation frontend : Turbopack rapporte 16 erreurs de résolution des polices next/font/google, notamment `next/font/google queries have exactly one entry`, depuis le layout provider.
La tentative d'enregistrer une modification du mode de compilation via l'outil GitHub a été bloquée par le système de sécurité de l'outil. Cette modification N'EST PAS enregistrée ; aucun contournement n'a été effectué.
La version active reste donc le commit 8009ebbf et n'inclut pas le correctif de cookies. Ne pas annoncer la dernière version comme déployée ni valider la création du premier compte avant résolution et contrôle.

## Déployer le bon code

L'action `redeploy` a repris un ancien snapshot au lieu du dernier commit. Pour les mises à jour suivantes, une modification de la variable informative `CALEONIS_RELEASE` avec déploiement activé a bien déclenché une construction du dernier main. Toujours contrôler le `meta.commitHash` réel avant de conclure.
Au dernier contrôle, aucune opération ne reste dans pendingWork ; le dernier déploiement est FAILED, et le déploiement 4d75198c demeure SUCCESS.

## Accès, services externes et suite

Aucun compte n'a été créé par l'assistant. `DISABLE_REGISTRATION=true` autorise néanmoins le premier compte local tant qu'aucune organisation n'existe, puis bloque les inscriptions locales supplémentaires. Ce n'est pas une restriction par adresse e-mail du propriétaire. La prise en main doit être contrôlée une fois le correctif de cookies déployé.
Aucune clé IA, OAuth de réseau social, Stripe ou configuration de fournisseur d'e-mail n'a été ajoutée. Aucun e-mail, aucune campagne et aucune publication externe n'ont été envoyés. Les secrets techniques restent dans Railway, pas dans le dépôt.

Prochain jalon : résoudre la compilation du correctif, déployer, vérifier `/healthz`, puis tester création/connexion du compte et fermeture des inscriptions. Ensuite : médias persistants, isolation des organisations, sauvegardes et restauration, budget/région, IA et un canal social expressément autorisé.
Les fonctions Campagnes enrichies, profil marketing complet et connexion à Caléonis OS ne sont pas livrées par ce bootstrap.
