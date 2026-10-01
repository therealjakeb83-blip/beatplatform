import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import CollabsClient from './_components/CollabsClient'
import { calculerPretAVendreOuExempte } from '@/lib/pret-a-vendre'

export type CritereManquant = { libelle: string; lienReglage: string }

// Modèle d'états de la Phase 12 (invitee/active/refusee/retiree/quittee/
// evincee, lib/collaboration.ts) ; aucune donnée d'argent ici (les parts
// vendues vivent dans commande_tranches).

export type SplitRow = {
  id: string
  pourcentage: number
  statut: 'invitee' | 'active' | 'refusee' | 'retiree' | 'quittee' | 'evincee'
  email_invite: string | null
  motif_eviction: string | null
  accepte_le: string | null
  created_at: string
  beats: {
    id: string
    titre: string
    image_url: string | null
    statut: string
    couleur: string | null
    beatmakers: { nom_artiste: string; slug: string } | null
  } | null
}

const SELECT = `
  id, pourcentage, statut, email_invite, motif_eviction, accepte_le, created_at,
  beats(
    id, titre, image_url, statut, couleur,
    beatmakers(nom_artiste, slug)
  )
`

export default async function CollabsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  const { data: { user: fullUser } } = await admin.auth.admin.getUserById(user.id)
  const userEmail = fullUser?.email?.toLowerCase() ?? null

  const [{ data: byId }, { data: byEmail }] = await Promise.all([
    admin.from('beat_splits').select(SELECT).eq('beatmaker_id', user.id).order('created_at', { ascending: false }),
    userEmail
      ? admin.from('beat_splits').select(SELECT).eq('email_invite', userEmail).is('beatmaker_id', null).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const seen = new Set<string>()
  const splits = ([...(byId ?? []), ...((byEmail ?? []) as unknown[])] as unknown[])
    .filter((s): s is Record<string, unknown> => {
      const id = (s as Record<string, unknown>).id as string
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    .map(s => {
      const beatsRaw = s.beats as unknown
      const beat = (Array.isArray(beatsRaw) ? beatsRaw[0] : beatsRaw) as Record<string, unknown> | null
      if (!beat) return { ...s, beats: null } as unknown as SplitRow
      const bmRaw = beat.beatmakers as unknown
      const beatmakers = (Array.isArray(bmRaw) ? bmRaw[0] : bmRaw) ?? null
      return { ...s, beats: { ...beat, beatmakers } } as unknown as SplitRow
    })

  // Lot 4 (Q7c) : B voit ce qui lui manque pour vendre AVANT d'accepter.
  // Aussi pour ses collabs actives : s'il n'est plus éligible, elles sont
  // retirées de la vente et il doit voir quoi régler.
  const concerne = splits.some(s => s.statut === 'invitee' || s.statut === 'active')
  const readiness = concerne
    ? await calculerPretAVendreOuExempte(admin, user.id, { estConcedant: false })
    : { pret: true, criteres: [] }
  const criteresManquants = readiness.criteres
    .filter(c => !c.ok)
    .map(c => ({ libelle: c.libelle, lienReglage: c.lienReglage }))

  return <CollabsClient splits={splits} criteresManquants={criteresManquants} />
}
