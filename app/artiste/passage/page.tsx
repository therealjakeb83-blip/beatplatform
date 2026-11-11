'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { cheminInterne } from '@/lib/redirection'

// Arrivée du laissez-passer : sur sonoo.app depuis le domaine d'une boutique
// (lot 3, vers /mon-compte), ou sur le domaine depuis sonoo.app (lot 4, vers
// la page demandée). On ouvre la session ici puis on va à la page.
function PassageCompte() {
  const searchParams = useSearchParams()
  const tokenHash = searchParams.get('token_hash')
  const destination = cheminInterne(searchParams.get('redirect'), '/mon-compte')
  const [echec, setErreur] = useState(false)
  const erreur = !tokenHash || echec

  useEffect(() => {
    if (!tokenHash) return
    createClient().auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' }).then(({ error }) => {
      if (error) setErreur(true)
      else window.location.replace(destination)
    })
  }, [tokenHash, destination])

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md text-center">
        {erreur ? (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">Ce lien a déjà servi ou a expiré</h1>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Pour ta sécurité, il ne fonctionne qu&apos;une fois. Connecte-toi pour accéder à ton compte.
            </p>
            <Link href="/artiste/connexion?redirect=/mon-compte" className="text-indigo-400 hover:text-indigo-300 text-sm">
              Se connecter
            </Link>
          </>
        ) : (
          <>
            <div className="w-8 h-8 mx-auto mb-4 rounded-full border-2 border-gray-700 border-t-indigo-500 animate-spin" />
            <h1 className="text-2xl font-bold text-white mb-2">Ouverture de ton compte…</h1>
          </>
        )}
      </div>
    </main>
  )
}

export default function PassageComptePage() {
  return (
    <Suspense>
      <PassageCompte />
    </Suspense>
  )
}
