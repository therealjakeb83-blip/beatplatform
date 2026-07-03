import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import type { BlocEmail } from '@/lib/email-blocs'
import { construireApercu } from '../../_lib/apercu'
import { chargerContactsPourApercu } from '../../_lib/contactsApercu'
import NouveauTemplateClient from './_components/NouveauTemplateClient'

export default async function NouveauTemplatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: bm } = await supabase.from('beatmakers').select('id').eq('id', user.id).single()
  if (!bm) redirect('/')

  const [{ data: beatsRaw }, contacts] = await Promise.all([
    supabase
      .from('beats')
      .select('id, titre, image_url')
      .eq('beatmaker_id', user.id)
      .in('statut', ['public', 'prive'])
      .order('created_at', { ascending: false }),
    chargerContactsPourApercu(user.id),
  ])

  async function creerTemplate(nom: string, categorie: string, objetDefaut: string, contenu: BlocEmail[]) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('templates_email').insert({
      beatmaker_id: user.id,
      source:       'beatmaker',
      nom:          nom.trim() || 'Nouveau template',
      categorie,
      objet_defaut: objetDefaut.trim() || null,
      contenu,
    })
    redirect('/dashboard/business/marketing/templates')
  }

  async function genererApercu(blocs: BlocEmail[], clientId?: string) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ''
    return construireApercu(user.id, blocs, clientId)
  }

  return (
    <NouveauTemplateClient
      beats={beatsRaw ?? []}
      contacts={contacts}
      creerTemplate={creerTemplate}
      genererApercu={genererApercu}
    />
  )
}
