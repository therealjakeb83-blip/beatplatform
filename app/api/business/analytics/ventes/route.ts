import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getPeriodDates, inPeriod, getHistoriqueSlots } from '@/app/dashboard/business/analytics/_lib/periode'

export const runtime = 'nodejs'

const SOURCES = ['instagram', 'youtube', 'tiktok', 'google', 'google_ads', 'youtube_ads', 'newsletter', 'direct', 'autre'] as const
const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', google: 'Google', google_ads: 'Google Ads (Search)', youtube_ads: 'YouTube Ads', newsletter: 'Newsletter', direct: 'Direct', autre: 'Autre',
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { from, to, periode } = getPeriodDates(request)
  const admin = createAdminClient()

  const [
    { data: allCommandes },
    { data: allCollabs },
    { data: beatmaker },
  ] = await Promise.all([
    admin.from('commandes')
      .select('id, created_at, prix_paye, reduction_montant, type_commande, source_marketing, acheteur_nom, acheteur_email, beats(titre), licences(nom), clients(prenom, nom)')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'payee')
      .or('type_commande.eq.LICENCE,type_commande.is.null')
      .order('created_at', { ascending: false }),
    admin.from('split_payments')
      .select('montant, created_at')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'transfere'),
    admin.from('beatmakers')
      .select('tva_active, tva_taux')
      .eq('id', user.id)
      .single(),
  ])

  const cmds    = (allCommandes ?? []).filter(c => inPeriod(c.created_at, from, to))
  const collabs = (allCollabs   ?? []).filter(c => inPeriod(c.created_at, from, to))

  const tvaRate = beatmaker?.tva_active ? (beatmaker.tva_taux ?? 20) / 100 : 0
  // CA net = CA HT (TTC après remises, TVA retirée) — la TVA collectée n'appartient pas au beatmaker
  const netHt = (ttc: number) => tvaRate > 0 ? ttc / (1 + tvaRate) : ttc

  const ca_brut    = cmds.reduce((s, c) => s + c.prix_paye, 0)
  const remises    = cmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
  const ca_net     = netHt(ca_brut - remises)
  const beats_vendus = cmds.length
  const panier_moyen = cmds.length ? ca_brut / cmds.length : 0
  const collab_ca  = collabs.reduce((s, c) => s + c.montant, 0) / 100

  // Source top
  const srcMap: Record<string, number> = {}
  for (const c of cmds) {
    const src = c.source_marketing ?? 'direct'
    srcMap[src] = (srcMap[src] ?? 0) + c.prix_paye
  }
  const srcEntries = Object.entries(srcMap).sort(([, a], [, b]) => b - a)
  const source_top = srcEntries.length
    ? { nom: SOURCE_LABELS[srcEntries[0][0]] ?? srcEntries[0][0], ca: srcEntries[0][1], pct: ca_brut > 0 ? srcEntries[0][1] / ca_brut * 100 : 0 }
    : null

  const dataFrom = periode === 'tout' ? (allCommandes ?? []).map(c => c.created_at).sort()[0] : undefined
  const slots = getHistoriqueSlots(periode, from, to, dataFrom)
  const historique = slots.map(slot => {
    const mCmds    = (allCommandes ?? []).filter(c => c.created_at >= slot.from && c.created_at < slot.to)
    const mCollabs = (allCollabs   ?? []).filter(c => c.created_at >= slot.from && c.created_at < slot.to)

    const ca_mois     = mCmds.reduce((s, c) => s + c.prix_paye, 0)
    const ca_net_mois = netHt(mCmds.reduce((s, c) => s + c.prix_paye - (c.reduction_montant ?? 0), 0))
    const ventes_mois = mCmds.length
    const panier_mois = mCmds.length ? ca_mois / mCmds.length : 0
    const collab_mois = mCollabs.reduce((s, c) => s + c.montant, 0) / 100

    const row: Record<string, unknown> = {
      label: slot.label, fullLabel: slot.fullLabel,
      ca: ca_mois, ca_net: ca_net_mois, ventes: ventes_mois, panier_moyen: panier_mois, collab_ca: collab_mois,
    }
    for (const src of SOURCES) {
      row[src] = mCmds.filter(c => (c.source_marketing ?? 'direct') === src).reduce((s, c) => s + c.prix_paye, 0)
    }
    return row
  })

  // Table des commandes
  type Raw = {
    id: string; created_at: string; prix_paye: number; reduction_montant: number | null
    type_commande: string | null; source_marketing: string | null
    acheteur_nom: string | null; acheteur_email: string | null
    beats: unknown; licences: unknown; clients: unknown
  }
  const commandes = cmds.map((d: Raw) => {
    const b = Array.isArray(d.beats) ? d.beats[0] : d.beats
    const l = Array.isArray(d.licences) ? d.licences[0] : d.licences
    const cl = Array.isArray(d.clients) ? d.clients[0] : d.clients
    const client_nom = cl
      ? [(cl as { prenom: string | null }).prenom, (cl as { nom: string }).nom].filter(Boolean).join(' ')
      : (d.acheteur_nom ?? d.acheteur_email ?? '—')
    return {
      id:               d.id,
      created_at:       d.created_at,
      client_nom,
      beat_titre:       (b as { titre: string } | null)?.titre ?? '—',
      licence_nom:      (l as { nom: string } | null)?.nom ?? '—',
      source_marketing: d.source_marketing ?? 'direct',
      prix_paye:        d.prix_paye,
      reduction_montant: d.reduction_montant,
    }
  })

  return NextResponse.json({
    kpis: { ca_brut, ca_net, panier_moyen, beats_vendus, collab_ca, source_top },
    historique,
    commandes,
  })
}
