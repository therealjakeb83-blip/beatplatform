import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'

const STATUT_STYLES: Record<string, string> = {
  en_attente: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  payee: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  remboursee: 'bg-gray-700/30 text-gray-400 border-gray-600/30',
  litige: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export default async function CommandeAdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: commande } = await admin
    .from('commandes')
    .select(`
      id, created_at, prix_paye, devise, statut, methode_paiement, code_promo, reduction_montant,
      fichiers_livres, source_marketing, type_commande, plateforme_source, acheteur_email, acheteur_nom,
      client_id, beatmaker_id,
      clients ( id, prenom, nom, email ),
      beatmakers ( id, nom_artiste, slug ),
      commande_lignes ( id, prix_paye, reduction_montant, beats ( titre ), licences ( nom ) )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!commande) notFound()

  type Ligne = { id: string; prix_paye: number; reduction_montant: number | null; beats: { titre: string } | null; licences: { nom: string } | null }
  const lignes = (commande.commande_lignes ?? []) as unknown as Ligne[]
  const client = commande.clients as unknown as { id: string; prenom: string | null; nom: string; email: string } | null
  const beatmaker = commande.beatmakers as unknown as { id: string; nom_artiste: string; slug: string } | null

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/admin/recherche" className="text-xs text-gray-500 hover:text-gray-300">← Recherche</Link>
          <h1 className="text-xl font-bold text-white mt-1">Commande #{commande.id.slice(0, 8).toUpperCase()}</h1>
          <p className="text-sm text-gray-500">{new Date(commande.created_at).toLocaleString('fr-FR')}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded border ${STATUT_STYLES[commande.statut] ?? ''}`}>{commande.statut}</span>
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
          ) : <p className="text-sm text-gray-600">{commande.acheteur_email ?? 'Invité'}</p>}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">Détail ({lignes.length} article{lignes.length > 1 ? 's' : ''})</p>
        {lignes.map(l => (
          <div key={l.id} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-white">{l.beats?.titre ?? '—'} <span className="text-gray-600">— {l.licences?.nom ?? '—'}</span></span>
            <span className="text-sm text-gray-400">{l.prix_paye}€</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3 font-semibold">
          <span className="text-sm text-white">Total{commande.code_promo ? ` (code ${commande.code_promo})` : ''}</span>
          <span className="text-sm text-white">{commande.prix_paye}€</span>
        </div>
      </div>

      <p className="text-xs text-gray-600">
        {commande.methode_paiement} — {commande.plateforme_source} — {commande.type_commande}
        {commande.source_marketing ? ` — source : ${commande.source_marketing}` : ''}
        {commande.fichiers_livres ? ' — fichiers livrés' : ' — fichiers non livrés'}
      </p>
    </div>
  )
}
