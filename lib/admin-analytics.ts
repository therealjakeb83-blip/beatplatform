import { createAdminClient } from '@/utils/supabase/admin'

// 15d — Analytics plateforme. Deux notions de revenu volontairement
// séparées (cadrage 2026-07-24, voir memory/project_admin_etape15_scope) :
// - "revenu réel" = ce que Jake touche (abonnements_plateforme, MRR/ARR)
// - "volume d'affaires boutiques" = juste un signal de santé (CA cumulé de
//   toutes les boutiques), 0% commission donc ce n'est pas l'argent de Jake
//   (voir memory/project_stripe_decisions).
// Même formule de CA net (HT) que app/api/business/analytics/revenus/route.ts
// (TVA retirée du TTC après remises), appliquée boutique par boutique avec
// le taux propre à chacune, puis sommée pour le total plateforme.

export type AnalyticsPlateforme = {
  revenu: {
    mrr: number
    arr: number
    nbActifs: number
    nbEnEssai: number
    nbAnnules: number
    nbImpayes: number
  }
  volumeAffaires: {
    caNetTotal: number
    caNet30j: number
    nbCommandesTotal: number
  }
  croissance: {
    boutiquesActives: number
    nouveauxBeatmakers7j: number
    nouveauxBeatmakers30j: number
    churn30j: number
  }
  classement: Array<{ id: string; nomArtiste: string; slug: string; caNet: number; nbCommandes: number }>
  santeTechnique: {
    echecsEmail7j: number
    echecsWebhook7j: number
  }
  catalogue: {
    totalBeats: number
    nouveauxBeats30j: number
  }
}

function splitTva(ttc: number, tvaTaux: number) {
  const rate = tvaTaux / 100
  const tva = rate > 0 ? ttc - ttc / (1 + rate) : 0
  return ttc - tva
}

export async function getAnalyticsPlateforme(): Promise<AnalyticsPlateforme> {
  const admin = createAdminClient()
  const maintenant = Date.now()
  const j7 = new Date(maintenant - 7 * 86_400_000).toISOString()
  const j30 = new Date(maintenant - 30 * 86_400_000).toISOString()

  const [
    { data: abosPlateforme },
    { data: beatmakers },
    { data: commandes },
    { count: nbEchecsEmail },
    { count: nbEchecsWebhook },
    { count: totalBeats },
    { count: nouveauxBeats30j },
  ] = await Promise.all([
    admin.from('abonnements_plateforme').select('statut, periode, prix, date_annulation'),
    admin.from('beatmakers').select('id, nom_artiste, slug, statut, tva_active, tva_taux, created_at'),
    admin.from('commandes').select('beatmaker_id, prix_paye, reduction_montant, created_at').eq('statut', 'payee'),
    admin.from('email_logs').select('id', { count: 'exact', head: true }).eq('statut', 'echoue').gte('created_at', j7),
    admin.from('stripe_events').select('id', { count: 'exact', head: true }).eq('statut', 'echoue').gte('created_at', j7),
    admin.from('beats').select('id', { count: 'exact', head: true }).is('supprime_le', null),
    admin.from('beats').select('id', { count: 'exact', head: true }).is('supprime_le', null).gte('created_at', j30),
  ])

  // --- Revenu réel (MRR/ARR) ---
  const actifs = (abosPlateforme ?? []).filter(a => a.statut === 'actif')
  const mrr = actifs.reduce((s, a) => s + (a.periode === 'annuel' ? a.prix / 100 / 12 : a.prix / 100), 0)
  const revenu = {
    mrr,
    arr: mrr * 12,
    nbActifs: actifs.length,
    nbEnEssai: (abosPlateforme ?? []).filter(a => a.statut === 'en_essai').length,
    nbAnnules: (abosPlateforme ?? []).filter(a => a.statut === 'annule').length,
    nbImpayes: (abosPlateforme ?? []).filter(a => a.statut === 'impaye').length,
  }

  // --- CA net par boutique (volume d'affaires + classement) ---
  const tvaParBeatmaker = new Map((beatmakers ?? []).map(b => [b.id, b.tva_active ? (b.tva_taux ?? 20) : 0]))
  const nomParBeatmaker = new Map((beatmakers ?? []).map(b => [b.id, { nomArtiste: b.nom_artiste, slug: b.slug }]))

  const parBoutique = new Map<string, { caNet: number; caNet30j: number; nbCommandes: number }>()
  let caNetTotal = 0
  let caNet30j = 0

  for (const c of commandes ?? []) {
    const tvaTaux = tvaParBeatmaker.get(c.beatmaker_id) ?? 0
    const net = splitTva(c.prix_paye - (c.reduction_montant ?? 0), tvaTaux)
    const ex = parBoutique.get(c.beatmaker_id) ?? { caNet: 0, caNet30j: 0, nbCommandes: 0 }
    ex.caNet += net
    ex.nbCommandes += 1
    if (c.created_at >= j30) ex.caNet30j += net
    parBoutique.set(c.beatmaker_id, ex)
    caNetTotal += net
    if (c.created_at >= j30) caNet30j += net
  }

  const volumeAffaires = { caNetTotal, caNet30j, nbCommandesTotal: (commandes ?? []).length }

  const classement = [...parBoutique.entries()]
    .map(([id, v]) => ({ id, nomArtiste: nomParBeatmaker.get(id)?.nomArtiste ?? '—', slug: nomParBeatmaker.get(id)?.slug ?? '', caNet: v.caNet, nbCommandes: v.nbCommandes }))
    .sort((a, b) => b.caNet - a.caNet)
    .slice(0, 10)

  // --- Croissance ---
  const croissance = {
    boutiquesActives: (beatmakers ?? []).filter(b => b.statut === 'actif').length,
    nouveauxBeatmakers7j: (beatmakers ?? []).filter(b => b.created_at >= j7).length,
    nouveauxBeatmakers30j: (beatmakers ?? []).filter(b => b.created_at >= j30).length,
    churn30j: (abosPlateforme ?? []).filter(a => a.statut === 'annule' && a.date_annulation && a.date_annulation >= j30).length,
  }

  return {
    revenu,
    volumeAffaires,
    croissance,
    classement,
    santeTechnique: { echecsEmail7j: nbEchecsEmail ?? 0, echecsWebhook7j: nbEchecsWebhook ?? 0 },
    catalogue: { totalBeats: totalBeats ?? 0, nouveauxBeats30j: nouveauxBeats30j ?? 0 },
  }
}
