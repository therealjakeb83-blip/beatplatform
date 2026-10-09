import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getPeriodDates, inPeriod, getHistoriqueSlots, granularite } from '@/app/dashboard/business/analytics/_lib/periode'
import { fuseauSur } from '@/lib/fuseau-horaire'
import { chargerPartsVendeur, partsDeLignes, STATUTS_ANALYTICS } from '@/lib/analytics-parts'
import { evenementsParBeat, evenementsParTranche, totalEvenements, sommeTranche } from '@/lib/analytics-evenements'
import { toutesLesLignes } from '@/app/dashboard/business/_lib/requetes'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const [
    beats,
    lignesBoutique,
    { data: beatmaker },
  ] = await Promise.all([
    toutesLesLignes((debut, fin) => admin.from('beats')
      .select('id, titre, couleur, styles, supprime_le')
      .eq('beatmaker_id', user.id)
      .order('created_at', { ascending: false })
      .order('id')
      .range(debut, fin)),
    // Niveau article — un panier de plusieurs beats donne plusieurs lignes, chacune attribuée à son beat
    toutesLesLignes((debut, fin) => admin.from('commande_lignes')
      .select('commande_id, beat_id, licence_id, prix_paye, reduction_montant, created_at, commandes!inner(beatmaker_id, statut)')
      .eq('commandes.beatmaker_id', user.id)
      .in('commandes.statut', STATUTS_ANALYTICS)
      .order('id')
      .range(debut, fin)),
    admin.from('beatmakers').select('fuseau_horaire').eq('id', user.id).single(),
  ])

  // CA d'un beat collab = part du propriétaire (Phase 13, lot 3).
  const allCommandes = partsDeLignes(lignesBoutique, await chargerPartsVendeur(admin, user.id))

  const tz = fuseauSur(beatmaker?.fuseau_horaire)
  const { from, to, periode } = getPeriodDates(request, tz)

  const cmds    = allCommandes.filter(c => inPeriod(c.created_at, from, to))
  // Écoutes / durées / free downloads : comptés dans la base (lib/analytics-evenements.ts).
  const evenements = await evenementsParBeat(admin, user.id, from, to)

  // Map par beat_id
  const caMap      = new Map<string, number>()
  const vMap       = new Map<string, number>()

  for (const c of cmds) {
    if (!c.beat_id) continue
    // CA brut du beat = avant remises (prix_paye est déjà remise déduite)
    caMap.set(c.beat_id, (caMap.get(c.beat_id) ?? 0) + c.prix_paye + (c.reduction_montant ?? 0))
    vMap.set(c.beat_id,  (vMap.get(c.beat_id)  ?? 0) + 1)
  }

  const beatRows = beats.map(b => {
    const ca      = caMap.get(b.id) ?? 0
    const ventes  = vMap.get(b.id) ?? 0
    const ev      = evenements.get(b.id)
    const ecoutes = ev?.ecoutes ?? 0
    const free_dl = ev?.free_dl ?? 0
    const duree_moy = ev && ev.duree_nb > 0 ? Math.round(ev.duree_somme / ev.duree_nb) : null
    return { id: b.id, titre: b.titre, couleur: b.couleur, styles: b.styles ?? [], supprime: !!b.supprime_le, ca, ventes, ecoutes, free_dl, duree_moy }
  })

  // KPIs globaux
  const totalCa      = beatRows.reduce((s, b) => s + b.ca, 0)
  const totalVentes  = beatRows.reduce((s, b) => s + b.ventes, 0)
  const totalEcoutes = beatRows.reduce((s, b) => s + b.ecoutes, 0)
  const totalDl      = beatRows.reduce((s, b) => s + b.free_dl, 0)
  const nbBeats      = beats.length || 1
  const ca_moy_par_beat    = totalCa / nbBeats
  const cmdes_moy_par_beat = totalVentes / nbBeats
  const durees             = totalEvenements(evenements)
  const duree_moy_globale  = durees.duree_nb > 0 ? Math.round(durees.duree_somme / durees.duree_nb) : null

  const dataFrom = periode === 'tout' ? allCommandes.map(c => c.created_at).sort()[0] : undefined
  const slots = getHistoriqueSlots(periode, from, to, dataFrom, tz)
  const evenementsSlots = await evenementsParTranche(admin, user.id, tz, granularite(periode, from, to), slots, false)
  const historique = slots.map((slot, i) => {
    const mCmds   = allCommandes.filter(c => c.created_at >= slot.from && c.created_at < slot.to)
    return {
      label:   slot.label,
      fullLabel: slot.fullLabel,
      ca:      mCmds.reduce((s, c) => s + c.prix_paye + (c.reduction_montant ?? 0), 0),
      ventes:  mCmds.length,
      ecoutes: sommeTranche(evenementsSlots[i], 'ecoutes'),
      free_dl: sommeTranche(evenementsSlots[i], 'free_dl'),
    }
  })

  return NextResponse.json({
    kpis: { ca_moy_par_beat, cmdes_moy_par_beat, ecoutes: totalEcoutes, free_dl: totalDl, duree_moy_globale },
    historique,
    beats: beatRows,
  })
}
