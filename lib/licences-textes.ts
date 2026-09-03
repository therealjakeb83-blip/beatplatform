import { NOM_PLATEFORME } from './constantes'

export type TypeLicenceTexte = 'standard' | 'illimite' | 'exclusive'

// 'standard' couvre MP3/WAV/STEMS (même modèle contractuel, seules les
// variables de fichiers/limites diffèrent) — voir licences.modele.
// 'illimite' et 'exclusive' seront ajoutés dans une étape séparée.
export function modeleVersTypeLicenceTexte(modele: string): TypeLicenceTexte {
  if (modele === 'illimite') return 'illimite'
  if (modele === 'exclusive') return 'exclusive'
  return 'standard'
}

// ============================================================
// Modèle par défaut — licence standard (MP3/WAV/STEMS)
// ============================================================
// Basé sur le modèle rédigé par Jake (Template_licence_final_SaaS_style_
// site.docx, version confirmée la plus récente pour cette catégorie),
// ajusté selon 2 décisions prises en cadrant cette phase :
// - ventes numériques et téléchargements promotionnels gratuits retirés
//   (invérifiables, écartés du modèle) ;
// - performances publiques réduites à une simple autorisation booléenne
//   (pas de conditions en texte libre).
//
// Les {{variables}} ne sont PAS résolues ici : contrairement aux CGV
// (résolues au moment où le beatmaker enregistre sa page), une bonne
// partie de ces variables (prix payé, acheteur, titre du beat...) ne sont
// connues qu'au moment de la vente — voir resoudreVariablesLicence, qui ne
// tourne qu'une seule fois, à la génération du PDF de contrat.
export function texteTemplateStandard(): string {
  return `CONTRAT DE LICENCE NON-EXCLUSIVE – {{type_licence}}

Le présent contrat est conclu entre :

{{identite_concedant}}, ci-après dénommé « Le Concédant ».

Et :

{{identite_licencie}}, ci-après dénommé « Le Licencié ».
{{bloc_collaborateurs}}
1. PRÉAMBULE

La présente Licence régit, avec les Conditions Générales de Vente de la boutique {{boutique}}, les conditions applicables à la concession non exclusive de droits sur l'œuvre de musique instrumentale du Concédant, ci-après dénommée « l'Œuvre », en contrepartie du versement d'un prix forfaitaire par le Licencié.

Les Parties déclarent et garantissent avoir préalablement :
• pris connaissance et accepté les Conditions Générales de Vente applicables sur {{boutique}} ;
• pris connaissance et accepté les stipulations spécifiques de la présente Licence.

Le Licencié reconnaît que l'Œuvre et son titre sont protégés par le droit d'auteur.
Tous les droits qui ne sont pas expressément octroyés au Licencié par la présente Licence sont réservés par le Concédant.

2. OBJET DU CONTRAT

Le présent contrat a pour objet l'octroi d'une licence non-exclusive d'exploitation d'une composition musicale proposée par le Concédant, identifiée sous le nom {{titre_beat}}, en contrepartie du montant effectivement payé par le Licencié lors de la commande, soit {{prix_paye}}, après application éventuelle de toute remise, promotion, réduction, avoir, avantage ou offre commerciale applicable au moment de l'achat.

Ce contrat est délivré uniquement pour l'utilisation de l'Œuvre par le Licencié conformément à l'ensemble des conditions énoncées dans le présent document.

La présente Licence autorise le Licencié à incorporer l'Œuvre dans une seule nouvelle création musicale, ci-après dénommée « Nouvelle Œuvre ».

3. LIVRAISON

Dans le cadre de la présente Licence, le Licencié recevra les fichiers suivants : {{fichiers_livres}}.

Les fichiers seront mis à disposition selon les modalités de livraison prévues par la boutique du Concédant après validation et réception de l'intégralité du paiement éventuellement dû par le Licencié.

La date de validation du paiement ou, dans le cas d'une Licence accordée gratuitement, la date de validation de la commande marque également la date de prise d'effet de la présente Licence.

Le Licencié est autorisé à transmettre les fichiers de l'Œuvre uniquement aux personnes participant directement à la création de la Nouvelle Œuvre, notamment un ingénieur du son, musicien, réalisateur artistique, studio d'enregistrement ou autre prestataire technique.
Ces personnes ne bénéficient d'aucun droit personnel d'exploitation sur l'Œuvre et ne peuvent utiliser les fichiers dans un autre projet.
Le Licencié demeure responsable du respect de la présente Licence par toute personne à laquelle il transmet les fichiers.

4. DROITS ACCORDÉS

4.1. Nature de la Licence

La présente Licence est concédée à titre NON-EXCLUSIF, personnel et non-transférable.
Les droits accordés au Licencié sur l'Œuvre sont d'interprétation stricte. Tous les droits qui ne sont pas expressément mentionnés dans la présente Licence demeurent réservés au Concédant.
Le caractère non-exclusif de la présente Licence signifie notamment que le Concédant demeure libre de vendre ou concéder des licences portant sur la même Œuvre à d'autres personnes.

4.2. Création de la Nouvelle Œuvre

Le Licencié dispose du droit non-exclusif d'utiliser tout ou partie de l'Œuvre afin de créer une seule Nouvelle Œuvre.
Dans ce cadre, le Licencié est notamment autorisé à :
• ajouter des paroles et des prestations vocales ;
• ajouter ses propres éléments musicaux ;
• modifier la structure et l'arrangement de l'Œuvre ;
• modifier sa durée ;
• modifier son tempo ;
• modifier sa tonalité ou sa hauteur ;
• couper, réorganiser ou répéter certaines parties de l'Œuvre dans le seul but de créer la Nouvelle Œuvre.
Ces modifications ne confèrent au Licencié aucun droit de propriété sur l'Œuvre instrumentale originale.

4.3. Exploitation de la Nouvelle Œuvre

Sous réserve des droits du Concédant sur l'Œuvre instrumentale préexistante, le Licencié dispose du droit exclusif d'exploiter la Nouvelle Œuvre qu'il a créée dans les limites prévues par la présente Licence.
Cette exclusivité porte uniquement sur la Nouvelle Œuvre propre au Licencié et ne confère aucun droit exclusif sur l'Œuvre instrumentale elle-même.
Le Concédant demeure notamment libre d'autoriser d'autres licenciés à créer et exploiter leurs propres œuvres à partir de la même Œuvre instrumentale.
Le Licencié est autorisé à distribuer et exploiter la Nouvelle Œuvre :
• en tant que single ;
• dans un EP ;
• dans un album ;
• dans une compilation ;
• sur les plateformes de streaming ;
• sur les plateformes de téléchargement numérique ;
• sur supports physiques ;
• dans le cadre de performances publiques ;
• dans les limites audiovisuelles prévues par la présente Licence.

4.4. Limites d'exploitation

Le Licencié est autorisé à exploiter la Nouvelle Œuvre dans les limites propres au type de Licence acheté, définies comme suit :
• {{limite_streams}} ;
• {{limite_ventes_physiques}} ;
• {{limite_vues_video}} ;
• {{limite_clips_video}} ;
• {{limite_radio_tv}} ;
• performances publiques et concerts : {{performances_publiques}}.

La Nouvelle Œuvre peut être utilisée dans des contenus promotionnels directement destinés à promouvoir l'artiste ou la Nouvelle Œuvre, notamment des extraits publiés sur les réseaux sociaux.

4.5. Revenus générés par la Nouvelle Œuvre

Sous réserve du respect des termes de la présente Licence, le Licencié conserve les sommes qui lui sont versées au titre de l'exploitation commerciale et de la distribution de la Nouvelle Œuvre.
Aucune redevance supplémentaire calculée sur les revenus de streaming, de vente ou de distribution de la Nouvelle Œuvre n'est due au Concédant au titre de la présente Licence.
Cette stipulation est sans préjudice des droits d'auteur, droits voisins, droits mécaniques ou autres droits susceptibles d'être dus au Concédant conformément aux accords conclus entre les Parties et aux dispositions applicables.

4.6. Dépassement des limites d'exploitation

Il appartient exclusivement au Licencié de suivre les statistiques, ventes, diffusions, vues et plus généralement toute donnée relative à l'exploitation de la Nouvelle Œuvre afin de s'assurer qu'il respecte les limites prévues par la Licence.
Le Concédant n'est soumis à aucune obligation de surveillance de l'exploitation de la Nouvelle Œuvre ni à aucune obligation de notification préalable du dépassement d'une limite.
À compter du jour où l'une des limites prévues par la présente Licence est dépassée, les droits accordés par la Licence ne couvrent plus l'exploitation effectuée au-delà de cette limite.
Le Licencié dispose alors d'un délai de cinq (5) jours à compter de la date effective du dépassement afin de régulariser sa situation en acquérant une Licence supérieure autorisant le niveau d'exploitation atteint.
Si la situation est régularisée dans ce délai, le Licencié pourra poursuivre l'exploitation de la Nouvelle Œuvre conformément aux conditions de la nouvelle Licence.
À défaut de régularisation dans ce délai, la Licence pourra être suspendue ou résiliée par le Concédant et toute poursuite de l'exploitation de la Nouvelle Œuvre pourra être considérée comme non autorisée.
Dans ce cas, le Concédant pourra entreprendre les démarches nécessaires afin de faire suspendre ou retirer la Nouvelle Œuvre des services sur lesquels elle est exploitée, notamment par l'exercice des droits dont il dispose sur l'Œuvre instrumentale.

5. GARANTIES

5.1. Garanties du Concédant

Le Concédant garantit que :
a. Il est titulaire ou, lorsqu'un ou plusieurs collaborateurs ont participé à la création de l'Œuvre, co-titulaire des droits patrimoniaux concernés, et dispose dans tous les cas des droits, autorisations, accords ou mandats nécessaires pour accorder la présente Licence au Licencié.
b. L'Œuvre est originale et ne contient aucun sample, extrait sonore ou élément soumis à des droits de tiers nécessitant une licence supplémentaire.
c. L'Œuvre ne contrevient à aucun droit de propriété intellectuelle et ne fait l'objet d'aucune réclamation ou litige en cours.
d. L'Œuvre est fournie « en l'état », sans garantie de compatibilité avec un système de distribution spécifique ni de performance commerciale sur les plateformes de streaming.
e. En cas de réclamation d'un tiers sur l'Œuvre, le Concédant s'engage à prendre en charge les frais de défense, à condition que le Licencié ait respecté toutes les clauses du présent contrat, et exclusivement si cette réclamation porte sur la composition instrumentale.

5.2. Exclusions de garantie

Le Concédant exclut toute garantie implicite et ne pourra être tenu responsable en cas de :
a. incompatibilité technique de l'Œuvre avec certains logiciels, systèmes ou plateformes de distribution ;
b. dommages indirects ou pertes financières résultant de l'exploitation de l'Œuvre par le Licencié ;
c. réclamations liées à une mauvaise utilisation de l'Œuvre par le Licencié, notamment lorsque les restrictions prévues par le présent contrat ne sont pas respectées.

5.3. Garanties du Licencié

a. Le Licencié garantit que les éléments ajoutés par lui à la Nouvelle Œuvre ainsi que l'exploitation qu'il en fait ne sont pas illicites et ne portent pas atteinte aux droits de propriété intellectuelle, au droit à l'image, au droit à la dignité ou à tout autre droit du Concédant ou de tiers.
b. Le Licencié reconnaît et accepte que l'Œuvre soit concédée à titre NON-EXCLUSIF et puisse ainsi être utilisée et exploitée commercialement par un ou plusieurs autres licenciés, simultanément ou non.
c. Le Licencié garantit le Concédant contre toute action, plainte, réclamation, contestation, revendication, litige ou demande d'indemnisation résultant d'une violation de la présente Licence imputable au Licencié ou d'un élément ajouté par celui-ci à la Nouvelle Œuvre.
Les condamnations, dommages et intérêts, frais de justice et frais raisonnables de défense directement liés à une telle violation pourront être mis à la charge du Licencié dans les conditions prévues par la loi.

6. PROPRIÉTÉ, DROITS D'AUTEUR ET ÉDITION

Sauf accord écrit et signé contraire du Concédant, la répartition de base des droits d'auteur relatifs à la composition de la Nouvelle Œuvre est fixée comme suit :

50 % pour la partie représentée par le Concédant, comprenant collectivement le Concédant, ses éventuels co-compositeurs ou collaborateurs et, le cas échéant, le ou les éditeurs représentant leurs intérêts ;
50 % pour la partie représentée par le Licencié, comprenant collectivement le Licencié, ses éventuels auteurs, co-auteurs, artistes en featuring ou autres contributeurs à la composition et, le cas échéant, le ou les éditeurs représentant leurs intérêts.

La répartition interne entre les personnes composant chacune de ces deux parties relève de leurs accords respectifs et ne peut en aucun cas avoir pour effet de diminuer la quote-part globale de 50 % revenant à l'autre partie.
La répartition globale de 50 % / 50 % constitue la répartition contractuelle de référence et ne peut être modifiée au détriment de la part du Concédant sans l'accord préalable, écrit et signé de celui-ci.
Tout éditeur représentant le Licencié, ses éventuels co-auteurs ou artistes en featuring ne bénéficie d'aucun droit éditorial sur la quote-part revenant au Concédant, sauf accord préalable écrit et signé du Concédant.
De la même manière, l'existence d'un éditeur représentant le Licencié ne pourra en aucun cas avoir pour effet de désigner cet éditeur comme éditeur du Concédant.
Lorsque le Concédant ne dispose pas d'un éditeur tiers pour sa propre quote-part éditoriale, celle-ci demeure sous son contrôle. Il pourra notamment être déclaré en qualité d'éditeur à compte d'auteur (EACA) auprès de la SACEM ou sous toute forme équivalente reconnue par une autre société de gestion collective de droits d'auteur.
Tout dépôt ou toute déclaration de la Nouvelle Œuvre auprès d'une société de perception et de répartition des droits devra faire l'objet d'une négociation directe entre les Parties et d'un accord écrit conformément aux dispositions du présent Contrat.

7. RESTRICTIONS ET INTERDICTIONS

a. Sociétés de gestion collective
Il est interdit d'enregistrer ou de faire enregistrer l'Œuvre et/ou la Nouvelle Œuvre auprès d'une société de gestion collective ou organisme équivalent, notamment la SACEM, BMI, ASCAP, GEMA, SIAE, PRS for Music, SOCAN, ou toute autre société exerçant une fonction comparable dans quelque territoire que ce soit, sans l'accord préalable écrit et signé du Concédant.
Toute déclaration autorisée devra impérativement respecter la répartition des droits prévue à l'article 6 ou toute répartition différente expressément acceptée par écrit et signée par le Concédant.
Toute déclaration effectuée en violation du présent article constitue un manquement contractuel susceptible d'entraîner l'application des mesures prévues à l'article 9.

b. Content ID et systèmes d'identification automatique
Il est strictement interdit d'enregistrer l'Œuvre et/ou la Nouvelle Œuvre dans un système de reconnaissance automatique ou de Content ID, notamment YouTube Content ID, ou auprès d'un service permettant de revendiquer automatiquement les contenus de tiers utilisant tout ou partie de l'Œuvre.
Cette interdiction a notamment pour objectif d'éviter qu'un Licencié puisse générer des réclamations automatiques contre le Concédant ou contre d'autres artistes bénéficiant légitimement d'une licence non-exclusive portant sur la même Œuvre.
Lorsque le distributeur, label, agrégateur ou prestataire utilisé par le Licencié propose automatiquement une telle fonctionnalité, il appartient au Licencié de la désactiver.
Le Licencié est responsable des démarches réalisées par les prestataires qu'il mandate pour distribuer ou exploiter la Nouvelle Œuvre.
En cas d'inscription accidentelle dans un système de Content ID, le Licencié devra entreprendre les démarches nécessaires afin de retirer la Nouvelle Œuvre du système dans les plus brefs délais après en avoir eu connaissance ou après notification du Concédant.

c. Revente et redistribution de l'Œuvre
Le Licencié ne peut :
• vendre l'Œuvre instrumentale seule ;
• redistribuer l'Œuvre sous la forme dans laquelle elle lui a été fournie ;
• mettre les fichiers de l'Œuvre à disposition du public ;
• revendre la présente Licence ;
• sous-licencier l'Œuvre à un tiers ;
• permettre à un tiers d'utiliser l'Œuvre pour créer une œuvre différente de la Nouvelle Œuvre autorisée par la présente Licence.
La transmission des fichiers aux personnes participant directement à la création technique ou artistique de la Nouvelle Œuvre demeure toutefois autorisée conformément à l'article 3.

d. Utilisation instrumentale
Il est interdit d'exploiter commercialement l'Œuvre seule sans création de la Nouvelle Œuvre autorisée par le présent contrat, notamment en la republiant comme instrumentale, beat, musique de fond ou composition autonome.

e. Illustration sonore et synchronisation
L'Œuvre ne peut pas être utilisée seule comme fond sonore ou illustration musicale pour une vidéo YouTube, un podcast, une publicité, un film, un jeu vidéo ou tout autre projet audiovisuel indépendant de la Nouvelle Œuvre.
Cette utilisation est exclusivement réservée aux détenteurs d'une Licence autorisant expressément un tel usage.
La présente Licence autorise toutefois l'utilisation de la Nouvelle Œuvre dans les contenus audiovisuels et promotionnels expressément autorisés par l'article 4.

8. DROIT MORAL

a. Droit à la paternité de l'Œuvre
Le Licencié s'engage à identifier le Concédant comme producteur et/ou compositeur de l'Œuvre au moyen du crédit suivant : « Produced by {{credit_concedant}} ».
Ce crédit devra être mentionné, lorsque le support concerné permet techniquement son affichage, sur les plateformes et supports utilisés pour l'exploitation de la Nouvelle Œuvre, notamment les métadonnées des plateformes de streaming, descriptions de vidéos, crédits d'album, supports physiques et autres espaces destinés à l'identification des contributeurs.
En cas d'oubli, d'erreur ou d'absence de crédit, le Licencié devra régulariser la situation dans le délai qui lui sera communiqué par le Concédant dans la notification du manquement.
Le non-respect de cette obligation après expiration du délai de régularisation constitue un manquement contractuel susceptible d'entraîner l'application des mesures prévues à l'article 9.

b. Droit de retrait
Le Concédant reconnaît et accepte que l'exercice de son droit de retrait sur l'Œuvre soit subordonné à l'indemnisation de l'intégralité du préjudice résultant pour le Licencié.
Dans ce cas :
• le Licencié pourra prétendre à une indemnisation correspondant aux investissements réalisés pour l'exploitation de l'Œuvre, notamment les coûts de promotion et de distribution ;
• en cas de désaccord sur l'indemnisation, une expertise judiciaire pourra être sollicitée afin d'évaluer le préjudice ;
• le retrait ne pourra être effectif qu'après indemnisation, sauf accord amiable entre les Parties.

9. RESPONSABILITÉS, MANQUEMENTS ET SANCTIONS

Le Licencié s'engage à respecter strictement et exclusivement l'ensemble des obligations légales et contractuelles liées au présent Contrat pour toute utilisation de l'Œuvre.

9.1. Manquements susceptibles de régularisation

Lorsqu'un manquement au présent Contrat est susceptible d'être corrigé, notamment en cas :
• d'absence ou d'erreur concernant le crédit du Concédant ;
• de déclaration non autorisée ou incorrecte auprès d'une société de gestion collective ;
• d'inscription non autorisée dans un système de Content ID ;
• ou de tout autre manquement pouvant raisonnablement être corrigé,
le Concédant pourra notifier le Licencié par écrit en indiquant la nature du manquement et le délai accordé pour le régulariser.
Ce délai sera déterminé par le Concédant en fonction de la nature du manquement et des démarches nécessaires à sa correction.
Si le Licencié régularise intégralement la situation dans le délai indiqué, le Concédant pourra maintenir la Licence en vigueur.
À défaut de régularisation dans le délai imparti, le Concédant pourra suspendre ou résilier la Licence ainsi que les droits d'exploitation qui en découlent.
Le Concédant pourra alors entreprendre les démarches nécessaires afin de faire suspendre ou retirer l'exploitation de la Nouvelle Œuvre, notamment au moyen d'une réclamation fondée sur les droits qu'il détient sur l'Œuvre.

9.2. Dépassement des limites

Le dépassement des limites d'exploitation est régi spécifiquement par l'article 4.6.
Il ne nécessite aucune notification préalable du Concédant pour faire courir le délai de régularisation de cinq (5) jours, lequel commence à compter de la date effective du dépassement.
Il appartient au Licencié de surveiller lui-même le respect des limites de sa Licence.

9.3. Autres sanctions

En cas de non-respect des termes du présent Contrat, le Licencié s'expose également, lorsque les conditions légales sont réunies, aux sanctions suivantes :
• révocation de la licence, avec interdiction d'utiliser l'Œuvre ;
• action en justice pour contrefaçon, conformément aux articles L.335-2 et L.335-3 du Code de la propriété intellectuelle, pouvant entraîner jusqu'à 3 ans d'emprisonnement et jusqu'à 300 000 € d'amende ;
• obligation de verser des dommages et intérêts au Concédant ;
• suppression du contenu concerné des plateformes numériques.

10. DROIT APPLICABLE ET RÉSOLUTION DES LITIGES

En cas de litige, les Parties tenteront d'abord de trouver une solution à l'amiable.
Toute demande de médiation ou d'information devra être adressée à l'adresse électronique suivante : {{email_concedant}}.
À défaut d'accord, toute action judiciaire sera portée devant le Tribunal judiciaire de Paris et soumise exclusivement à la législation française.

11. TERRITOIRE ET DURÉE

La présente Licence est concédée pour le monde entier pour une durée de 10 ans à compter de sa date de prise d'effet.
À l'expiration de cette période, le Licencié devra obtenir une nouvelle autorisation ou renouveler sa licence afin de poursuivre l'exploitation de la Nouvelle Œuvre.
L'expiration de la Licence ne confère aucun droit de propriété supplémentaire au Licencié sur l'Œuvre instrumentale.

12. CONFIDENTIALITÉ

Les termes et conditions de la présente Licence sont confidentiels et ne peuvent être divulgués à des tiers sans l'accord écrit du Concédant, sauf lorsque cette communication est nécessaire :
• à l'exécution ou à la distribution de la Nouvelle Œuvre ;
• à un avocat, conseil juridique, comptable, manager ou représentant professionnel du Licencié ;
• à un label, distributeur ou partenaire professionnel ayant besoin de connaître l'existence ou les conditions de la Licence ;
• à une société de gestion collective dans le cadre d'une démarche autorisée par le Concédant ;
• en application d'une obligation légale ou d'une demande d'une autorité compétente.
Les personnes auxquelles la Licence est communiquée ne bénéficient d'aucun droit supplémentaire sur l'Œuvre.

13. DISPOSITIONS GÉNÉRALES

13.1. Intégralité de l'accord
La présente Licence, accompagnée des Conditions Générales de Vente expressément applicables, constitue l'accord entre les Parties concernant les droits accordés sur l'Œuvre dans le cadre de la Licence {{type_licence}}.
Elle remplace tout échange ou accord antérieur portant sur le même objet, sauf accord écrit contraire entre les Parties.

13.2. Modification
Toute modification substantielle des droits accordés par la présente Licence devra faire l'objet d'un accord écrit entre les Parties.
Un échange électronique permettant d'identifier clairement l'accord des Parties pourra constituer un écrit à cette fin.

13.3. Nullité partielle
Si une disposition de la présente Licence devait être déclarée nulle, invalide ou inapplicable, cette situation n'affectera pas la validité des autres dispositions du contrat, qui continueront à produire leurs effets dans toute la mesure permise.
Les Parties s'efforceront, lorsque cela est nécessaire, de remplacer la disposition concernée par une disposition valable se rapprochant autant que possible de son objectif initial.

13.4. Absence de renonciation
Le fait pour le Concédant de ne pas faire appliquer immédiatement une disposition de la présente Licence ou de tolérer ponctuellement un manquement ne pourra être interprété comme une renonciation définitive à ses droits.

13.5. Licences accordées antérieurement
Le Licencié reconnaît que l'Œuvre est proposée sous licence non-exclusive.
Toute licence non-exclusive valablement accordée demeure indépendante des licences accordées à d'autres utilisateurs.
La conclusion ultérieure d'une autre licence portant sur l'Œuvre ne confère au Licencié aucun droit sur les œuvres créées par les autres licenciés.

14. ACCEPTATION DU CONTRAT

En achetant cette Licence et en procédant à la validation de la commande ainsi qu'au paiement éventuellement applicable, le Licencié reconnaît avoir pris connaissance et accepté sans réserve l'ensemble des conditions énoncées dans le présent Contrat.
Le paiement ou, lorsqu'aucun paiement n'est requis, la validation de la commande, accompagné de l'acceptation électronique des conditions applicables, matérialise l'acceptation de la présente Licence par le Licencié.

Fait à {{lieu_concedant}}, en date du {{date_achat}}.`
}

