import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import type { BlocEmail } from '@/lib/email-blocs'
import { construireApercu } from '../../../_lib/apercu'
import { chargerContactsPourApercu } from '../../../_lib/contactsApercu'
import EditerCampagneClient from './_components/EditerCampagneClient'

const URL_CAMPAGNES = '/dashboard/business/marketing/campagnes'

export default async function EditerCampagnePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: bm } = await supabase.from('beatmakers').select('id').eq('id', user.id).single()
  if (!bm) redirect('/')

  const { data: campagne } = await supabase
    .from('campagnes')
    .select('id, nom, objet, contenu, statut, beatmaker_id')
    .eq('id', id)
    .single()

  if (!campagne || campagne.beatmaker_id !== user.id) redirect(URL_CAMPAGNES)
  if (campagne.statut === 'envoyee') {
    redirect(`${URL_CAMPAGNES}?erreur=${encodeURIComponent('Cette campagne a déjà été envoyée — son contenu ne peut plus être modifié.')}`)
  }

  const [{ data: beatsRaw }, contacts] = await Promise.all([
    supabase
      .from('beats')
      .select('id, titre, image_url')
      .eq('beatmaker_id', user.id)
      .in('statut', ['public', 'prive'])
      .order('created_at', { ascending: false }),
    chargerContactsPourApercu(user.id),
  ])

  async function enregistrerContenuCampagne(contenu: BlocEmail[]) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('campagnes')
      .update({ contenu })
      .eq('id', id)
      .eq('beatmaker_id', user.id)
      .neq('statut', 'envoyee')
    redirect(URL_CAMPAGNES)
  }

  async function genererApercu(blocs: BlocEmail[], clientId?: string) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ''
    return construireApercu(user.id, blocs, clientId, id)
  }

  return (
    <EditerCampagneClient
      nom={campagne.nom}
      objet={campagne.objet ?? ''}
      blocsInitiaux={(campagne.contenu as BlocEmail[]) ?? []}
      beats={beatsRaw ?? []}
      contacts={contacts}
      enregistrerContenuCampagne={enregistrerContenuCampagne}
      genererApercu={genererApercu}
    />
  )
}
