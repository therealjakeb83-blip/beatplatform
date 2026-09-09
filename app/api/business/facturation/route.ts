import { createClient } from '@/utils/supabase/server'
import { MANDAT_FACTURATION_VERSION_ACTUELLE, formatFacturationValide } from '@/lib/facturation'
import { getZonedParts, fuseauSur } from '@/lib/fuseau-horaire'
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
// Distinction volontaire entre les deux réglages de numérotation : le
// FORMAT (ordre des variables) reste modifiable en tout temps — l'avertissement
// sur la cohérence visuelle de l'historique est affiché et confirmé côté
// client (FacturationClient.tsx) avant l'appel. L'OFFSET, lui, est
// entièrement verrouillé côté serveur dès que la série de l'année en cours
// a démarré — aucune confirmation ne peut passer outre, contrairement au
// format (voir memory/project_phase8_numerotation_facture.md).
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

    // Verrouillé dès que la série de l'année en cours a démarré (au moins
    // une facture déjà émise) — jamais de modification a posteriori, quelle
    // que soit la demande, pour ne jamais casser une continuité déjà entamée.
    const { data: beatmaker } = await supabase
      .from('beatmakers')
      .select('facturation_annee_courante, fuseau_horaire')
      .eq('id', user.id)
      .single()

    const anneeCourante = getZonedParts(new Date(), fuseauSur(beatmaker?.fuseau_horaire)).year
    if (beatmaker?.facturation_annee_courante === anneeCourante) {
      return NextResponse.json({ erreur: 'Le point de départ de cette année est déjà fixé — une facture a déjà été émise. Modifiable à nouveau au 1er janvier prochain.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('beatmakers')
      .update({
        facturation_offset_mode: mode,
        facturation_offset_manuel: mode === 'manuel' ? body.offsetManuel : null,
      })
      .eq('id', user.id)
    if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ erreur: 'Action invalide' }, { status: 400 })
}