// ============================================================
// Bloc "RÔLE DE LA PLATEFORME" — jamais stocké dans le contenu éditable,
// toujours injecté séparément au moment du rendu final (voir
// resoudreVariablesLicence). Non éditable, non supprimable par le
// beatmaker, quel que soit le texte qu'il a écrit au-dessus — décision
// confirmée par Jake (bloc à deux couches, jamais fusionné dans le texte
// que le beatmaker modifie).
// ============================================================
export function blocRolePlateforme(): string {
  return `RÔLE DE LA PLATEFORME

La présente Licence est conclue exclusivement entre le Concédant et le Licencié.

${NOM_PLATEFORME} intervient uniquement en qualité de prestataire technique permettant au Concédant de créer, paramétrer, proposer, générer et exécuter la présente Licence conformément aux choix, instructions et autorisations préalablement définis par celui-ci.

${NOM_PLATEFORME} n'est ni Concédant, ni titulaire des droits portant sur l'Œuvre et ne concède aucun droit au Licencié sur celle-ci.

Le Concédant agit en son nom et pour son propre compte. Il n'est ni mandataire, ni représentant, ni agent de ${NOM_PLATEFORME} et ne dispose d'aucun pouvoir lui permettant de prendre un engagement, d'accorder une garantie, de reconnaître une responsabilité, de concéder ou transférer un droit ou une propriété, ou de créer une quelconque obligation au nom ou pour le compte de ${NOM_PLATEFORME}.

Toute stipulation ajoutée, rédigée ou modifiée par le Concédant faisant référence à ${NOM_PLATEFORME} ne saurait, du seul fait de cette mention, créer à la charge de ${NOM_PLATEFORME} une obligation, responsabilité, garantie, interdiction ou engagement quelconque, ni lui attribuer ou lui transférer un droit, une licence, une propriété ou une qualité juridique particulière. Toute stipulation prétendant produire un tel effet est inopposable à ${NOM_PLATEFORME}, sauf accord distinct, préalable, exprès et écrit conclu directement par ${NOM_PLATEFORME} par l'intermédiaire d'un représentant dûment habilité.

Le Concédant demeure seul responsable des conditions contractuelles qu'il choisit d'appliquer à la commercialisation et à l'exploitation de ses Œuvres. Lorsqu'il rédige, importe, modifie ou utilise ses propres conditions de licence, le Concédant en assume seul la responsabilité, notamment quant à leur contenu, leur licéité, leur validité, leur portée, leur opposabilité et leur adéquation à sa situation et aux droits qu'il détient.

${NOM_PLATEFORME} n'effectue aucune validation juridique des conditions de licence rédigées ou modifiées par le Concédant et ne saurait être tenue responsable des conséquences résultant de leur contenu ou de leur utilisation, sous réserve des obligations légales impératives applicables à ses propres services.`
}

