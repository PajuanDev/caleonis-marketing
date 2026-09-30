# Caléonis Marketing — studio intégré et projets persistants

État vérifié le 30 septembre 2026. Branche : `feat/marketing-workspace-v1`.
Code applicatif de ce lot : `8fc14d7edd6ae5172ad326b6d36b2ff2f9ecdf0f`.
Dernier commit testé : `e7c754f1384d4adcbe928a8a1ef5cfd50ab8c160` (correction du sélecteur du test navigateur, pas des capacités du modèle).

## Livraison et reprise

**Travail enregistré sur la branche de développement ; non fusionné dans main et non déployé sur Railway.** Aucun changement aux comptes, secrets, abonnements, fournisseurs ou projets Railway. Aucune génération payante ni publication réelle effectuée.

La reprise a retrouvé deux commits après le précédent compte rendu, dont `b9a4ac42a2d3f7d53f24dc2721e9dfbfa4e51957`. Ils avaient déjà ajouté les routes studio, le composant hôte, le canal vers les API existantes et la compilation du studio dans le Dockerfile. Leur build Caléonis `36755662495` était réussi, mais leur test navigateur `36755662398` avait échoué. Ces changements ont été conservés, pas recréés.

## Studio réellement utilisé

La base demeure l'application complète `TechBeme/open-higgsfield`, sous-module `vendor/open-higgsfield` figé sur `1df1148e46d1b47d29e117b7bb1971a65c4286ee`.

Le build embarqué reprend les composants originaux CommandBar, sélecteurs/réglages des modèles, ResultsGrid et aperçus avec leurs dépendances et styles. Il adapte StudioShell pour les projets Caléonis et ajoute une première traduction française. Le studio maison précédemment préparé n'est pas monté comme interface de référence.

L'interface client est compilée depuis la base complète, mais le serveur global et les routes publiques de génération d'Open-Higgsfield ne sont pas exposés dans Caléonis. Le build vérifie les empreintes des composants critiques et refuse l'inclusion des modules serveur/fournisseur dans le bundle navigateur. La licence MIT amont et les notices sont conservées.

Le studio s'ouvre dans la route `/media/studio/[documentId]` depuis la liste des projets accessible via Médias. Un iframe de même origine isole les styles et les dépendances React du studio ; il ne représente ni une deuxième inscription ni un SaaS indépendant. Cette isolation de présentation n'est PAS une frontière de sécurité : les routes de l'API Caléonis restent responsables de l'authentification, des rôles et de l'organisation.

Higgsfield officiel demeure une intégration externe facultative. Aucun compte Higgsfield n'est requis pour préparer et sauvegarder un projet.

## Ajouts de cette reprise

- Sauvegarde du brief et du mode Image/Vidéo avec le numéro de version du projet.
- Sauvegarde des choix des modèles image/vidéo, de leurs réglages et de la résolution dans `data.studioSettings`.
- Sélection de jusqu'à huit références déjà enregistrées dans la médiathèque de l'entreprise. Leurs identifiants sont sauvegardés dans le projet.
- Réouverture du projet restaurant le brief, le mode, les réglages et les références sélectionnées.
- Détection des modifications non enregistrées et maintien du contrôle de version concurrente existant.
- Canal de communication limité à des opérations connues, une fenêtre et une origine attendues ; aucun identifiant de projet ou d'organisation fourni par l'iframe ne remplace celui de l'hôte.
- Stabilisation du gestionnaire asynchrone de l'hôte et limitation des requêtes simultanées du canal.

Le catalogue et la galerie d'origine sont conservés. Cette livraison ne valide pas la génération avec tous leurs modèles, ni l'affichage de tous les cas de galerie remplie.

## Données et limites

Les réglages passent par l'API de documents existante et sont validés côté serveur : format versionné, longueur bornée, clés attendues, rejet des objets profonds et champs d'identité, de secrets ou de routage dans les réglages personnalisés. Ce sont des préférences d'interface, pas des paramètres fournisseur directement exécutables. Un futur adaptateur doit encore vérifier les capacités effectives du modèle au moment de générer.

Les références restent les `referenceIds` existants, dont l'appartenance à l'entreprise est vérifiée dans le parcours serveur existant. Les tests du présent lot vérifient aussi la persistance et les frontières d'organisation dans le dépôt PostgreSQL, mais pas l'intégralité de ce parcours HTTP avec deux utilisateurs authentifiés.

Ce lot n'ajoute pas de schéma SQL : `studioSettings` est une valeur JSON sérialisée dans le document versionné existant. La base de production n'a pas été migrée.

