import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import CollabsClient from './_components/CollabsClient'

export type SplitRow = {
  id: string
  pourcentage: number
  statut: 'actif' | 'en_attente' | 'refuse'
  email_invite: string | null
  beats: {
    id: string
    titre: string
    image_url: string | null
    statut: string
    couleur: string | null
    beatmakers: { nom_artiste: string; slug: string } | null
  } | null
  split_payments: { montant: number; statut: 'en_attente' | 'transfere' | 'expire' }[]
}

const SELECT = `
  id, pourcentage, statut, email_invite,
  beats(
    id, titre, image_url, statut, couleur,
    beatmakers(nom_artiste, slug)
  ),
  split_payments(montant, statut)
`

export default async function CollabsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  const { data: { user: fullUser } } = await admin.auth.admin.getUserById(user.id)
  const userEmail = fullUser?.email ?? null

  const [{ data: byId }, { data: byEmail }] = await Promise.all([
    admin.from('beat_splits').select(SELECT).eq('beatmaker_id', user.id).order('created_at', { ascending: false }),
    userEmail
      ? admin.from('beat_splits').select(SELECT).eq('email_invite', userEmail).is('beatmaker_id', null).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const seen = new Set<string>()
  const splits = ([...(byId ?? []), ...((byEmail ?? []) as unknown[])] as SplitRow[])
    .filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true })

  const actives = splits.filter(s => s.statut === 'actif')
  const totalRecu = actives
    .flatMap(s => s.split_payments)
    .filter(p => p.statut === 'transfere')
    .reduce((sum, p) => sum + p.montant, 0) / 100

  const demandes = splits.filter(s => s.statut === 'en_attente')
  const montantBloque = demandes
    .flatMap(s => s.split_payments)
    .filter(p => p.statut === 'en_attente')
    .reduce((sum, p) => sum + p.montant, 0) / 100

  return (
    <CollabsClient
      splits={splits}
      totalRecu={totalRecu}
      montantBloque={montantBloque}
    />
  )
}
