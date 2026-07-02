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
      .select('id, created_at, prix, statut, periode, date_debut, date_fin, annulation_en_cours, mois_consecutifs, mensualites_payees, acheteur_nom, acheteur_email, clients(id, prenom, nom, email, pays)')
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

  // Rétention moyenne (mois) — all-time, indépendante de la période sélectionnée
  const durees = abos.map(a => {
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
    const cl      = Array.isArray(a.clients) ? a.clients[0] : a.clients
    const email   = (cl as { email: string } | null)?.email ?? a.acheteur_email
    const clientId = (cl as { id?: string } | null)?.id
    const finAbo  = a.date_fin ?? now.toISOString()
    achatsMap.set(a.id, cmds.filter(c =>
      c.created_at > a.date_debut &&
      c.created_at <= finAbo &&
      (c.client_id === clientId || c.acheteur_email === email)
    ).length)
  }
  const achats_post_abo = abosInPeriod.length
    ? abosInPeriod.reduce((s, a) => s + (achatsMap.get(a.id) ?? 0), 0) / abosInPeriod.length
    : 0

  // Table abonnés
  type Raw = typeof abos[number]
  const abonnes = abos.map((a: Raw) => {
    const cl        = Array.isArray(a.clients) ? a.clients[0] : a.clients
    const client_id = (cl as { id?: string } | null)?.id ?? null
    const nom       = cl
      ? [(cl as { prenom: string | null }).prenom, (cl as { nom: string }).nom].filter(Boolean).join(' ')
      : (a.acheteur_nom ?? a.acheteur_email ?? '—')
    const pays = (cl as { pays: string | null } | null)?.pays ?? null
    const debut = new Date(a.date_debut)
    const fin   = a.date_fin ? new Date(a.date_fin) : now
    const mois  = (fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    const mois_anciennete = Math.max(1, Math.floor(mois))
    const ltv   = (a.mensualites_payees ?? 0) * a.prix / 100

    return {
      id:               a.id,
      client_id,
      client_nom:       nom,
      pays,
      date_debut:       a.date_debut,
      date_fin:         a.date_fin,
      mois_anciennete,
      beats_offerts:    Math.floor(mois_anciennete / 4),
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
    const mMrr          = mActifs.reduce((s, a) => s + (a.periode === 'annuel' ? a.prix / 12 : a.prix), 0) / 100
    const abosDebutSlot = abos.filter(a => a.date_debut >= slot.from && a.date_debut < slot.to)
    const mTotalVendus  = abosDebutSlot.length
    const mRetentionMoy = abosDebutSlot.length
      ? abosDebutSlot.reduce((s, a) => {
          const debut = new Date(a.date_debut)
          const fin   = a.date_fin ? new Date(a.date_fin) : now
          return s + (fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
        }, 0) / abosDebutSlot.length
      : 0
    const mChurnCount   = abos.filter(a => a.statut === 'annule' && a.date_fin && a.date_fin >= slot.from && a.date_fin < slot.to).length
    const mAchatsPostAbo = cmds.filter(c => {
      if (c.created_at < slot.from || c.created_at >= slot.to) return false
      return abos.some(a => {
        const cl       = Array.isArray(a.clients) ? a.clients[0] : a.clients
        const email    = (cl as { email: string } | null)?.email ?? a.acheteur_email
        const clientId = (cl as { id?: string } | null)?.id
        const finAbo   = a.date_fin ?? now.toISOString()
        return c.created_at > a.date_debut && c.created_at <= finAbo &&
               (c.client_id === clientId || c.acheteur_email === email)
      })
    }).length
    return {
      label: slot.label, fullLabel: slot.fullLabel,
      mrr: mMrr, actifs: mActifs.length,
      total_vendus: mTotalVendus, retention_moy: mRetentionMoy, churn_count: mChurnCount, achats_post_abo: mAchatsPostAbo,
    }
  })

  return NextResponse.json({
    kpis: { mrr, arr, actifs: actifs.length, en_annulation, total_vendus, retention_moy, churn_rate, churn_count: annulesInPeriod.length, achats_post_abo },
    historique,
    abonnes,
  })
}
