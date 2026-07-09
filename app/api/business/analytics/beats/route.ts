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
    // Niveau article — un panier de plusieurs beats donne plusieurs lignes, chacune attribuée à son beat
    admin.from('commande_lignes')
      .select('beat_id, prix_paye, created_at, commandes!inner(beatmaker_id, statut)')
      .eq('commandes.beatmaker_id', user.id)
      .eq('commandes.statut', 'payee'),
    admin.from('beat_plays')
      .select('beat_id, played_at, duree_secondes')
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
  const caMap      = new Map<string, number>()
  const vMap       = new Map<string, number>()
  const playsMap   = new Map<string, number>()
  const dlMap      = new Map<string, number>()
  const dureeMap   = new Map<string, number[]>() // durees non-null par beat

  for (const c of cmds) {
    if (!c.beat_id) continue
    caMap.set(c.beat_id, (caMap.get(c.beat_id) ?? 0) + c.prix_paye)
    vMap.set(c.beat_id,  (vMap.get(c.beat_id)  ?? 0) + 1)
  }
  for (const p of plays) {
    if (!p.beat_id) continue
    playsMap.set(p.beat_id, (playsMap.get(p.beat_id) ?? 0) + 1)
    const d = (p as Record<string, unknown>).duree_secondes as number | null
    if (d != null) {
      const arr = dureeMap.get(p.beat_id) ?? []
      arr.push(d)
      dureeMap.set(p.beat_id, arr)
    }
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
    const durees  = dureeMap.get(b.id) ?? []
    const duree_moy = durees.length > 0 ? Math.round(durees.reduce((s, d) => s + d, 0) / durees.length) : null
    return { id: b.id, titre: b.titre, couleur: b.couleur, styles: b.styles ?? [], ca, ventes, ecoutes, free_dl, duree_moy }
  })

  // KPIs globaux
  const totalCa      = beatRows.reduce((s, b) => s + b.ca, 0)
  const totalVentes  = beatRows.reduce((s, b) => s + b.ventes, 0)
  const totalEcoutes = beatRows.reduce((s, b) => s + b.ecoutes, 0)
  const totalDl      = beatRows.reduce((s, b) => s + b.free_dl, 0)
  const nbBeats      = beats.length || 1
  const ca_moy_par_beat    = totalCa / nbBeats
  const cmdes_moy_par_beat = totalVentes / nbBeats
  const toutesLesDurees    = [...dureeMap.values()].flat()
  const duree_moy_globale  = toutesLesDurees.length > 0
    ? Math.round(toutesLesDurees.reduce((s, d) => s + d, 0) / toutesLesDurees.length)
    : null

  const dataFrom = periode === 'tout' ? (allCommandes ?? []).map(c => c.created_at).sort()[0] : undefined
  const slots = getHistoriqueSlots(periode, from, to, dataFrom)
  const historique = slots.map(slot => {
    const mCmds   = (allCommandes ?? []).filter(c => c.created_at   >= slot.from && c.created_at   < slot.to)
    const mPlays  = (allPlays    ?? []).filter(p => p.played_at     >= slot.from && p.played_at     < slot.to)
    const mFreeDl = (allFreeDl   ?? []).filter(f => f.downloaded_at >= slot.from && f.downloaded_at < slot.to)
    return {
      label:   slot.label,
      fullLabel: slot.fullLabel,
      ca:      mCmds.reduce((s, c) => s + c.prix_paye, 0),
      ventes:  mCmds.length,
      ecoutes: mPlays.length,
      free_dl: mFreeDl.length,
    }
  })

  return NextResponse.json({
    kpis: { ca_moy_par_beat, cmdes_moy_par_beat, ecoutes: totalEcoutes, free_dl: totalDl, duree_moy_globale },
    historique,
    beats: beatRows,
  })
}
