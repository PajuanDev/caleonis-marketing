# Caléonis Marketing — raccordement image / vidéo du studio

État du 30 septembre 2026. Branche : `feat/marketing-workspace-v1`.
Dernier code de ce lot : `fc5b6559243fa88908260ab2ef089dde6c3de1ba`.
Les commits documentaires suivants ne changent pas ce code testé.

## Livraison

**Code enregistré sur la branche de développement, sans fusion dans main ni déploiement Railway.** Aucun secret, abonnement, compte fournisseur, service Railway ou compte utilisateur n'a été ajouté ou modifié. Aucun rendu payant et aucune publication sociale n'ont été commandés. Caléonis Réception est inchangé.

Le lot précédent raccordait l'interface et les sauvegardes. Ce lot raccorde un premier parcours de génération aux routes existantes du studio. L'activation reste fermée par défaut. Les captures de test ne montrent pas une nouvelle version disponible à l'adresse de production.

## Réutilisation effective d'Open-Higgsfield

La base reste le sous-module complet `TechBeme/open-higgsfield`, figé sur `1df1148e46d1b47d29e117b7bb1971a65c4286ee`. Le studio conserve CommandBar, les sélecteurs, réglages, ResultsGrid et aperçus d'origine. Il n'est pas remplacé par le prototype de studio maison.

Le runtime serveur compile le véritable `FreepikProvider` et les véritables `FluxAdapter` / `LtxAdapter` de cette version. `upstream-hashes.json` vérifie les empreintes des fichiers repris. Les notices MIT sont conservées et copiées avec les bundles. Les routes publiques et l'historique global du serveur amont ne sont pas repris pour notre SaaS multi-entreprises.

Deux modèles seulement sont autorisés dans ce premier raccordement :

| Modèle | Périmètre relié |
| --- | --- |
| FLUX 2 Pro | Texte vers image et jusqu'à quatre références image ; formats et résolutions acceptés par son adaptateur, graine et amélioration facultative du brief. |
| LTX 2.0 Pro | Texte vers vidéo ou image initiale vers vidéo ; une référence au maximum, durées 6 / 8 / 10 secondes, résolutions 1080p / 1440p / 2160p, options audio et 25 / 50 images par seconde. |

Les autres entrées du catalogue restent consultables, mais ne peuvent pas lancer une création dans ce lot. La présence d'un modèle dans le sélecteur ne signifie pas que son accès fournisseur est configuré ou ses rendus testés.

## API et fournisseurs

Le code d'origine appelle son fournisseur `FreepikProvider`. Le transport Caléonis utilise l'origine et l'en-tête documentés actuellement : `https://api.magnific.com` et `x-magnific-api-key`. Il corrige aussi le champ `image` de l'adaptateur LTX en `image_url`, attendu par l'API image-vers-vidéo.

Références primaires vérifiées :
- https://docs.magnific.com/authentication
- https://docs.magnific.com/api-reference/text-to-image/post-flux-2-pro
- https://docs.magnific.com/api-reference/image-to-video/ltx-2-pro
- https://docs.magnific.com/api-reference/text-to-video/ltx-2-pro

Les identifiants ne sont pas changés dans process.env pour chaque utilisateur : un contexte asynchrone isolé fournit la clé à chaque appel serveur. Le transport accepte seulement les routes relues et les identifiants de tâches valides, borne les requêtes et réponses, ne suit pas les redirections et ne réessaie pas un POST payant. Les erreurs exposées ne contiennent ni corps brut fournisseur ni clé. Les options de désactivation de protection ne sont pas transmises.

**Ce premier raccordement prévoit un compte Magnific configuré côté serveur, pas une nouvelle carte BYOK par entreprise.** Aucune clé n'a été ajoutée ou activée. La connexion par client reste à développer. Higgsfield officiel conserve son connecteur externe facultatif existant ; ce lot n'étend pas son choix dans les sélecteurs du nouveau studio. Le prototype OpenAI et ses fichiers Temporal restent non enregistrés comme moteur du parcours présent.

## Parcours raccordé dans le code

Le canal entre le studio et Caléonis ajoute des opérations bornées de génération, suivi et import. Il ne transmet pas les anciennes routes de génération anonymes de l'application amont. Le projet est imposé par la route de l'hôte ; l'organisation vient de la session contrôlée par l'API.

