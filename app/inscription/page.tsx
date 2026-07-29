'use client'

import { useState } from 'react'
import Link from 'next/link'
import { NOM_PLATEFORME } from '@/lib/constantes'

export default function InscriptionPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nomArtiste, setNomArtiste] = useState('')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)
  const [succes, setSucces] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')
    setChargement(true)

    const res = await fetch('/api/inscription/beatmaker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nomArtiste }),
    })
    const data = await res.json()

    if (!res.ok) {
      setErreur(data.erreur ?? 'Erreur lors de la création du compte.')
      setChargement(false)
      return
    }

    setSucces(true)
    setChargement(false)
  }

  if (succes) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-md text-center">
          <div className="text-5xl mb-4">📩</div>
          <h1 className="text-2xl font-bold text-white mb-2">Vérifie ta boîte mail</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Un lien de confirmation t&apos;a été envoyé à <strong className="text-white">{email}</strong>.
            <br />Clique dessus pour activer ton compte {NOM_PLATEFORME}.
          </p>
          <p className="text-gray-600 text-xs mt-4">
            Tu peux fermer cette page.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Créer ton compte {NOM_PLATEFORME}</h1>
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
