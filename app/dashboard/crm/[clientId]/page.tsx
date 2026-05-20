import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type Commande = {
  id: string
  created_at: string
  prix_paye: number
  statut: string
  plateforme_source: string | null
  beats: { titre: string; image_url: string | null } | null
  licences: { nom: string } | null
}

export default async function FicheClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: client } = await admin
    .from('clients')
    .select('id, email, nom, prenom, created_at, pays')
    .eq('id', clientId)
    .single()

  if (!client) redirect('/dashboard/crm')

  const [{ data: commandesRaw }, { data: abonnement }] = await Promise.all([
    supabase
      .from('commandes')
      .select(`
        id, created_at, prix_paye, statut, plateforme_source,
        beats(titre, image_url),
        licences(nom)
      `)
      .eq('beatmaker_id', user.id)
      .or(`client_id.eq.${clientId},acheteur_email.eq.${client.email}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('abonnements_boutique')
      .select('statut, date_debut, date_fin, en_essai, plan, prix')
      .eq('beatmaker_id', user.id)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const commandes = (commandesRaw ?? []) as unknown as Commande[]
  const payees = commandes.filter(c => c.statut === 'payee')
  const nbAchats = payees.length
  const caTotal = payees.reduce((s, c) => s + c.prix_paye, 0)

  const nomComplet = `${client.prenom ?? ''} ${client.nom ?? ''}`.trim()
  const initiales = [client.prenom?.[0], client.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/dashboard/crm" className="text-sm text-gray-500 hover:text-gray-300 mb-6 block">
          ← Mon CRM
        </Link>

        {/* En-tête client */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-indigo-900/60 flex items-center justify-center text-indigo-300 font-bold text-xl flex-shrink-0">
              {initiales}
            </div>
            <div>
              <h1 className="text-xl font-bold">{nomComplet || client.email}</h1>
              <p className="text-gray-400 text-sm">{client.email}</p>
              {client.pays && <p className="text-gray-600 text-xs mt-0.5">{client.pays}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-800">
            <div>
              <p className="text-gray-500 text-xs mb-1">Achats</p>
              <p className="text-2xl font-black">{nbAchats}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">CA total</p>
              <p className="text-2xl font-black">{caTotal} €</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Abonnement</p>
              {abonnement?.statut === 'actif' ? (
                <p className="text-green-400 font-bold">Actif</p>
              ) : (
                <p className="text-gray-600">—</p>
              )}
            </div>
          </div>

          <p className="text-gray-600 text-xs mt-4">
            Client depuis le {new Date(client.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit', month: 'long', year: 'numeric',
            })}
          </p>
        </div>

        {/* Abonnement */}
        {abonnement && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
            <h2 className="font-bold text-white mb-3">Abonnement</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white capitalize">Plan {abonnement.plan}</p>
                <p className="text-xs text-gray-500">
                  Depuis le {new Date(abonnement.date_debut).toLocaleDateString('fr-FR')}
                  {abonnement.en_essai && ' · Essai gratuit'}
                  {abonnement.prix && ` · ${Math.round(abonnement.prix / 100)} €/mois`}
                </p>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                abonnement.statut === 'actif' ? 'bg-green-500/20 text-green-400'
                : abonnement.statut === 'annule' ? 'bg-gray-700 text-gray-400'
                : 'bg-red-500/20 text-red-400'
              }`}>
                {abonnement.statut === 'actif' ? 'Actif'
                  : abonnement.statut === 'annule' ? 'Annulé'
                  : 'Impayé'}
              </span>
            </div>
          </div>
        )}

        {/* Historique achats */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-bold text-white mb-4">
            Historique <span className="text-gray-500 font-normal">({commandes.length})</span>
          </h2>

          {commandes.length === 0 ? (
            <p className="text-gray-600 text-sm">Aucun achat pour l&apos;instant.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {commandes.map(c => {
                const isBs = c.plateforme_source === 'beatstars'
                const titre = c.beats?.titre ?? (isBs ? 'Import BeatStars' : 'Beat supprimé')
                const licence = c.licences?.nom ?? (isBs ? '—' : 'Licence inconnue')
                return (
                  <div key={c.id} className="flex items-center gap-3 py-3 border-b border-gray-800 last:border-0">
                    {c.beats?.image_url ? (
                      <img src={c.beats.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center text-gray-600 text-xs font-bold">
                        {isBs ? 'BS' : '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm truncate">{titre}</p>
                      <p className="text-xs text-gray-500">
                        {licence} · {new Date(c.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-white">{c.prix_paye} €</p>
                      {isBs && <p className="text-xs text-orange-400">BeatStars</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
