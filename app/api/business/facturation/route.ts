import { createClient } from '@/utils/supabase/server'
import { MANDAT_FACTURATION_VERSION_ACTUELLE, formatFacturationValide } from '@/lib/facturation'
import { NextResponse } from 'next/server'

// Une seule route POST (pas de DELETE — cf. règle Vercel DELETE body), action
// explicite dans le corps. Même pattern que /api/stripe/fulfillment.
//
// Pas de journaliserDecision() ici : mandat_facturation_accepte_at et
// facturation_format_accepte_at sont déjà des colonnes dédiées qui datent
// l'acceptation/la modification, exactement comme fulfillment_mandat_accepte_at
// pour le mandat de fulfillment (jamais loggé non plus) — merchant_decisions_log
// reste réservé aux décisions qui engagent un tiers (remboursement, CGV,
// texte de licence...), pas aux réglages internes déjà auto-datés ailleurs.
//
// L'OFFSET (point de départ) est modifiable à tout moment, y compris en
// cours d'année — sans risque, puisque la valeur réellement utilisée pour
// une série déjà démarrée (beatmakers.facturation_offset) est une colonne
// distincte de celle qu'on modifie ici (facturation_offset_manuel), jamais
// relue une fois l'année en cours. Ce réglage représente donc toujours "ce
// qui sera utilisé à la prochaine transition d'année", jamais la série en
// cours elle-même — pas besoin de verrou artificiel (voir
// memory/project_phase8_numerotation_facture.md). Le FORMAT, lui, reste
// aussi modifiable en tout temps, avec un avertissement de confirmation
// côté client si des factures existent déjà cette année.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const body = await request.json() as {
    action?: 'accepter_mandat' | 'definir_format' | 'reinitialiser_format' | 'definir_offset'
    format?: string
    offsetMode?: 'aleatoire' | 'manuel'
    offsetManuel?: number
  }

  if (body.action === 'accepter_mandat') {
    const { error } = await supabase
      .from('beatmakers')
      .update({
        mandat_facturation_version: MANDAT_FACTURATION_VERSION_ACTUELLE,
        mandat_facturation_accepte_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
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
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'reinitialiser_format') {
    const { error } = await supabase
      .from('beatmakers')
      .update({ facturation_format: null, facturation_format_accepte_at: null })
      .eq('id', user.id)
    if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'definir_offset') {
    const mode = body.offsetMode
    if (mode !== 'aleatoire' && mode !== 'manuel') {
      return NextResponse.json({ erreur: 'Mode invalide.' }, { status: 400 })
    }
    if (mode === 'manuel' && (!Number.isInteger(body.offsetManuel) || (body.offsetManuel as number) < 1)) {
      return NextResponse.json({ erreur: "Le point de départ doit être un nombre entier d'au moins 1." }, { status: 400 })
    }

    // "Aléatoire" est désormais tiré immédiatement au clic (pas à la 1ère
    // facture) et stocké dans le même champ que le mode manuel — la
    // fonction Postgres n'a donc plus besoin de distinguer les deux cas,
    // elle utilise simplement la valeur déjà présente (voir
    // supabase/phase8_offset_immediat.sql). facturation_offset_mode reste
    // uniquement informatif (affichage "tiré au hasard" vs "choisi par toi").
    const valeur = mode === 'manuel' ? (body.offsetManuel as number) : (1000 + Math.floor(Math.random() * 8000))

    const { error } = await supabase
      .from('beatmakers')
      .update({
        facturation_offset_mode: mode,
        facturation_offset_manuel: valeur,
      })
      .eq('id', user.id)
    if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, valeur })
  }

  return NextResponse.json({ erreur: 'Action invalide' }, { status: 400 })
}
