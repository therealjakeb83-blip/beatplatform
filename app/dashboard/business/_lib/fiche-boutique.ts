import type { SupabaseClient } from '@supabase/supabase-js'
import { parLots, toutesLesLignes } from './requetes'

// Fiche client PAR boutique (rang 9d) = la ligne `leads` client × boutique.
// Elle ne contient que ce que le client a donné ou fait DANS cette boutique,
// plus ce que le beatmaker y note. La fiche commune `clients` n'est plus lue
// ni écrite par le CRM, les emails ou les automatisations (lot 2).
//
// Règles par champ (calibrage du 2026-11-12) :
//   accumulés        : emails (le 1er = principal), telephones, adresses
//   remplis une fois : prenom, nom, nom_artiste
//   dernière valeur  : pays, langue
//   figés            : source, premier_contact_le
//   beatmaker seul   : notes, tags, surnom, réseaux
//   la main du beatmaker gagne : un champ modifié à la main est ajouté à
//   champs_manuels et l'automatique (reconstruction, lot 3) n'y touche plus.

export type AdresseFiche = {
  ligne: string
  adresse?: string
  code_postal?: string
  ville?: string
  pays?: string
}

export type FicheBoutique = {
  id: string
  client_id: string
  source: string | null
  newsletter_statut: string
  newsletter_statut_at: string | null
  emails: string[]
  telephones: string[]
  adresses: AdresseFiche[]
  prenom: string | null
  nom: string | null
  nom_artiste: string | null
  pays: string | null
  langue: string | null
  premier_contact_le: string | null
  created_at: string | null
  notes: string | null
  tags: string[]
  surnom: string | null
  instagram: string | null
  spotify: string | null
  youtube: string | null
  tiktok: string | null
  champs_manuels: string[]
  // 9d lot 4 : contact effacé par la boutique (fiche vidée, caché partout)
  efface_le: string | null
}

export const COLONNES_FICHE =
  'id, client_id, source, newsletter_statut, newsletter_statut_at, emails, telephones, adresses, prenom, nom, nom_artiste, pays, langue, premier_contact_le, created_at, notes, tags, surnom, instagram, spotify, youtube, tiktok, champs_manuels, efface_le'

function normaliser(f: FicheBoutique): FicheBoutique {
  return {
    ...f,
    emails:         f.emails ?? [],
    telephones:     f.telephones ?? [],
    adresses:       Array.isArray(f.adresses) ? f.adresses : [],
    tags:           f.tags ?? [],
    champs_manuels: f.champs_manuels ?? [],
  }
}

// Fiches de CETTE boutique pour une liste de clients (clé = client_id).
// `db` = session du beatmaker (règle leads_select_own) ou clé de service ;
// beatmaker_id est toujours filtré explicitement.
export async function chargerFichesBoutique(
  db: SupabaseClient,
  beatmakerId: string,
  clientIds: string[],
): Promise<Map<string, FicheBoutique>> {
  const ids = [...new Set(clientIds.filter(Boolean))]
  if (ids.length === 0) return new Map()
  const lignes = await parLots<FicheBoutique>(ids, lot => db
    .from('leads')
    .select(COLONNES_FICHE)
    .eq('beatmaker_id', beatmakerId)
    .in('client_id', lot))
  return new Map(lignes.map(l => [l.client_id, normaliser(l)]))
}

export async function chargerFicheBoutique(
  db: SupabaseClient,
  beatmakerId: string,
  clientId: string,
): Promise<FicheBoutique | null> {
  return (await chargerFichesBoutique(db, beatmakerId, [clientId])).get(clientId) ?? null
}

// Contacts effacés par CETTE boutique (9d lot 4) : cachés de Contacts,
// segments, listes, doublons, campagnes et automatisations.
export async function chargerEffacesBoutique(db: SupabaseClient, beatmakerId: string): Promise<Set<string>> {
  const lignes = await toutesLesLignes<{ client_id: string }>((debut, fin) => db
    .from('leads')
    .select('client_id')
    .eq('beatmaker_id', beatmakerId)
    .not('efface_le', 'is', null)
    .order('id')
    .range(debut, fin))
  return new Set(lignes.map(r => r.client_id))
}

export function emailPrincipal(f: Pick<FicheBoutique, 'emails'> | null | undefined): string | null {
  return f?.emails?.[0] ?? null
}

// « Prénom Nom » de la fiche, vide si la boutique ne connaît aucun nom
export function nomCompletFiche(f: Pick<FicheBoutique, 'prenom' | 'nom'> | null | undefined): string {
  return [f?.prenom, f?.nom].map(v => (v ?? '').trim()).filter(Boolean).join(' ')
}

// Identité minimale attendue par les écrans qui affichaient `clients(id, prenom, nom, email, pays)`
export type IdentiteFiche = { id: string; prenom: string | null; nom: string; email: string; pays: string | null; nom_artiste: string | null }

export function identiteDepuisFiche(clientId: string, f: FicheBoutique | null | undefined): IdentiteFiche {
  return {
    id:          clientId,
    prenom:      f?.prenom ?? null,
    nom:         f?.nom ?? '',
    email:       emailPrincipal(f) ?? '',
    pays:        f?.pays ?? null,
    nom_artiste: f?.nom_artiste ?? null,
  }
}

