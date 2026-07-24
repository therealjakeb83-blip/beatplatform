import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'

const STATUT_STYLES: Record<string, string> = {
  actif: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  impaye: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  annule: 'bg-gray-700/30 text-gray-400 border-gray-600/30',
  suspendu: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export default async function AbonnementAdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: abo } = await admin
    .from('abonnements_boutique')
    .select(`
      id, created_at, statut, plan, periode, prix, devise, mois_consecutifs, credit_licences,
      date_debut, date_fin, date_annulation, motif_annulation, methode_paiement,
      acheteur_email, acheteur_nom, stripe_subscription_id, client_id, beatmaker_id,
      clients ( id, prenom, nom, email ),
      beatmakers ( id, nom_artiste, slug )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!abo) notFound()

  const client = abo.clients as unknown as { id: string; prenom: string | null; nom: string; email: string } | null
  const beatmaker = abo.beatmakers as unknown as { id: string; nom_artiste: string; slug: string } | null

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/admin/recherche" className="text-xs text-gray-500 hover:text-gray-300">← Recherche</Link>
          <h1 className="text-xl font-bold text-white mt-1">Abonnement A-{abo.id.slice(0, 8).toUpperCase()}</h1>
          <p className="text-sm text-gray-500">Souscrit le {new Date(abo.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded border ${STATUT_STYLES[abo.statut] ?? ''}`}>{abo.statut}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Boutique</p>
          {beatmaker ? (
            <Link href={`/dashboard/admin/boutiques/${beatmaker.id}`} className="text-sm text-white hover:underline">{beatmaker.nom_artiste} — {beatmaker.slug}</Link>
          ) : <p className="text-sm text-gray-600">—</p>}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Client</p>
          {client ? (
            <Link href={`/dashboard/admin/clients/${client.id}`} className="text-sm text-white hover:underline">{client.prenom} {client.nom} — {client.email}</Link>
          ) : <p className="text-sm text-gray-600">{abo.acheteur_email ?? '—'}</p>}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 grid sm:grid-cols-2 gap-3 text-sm">
        <p className="text-gray-400">Plan <span className="text-white float-right">{abo.plan} — {abo.periode}</span></p>
        <p className="text-gray-400">Prix <span className="text-white float-right">{(abo.prix / 100).toFixed(2)}{abo.devise === 'USD' ? '$' : '€'}</span></p>
        <p className="text-gray-400">Mois consécutifs <span className="text-white float-right">{abo.mois_consecutifs}</span></p>
        <p className="text-gray-400">Crédit licences <span className="text-white float-right">{abo.credit_licences}</span></p>
        <p className="text-gray-400">Début <span className="text-white float-right">{new Date(abo.date_debut).toLocaleDateString('fr-FR')}</span></p>
        <p className="text-gray-400">Fin de cycle <span className="text-white float-right">{new Date(abo.date_fin).toLocaleDateString('fr-FR')}</span></p>
        {abo.date_annulation && <p className="text-gray-400">Annulation <span className="text-white float-right">{new Date(abo.date_annulation).toLocaleDateString('fr-FR')} ({abo.motif_annulation})</span></p>}
      </div>

      <p className="text-xs text-gray-600">
        {abo.methode_paiement === 'paypal' ? 'PayPal' : 'Stripe'}
        {abo.stripe_subscription_id ? ` — ${abo.stripe_subscription_id}` : ''}
      </p>
    </div>
  )
}
