import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { journaliserDecision } from '@/lib/decisions-log'
import { annulerCommande } from '@/lib/remboursement'

// « Annuler la commande » (Phase 13, lot 4a) — seulement pour une commande à
// 0 € (beat offert) : rien à rembourser, mais la licence est révoquée et
// l'accès aux fichiers fermé. Une commande payante se rembourse.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commandeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()
  const { data: commande } = await admin.from('commandes').select('id').eq('id', commandeId).eq('beatmaker_id', user.id).maybeSingle()
  if (!commande) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  const resultat = await annulerCommande(admin, commandeId)
  if (!resultat.ok) return NextResponse.json({ error: resultat.erreur }, { status: 400 })

  await journaliserDecision({
    beatmakerId: user.id,
    actorType: 'beatmaker',
    actorId: user.id,
    entityType: 'commande',
    entityId: commandeId,
    action: 'annulation',
    details: {},
  })

  return NextResponse.json({ ok: true })
}
