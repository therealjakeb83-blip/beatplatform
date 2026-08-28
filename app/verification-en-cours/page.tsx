import { NOM_PLATEFORME } from '@/lib/constantes'

// Affichée par proxy.ts quand la vérification de connexion auprès de Supabase
// n'a pas répondu à temps (ex. incident Supabase, panne réseau ponctuelle) —
// jamais un vrai formulaire de connexion, pour ne pas laisser penser à
// l'utilisateur qu'il a été déconnecté ou que son mot de passe est faux.
// Volontairement statique : aucun appel à Supabase ici, pour rester
// affichable même si Supabase reste indisponible un moment.
export default async function VerificationEnCoursPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const retourUrl = next && next.startsWith('/') ? next : '/dashboard'

  return (
    <>
      {/* Réessaie automatiquement au bout de quelques secondes, sans action requise */}
      <meta httpEquiv="refresh" content={`6;url=${retourUrl}`} />
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">Petit souci technique</h1>
          <p className="text-gray-400 mb-1">
            On n&apos;arrive pas à vérifier ta connexion à {NOM_PLATEFORME} pour le moment.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Ce n&apos;est pas lié à ton compte ni à ton mot de passe — un souci technique
            passager. Ça se résout généralement en quelques secondes.
          </p>
          <a
            href={retourUrl}
            className="inline-block px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
          >
            Réessayer
          </a>
        </div>
      </main>
    </>
  )
}
