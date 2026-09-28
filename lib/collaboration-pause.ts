import type { SupabaseClient } from '@supabase/supabase-js'
import { envoyerCollabPause } from '@/lib/emails'
import { emailDestinataireCollab } from '@/lib/collaboration'

type SplitActif = { beat_id: string; beatmaker_id: string | null; email_invite: string | null }
type BeatCourt = { id: string; titre: string; beatmaker_id: string }

/**
 * Q15 du grill-me + retour de Jake au test T2 (lot 4) : quand un vendeur
 * n'est plus éligible aux paiements, chaque beat collab où il vend est retiré
 * de la vente (par la base) et tous les vendeurs de ce beat sont prévenus
 * (A et B). Appelé par lib/pret-a-vendre-suivi.ts au passage prêt → pas prêt,
 * seulement pour le ou les rôles réellement perdus.
 */
export async function notifierPauseCollab(
  admin: SupabaseClient,
  vendeurId: string,
  roles: { commeProprietaire: boolean; commeCollaborateur: boolean },
): Promise<void> {
  const [{ data: vendeur }, { data: commeProprietaire }, { data: commeCollaborateur }] = await Promise.all([
    admin.from('beatmakers').select('nom_artiste').eq('id', vendeurId).maybeSingle(),
    roles.commeProprietaire
      ? admin.from('beats').select('id').eq('beatmaker_id', vendeurId).is('supprime_le', null)
      : Promise.resolve({ data: [] }),
    roles.commeCollaborateur
      ? admin.from('beat_splits').select('beat_id').eq('beatmaker_id', vendeurId).eq('statut', 'active')
      : Promise.resolve({ data: [] }),
  ])
  const candidats = [
    ...((commeProprietaire ?? []) as { id: string }[]).map(b => b.id),
    ...((commeCollaborateur ?? []) as { beat_id: string }[]).map(s => s.beat_id),
  ]
  if (candidats.length === 0) return

  const { data: splits } = await admin
    .from('beat_splits')
    .select('beat_id, beatmaker_id, email_invite')
    .in('beat_id', [...new Set(candidats)])
    .eq('statut', 'active')
  const actifsParBeat = new Map<string, SplitActif[]>()
  for (const s of (splits ?? []) as SplitActif[]) {
    actifsParBeat.set(s.beat_id, [...(actifsParBeat.get(s.beat_id) ?? []), s])
  }
  if (actifsParBeat.size === 0) return

  const { data: beats } = await admin
    .from('beats')
    .select('id, titre, beatmaker_id')
    .in('id', [...actifsParBeat.keys()])
    .is('supprime_le', null)

  const nomVendeur = (vendeur?.nom_artiste as string | undefined) ?? 'Un vendeur'
  for (const beat of (beats ?? []) as BeatCourt[]) {
    const destinataires = [
      { beatmaker_id: beat.beatmaker_id, email_invite: null, estProprietaire: true },
      ...(actifsParBeat.get(beat.id) ?? []).map(s => ({ ...s, estProprietaire: false })),
    ]
    for (const d of destinataires) {
      const to = await emailDestinataireCollab(admin, d)
      if (!to) continue
      await envoyerCollabPause({
        to,
        beatmakerId: beat.beatmaker_id,
        titreBeat: beat.titre,
        nomVendeurConcerne: nomVendeur,
        estLeVendeurConcerne: d.beatmaker_id === vendeurId,
        estProprietaire: d.estProprietaire,
      })
    }
  }
}