La fenêtre Médiathèque propose actuellement les quarante médias récents du service existant. La pagination avancée, le filtrage par rôle de référence (première image, dernière image, mouvement, etc.) et l'envoi des médias au fournisseur restent à compléter.

Les fichiers déposés directement dans les contrôles du modèle sont encore temporaires : ils ne sont pas annoncés comme sauvegardés. Les références persistantes se sélectionnent parmi les médias préalablement enregistrés.

La confidentialité des URL des médias existants n'est pas modifiée. Aucune promesse de stockage privé ou de révocation immédiate des URL n'est ajoutée par ce lot.

## Génération : désactivée, pas simplement en attente d'une clé

Le bouton Générer est désactivé dans les deux modes. Les routes génératives originales ne sont pas relayées par le canal et leur transport navigateur retourne une indisponibilité. Le code fournisseur n'est pas embarqué dans le client.

Il reste du raccordement de code entre les paramètres/références du studio, les adaptateurs de génération et la réservation Caléonis avant que l'ajout de clés puisse rendre les générations actives. Le prototype d'adaptateur natif et ses fichiers Temporal ne sont pas enregistrés par ce lot. Les anciennes écritures API/Temporal bloquées n'ont pas été réessayées.

## Vérifications terminées

Workflow `Caleonis embedded upstream studio`, run **36764711935**, commit `e7c754f1384d4adcbe928a8a1ef5cfd50ab8c160` : **SUCCESS**.

Job `110055849311` : tests du canal existant et **37 nouveaux tests** de validation/persistance des réglages réussis ; vérification de types et compilation des véritables composants amont adaptées réussies ; parcours navigateur terminé.

Job `110055849027` : **5 nouveaux tests sur PostgreSQL 17 réel isolé** réussis : sauvegarde des réglages et références, relecture depuis une nouvelle connexion, refus d'accès/écriture par une autre entreprise au niveau dépôt, écritures concurrentes, version antérieure conservée.

Artifact **11119629766**, créé à 19:19:19 UTC, récupéré et inspecté. Les captures `image-studio.png`, `video-studio.png`, `shared-media.png` et `denied-session.png` ont été ouvertes. Elles montrent les vrais composants du studio et de l'hôte avec une API de test, pas une nouvelle version de production.

Le test navigateur saisit le brief, change la résolution, sélectionne un média, sauvegarde, recharge, vérifie la restauration, change de mode, sauvegarde et recharge de nouveau. Il simule ensuite une réponse 403 de l'API et vérifie l'absence de compositeur, puis ouvre directement le document statique et vérifie qu'il ne charge pas un projet sans l'hôte.

Rapport observé :

```json
{
  "originalInterface": true,
  "realHostComponent": true,
  "fixtureBackend": true,
  "imageAndVideoModes": true,
  "briefRestored": true,
  "resolutionRestored": true,
  "referenceIdsRestored": true,
  "modeRestored": true,
  "deniedSessionClosed": true,
  "directDocumentClosed": true,
  "generationRequests": 0,
  "externalRequests": 0,
  "javascriptErrors": 0,
  "writeRequests": 2,
  "productionModified": false,
  "realProviderTest": false,
  "userAcceptanceTest": false
}
```

La persistance navigateur utilise une API mémoire de test ; la persistance PostgreSQL est couverte séparément par les tests ci-dessus. Le refus de session est simulé dans le navigateur : il n'est pas présenté comme une validation de connexion, récupération de compte ou isolation HTTP complète du SaaS.

Le premier essai de ce lot (`36764270141`) avait sélectionné une option 2k absente du premier modèle. L'inspection de l'écran a montré 1k et 1.5k. Seul le test a été corrigé pour sélectionner 1.5k ; aucune capacité du modèle ni assertion de restauration n'a été supprimée.

Le workflow de compilation Caléonis complet `36764711895`, job `110055966915`, a déjà réussi les tests Higgsfield/cookies/marque existants, TypeScript et les compilations backend/orchestrateur. Au dernier contrôle pendant la rédaction, le frontend était encore en cours : vérifier sa conclusion finale avant fusion. Le succès du build embarqué ne remplace pas ce contrôle.

## Suite

Raccorder les fournisseurs configurés et les paramètres de chaque modèle aux tâches Caléonis, conserver les garde-fous de coût et de version, attacher les médias aux rôles attendus, puis relier les résultats à la campagne et à la médiathèque. Ne pas reconstruire les contrôles du studio amont.

Avant déploiement : terminer les vérifications de compilation, l'intégration API et le contrôle d'authentification en environnement isolé, puis préparer sauvegarde/restauration. L'activation des fournisseurs, les essais de qualité réels et la batterie complète de recette restent ultérieurs. Aucun test manuel intermédiaire n'est demandé au propriétaire.
