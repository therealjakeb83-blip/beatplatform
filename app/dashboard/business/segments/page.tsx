import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { evaluerFiltres, type SegmentDB, type Condition } from '../_lib/segments'
import { chargerContactsEnrichis } from '../_lib/contacts'
import SegmentsClient from './_components/SegmentsClient'

// ── Server actions ─────────────────────────────────────────────────────────────

async function creerSegment(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('segments_crm').insert({
    beatmaker_id: user.id,
    nom:          (formData.get('nom')         as string).trim(),
    description:  (formData.get('description') as string).trim() || null,
    couleur:      (formData.get('couleur')     as string) || 'indigo',
    filtres:      JSON.parse((formData.get('filtres') as string) || '[]'),
  })
  revalidatePath('/dashboard/business/segments')
}

async function modifierSegment(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const id = formData.get('id') as string
  await supabase.from('segments_crm').update({
    nom:         (formData.get('nom')         as string).trim(),
    description: (formData.get('description') as string).trim() || null,
    couleur:     (formData.get('couleur')     as string) || 'indigo',
    filtres:     JSON.parse((formData.get('filtres') as string) || '[]'),
  }).eq('id', id).eq('beatmaker_id', user.id)
  revalidatePath('/dashboard/business/segments')
}

async function supprimerSegment(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const id = formData.get('id') as string
  await supabase.from('segments_crm').delete().eq('id', id).eq('beatmaker_id', user.id)
  revalidatePath('/dashboard/business/segments')
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SegmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: bm } = await supabase.from('beatmakers').select('id').eq('id', user.id).single()
  if (!bm) redirect('/')

  const [{ data: segmentsRaw }, { contacts, catalog }] = await Promise.all([
    supabase
      .from('segments_crm')
      .select('id, nom, description, couleur, filtres, created_at')
      .eq('beatmaker_id', user.id)
      .order('created_at', { ascending: false }),
    chargerContactsEnrichis(user.id),
  ])

  const segments: (SegmentDB & { count: number })[] = (segmentsRaw ?? []).map(s => ({
    ...s,
    filtres: s.filtres as Condition[],
    count:   contacts.filter(c => evaluerFiltres(c, s.filtres as Condition[])).length,
  }))

  return (
    <SegmentsClient
      segments={segments}
      catalog={catalog}
      creerSegment={creerSegment}
      modifierSegment={modifierSegment}
      supprimerSegment={supprimerSegment}
    />
  )
}
