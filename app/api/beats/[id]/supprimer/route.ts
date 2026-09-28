import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { emailDestinataireCollab, journaliserCollaboration, transitionnerCollaboration } from '@/lib/collaboration'
import { envoyerCollabBeatSupprime } from '@/lib/emails'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params

  const { data: supprimes, error } = await supabase.from('beats')
    .update({ supprime_le: new Date().toISOString() })
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .is('supprime_le', null)
    .select('id, titre')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  const beat = supprimes?.[0]
  if (beat) await prevenirCollaborateurs(user.id, beat.id as string, beat.titre as string)
  return Response.json({ success: true })
}

// Q4 du grill-me Phase 12 : A peut supprimer un beat collab quand il veut
// (suppression douce, tout l'historique reste). Les collaborateurs invités ou
// actifs sont prévenus ; une invitation encore en attente devient caduque.
// Un refus n'est pas notifié (B a déjà dit non).
async function prevenirCollaborateurs(proprietaireId: string, beatId: string, titreBeat: string) {
  const admin = createAdminClient()
  const { data: splits } = await admin
    .from('beat_splits')
    .select('id, statut, beatmaker_id, email_invite, pourcentage')
    .eq('beat_id', beatId)
    .in('statut', ['invitee', 'active'])
  if (!splits || splits.length === 0) return

  const { data: proprietaire } = await admin.from('beatmakers').select('nom_artiste').eq('id', proprietaireId).maybeSingle()
  const nomProprietaire = (proprietaire?.nom_artiste as string | undefined) ?? 'Le propriétaire'

  for (const s of splits as { id: string; statut: string; beatmaker_id: string | null; email_invite: string | null; pourcentage: number }[]) {
    if (s.statut === 'invitee') {
      const resultat = await transitionnerCollaboration(admin, { id: s.id, action: 'retirer' })
      if (resultat.ok) {
        await journaliserCollaboration({
          action: 'retrait_invitation',
          collaborationId: s.id,
          proprietaireId,
          acteurId: proprietaireId,
          collaborateurId: s.beatmaker_id,
          details: { beat_id: beatId, titre_beat: titreBeat, pourcentage: s.pourcentage, beat_supprime: true },
        })
      }
    }
    const destinataire = await emailDestinataireCollab(admin, s)
    if (destinataire) {
      await envoyerCollabBeatSupprime({ to: destinataire, beatmakerId: proprietaireId, nomProprietaire, titreBeat })
    }
  }
}
