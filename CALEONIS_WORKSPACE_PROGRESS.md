# Caléonis Marketing — premier lot des espaces métier

État au 30 septembre 2026. Branche : `feat/marketing-workspace-v1`.
Code applicatif examiné : `e61390f9d3dccca32381e6d4b2891d91d01a1630`.

**Ce lot est enregistré sur une branche de développement, pas fusionné dans main et pas déployé sur Railway.** La production, les secrets, les comptes du propriétaire, les abonnements et Caléonis Réception n'ont pas été modifiés par ce lot. Aucun service supplémentaire ni génération payante n'a été commandé.

## Fonctionnement implémenté dans cette branche

- Intégrations retrouve son rôle de catalogue. Higgsfield figure à côté des autres applications enregistrées. Les cartes gèrent les connexions et ne contiennent plus le parcours de génération. L'ancienne URL `/third-party/other` redirige vers ce catalogue.
- Médias conserve sa bibliothèque existante et ajoute « Ouvrir le Studio créatif » vers `/media/studio`.
- Entreprise et marque (`/settings/company`) : activité, audience, offres, ton, règles et site web ; profils sauvegardés côté serveur.
- Campagnes (`/campaigns`) : objectifs, offre, audience, brief, action attendue, lien vers une marque ; création d'un projet créatif depuis une campagne.
- Studio (`/media/studio`) : dossiers créatifs réouvrables par URL, brief, formats, paramètres image, rattachement campagne, références de travail issues de la médiathèque commune, historique des sauvegardes et résultats.
- Les documents se sauvegardent explicitement avec un numéro de version. Une modification concurrente d'une ancienne version est refusée, pas écrasée silencieusement. Restaurer une ancienne version prépare un brouillon ; sa sauvegarde ajoute une nouvelle version.

Les données sont enregistrées dans un schéma PostgreSQL distinct, `caleonis`, via des requêtes paramétrées, sans remplacer le schéma public de Postiz. La migration est additive, transactionnelle et rejouable ; elle sera exécutée au démarrage après synchronisation du schéma amont. Elle n'a pas été exécutée sur la base de production pendant ce lot.

## Créations et autorisations

Le premier moteur relié au nouvel espace projet demeure l'adaptateur Higgsfield Marketing Studio Image déjà développé. Le studio peut préparer des projets sans compte Higgsfield ; cette branche n'apporte pas encore un moteur de génération image natif indépendant de Higgsfield. Les capacités existantes de l'agent Postiz restent séparées.

Les références image sont conservées dans les projets, mais ne sont PAS encore transmises à cet adaptateur texte-vers-image. Le serveur refuse une génération avec des références plutôt que de les ignorer. Les projets vidéo sont des dossiers de préparation ; la production vidéo n'est pas implémentée dans ce lot.

Les nouvelles demandes Higgsfield passent par une réservation PostgreSQL liée à l'entreprise, au projet, à sa version et à une connexion appartenant à cette entreprise. Répéter le même identifiant de demande ne commande pas un second rendu. L'ancienne route générique permettant de lancer directement une génération Higgsfield est bloquée ; le suivi et l'import d'anciennes tâches restent accessibles.

Le plafond `CALEONIS_CREATIVE_DAILY_LIMIT` vaut zéro par défaut : aucune nouvelle génération dans le studio tant que cette configuration n'est pas explicitement activée. Ce plafond compte les demandes sur 24 heures glissantes ; il ne s'agit PAS d'un plafond monétaire, ni d'un contrôle couvrant tous les appels des autres fonctions Postiz.

Une génération payante exige une confirmation explicite, une version sauvegardée et un rôle administrateur contrôlé dans la base. Les documents et liens sont recherchés dans l'entreprise de la session, jamais dans une organisation déclarée par le client.

Les briefs et identifiants de demande restent dans PostgreSQL. Le transport Higgsfield utilise encore le suivi Redis existant de sept jours : après expiration, l'historique reste présent, mais la récupération du résultat fournisseur n'est pas garantie par ce lot. Une réponse incertaine n'entraîne pas un nouveau POST payant automatique.

L'import en médiathèque utilise le stockage et les contrôles de type/URL existants. Les imports simultanés peuvent encore créer deux entrées médias ; aucune garantie d'import exactement-une-fois n'est annoncée. Les URL de médias existantes ne sont pas rendues privées par ce lot.

## Reprise open source : périmètre exact

Première adaptation du contrat de capacités de modèles de `TechBeme/open-higgsfield`, sous licence MIT. Notice et origine conservées dans `THIRD_PARTY_NOTICES_CALÉONIS.md`.

Il ne s'agit PAS de l'import de toute son interface, de son catalogue multi-fournisseurs ni de ses modèles. L'interface de ce premier lot est un espace métier initial ; le travail visuel et créatif final reste à faire. Aucune équivalence de qualité avec Higgsfield n'a été mesurée ou annoncée.

## Vérifications exécutées

Sur le commit applicatif ci-dessus, workflow `Caleonis workspace safety`, run `36743675007` :

- Job `109984304658` : 36 tests de validation de documents, paramètres, références, versions et rejet des champs non autorisés ; tous réussis.
- Job `109984304455` : 9 scénarios sur PostgreSQL 17 réel, dans une base locale jetable explicitement gardée ; tous réussis. Ils portent sur les accès par entreprise au niveau dépôt de données, les versions, écritures concurrentes et réservations de générations.
- Le même job exécute un scénario supplémentaire : créer une marque, une campagne, un projet avec deux versions et une demande incertaine ; déconnecter le client ; exécuter la vraie commande `prisma db push` amont ; rouvrir une connexion et vérifier les données ainsi que la réservation anti-répétition. Ce scénario a réussi.

Le workflow Build `36743675191`, job `109984305965`, a déjà réussi les 20 tests simulés Higgsfield existants, les 6 tests de cookies, les 3 tests de marque, la vérification TypeScript et les compilations du serveur et de l'orchestrateur. Au moment de cette rédaction, sa compilation frontend est encore en cours : consulter son résultat final avant fusion.

L'essai précédent avait échoué parce que la bibliothèque TypeScript frontend ne déclarait pas Object.hasOwn. Le correctif utilise Object.prototype.hasOwnProperty.call sans affaiblir les contrôles ni modifier la cible TypeScript.

Ces vérifications ne remplacent pas les tests HTTP entre utilisateurs, la connexion interactive, l'inspection visuelle des nouveaux écrans ni une génération réelle. Aucun test utilisant les identifiants du propriétaire n'a été effectué. La batterie de recette complète prévue après configuration reste à exécuter.

## Suite du développement

Priorité suivante : approfondir la reprise du vrai studio multi-fournisseurs (interface créative, adaptateur image natif, références produit, puis vidéo), sans réintroduire un studio fictif ou une seconde application indépendante. Ensuite : contexte marque/campagne effectivement utilisé par les agents, productions multi-format, validations liées aux versions et liaison au calendrier.

Avant fusion et déploiement : vérifier la compilation finale, effectuer une revue des routes authentifiées et un contrôle d'affichage en environnement isolé, préparer sauvegarde et restauration, puis conserver les générations désactivées jusqu'à configuration. L'écran de suivi de cette branche ne doit pas être présenté comme déjà disponible à l'adresse du pilote.
