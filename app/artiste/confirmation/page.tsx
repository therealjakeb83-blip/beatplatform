'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { cheminInterne } from '@/lib/redirection'

// Lien de l'email « Confirme ton compte » (rang 9c, lot 3) : ouvert sur le
// site où le client s'est inscrit, il active le compte et l'y connecte.
function ConfirmationArtiste() {
  const searchParams = useSearchParams()
  const redirect = cheminInterne(searchParams.get('redirect'), '/mon-compte')
  const tokenHash = searchParams.get('token_hash')
  const [echec, setErreur] = useState(false)
  const erreur = !tokenHash || echec

  useEffect(() => {
    if (!tokenHash) return
    createClient().auth.verifyOtp({ token_hash: tokenHash, type: 'signup' }).then(async ({ error }) => {
      if (error) {
        setErreur(true)
        return
      }
      await fetch('/api/artiste/compte-confirme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect }),
      }).catch(() => {})
      window.location.replace(redirect)
    })
  }, [tokenHash, redirect])

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md text-center">
        {erreur ? (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">Lien expiré ou déjà utilisé</h1>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Si tu as déjà cliqué dessus, ton compte est sans doute activé : connecte-toi avec le mot de passe choisi à l&apos;inscription.
            </p>
            <Link href={`/artiste/connexion?redirect=${encodeURIComponent(redirect)}`} className="text-indigo-400 hover:text-indigo-300 text-sm">
              Se connecter
            </Link>
          </>
        ) : (
          <>
            <div className="w-8 h-8 mx-auto mb-4 rounded-full border-2 border-gray-700 border-t-indigo-500 animate-spin" />
            <h1 className="text-2xl font-bold text-white mb-2">Activation de ton compte…</h1>
            <p className="text-gray-400 text-sm">Tu vas être redirigé dans un instant.</p>
          </>
        )}
      </div>
    </main>
  )
}

export default function ConfirmationArtistePage() {
  return (
    <Suspense>
      <ConfirmationArtiste />
    </Suspense>
  )
}
