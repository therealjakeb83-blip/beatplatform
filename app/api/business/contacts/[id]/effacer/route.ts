import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { clientLieABoutique } from '@/app/dashboard/business/_lib/appartenance'
import { journaliserDecision } from '@/lib/decisions-log'

// « Effacer ce contact » (9d lot 4) : geste du beatmaker, dans SA boutique
// seulement (Sonoo, sous-traitant, n'efface jamais à sa place). Tout se fait
// en une transaction dans effacer_contact_boutique : fiche vidée, contact
// caché partout, on garde sur les ventes seulement ce qui est sur la facture.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: beatmaker } = await supabase.from('beatmakers').select('id').eq('id', user.id).maybeSingle()
  if (!beatmaker) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  // Requête JSON seulement : un formulaire d'un autre site ne peut pas l'envoyer
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 415 })
  }
  const body = await req.json().catch(() => ({}))
  if (body?.confirmation !== 'EFFACER') {
    return NextResponse.json({ error: 'Tape EFFACER pour confirmer.' }, { status: 400 })
  }

  if (!/^[0-9a-f-]{36}$/i.test(clientId) || !(await clientLieABoutique(supabase, user.id, clientId))) {
    return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('effacer_contact_boutique', { p_beatmaker_id: user.id, p_client_id: clientId })
  if (error) {
    if (error.message?.includes('abonnement_actif')) {
      return NextResponse.json({
        error: "Ce contact a un abonnement actif. Annule d'abord son abonnement (page Abonnements), puis efface-le.",
      }, { status: 409 })
    }
    if (error.message?.includes('contact_hors_boutique')) {
      return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
    }
    console.error('[contacts/effacer] rpc:', JSON.stringify(error))
    return NextResponse.json({ error: "L'effacement a échoué, rien n'a été modifié. Réessaie." }, { status: 500 })
  }

  // Trace du geste (sans aucune donnée personnelle : seulement des compteurs)
  const r = (data ?? {}) as { client_id?: string; fiches?: number; commandes?: number; telechargements?: number }
  await journaliserDecision({
    beatmakerId: user.id,
    actorType: 'beatmaker',
    actorId: user.id,
    entityType: 'client',
    entityId: r.client_id ?? clientId,
    action: 'contact_efface',
    details: { fiches: r.fiches ?? 0, commandes: r.commandes ?? 0, telechargements: r.telechargements ?? 0 },
  })

  return NextResponse.json({ ok: true, clientId: r.client_id ?? clientId })
}
