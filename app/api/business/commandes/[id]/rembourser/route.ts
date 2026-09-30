import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { journaliserDecision } from '@/lib/decisions-log'
import { apercuRemboursement, rembourserCommande } from '@/lib/remboursement'

// Remboursement d'une commande par son propriétaire (A) — Phase 13, lot 4a.
// Commande entière seulement, solo comme collab (chaque vendeur rend SA part
// depuis son compte). Voir lib/remboursement.ts pour les règles.
// GET = aperçu pour la fenêtre de confirmation ; POST = remboursement (sert
// aussi à « Réessayer » : seules les parts encore dues sont relancées).

async function commandeDuProprietaire(commandeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, ok: false }
  const admin = createAdminClient()
  const { data } = await admin.from('commandes').select('id').eq('id', commandeId).eq('beatmaker_id', user.id).maybeSingle()
  return { user, ok: !!data }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commandeId } = await params
  const { user, ok } = await commandeDuProprietaire(commandeId)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!ok) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
  return NextResponse.json(await apercuRemboursement(createAdminClient(), commandeId))
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commandeId } = await params
  const { user, ok } = await commandeDuProprietaire(commandeId)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!ok) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  const resultat = await rembourserCommande(createAdminClient(), commandeId)
  if (resultat.erreur) return NextResponse.json({ error: resultat.erreur }, { status: 400 })

  await journaliserDecision({
    beatmakerId: user.id,
    actorType: 'beatmaker',
    actorId: user.id,
    entityType: 'commande',
    entityId: commandeId,
    action: 'remboursement',
    details: { statut: resultat.statut, echecs: resultat.echecs },
  })

  return NextResponse.json(resultat)
}
