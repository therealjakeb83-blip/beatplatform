import { normaliserEmail } from './email'

// ⚠️ VERROU PRÉ-LANCEMENT — à faire sauter avant l'ouverture au public
// (étape 17, voir ROADMAP.md) en ajoutant EMAILS_ENVOI_LIBRE=true dans les
// variables d'environnement Vercel. Tant qu'il est actif, seuls les emails
// destinés aux adresses de Jake partent réellement : les comptes de test
// en base peuvent appartenir à de vraies personnes.
const LISTE_BLANCHE = [
  'nicojacob83@gmail.com',
  'contact@jakebmusic.com',
  'feedback.jakeb@gmail.com',
  'therealjakeb83@gmail.com',
]

export const MOTIF_BLOCAGE_LISTE_BLANCHE = 'Bloqué par la liste blanche (verrou pré-lancement)'

export function verrouListeBlancheActif(): boolean {
  return process.env.EMAILS_ENVOI_LIBRE !== 'true'
}

// Accepte aussi "Nom <adresse>" et les déclinaisons "+xxx" (nicojacob83+test@gmail.com).
export function adresseAutorisee(destinataire: string): boolean {
  const brut = destinataire.match(/<([^>]+)>/)?.[1] ?? destinataire
  const [local, domaine] = normaliserEmail(brut).split('@')
  if (!local || !domaine) return false
  return LISTE_BLANCHE.includes(`${local.split('+')[0]}@${domaine}`)
}

export function envoiAutorise(destinataire: string): boolean {
  return !verrouListeBlancheActif() || adresseAutorisee(destinataire)
}