Le bouton Générer ouvre une fenêtre indiquant le modèle, la version du projet, le nombre de références, le fournisseur et le caractère payant. Une case d'autorisation explicite est requise. Toute modification du brief ou des réglages invalide l'autorisation précédente. Les modifications non sauvegardées et les fichiers temporaires bloquent la génération. Le serveur utilise la version enregistrée, pas un corps fournisseur arbitraire reçu du navigateur.

Le parcours passe par l'endpoint de génération déjà authentifié et réservé aux administrateurs. Le corps accepte uniquement la source fixe du studio, le numéro de version, l'identifiant de demande et l'autorisation. Les contrôles existants d'organisation et de rôle sont conservés.

Chaque référence est vérifiée dans la médiathèque de l'entreprise avant lecture. Ce raccordement ne lit que les références du stockage local attendu, avec contrôle du chemin réel, de l'origine, de la signature et de la taille. Maximum 10 Mo par référence et 20 Mo au total. Pour LTX, la première image doit également disposer d'une URL HTTPS accessible au fournisseur. La confidentialité des anciennes URL médias n'est pas modifiée.

## Historique durable et prévention des doublons

La réservation PostgreSQL est créée **avant** le POST fournisseur et rattachée à l'entreprise, au projet, à sa version et au compte API. Le plan exact transmis est conservé. Une même demande ne peut pas être réservée deux fois. Une autre demande pour le même projet est bloquée tant qu'une tâche de ce moteur est en cours ou incertaine.

L'identifiant fournisseur, l'opération de suivi et les résultats terminés sont enregistrés dans la nouvelle colonne JSONB `providerState`. Cette modification de schéma est additive, transactionnelle et rejouable ; elle n'a pas été exécutée sur la base de production.

Le suivi utilise uniquement un GET fournisseur. Une réponse tardive ne peut pas rétrograder un résultat terminé. Un changement de compte API est détecté par son empreinte. Le suivi est rafraîchi explicitement : **aucun worker autonome Temporal n'actualise ou n'importe ces tâches en arrière-plan dans ce lot**.

L'import volontaire réclame d'abord la tâche de manière atomique, puis télécharge le résultat via le contrôle anti-SSRF et le résolveur DNS sécurisé existants. Pas de redirection, taille bornée, vérification du format réel. La création de l'entrée de médiathèque et son rattachement à la tâche sont ensuite réalisés dans une même transaction PostgreSQL. Le type image ou video est conservé, au lieu du type image par défaut du chemin générique.

Un import interrompu reste marqué à vérifier plutôt que d'être exécuté de nouveau automatiquement. Le stockage du fichier et PostgreSQL ne forment pas une transaction unique : un arrêt peut laisser un fichier orphelin. La réconciliation administrative et le nettoyage restent à compléter ; aucune garantie absolue d'exécution exactement une fois n'est annoncée.

## Activation fermée par défaut

Pour activer ce chemin après validation : runtime serveur compilé, `MAGNIFIC_API_KEY`, `CALEONIS_UPSTREAM_STUDIO_ENABLED=true` et `CALEONIS_CREATIVE_DAILY_LIMIT` supérieur à zéro. Ces réglages n'ont pas été activés dans Railway.

Le plafond actuel compte les demandes par entreprise sur 24 heures glissantes. Ce n'est **pas un plafond monétaire**, ni un mécanisme couvrant tous les appels IA de Postiz. Le prix précis et la facturation Caléonis ne sont pas calculés par ce lot. Le dialogue l'indique au lieu d'afficher une estimation inventée.

## Vérifications terminées

### Adaptateurs réels, réseau simulé

Workflow `Caleonis upstream provider runtime`, run **36773924008**, job **110086953665**, commit final de code : **SUCCESS**.

**43 tests** sur le véritable bundle serveur : paramètres image/vidéo, références, correction image_url, routes interdites, erreurs, réponse trop volumineuse, absence de nouvelle tentative, séparation des clés de deux contextes concurrents et suivi. Aucun appel au vrai fournisseur. Le précédent bundle du run 36772385486, artifact 11124247621, a aussi été téléchargé, son SHA-256 vérifié et les mêmes 43 tests exécutés localement avec succès.

