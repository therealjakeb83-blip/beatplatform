import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import type { BlocEmail } from '@/lib/email-blocs'
import { construireApercu } from '../../_lib/apercu'
import EditerTemplateClient from './_components/EditerTemplateClient'

export default async function EditerTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: bm } = await supabase.from('beatmakers').select('id').eq('id', user.id).single()
  if (!bm) redirect('/')

  const { data: template } = await supabase
    .from('templates_email')
    .select('id, nom, categorie, objet_defaut, contenu, source, beatmaker_id')
    .eq('id', id)
    .single()

  if (!template || template.source !== 'beatmaker' || template.beatmaker_id !== user.id) {
    redirect('/dashboard/business/marketing/templates')
  }

  const { data: beatsRaw } = await supabase
    .from('beats')
    .select('id, titre, image_url')
    .eq('beatmaker_id', user.id)
    .in('statut', ['public', 'prive'])
    .order('created_at', { ascending: false })

  async function modifierTemplate(nom: string, categorie: string, objetDefaut: string, contenu: BlocEmail[]) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('templates_email')
      .update({
        nom:          nom.trim() || 'Template',
        categorie,
        objet_defaut: objetDefaut.trim() || null,
        contenu,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', id)
      .eq('beatmaker_id', user.id)
    redirect('/dashboard/business/marketing/templates')
  }

  async function genererApercu(blocs: BlocEmail[]) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ''
    return construireApercu(user.id, blocs)
  }

  return (
    <EditerTemplateClient
      nomInitial={template.nom}
      categorieInitiale={template.categorie}
      objetDefautInitial={template.objet_defaut ?? ''}
      blocsInitiaux={(template.contenu as BlocEmail[]) ?? []}
      beats={beatsRaw ?? []}
      modifierTemplate={modifierTemplate}
      genererApercu={genererApercu}
    />
  )
}
