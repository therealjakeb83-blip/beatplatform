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
      .select('id, created_at, prix_paye, reduction_montant')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'payee')
      .order('created_at', { ascending: false }),
    admin.from('beatmakers')
      .select('tva_active, tva_taux')
      .eq('id', user.id)
      .single(),
  ])

  const cmds = (allCommandes ?? []).filter(c => inPeriod(c.created_at, from, to))
  const tvaTaux = beatmaker?.tva_active ? (beatmaker.tva_taux ?? 20) : 0
  const tvaRate = tvaTaux / 100

  // CA net = CA HT (TTC après remises, TVA retirée) — la TVA collectée n'appartient pas au beatmaker
  const splitTva = (ttc: number) => {
    const tva = tvaRate > 0 ? ttc - ttc / (1 + tvaRate) : 0
    return { tva, net: ttc - tva }
  }

  const ventes_brutes = cmds.reduce((s, c) => s + c.prix_paye, 0)
  const remises_total = cmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
  const { tva, net: ventes_nettes } = splitTva(ventes_brutes - remises_total)

  // Moyennes par période
  const nbJours = cmds.length
    ? Math.max(1, Math.round((new Date(cmds[0].created_at).getTime() - new Date(cmds[cmds.length - 1].created_at).getTime()) / 86_400_000) + 1)
    : 1
  const avg_brut_jour = ventes_brutes / nbJours
  const avg_net_jour  = ventes_nettes / nbJours
  const moy_brut = {
    jour: avg_brut_jour, semaine: avg_brut_jour * 7, mois: avg_brut_jour * 30.44,
    trimestre: avg_brut_jour * 91.31, an: avg_brut_jour * 365,
  }
  const moy_net = {
    jour: avg_net_jour, semaine: avg_net_jour * 7, mois: avg_net_jour * 30.44,
    trimestre: avg_net_jour * 91.31, an: avg_net_jour * 365,
  }

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
      const { tva, net } = splitTva(brut - remises)
      return { date, nb: v.nb, brut, remises, net, tva }
    })

  const dataFrom = periode === 'tout' ? (allCommandes ?? []).map(c => c.created_at).sort()[0] : undefined
  const slots = getHistoriqueSlots(periode, from, to, dataFrom)
  const historique = slots.map(slot => {
    const mCmds = (allCommandes ?? []).filter(c => c.created_at >= slot.from && c.created_at < slot.to)
    const brut  = mCmds.reduce((s, c) => s + c.prix_paye, 0)
    const rem   = mCmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
    const { tva, net } = splitTva(brut - rem)
    return { label: slot.label, fullLabel: slot.fullLabel, brut, remises: rem, net, tva }
  })

  return NextResponse.json({
    kpis: { ventes_brutes, remises_total, ventes_nettes, tva, tva_taux: tvaTaux, moy_brut, moy_net },
    jours,
    historique,
  })
}
