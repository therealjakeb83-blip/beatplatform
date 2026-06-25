import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getPeriodDates, inPeriod, getLast12Months } from '@/app/dashboard/business/analytics/_lib/periode'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { from, to } = getPeriodDates(request)
  const admin = createAdminClient()

  const [
    { data: allBeats },
    { data: allCommandes },
    { data: allPlays },
    { data: allFreeDl },
  ] = await Promise.all([
    admin.from('beats')
      .select('id, titre, couleur, styles')
      .eq('beatmaker_id', user.id)
      .is('supprime_le', null)
      .order('created_at', { ascending: false }),
    admin.from('commandes')
      .select('beat_id, prix_paye, created_at')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'payee')
      .eq('type_commande', 'LICENCE'),
    admin.from('beat_plays')
      .select('beat_id, played_at')
      .eq('beatmaker_id', user.id),
    admin.from('free_downloads')
      .select('beat_id, downloaded_at')
      .eq('beatmaker_id', user.id),
  ])

  const beats   = allBeats ?? []
  const cmds    = (allCommandes ?? []).filter(c => inPeriod(c.created_at,    from, to))
  const plays   = (allPlays    ?? []).filter(p => inPeriod(p.played_at,      from, to))
  const freeDl  = (allFreeDl   ?? []).filter(f => inPeriod(f.downloaded_at,  from, to))

  // Map par beat_id
  const caMap    = new Map<string, number>()
  const vMap     = new Map<string, number>()
  const playsMap = new Map<string, number>()
  const dlMap    = new Map<string, number>()

  for (const c of cmds) {
    if (!c.beat_id) continue
    caMap.set(c.beat_id, (caMap.get(c.beat_id) ?? 0) + c.prix_paye)
    vMap.set(c.beat_id,  (vMap.get(c.beat_id)  ?? 0) + 1)
  }
  for (const p of plays) {
    if (!p.beat_id) continue
    playsMap.set(p.beat_id, (playsMap.get(p.beat_id) ?? 0) + 1)
  }
  for (const f of freeDl) {
    if (!f.beat_id) continue
    dlMap.set(f.beat_id, (dlMap.get(f.beat_id) ?? 0) + 1)
  }

  const beatRows = beats.map(b => {
    const ca      = caMap.get(b.id) ?? 0
    const ventes  = vMap.get(b.id) ?? 0
    const ecoutes = playsMap.get(b.id) ?? 0
    const free_dl = dlMap.get(b.id) ?? 0
    const conv    = ecoutes > 0 ? (ventes / ecoutes) * 100 : 0
    return { id: b.id, titre: b.titre, couleur: b.couleur, styles: b.styles ?? [], ca, ventes, ecoutes, free_dl, conv }
  })

  // KPIs globaux
  const totalCa    = beatRows.reduce((s, b) => s + b.ca, 0)
  const totalVentes = beatRows.reduce((s, b) => s + b.ventes, 0)
  const totalEcoutes = beatRows.reduce((s, b) => s + b.ecoutes, 0)
  const totalDl    = beatRows.reduce((s, b) => s + b.free_dl, 0)
  const nbBeats    = beats.length || 1
  const ca_moy_par_beat   = totalCa / nbBeats
  const cmdes_moy_par_beat = totalVentes / nbBeats

  // Historique 12 mois
  const mois12 = getLast12Months()
  const historique = mois12.map(({ year, month, label, fullLabel }) => {
    const start = new Date(year, month, 1).toISOString()
    const end   = new Date(year, month + 1, 1).toISOString()
    const mCmds   = (allCommandes ?? []).filter(c => c.created_at    >= start && c.created_at    < end)
    const mPlays  = (allPlays    ?? []).filter(p => p.played_at      >= start && p.played_at      < end)
    const mFreeDl = (allFreeDl   ?? []).filter(f => f.downloaded_at  >= start && f.downloaded_at  < end)
    return {
      label,
      fullLabel,
      ca:      mCmds.reduce((s, c) => s + c.prix_paye, 0),
      ventes:  mCmds.length,
      ecoutes: mPlays.length,
      free_dl: mFreeDl.length,
    }
  })

  return NextResponse.json({
    kpis: { ca_moy_par_beat, cmdes_moy_par_beat, ecoutes: totalEcoutes, free_dl: totalDl },
    historique,
    beats: beatRows,
  })
}
