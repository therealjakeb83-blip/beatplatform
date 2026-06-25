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
    { data: allCommandes },
    { data: allPlays },
    { data: allFreeDl },
    { data: allCollabs },
    { data: abonActifs },
    { data: allAbonnements },
    { data: dernieres },
  ] = await Promise.all([
    admin.from('commandes')
      .select('id, prix_paye, reduction_montant, type_commande, created_at, beat_id, source_marketing, beats(id, titre, couleur)')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'payee')
      .order('created_at', { ascending: false }),
    admin.from('beat_plays')
      .select('played_at, beat_id')
      .eq('beatmaker_id', user.id),
    admin.from('free_downloads')
      .select('downloaded_at, beat_id')
      .eq('beatmaker_id', user.id),
    admin.from('split_payments')
      .select('montant, created_at')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'transfere'),
    admin.from('abonnements_boutique')
      .select('prix, statut, periode')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'actif'),
    admin.from('abonnements_boutique')
      .select('prix, statut, periode, date_debut, date_fin, created_at')
      .eq('beatmaker_id', user.id),
    admin.from('commandes')
      .select('id, created_at, prix_paye, reduction_montant, beats(titre), licences(nom)')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'payee')
      .eq('type_commande', 'LICENCE')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Filtrer par période pour les KPIs
  const cmds   = (allCommandes   ?? []).filter(c => inPeriod(c.created_at,   from, to))
  const plays  = (allPlays       ?? []).filter(p => inPeriod(p.played_at,    from, to))
  const freeDl = (allFreeDl      ?? []).filter(f => inPeriod(f.downloaded_at, from, to))
  const collabs = (allCollabs    ?? []).filter(c => inPeriod(c.created_at,   from, to))

  const ca_brut   = cmds.reduce((s, c) => s + c.prix_paye, 0)
  const remises   = cmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
  const ca_net    = ca_brut - remises
  const beats_vendus = cmds.filter(c => c.type_commande === 'LICENCE').length
  const panier_moyen = cmds.length ? ca_brut / cmds.length : 0
  const ecoutes   = plays.length
  const free_dl   = freeDl.length
  const collab_ca = collabs.reduce((s, c) => s + c.montant, 0) / 100

  const mrr = (abonActifs ?? []).reduce((s, a) => {
    const mensuel = a.periode === 'annuel' ? a.prix / 12 : a.prix
    return s + mensuel
  }, 0) / 100
  const arr = mrr * 12

  // Top 5 beats
  type BeatAcc = { id: string; titre: string; couleur: string | null; ca: number; ventes: number }
  const beatMap = new Map<string, BeatAcc>()
  for (const c of cmds) {
    if (!c.beat_id) continue
    const beat = Array.isArray(c.beats) ? c.beats[0] : c.beats
    if (!beat) continue
    const ex = beatMap.get(c.beat_id) ?? { id: (beat as { id: string }).id, titre: (beat as { titre: string }).titre, couleur: (beat as { couleur: string | null }).couleur, ca: 0, ventes: 0 }
    ex.ca     += c.prix_paye
    ex.ventes += 1
    beatMap.set(c.beat_id, ex)
  }
  const top_beats = [...beatMap.values()]
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 5)
    .map(b => ({ ...b }))

  // Historique 12 mois
  const mois12 = getLast12Months()
  const historique = mois12.map(({ year, month, label, fullLabel }) => {
    const start = new Date(year, month, 1).toISOString()
    const end   = new Date(year, month + 1, 1).toISOString()

    const mCmds   = (allCommandes   ?? []).filter(c => c.created_at   >= start && c.created_at   < end)
    const mPlays  = (allPlays       ?? []).filter(p => p.played_at    >= start && p.played_at    < end)
    const mFreeDl = (allFreeDl      ?? []).filter(f => f.downloaded_at >= start && f.downloaded_at < end)
    const mCollabs = (allCollabs    ?? []).filter(c => c.created_at   >= start && c.created_at   < end)

    const mCa     = mCmds.reduce((s, c) => s + c.prix_paye, 0)
    const mRemise = mCmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)

    const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59)
    const monthStart = new Date(year, month, 1)
    const mMrr = (allAbonnements ?? [])
      .filter(a => {
        const debut = new Date(a.date_debut)
        const fin   = a.date_fin ? new Date(a.date_fin) : null
        return debut <= monthEnd && (fin === null || fin >= monthStart)
      })
      .reduce((s, a) => s + (a.periode === 'annuel' ? a.prix / 12 : a.prix), 0) / 100

    return {
      label,
      fullLabel,
      ca:        mCa,
      ca_net:    mCa - mRemise,
      mrr:       mMrr,
      ventes:    mCmds.filter(c => c.type_commande === 'LICENCE').length,
      ecoutes:   mPlays.length,
      free_dl:   mFreeDl.length,
      collab_ca: mCollabs.reduce((s, c) => s + c.montant, 0) / 100,
    }
  })

  // Abonnés stats
  const now = new Date()
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const abonnes = {
    actifs:   (abonActifs ?? []).length,
    nouveaux: (allAbonnements ?? []).filter(a => a.created_at >= debutMois).length,
    annules:  (allAbonnements ?? []).filter(a => a.statut === 'annule' && a.date_fin && a.date_fin >= debutMois).length,
  }

  // Dernières licences
  type Raw = { id: string; created_at: string; prix_paye: number; reduction_montant: number | null; beats: unknown; licences: unknown }
  const dernieres_licences = (dernieres ?? []).map((d: Raw) => {
    const b = Array.isArray(d.beats) ? d.beats[0] : d.beats
    const l = Array.isArray(d.licences) ? d.licences[0] : d.licences
    return {
      id:               d.id,
      beat_titre:       (b as { titre: string } | null)?.titre ?? '—',
      licence_nom:      (l as { nom: string } | null)?.nom ?? '—',
      created_at:       d.created_at,
      prix_paye:        d.prix_paye,
      reduction_montant: d.reduction_montant,
    }
  })

  return NextResponse.json({
    kpis: { ca: ca_brut, ca_brut, ca_net, mrr, arr, collab_ca, panier_moyen, beats_vendus, ecoutes, free_dl },
    historique,
    top_beats,
    dernieres_licences,
    abonnes,
  })
}
