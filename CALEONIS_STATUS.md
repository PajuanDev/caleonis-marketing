# Caléonis Marketing — état vérifié au 30 septembre 2026

## Version effectivement déployée

Dépôt : `PajuanDev/caleonis-marketing`, branche `main`.
Commit applicatif testé et déployé : `fcabe308d0d7319bce50df5237fd7f980488c21d`.
Déploiement Railway : `7523a987-e491-4890-b1c2-f6ab2a4f0c74`, statut SUCCESS vérifié.
Le contrôle `/healthz` a réussi le 30 septembre 2026 à 15:24:20 UTC. Le backend confirme son démarrage sur le port 3000 à 15:24:18 UTC. Les commits de documentation suivants ne modifient pas ce code applicatif déployé.

Adresse : `https://caleonis-marketing-production.up.railway.app`.
Connexion : `/auth/login`.
Nouveau point d'entrée : `/third-party`, après authentification.

## Apps créatives présentes dans le code déployé

Postiz reste le socle du studio natif et de la publication. Le nouvel écran « Vos apps créatives » rassemble les accès au studio intégré, à la médiathèque et au calendrier, ainsi qu'une carte de connexion facultative à Higgsfield. Les autres intégrations Postiz restent accessibles à `/third-party/other`.

Le premier connecteur Higgsfield est limité à Marketing Studio Image : brief textuel, format d'image, résolution 1K / 2K / 4K, confirmation de la facturation externe, suivi asynchrone et import volontaire en médiathèque. La vidéo, les références produit, les presets publicitaires et les autres modèles Higgsfield ne sont pas exposés par cet incrément.

Les identifiants API de l'entreprise se saisissent dans une fenêtre dédiée Key ID / Key Secret. Le serveur demande le catalogue par GET ; la connexion ne lance pas de génération. Il utilise le mécanisme chiffré existant des connexions ThirdParty, pas un nouveau coffre-fort audité. La modernisation du chiffrement et la rotation des secrets restent à prévoir avant généralisation. Aucune clé n'est conservée dans sessionStorage ou renvoyée dans la liste des connexions.

Les tâches sont rattachées à l'organisation authentifiée et à sa connexion, avec suivi Redis sept jours. La réservation NX précède le POST payant. Répéter le même UUID et le même brief réutilise le suivi ; un timeout ambigu ne déclenche jamais de nouveau POST automatique. L'import d'un résultat terminé ne commande pas une seconde génération. Deux imports simultanés peuvent néanmoins créer deux entrées médias ; aucune garantie transactionnelle exactement-une-fois n'est annoncée.

Aucune publication sociale n'est déclenchée par ce parcours. Higgsfield n'est pas requis pour le studio natif. Détail : CALEONIS_CREATIVE_APPS.md.

## Tests et compilation réellement réussis

Run GitHub Actions `36734224894`, job `109951552569`, sur le commit applicatif ci-dessus : conclusion SUCCESS, toutes les étapes terminées avec succès.

- 20 tests du vrai moteur Higgsfield avec réseau et stockage simulés : validation, consentement, séparation des organisations, non-répétition du POST, erreurs et import simulé.
- 6 tests de portée des cookies Railway et 3 tests de transformation de marque.
- Vérification TypeScript du frontend.
- Compilation frontend, backend et orchestrateur.

Les tests et compilations ont également réussi dans le build Docker Railway. Le premier essai CI avait dépassé la limite mémoire frontend ; la configuration évite désormais les source maps Sentry inutilisées quand aucune destination n'est configurée et active l'optimisation mémoire webpack. TypeScript, sanitisation HTML et contrôles de disponibilité n'ont pas été désactivés.

Ces tests simulés ne prouvent pas le fonctionnement d'un vrai compte Higgsfield, la qualité des rendus ou l'isolation de bout en bout des routes HTTP entre utilisateurs.

## Accès public et affichage vérifiés après déploiement

Le contrôle HTTP indépendant `36737241580`, job `109962047175`, s'est terminé avec succès à 15:30:26 UTC. Son résultat vérifié :

```json
{"health_http":200,"health":"ready","login_http":200,"login_title":"Connexion — Caléonis Marketing","credentials_used":false}
```

Le troisième essai navigateur du run `36732984061`, job `109959828742`, a ensuite vérifié l'URL publique à 15:30:53 UTC. L'artifact `11107418413`, créé à 15:30:55 UTC, a été récupéré et inspecté :

```json
{"title":"Connexion — Caléonis Marketing","inputs":[{"name":"email","type":"email"},{"name":"password","type":"password"}],"ready":"complete"}
```

