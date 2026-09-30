# Caléonis Studio — reprise complète d'Open-Higgsfield

État vérifié : 30 septembre 2026. Branche : `feat/marketing-workspace-v1`.

## Décision de développement

Reprendre l'application complète **TechBeme/open-higgsfield**, plutôt que reconstruire son interface à partir de quelques composants. Cette décision remplace la trajectoire d'interface maison décrite dans CALEONIS_NATIVE_STUDIO_PROGRESS.md. Le composant CreativeStudio précédemment écrit reste un prototype non monté ; il ne constitue plus l'interface de référence du studio V1.

Conserver les développements Caléonis utiles : profils de marque, campagnes, projets versionnés, contrôle des organisations, réservations de génération et connecteur Higgsfield officiel. Ne pas jeter ces protections pour démarrer plus vite. Ne pas réécrire les sélecteurs, réglages et galeries déjà présents en amont.

## Base complète effectivement ajoutée

- Chemin : `vendor/open-higgsfield`, sous-module Git public, pas une copie partielle de composants.
- Dépôt amont : `https://github.com/TechBeme/open-higgsfield`.
- Version figée : `1df1148e46d1b47d29e117b7bb1971a65c4286ee`.
- Commit Caléonis ajoutant la base : `931dbc2f6a99aac7aa679aaf1e495160e693a4fe`.
- Les **160 fichiers suivis** de ce projet ont été récupérés ensemble et son application a été compilée avec son propre package-lock. La licence MIT d'origine reste dans le sous-module, ainsi que ses notices. Les autres mentions de licence Caléonis/Postiz ne sont pas supprimées.
- Le sous-module est une référence à cette version complète ; il n'est pas automatiquement mis à jour vers le dernier main amont. Initialisation : `git submodule update --init -- vendor/open-higgsfield`.

Le projet indépendant Open-Higgsfield n'est pas le code source de Higgsfield officiel. Il fournit une application de génération multi-fournisseurs, pas les modèles propriétaires ni les crédits payants de ces fournisseurs.

## Vérifications exécutées sur l'application d'origine

Workflow `Caleonis complete upstream studio`, run `36750081004`, job `110006143635` : **SUCCESS**. Récupération de la version figée, installation des dépendances verrouillées, lint, TypeScript, compilation complète et démarrage HTTP à `/en` réussis. Artifact `11114595731` récupéré et inspecté ; il confirme HTTP 200 sans credentials fournisseur. L'application est restée sur l'interface loopback du runner.

Workflow `Caleonis upstream studio interface`, run `36750999411`, job `110009283770`, commit `7f6553d20eec2be6b8036d66b4cb1ba2fbb464ba` : **SUCCESS**. Artifact `11113854005`, créé à 17:24:26 UTC, récupéré et inspecté. Le navigateur agent-browser a ouvert le vrai studio compilé, confirmé le champ image, cliqué sur le bouton Video et confirmé le champ vidéo. Les captures image-studio.png et video-studio.png ont été ouvertes et examinées. Le fichier browser-errors.txt est vide.

Rapport réellement obtenu :

```json
{
  "original_interface": true,
  "image_mode": true,
  "video_mode": true,
  "image_catalog_entries": 17,
  "video_catalog_entries": 23,
  "generation_requests": 0,
  "provider_credentials_used": false,
  "production_modified": false,
  "user_acceptance_test": false
}
```

Ce sont des entrées de catalogue disponibles dans le code, pas 40 générations validées ni 40 accès fournisseur activés. Aucun rendu image ou vidéo payant n'a été commandé. La qualité, le coût réel, la fidélité produit et tous les paramètres de chaque modèle restent à tester après configuration.

Le premier essai navigateur `36750457490` avait échoué avant navigation : le chemin standard `.next/standalone/server.js` n'était pas celui produit dans ce monorepo. Le lanceur `var/caleonis/upstream-studio/start-standalone.mjs` utilise désormais le manifeste Next généré pour trouver le serveur et y copier les assets. Il refuse de démarrer sans activation explicite du mode aperçu et en présence de credentials fournisseur ou de DATABASE_URL ; écoute uniquement 127.0.0.1. Trois assertions locales ont vérifié un serveur racine, un serveur imbriqué et le rejet d'un chemin sortant du build. Ce lanceur n'est pas une configuration de production.

## Limites actuelles et raccordement à réaliser

La base complète est récupérée et exécutable en environnement isolé. Elle n'est **pas encore montée dans les routes Caléonis**, n'a pas été fusionnée dans main et n'a pas été déployée sur Railway. Les captures montrent l'interface amont avant personnalisation Caléonis, pas une nouvelle version publique de Marketing.

Les changements de raccordement API/Temporal précédemment bloqués n'ont pas été réessayés via ce lot. Le présent travail ajoute et vérifie une base complète indépendante ; il n'active pas les routes ni les fournisseurs du prototype antérieur.

Réutilisation cible :

| Conserver d'Open-Higgsfield | Relier ou adapter dans Caléonis |
| --- | --- |
| StudioShell, CommandBar, sélecteurs et réglages, galerie et aperçus | Entrée Médias > Studio, identité Caléonis et traduction française |
| Catalogue de capacités, formats et références, adaptateurs de fournisseurs | Connexions gérées dans Intégrations et seuls modèles réellement configurés présentés comme utilisables |
| Contrats de génération et de résultats | Sessions, organisations, projet et campagne, consentement et limites avant chaque achat |
| Fonctions de génération image et vidéo existantes | Historique durable par entreprise, médiathèque commune, reprise et supervision des tâches |

Le README amont prévient de l'absence d'authentification, de limitation de requêtes et de budgets par utilisateur. La lecture du code confirme un historique global (`src/lib/task-store.ts`) sans filtre d'organisation. `src/lib/generation-service.ts` appelle le fournisseur avant d'enregistrer la tâche ; conserver la réservation préalable Caléonis plutôt que reprendre ce comportement pour un SaaS partagé. L'interface complète est réutilisée ; ces protections et liens métier sont du travail d'intégration, pas une raison de reconstruire chaque écran.

Higgsfield officiel reste un connecteur facultatif parmi les applications. Le studio doit rester accessible depuis Médias, sans deuxième inscription ni bibliothèque indépendante visible par l'utilisateur. Le montage vidéo multipiste, toutes les fonctions premium Higgsfield et le département marketing entier ne sont pas fournis automatiquement par cette base.

## Configuration, livraison et tests utilisateur

Aucun nouveau service Railway, abonnement, fournisseur, secret, compte utilisateur ni canal social n'a été configuré dans ce lot. Aucun déploiement Caléonis Réception ni Marketing n'a été modifié. Les tests réalisés ici sont des contrôles de la base technique ; la recette complète du produit reste prévue après raccordement du périmètre retenu et configuration, sans demander au propriétaire de valider chaque panneau intermédiaire.

Le filtre du workflow Build a également été corrigé de `/*.md` à `*.md` pour éviter une recompilation complète lors des mises à jour limitées aux documents Markdown à la racine. Les contrôles de code, de pull request et de merge-group restent actifs. Les succès du studio ci-dessus ne sont pas présentés comme une nouvelle compilation complète de tous les composants Caléonis sur le dernier commit.
