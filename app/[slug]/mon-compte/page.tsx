import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

type CmdRow = {
  id: string
  created_at: string
  prix_paye: number
  devise: string
  beats: { titre: string; image_url: string | null } | null
  licences: { nom: string } | null
}

type FavoriRow = {
  beat_id: string
  beats: { id: string; titre: string; image_url: string | null } | null
}

export default async function MonCompteBoutiquePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, nom_artiste, abo_actif')
    .eq('slug', slug)
    .single()

  if (!beatmaker) notFound()

  // Identifier l'utilisateur — session Supabase en priorité, cookie abonné en fallback
  const { data: { user } } = await supabase.auth.getUser()
  let emailIdentifie: string | null = null
  let clientId: string | null = null

  if (user) {
    emailIdentifie = user.email ?? null
    clientId = user.id
  } else {
    const cookieStore = await cookies()
    const emailCookie = cookieStore.get(`abo_${slug}`)?.value
    if (emailCookie) emailIdentifie = emailCookie
  }

  if (!emailIdentifie) redirect(`/${slug}`)

  // Abonnement pour cette boutique
  let abo = null
  if (clientId) {
    const { data } = await admin
      .from('abonnements_boutique')
      .select('id, statut, en_essai, essai_fin_le, date_debut, stripe_subscription_id')
      .eq('beatmaker_id', beatmaker.id)
      .or(`client_id.eq.${clientId},acheteur_email.eq.${emailIdentifie}`)
      .order('date_debut', { ascending: false })
      .limit(1)
      .maybeSingle()
    abo = data
  } else {
    const { data } = await admin
      .from('abonnements_boutique')
      .select('id, statut, en_essai, essai_fin_le, date_debut, stripe_subscription_id')
      .eq('beatmaker_id', beatmaker.id)
      .eq('acheteur_email', emailIdentifie)
      .order('date_debut', { ascending: false })
      .limit(1)
      .maybeSingle()
    abo = data
  }

  // Achats sur cette boutique — preview 4 max
  let commandes: CmdRow[] = []
  let totalCommandes = 0
  if (clientId) {
    const { data } = await admin
      .from('commandes')
      .select('id, created_at, prix_paye, devise, beats(titre, image_url), licences(nom)')
      .eq('beatmaker_id', beatmaker.id)
      .or(`client_id.eq.${clientId},acheteur_email.eq.${emailIdentifie}`)
      .order('created_at', { ascending: false })
    const all = (data as unknown as CmdRow[]) ?? []
    totalCommandes = all.length
    commandes = all.slice(0, 4)
  } else {
    const { data } = await admin
      .from('commandes')
      .select('id, created_at, prix_paye, devise, beats(titre, image_url), licences(nom)')
      .eq('beatmaker_id', beatmaker.id)
      .eq('acheteur_email', emailIdentifie)
      .order('created_at', { ascending: false })
    const all = (data as unknown as CmdRow[]) ?? []
    totalCommandes = all.length
    commandes = all.slice(0, 4)
  }

  // Profil client (si connecté)
  let prenomAffiche = emailIdentifie?.split('@')[0] ?? 'Toi'
  let newsletterConsent = false
  if (clientId) {
    const { data: client } = await admin
      .from('clients')
      .select('prenom, nom, nom_artiste, newsletter_consent')
      .eq('id', clientId)
      .maybeSingle()
    prenomAffiche = client?.nom_artiste || client?.prenom || prenomAffiche
    newsletterConsent = client?.newsletter_consent ?? false
  }

  async function toggleNewsletter(formData: FormData) {
    'use server'
    if (!clientId) return
    const valeur = formData.get('newsletter_consent') === 'true'
    const admin2 = createAdminClient()
    await admin2.from('clients').update({ newsletter_consent: valeur }).eq('id', clientId)
    revalidatePath(`/${slug}/mon-compte`)
  }

  // Favoris sur cette boutique — preview 4 max (seulement si connecté)
  let favoris: FavoriRow[] = []
  let totalFavoris = 0
  if (clientId) {
    const { data } = await admin
      .from('favoris')
      .select('beat_id, beats!inner(id, titre, image_url, beatmaker_id)')
      .eq('client_id', clientId)
      .eq('beats.beatmaker_id', beatmaker.id)
    const all = (data as unknown as FavoriRow[]) ?? []
    totalFavoris = all.length
    favoris = all.slice(0, 4)
  }

  const estActif = abo?.statut === 'actif'
  const enEssai = abo?.en_essai ?? false
  const dateDebut = abo?.date_debut ? new Date(abo.date_debut).toLocaleDateString('fr-FR') : null
  const essaiFin = abo?.essai_fin_le ? new Date(abo.essai_fin_le).toLocaleDateString('fr-FR') : null

  return (
    <div className="min-h-screen bg-black px-6 py-16">
      <div className="max-w-lg mx-auto">
        <Link href={`/${slug}`} className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8">
          ← Boutique de {beatmaker.nom_artiste}
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Bonjour, {prenomAffiche}</h1>
            <p className="text-gray-500 text-sm mt-1">{emailIdentifie}</p>
          </div>
          <form action={`/api/artiste/deconnexion?redirect=/${slug}`} method="POST">
            <button type="submit" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">
              Déconnexion
            </button>
          </form>
        </div>

        {/* Abonnement */}
        {beatmaker.abo_actif && (
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Mon abonnement</h2>
            {abo ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">{beatmaker.nom_artiste}</p>
                  {enEssai && essaiFin ? (
                    <p className="text-xs text-green-400 mt-0.5">Essai gratuit jusqu&apos;au {essaiFin}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-0.5">Membre depuis {dateDebut ?? '—'}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    estActif
                      ? enEssai
                        ? 'bg-green-900/40 text-green-400 border border-green-500/30'
                        : 'bg-brand-900/40 text-brand-300 border border-brand-500/30'
                      : 'bg-red-900/40 text-red-400 border border-red-500/30'
                  }`}>
                    {!estActif ? 'Annulé' : enEssai ? 'Essai' : 'Actif'}
                  </span>
                  <Link href={`/${slug}/mon-abonnement`} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                    Gérer →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <p className="text-gray-500 text-sm">Aucun abonnement actif.</p>
                <Link href={`/${slug}/abonnement`} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                  S&apos;abonner →
                </Link>
              </div>
            )}
          </section>
        )}

        {/* Favoris */}
        {clientId && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Mes favoris ({totalFavoris})
              </h2>
              <Link href={`/${slug}/mon-compte/favoris`} className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
                Voir tout →
              </Link>
            </div>
            {favoris.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-gray-500 text-sm">Aucun beat liké sur cette boutique.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {favoris.map(fav => {
                  const beat = fav.beats
                  return (
                    <Link
                      key={fav.beat_id}
                      href={`/${slug}/${fav.beat_id}`}
                      className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3 hover:border-gray-700 transition-colors"
                    >
                      {beat?.image_url ? (
                        <img src={beat.image_url} alt={beat.titre ?? ''} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center text-gray-600 text-xs font-bold">
                          {beat?.titre?.slice(0, 2).toUpperCase() ?? '??'}
                        </div>
                      )}
                      <p className="text-white text-sm font-medium truncate">{beat?.titre ?? 'Beat'}</p>
                      <span className="ml-auto text-red-400 text-base flex-shrink-0">♥</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* Achats */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Mes achats ({totalCommandes})
            </h2>
            <Link href={`/${slug}/mon-compte/achats`} className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
              Voir tout →
            </Link>
          </div>
          {commandes.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <p className="text-gray-500 text-sm">Aucun achat sur cette boutique.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {commandes.map(cmd => {
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

        {/* Préférences newsletter */}
        {clientId && (
          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Préférences</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">Emails marketing</p>
                  <p className="text-gray-500 text-xs mt-0.5">Nouvelles sorties, offres et actualités des beatmakers</p>
                </div>
                <form action={toggleNewsletter}>
                  <input type="hidden" name="newsletter_consent" value={newsletterConsent ? 'false' : 'true'} />
                  <button
                    type="submit"
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      newsletterConsent ? 'bg-brand-600' : 'bg-gray-700'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      newsletterConsent ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </form>
              </div>
            </div>
          </section>
        )}

        {/* Lien compte global */}
        {clientId && (
          <div className="pt-4 border-t border-gray-800">
            <Link href="/mon-compte" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              Accéder à mon compte My Producer →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
