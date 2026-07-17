'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'

export default function MotDePasseOublieArtistePage() {
  const [email, setEmail] = useState('')
  const [envoye, setEnvoye] = useState(false)
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')
    setChargement(true)

    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/artiste/nouveau-mot-de-passe`,
    })

    if (error) {
      setErreur(error.message)
      setChargement(false)
      return
    }

    setEnvoye(true)
  }

  if (envoye) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Email envoyé</h1>
          <p className="text-gray-400 mb-6">
            Vérifie ta boîte mail — tu as reçu un lien pour réinitialiser ton mot de passe.
          </p>
          <Link href="/artiste/connexion" className="text-indigo-400 hover:text-indigo-300 text-sm">
            Retour à la connexion
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Mot de passe oublié</h1>
        <p className="text-gray-400 mb-8">
          Saisis ton email — on t'envoie un lien pour créer un nouveau mot de passe.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="ton@email.com"
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {erreur && <p className="text-red-400 text-sm">{erreur}</p>}

          <button
            type="submit"
            disabled={chargement}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {chargement ? 'Envoi...' : 'Envoyer le lien'}
          </button>
        </form>

        <p className="text-gray-500 text-sm mt-6 text-center">
          <Link href="/artiste/connexion" className="text-indigo-400 hover:text-indigo-300">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </main>
  )
}
