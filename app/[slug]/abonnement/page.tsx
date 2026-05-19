import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import SAbonnerButton from './SAbonnerButton'

export default async function AbonnementPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, nom_artiste, abo_actif, abo_nom, abo_description, abo_prix, abo_remise_pct, abo_essai_jours, stripe_price_id')
    .eq('slug', slug)
    .single()

  if (!beatmaker || !beatmaker.abo_actif) notFound()

  // Vérifier si déjà abonné — session en priorité, cookie en fallback
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let estAbonne = false

  if (user) {
    const { data: abo } = await admin
      .from('abonnements_boutique')
      .select('id')
      .eq('beatmaker_id', beatmaker.id)
      .or(`client_id.eq.${user.id},acheteur_email.eq.${user.email}`)
      .eq('statut', 'actif')
      .maybeSingle()
    estAbonne = !!abo
  }

  if (!estAbonne) {
    const cookieStore = await cookies()
    const emailCookie = cookieStore.get(`abo_${slug}`)?.value
    if (emailCookie) {
      const { data: abo } = await admin
        .from('abonnements_boutique')
        .select('id')
        .eq('beatmaker_id', beatmaker.id)
        .eq('acheteur_email', emailCookie)
        .eq('statut', 'actif')
        .maybeSingle()
      estAbonne = !!abo
    }
  }

  const prixAffiche = beatmaker.abo_prix ? (beatmaker.abo_prix / 100).toFixed(2).replace('.', ',') : null

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full">
        <Link href={`/${slug}`} className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8">
          ← Boutique de {beatmaker.nom_artiste}
        </Link>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          {estAbonne ? (
            <div className="text-center">
              <div className="text-4xl mb-4">✅</div>
              <h1 className="text-2xl font-black text-white mb-2">Tu es déjà membre !</h1>
              <p className="text-gray-400 text-sm mb-6">Tu as accès à tous les beats réservés aux membres.</p>
              <div className="flex flex-col gap-3">
                <Link
                  href={`/${slug}/membres`}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors text-center"
                >
                  Accéder aux beats membres
                </Link>
                <Link
                  href={`/${slug}/mon-abonnement`}
                  className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors text-center"
                >
                  Gérer mon abonnement
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="text-4xl mb-3">🎵</div>
                <h1 className="text-2xl font-black text-white mb-2">
                  {beatmaker.abo_nom ?? `Abonnement ${beatmaker.nom_artiste}`}
                </h1>
                {beatmaker.abo_description && (
                  <p className="text-gray-400 text-sm">{beatmaker.abo_description}</p>
                )}
              </div>

              {/* Prix */}
              <div className="bg-gray-800 rounded-xl p-6 mb-6 text-center">
                {prixAffiche && (
                  <p className="text-4xl font-black text-white mb-1">
                    {prixAffiche}€<span className="text-gray-400 text-lg font-normal">/mois</span>
                  </p>
                )}
                {beatmaker.abo_essai_jours > 0 && (
                  <p className="text-green-400 text-sm mt-1">
                    {beatmaker.abo_essai_jours} jours d&apos;essai gratuit, sans engagement
                  </p>
                )}
              </div>

              {/* Avantages */}
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="text-green-400 mt-0.5">✓</span>
                  Accès illimité à tous les beats réservés aux membres
                </li>
                {beatmaker.abo_remise_pct > 0 && (
                  <li className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="text-green-400 mt-0.5">✓</span>
                    {beatmaker.abo_remise_pct}% de réduction sur toutes les licences (hors Illimité)
                  </li>
                )}
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="text-green-400 mt-0.5">✓</span>
                  1 beat gratuit tous les 4 mois
                </li>
              </ul>

              <SAbonnerButton slug={slug} essaiJours={beatmaker.abo_essai_jours} prixAffiche={prixAffiche} />

              <p className="text-xs text-gray-600 text-center mt-4">
                Annulable à tout moment. Paiement sécurisé par Stripe.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
