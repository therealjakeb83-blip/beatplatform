import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getPeriodDates, inPeriod, getLast12Months } from '@/app/dashboard/business/analytics/_lib/periode'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const { from, to } = getPeriodDates(request)
  const admin = createAdminClient()

  // Vérifier que le beat appartient bien à ce beatmaker
  const { data: beat } = await admin
    .from('beats')
    .select('id, titre, couleur, styles, ambiances, instruments, type_beat, bpm, cle, statut, date_sortie, free_download_actif')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .single()

  if (!beat) return NextResponse.json({ erreur: 'Beat introuvable' }, { status: 404 })

  const [
    { data: allCommandes },
    { data: allPlays },
    { data: allFreeDl },
    { data: allSplits },
  ] = await Promise.all([
    admin.from('commandes')
      .select('id, created_at, prix_paye, reduction_montant, source_marketing, licences(nom)')
      .eq('beatmaker_id', user.id)
      .eq('beat_id', id)
      .eq('statut', 'payee')
      .order('created_at', { ascending: false }),
    admin.from('beat_plays')
      .select('played_at')
      .eq('beatmaker_id', user.id)
      .eq('beat_id', id),
    admin.from('free_downloads')
      .select('downloaded_at')
      .eq('beatmaker_id', user.id)
      .eq('beat_id', id),
    admin.from('beat_splits')
      .select('id, email_invite, pourcentage, statut, beatmakers(nom_artiste)')
      .eq('beat_id', id),
  ])

  const cmds   = (allCommandes ?? []).filter(c => inPeriod(c.created_at,    from, to))
  const plays  = (allPlays    ?? []).filter(p => inPeriod(p.played_at,      from, to))
  const freeDl = (allFreeDl   ?? []).filter(f => inPeriod(f.downloaded_at,  from, to))

  const ca_brut   = cmds.reduce((s, c) => s + c.prix_paye, 0)
  const remises   = cmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
  const ca_net    = ca_brut - remises

  // CA par licence
  const licenceMap = new Map<string, { ca: number; ventes: number }>()
  for (const c of cmds) {
    const l = Array.isArray(c.licences) ? c.licences[0] : c.licences
    const nom = (l as { nom: string } | null)?.nom ?? 'Autre'
    const ex = licenceMap.get(nom) ?? { ca: 0, ventes: 0 }
    ex.ca     += c.prix_paye
    ex.ventes += 1
    licenceMap.set(nom, ex)
  }
  const ca_par_licence = [...licenceMap.entries()]
    .map(([nom, v]) => ({ nom, ca: v.ca, ventes: v.ventes }))
    .sort((a, b) => b.ca - a.ca)

  // CA par source
  const srcMap = new Map<string, number>()
  for (const c of cmds) {
    const src = c.source_marketing ?? 'direct'
    srcMap.set(src, (srcMap.get(src) ?? 0) + c.prix_paye)
  }
  const ca_par_source = [...srcMap.entries()]
    .map(([source, ca]) => ({ source, ca }))
    .sort((a, b) => b.ca - a.ca)

  // Table ventes détaillée
  type Raw = typeof cmds[number]
  const ventes_detail = cmds.map((c: Raw) => {
    const l = Array.isArray(c.licences) ? c.licences[0] : c.licences
    return {
      id:               c.id,
      created_at:       c.created_at,
      licence_nom:      (l as { nom: string } | null)?.nom ?? '—',
      source_marketing: c.source_marketing ?? 'direct',
      prix_paye:        c.prix_paye,
      reduction_montant: c.reduction_montant,
    }
  })

  // Collabs
  const collabs = (allSplits ?? []).map(s => {
    const bm = Array.isArray(s.beatmakers) ? s.beatmakers[0] : s.beatmakers
    return {
      id:          s.id,
      nom:         (bm as { nom_artiste: string } | null)?.nom_artiste ?? s.email_invite ?? '—',
      pourcentage: s.pourcentage,
      statut:      s.statut,
    }
  })

  // Historique 12 mois
  const mois12 = getLast12Months()
  const historique = mois12.map(({ year, month, label, fullLabel }) => {
    const start = new Date(year, month, 1).toISOString()
    const end   = new Date(year, month + 1, 1).toISOString()
    return {
      label,
      fullLabel,
      ventes:  (allCommandes ?? []).filter(c => c.created_at >= start && c.created_at < end).length,
      ecoutes: (allPlays    ?? []).filter(p => p.played_at   >= start && p.played_at   < end).length,
      free_dl: (allFreeDl   ?? []).filter(f => f.downloaded_at >= start && f.downloaded_at < end).length,
    }
  })

  return NextResponse.json({
    beat,
    kpis: { ca_brut, ca_net, ventes: cmds.length, ecoutes: plays.length, free_dl: freeDl.length },
    ventes_detail,
    ca_par_licence,
    ca_par_source,
    collabs,
    historique,
  })
}
