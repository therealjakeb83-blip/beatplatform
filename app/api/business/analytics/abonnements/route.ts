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

  const [{ data: abonnements }, { data: commandes }] = await Promise.all([
    admin.from('abonnements_boutique')
      .select('id, created_at, prix, statut, periode, date_debut, date_fin, annulation_en_cours, mois_consecutifs, mensualites_payees, acheteur_nom, acheteur_email, clients(prenom, nom, email, pays)')
      .eq('beatmaker_id', user.id)
      .order('date_debut', { ascending: false }),
    admin.from('commandes')
      .select('client_id, acheteur_email, created_at')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'payee')
      .eq('type_commande', 'LICENCE'),
  ])

  const abos    = abonnements ?? []
  const now     = new Date()
  const endDate = to ? new Date(to) : now

  // Snapshot à la fin de la période : actifs, MRR, ARR
  const actifs = abos.filter(a => {
    const debut = new Date(a.date_debut)
    const fin   = a.date_fin ? new Date(a.date_fin) : null
    return debut <= endDate && (fin === null || fin > endDate)
  })
  const mrr = actifs.reduce((s, a) => {
    const mensuel = a.periode === 'annuel' ? a.prix / 12 : a.prix
    return s + mensuel
  }, 0) / 100
  const arr           = mrr * 12
  const en_annulation = actifs.filter(a => a.annulation_en_cours).length

  // Abonnements commencés pendant la période
  const abosInPeriod    = abos.filter(a => inPeriod(a.date_debut, from, to))
  const annulesInPeriod = abos.filter(a => a.statut === 'annule' && a.date_fin && inPeriod(a.date_fin, from, to))
  const total_vendus    = abosInPeriod.length

  // Rétention moyenne (mois) sur les abonnements de la période
  const durees = abosInPeriod.map(a => {
    const debut = new Date(a.date_debut)
    const fin   = a.date_fin ? new Date(a.date_fin) : now
    return (fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  })
  const retention_moy = durees.length ? durees.reduce((s, d) => s + d, 0) / durees.length : 0

  const churn_rate = total_vendus > 0 ? (annulesInPeriod.length / total_vendus) * 100 : 0

  // Achats post-abo — map par id d'abonnement (pour la table) + moyenne KPI (sur la période)
  const cmds = commandes ?? []
  const achatsMap = new Map<string, number>()
  for (const a of abos) {
    const cl    = Array.isArray(a.clients) ? a.clients[0] : a.clients
    const email = (cl as { email: string } | null)?.email ?? a.acheteur_email
    achatsMap.set(a.id, cmds.filter(c =>
      c.created_at > a.date_debut &&
      (c.client_id === (cl as { id?: string } | null)?.id || c.acheteur_email === email)
    ).length)
  }
  const achats_post_abo = abosInPeriod.length
    ? abosInPeriod.reduce((s, a) => s + (achatsMap.get(a.id) ?? 0), 0) / abosInPeriod.length
    : 0

  // Table abonnés
  type Raw = typeof abos[number]
  const abonnes = abos.map((a: Raw) => {
    const cl = Array.isArray(a.clients) ? a.clients[0] : a.clients
    const nom = cl
      ? [(cl as { prenom: string | null }).prenom, (cl as { nom: string }).nom].filter(Boolean).join(' ')
      : (a.acheteur_nom ?? a.acheteur_email ?? '—')
    const pays = (cl as { pays: string | null } | null)?.pays ?? null
    const debut = new Date(a.date_debut)
    const fin   = a.date_fin ? new Date(a.date_fin) : now
    const mois  = (fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    const ltv   = (a.mensualites_payees ?? 0) * a.prix / 100

    return {
      id:               a.id,
      client_nom:       nom,
      pays,
      plan:             a.periode === 'annuel' ? 'Annuel' : 'Mensuel',
      date_debut:       a.date_debut,
      date_fin:         a.date_fin,
      mois_anciennete:  Math.max(1, Math.floor(mois)),
      statut:           a.annulation_en_cours ? 'annulation' : a.statut,
      prix:             a.prix / 100,
      ltv,
      achats_post_abo:  achatsMap.get(a.id) ?? 0,
    }
  })

  const dataFrom = periode === 'tout' ? abos.map(a => a.date_debut).sort()[0] : undefined
  const slots = getHistoriqueSlots(periode, from, to, dataFrom)
  const historique = slots.map(slot => {
    const slotStart = new Date(slot.from)
    const slotEnd   = new Date(slot.to)
    const mActifs = abos.filter(a => {
      const debut = new Date(a.date_debut)
      const fin   = a.date_fin ? new Date(a.date_fin) : null
      return debut < slotEnd && (fin === null || fin >= slotStart)
    })
    const mMrr = mActifs.reduce((s, a) => s + (a.periode === 'annuel' ? a.prix / 12 : a.prix), 0) / 100
    return { label: slot.label, fullLabel: slot.fullLabel, mrr: mMrr, actifs: mActifs.length }
  })

  return NextResponse.json({
    kpis: { mrr, arr, actifs: actifs.length, en_annulation, total_vendus, retention_moy, churn_rate, achats_post_abo },
    historique,
    abonnes,
  })
}
