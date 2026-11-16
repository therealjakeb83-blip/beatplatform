import { NOM_PLATEFORME, URL_APP } from './constantes'
import type { TypePageLegale } from './pages-legales'

// Bloc de la plateforme, OBLIGATOIRE et non modifiable, affiché sous le texte
// du beatmaker sur ses pages légales (9d lot 4, décision de Jake). Une seule
// source : le changer ici le met à jour sur toutes les boutiques d'un coup
// (Jake prévient les beatmakers via Admin → Mails plateforme).
// Rôle : pour les fiches des boutiques, la plateforme agit pour le compte de
// la boutique (sous-traitant) ; pour le compte de la personne, elle est
// responsable (page URL_APP/confidentialite).
// Contenu dans ce lot : Confidentialité seulement.

export type ParagrapheBloc = { texte: string; lien?: { libelle: string; href: string } }
export type BlocPlateforme = { titre: string; paragraphes: ParagrapheBloc[] }

const URL_CONFIDENTIALITE_PLATEFORME = `${URL_APP}/confidentialite`

const BLOCS: Partial<Record<TypePageLegale, BlocPlateforme>> = {
  confidentialite: {
    titre: `Rôle de ${NOM_PLATEFORME}`,
    paragraphes: [
      {
        texte: `Cette boutique est un commerce indépendant. Elle utilise ${NOM_PLATEFORME}, qui agit pour son compte comme prestataire technique (hébergement, paiement, envoi des emails, livraison des fichiers). Le vendeur est responsable des données de ses clients ; ${NOM_PLATEFORME} ne les utilise que pour faire fonctionner ce service.`,
      },
      {
        texte: `Ce que reçoit cette boutique : si tu te connectes, ton adresse email ; si tu crées un compte, ton email et le prénom et nom saisis ; avec Google, ton email et le nom de ton compte Google ; quand tu paies, les coordonnées saisies pour la commande (nom, adresse, téléphone si renseigné, raison sociale et numéro de TVA pour un professionnel) ; si tu t'inscris à la newsletter, ton email et ce choix. Chaque boutique ne reçoit que ce que tu lui as donné à elle : les autres boutiques n'y ont pas accès.`,
      },
      {
        texte: `Pour obtenir une copie de tes données ou les faire effacer, écris à la boutique (page Contact) : elle dispose des outils pour le faire. Les informations qui figurent sur une facture sont conservées le temps imposé par la loi.`,
      },
      {
        texte: `Ton compte ${NOM_PLATEFORME} (connexion, favoris) est distinct de cette boutique : il est géré par ${NOM_PLATEFORME}, et tu peux le supprimer toi-même depuis « Mon compte ».`,
        lien: { libelle: `Confidentialité du compte ${NOM_PLATEFORME}`, href: URL_CONFIDENTIALITE_PLATEFORME },
      },
    ],
  },
}

export function blocPlateforme(type: TypePageLegale): BlocPlateforme | null {
  return BLOCS[type] ?? null
}
