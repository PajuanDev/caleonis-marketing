# Caléonis Marketing — premier déploiement

Application autonome, issue du fork de gitroomhq/postiz-app. Caléonis OS n'est pas requis.

## Ce que ce changement apporte
- Identité Caléonis sur la connexion et la navigation, favicon et accès visible au code source.
- Suppression des témoignages/chiffres commerciaux de Postiz de notre écran de connexion.
- Suppression des scripts marketing liés aux domaines Postiz/Gitroom dans le layout principal. Sentry/PostHog restent optionnels et ne doivent être activés qu'avec notre propre configuration appropriée.
- Construction Docker des vrais frontend, API et orchestrateur. Aucune maquette ne remplace l'application.
- Démarrage qui refuse les variables indispensables manquantes et les uploads locaux sans volume.
- Initialisation Prisma sans `--accept-data-loss` ni `--force-reset`.
- Test HTTP /healthz du web, de l'API et du contrôle Temporal existant. Ce test n'est pas une preuve de publication réussie.

## Infrastructure cible Railway
Projet : caleonis-marketing. Ne pas utiliser les ressources de caleonis-reception.

| Service | Persistance / exposition |
| --- | --- |
| Postgres | PostgreSQL 17, volume obligatoire, privé. Base applicative distincte des bases Temporal. |
| Redis | Redis 7.2, volume /data, authentification et AOF, privé. |
| Temporal | temporalio/auto-setup:1.28.1, historique et visibilité dans PostgreSQL, namespace default, privé. Pas de serveur de développement en production. |
| caleonis-marketing | Source de ce dépôt, Dockerfile.caleonis, volume /uploads, passerelle HTTP 5000. |

Pour ce pilote, Temporal peut utiliser le même serveur PostgreSQL dans deux bases séparées : temporal et temporal_visibility. Ne pas ajouter Elasticsearch inutilement. Les droits SQL minimaux et les sauvegardes doivent être examinés avant ouverture commerciale.

## Variables de l'application
À saisir uniquement dans Railway, jamais dans GitHub :

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<au moins 32 caractères générés aléatoirement>
TEMPORAL_ADDRESS=Temporal.railway.internal:7233
TEMPORAL_NAMESPACE=default
FRONTEND_URL=https://<domaine réel>
MAIN_URL=https://<domaine réel>
NEXT_PUBLIC_BACKEND_URL=https://<domaine réel>/api
BACKEND_INTERNAL_URL=http://127.0.0.1:3000
IS_GENERAL=true
STORAGE_PROVIDER=local
UPLOAD_DIRECTORY=/uploads
NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY=/uploads
DISABLE_REGISTRATION=true
```

Utiliser le véritable domaine privé fourni à Temporal par Railway ; ne pas supposer sa casse ou son nom. Les références Postgres/Redis exigent ces noms exacts de services et les variables correspondantes. Ne pas exposer leurs ports sur Internet.

Pas de serveur d'e-mail ni de clé IA factice. La clé OpenAI sera ajoutée au service quand disponible ; les fonctionnalités dépendantes ne sont pas considérées opérationnelles sans test. L'inscription est fermée par défaut ; organiser l'ouverture contrôlée pour le premier administrateur, puis la refermer. Avec HTTPS, laisser NOT_SECURED non définie, pas la chaîne "false".

## Volumes et état de mise en ligne
Le connecteur Railway permet le déploiement du code, mais son agent d'infrastructure a renvoyé une limite d'utilisation pendant la préparation. Ne pas contourner ce blocage avec une base éphémère. Les volumes et les bases doivent réellement exister avant un démarrage réussi.

## Contrôles avant bêta
1. Build complet réussi et /healthz = 200 ; journaux frontend, backend et orchestrateur examinés.
2. Création/connexion d'un compte contrôlé, séparation de deux organisations vérifiée.
3. Upload puis redéploiement : média toujours disponible.
4. Brouillon puis programmation/publication sur un canal de test expressément autorisé.
5. Connexions OAuth, IA, sauvegardes et restauration vérifiées ; budget d'exploitation défini.

Les fonctions Campagnes, profil marketing d'entreprise et orchestration Caléonis OS ne sont pas ajoutées par ce bootstrap. Ne pas présenter cette étape comme une V1 commerciale validée.

## Source et licence
Conserver LICENSE, les notices amont et l'historique du fork. Le script `var/caleonis/brand-routes.mjs` transforme uniquement les noms d'affichage dans les routes pendant le build. Le code source correspondant inclut ce script et le Dockerfile. Les identifiants techniques Postiz, clés OAuth, noms de paquets et mentions légales ne sont pas renommés globalement.