### PostgreSQL réel isolé

Workflow `Caleonis workspace safety`, run **36773924013**, jobs **110086954236** et **110086954501**, commit final de code : **SUCCESS**.

Les 76 tests métier / transport natif préexistants passent. Le fichier PostgreSQL comporte désormais **19 scénarios**, plus le scénario distinct de conservation après synchronisation du schéma amont. Les nouveaux cas couvrent les réservations concurrentes, le suivi après reconnexion, les frontières d'entreprise au niveau dépôt de données, les réponses tardives, l'import concurrent et le rattachement atomique d'un enregistrement Media de type vidéo. Aucune base client n'est utilisée.

### Interface réelle, API et fournisseur simulés

Workflow `Caleonis embedded upstream studio`, run **36773219471**, jobs **110084567630** et **110084567317** : **SUCCESS**. Commit `302656a343cafbadfa9fbb8ab6ce1c7b829de9de` ; les changements suivants ne modifient pas cette interface ni ses tests navigateur.

**80 tests** de canal et validation des réglages, ainsi que les **5 scénarios PostgreSQL** de persistance des choix du studio, passent. La vérification TypeScript et la compilation des composants amont adaptés passent.

Le navigateur a effectué le parcours de sauvegarde / réouverture existant, puis : ouverture de la confirmation, impossibilité de confirmer sans cocher, annulation sans demande, blocage après modification, sauvegarde, confirmation unique, rechargement sans nouvelle soumission, actualisation et import unique. Ce dernier parcours utilise explicitement des réponses simulées.

Artifact **11124434971** téléchargé et inspecté. SHA-256 vérifié : `5deabada24d41e1db4bae01e3c0b0e5921817d20bc3d25920323840000164e33`. Les captures `generation-confirmation.png` et `generation-imported.png` ont été ouvertes. La seconde montre un média de démonstration, pas un vrai rendu IA.

Rapport obtenu :

```json
{
  "actualUpstreamUI": true,
  "actualHostBridge": true,
  "simulatedBackend": true,
  "simulatedProvider": true,
  "confirmationRequired": true,
  "cancelWithoutSubmission": true,
  "unsavedChangesBlock": true,
  "reloadDoesNotResubmit": true,
  "statusAndImport": true,
  "submissions": 1,
  "syncs": 1,
  "imports": 1,
  "externalRequests": 0,
  "javascriptErrors": 0,
  "realGenerations": 0,
  "productionModified": false
}
```

### Compilation globale — terminée avec succès

Le workflow Build **36773924044**, job **110086954421**, sur `fc5b6559243fa88908260ab2ef089dde6c3de1ba` est terminé : statut **completed**, conclusion **success**. Les 20 tests Higgsfield et les 9 tests cookies / marque, le contrôle TypeScript et les compilations **frontend, backend et orchestrateur** ont tous réussi. La fin des étapes de nettoyage a aussi été vérifiée. Cette compilation complète reste distincte d'un lancement Docker de production ou d'un déploiement Railway, non effectués dans ce lot.

## Limites et suite

La chaîne HTTP avec de vrais comptes distincts, le service réel et un fournisseur de test de bout en bout n'est pas encore validée. Le navigateur, les adaptateurs et PostgreSQL sont vérifiés à des couches distinctes. Aucun rendu réel, coût réel ou niveau de fidélité produit n'a été mesuré.

À compléter avant ouverture commerciale : authentification et permissions de bout en bout, configuration par entreprise / compte fournisseur, budgets monétaires, reprise et réconciliation des erreurs incertaines, suivi autonome, contrôle des autres modèles, stockage objet pour les références, rôles de références vidéo, finition visuelle, sauvegarde et restauration. Le build Docker et le déploiement de cette version restent à valider.

Les résultats rejoignent le projet et la médiathèque ; le rattachement campagne reste celui du projet existant. Le plan marketing, les variantes, leurs validations et le transfert au calendrier doivent encore être approfondis. Le montage vidéo multipiste et l'équivalence de qualité avec Higgsfield ne sont pas livrés par ce raccordement.

Aucun test manuel intermédiaire n'est demandé au propriétaire. La recette complète reste prévue après développement cohérent et configuration.
