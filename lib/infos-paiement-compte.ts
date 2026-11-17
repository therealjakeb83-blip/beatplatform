import type { SupabaseClient } from '@supabase/supabase-js'
import { NOM_PLATEFORME } from '@/lib/constantes'
import { separerNomComplet } from '@/lib/fiche-boutique-ecriture'

// Infos de paiement gardées sur le COMPTE Sonoo (chantier préremplissage,
// 2026-11-17) — seulement si le client a coché la case au paiement. Sonoo est
// responsable de ces infos : elles sont rangées à part (table
// infos_paiement_compte, clé de service seule), jamais dans `clients`, jamais
// tirées des fiches des boutiques. Un seul jeu d'infos (le dernier paiement),
// effacé dès que la case est décochée ou le compte supprimé.

export const TEXTE_CONSENTEMENT_INFOS = `Se souvenir de mes infos pour mes achats dans les autres boutiques ${NOM_PLATEFORME}`

// Clé de metadata (Stripe ou tentative) qui porte l'identifiant du compte
// CONNECTÉ ayant coché la case — posée par le serveur, jamais par le navigateur.
export const CLE_MEMORISER = 'memoriser_client_id'

export type InfosPaiementCompte = {
  prenom: string | null
  nom: string | null
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
  raison_sociale: string | null
  numero_tva: string | null
  consenti_le: string
  maj_le: string
}

const COLONNES = 'prenom, nom, telephone, adresse, code_postal, ville, pays, raison_sociale, numero_tva, consenti_le, maj_le'

export async function lireInfosCompte(admin: SupabaseClient, clientId: string): Promise<InfosPaiementCompte | null> {
  const { data, error } = await admin.from('infos_paiement_compte').select(COLONNES).eq('client_id', clientId).maybeSingle()
  if (error) {
    console.error('[infos-paiement-compte] lecture:', clientId, JSON.stringify(error))
    return null
  }
  return (data as InfosPaiementCompte | null) ?? null
}

export async function oublierInfosCompte(admin: SupabaseClient, clientId: string): Promise<boolean> {
  const { error } = await admin.from('infos_paiement_compte').delete().eq('client_id', clientId)
  if (error) console.error('[infos-paiement-compte] effacement:', clientId, JSON.stringify(error))
  return !error
}

type DonneesPaiement = {
  prenom?: string | null
  nom?: string | null
  nomComplet?: string | null
  telephone?: string | null
  adresse?: string | null
  codePostal?: string | null
  ville?: string | null
  pays?: string | null
  raisonSociale?: string | null
  numeroTva?: string | null
}

const propre = (v: string | null | undefined, n = 200) => {
  const t = (v ?? '').trim().slice(0, n)
  return t || null
}

// Appelé APRÈS un paiement réussi (jamais avant) : remplace le jeu d'infos du
// compte par celui de ce paiement. Société / TVA retirées si ce paiement n'est
// pas professionnel.
export async function memoriserInfosCompte(admin: SupabaseClient, clientId: string, d: DonneesPaiement): Promise<void> {
  let prenom = propre(d.prenom, 100)
  let nom = propre(d.nom, 100)
  if (!prenom && !nom && d.nomComplet) {
    const s = separerNomComplet(d.nomComplet)
    prenom = propre(s.prenom, 100)
    nom = propre(s.nom, 100)
  } else if (!nom !== !prenom && /\s/.test(prenom ?? nom ?? '')) {
    const s = separerNomComplet(prenom ?? nom)
    prenom = propre(s.prenom, 100)
    nom = propre(s.nom, 100)
  }
  const pays = (d.pays ?? '').trim().toUpperCase() || null

  const { data: existant } = await admin.from('infos_paiement_compte').select('consenti_le').eq('client_id', clientId).maybeSingle()
  const maintenant = new Date().toISOString()
  const { error } = await admin.from('infos_paiement_compte').upsert({
    client_id: clientId,
    prenom,
    nom,
    telephone: propre(d.telephone, 40),
    adresse: propre(d.adresse),
    code_postal: propre(d.codePostal, 20),
    ville: propre(d.ville, 100),
    pays: pays && /^[A-Z]{2}$/.test(pays) ? pays : null,
    raison_sociale: propre(d.raisonSociale),
    numero_tva: propre(d.numeroTva, 32)?.toUpperCase() ?? null,
    consenti_le: (existant?.consenti_le as string | undefined) ?? maintenant,
    texte_consentement: TEXTE_CONSENTEMENT_INFOS,
    maj_le: maintenant,
  }, { onConflict: 'client_id' })
  if (error) console.error('[infos-paiement-compte] enregistrement:', clientId, JSON.stringify(error))
}

// Au moment de préparer un paiement : case décochée par un client connecté =
// retrait immédiat (décision de Jake). Case cochée = identifiant à porter dans
// la metadata pour l'enregistrement après paiement. Aucun effet sans compte
// connecté. Case absente (paiement express du panier, sans formulaire) : la
// case reste dans son état — mise à jour seulement si elle est déjà cochée.
export async function choixMemoriser(
  admin: SupabaseClient,
  clientIdConnecte: string | null,
  memoriser: boolean | undefined,
): Promise<Record<string, string>> {
  if (!clientIdConnecte) return {}
  if (memoriser === undefined) {
    const { data } = await admin.from('infos_paiement_compte').select('client_id').eq('client_id', clientIdConnecte).maybeSingle()
    return data ? { [CLE_MEMORISER]: clientIdConnecte } : {}
  }
  if (memoriser === true) return { [CLE_MEMORISER]: clientIdConnecte }
  await oublierInfosCompte(admin, clientIdConnecte)
  return {}
}
