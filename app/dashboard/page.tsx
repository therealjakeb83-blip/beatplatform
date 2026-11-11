import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DeconnexionButton from './DeconnexionButton'
import { estAdmin } from '@/lib/admin'
import { NOM_PLATEFORME } from '@/lib/constantes'
import { aAccesPlanPayant } from '@/lib/acces-plan'
import { createAdminClient } from '@/utils/supabase/admin'
import { avertissementDomaineIndisponible, chargerEtatBoutique } from '@/lib/boutique-visible'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const [{ data: beatmaker }, admin, { data: domaine }, planPayant, etat] = await Promise.all([
    supabase.from('beatmakers').select('slug').eq('id', user.id).single(),
    estAdmin(),
    supabase.from('domaines_boutique').select('domaine, statut').eq('beatmaker_id', user.id).maybeSingle(),
    aAccesPlanPayant(supabase, user.id),
    chargerEtatBoutique(createAdminClient(), user.id),
  ])
  const avertissementDomaine = domaine ? avertissementDomaineIndisponible(etat, domaine.domaine as string) : null

return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Bienvenue sur {NOM_PLATEFORME}</h1>
        <p className="text-gray-400 mb-8">Connecté en tant que {user.email}</p>
        {avertissementDomaine && (
          <Link
            href="/dashboard/abonnement"
            className="block max-w-md mx-auto mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          >
            {avertissementDomaine} Me réabonner →
          </Link>
        )}
        {domaine?.statut === 'probleme' && (
          <Link
            href="/dashboard/domaine"
            className="block max-w-md mx-auto mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            Ton domaine {domaine.domaine} ne fonctionne plus. Ta boutique reste sur son adresse {NOM_PLATEFORME}. Voir ce qu&apos;il faut corriger →
          </Link>
        )}
        <div className="flex flex-wrap gap-3 justify-center mb-4">
          <Link
            href="/dashboard/business"
            className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
          >
            Business {'↗︎'}
          </Link>
          <Link
            href="/dashboard/profil"
            className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors"
          >
            Mon profil
          </Link>
          <Link
            href="/dashboard/paiements"
            className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors"
          >
            Paiements
          </Link>
          <Link
            href="/dashboard/legal"
            className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors"
          >
            Pages légales
          </Link>
          <Link
            href="/dashboard/domaine"
            className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors"
          >
            Domaine{!planPayant && ' 🔒'}
          </Link>
          <Link
            href="/dashboard/abonnement"
            className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors"
          >
            Mon abonnement
          </Link>
          {beatmaker?.slug && (
            <Link
              href={`/${beatmaker.slug}`}
              target="_blank"
              className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors flex items-center gap-2"
            >
              Ma boutique {'↗︎'}
            </Link>
          )}
          {admin && (
            <Link
              href="/dashboard/admin"
              className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors"
            >
              Admin
            </Link>
          )}
        </div>
        <div>
          <DeconnexionButton />
        </div>
      </div>
    </main>
  )
}
