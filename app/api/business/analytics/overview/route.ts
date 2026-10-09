import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getPeriodDates, inPeriod, getHistoriqueSlots, granularite } from '@/app/dashboard/business/analytics/_lib/periode'
import { fuseauSur, startOfMonthInTz } from '@/lib/fuseau-horaire'
import { chargerPartsVendeur, chargerFluxCollab, partsDeCommandes, partsDeLignes, type FluxCollab, STATUTS_ANALYTICS } from '@/lib/analytics-parts'
import { evenementsParBeat, evenementsParTranche, totalEvenements, sommeTranche } from '@/lib/analytics-evenements'
import { toutesLesLignes, parLots } from '@/app/dashboard/business/_lib/requetes'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const SELECT_COMMANDES = 'id, prix_paye, reduction_montant, type_commande, created_at, source_marketing'
  const SELECT_LIGNES = 'id, commande_id, beat_id, licence_id, prix_paye, reduction_montant, created_at, beats(id, titre, couleur), licences(nom), commandes!inner(beatmaker_id, statut)'
  const [
    commandesBoutique,
    lignesBoutique,
    abonActifs,
    allAbonnements,
    { data: beatmaker },
  ] = await Promise.all([
    toutesLesLignes((debut, fin) => admin.from('commandes')
      .select(SELECT_COMMANDES)
      .eq('beatmaker_id', user.id)
      .in('statut', STATUTS_ANALYTICS)
      .order('created_at', { ascending: false })
      .order('id')
      .range(debut, fin)),
    // Niveau article — un panier de plusieurs beats donne plusieurs lignes ici,
    // c'est la source pour tout ce qui compte des BEATS (pas des commandes) :
    // top beats, "beats vendus", dernières licences.
    toutesLesLignes((debut, fin) => admin.from('commande_lignes')
      .select(SELECT_LIGNES)
      .eq('commandes.beatmaker_id', user.id)
      .in('commandes.statut', STATUTS_ANALYTICS)
      .order('created_at', { ascending: false })
      .order('id')
      .range(debut, fin)),
    toutesLesLignes((debut, fin) => admin.from('abonnements_boutique')
      .select('prix, statut, periode')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'actif')
      .order('id')
      .range(debut, fin)),
    toutesLesLignes((debut, fin) => admin.from('abonnements_boutique')
      .select('prix, statut, periode, date_debut, date_fin, created_at')
      .eq('beatmaker_id', user.id)
      .order('id')
      .range(debut, fin)),
    admin.from('beatmakers')
      .select('tva_active, tva_taux, fuseau_horaire')
      .eq('id', user.id)
      .single(),
  ])

  // CA = part du vendeur (Phase 13, lot 3) : tranche sur une vente collab, et
  // ventes faites sur la boutique d'un autre pour un collaborateur.
  const [parts, flux] = await Promise.all([chargerPartsVendeur(admin, user.id), chargerFluxCollab(admin, user.id)])
  const [commandesAutres, lignesAutres] = await Promise.all([
    parLots(parts.autresCommandes, lot => admin.from('commandes').select(SELECT_COMMANDES).in('id', lot).in('statut', STATUTS_ANALYTICS)),
    parLots(parts.autresCommandes, lot => admin.from('commande_lignes').select(SELECT_LIGNES).in('commande_id', lot).in('commandes.statut', STATUTS_ANALYTICS)),
  ])
  const parDateDesc = (a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at)
  const allCommandes = partsDeCommandes([...commandesBoutique, ...commandesAutres], parts).sort(parDateDesc)
  const allLignes = partsDeLignes([...lignesBoutique, ...lignesAutres], parts).sort(parDateDesc)

  const tz = fuseauSur(beatmaker?.fuseau_horaire)
  const { from, to, periode } = getPeriodDates(request, tz)

  // Filtrer par période pour les KPIs
  const cmds   = allCommandes.filter(c => inPeriod(c.created_at, from, to))
  const lignes = allLignes.filter(l => inPeriod(l.created_at, from, to))
  // Écoutes / free downloads / favoris : comptés dans la base (lib/analytics-evenements.ts).
  const evenements = totalEvenements(await evenementsParBeat(admin, user.id, from, to))

  const tvaRate = beatmaker?.tva_active ? (beatmaker.tva_taux ?? 20) / 100 : 0
  // CA net = CA HT (TTC après remises, TVA retirée) — la TVA collectée n'appartient pas au beatmaker
  const netHt = (ttc: number) => tvaRate > 0 ? ttc / (1 + tvaRate) : ttc

  const ca_brut   = cmds.reduce((s, c) => s + c.prix_paye, 0)
  const remises   = cmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
  const ca_net    = netHt(ca_brut - remises)
  // "Beats vendus" compte des articles (commande_lignes), pas des commandes —
  // un panier de 3 beats compte pour 3 ici, mais pour 1 seul panier_moyen ci-dessous.
  const beats_vendus = lignes.length
  const panier_moyen = cmds.length ? ca_brut / cmds.length : 0
  const ecoutes   = evenements.ecoutes
  const free_dl   = evenements.free_dl
  // Collaborations : reçu sur la boutique d'un autre / part de mes collaborateurs.
  const sommeFlux = (f: FluxCollab[], de: string | null, a: string | null) =>
    f.filter(x => (!de || x.created_at >= de) && (!a || x.created_at < a)).reduce((s, x) => s + x.montant, 0)
  const recu_collab = flux.recus.filter(x => inPeriod(x.created_at, from, to)).reduce((s, x) => s + x.montant, 0)
  const part_collaborateurs = flux.collaborateurs.filter(x => inPeriod(x.created_at, from, to)).reduce((s, x) => s + x.montant, 0)
  const favoris   = evenements.favoris

  const mrr = abonActifs.reduce((s, a) => {
    const mensuel = a.periode === 'annuel' ? a.prix / 12 : a.prix
    return s + mensuel
  }, 0) / 100
  const arr = mrr * 12

  // Top 5 beats — CA/ventes calculés au niveau article, pas commande
  type BeatAcc = { id: string; titre: string; couleur: string | null; ca: number; ventes: number }
  const beatMap = new Map<string, BeatAcc>()
  for (const l of lignes) {
    if (!l.beat_id) continue
    const beat = Array.isArray(l.beats) ? l.beats[0] : l.beats
    if (!beat) continue
    const ex = beatMap.get(l.beat_id) ?? { id: (beat as { id: string }).id, titre: (beat as { titre: string }).titre, couleur: (beat as { couleur: string | null }).couleur, ca: 0, ventes: 0 }
    ex.ca     += l.prix_paye
    ex.ventes += 1
    beatMap.set(l.beat_id, ex)
  }
  const top_beats = [...beatMap.values()]
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 5)
    .map(b => ({ ...b }))

  const dataFrom = periode === 'tout' ? allCommandes.map(c => c.created_at).sort()[0] : undefined
  const slots = getHistoriqueSlots(periode, from, to, dataFrom, tz)
  const evenementsSlots = await evenementsParTranche(admin, user.id, tz, granularite(periode, from, to), slots, false)
  const historique = slots.map((slot, i) => {
    const mCmds    = allCommandes.filter(c => c.created_at >= slot.from && c.created_at < slot.to)
    const mLignes  = allLignes.filter(l => l.created_at >= slot.from && l.created_at < slot.to)

    const mCa      = mCmds.reduce((s, c) => s + c.prix_paye, 0)
    const mRemise  = mCmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)

    const slotStart = new Date(slot.from)
    const slotEnd   = new Date(slot.to)
    const mMrr = allAbonnements
      .filter(a => {
        const debut = new Date(a.date_debut)
        // Seul un abonnement annulé est terminé : date_fin d'un abonné actif = paiement suivant.
        const fin   = a.statut === 'annule' && a.date_fin ? new Date(a.date_fin) : null
        return debut < slotEnd && (fin === null || fin >= slotStart)
      })
      .reduce((s, a) => s + (a.periode === 'annuel' ? a.prix / 12 : a.prix), 0) / 100

    return {
      label:     slot.label,
      fullLabel: slot.fullLabel,
      ca:           mCa,
      ca_net:       netHt(mCa - mRemise),
      mrr:          mMrr,
      panier_moyen: mCmds.length ? mCa / mCmds.length : 0,
      ventes:       mLignes.length,
      ecoutes:      sommeTranche(evenementsSlots[i], 'ecoutes'),
      free_dl:      sommeTranche(evenementsSlots[i], 'free_dl'),
      recu_collab:         sommeFlux(flux.recus, slot.from, slot.to),
      part_collaborateurs: sommeFlux(flux.collaborateurs, slot.from, slot.to),
      favoris:      sommeTranche(evenementsSlots[i], 'favoris'),
    }
  })

  // Abonnés stats
  const now = new Date()
  const debutMois = startOfMonthInTz(now, tz).toISOString()
  const abonnes = {
    actifs:   abonActifs.length,
    nouveaux: allAbonnements.filter(a => a.created_at >= debutMois).length,
    annules:  allAbonnements.filter(a => a.statut === 'annule' && a.date_fin && a.date_fin >= debutMois).length,
  }

  // Dernières licences — au niveau article (5 derniers beats vendus, pas 5 derniers paniers)
  type Raw = { id: string; created_at: string; prix_paye: number; reduction_montant: number | null; beats: unknown; licences: unknown }
  const dernieres_licences = (allLignes as unknown as Raw[]).slice(0, 5).map((d: Raw) => {
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
    kpis: { ca: ca_brut, ca_brut, ca_net, mrr, arr, panier_moyen, beats_vendus, ecoutes, free_dl, favoris, recu_collab, part_collaborateurs },
    historique,
    top_beats,
    dernieres_licences,
    abonnes,
  })
}
