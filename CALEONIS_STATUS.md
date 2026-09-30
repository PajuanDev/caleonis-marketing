# Caléonis Marketing — état vérifié au 30 septembre 2026

## Version effectivement déployée

Dépôt : `PajuanDev/caleonis-marketing`, branche `main`.
Commit applicatif testé et déployé : `fcabe308d0d7319bce50df5237fd7f980488c21d`.
Déploiement Railway : `7523a987-e491-4890-b1c2-f6ab2a4f0c74`, statut SUCCESS vérifié.
Le contrôle `/healthz` a réussi le 30 septembre 2026 à 15:24:20 UTC. Le backend confirme son démarrage sur le port 3000 à 15:24:18 UTC. La compilation complète de l'image et ses tests ont réussi.
Les commits de documentation suivants ne modifient pas ce code applicatif déployé.

Adresse : `https://caleonis-marketing-production.up.railway.app`.
Connexion : `/auth/login`.
Nouveau point d'entrée : `/third-party`, après authentification.

## Incrément Apps créatives livré dans le code déployé

Postiz reste le socle du studio natif et de la publication. Le nouvel écran « Vos apps créatives » rassemble les accès au studio intégré, à la médiathèque et au calendrier, ainsi qu'une carte de connexion facultative à Higgsfield. Les autres intégrations Postiz restent accessibles à `/third-party/other`.

Le premier connecteur Higgsfield est limité à Marketing Studio Image : brief textuel, format d'image, résolution 1K / 2K / 4K, confirmation de la facturation externe, suivi asynchrone et import volontaire en médiathèque. La vidéo, les références produit, les presets publicitaires et les autres modèles Higgsfield ne sont pas exposés par cet incrément.

Les identifiants API de l'entreprise se saisissent dans une fenêtre dédiée. Le serveur effectue un GET de catalogue pour la connexion ; cette action ne lance pas de génération. Il utilise ensuite le mécanisme chiffré existant des connexions ThirdParty. Aucune clé n'est conservée dans sessionStorage ou renvoyée dans la liste des connexions. Il ne s'agit pas d'un nouveau coffre-fort audité ; la modernisation du chiffrement et la rotation des secrets restent à prévoir avant généralisation.

Les tâches sont rattachées à l'organisation authentifiée et à sa connexion, avec suivi Redis sept jours. La réservation NX précède le POST payant. Un envoi répété avec le même UUID et le même brief réutilise le suivi ; un timeout ambigu ne déclenche jamais de nouveau POST automatique. L'import d'un résultat terminé ne commande pas une seconde génération. Deux imports simultanés peuvent néanmoins créer des entrées médias en double ; ne pas annoncer une garantie transactionnelle exactement-une-fois.

Aucune publication sur un réseau social n'est déclenchée par ce parcours. Higgsfield n'est pas requis pour le studio natif. Le détail et les limites sont décrits dans CALEONIS_CREATIVE_APPS.md.

## Tests et compilation réellement réussis

Run GitHub Actions `36734224894`, job `109951552569`, commit `fcabe308d0d7319bce50df5237fd7f980488c21d` : conclusion SUCCESS, toutes les étapes terminées avec succès.

- 20 tests du vrai moteur Higgsfield avec réseau et stockage simulés, sans clé ni dépense : validation, consentement, séparation des organisations, non-répétition du POST, gestion des erreurs et import simulé.
- 6 tests de portée des cookies Railway et 3 tests de transformation de marque.
- Vérification TypeScript du frontend.
- Compilation frontend, backend et orchestrateur.

Le premier essai de compilation frontend avait dépassé la limite mémoire. La configuration Next.js évite désormais de générer des source maps Sentry inutilisées en l'absence de destination configurée et active l'optimisation mémoire webpack. Cette correction a permis au run complet et à la compilation Railway d'aboutir. TypeScript, sanitisation HTML et healthchecks n'ont pas été désactivés.

Les tests simulés ne prouvent pas le fonctionnement réel du compte Higgsfield, la qualité des rendus ou l'isolation de bout en bout des routes HTTP entre utilisateurs.

## Contrôles navigateur et accès

Le run navigateur `36732984061`, première tentative, job `109947365727`, a contrôlé le pilote avant cette mise en ligne : titre « Connexion — Caléonis Marketing », champs e-mail et mot de passe présents après chargement, aucune erreur JavaScript relevée et capture effectuée. L'ancien timeout du vérificateur Railway n'est donc plus la seule observation disponible.

