import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { calculerEcheance, traiterEvenementAutomatisation, genererApercuAutomatisation, LABELS_AUTOMATISATION, type TypeAutomatisation } from '@/lib/automatisations'
import AutomatisationsClient from './_components/AutomatisationsClient'

export type AutomatisationRow = {
  id: string
  type: string
  actif: boolean
  objet: string | null
  corps: string | null
  delai_heures: number
  heure_cible_minutes: number | null
}

export type EvenementFileAttente = {
  id: string
  flux: string
  clientNom: string
  clientEmail: string
  echeanceISO: string | null
}

export default async function AutomatisationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data } = await supabase
    .from('automatisations')
    .select('id, type, actif, objet, corps, delai_heures, heure_cible_minutes')
    .eq('beatmaker_id', user.id)

  const automatisations = (data ?? []) as AutomatisationRow[]

  const admin = createAdminClient()
  const { data: evenementsRaw } = await admin
    .from('automatisation_evenements')
    .select('id, type, created_at, clients(prenom, nom, email)')
    .eq('beatmaker_id', user.id)
    .eq('traite', false)
    .order('created_at', { ascending: false })

  type EvenementRaw = {
    id: string
    type: TypeAutomatisation
    created_at: string
    clients: { prenom: string | null; nom: string; email: string } | null
  }

  const fileAttente: EvenementFileAttente[] = ((evenementsRaw ?? []) as unknown as EvenementRaw[]).map(e => {
    const config = automatisations.find(a => a.type === e.type)
    const echeance = config?.actif
      ? calculerEcheance(e.created_at, config.delai_heures, config.heure_cible_minutes)
      : null
    return {
      id: e.id,
      flux: LABELS_AUTOMATISATION[e.type] ?? e.type,
      clientNom: [e.clients?.prenom, e.clients?.nom].filter(Boolean).join(' ') || '—',
      clientEmail: e.clients?.email ?? '—',
      echeanceISO: echeance ? echeance.toISOString() : null,
    }
  })

  async function sauvegarder(
    type: string, actif: boolean, objet: string, corps: string,
    delaiHeures: number, heureCibleMinutes: number | null,
  ): Promise<{ erreur?: string }> {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { erreur: 'Non authentifié.' }
    const { error } = await supabase.from('automatisations').upsert({
      beatmaker_id: user.id,
      type,
      actif,
      objet: objet.trim() || null,
      corps: corps.trim() || null,
      delai_heures: delaiHeures >= 0 ? delaiHeures : 10,
      heure_cible_minutes: heureCibleMinutes,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'beatmaker_id,type' })
    if (error) {
      console.error('[automatisations] Erreur sauvegarde:', JSON.stringify(error))
      return { erreur: error.message }
    }
    revalidatePath('/dashboard/business/marketing/automatisations')
    return {}
  }

  async function executerMaintenant(evenementId: string) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const admin = createAdminClient()
    const { data: evenement } = await admin
      .from('automatisation_evenements')
      .select('id, beatmaker_id, client_id, type, reference_id, created_at')
      .eq('id', evenementId)
      .eq('beatmaker_id', user.id)
      .single()
    if (!evenement) return

    await traiterEvenementAutomatisation(evenement, { forcer: true })
    revalidatePath('/dashboard/business/marketing/automatisations')
  }

  async function previsualiser(evenementId: string): Promise<{ objet: string; corpsHtml: string } | { erreur: string }> {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { erreur: 'Non authentifié.' }

    const admin = createAdminClient()
    const { data: evenement } = await admin
      .from('automatisation_evenements')
      .select('beatmaker_id, client_id, type, reference_id')
      .eq('id', evenementId)
      .eq('beatmaker_id', user.id)
      .single()
    if (!evenement) return { erreur: 'Événement introuvable.' }

    return genererApercuAutomatisation(evenement as { beatmaker_id: string; client_id: string; type: TypeAutomatisation; reference_id: string })
  }

  async function supprimerEvenement(evenementId: string) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const admin = createAdminClient()
    await admin.from('automatisation_evenements').delete().eq('id', evenementId).eq('beatmaker_id', user.id)
    revalidatePath('/dashboard/business/marketing/automatisations')
  }

  return (
    <AutomatisationsClient
      automatisations={automatisations}
      sauvegarder={sauvegarder}
      fileAttente={fileAttente}
      executerMaintenant={executerMaintenant}
      previsualiser={previsualiser}
      supprimerEvenement={supprimerEvenement}
    />
  )
}
