import { createClient } from '@/utils/supabase/server'
import { MANDAT_FACTURATION_VERSION_ACTUELLE, formatFacturationValide } from '@/lib/facturation'
import { journaliserDecision } from '@/lib/decisions-log'
import { NextResponse } from 'next/server'

// Une seule route POST (pas de DELETE — cf. règle Vercel DELETE body), action
// explicite dans le corps. Même pattern que /api/stripe/fulfillment.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const body = await request.json() as { action?: 'accepter_mandat' | 'definir_format' | 'reinitialiser_format'; format?: string }

  if (body.action === 'accepter_mandat') {
    const { error } = await supabase
      .from('beatmakers')
      .update({
        mandat_facturation_version: MANDAT_FACTURATION_VERSION_ACTUELLE,
        mandat_facturation_accepte_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })

    // Décision commerciale/légale — preuve de la séparation des rôles
    // (Phase 7, merchant_decisions_log), même principe que l'acceptation
    // d'une page légale ou la modification d'un texte de licence.
    await journaliserDecision({
      beatmakerId: user.id,
      actorType: 'beatmaker',
      actorId: user.id,
      entityType: 'boutique',
      entityId: user.id,
      action: 'acceptation_mandat_facturation',
      referenceVersion: String(MANDAT_FACTURATION_VERSION_ACTUELLE),
    })

    return NextResponse.json({ ok: true })
  }

  if (body.action === 'definir_format') {
    const format = (body.format ?? '').trim()
    if (!formatFacturationValide(format)) {
      return NextResponse.json({ erreur: 'Format invalide — {NUM} doit apparaître exactement une fois, aucune autre variable dupliquée.' }, { status: 400 })
    }
    const { error } = await supabase
      .from('beatmakers')
      .update({ facturation_format: format, facturation_format_accepte_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })

    await journaliserDecision({
      beatmakerId: user.id,
      actorType: 'beatmaker',
      actorId: user.id,
      entityType: 'boutique',
      entityId: user.id,
      action: 'modification_numerotation_facture',
      details: { format },
    })

    return NextResponse.json({ ok: true })
  }

  if (body.action === 'reinitialiser_format') {
    const { error } = await supabase
      .from('beatmakers')
      .update({ facturation_format: null, facturation_format_accepte_at: null })
      .eq('id', user.id)
    if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })

    await journaliserDecision({
      beatmakerId: user.id,
      actorType: 'beatmaker',
      actorId: user.id,
      entityType: 'boutique',
      entityId: user.id,
      action: 'reinitialisation_numerotation_facture',
    })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ erreur: 'Action invalide' }, { status: 400 })
}
