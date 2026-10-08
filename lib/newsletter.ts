import { createAdminClient } from '@/utils/supabase/admin'

import {
  normaliserStatut,
  type OrigineStatutNewsletter, type SourceLead, type StatutNewsletter,
} from './newsletter-statut'

export * from './newsletter-statut'

type Admin = ReturnType<typeof createAdminClient>

export async function lireStatutNewsletter(admin: Admin, clientId: string, beatmakerId: string): Promise<StatutNewsletter> {
  const { data } = await admin
    .from('leads')
    .select('newsletter_statut')
    .eq('client_id', clientId)
    .eq('beatmaker_id', beatmakerId)
    .maybeSingle()
  return normaliserStatut(data?.newsletter_statut)
}

async function ecrireStatut(
  admin: Admin,
  params: { clientId: string; beatmakerId: string; statut: StatutNewsletter; origine: OrigineStatutNewsletter; sourceLead: SourceLead },
): Promise<{ leadCree: boolean; leadId: string | null }> {
  const maj = {
    newsletter_statut: params.statut,
    newsletter_statut_at: new Date().toISOString(),
    newsletter_statut_source: params.origine,
  }
  const { data: lead } = await admin
    .from('leads')
    .select('id')
    .eq('client_id', params.clientId)
    .eq('beatmaker_id', params.beatmakerId)
    .maybeSingle()

  if (lead) {
    const { error } = await admin.from('leads').update(maj).eq('id', lead.id)
    if (error) console.error('[newsletter] Erreur mise à jour statut:', JSON.stringify(error))
    return { leadCree: false, leadId: lead.id }
  }

  const { data: cree, error } = await admin
    .from('leads')
    .insert({ client_id: params.clientId, beatmaker_id: params.beatmakerId, source: params.sourceLead, ...maj })
    .select('id')
    .single()
  if (error) {
    console.error('[newsletter] Erreur création lead:', JSON.stringify(error))
    return { leadCree: false, leadId: null }
  }
  return { leadCree: true, leadId: cree.id }
}

// Geste du client lui-même sur CETTE boutique (formulaire, case au paiement,
// case free download, Mon compte, case à l'inscription) : seul chemin qui peut
// faire repasser un désinscrit à « inscrit ».
export async function inscrireParClient(
  admin: Admin,
  params: { clientId: string; beatmakerId: string; origine: Exclude<OrigineStatutNewsletter, 'beatmaker' | 'lien_desinscription'>; sourceLead: SourceLead },
) {
  return ecrireStatut(admin, { ...params, statut: 'inscrit' })
}

export async function desinscrireParClient(
  admin: Admin,
  params: { clientId: string; beatmakerId: string; origine: 'mon_compte' | 'lien_desinscription'; sourceLead?: SourceLead },
) {
  return ecrireStatut(admin, { ...params, statut: 'desinscrit', sourceLead: params.sourceLead ?? 'visite' })
}

// Action du beatmaker (fiche client, ajout manuel) : ne peut JAMAIS inscrire
// quelqu'un qui s'est désinscrit lui-même. Sa désinscription manuelle remet en
// « non inscrit » (décision de Jake, 2026-10-08) : « désinscrit » est réservé
// au geste du client.
export async function changerStatutParBeatmaker(
  admin: Admin,
  params: { clientId: string; beatmakerId: string; inscrire: boolean; sourceLead?: SourceLead },
): Promise<{ ok: true } | { ok: false; raison: 'desinscrit_par_le_client' }> {
  if (params.inscrire) {
    const actuel = await lireStatutNewsletter(admin, params.clientId, params.beatmakerId)
    if (actuel === 'desinscrit') return { ok: false, raison: 'desinscrit_par_le_client' }
  }
  await ecrireStatut(admin, {
    clientId: params.clientId,
    beatmakerId: params.beatmakerId,
    statut: params.inscrire ? 'inscrit' : 'non_inscrit',
    origine: 'beatmaker',
    sourceLead: params.sourceLead ?? 'manuel',
  })
  return { ok: true }
}
