import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type BeatSplitRow = {
  id: string
  pourcentage: number
  statut: string
  beats: {
    id: string
    titre: string
    image_url: string | null
    statut: string
    beatmakers: { nom_artiste: string } | null
  } | null
  split_payments: {
    montant: number
    statut: 'en_attente' | 'transfere' | 'expire'
  }[]
}

export default async function MesCollabsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  // Splits où ce beatmaker est collaborateur (pas propriétaire)
  const { data: raw } = await admin
    .from('beat_splits')
    .select(`
      id, pourcentage, statut,
      beats(
        id, titre, image_url, statut,
        beatmakers(nom_artiste)
      ),
      split_payments(montant, statut)
    `)
    .eq('beatmaker_id', user.id)
    .order('created_at', { ascending: false })

  const splits = (raw ?? []) as unknown as BeatSplitRow[]

  const totalRecu = splits.reduce((s, sp) =>
    s + sp.split_payments
      .filter(p => p.statut === 'transfere')
      .reduce((ss, p) => ss + p.montant, 0), 0)
  const totalEnAttente = splits.reduce((s, sp) =>
    s + sp.split_payments
      .filter(p => p.statut === 'en_attente')
      .reduce((ss, p) => ss + p.montant, 0), 0)

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-400 mb-2 inline-block">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold">Mes collaborations</h1>
            <p className="text-gray-400 text-sm mt-1">
              {splits.length} beat{splits.length > 1 ? 's' : ''} en collab
            </p>
          </div>
          <div className="text-right space-y-1">
            {totalRecu > 0 && (
              <div>
                <p className="text-xs text-gray-500">Reçu</p>
                <p className="text-xl font-black text-green-400">{(totalRecu / 100).toFixed(2)}€</p>
              </div>
            )}
            {totalEnAttente > 0 && (
              <div>
                <p className="text-xs text-gray-500">En attente</p>
                <p className="text-lg font-bold text-yellow-400">{(totalEnAttente / 100).toFixed(2)}€</p>
              </div>
            )}
          </div>
        </div>

        {splits.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-lg">Aucune collaboration pour l&apos;instant.</p>
            <p className="text-sm mt-2">
              Quand un beatmaker vous ajoute sur un beat, il apparaîtra ici.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {splits.map(sp => {
              const beat = sp.beats
              const nbVentes = sp.split_payments.length
              const montantRecu = sp.split_payments
                .filter(p => p.statut === 'transfere')
                .reduce((s, p) => s + p.montant, 0)
              const montantEnAttente = sp.split_payments
                .filter(p => p.statut === 'en_attente')
                .reduce((s, p) => s + p.montant, 0)
              const estPublic = beat?.statut === 'public'

              return (
                <div key={sp.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4 items-center">
                  {/* Cover */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                    {beat?.image_url ? (
                      <img src={beat.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs font-bold">
                        {beat?.titre?.slice(0, 2).toUpperCase() ?? '??'}
                      </div>
                    )}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white truncate">{beat?.titre ?? 'Beat supprimé'}</p>
                      {!estPublic && (
                        <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded flex-shrink-0">
                          {beat?.statut === 'prive' ? 'Privé' : 'Brouillon'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Par {beat?.beatmakers?.nom_artiste ?? 'Beatmaker'} · Ta part : {sp.pourcentage}%
                    </p>
                    {nbVentes > 0 && (
                      <p className="text-xs text-gray-500">
                        {nbVentes} vente{nbVentes > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Revenus */}
                  <div className="text-right flex-shrink-0 space-y-1">
                    {montantRecu > 0 && (
                      <p className="text-sm font-bold text-green-400">
                        +{(montantRecu / 100).toFixed(2)}€ <span className="text-xs font-normal text-gray-500">reçu</span>
                      </p>
                    )}
                    {montantEnAttente > 0 && (
                      <p className="text-sm font-bold text-yellow-400">
                        {(montantEnAttente / 100).toFixed(2)}€ <span className="text-xs font-normal text-gray-500">en attente</span>
                      </p>
                    )}
                    {nbVentes === 0 && (
                      <p className="text-xs text-gray-600">Pas encore vendu</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Info sur la config Stripe */}
        <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-400">
          <p className="font-medium text-white mb-1">Recevoir tes revenus</p>
          <p>
            Pour recevoir les paiements de tes collaborations, tu dois connecter ton compte Stripe dans{' '}
            <Link href="/dashboard/paiements" className="text-indigo-400 hover:text-indigo-300">
              Paiements
            </Link>
            .
          </p>
        </div>

      </div>
    </main>
  )
}
