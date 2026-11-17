import type { SupabaseClient } from '@supabase/supabase-js'
import { lireInfosCompte } from '@/lib/infos-paiement-compte'

// Préremplissage de la page de paiement (chantier du 2026-11-17) — client
// CONNECTÉ seulement (le cookie d'abonné ne suffit jamais), lu par le serveur
// au rendu de la page, aucune route ne renvoie ces infos.
// Deux sources possibles :
//   1. la fiche de CETTE boutique (leads, client_id = compte connecté — jamais
//      une fiche fusionnée d'une autre personne) + sa dernière commande dans
//      la boutique (raison sociale / TVA) ; rien si la boutique l'a effacé ;
//   2. les infos gardées sur le compte, si le client a coché la case.
// La plus récente est préremplie ; les adresses de l'autre restent proposées
// dans « Mes adresses ». Seules les adresses complètes (rue, code postal,
// ville) sont proposées.

export type AdresseEnregistree = { adresse: string; codePostal: string; ville: string; pays: string | null }

export type Preremplissage = {
  prenom: string
  nom: string
  telephone: string
  pays: string | null
  adresses: AdresseEnregistree[]
  pro: { raisonSociale: string; numeroTva: string } | null
  // La case « se souvenir » est déjà cochée sur le compte.
  memoriserActif: boolean
}

type Source = {
  date: number
  prenom: string
  nom: string
  telephone: string
  pays: string | null
  adresses: AdresseEnregistree[]
  pro: { raisonSociale: string; numeroTva: string } | null
}

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const paysValide = (v: unknown) => {
  const p = txt(v).toUpperCase()
  return /^[A-Z]{2}$/.test(p) ? p : null
}

function adresseComplete(a: unknown): AdresseEnregistree | null {
  if (!a || typeof a !== 'object') return null
  const o = a as Record<string, unknown>
  const adresse = txt(o.adresse)
  const codePostal = txt(o.code_postal)
  const ville = txt(o.ville)
  if (!adresse || !codePostal || !ville) return null
  return { adresse, codePostal, ville, pays: paysValide(o.pays) }
}

const cleAdresse = (a: AdresseEnregistree) =>
  [a.adresse, a.codePostal, a.ville, a.pays ?? ''].map(s => s.toLowerCase().replace(/\s+/g, ' ')).join('|')

async function sourceBoutique(admin: SupabaseClient, clientId: string, beatmakerId: string): Promise<Source | null> {
  const { data: fiche } = await admin
    .from('leads')
    .select('prenom, nom, telephones, adresses, pays, efface_le, created_at')
    .eq('client_id', clientId)
    .eq('beatmaker_id', beatmakerId)
    .maybeSingle()
  if (!fiche || fiche.efface_le) return null

  const { data: commande } = await admin
    .from('commandes')
    .select('created_at, acheteur_raison_sociale, acheteur_numero_tva')
    .eq('client_id', clientId)
    .eq('beatmaker_id', beatmakerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const adresses = (Array.isArray(fiche.adresses) ? fiche.adresses : [])
    .map(adresseComplete)
    .filter((a): a is AdresseEnregistree => a !== null)
  const telephones = Array.isArray(fiche.telephones) ? fiche.telephones : []
  const raisonSociale = txt(commande?.acheteur_raison_sociale)
  const numeroTva = txt(commande?.acheteur_numero_tva)
  const source: Source = {
    date: new Date((commande?.created_at as string | undefined) ?? (fiche.created_at as string)).getTime() || 0,
    prenom: txt(fiche.prenom),
    nom: txt(fiche.nom),
    telephone: txt(telephones[0]),
    pays: paysValide(fiche.pays) ?? adresses[0]?.pays ?? null,
    adresses,
    pro: raisonSociale && numeroTva ? { raisonSociale, numeroTva } : null,
  }
  const vide = !source.prenom && !source.nom && !source.telephone && adresses.length === 0 && !source.pro
  return vide ? null : source
}

async function sourceCompte(admin: SupabaseClient, clientId: string): Promise<Source | null> {
  const infos = await lireInfosCompte(admin, clientId)
  if (!infos) return null
  const adresse = adresseComplete({ adresse: infos.adresse, code_postal: infos.code_postal, ville: infos.ville, pays: infos.pays })
  const raisonSociale = txt(infos.raison_sociale)
  const numeroTva = txt(infos.numero_tva)
  return {
    date: new Date(infos.maj_le).getTime() || 0,
    prenom: txt(infos.prenom),
    nom: txt(infos.nom),
    telephone: txt(infos.telephone),
    pays: paysValide(infos.pays),
    adresses: adresse ? [adresse] : [],
    pro: raisonSociale && numeroTva ? { raisonSociale, numeroTva } : null,
  }
}

export async function chargerPreremplissage(
  admin: SupabaseClient,
  clientId: string | null,
  beatmakerId: string,
): Promise<Preremplissage | null> {
  if (!clientId) return null
  const [boutique, compte] = await Promise.all([
    sourceBoutique(admin, clientId, beatmakerId),
    sourceCompte(admin, clientId),
  ])
  if (!boutique && !compte) return null

  const [principale, autre] = !boutique ? [compte!, null] : !compte ? [boutique, null]
    : compte.date > boutique.date ? [compte, boutique] : [boutique, compte]

  const adresses: AdresseEnregistree[] = []
  const vues = new Set<string>()
  for (const a of [...principale.adresses, ...(autre?.adresses ?? [])]) {
    const cle = cleAdresse(a)
    if (vues.has(cle)) continue
    vues.add(cle)
    adresses.push(a)
  }

  return {
    prenom: principale.prenom || autre?.prenom || '',
    nom: principale.nom || autre?.nom || '',
    telephone: principale.telephone || autre?.telephone || '',
    pays: adresses[0]?.pays ?? principale.pays ?? autre?.pays ?? null,
    adresses,
    // Professionnel : celui de la source préremplie seulement (un dernier
    // achat en particulier ne doit pas rallumer l'interrupteur).
    pro: principale.pro,
    memoriserActif: compte !== null,
  }
}
