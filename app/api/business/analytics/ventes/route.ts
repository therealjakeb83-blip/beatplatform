import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getPeriodDates, inPeriod, getHistoriqueSlots } from '@/app/dashboard/business/analytics/_lib/periode'
import { fuseauSur } from '@/lib/fuseau-horaire'
import { chargerPartsVendeur, chargerFluxCollab, partsDeCommandes, partsDeLignes, type FluxCollab, STATUTS_ANALYTICS } from '@/lib/analytics-parts'
import { SOURCE_LABELS, SOURCES_MARKETING } from '@/lib/sources-marketing'
import { toutesLesLignes, parLots } from '@/app/dashboard/business/_lib/requetes'

export const runtime = 'nodejs'

const SOURCES = SOURCES_MARKETING

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const SELECT_COMMANDES = 'id, created_at, prix_paye, reduction_montant, type_commande, source_marketing, acheteur_nom, acheteur_email, clients(prenom, nom)'
  const SELECT_LIGNES = 'id, commande_id, beat_id, licence_id, prix_paye, reduction_montant, created_at, beats(titre), licences(nom), commandes!inner(beatmaker_id, statut)'
  const [
    commandesBoutique,
    lignesBoutique,
    { data: beatmaker },
  ] = await Promise.all([
    toutesLesLignes((debut, fin) => admin.from('commandes')
      .select(SELECT_COMMANDES)
      .eq('beatmaker_id', user.id)
      .in('statut', STATUTS_ANALYTICS)
      .or('type_commande.eq.LICENCE,type_commande.is.null')
      .order('created_at', { ascending: false })
      .order('id')
      .range(debut, fin)),
    // Niveau article — pour le KPI "beats vendus" (compte les articles, pas les paniers)
    toutesLesLignes((debut, fin) => admin.from('commande_lignes')
      .select(SELECT_LIGNES)
      .eq('commandes.beatmaker_id', user.id)
      .in('commandes.statut', STATUTS_ANALYTICS)
      .order('created_at', { ascending: false })
      .order('id')
      .range(debut, fin)),
    admin.from('beatmakers')
      .select('tva_active, tva_taux, fuseau_horaire')
      .eq('id', user.id)
      .single(),
  ])

  // CA = part du vendeur (Phase 13, lot 3). Sur la boutique d'un autre, le
  // collaborateur ne voit jamais l'email du client ni sa fiche CRM.
  const [parts, flux] = await Promise.all([chargerPartsVendeur(admin, user.id), chargerFluxCollab(admin, user.id)])
  const [commandesAutres, lignesAutres] = await Promise.all([
    parLots(parts.autresCommandes, lot => admin.from('commandes').select(SELECT_COMMANDES).in('id', lot).in('statut', STATUTS_ANALYTICS).or('type_commande.eq.LICENCE,type_commande.is.null')),
    parLots(parts.autresCommandes, lot => admin.from('commande_lignes').select(SELECT_LIGNES).in('commande_id', lot).in('commandes.statut', STATUTS_ANALYTICS)),
  ])
  const parDateDesc = (a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at)
  const allCommandes = partsDeCommandes([
    ...commandesBoutique,
    ...commandesAutres.map(c => ({ ...c, acheteur_email: null, clients: null })),
  ], parts).sort(parDateDesc)
  const allLignes = partsDeLignes([...lignesBoutique, ...lignesAutres], parts).sort(parDateDesc)

  const tz = fuseauSur(beatmaker?.fuseau_horaire)
  const { from, to, periode } = getPeriodDates(request, tz)

  const cmds    = (allCommandes ?? []).filter(c => inPeriod(c.created_at, from, to))
  const lignes  = (allLignes    ?? []).filter(l => inPeriod(l.created_at, from, to))

  const tvaRate = beatmaker?.tva_active ? (beatmaker.tva_taux ?? 20) / 100 : 0
  // CA net = CA HT (TTC après remises, TVA retirée) — la TVA collectée n'appartient pas au beatmaker
  const netHt = (ttc: number) => tvaRate > 0 ? ttc / (1 + tvaRate) : ttc

  // Norme (décision de Jake, 2026-10-09) : prix_paye est DÉJÀ remise déduite.
  // CA brut = avant remises (payé + remises) ; CA net = brut − remises − TVA.
  const ca_brut    = cmds.reduce((s, c) => s + c.prix_paye + (c.reduction_montant ?? 0), 0)
  const remises    = cmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
  const ca_net     = netHt(ca_brut - remises)
  const beats_vendus = lignes.length
  const panier_moyen = cmds.length ? (ca_brut - remises) / cmds.length : 0

  // Source top
  const srcMap: Record<string, number> = {}
  for (const c of cmds) {
    const src = c.source_marketing ?? 'direct'
    srcMap[src] = (srcMap[src] ?? 0) + c.prix_paye + (c.reduction_montant ?? 0)
  }
  const srcEntries = Object.entries(srcMap).sort(([, a], [, b]) => b - a)
  // Collaborations : reçu sur la boutique d'un autre / part de mes collaborateurs.
  const sommeFlux = (f: FluxCollab[], de: string | null, a: string | null) =>
    f.filter(x => (!de || x.created_at >= de) && (!a || x.created_at < a)).reduce((s, x) => s + x.montant, 0)
  const recu_collab = flux.recus.filter(x => inPeriod(x.created_at, from, to)).reduce((s, x) => s + x.montant, 0)
  const part_collaborateurs = flux.collaborateurs.filter(x => inPeriod(x.created_at, from, to)).reduce((s, x) => s + x.montant, 0)
  const source_top = srcEntries.length
    ? { nom: SOURCE_LABELS[srcEntries[0][0]] ?? srcEntries[0][0], ca: srcEntries[0][1], pct: ca_brut > 0 ? srcEntries[0][1] / ca_brut * 100 : 0 }
    : null

  const dataFrom = periode === 'tout' ? (allCommandes ?? []).map(c => c.created_at).sort()[0] : undefined
  const slots = getHistoriqueSlots(periode, from, to, dataFrom, tz)
  const historique = slots.map(slot => {
    const mCmds    = (allCommandes ?? []).filter(c => c.created_at >= slot.from && c.created_at < slot.to)
    const mLignes  = (allLignes    ?? []).filter(l => l.created_at >= slot.from && l.created_at < slot.to)

    const paye_mois   = mCmds.reduce((s, c) => s + c.prix_paye, 0)
    const ca_mois     = mCmds.reduce((s, c) => s + c.prix_paye + (c.reduction_montant ?? 0), 0)
    const ca_net_mois = netHt(paye_mois)
    const ventes_mois = mLignes.length
    const panier_mois = mCmds.length ? paye_mois / mCmds.length : 0

    const row: Record<string, unknown> = {
      label: slot.label, fullLabel: slot.fullLabel,
      ca: ca_mois, ca_net: ca_net_mois, ventes: ventes_mois, panier_moyen: panier_mois,
      recu_collab: sommeFlux(flux.recus, slot.from, slot.to), part_collaborateurs: sommeFlux(flux.collaborateurs, slot.from, slot.to),
    }
    for (const src of SOURCES) {
      row[src] = mCmds.filter(c => (c.source_marketing ?? 'direct') === src).reduce((s, c) => s + c.prix_paye + (c.reduction_montant ?? 0), 0)
    }
    return row
  })

  // Table des ventes — 1 ligne par commande (comme Commerce → Commandes), le
  // 1er article s'affiche avec un "+N" si le panier en contient plusieurs.
  type LigneRaw = {
    id: string; commande_id: string; created_at: string; prix_paye: number; reduction_montant: number | null
    beats: unknown; licences: unknown
  }
  const lignesParCommande = new Map<string, LigneRaw[]>()
  for (const l of lignes as unknown as LigneRaw[]) {
    const arr = lignesParCommande.get(l.commande_id) ?? []
    arr.push(l)
    lignesParCommande.set(l.commande_id, arr)
  }

  type CmdRaw = {
    id: string; created_at: string; prix_paye: number; reduction_montant: number | null
    source_marketing: string | null; acheteur_nom: string | null; acheteur_email: string | null
    clients: unknown
  }
  const commandes = (cmds as unknown as CmdRaw[]).map(c => {
    const lignesCmd = lignesParCommande.get(c.id) ?? []
    const premiere = lignesCmd[0]
    const b = premiere ? (Array.isArray(premiere.beats) ? premiere.beats[0] : premiere.beats) : null
    const l = premiere ? (Array.isArray(premiere.licences) ? premiere.licences[0] : premiere.licences) : null
    const cl = Array.isArray(c.clients) ? c.clients[0] : c.clients
    const client_nom = cl
      ? [(cl as { prenom: string | null }).prenom, (cl as { nom: string }).nom].filter(Boolean).join(' ')
      : (c.acheteur_nom ?? c.acheteur_email ?? '—')
    return {
      id:               c.id,
      created_at:       c.created_at,
      client_nom,
      beat_titre:       (b as { titre: string } | null)?.titre ?? '—',
      nb_articles:      lignesCmd.length,
      licence_nom:      (l as { nom: string } | null)?.nom ?? '—',
      source_marketing: c.source_marketing ?? 'direct',
      prix_paye:        c.prix_paye,
      reduction_montant: c.reduction_montant,
    }
  })

  return NextResponse.json({
    kpis: { ca_brut, ca_net, panier_moyen, beats_vendus, source_top, recu_collab, part_collaborateurs },
    historique,
    commandes,
  })
}
