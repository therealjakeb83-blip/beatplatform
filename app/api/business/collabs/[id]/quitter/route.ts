import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { chargerCollaboration, transitionnerCollaboration, journaliserCollaboration, emailDestinataireCollab } from '@/lib/collaboration'
import { envoyerCollabDepart } from '@/lib/emails'

// B quitte une collaboration active — Phase 12, lot 3 (Q21 du grill-me).
// Le beat reste vendable (par A) et A repasse à 100% (calculé par le trigger
// recalculer_collaboration_beat, posé au lot 1) ; les ventes passées ne
// changent pas. Jamais de pause après un départ.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const collab = await chargerCollaboration(admin, id)
  if (!collab) return NextResponse.json({ erreur: 'Collaboration introuvable' }, { status: 404 })
  if (collab.beatmaker_id !== user.id) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 403 })

  const resultat = await transitionnerCollaboration(admin, { id, action: 'quitter' })
  if (!resultat.ok) return NextResponse.json({ erreur: resultat.erreur }, { status: 400 })

  const { data: collaborateurBm } = await admin.from('beatmakers').select('nom_artiste').eq('id', user.id).maybeSingle()
  const nomCollaborateur = (collaborateurBm?.nom_artiste as string | undefined) ?? 'Un beatmaker'

  await journaliserCollaboration({
    action: 'depart',
    collaborationId: id,
    proprietaireId: collab.beat.beatmaker_id,
    acteurId: user.id,
    collaborateurId: user.id,
    details: { beat_id: collab.beat.id, titre_beat: collab.beat.titre, pourcentage: collab.pourcentage },
  })

  const destinataire = await emailDestinataireCollab(admin, { beatmaker_id: collab.beat.beatmaker_id, email_invite: null })
  if (destinataire) {
    await envoyerCollabDepart({ to: destinataire, beatmakerId: collab.beat.beatmaker_id, nomCollaborateur, titreBeat: collab.beat.titre })
  }

  return NextResponse.json({ ok: true })
}
