import { cookies } from 'next/headers'
import { createAdminClient } from '@/utils/supabase/admin'
import { utilisateurConnecte } from '@/lib/session-serveur'
import { lireEmailCookieAbonne } from '@/lib/cookie-abonne'
import { normaliserEmail } from '@/lib/email'
import { lienSigneR2, fichierAppartientAuBeat, estPrive } from '@/lib/r2'

// Rang 9f, Lot 1 (décision 2) : le MP3 tagué est dans l'espace privé. Le
// lecteur de la boutique reçoit un lien temporaire préparé avec la page et
// le renouvelle tout seul à l'expiration (/api/boutique/ecoute) ; un lien
// n'est donné QUE pour un beat que la personne peut voir à l'écran.

export const DUREE_LIEN_ECOUTE = 3600

export type BeatEcoute = {
  id: string
  beatmaker_id: string
  mp3_tague_url: string | null
  statut: string
  supprime_le: string | null
  date_sortie: string | null
  hors_vente_collab?: boolean | null
}

export const COLONNES_ECOUTE = 'id, beatmaker_id, mp3_tague_url, statut, supprime_le, date_sortie, hors_vente_collab'

// « Non affiché = caché » : supprimé, hors vente, vendu, programmé pour plus
// tard → rien ; privé → abonnés seulement.
export function beatVisible(beat: Omit<BeatEcoute, 'mp3_tague_url' | 'id' | 'beatmaker_id'>, estAbonne: boolean): boolean {
  if (beat.supprime_le || beat.hors_vente_collab) return false
  if (beat.date_sortie && new Date(beat.date_sortie) > new Date()) return false
  if (beat.statut === 'public') return true
  return beat.statut === 'prive' && estAbonne
}

export async function lienEcoute(beat: Pick<BeatEcoute, 'id' | 'beatmaker_id' | 'mp3_tague_url'>): Promise<string | null> {
  if (!beat.mp3_tague_url || !fichierAppartientAuBeat(beat.mp3_tague_url, beat)) return null
  // Seulement nos fichiers (espace privé, ou ancienne adresse r2.dev) : jamais
  // une adresse quelconque saisie en base (ex. faux beats de démonstration).
  if (!estPrive(beat.mp3_tague_url) && !/^https:\/\/[^/]+\.r2\.dev\//.test(beat.mp3_tague_url)) return null
  try {
    return await lienSigneR2(beat.mp3_tague_url, { secondes: DUREE_LIEN_ECOUTE, contentType: 'audio/mpeg' })
  } catch (err) {
    console.error('[ecoute] lien impossible pour le beat', beat.id, err instanceof Error ? err.message : err)
    return null
  }
}

// Lien d'écoute si le beat est visible pour ce visiteur, sinon null.
export async function lienEcouteSiVisible(beat: BeatEcoute, estAbonne: boolean): Promise<string | null> {
  return beatVisible(beat, estAbonne) ? lienEcoute(beat) : null
}

// Le visiteur est-il abonné à cette boutique ? Compte connecté (par son
// identifiant, puis par son email), sinon cookie d'abonné signé.
export async function estAbonneBoutique(beatmakerId: string, slug: string): Promise<boolean> {
  const admin = createAdminClient()
  const user = await utilisateurConnecte()
  if (user) {
    const { data: parId } = await admin
      .from('abonnements_boutique').select('id')
      .eq('beatmaker_id', beatmakerId).eq('client_id', user.id).eq('statut', 'actif')
      .limit(1).maybeSingle()
    if (parId) return true
    const email = normaliserEmail(user.email)
    if (email) {
      const { data: parEmail } = await admin
        .from('abonnements_boutique').select('id')
        .eq('beatmaker_id', beatmakerId).eq('acheteur_email', email).eq('statut', 'actif')
        .limit(1).maybeSingle()
      if (parEmail) return true
    }
  }
  const emailCookie = lireEmailCookieAbonne(await cookies(), slug)
  if (!emailCookie) return false
  const { data: abo } = await admin
    .from('abonnements_boutique').select('id')
    .eq('beatmaker_id', beatmakerId).eq('acheteur_email', emailCookie).eq('statut', 'actif')
    .limit(1).maybeSingle()
  return !!abo
}

// Pages de la boutique : remplace, dans les lignes lues en base, l'emplacement
// du MP3 tagué par un lien d'écoute temporaire (jamais l'adresse du fichier
// envoyée au navigateur). Les lignes doivent être des beats de `beatmakerId`.
export async function remplacerParLiensEcoute<T extends { id: string; mp3_tague_url?: string | null }>(
  lignes: T[] | null | undefined,
  beatmakerId: string
): Promise<void> {
  await Promise.all((lignes ?? []).map(async l => {
    if (l.mp3_tague_url) l.mp3_tague_url = await lienEcoute({ id: l.id, beatmaker_id: beatmakerId, mp3_tague_url: l.mp3_tague_url })
  }))
}
