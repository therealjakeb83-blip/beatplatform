import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getPeriodDates, inPeriod, getHistoriqueSlots } from '@/app/dashboard/business/analytics/_lib/periode'
import { fuseauSur, dayKeyInTz } from '@/lib/fuseau-horaire'
import { toutesLesLignes, parLots } from '@/app/dashboard/business/_lib/requetes'
import { chargerPartsVendeur, partsDeCommandes, STATUTS_ANALYTICS } from '@/lib/analytics-parts'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const [commandesBoutique, { data: beatmaker }, litigesEnCours] = await Promise.all([
    toutesLesLignes((debut, fin) => admin.from('commandes')
      .select('id, created_at, prix_paye, reduction_montant')
      .eq('beatmaker_id', user.id)
      .in('statut', STATUTS_ANALYTICS)
      .order('created_at', { ascending: false })
      .order('id')
      .range(debut, fin)),
    admin.from('beatmakers')
      .select('tva_active, tva_taux, fuseau_horaire')
      .eq('id', user.id)
      .single(),
    // "Litiges en cours" = instantané, toujours l'état actuel — pas filtré
    // par période (décision de Jake, 2026-08-31) : l'argent est séquestré
    // en ce moment, peu importe la période consultée dans les Analytics.
    // Historique daté complet : page dédiée /dashboard/business/litiges,
    // pas ici (déplacé du brouillon initial sur demande de Jake).
    toutesLesLignes((debut, fin) => admin.from('litiges')
      .select('montant')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'en_cours')
      .order('id')
      .range(debut, fin)),
  ])

  // CA = part du vendeur (Phase 13, lot 3) — voir lib/analytics-parts.ts.
  const parts = await chargerPartsVendeur(admin, user.id)
  const commandesAutres = await parLots(parts.autresCommandes, lot =>
    admin.from('commandes').select('id, created_at, prix_paye, reduction_montant').in('id', lot).in('statut', STATUTS_ANALYTICS))
  const allCommandes = partsDeCommandes([...commandesBoutique, ...commandesAutres], parts)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const tz = fuseauSur(beatmaker?.fuseau_horaire)
  const { from, to, periode } = getPeriodDates(request, tz)

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
    const day = dayKeyInTz(c.created_at, tz)
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
  const slots = getHistoriqueSlots(periode, from, to, dataFrom, tz)
  const historique = slots.map(slot => {
    const mCmds = (allCommandes ?? []).filter(c => c.created_at >= slot.from && c.created_at < slot.to)
    const brut  = mCmds.reduce((s, c) => s + c.prix_paye, 0)
    const rem   = mCmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
    const { tva, net } = splitTva(brut - rem)
    return { label: slot.label, fullLabel: slot.fullLabel, brut, remises: rem, net, tva }
  })

  // Litiges en cours — instantané, indépendant de la période (voir requête).
  const litiges_en_cours = litigesEnCours.reduce((s, l) => s + Number(l.montant), 0)

  // Remboursements (bouton, remboursement depuis Stripe, litiges perdus) —
  // ce que le vendeur a rendu sur SA part (lot 4, T21) ; période sur la date
  // de la commande, comme le reste de l'onglet.
  const idsRembourses = [...parts.rembourseParCommande.keys()]
  const datesRembourses = await parLots(idsRembourses, lot => admin.from('commandes').select('id, created_at').in('id', lot))
  const remboursements_total = datesRembourses
    .filter(c => inPeriod(c.created_at, from, to))
    .reduce((s, c) => s + (parts.rembourseParCommande.get(c.id) ?? 0) / 100, 0)

  return NextResponse.json({
    kpis: { ventes_brutes, remises_total, ventes_nettes, tva, tva_taux: tvaTaux, moy_brut, moy_net, litiges_en_cours, remboursements_total },
    jours,
    historique,
  })
}