// Remplace, dans des lignes qui portaient `clients(...)` (fiche commune), cette
// identité par celle de la fiche de la boutique. Un client sans fiche dans la
// boutique (ex. acheteur vu par un collaborateur) n'a plus d'identité : null.
export async function remplacerClientsParFiches<T extends { client_id?: string | null; clients?: unknown }>(
  db: SupabaseClient,
  beatmakerId: string,
  lignes: T[],
): Promise<(T & { clients: IdentiteFiche | null })[]> {
  const ids = lignes.map(l => l.client_id).filter((v): v is string => !!v)
  const fiches = await chargerFichesBoutique(db, beatmakerId, ids)
  return lignes.map(l => ({
    ...l,
    clients: l.client_id && fiches.has(l.client_id) ? identiteDepuisFiche(l.client_id, fiches.get(l.client_id)) : null,
  }))
}

export function adresseAffichee(a: AdresseFiche): string {
  if (a.ligne) return a.ligne
  return [a.adresse, [a.code_postal, a.ville].filter(Boolean).join(' '), a.pays].filter(Boolean).join(', ')
}

type ChampsModifiables = Partial<Pick<FicheBoutique,
  'emails' | 'telephones' | 'adresses' | 'prenom' | 'nom' | 'nom_artiste' | 'pays' | 'langue'
  | 'notes' | 'tags' | 'surnom' | 'instagram' | 'spotify' | 'youtube' | 'tiktok'>>

// Écriture « à la main » par le beatmaker : met à jour la fiche de SA boutique
// et marque les champs comme modifiés à la main (la main du beatmaker gagne).
// `admin` = clé de service (leads ne s'écrit qu'avec elle). L'appelant a déjà
// vérifié que le client est lié à la boutique.
export async function modifierFicheBoutique(
  admin: SupabaseClient,
  beatmakerId: string,
  clientId: string,
  maj: ChampsModifiables,
): Promise<void> {
  const champs = Object.keys(maj)
  if (champs.length === 0) return
  const { data: actuelle, error: eLecture } = await admin
    .from('leads')
    .select('id, champs_manuels, efface_le')
    .eq('beatmaker_id', beatmakerId)
    .eq('client_id', clientId)
    .maybeSingle()
  if (eLecture) {
    console.error('[fiche-boutique] lecture:', JSON.stringify(eLecture))
    throw new Error('Fiche introuvable')
  }
  if (actuelle?.efface_le) throw new Error('Contact effacé')
  const manuels = [...new Set([...((actuelle?.champs_manuels as string[] | null) ?? []), ...champs])]
  if (actuelle) {
    const { error } = await admin
      .from('leads')
      .update({ ...maj, champs_manuels: manuels })
      .eq('id', actuelle.id)
      .eq('beatmaker_id', beatmakerId)
    if (error) {
      console.error('[fiche-boutique] écriture:', JSON.stringify(error))
      throw new Error('Enregistrement impossible')
    }
    return
  }
  // Client lié par une vente mais encore sans fiche (vente arrivée avant le
  // lot 3) : la fiche est créée avec ce que le beatmaker vient de saisir ;
  // la reconstruction complétera le reste (cases vides seulement).
  const { error } = await admin.from('leads').insert({
    client_id: clientId,
    beatmaker_id: beatmakerId,
    source: 'achat',
    premier_contact_le: new Date().toISOString(),
    ...maj,
    champs_manuels: manuels,
  })
  if (error) {
    console.error('[fiche-boutique] création:', JSON.stringify(error))
    throw new Error('Enregistrement impossible')
  }
}

// Identité d'un acheteur pour un document ou un email d'une commande, quand la
// commande n'a pas sa propre copie (ex. commande d'abonnement) : fiche de la
// boutique qui a vendu (9d lot 2), jamais la fiche commune.
export async function identiteAcheteurBoutique(
  admin: SupabaseClient,
  beatmakerId: string,
  clientId: string | null,
): Promise<{ email: string | null; nom: string | null; adresse: string | null; prenom: string | null; nomFamille: string | null } | null> {
  if (!clientId) return null
  const f = await chargerFicheBoutique(admin, beatmakerId, clientId)
  if (!f) return null
  return {
    email: emailPrincipal(f),
    nom: nomCompletFiche(f) || null,
    adresse: f.adresses[0] ? adresseAffichee(f.adresses[0]) : null,
    prenom: f.prenom,
    nomFamille: f.nom,
  }
}

// Fusions de doublons de la boutique (virtuelles, annulables) : chaque fiche
// archivée renvoie à la fiche conservée (en suivant les fusions en chaîne).
export async function chargerFusionsBoutique(db: SupabaseClient, beatmakerId: string): Promise<{
  conserveDe: (clientId: string) => string
  archivesDe: (clientId: string) => string[]
  estArchive: (clientId: string) => boolean
}> {
  const { data } = await db.from('fusions_crm').select('client_id_conserve, client_id_archive').eq('beatmaker_id', beatmakerId)
  const versConserve = new Map((data ?? []).map(f => [f.client_id_archive as string, f.client_id_conserve as string]))
  const conserveDe = (id: string) => {
    let x = id
    for (let i = 0; i < 20 && versConserve.has(x); i++) x = versConserve.get(x)!
    return x
  }
  const archives = new Map<string, string[]>()
  for (const a of versConserve.keys()) {
    const c = conserveDe(a)
    archives.set(c, [...(archives.get(c) ?? []), a])
  }
  return { conserveDe, archivesDe: id => archives.get(id) ?? [], estArchive: id => versConserve.has(id) }
}
