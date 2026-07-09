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
    { data: allCommandes },
    { data: allLignes },
    { data: allPlays },
    { data: allFreeDl },
    { data: allCollabs },
    { data: abonActifs },
    { data: allAbonnements },
    { data: allFavoris },
    { data: beatmaker },
  ] = await Promise.all([
    admin.from('commandes')
      .select('id, prix_paye, reduction_montant, type_commande, created_at, source_marketing')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'payee')
      .order('created_at', { ascending: false }),
    // Niveau article — un panier de plusieurs beats donne plusieurs lignes ici,
    // c'est la source pour tout ce qui compte des BEATS (pas des commandes) :
    // top beats, "beats vendus", dernières licences.
    admin.from('commande_lignes')
      .select('id, beat_id, prix_paye, reduction_montant, created_at, beats(id, titre, couleur), licences(nom), commandes!inner(beatmaker_id, statut)')
      .eq('commandes.beatmaker_id', user.id)
      .eq('commandes.statut', 'payee')
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
    admin.from('favoris')
      .select('created_at, beats!inner(beatmaker_id)')
      .eq('beats.beatmaker_id', user.id),
    admin.from('beatmakers')
      .select('tva_active, tva_taux')
      .eq('id', user.id)
      .single(),
  ])

  // Filtrer par période pour les KPIs
  const cmds   = (allCommandes   ?? []).filter(c => inPeriod(c.created_at,   from, to))
  const lignes = (allLignes      ?? []).filter(l => inPeriod(l.created_at,   from, to))
  const plays  = (allPlays       ?? []).filter(p => inPeriod(p.played_at,    from, to))
  const freeDl = (allFreeDl      ?? []).filter(f => inPeriod(f.downloaded_at, from, to))
  const collabs = (allCollabs    ?? []).filter(c => inPeriod(c.created_at,   from, to))

  const favorisInPeriod = (allFavoris ?? []).filter(f => inPeriod((f as { created_at: string }).created_at, from, to))

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
  const ecoutes   = plays.length
  const free_dl   = freeDl.length
  const collab_ca = collabs.reduce((s, c) => s + c.montant, 0) / 100
  const favoris   = favorisInPeriod.length

  const mrr = (abonActifs ?? []).reduce((s, a) => {
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

  const dataFrom = periode === 'tout' ? (allCommandes ?? []).map(c => c.created_at).sort()[0] : undefined
  const slots = getHistoriqueSlots(periode, from, to, dataFrom)
  const historique = slots.map(slot => {
    const mCmds    = (allCommandes ?? []).filter(c => c.created_at    >= slot.from && c.created_at    < slot.to)
    const mLignes  = (allLignes   ?? []).filter(l => l.created_at     >= slot.from && l.created_at     < slot.to)
    const mPlays   = (allPlays    ?? []).filter(p => p.played_at      >= slot.from && p.played_at      < slot.to)
    const mFreeDl  = (allFreeDl   ?? []).filter(f => f.downloaded_at  >= slot.from && f.downloaded_at  < slot.to)
    const mCollabs = (allCollabs  ?? []).filter(c => c.created_at     >= slot.from && c.created_at     < slot.to)

    const mCa      = mCmds.reduce((s, c) => s + c.prix_paye, 0)
    const mRemise  = mCmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
    const mFavoris = (allFavoris ?? []).filter(f => (f as { created_at: string }).created_at >= slot.from && (f as { created_at: string }).created_at < slot.to).length

    const slotStart = new Date(slot.from)
    const slotEnd   = new Date(slot.to)
    const mMrr = (allAbonnements ?? [])
      .filter(a => {
        const debut = new Date(a.date_debut)
        const fin   = a.date_fin ? new Date(a.date_fin) : null
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
      ecoutes:      mPlays.length,
      free_dl:      mFreeDl.length,
      collab_ca:    mCollabs.reduce((s, c) => s + c.montant, 0) / 100,
      favoris:      mFavoris,
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

  // Dernières licences — au niveau article (5 derniers beats vendus, pas 5 derniers paniers)
  type Raw = { id: string; created_at: string; prix_paye: number; reduction_montant: number | null; beats: unknown; licences: unknown }
  const dernieres_licences = ((allLignes ?? []) as unknown as Raw[]).slice(0, 5).map((d: Raw) => {
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
    kpis: { ca: ca_brut, ca_brut, ca_net, mrr, arr, collab_ca, panier_moyen, beats_vendus, ecoutes, free_dl, favoris },
    historique,
    top_beats,
    dernieres_licences,
    abonnes,
  })
}
