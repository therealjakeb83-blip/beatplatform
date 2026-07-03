import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import TemplatesClient from './_components/TemplatesClient'

const URL_TEMPLATES = '/dashboard/business/marketing/templates'

export type TemplateRow = {
  id: string
  nom: string
  categorie: string
  objet_defaut: string | null
  source: 'plateforme' | 'beatmaker'
  created_at: string
}

// ── Server actions ─────────────────────────────────────────────────────────────

async function dupliquerTemplate(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const id = formData.get('id') as string

  const { data: source } = await supabase
    .from('templates_email')
    .select('nom, categorie, objet_defaut, contenu')
    .eq('id', id)
    .single()
  if (!source) return

  await supabase.from('templates_email').insert({
    beatmaker_id: user.id,
    source:       'beatmaker',
    nom:          `${source.nom} (copie)`,
    categorie:    source.categorie,
    objet_defaut: source.objet_defaut,
    contenu:      source.contenu,
  })

  revalidatePath(URL_TEMPLATES)
}

async function supprimerTemplate(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const id = formData.get('id') as string
  await supabase.from('templates_email').delete().eq('id', id).eq('beatmaker_id', user.id)
  revalidatePath(URL_TEMPLATES)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: bm } = await supabase.from('beatmakers').select('id').eq('id', user.id).single()
  if (!bm) redirect('/')

  const { data: templatesRaw } = await supabase
    .from('templates_email')
    .select('id, nom, categorie, objet_defaut, source, created_at')
    .order('source', { ascending: true })
    .order('nom')

  const templates: TemplateRow[] = templatesRaw ?? []

  return (
    <TemplatesClient
      templates={templates}
      dupliquerTemplate={dupliquerTemplate}
      supprimerTemplate={supprimerTemplate}
    />
  )
}
