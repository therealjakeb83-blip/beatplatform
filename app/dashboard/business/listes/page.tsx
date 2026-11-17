import { utilisateurConnecte } from '@/lib/session-serveur'
import { createClient } from '@/utils/supabase/server'
import { chargerFusionsBoutique } from '@/app/dashboard/business/_lib/fiche-boutique'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import ListesClient from './_components/ListesClient'
import { fuseauSur } from '@/lib/fuseau-horaire'

function formatDate(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: tz })
}

async function creerListe(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const user = await utilisateurConnecte()
  if (!user) return
  await supabase.from('listes_crm').insert({
    beatmaker_id: user.id,
    nom:          (formData.get('nom')         as string).trim(),
    description:  (formData.get('description') as string).trim() || null,
  })
  revalidatePath('/dashboard/business/listes')
}

async function modifierListe(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const user = await utilisateurConnecte()
  if (!user) return
  const id = formData.get('id') as string
  await supabase.from('listes_crm').update({
    nom:         (formData.get('nom')         as string).trim(),
    description: (formData.get('description') as string).trim() || null,
  }).eq('id', id).eq('beatmaker_id', user.id)
  revalidatePath('/dashboard/business/listes')
}

async function supprimerListe(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const user = await utilisateurConnecte()
  if (!user) return
  const id = formData.get('id') as string
  await supabase.from('listes_crm').delete().eq('id', id).eq('beatmaker_id', user.id)
  revalidatePath('/dashboard/business/listes')
}

export default async function ListesPage() {
  const supabase = await createClient()
  const user = await utilisateurConnecte()
  if (!user) redirect('/connexion')

  const { data: bm } = await supabase.from('beatmakers').select('id, fuseau_horaire').eq('id', user.id).single()
  if (!bm) redirect('/')
  const tz = fuseauSur(bm.fuseau_horaire)

  const { data: listesRaw } = await supabase
    .from('listes_crm')
    .select('id, nom, description, created_at, listes_crm_contacts(client_id)')
    .eq('beatmaker_id', user.id)
    .order('created_at', { ascending: false })

  // Un contact fusionné compte pour une seule personne (comme la page d'une liste)
  const fusions = await chargerFusionsBoutique(supabase, user.id)
  const listes = (listesRaw ?? []).map(l => ({
    id:          l.id,
    nom:         l.nom,
    description: l.description,
    dateLabel:   formatDate(l.created_at, tz),
    count:       new Set(((l.listes_crm_contacts ?? []) as { client_id: string }[]).map(m => fusions.conserveDe(m.client_id))).size,
  }))

  return (
    <ListesClient
      listes={listes}
      creerListe={creerListe}
      modifierListe={modifierListe}
      supprimerListe={supprimerListe}
    />
  )
}
