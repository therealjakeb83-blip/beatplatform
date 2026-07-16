import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import GererAbonnementButton from './GererAbonnementButton'

export default async function MonAbonnementPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, nom_artiste, abo_nom, abo_prix')
    .eq('slug', slug)
    .single()

  if (!beatmaker) notFound()

  // Vérifier l'abonnement — session Supabase en priorité, cookie en fallback
  const { data: { user } } = await supabase.auth.getUser()
  let emailAbonne: string | null = null
  let aboQuery = null

  if (user) {
    emailAbonne = user.email ?? null
    const { data } = await admin
      .from('abonnements_boutique')
      .select('id, statut, en_essai, essai_fin_le, date_debut, stripe_subscription_id')
      .eq('beatmaker_id', beatmaker.id)
      .or(`client_id.eq.${user.id},acheteur_email.eq.${user.email}`)
      .order('date_debut', { ascending: false })
      .limit(1)
      .maybeSingle()
    aboQuery = data
  }

  // Fallback cookie
  if (!aboQuery) {
    const cookieStore = await cookies()
    const emailCookie = cookieStore.get(`abo_${slug}`)?.value
    if (emailCookie) {
      emailAbonne = emailCookie
      const { data } = await admin
        .from('abonnements_boutique')
        .select('id, statut, en_essai, essai_fin_le, date_debut, stripe_subscription_id')
        .eq('beatmaker_id', beatmaker.id)
        .eq('acheteur_email', emailCookie)
        .order('date_debut', { ascending: false })
        .limit(1)
        .maybeSingle()
      aboQuery = data
    }
  }

  if (!emailAbonne) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-black text-white mb-3">Non connecté</h1>
          <p className="text-gray-400 text-sm mb-6">Tu n&apos;as pas de session membre active.</p>
          <Link href={`/${slug}/abonnement`} className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors shadow-[0_6px_20px_-4px_rgba(0,41,255,0.5)]">
            S&apos;abonner
          </Link>
        </div>
      </div>
    )
  }

  const abo = aboQuery

  const prixAffiche = beatmaker.abo_prix ? (beatmaker.abo_prix / 100).toFixed(2).replace('.', ',') : null

  const estActif = abo?.statut === 'actif'
  const estImpaye = abo?.statut === 'impaye'
  const enEssai = abo?.en_essai ?? false
  const dateDebut = abo?.date_debut ? new Date(abo.date_debut).toLocaleDateString('fr-FR') : null
  const essaiFin = abo?.essai_fin_le ? new Date(abo.essai_fin_le).toLocaleDateString('fr-FR') : null

  return (
    <div className="min-h-screen bg-black px-6 py-16">
      <div className="max-w-lg mx-auto">
        <Link href={`/${slug}`} className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8">
          ← Boutique de {beatmaker.nom_artiste}
        </Link>

        <h1 className="text-2xl font-black text-white mb-6">Mon abonnement</h1>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white font-semibold">{beatmaker.abo_nom ?? `Abonnement ${beatmaker.nom_artiste}`}</p>
              {prixAffiche && <p className="text-gray-400 text-sm">{prixAffiche}€/mois</p>}
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              estActif
                ? enEssai
                  ? 'bg-green-900/40 text-green-400 border border-green-500/30'
                  : 'bg-brand-900/40 text-brand-300 border border-brand-500/30'
                : estImpaye
                ? 'bg-orange-900/40 text-orange-400 border border-orange-500/30'
                : 'bg-red-900/40 text-red-400 border border-red-500/30'
            }`}>
              {estActif ? (enEssai ? 'Essai gratuit' : 'Actif') : estImpaye ? 'Paiement en attente' : 'Annulé'}
            </span>
          </div>

          <div className="space-y-2 text-sm text-gray-400 border-t border-gray-800 pt-4">
            <p>Email : <span className="text-gray-200">{emailAbonne}</span></p>
            {dateDebut && <p>Membre depuis le : <span className="text-gray-200">{dateDebut}</span></p>}
            {enEssai && essaiFin && (
              <p>Essai gratuit jusqu&apos;au : <span className="text-green-400">{essaiFin}</span></p>
            )}
          </div>
        </div>

        {estImpaye && (
          <div className="bg-orange-950/30 border border-orange-500/30 rounded-2xl p-4 mb-4">
            <p className="text-orange-400 text-sm font-semibold mb-1">Ton dernier paiement a échoué</p>
            <p className="text-gray-400 text-xs">
              Mets à jour ton moyen de paiement pour rester abonné — sinon ton abonnement sera annulé automatiquement.
            </p>
          </div>
        )}

        {estActif && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4">
            <h2 className="text-white font-semibold mb-3">Avantages inclus</h2>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Accès aux beats réservés aux membres</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Réduction sur les licences</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 1 beat gratuit tous les 4 mois</li>
            </ul>
          </div>
        )}

        {(estActif || estImpaye) && (
          <div className="flex flex-col gap-3">
            {estActif && (
              <Link
                href={`/${slug}/membres`}
                className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors text-center shadow-[0_6px_20px_-4px_rgba(0,41,255,0.5)]"
              >
                Accéder aux beats membres
              </Link>
            )}
            {abo?.stripe_subscription_id && (
              <GererAbonnementButton subscriptionId={abo.stripe_subscription_id} slug={slug} impaye={estImpaye} />
            )}
          </div>
        )}

        {!estActif && !estImpaye && (
          <Link
            href={`/${slug}/abonnement`}
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors text-center block shadow-[0_6px_20px_-4px_rgba(0,41,255,0.5)]"
          >
            Se réabonner
          </Link>
        )}
      </div>
    </div>
  )
}
