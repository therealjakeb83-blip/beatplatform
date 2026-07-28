'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function ConfirmationCompteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [erreur, setErreur] = useState('')
  const [confirme, setConfirme] = useState(false)

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash')
    if (!tokenHash) {
      setErreur('Lien invalide ou expiré.')
      return
    }

    const supabase = createClient()
    supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'signup' }).then(async ({ error }) => {
      if (error) {
        setErreur('Lien invalide ou expiré.')
        return
      }
      setConfirme(true)
      // Déclenché seulement maintenant que la confirmation est réelle (pas à
      // la soumission du formulaire) — voir /api/plateforme/bienvenue et
      // ROADMAP.md (2026-07-28).
      await fetch('/api/plateforme/bienvenue', { method: 'POST' }).catch(() => {})
      router.push('/dashboard')
    })
  }, [searchParams, router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md text-center">
        {erreur ? (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-2">Lien invalide</h1>
            <p className="text-gray-400 text-sm leading-relaxed">{erreur}</p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">{confirme ? '✅' : '⏳'}</div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {confirme ? 'Compte confirmé !' : 'Confirmation en cours...'}
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed">Redirection vers ton dashboard.</p>
          </>
        )}
      </div>
    </main>
  )
}

export default function ConfirmationComptePage() {
  return (
    <Suspense>
      <ConfirmationCompteContent />
    </Suspense>
  )
}
