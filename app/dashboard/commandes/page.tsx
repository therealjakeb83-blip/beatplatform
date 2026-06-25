import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type Commande = {
  id: string
  created_at: string
  acheteur_email: string | null
  acheteur_nom: string | null
  prix_paye: number
  devise: string
  statut: string
  code_promo: string | null
  reduction_montant: number
  fichiers_livres: boolean
  beats: { titre: string; image_url: string | null } | null
  licences: { nom: string } | null
}

const STATUT_LABEL: Record<string, { label: string; couleur: string }> = {
  payee:      { label: 'Payée',       couleur: 'text-green-400 bg-green-900/30' },
  en_attente: { label: 'En attente',  couleur: 'text-yellow-400 bg-yellow-900/30' },
  remboursee: { label: 'Remboursée',  couleur: 'text-gray-400 bg-gray-800' },
  litige:     { label: 'Litige',      couleur: 'text-red-400 bg-red-900/30' },
}

export default async function CommandesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: commandes } = await supabase
    .from('commandes')
    .select(`
      id, created_at, acheteur_email, acheteur_nom,
      prix_paye, devise, statut, code_promo, reduction_montant, fichiers_livres,
      beats(titre, image_url),
      licences(nom)
    `)
    .eq('beatmaker_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (commandes ?? []) as unknown as Commande[]
  const totalCA = rows.filter(c => c.statut === 'payee').reduce((s, c) => s + c.prix_paye, 0)

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Mes commandes</h1>
            <p className="text-gray-400 text-sm">{rows.length} commande{rows.length > 1 ? 's' : ''}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-0.5">Chiffre d&apos;affaires total</p>
            <p className="text-2xl font-black text-white">{totalCA}€</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-lg">Aucune vente pour l&apos;instant.</p>
            <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 text-sm mt-2 inline-block">
              ← Retour au dashboard
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map(c => {
              const statut = STATUT_LABEL[c.statut] ?? { label: c.statut, couleur: 'text-gray-400 bg-gray-800' }
              const date = new Date(c.created_at).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'short', year: 'numeric',
              })
              return (
                <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4 items-center">
                  {/* Cover */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                    {c.beats?.image_url ? (
                      <img src={c.beats.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs font-bold">
                        {c.beats?.titre?.slice(0, 2).toUpperCase() ?? '??'}
                      </div>
                    )}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{c.beats?.titre ?? 'Beat supprimé'}</p>
                    <p className="text-xs text-gray-500">
                      {c.licences?.nom ?? 'Licence'} · {c.acheteur_nom ?? c.acheteur_email ?? 'Acheteur inconnu'}
                    </p>
                    {c.code_promo && (
                      <p className="text-xs text-indigo-400 mt-0.5">
                        Code : {c.code_promo} (-{c.reduction_montant}€)
                      </p>
                    )}
                  </div>

                  {/* Prix + statut */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-white">{Number(c.prix_paye).toFixed(2)}€</p>
                    <p className="text-xs text-gray-500 mb-1">{date}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statut.couleur}`}>
                      {statut.label}
                    </span>
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
