# Caléonis Marketing — direction produit et studio créatif

Date : 30 septembre 2026.
Statut : CONCEPTION, pas un compte rendu de fonctionnalités déployées.

## Rectification et décisions du propriétaire

Le propriétaire confirme voir les cartes du dernier écran livré, mais souhaite une organisation différente : Higgsfield doit simplement être une application facultative dans Intégrations ; Médias doit porter un bouton ouvrant le vrai Studio créatif. Il ne souhaite pas une application « Apps créatives » distincte remplaçant le catalogue d'intégrations.

La terminologie « studio natif Postiz » utilisée dans les documents précédents est trop large : l'agent, les fonctions de génération et l'éditeur d'image existants ne constituent pas le studio complet attendu. La carte ajoutée précédemment pointait notamment vers les médias et le calendrier. Ne pas la présenter comme un studio déjà livré.

Caléonis Marketing reste un SaaS autonome, utilisable sans Caléonis OS. Le studio sera une fonction native de Marketing. L'interface et l'agent utiliseront les mêmes projets, médias, droits et services de génération. Higgsfield officiel restera un fournisseur externe optionnel, non une dépendance obligatoire.

Le propriétaire souhaite concevoir l'application de façon cohérente avant sa recette utilisateur. Les tests techniques, de types, de sécurité et d'intégration restent continus pendant le développement. La batterie utilisateur de bout en bout intervient après implémentation du périmètre retenu et configuration des services. Ne plus demander de valider chaque carte intermédiaire.

## Navigation cible — à implémenter

Accueil ; Campagnes ; Calendrier / Publications ; Médias ; Agent marketing ; Résultats ; Intégrations ; Paramètres.

L'identité de l'entreprise et ses offres sont configurées à l'onboarding puis accessibles dans Paramètres > Entreprise. Les petites configurations s'ouvrent en fenêtres ou panneaux. Le studio utilise un espace large ou une modale plein écran adossée à une route réouvrable.

- `/third-party` : catalogue d'intégrations avec Higgsfield parmi les autres applications. Les cartes gèrent connexion, droits, état et déconnexion, pas un second parcours de génération.
- `/media` : médiathèque commune avec « Ouvrir le Studio créatif » et « Créer à partir de ce média ».
- `/media/studio` et `/media/studio/[projectId]` : routes proposées, non créées par ce document. Sauvegarde serveur, références, versions, formats, résultats et retour en médiathèque.
- Campagnes et Agent peuvent ouvrir ou commander les mêmes projets du studio, avec leur contexte.

## Base open source présélectionnée — non intégrée

Recommandation : évaluer **TechBeme/open-higgsfield** comme base du studio image/vidéo multi-fournisseurs. C'est un projet indépendant de Higgsfield officiel. README, LICENSE, documentation d'architecture et registre de fournisseurs ont été lus. La licence est MIT. Le registre contient Freepik, Google AI Studio, Google Vertex et Vercel AI Gateway ; Higgsfield officiel doit être relié à notre adaptateur existant, pas supposé présent dans ce registre.

Le projet documente Next.js / React / TypeScript, des contrats de génération normalisés, des capacités par modèle et des tâches asynchrones. Il avertit explicitement de l'absence d'authentification, de limitation du débit et de plafonds de dépenses par utilisateur. Il ne doit pas être exposé tel quel avec une clé payante. Une présélection documentaire n'est ni un audit complet, ni une compilation validée, ni un benchmark de qualité.

Autres bases examinées : Open Generative AI d'Anil-matcha (MIT, composants React réutilisables, mais dépendance MuAPI et gestion de clé navigateur à remplacer), InvokeAI (Apache-2.0, canvas et retouche avancée), ComfyUI (GPL-3.0, moteur privé de workflows ultérieur), Diffusion Studio (MPL-2.0 annoncée par le dépôt officiel, montage à évaluer séparément). Ne pas accumuler ces projets dans la V1 sans besoin démontré.

Jaaz n'est pas retenu comme base librement modifiable : son fichier de licence actuel impose une licence commerciale pour modification, redistribution et hébergement d'équipe. Vérifier aussi les licences des modèles, actifs, polices et dépendances effectivement incorporés. Le MIT d'une brique n'annule pas les obligations AGPL du fork Postiz. L'éditeur Polotno existant nécessite une vérification distincte de ses conditions commerciales.

