import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerRappelFinEssaiPlateforme } from '@/lib/emails'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function estAutorise(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

// Rappel de fin d'essai plateforme (J-3) — le seul des 5 emails "Mails My
// Producer" sans déclencheur webhook naturel, d'où ce cron dédié.
// rappel_essai_envoye_le empêche tout double envoi d'un jour à l'autre.
export async function GET(request: Request) {
  if (!estAutorise(request)) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const maintenant = new Date()
  const dansTroisJours = new Date(maintenant.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: abos } = await supabase
    .from('abonnements_plateforme')
    .select('id, beatmaker_id, essai_fin_le, periode, prix, beatmakers(email)')
    .eq('statut', 'en_essai')
    .is('rappel_essai_envoye_le', null)
    .lte('essai_fin_le', dansTroisJours)
    .gt('essai_fin_le', maintenant.toISOString())

  let envoyes = 0
  for (const abo of abos ?? []) {
    const beatmaker = Array.isArray(abo.beatmakers) ? abo.beatmakers[0] : abo.beatmakers
    if (!beatmaker?.email) continue

    await envoyerRappelFinEssaiPlateforme({
      to: beatmaker.email,
      beatmakerId: abo.beatmaker_id,
      periode: abo.periode,
      prixEuros: abo.prix / 100,
      essaiFinLe: abo.essai_fin_le,
    })
    await supabase.from('abonnements_plateforme').update({ rappel_essai_envoye_le: new Date().toISOString() }).eq('id', abo.id)
    envoyes++
  }

  return NextResponse.json({ ok: true, envoyes })
}
