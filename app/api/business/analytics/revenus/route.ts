import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getPeriodDates, inPeriod, getHistoriqueSlots } from '@/app/dashboard/business/analytics/_lib/periode'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { from, to, periode } = getPeriodDates(request)
  const admin = createAdminClient()

  const [{ data: allCommandes }, { data: beatmaker }] = await Promise.all([
    admin.from('commandes')
      .select('id, created_at, prix_paye, reduction_montant, code_promo')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'payee')
      .order('created_at', { ascending: false }),
    admin.from('beatmakers')
      .select('tva_active, tva_taux')
      .eq('id', user.id)
      .single(),
  ])

  const cmds = (allCommandes ?? []).filter(c => inPeriod(c.created_at, from, to))
  const tvaRate = beatmaker?.tva_active ? (beatmaker.tva_taux ?? 20) / 100 : 0

  const ventes_brutes = cmds.reduce((s, c) => s + c.prix_paye, 0)
  const remises_total = cmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
  const ca_promo      = cmds.filter(c => c.code_promo).reduce((s, c) => s + c.prix_paye, 0)
  const ventes_nettes = ventes_brutes - remises_total
  const tva           = tvaRate > 0 ? ventes_nettes - ventes_nettes / (1 + tvaRate) : 0

  // Moyennes par période
  const nbJours = cmds.length
    ? Math.max(1, Math.round((new Date(cmds[0].created_at).getTime() - new Date(cmds[cmds.length - 1].created_at).getTime()) / 86_400_000) + 1)
    : 1
  const avg_par_jour      = ventes_brutes / nbJours
  const avg_par_semaine   = avg_par_jour * 7
  const avg_par_mois      = avg_par_jour * 30.44
  const avg_par_trimestre = avg_par_jour * 91.31
  const avg_par_an        = avg_par_jour * 365

  // Table journalière (regrouper par date)
  const dayMap = new Map<string, { nb: number; brut: number; remises: number }>()
  for (const c of cmds) {
    const day = c.created_at.slice(0, 10)
    const ex  = dayMap.get(day) ?? { nb: 0, brut: 0, remises: 0 }
    ex.nb     += 1
    ex.brut   += c.prix_paye
    ex.remises += c.reduction_montant ?? 0
    dayMap.set(day, ex)
  }
  const jours = [...dayMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, v]) => {
      const brut    = v.brut
      const remises = v.remises
      const net     = brut - remises
      return {
        date,
        nb:      v.nb,
        brut,
        remises,
        net,
        tva:     tvaRate > 0 ? net - net / (1 + tvaRate) : 0,
      }
    })

  const dataFrom = periode === 'tout' ? (allCommandes ?? []).map(c => c.created_at).sort()[0] : undefined
  const slots = getHistoriqueSlots(periode, from, to, dataFrom)
  const historique = slots.map(slot => {
    const mCmds = (allCommandes ?? []).filter(c => c.created_at >= slot.from && c.created_at < slot.to)
    const brut  = mCmds.reduce((s, c) => s + c.prix_paye, 0)
    const rem   = mCmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
    const net   = brut - rem
    const promo = mCmds.filter(c => c.code_promo).reduce((s, c) => s + c.prix_paye, 0)
    return { label: slot.label, fullLabel: slot.fullLabel, brut, remises: rem, net, promo, tva: tvaRate > 0 ? net - net / (1 + tvaRate) : 0 }
  })

  return NextResponse.json({
    kpis: { ventes_brutes, ca_promo, remises_total, ventes_nettes, tva, avg_par_jour, avg_par_semaine, avg_par_mois, avg_par_trimestre, avg_par_an },
    jours,
    historique,
  })
}