## Qualité et studio attendu

Image : brief, références autorisées, retouche, variantes, formats, comparaison, texte et logo éditables, export et rattachement campagne.

Vidéo : texte/image vers vidéo, paramètres réellement pris en charge, aperçu, suivi et export ; audio, scènes, sous-titres et montage exposés seulement lorsqu'ils sont effectivement implémentés.

Un logiciel de studio open source n'inclut pas les modèles propriétaires ni tous les presets Higgsfield. « Natif » désigne l'expérience Caléonis, pas nécessairement un modèle développé ou auto-hébergé par Caléonis. L'objectif de qualité comparable doit être mesuré sur des briefs identiques : fidélité produit, marque, réalisme, lisibilité, stabilité vidéo, vitesse et coût par rendu exploitable. Aucune équivalence de qualité ou génération gratuite ne doit être annoncée sans mesure.

## Architecture et données

Conserver l'authentification et les organisations existantes. Aucune seconde inscription ni bibliothèque indépendante pour le studio. Réutiliser PostgreSQL pour projets, versions, tâches, autorisations et coûts ; Temporal pour les traitements longs ; Redis pour cache/verrous, pas comme unique historique métier.

Objets cibles : BrandProfile, Offer, Campaign, CreativeProject, CreativeJob, AssetVersion, ProviderConnection, ModelCapability, Approval, UsageLedger et AuditEvent, liés à l'organisation déterminée côté serveur.

Séparer la création de la publication. Une approbation porte sur une version précise ; modifier contenu, canal, date ou dépense invalide l'autorisation concernée. Plafonds par organisation et mission, credentials chiffrés et rotatables côté serveur, import contrôlé, médias privés par défaut, traces sans secrets. Aucun nouvel achat automatique après une réponse payante ambiguë. Pas de garantie exactement-une-fois chez un fournisseur qui ne l'assure pas.

Concevoir les extensions publicité, e-mail/SMS, SEO, web, avis et transfert CRM ; ne pas les annoncer opérationnelles avant leurs connecteurs. Ne pas recréer les devis et la négociation commerciale dans Marketing.

## Recette prévue

Préparer un environnement isolé avec comptes de test, e-mail, provider image/vidéo, stockage, rôles, quotas, sauvegardes et comptes sociaux autorisés. Higgsfield reste facultatif. Les connecteurs non configurés ne doivent pas sembler actifs.

La matrice initiale préparée comprend 100 scénarios à exécuter, répartis en dix familles de dix : accès/compte ; entreprise/équipe ; intégrations ; studio ; tâches/coûts ; médias ; campagnes/approbations ; calendrier/publication ; agent ; exploitation transversale. Décliner ensuite par rôle, fournisseur, canal et navigateur. Chaque test exige version, résultat observé et preuve ; une compilation ou un HTTP 200 ne suffit pas.

Critères bloquants : fuite inter-organisation, secret exposé, dépassement de dépense non autorisé, publication différente de la version approuvée, perte de médias, récupération de compte défaillante, absence de restauration testée ou fonction annoncée mais inactive.

## Sources primaires

- https://github.com/TechBeme/open-higgsfield
- https://github.com/TechBeme/open-higgsfield/blob/main/LICENSE
- https://github.com/TechBeme/open-higgsfield/blob/main/docs/architecture.md
- https://github.com/TechBeme/open-higgsfield/blob/main/src/providers/registry.ts
- https://github.com/Anil-matcha/Open-Generative-AI
- https://github.com/Anil-matcha/Open-Generative-AI/blob/main/packages/studio/package.json
- https://github.com/Anil-matcha/Open-Generative-AI/blob/main/components/StandaloneShell.js
- https://github.com/invoke-ai/InvokeAI
- https://github.com/Comfy-Org/ComfyUI
- https://github.com/diffusionstudio/editor
- https://github.com/11cafe/jaaz/blob/main/LICENSE
- https://polotno.com/sdk/pricing

Cette mise à jour n'importe aucun nouveau studio, ne modifie pas la navigation déployée, ne configure aucun fournisseur et ne lance aucun test payant ou publication. L'état technique déployé reste distinct de cette cible produit.
