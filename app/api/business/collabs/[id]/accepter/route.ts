import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { chargerCollaboration, transitionnerCollaboration, journaliserCollaboration, emailDestinataireCollab } from '@/lib/collaboration'
import { CONDITIONS_COLLAB_VERSION_ACTUELLE } from '@/lib/collaboration-conditions'
import { envoyerCollabAcceptee } from '@/lib/emails'

// B accepte l'invitation — Phase 12, lot 3. Acceptation = UN texte + UNE case
// (Q8/Q10 du grill-me) : le client envoie `accepte: true` seulement après que
// B a coché la case sur la page Collaborations. La version acceptée et la
// date sont enregistrées comme preuve (beat_splits.conditions_version,
// accepte_le) — pas de ré-acceptation forcée pour l'instant.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (body?.accepte !== true) {
    return NextResponse.json({ erreur: 'Tu dois cocher la case pour accepter la collaboration.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: { user: fullUser } } = await admin.auth.admin.getUserById(user.id)
  const userEmail = fullUser?.email?.toLowerCase() ?? null

  const collab = await chargerCollaboration(admin, id)
  if (!collab) return NextResponse.json({ erreur: 'Collaboration introuvable' }, { status: 404 })

  const estDestinataire = collab.beatmaker_id === user.id || (!!collab.email_invite && collab.email_invite === userEmail)
  if (!estDestinataire) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 403 })

  const resultat = await transitionnerCollaboration(admin, {
    id,
    action: 'accepter',
    extra: {
      conditions_version: CONDITIONS_COLLAB_VERSION_ACTUELLE,
      quote_part_acceptee: collab.pourcentage,
      // Lie définitivement l'invitation au compte qui accepte, y compris si
      // elle était encore une invitation par email (cas B pas encore inscrit
      // au moment de l'invitation, inscrit depuis).
      beatmaker_id: user.id,
      email_invite: null,
    },
  })
  if (!resultat.ok) return NextResponse.json({ erreur: resultat.erreur }, { status: 400 })

  const { data: collaborateurBm } = await admin.from('beatmakers').select('nom_artiste').eq('id', user.id).maybeSingle()
  const nomCollaborateur = (collaborateurBm?.nom_artiste as string | undefined) ?? 'Un beatmaker'

  await journaliserCollaboration({
    action: 'acceptation',
    collaborationId: id,
    proprietaireId: collab.beat.beatmaker_id,
    acteurId: user.id,
    collaborateurId: user.id,
    conditionsVersion: CONDITIONS_COLLAB_VERSION_ACTUELLE,
    details: { beat_id: collab.beat.id, titre_beat: collab.beat.titre, pourcentage: collab.pourcentage },
  })

  const destinataire = await emailDestinataireCollab(admin, { beatmaker_id: collab.beat.beatmaker_id, email_invite: null })
  if (destinataire) {
    await envoyerCollabAcceptee({
      to: destinataire,
      beatmakerId: collab.beat.beatmaker_id,
      nomCollaborateur,
      titreBeat: collab.beat.titre,
      pourcentage: collab.pourcentage,
    })
  }

  return NextResponse.json({ ok: true })
}
