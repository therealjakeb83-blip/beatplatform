'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function InscriptionPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nomArtiste, setNomArtiste] = useState('')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')
    setChargement(true)

    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nom_artiste: nomArtiste },
      },
    })

    if (error) {
      setErreur(error.message)
      setChargement(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Créer ton compte My Producer</h1>
        <p className="text-gray-400 mb-8">Lance ta boutique de beats en quelques minutes.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Nom d'artiste</label>
            <input
              type="text"
              value={nomArtiste}
              onChange={e => setNomArtiste(e.target.value)}
              required
              placeholder="ex: Jake B"
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
          </div>

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

          <div>
            <label className="block text-sm text-gray-300 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="8 caractères minimum"
              minLength={8}
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {erreur && (
            <p className="text-red-400 text-sm">{erreur}</p>
          )}

          <button
            type="submit"
            disabled={chargement}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {chargement ? 'Création du compte...' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-gray-500 text-sm mt-6 text-center">
          Déjà un compte ?{' '}
          <Link href="/connexion" className="text-indigo-400 hover:text-indigo-300">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  )
}
