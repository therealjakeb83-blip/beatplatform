import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getPeriodDates, inPeriod, getLast12Months } from '@/app/dashboard/business/analytics/_lib/periode'

export const runtime = 'nodejs'

type ClientJoin = { id: string; prenom: string | null; nom: string | null } | null

function clientInfo(raw: unknown): { client_id: string | null; client_nom: string | null } {
  const cl = (Array.isArray(raw) ? raw[0] : raw) as ClientJoin
  if (!cl) return { client_id: null, client_nom: null }
  const prenom = cl.prenom ?? ''
  const nom    = cl.nom    ?? ''
  return { client_id: cl.id, client_nom: [prenom, nom].filter(Boolean).join(' ') || null }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const { from, to } = getPeriodDates(request)
  const admin = createAdminClient()

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
    { data: allFavoris },
  ] = await Promise.all([
    admin.from('commandes')
      .select('id, created_at, prix_paye, reduction_montant, source_marketing, client_id, licences(nom), clients(id, prenom, nom)')
      .eq('beatmaker_id', user.id)
      .eq('beat_id', id)
      .eq('statut', 'payee')
      .order('created_at', { ascending: false }),
    admin.from('beat_plays')
      .select('id, played_at, client_id, pays, device_type, source_marketing, duree_secondes, clients(id, prenom, nom)')
      .eq('beatmaker_id', user.id)
      .eq('beat_id', id)
      .order('played_at', { ascending: false }),
    admin.from('free_downloads')
      .select('id, downloaded_at, client_id, clients(id, prenom, nom)')
      .eq('beatmaker_id', user.id)
      .eq('beat_id', id)
      .order('downloaded_at', { ascending: false }),
    admin.from('beat_splits')
      .select('id, email_invite, pourcentage, statut, beatmakers(nom_artiste)')
      .eq('beat_id', id),
    admin.from('favoris')
      .select('id, created_at, client_id, clients(id, prenom, nom)')
      .eq('beat_id', id)
      .order('created_at', { ascending: false }),
  ])

  // Filtrer par période
  const cmds    = (allCommandes ?? []).filter(c => inPeriod(c.created_at,    from, to))
  const plays   = (allPlays    ?? []).filter(p => inPeriod(p.played_at,      from, to))
  const freeDl  = (allFreeDl   ?? []).filter(f => inPeriod(f.downloaded_at,  from, to))
  const favoris = (allFavoris  ?? []).filter(f => inPeriod((f as { created_at: string }).created_at, from, to))

  const ca_brut = cmds.reduce((s, c) => s + c.prix_paye, 0)
  const remises = cmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
  const ca_net  = ca_brut - remises

  // CA par licence
  const licenceMap = new Map<string, { ca: number; ventes: number }>()
  for (const c of cmds) {
    const l   = Array.isArray(c.licences) ? c.licences[0] : c.licences
    const nom = (l as { nom: string } | null)?.nom ?? 'Autre'
    const ex  = licenceMap.get(nom) ?? { ca: 0, ventes: 0 }
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

  // Table ventes
  type RawCmd = typeof cmds[number]
  const ventes_detail = cmds.map((c: RawCmd) => {
    const l  = Array.isArray(c.licences) ? c.licences[0] : c.licences
    const { client_id, client_nom } = clientInfo(c.clients)
    return {
      id:                c.id,
      created_at:        c.created_at,
      licence_nom:       (l as { nom: string } | null)?.nom ?? '—',
      source_marketing:  c.source_marketing ?? 'direct',
      prix_paye:         c.prix_paye,
      reduction_montant: c.reduction_montant,
      client_id:         client_id ?? c.client_id ?? null,
      client_nom,
    }
  })

  // Table écoutes
  const ecoutes_detail = plays.map(p => {
    const pr = p as Record<string, unknown>
    const { client_id, client_nom } = clientInfo(pr.clients)
    return {
      played_at:        p.played_at,
      client_id:        client_id ?? pr.client_id as string | null ?? null,
      client_nom,
      pays:             pr.pays as string | null ?? null,
      device_type:      pr.device_type as string | null ?? null,
      source_marketing: pr.source_marketing as string | null ?? null,
      duree_secondes:   pr.duree_secondes as number | null ?? null,
    }
  })

  // Table favoris
  const favoris_detail = favoris.map(f => {
    const fr = f as Record<string, unknown>
    const { client_id, client_nom } = clientInfo(fr.clients)
    return {
      created_at: fr.created_at as string,
      client_id:  client_id ?? fr.client_id as string | null ?? null,
      client_nom,
    }
  })

  // Table free downloads
  const free_dl_detail = freeDl.map(f => {
    const { client_id, client_nom } = clientInfo((f as Record<string, unknown>).clients)
    return {
      downloaded_at: f.downloaded_at,
      client_id:     client_id ?? (f as Record<string, unknown>).client_id as string | null ?? null,
      client_nom,
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
      ventes:  (allCommandes ?? []).filter(c => c.created_at   >= start && c.created_at   < end).length,
      ecoutes: (allPlays    ?? []).filter(p => p.played_at     >= start && p.played_at     < end).length,
      free_dl: (allFreeDl   ?? []).filter(f => f.downloaded_at >= start && f.downloaded_at < end).length,
      favoris: (allFavoris  ?? []).filter(f => (f as { created_at: string }).created_at >= start && (f as { created_at: string }).created_at < end).length,
    }
  })

  // Durée moyenne d'écoute (uniquement les plays avec duree_secondes non null)
  const playsAvecDuree = plays.filter(p => (p as Record<string, unknown>).duree_secondes != null)
  const duree_moy = playsAvecDuree.length > 0
    ? Math.round(playsAvecDuree.reduce((s, p) => s + ((p as Record<string, unknown>).duree_secondes as number), 0) / playsAvecDuree.length)
    : null

  return NextResponse.json({
    beat,
    kpis: { ca_brut, ca_net, ventes: cmds.length, ecoutes: plays.length, free_dl: freeDl.length, favoris: favoris.length, duree_moy },
    ventes_detail,
    ecoutes_detail,
    favoris_detail,
    free_dl_detail,
    ca_par_licence,
    ca_par_source,
    collabs,
    historique,
  })
}
