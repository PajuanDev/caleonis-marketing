# Caléonis Marketing — studio image natif, lot en développement

État au 30 septembre 2026. Branche `feat/marketing-workspace-v1`.
Commit de code : `7a2c156ded5c6aead9b980951a1e24ffeee37f33`.

## État de livraison

Le code ci-dessous est enregistré sur la branche de développement. Il n'est pas fusionné dans main et n'est pas déployé sur Railway. Les écrans publics, les secrets, les abonnements et Caléonis Réception n'ont pas été modifiés par ce lot. Aucune génération payante, connexion fournisseur ou publication n'a été exécutée.

IMPORTANT : les composants natifs sont préparés mais NON RACCORDÉS. L'écriture groupée de trois fichiers de raccordement (module API, contrôleur Workspace, configuration des workers Temporal) a été bloquée par le contrôle de sécurité de l'outil. Cette écriture n'a pas été réessayée ou contournée. Les modifications dépendantes du service Studio, du module orchestrateur et de l'index des workflows ont été laissées à leur version précédente ; les routes existantes n'ont pas été remplacées par le nouveau composant. Le catalogue Intégrations et les espaces métier déjà préparés dans le lot précédent sont conservés.

## Code ajouté

### Interface créative

Nouveau composant React `CreativeStudio` et styles dédiés : projets latéraux, grand aperçu, brief, suggestions de point de départ, réglages compacts en fenêtres, sélection des photos de la médiathèque, choix moteur natif/Higgsfield, contexte campagne, galerie et historique des versions. La reprise d'une version prépare un brouillon. Toute modification annule le consentement précédent. Les réponses incertaines et les plafonds non configurés bloquent les nouvelles demandes dans cette interface.

Le composant reste isolé, sans être monté dans les routes de l'application. L'interface existante `/media/studio` reste celle du lot précédent. L'aperçu n'est pas un second SaaS ni une application de production.

La reprise open source se poursuit avec le composant de réglages `PillPopover` de TechBeme/open-higgsfield, sous MIT, blob `d5fb4de683ffbb88bc1aff0528dff295be3dabc9`, adapté pour les styles Caléonis et le clavier. La notice complète est conservée dans THIRD_PARTY_NOTICES_CALÉONIS.md. Il ne s'agit toujours pas de la reprise de tous les écrans ou des modèles propriétaires de Higgsfield.

### Adaptateur image natif

Transport serveur vers l'API image OpenAI : texte-vers-image et édition avec fichiers PNG, JPEG ou WebP réellement joints. Maximum quatre références, 10 Mo chacune et 20 Mo au total. Seize combinaisons de dimensions en deux niveaux, et trois qualités. Liste de modèles autorisés côté serveur ; aucun endpoint arbitraire ou paramètre de modération fourni par le navigateur n'est transmis.

Les références sont autorisées par organisation dans le service, puis lues uniquement dans le stockage local attendu : contrôle d'origine et de chemin réel, taille bornée, signature de fichier. Le stockage objet distant n'est pas couvert pour les références par ce premier adaptateur.

Chaque transport effectue un seul POST, sans redirection ni nouvelle tentative payante automatique. Les erreurs externes et secrets ne sont pas exposés. Réponse limitée en taille et contrôlée avant stockage. Usage en tokens et identifiant de requête sont récupérés lorsqu'ils sont disponibles ; ce n'est pas un prix réel en euros.

Le service préparé fige le contexte de marque/campagne et vérifie les droits administrateur avant l'exécution. Le schéma PostgreSQL reçoit une colonne usage additive ; les nouvelles méthodes de réservation et de prise en charge atomique évitent que deux workers prennent la même tâche. Les fichiers d'activité/workflow Temporal sont écrits mais ne sont pas enregistrés dans l'orchestrateur. Les projets existants avec une connexion Higgsfield conservent ce choix ; le nouveau contrat propose le moteur natif pour les nouveaux projets.

« Natif » désigne l'expérience Caléonis : le modèle reste fourni par API OpenAI. La qualité réelle, la fidélité produit et une équivalence avec Higgsfield n'ont pas été mesurées. Le moteur ne fonctionne pas encore de bout en bout dans l'application tant que le raccordement manque.

## Vérifications effectuées

Sur le commit de code indiqué :

- Workflow `Caleonis workspace safety`, run `36748410187`, terminé avec succès. Job domaine `110000418359` : 76 tests (36 de contrats métier et 40 du transport image avec réseau simulé). Job base `110000418542` : 12 scénarios PostgreSQL 17 réel isolé, puis un scénario supplémentaire de conservation après `prisma db push`, soit 13.
- Workflow Build `36748410165`, job `110000417144` : 20 tests Higgsfield simulés et 9 tests marque/cookies réussis ; contrôle TypeScript et compilations backend/orchestrateur réussis. Au dernier contrôle pendant la rédaction, la compilation frontend était encore en cours ; vérifier la conclusion finale du run avant toute fusion.
- Total des tests techniques réussis : 76 + 13 + 29 = 118. Ce n'est ni la recette des 100 scénarios utilisateur ni un test HTTP multi-entreprises de bout en bout.
- Workflow `Caleonis studio preview`, run `36748410285`, job `110000418389` : bundle du véritable composant React et de ses styles réussi avec adaptateurs de test. Artifact `11113970699` téléchargé. Aucune donnée ou clé de production dans cet aperçu.
- La tentative de navigation locale avec Chromium a été bloquée avant l'ouverture de la page par `ERR_BLOCKED_BY_ADMINISTRATOR`. Aucun contrôle visuel ni scénario interactif n'est donc annoncé comme passé et aucune capture du studio fonctionnel n'a été validée. La conclusion SUCCESS du bundle ne constitue pas une validation navigateur.

## Suite nécessaire

Terminer le raccordement par une opération autorisée, vérifier les routes et les autorisations, puis l'affichage réel des nouveaux écrans. Conserver le moteur désactivé et le plafond nul jusqu'à configuration explicite. Tester ensuite en environnement isolé la reprise Temporal, l'annulation des droits, le stockage des sorties et l'intégration aux campagnes. Les contrôles de dépenses monétaires, les sauvegardes/restaurations, le chiffrement modernisé, la confidentialité des médias existants, la vidéo, le montage et la recette complète restent distincts et non livrés par ce lot.

Aucun test manuel intermédiaire n'est demandé au propriétaire. La recette utilisateur complète reste prévue après développement cohérent et configuration.
