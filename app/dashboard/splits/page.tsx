import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type SplitPaymentRow = {
  id: string
  montant: number
  statut: 'en_attente' | 'transfere' | 'expire'
  email_invite: string | null
  beatmaker_id: string | null
  beatmakers: { nom_artiste: string } | null
  beat_splits: { pourcentage: number } | null
}

type CommandeAvecSplits = {
  id: string
  prix_paye: number
  created_at: string
  beats: { titre: string; image_url: string | null } | null
  split_payments: SplitPaymentRow[]
}

const STATUT = {
  transfere:  { label: 'Transféré',   icon: '✅', couleur: 'text-green-400 bg-green-900/30' },
  en_attente: { label: 'En attente',  icon: '⏳', couleur: 'text-yellow-400 bg-yellow-900/30' },
  expire:     { label: 'Expiré',      icon: '❌', couleur: 'text-gray-400 bg-gray-800' },
}

export default async function SplitsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  const { data: raw } = await admin
    .from('commandes')
    .select(`
      id, prix_paye, created_at,
      beats(titre, image_url),
      split_payments(
        id, montant, statut, email_invite, beatmaker_id,
        beatmakers(nom_artiste),
        beat_splits(pourcentage)
      )
    `)
    .eq('beatmaker_id', user.id)
    .not('stripe_transfer_group', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const commandes = (raw ?? []) as unknown as CommandeAvecSplits[]

  const totalTransfere = commandes.reduce((s, c) =>
    s + c.split_payments.filter(p => p.statut === 'transfere').reduce((ss, p) => ss + p.montant, 0), 0)
  const totalEnAttente = commandes.reduce((s, c) =>
    s + c.split_payments.filter(p => p.statut === 'en_attente').reduce((ss, p) => ss + p.montant, 0), 0)

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-400 mb-2 inline-block">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold">Mes splits</h1>
            <p className="text-gray-400 text-sm mt-1">{commandes.length} vente{commandes.length > 1 ? 's' : ''} avec collaborateurs</p>
          </div>
          <div className="text-right space-y-1">
            <div>
              <p className="text-xs text-gray-500">Distribué</p>
              <p className="text-xl font-black text-green-400">{(totalTransfere / 100).toFixed(2)}€</p>
            </div>
            {totalEnAttente > 0 && (
              <div>
                <p className="text-xs text-gray-500">En attente</p>
                <p className="text-lg font-bold text-yellow-400">{(totalEnAttente / 100).toFixed(2)}€</p>
              </div>
            )}
          </div>
        </div>

        {commandes.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-lg">Aucune vente avec split pour l&apos;instant.</p>
            <p className="text-sm mt-2">Les beats avec collaborateurs apparaîtront ici après leur première vente.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {commandes.map(c => {
              const date = new Date(c.created_at).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'short', year: 'numeric',
              })
              const hasEnAttente = c.split_payments.some(p => p.statut === 'en_attente')

              return (
                <div
                  key={c.id}
                  className={`bg-gray-900 border rounded-xl p-4 ${hasEnAttente ? 'border-yellow-800/50' : 'border-gray-800'}`}
                >
                  {/* Beat + vente */}
                  <div className="flex gap-3 items-center mb-4">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                      {c.beats?.image_url ? (
                        <img src={c.beats.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs font-bold">
                          {c.beats?.titre?.slice(0, 2).toUpperCase() ?? '??'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{c.beats?.titre ?? 'Beat supprimé'}</p>
                      <p className="text-xs text-gray-500">{date} · {c.prix_paye}€ encaissé</p>
                    </div>
                    {hasEnAttente && (
                      <span className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded-full flex-shrink-0">
                        Fonds en attente
                      </span>
                    )}
                  </div>

                  {/* Split payments */}
                  <div className="flex flex-col gap-2">
                    {c.split_payments.map(p => {
                      const statut = STATUT[p.statut] ?? STATUT.en_attente
                      const nom = p.beatmakers?.nom_artiste ?? p.email_invite ?? 'Collaborateur'
                      const pct = p.beat_splits?.pourcentage
                      const montantEuros = (p.montant / 100).toFixed(2)

                      return (
                        <div key={p.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">
                              {nom}
                              {!p.beat_splits && <span className="text-gray-500 text-xs ml-1">(propriétaire)</span>}
                            </p>
                            {pct && (
                              <p className="text-xs text-gray-500">{pct}%</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <p className="text-sm font-bold text-white">{montantEuros}€</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statut.couleur}`}>
                              {statut.icon} {statut.label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
