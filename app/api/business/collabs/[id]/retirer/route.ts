import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { chargerCollaboration, transitionnerCollaboration, journaliserCollaboration, emailDestinataireCollab } from '@/lib/collaboration'
import { envoyerCollabRetrait } from '@/lib/emails'

// A retire une invitation (encore 'invitee' ou déjà 'refusee') — Phase 12, lot 3.
// Sortie de secours de la Q3 du grill-me : si c'était la dernière collaboration
// ouverte sur ce beat, il repart automatiquement en vente solo (trigger
// recalculer_collaboration_beat, posé au lot 1 — rien à faire ici).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const collab = await chargerCollaboration(admin, id)
  if (!collab) return NextResponse.json({ erreur: 'Collaboration introuvable' }, { status: 404 })
  if (collab.beat.beatmaker_id !== user.id) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 403 })

  const resultat = await transitionnerCollaboration(admin, { id, action: 'retirer' })
  if (!resultat.ok) return NextResponse.json({ erreur: resultat.erreur }, { status: 400 })

  await journaliserCollaboration({
    action: 'retrait_invitation',
    collaborationId: id,
    proprietaireId: collab.beat.beatmaker_id,
    acteurId: user.id,
    collaborateurId: collab.beatmaker_id,
    details: { beat_id: collab.beat.id, titre_beat: collab.beat.titre, pourcentage: collab.pourcentage },
  })

  const destinataire = await emailDestinataireCollab(admin, collab)
  if (destinataire) {
    await envoyerCollabRetrait({ to: destinataire, beatmakerId: collab.beat.beatmaker_id, nomProprietaire: collab.beat.nom_artiste, titreBeat: collab.beat.titre })
  }

  return NextResponse.json({ ok: true })
}