Le fichier errors.txt est vide. La capture login.png a été ouverte et montre effectivement le formulaire Caléonis. Cela valide l'affichage public, pas l'authentification ni le parcours Apps après connexion. Les textes du formulaire conservent encore des libellés anglais et le bouton Google visible ne constitue pas une preuve que son fournisseur OAuth est configuré.

Un contrôle précédent, lancé pendant la bascule, avait reçu une page 502. Ce résultat n'a pas été considéré comme un succès d'affichage, même si le workflow de collecte finissait en SUCCESS. Le test HTTP à assertions et l'examen du dernier artifact confirment qu'au dernier contrôle cette erreur n'est plus reproduite. Le workflow navigateur de collecte reste à durcir avec des assertions explicites ; sa conclusion seule ne suffit pas.

Aucun mot de passe du propriétaire n'a été utilisé, lu ou modifié, aucun jeton de connexion forgé et aucun compte créé durant cet incrément. Le compte propriétaire existant et activé avait été confirmé en lecture seule lors de la reprise précédente. Les inscriptions restent configurées fermées.

## Infrastructure conservée

Projet Railway `b39ac92f-ffcd-4cf5-9698-41b1c05a20ce`, environnement production `2a7e9409-5747-4b39-a9db-5083dcdbf3af`.

| Service | ID | Persistance |
| --- | --- | --- |
| Postgres | `89f82b02-ad13-4941-a2ef-1307f3deffae` | Volume `ce15ade9-377f-47f2-b160-01ac042e1487`, 1024 MB, `/var/lib/postgresql/data` |
| Redis | `6772c8cb-ac0b-4998-b29b-49881cf8a890` | Volume `ace32472-2a1f-48ab-a79d-2ff5047607b1`, 1024 MB, `/data`, authentification et AOF |
| Temporal | `7ab1c833-4d4c-499b-b3bb-50f3a9b5da81` | Bases PostgreSQL `temporal` et `temporal_visibility`, namespace `default` |
| Application | `0a2b86b8-5a33-4b98-9ed6-cb7ba6adcd94` | Volume `d13dfa41-c3a7-4c24-94f5-a09459d616f7`, 1024 MB, `/uploads` |

Aucun nouveau service Railway ni GPU n'a été ajouté pour ce connecteur ; les vérifications supplémentaires ont utilisé GitHub Actions. Les services de données restent privés. Caléonis Réception et les autres projets n'ont pas été modifiés.

La région actuelle reste `sfo`. Avant données clients : revoir la région, les droits SQL, la rotation des secrets, les sauvegardes/restaurations, les quotas, le budget, l'isolation multi-organisation et la reprise du suivi créatif après panne Redis. Un volume persistant n'est pas une sauvegarde.

## Nettoyage ancien en attente

Le service de test `caleonis-verification-temp` (`2ded3c9c-4275-4248-9cc2-55976ec7ff44`) reste arrêté, sans volume et sans redémarrage automatique. Sa suppression est préparée dans le patch `aae5f7a0-556e-4fb5-af74-a9d17fd92d63`. La vérification à deux facteurs doit être effectuée dans Railway ; elle n'a pas été contournée. Ne pas supprimer les quatre services applicatifs ni leurs volumes. L'ancien service SQL ponctuel est absent.

## Ce qui reste à valider ou construire

Aucune clé Higgsfield, OpenAI, connexion sociale, configuration Stripe ou fournisseur d'e-mail n'a été ajoutée pendant cet incrément. Aucune génération payante ni publication réelle n'a été effectuée. Le studio natif nécessite toujours la configuration de ses propres fournisseurs IA ; la présence des boutons ne signifie pas que toutes ses fonctions IA sont actives.

À valider : authentification du propriétaire, parcours Apps authentifié, connexion Higgsfield consentie, une génération image autorisée et son import, conservation des médias, puis premier réseau et publication expressément autorisée.

Le profil marketing de l'entreprise, les campagnes enrichies, la stratégie autonome et la connexion à Caléonis OS ne sont pas encore livrés. Le produit reste un pilote en cours de validation, pas une infrastructure marketing complète prête pour tous les clients.

## Déploiement

Main a été avancé sans forçage après réussite des contrôles, puis CALEONIS_RELEASE a été mis à fcabe308d0d7319bce50df5237fd7f980488c21d pour déclencher le bon code. Son meta.commitHash a été vérifié. L'action redeploy peut reprendre un ancien snapshot ; contrôler la version réellement construite.
Les modifications de documentation seules ne justifient pas une reconstruction de l'application. Les watch paths Railway restent `**`, `!/*.md`. Le nouveau workflow HTTP de contrôle se trouve pour l'instant dans la branche feat/creative-apps-v1 ; il a testé l'URL de production sans la modifier.
