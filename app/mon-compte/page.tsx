import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type AboRow = {
  id: string
  statut: string
  en_essai: boolean | null
  essai_fin_le: string | null
  date_debut: string | null
  stripe_subscription_id: string | null
  beatmakers: { nom_artiste: string; slug: string } | null
}

type CmdRow = {
  id: string
  created_at: string
  prix_paye: number
  devise: string
  beats: { titre: string; image_url: string | null } | null
  licences: { nom: string } | null
}

export default async function MonComptePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/artiste/connexion?redirect=/mon-compte')

  const admin = createAdminClient()
  const email = user.email!

  // Si c'est un beatmaker, le rediriger vers son dashboard
  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (beatmaker) redirect('/dashboard')

  // Abonnements actifs (par client_id ou email pour la rétrocompatibilité)
  const { data: abonnements } = await admin
    .from('abonnements_boutique')
    .select('id, statut, en_essai, essai_fin_le, date_debut, stripe_subscription_id, beatmakers(nom_artiste, slug)')
    .or(`client_id.eq.${user.id},acheteur_email.eq.${email}`)
    .eq('statut', 'actif')
    .order('date_debut', { ascending: false })

  // Commandes (par client_id ou email)
  const { data: commandes } = await admin
    .from('commandes')
    .select('id, created_at, prix_paye, devise, beats(titre, image_url), licences(nom)')
    .or(`client_id.eq.${user.id},acheteur_email.eq.${email}`)
    .order('created_at', { ascending: false })

  // Profil client
  const { data: client } = await admin
    .from('clients')
    .select('prenom, nom, nom_artiste')
    .eq('id', user.id)
    .single()

  const prenomAffiche = client?.nom_artiste || client?.prenom || email.split('@')[0]

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-16">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-black text-white">Bonjour, {prenomAffiche} 👋</h1>
            <p className="text-gray-500 text-sm mt-1">{email}</p>
          </div>
          <form action="/api/artiste/deconnexion" method="POST">
            <button
              type="submit"
              className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
            >
              Déconnexion
            </button>
          </form>
        </div>

        {/* Abonnements actifs */}
        <section className="mb-10">
          <h2 className="text-base font-bold text-white mb-4 uppercase tracking-wider text-xs text-gray-400">
            Abonnements actifs
          </h2>
          {!abonnements?.length ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <p className="text-gray-500 text-sm">Aucun abonnement actif pour l&apos;instant.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(abonnements as unknown as AboRow[]).map(abo => {
                const bm = abo.beatmakers
                const enEssai = abo.en_essai ?? false
                const essaiFin = abo.essai_fin_le
                  ? new Date(abo.essai_fin_le).toLocaleDateString('fr-FR')
                  : null
                return (
                  <div key={abo.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">{bm?.nom_artiste ?? 'Beatmaker'}</p>
                      {enEssai && essaiFin ? (
                        <p className="text-xs text-green-400 mt-0.5">Essai gratuit jusqu&apos;au {essaiFin}</p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Membre depuis {abo.date_debut ? new Date(abo.date_debut).toLocaleDateString('fr-FR') : '—'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-500/30">
                        {enEssai ? 'Essai' : 'Actif'}
                      </span>
                      {bm?.slug && (
                        <Link
                          href={`/${bm.slug}/mon-abonnement`}
                          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          Gérer →
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Favoris */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Mes favoris</h2>
            <Link href="/mon-compte/favoris" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
              Voir tout →
            </Link>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <Link href="/mon-compte/favoris" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">
              Accéder à mes beats likés ♥
            </Link>
          </div>
        </section>

        {/* Historique achats */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
            Historique des achats ({commandes?.length ?? 0})
          </h2>
          {!commandes?.length ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <p className="text-gray-500 text-sm">Aucun achat pour l&apos;instant.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(commandes as unknown as CmdRow[]).map(cmd => {
                const beat = cmd.beats
                const licence = cmd.licences
                return (
                  <div key={cmd.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
                    {beat?.image_url ? (
                      <img src={beat.image_url} alt={beat.titre} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center text-gray-600 text-xs font-bold">
                        {beat?.titre?.slice(0, 2).toUpperCase() ?? '??'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{beat?.titre ?? 'Beat'}</p>
                      <p className="text-gray-500 text-xs">
                        {licence?.nom ?? '—'} · {Number(cmd.prix_paye).toFixed(2)}€ · {new Date(cmd.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <Link
                      href={`/telechargement/${cmd.id}`}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors flex-shrink-0"
                    >
                      ⬇ Télécharger
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
