import type { SupabaseClient } from '@supabase/supabase-js'
import type { SourceLead } from './newsletter-statut'

// Écritures AUTOMATIQUES dans la fiche client d'une boutique (rang 9d, lot 3) :
// connexion, inscription, Google, paiement, abonnement, free download,
// newsletter, ajout manuel. Toutes passent par la fonction SQL
// ecrire_fiche_boutique (supabase/fiches_clients_lot3_ecriture.sql), seule
// source des règles par champ : emails accumulés (nouveau à la fin), téléphones
// et adresses accumulés (récent en tête), prénom/nom/nom d'artiste remplis une
// fois, pays/langue dernière valeur, source et 1er contact figés, jamais un
// champ modifié à la main. La boutique ne reçoit QUE ce qui lui est transmis
// à ce moment-là, jamais la fiche commune `clients`.
// Les écritures « à la main » du beatmaker passent par modifierFicheBoutique
// (app/dashboard/business/_lib/fiche-boutique.ts).

export type AdresseTransmise = {
  ligne?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  pays?: string | null
}

export type DonneesTransmises = {
  email?: string | null
  telephone?: string | null
  adresse?: AdresseTransmise | null
  prenom?: string | null
  nom?: string | null
  nom_artiste?: string | null
  pays?: string | null
  langue?: string | null
}

export async function ecrireFicheBoutique(
  admin: SupabaseClient,
  params: { clientId: string; beatmakerId: string; source: SourceLead; donnees?: DonneesTransmises },
): Promise<{ leadId: string | null; cree: boolean }> {
  const donnees = Object.fromEntries(
    Object.entries(params.donnees ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  )
  const { data, error } = await admin.rpc('ecrire_fiche_boutique', {
    p_client_id: params.clientId,
    p_beatmaker_id: params.beatmakerId,
    p_source: params.source,
    p_donnees: donnees,
  })
  if (error) {
    console.error('[fiche-boutique-ecriture] ecrire_fiche_boutique:', params.beatmakerId, params.clientId, JSON.stringify(error))
    return { leadId: null, cree: false }
  }
  const r = data as { lead_id: string | null; cree: boolean } | null
  return { leadId: r?.lead_id ?? null, cree: r?.cree === true }
}

// « Prénom Nom » saisi d'un bloc (paiement express, Stripe) → prénom = 1er mot
export function separerNomComplet(nomComplet: string | null | undefined): { prenom: string | null; nom: string | null } {
  const mots = (nomComplet ?? '').trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return { prenom: null, nom: null }
  return { prenom: mots[0], nom: mots.slice(1).join(' ') || null }
}