// ============================================================
// Résolution des variables — n'intervient qu'une seule fois, au moment de
// générer le PDF de contrat pour une vente précise (jamais au moment où le
// beatmaker enregistre son texte).
// ============================================================

export type InfosLegalesConcedant = {
  nom_artiste: string
  raison_sociale: string | null
  forme_juridique: string | null
  numero_entreprise: string | null
  siege_social_adresse: string | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  email_contact_public: string | null
}

export type CollaborateurContrat = { nom: string }

export type DonneesLicenceContrat = {
  typeLicenceLabel: string // "MP3", "WAV", "STEMS"...
  boutique: string
  titreBeat: string
  prixPaye: string // déjà formaté, ex. "49,99 €"
  fichiersLivres: string // ex. "1 fichier MP3, 1 fichier WAV"
  concedant: InfosLegalesConcedant
  licencieNom: string | null
  licencieAdresse: string | null
  collaborateurs: CollaborateurContrat[]
  limiteStreams: number | null
  limiteVentesPhysiques: number | null
  limiteVuesVideo: number | null
  limiteClipsVideo: number | null
  limiteRadioTv: number | null
  performancesAutorisees: boolean
  dateAchat: string // déjà formatée, ex. "3 septembre 2026"
}

function adresseConcedant(c: InfosLegalesConcedant): string | null {
  if (c.siege_social_adresse) return c.siege_social_adresse
  const codePostalVille = [c.code_postal, c.ville].filter(Boolean).join(' ')
  const composee = [c.adresse, codePostalVille].filter(Boolean).join(', ')
  return composee || null
}

