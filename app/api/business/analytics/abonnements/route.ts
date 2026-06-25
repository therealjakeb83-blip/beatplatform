import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getLast12Months } from '@/app/dashboard/business/analytics/_lib/periode'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

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

  const abos = abonnements ?? []

  // KPIs globaux
  const actifs = abos.filter(a => a.statut === 'actif')
  const mrr    = actifs.reduce((s, a) => {
    const mensuel = a.periode === 'annuel' ? a.prix / 12 : a.prix
    return s + mensuel
  }, 0) / 100
  const arr = mrr * 12

  const en_annulation = abos.filter(a => a.annulation_en_cours).length
  const total_vendus  = abos.length
  const annules       = abos.filter(a => a.statut === 'annule')

  // Rétention moyenne (en mois)
  const now = new Date()
  const durees = abos.map(a => {
    const debut = new Date(a.date_debut)
    const fin   = a.date_fin ? new Date(a.date_fin) : now
    return (fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  })
  const retention_moy = durees.length ? durees.reduce((s, d) => s + d, 0) / durees.length : 0

  const churn_rate = total_vendus > 0 ? (annules.length / total_vendus) * 100 : 0

  // Achats post-abo moyens
  const cmds = commandes ?? []
  const achatsParAbo = abos.map(a => {
    const cl = Array.isArray(a.clients) ? a.clients[0] : a.clients
    const email = (cl as { email: string } | null)?.email ?? a.acheteur_email
    const debut = a.date_debut
    return cmds.filter(c =>
      c.created_at > debut &&
      (c.client_id === (cl as { id?: string } | null)?.id || c.acheteur_email === email)
    ).length
  })
  const achats_post_abo = achatsParAbo.length
    ? achatsParAbo.reduce((s, n) => s + n, 0) / achatsParAbo.length
    : 0

  // Table abonnés
  type Raw = typeof abos[number]
  const abonnes = abos.map((a: Raw, i: number) => {
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
      achats_post_abo:  achatsParAbo[i] ?? 0,
    }
  })

  // Historique 12 mois (MRR approximé)
  const mois12 = getLast12Months()
  const historique = mois12.map(({ year, month, label, fullLabel }) => {
    const monthStart = new Date(year, month, 1)
    const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59)
    const mActifs = abos.filter(a => {
      const debut = new Date(a.date_debut)
      const fin   = a.date_fin ? new Date(a.date_fin) : null
      return debut <= monthEnd && (fin === null || fin >= monthStart)
    })
    const mMrr = mActifs.reduce((s, a) => s + (a.periode === 'annuel' ? a.prix / 12 : a.prix), 0) / 100
    return { label, fullLabel, mrr: mMrr, actifs: mActifs.length }
  })

  return NextResponse.json({
    kpis: { mrr, arr, actifs: actifs.length, en_annulation, total_vendus, retention_moy, churn_rate, achats_post_abo },
    historique,
    abonnes,
  })
}
