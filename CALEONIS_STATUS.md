# Caléonis Marketing — état du déploiement

Mise à jour : 30 septembre 2026. Ce document distingue les opérations réellement vérifiées des tests encore à effectuer.

## Produit et code

Application SaaS autonome issue du fork de Postiz, sans dépendance à Caléonis OS.
Dépôt : `PajuanDev/caleonis-marketing`, branche `main`.
Base amont initiale : `9efa1f553c610eb4fffe6bdde48b420c8a9f4858`.
Identité initiale : `8fd1753f8d406f071b75c3729cca89163050d0ce`.
Interface et préparation du déploiement : `9ec6b67fa077b14035a2869c12fb56748497454f`.

Premier rebranding : identité centralisée, connexion, navigation, favicon, accès au code source. Les témoignages et le chiffre de clients Postiz ne sont pas repris comme références Caléonis. Licence, attributions et historique amont conservés. Toutes les références de marque du logiciel ne sont pas encore auditées.

## Infrastructure réellement créée

Projet Railway : `b39ac92f-ffcd-4cf5-9698-41b1c05a20ce`.
Environnement production : `2a7e9409-5747-4b39-a9db-5083dcdbf3af`.
Workspace : `pajuandev's Projects`.

| Service | ID | Persistance / accès |
| --- | --- | --- |
| Postgres | `89f82b02-ad13-4941-a2ef-1307f3deffae` | Volume `ce15ade9-377f-47f2-b160-01ac042e1487`, 1024 MB, `/var/lib/postgresql/data`, accès privé |
| Redis | `6772c8cb-ac0b-4998-b29b-49881cf8a890` | Volume `ace32472-2a1f-48ab-a79d-2ff5047607b1`, 1024 MB, `/data`, authentification et AOF, accès privé |
| Temporal | `7ab1c833-4d4c-499b-b3bb-50f3a9b5da81` | PostgreSQL persistant, bases séparées `temporal` et `temporal_visibility`, namespace `default`, accès privé |
| Application | `0a2b86b8-5a33-4b98-9ed6-cb7ba6adcd94` | Volume `d13dfa41-c3a7-4c24-94f5-a09459d616f7`, 1024 MB, `/uploads`, passerelle HTTP 5000 |

Les trois volumes sont vérifiés comme réellement attachés dans le statut et la configuration Railway, pas seulement annoncés par l'agent.
PostgreSQL et Redis ont démarré et acceptent les connexions. Temporal a démarré et enregistré le namespace `default`.
La région actuellement provisionnée est `sfo`. Ne pas présenter ce pilote comme hébergé en Europe. Évaluer la région et les conditions d'hébergement avant accueil de données clients.
Caléonis Réception n'a pas été modifié. Aucun abonnement ni plafond budgétaire n'a été modifié par les opérations de déploiement.

## Corrections effectuées pendant le déploiement

- `05ae5b5d4ff9cfcac7c6e6102e960c9bc2e65e1d` : remplacement de `pnpm install --prod=false` par `NODE_ENV=development pnpm install --frozen-lockfile`, après l'erreur réelle `ERR_PNPM_OPTIONAL_DEPS_REQUIRE_PROD_DEPS`.
- Avec ce correctif, l'installation, la génération Prisma, la compilation frontend avec contrôle TypeScript, le backend et l'orchestrateur ont tous terminé sans erreur.
- Le premier démarrage a établi les connexions aux dépendances mais Nginx a échoué en ouvrant `/dev/stderr` sous PM2. Le statut Railway `SUCCESS` de cet ancien déploiement n'était donc PAS une preuve d'accès web.
- `8009ebbf23f6d3ddec1f33c1de2045f1803a8e83` : Nginx utilise désormais `error_log stderr` sans rouvrir le descripteur de PM2 ; son access log local est désactivé pour éviter un journal non borné.
- Configuration Railway vérifiée explicitement : `Dockerfile.caleonis`, commande `bash /app/var/caleonis/start.sh`, contrôle `/healthz` avec délai de 600 secondes, branche `main`.
- L'API Railway a refusé de définir `railwayConfigFile` en indiquant que Config as Code est déprécié. Les paramètres nécessaires ont donc été appliqués directement au service. Ne pas se fier uniquement à `railway.toml` pour une nouvelle instance.
- Le bouton/outillage de redéploiement a repris l'ancien commit. Une nouvelle modification de configuration, validée par l'agent, a déclenché la construction du bon commit. Vérifier systématiquement `commitHash`, pas seulement le nom de branche.
- Watch paths : `**`, puis `!/*.md`, pour éviter les reconstructions lors de modifications des seuls documents Markdown à la racine.

## État de validation à cet instant

Dernier déploiement correct en cours : `4d75198c-5f07-474d-9f19-c7305121001c`, commit `8009ebbf23f6d3ddec1f33c1de2045f1803a8e83` vérifié dans les métadonnées Railway.
Au dernier contrôle, il est encore en construction. Ne pas affirmer que l'accès web fonctionne tant que son démarrage et `/healthz` ne sont pas validés.
L'ancien redéploiement `be5d9d52-45b3-4009-8a0f-4af4f3f7637c` utilise encore `05ae5b5...` ; il ne doit pas être pris pour la version corrigée.

Adresse attribuée (pas encore attestée fonctionnelle dans ce relevé) : `https://caleonis-marketing-production.up.railway.app`.

Les tests locaux initiaux comprenaient 8 tests réussis, dont des sondes HTTP simulées ; ils ne constituent pas un test de publication réelle. Le build Docker a aussi exécuté avec succès les tests de transformation de marque et les contrôles de syntaxe.

## Premier compte et services externes

Aucun compte n'a été créé par l'assistant. La route `/auth` autorise le premier compte local tant qu'aucune organisation n'existe, même avec `DISABLE_REGISTRATION=true`. Les inscriptions locales supplémentaires sont ensuite refusées. Ce n'est pas une restriction par adresse e-mail du propriétaire : effectuer la prise en main contrôlée puis vérifier la fermeture des inscriptions.
`EMAIL_PROVIDER` n'est pas configuré ; le service sélectionne son fournisseur vide. Aucun envoi d'e-mail, mot de passe oublié ou invitation par e-mail n'est validé.
Aucune clé IA, clé OAuth de réseau social ou configuration Stripe n'a été ajoutée. Aucune publication ni campagne externe n'a été effectuée.
Les mots de passe techniques et le secret JWT sont uniquement dans les variables Railway, pas dans le dépôt.

## Avant une bêta commerciale

Vérifier l'accès HTTP et le navigateur, la création/connexion du compte, la séparation des organisations, un upload conservé après redéploiement, les sauvegardes/restaurations, le budget et la région. Connecter ensuite les fournisseurs IA et un canal social autorisé, puis tester explicitement brouillon, programmation et publication.
Le contrôle `/healthz` vérifie le web, la réponse HTTP de l'API et le namespace Temporal via l'orchestrateur. Il ne certifie ni toutes les fonctions métier ni les publications sur les réseaux.
Les campagnes marketing complètes, le profil d'entreprise enrichi et l'intégration Caléonis OS ne sont pas livrés par ce bootstrap.
