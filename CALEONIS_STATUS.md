# Caléonis Marketing — état du bootstrap initial

## Code effectivement enregistré

Dépôt : PajuanDev/caleonis-marketing, branche main.
Base amont au moment du fork : 9efa1f553c610eb4fffe6bdde48b420c8a9f4858.
Premier commit d'identité : 8fd1753f8d406f071b75c3729cca89163050d0ce.
Commit de l'interface et du déploiement : 9ec6b67fa077b14035a2869c12fb56748497454f.

- Identité Caléonis centralisée, écran de connexion, marque dans la navigation et favicon.
- Retrait des témoignages et du chiffre de clients de Postiz dans notre écran de connexion.
- Liens visibles vers le code source, LICENSE et historique amont conservés.
- Dockerfile.caleonis et railway.toml ajoutés pour compiler le véritable logiciel.
- Supervision du frontend, du backend et de l'orchestrateur ; endpoint de disponibilité /healthz.
- Refus du démarrage sans variables indispensables et sans volume /uploads en stockage local.
- Initialisation Prisma sans acceptation automatique de perte de données.

Il s'agit d'un premier rebranding, pas d'un audit exhaustif de toutes les références Postiz ni d'une V1 commerciale validée.

## Vérifications réellement exécutées

Les fichiers brand-routes.mjs et health.cjs ont été reproduits dans l'environnement local de vérification et testés avec Node 22.16.0, sans services externes.

```sh
node --test var/caleonis/brand-routes.test.mjs var/caleonis/health.test.cjs
```

Résultat du runner : 8 tests, 8 pass, 0 fail (le total inclut le test parent du groupe readiness).

Vérifications : remplacement ciblé des noms d'affichage, idempotence, conservation des identifiants techniques et des attributions ; HTTP 503 si les dépendances simulées manquent ou si le contrôle Temporal simulé échoue, HTTP 200 si les trois services simulés répondent, HTTP 404 pour les autres routes du serveur de contrôle.

Ces tests locaux utilisent des serveurs HTTP factices. Ils ne valident pas une connexion réelle à PostgreSQL, Redis ou Temporal, ni une publication sur un réseau social.

## Blocages Railway observés

1. L'agent d'infrastructure a refusé la préparation des volumes et bases avec :
   `Agent usage limit reached. Update your limit in usage settings.`
2. La création directe du service depuis le dépôt a été refusée avec :
   `Free plan resource provision limit exceeded. Please upgrade to provision more resources!`

Le statut a ensuite été relu : le projet caleonis-marketing existe, mais la liste des services est vide. Aucun service, bucket ni déploiement applicatif n'a été créé par cette tentative. Aucun changement de formule ou de plafond budgétaire n'a été effectué.

La construction complète n'a donc pas été lancée sur Railway. Aucune validation TypeScript globale, aucun test navigateur et aucun test de publication réelle ne sont revendiqués. Il n'existe pas encore d'URL applicative fonctionnelle pour Marketing.

## Prochaine étape

Résoudre le quota de ressources de l'espace Railway concerné, puis créer les bases persistantes et le service applicatif. L'ajout de volumes depuis l'interface Railway reste une solution au blocage de l'agent : augmenter le budget Agent n'est pas un prérequis technique pour utiliser des volumes.

Ensuite seulement : construire, examiner les journaux, vérifier /healthz, ouvrir l'accès de manière contrôlée, connecter les services IA/OAuth et tester une publication explicitement autorisée. Ne pas modifier ou supprimer Caléonis Réception pour faire de la place.