function identiteConcedant(c: InfosLegalesConcedant): string {
  const identite = c.raison_sociale || c.nom_artiste
  const forme = c.forme_juridique ? `, exerçant sous la forme juridique ${c.forme_juridique}` : ''
  const siret = c.numero_entreprise ? `, identifié(e) sous le numéro ${c.numero_entreprise}` : ''
  const adresse = adresseConcedant(c)
  const lieu = adresse ? `, situé(e) ${adresse}` : ''
  // Pseudonyme omis si raison_sociale est déjà vide (identite = nom_artiste,
  // le répéter serait redondant).
  const pseudo = c.raison_sociale && c.nom_artiste
    ? `, exerçant notamment sous le nom ou pseudonyme ${c.nom_artiste}`
    : ''
  return `${identite}${forme}${siret}${lieu}${pseudo}`
}

function ligneLimite(valeur: number | null, singulier: string, pluriel: string): string {
  if (valeur == null) return `Nombre ${pluriel} illimité`
  const nombre = valeur.toLocaleString('fr-FR')
  return `jusqu'à ${nombre} ${valeur > 1 ? pluriel : singulier}`
}

export function resoudreVariablesLicence(texte: string, d: DonneesLicenceContrat): string {
  const blocCollaborateurs = d.collaborateurs.length > 0
    ? `Lorsque l'Œuvre a été composée en collaboration, le ou les co-compositeurs concernés sont identifiés comme suit : ${d.collaborateurs.map(c => c.nom).join(', ')}. La présence d'un ou plusieurs collaborateurs ne leur confère pas la qualité de Concédant au titre du présent Contrat. Le Concédant demeure seul vendeur de la Licence et seul Concédant contractuellement désigné à l'égard du Licencié.\n`
    : ''

  const identiteLicencie = [d.licencieNom, d.licencieAdresse ? `demeurant ${d.licencieAdresse}` : null]
    .filter(Boolean)
    .join(', ') || 'Le Licencié'

  return texte
    .replaceAll('{{type_licence}}', d.typeLicenceLabel)
    .replaceAll('{{identite_concedant}}', identiteConcedant(d.concedant))
    .replaceAll('{{identite_licencie}}', identiteLicencie)
    .replaceAll('{{bloc_collaborateurs}}', blocCollaborateurs)
    .replaceAll('{{boutique}}', d.boutique)
    .replaceAll('{{titre_beat}}', d.titreBeat)
    .replaceAll('{{prix_paye}}', d.prixPaye)
    .replaceAll('{{fichiers_livres}}', d.fichiersLivres)
    .replaceAll('{{limite_streams}}', `${ligneLimite(d.limiteStreams, 'écoute', 'écoutes')} sur les plateformes de streaming`)
    .replaceAll('{{limite_ventes_physiques}}', `${ligneLimite(d.limiteVentesPhysiques, 'vente', 'ventes')} sur supports physiques`)
    .replaceAll('{{limite_vues_video}}', `${ligneLimite(d.limiteVuesVideo, 'vue vidéo non-monétisée', 'vues vidéo non-monétisées')}`)
    .replaceAll('{{limite_clips_video}}', `${ligneLimite(d.limiteClipsVideo, 'contenu vidéo ou clip monétisé', 'contenus vidéo ou clips monétisés')}`)
    .replaceAll('{{limite_radio_tv}}', d.limiteRadioTv == null
      ? 'Diffusion autorisée sans limite de stations de radio ou de télévision'
      : `Diffusion autorisée sur ${d.limiteRadioTv} station${d.limiteRadioTv > 1 ? 's' : ''} de radio ou de télévision`)
    .replaceAll('{{performances_publiques}}', d.performancesAutorisees ? 'autorisées' : 'non autorisées')
    .replaceAll('{{credit_concedant}}', d.concedant.nom_artiste)
    .replaceAll('{{email_concedant}}', d.concedant.email_contact_public || '[email non renseigné]')
    .replaceAll('{{lieu_concedant}}', d.concedant.ville || d.concedant.nom_artiste)
    .replaceAll('{{date_achat}}', d.dateAchat)
}