Une deuxième tentative, job `109959087498`, a ouvert la page pendant la bascule du déploiement et reçu une page 502 à 15:24:28 UTC. Malgré la conclusion SUCCESS du workflow de collecte, ce résultat n'est PAS une validation de l'affichage : ce script récolte des diagnostics mais ne possède pas encore d'assertion bloquante sur leur contenu. Ne jamais assimiler le succès du workflow à une connexion réussie.

Une troisième tentative de lecture, job `109959828742`, a été lancée après le démarrage pour recontrôler l'accès public ; son résultat n'était pas disponible au moment de cette consignation. Le statut Railway SUCCESS et la réussite du healthcheck restent distincts de la validation du formulaire après déploiement.

Aucun identifiant de connexion du propriétaire n'a été utilisé. Aucun compte, rôle ou mot de passe n'a été créé, lu ou modifié durant cet incrément. Le compte propriétaire existant et son activation avaient été confirmés par le contrôle SQL en lecture seule de la reprise précédente ; les inscriptions restent configurées fermées.

## Infrastructure conservée

Projet Railway `b39ac92f-ffcd-4cf5-9698-41b1c05a20ce`, environnement production `2a7e9409-5747-4b39-a9db-5083dcdbf3af`.

| Service | ID | Persistance |
| --- | --- | --- |
| Postgres | `89f82b02-ad13-4941-a2ef-1307f3deffae` | Volume `ce15ade9-377f-47f2-b160-01ac042e1487`, 1024 MB, `/var/lib/postgresql/data` |
| Redis | `6772c8cb-ac0b-4998-b29b-49881cf8a890` | Volume `ace32472-2a1f-48ab-a79d-2ff5047607b1`, 1024 MB, `/data`, authentification et AOF |
| Temporal | `7ab1c833-4d4c-499b-b3bb-50f3a9b5da81` | Bases PostgreSQL `temporal` et `temporal_visibility`, namespace `default` |
| Application | `0a2b86b8-5a33-4b98-9ed6-cb7ba6adcd94` | Volume `d13dfa41-c3a7-4c24-94f5-a09459d616f7`, 1024 MB, `/uploads` |

Les services de données et leurs volumes ont été conservés. Aucune nouvelle infrastructure Railway ni GPU n'a été ajouté pour le connecteur ; les vérifications supplémentaires ont utilisé GitHub Actions. Les services de données restent privés. Caléonis Réception et les autres projets n'ont pas été modifiés.

La région actuelle reste `sfo`. Avant données clients : revoir la région, les droits SQL, la rotation des secrets, les sauvegardes/restaurations, les quotas, le budget et les tests d'isolation multi-organisation. La reprise du suivi créatif après panne de Redis reste aussi à éprouver. Un volume persistant n'est pas une sauvegarde.

## Nettoyage ancien en attente

Le service de test `caleonis-verification-temp` (`2ded3c9c-4275-4248-9cc2-55976ec7ff44`) reste arrêté, sans volume et sans redémarrage automatique. Sa suppression est préparée dans le patch `aae5f7a0-556e-4fb5-af74-a9d17fd92d63`. La validation à deux facteurs doit être effectuée dans Railway ; elle n'a pas été contournée. Ne pas supprimer les quatre services applicatifs ni leurs volumes. L'ancien service SQL ponctuel est absent.

## Ce qui n'est pas encore validé ou livré

Aucune clé Higgsfield, OpenAI, connexion sociale, configuration Stripe ou fournisseur d'e-mail n'a été ajoutée pendant cet incrément. Aucune génération payante ni publication réelle n'a été effectuée. Le studio natif a toujours besoin de la configuration de ses fournisseurs IA ; sa présence dans l'interface ne signifie pas que toutes ses fonctions IA sont actives.

À valider : authentification du propriétaire, parcours Apps authentifié, connexion Higgsfield consentie, une génération image autorisée et son import, conservation des médias, connexion d'un premier réseau et publication expressément autorisée.

Le profil marketing de l'entreprise, les campagnes enrichies, la stratégie autonome et la connexion à Caléonis OS ne sont pas encore livrés. Caléonis Marketing reste un pilote en cours de validation, pas une infrastructure marketing complète prête pour tous les clients.

## Déploiement

L'action redeploy peut reprendre un ancien snapshot. Pour cet incrément, main a été avancé sans forçage après réussite des contrôles, puis CALEONIS_RELEASE a été mis à fcabe308d0d7319bce50df5237fd7f980488c21d pour déclencher le bon code. Le meta.commitHash réel du déploiement a été vérifié.
Les modifications de documentation seules ne justifient pas une reconstruction de l'application ; les watch paths Railway restent `**`, `!/*.md`.
