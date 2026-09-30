# Caléonis Marketing — Apps créatives V1

## Décision produit

Caléonis Marketing est une application autonome, sans abonnement à Caléonis OS obligatoire. Postiz reste le socle de publication et du studio intégré. Higgsfield est une application créative facultative, connectée avec les identifiants API propres à l'entreprise. Aucun modèle ni abonnement Higgsfield n'est fourni par ce connecteur.

## Parcours ajouté

- `/third-party` : espace « Vos apps créatives », avec accès au studio intégré, aux médias et au calendrier ; carte Higgsfield et fenêtre de connexion.
- `/third-party/other` : accès conservé aux autres intégrations Postiz.
- Higgsfield : connexion Key ID / Key Secret, création d'une image depuis un brief textuel, choix du format et de la résolution 1K / 2K / 4K, suivi asynchrone, puis import volontaire en médiathèque.
- Une case de confirmation distincte autorise l'envoi du brief et la facturation par Higgsfield. Aucun post n'est publié par ce parcours.
- La vidéo, les références produit, les presets et les autres modèles ne sont PAS exposés par cette première intégration. Il ne s'agit pas d'une copie de toute la plateforme Higgsfield.

## Connexion et facturation

Les identifiants se saisissent dans la fenêtre « Connecter Higgsfield » de l'application, jamais dans une conversation, un dépôt ou une variable publique NEXT_PUBLIC. Le serveur demande le catalogue via un GET authentifié ; aucune génération n'est commandée à la connexion. Les clés sont conservées avec le mécanisme chiffré existant des connexions ThirdParty de Postiz, et ne sont pas renvoyées au navigateur dans la liste des connexions. Ce mécanisme existant n'est pas un nouveau coffre-fort de secrets audité : sa modernisation et sa rotation restent à prévoir avant généralisation.

Les générations utilisent le solde API de l'entreprise chez Higgsfield. L'abonnement web Higgsfield et les crédits API ne doivent pas être confondus. Aucun prix fixe ni génération incluse dans l'abonnement Caléonis n'est promis. Avant un essai réel, consulter les tarifs et autoriser explicitement une génération.

Documentation fournisseur utilisée pour le développement :
- https://open.higgsfield.ai/models/marketing-studio/image/api-reference
- https://github.com/higgsfield-ai/higgsfield-js

Le connecteur appelle exclusivement `https://api.higgsfield.ai/marketing-studio/image` avec `enhance_prompt: false`. Il ne propose aucun contrôle permettant de désactiver la modération. Les paramètres inconnus fournis par le client ne sont pas transmis.

## Séparation des données et reprise

L'organisation est issue de la session authentifiée, pas du corps de la demande. La connexion est recherchée dans cette organisation. Les tâches sont cloisonnées par organisation, connexion et UUID de demande, avec suivi Redis pendant sept jours. Le navigateur ne conserve que le dernier UUID de cet onglet dans sessionStorage, sans clé API ; ce n'est pas un historique complet des créations.

La réservation Redis NX précède l'appel de génération. Rejouer le même UUID et le même brief pendant la durée de conservation ne déclenche pas un second POST payant. Un timeout ambigu est signalé comme « état à vérifier » et n'est jamais suivi automatiquement d'un nouveau POST. Une nouvelle demande avec un nouvel UUID peut être facturée séparément : vérifier le tableau de bord Higgsfield en cas d'incertitude.

Les URLs de suivi doivent rester sur l'origine API officielle et correspondre au request_id. Les redirections sont refusées lorsque les identifiants sont envoyés ; les appels ont un délai borné. Les messages d'erreur fournisseur bruts ne sont pas exposés. Les images importées passent par les protections SSRF et la détection de type de fichier du stockage existant, puis sont rattachées à l'organisation dans la médiathèque.

L'import réutilise une génération terminée ; il ne relance pas le modèle. L'enregistrement média n'est pas une transaction distribuée exactement-une-fois : deux imports simultanés ou une interruption entre le stockage et le suivi peuvent produire deux entrées médias, sans achat d'une deuxième génération.

La suppression d'une connexion ne supprime pas les médias déjà importés et n'annule pas les tâches déjà acceptées par le fournisseur.

## Vérifications réellement réussies

Le run GitHub Actions `36734224894`, job `109951552569`, sur le commit `fcabe308d0d7319bce50df5237fd7f980488c21d`, s'est terminé avec succès :

- 20 tests du moteur Higgsfield, exécutant son vrai TypeScript avec fetch et stockage simulés, sans appel fournisseur ni dépense ;
- 6 tests de portée des cookies et 3 tests de transformation de marque ;
- vérification TypeScript du frontend ;
- compilation du frontend, du backend et de l'orchestrateur.

Un premier run avait dépassé la limite mémoire de compilation frontend. La configuration évite désormais les source maps Sentry inutilisées quand aucun destinataire n'est configuré et active les optimisations mémoire webpack. Les vérifications TypeScript, la sanitisation HTML et les contrôles de disponibilité n'ont pas été supprimés.

L'affichage de la page de connexion du pilote a été contrôlé par le run navigateur `36732984061` : titre Caléonis, champs e-mail et mot de passe présents après chargement, aucune erreur JavaScript relevée. Aucune authentification avec les identifiants du propriétaire n'a été réalisée. Une capture a été conservée dans les artifacts temporaires du run.

Le commit testé a été intégré à main puis envoyé au déploiement Railway `7523a987-e491-4890-b1c2-f6ab2a4f0c74`. Consulter CALEONIS_STATUS.md pour son état effectivement vérifié. Une compilation réussie ne prouve pas à elle seule le démarrage ni le bon fonctionnement d'une API externe.

## Reste à valider avant généralisation

Authentification réelle du propriétaire ; parcours authentifié Apps ; connexion d'un compte Higgsfield autorisé ; une génération image payante consentie ; import, persistance et suppression/reconnexion ; tests HTTP entre organisations ; quotas d'usage, supervision, reprise après panne Redis, sauvegardes et restauration. Le studio natif nécessite séparément les clés et éventuelles licences de ses propres fournisseurs.

Aucune clé Higgsfield ou OpenAI n'a été ajoutée lors de ce développement, aucune génération réelle n'a été commandée, et aucune publication sociale n'a été envoyée. Le profil entreprise, les campagnes enrichies et l'orchestration marketing globale ne sont pas livrés par cet incrément.

Ne pas toucher à Caléonis Réception, ne pas activer de budgets ou d'abonnements et ne pas publier sur un réseau social pour un simple test du connecteur.
