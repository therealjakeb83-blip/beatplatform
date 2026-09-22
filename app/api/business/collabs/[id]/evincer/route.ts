import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { chargerCollaboration, transitionnerCollaboration, journaliserCollaboration, emailDestinataireCollab } from '@/lib/collaboration'
import { envoyerCollabEviction } from '@/lib/emails'

// A évince un collaborateur actif — Phase 12, lot 3 (Q21 du grill-me) : motif
// obligatoire, journalisé, B prévenu immédiatement. Même effet que "quitter"
// (A repasse à 100%, ventes passées inchangées) mais déclenché par A.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const motif = typeof body?.motif === 'string' ? body.motif.trim() : ''
  if (!motif) return NextResponse.json({ erreur: 'Indique un motif pour l’éviction.' }, { status: 400 })

  const admin = createAdminClient()
  const collab = await chargerCollaboration(admin, id)
  if (!collab) return NextResponse.json({ erreur: 'Collaboration introuvable' }, { status: 404 })
  if (collab.beat.beatmaker_id !== user.id) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 403 })

  const resultat = await transitionnerCollaboration(admin, { id, action: 'evincer', extra: { motif_eviction: motif } })
  if (!resultat.ok) return NextResponse.json({ erreur: resultat.erreur }, { status: 400 })

  await journaliserCollaboration({
    action: 'eviction',
    collaborationId: id,
    proprietaireId: collab.beat.beatmaker_id,
    acteurId: user.id,
    collaborateurId: collab.beatmaker_id,
    motif,
    details: { beat_id: collab.beat.id, titre_beat: collab.beat.titre, pourcentage: collab.pourcentage },
  })

  const destinataire = await emailDestinataireCollab(admin, { beatmaker_id: collab.beatmaker_id, email_invite: null })
  if (destinataire) {
    await envoyerCollabEviction({ to: destinataire, beatmakerId: collab.beat.beatmaker_id, nomProprietaire: collab.beat.nom_artiste, titreBeat: collab.beat.titre, motif })
  }

  return NextResponse.json({ ok: true })
}
