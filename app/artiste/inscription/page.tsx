'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function InscriptionArtisteForm() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/mon-compte'

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erreur, setErreur] = useState('')
  const [newsletter, setNewsletter] = useState(false)
  const [chargement, setChargement] = useState(false)
  const [succes, setSucces] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')
    setChargement(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { prenom, nom } },
    })

    if (error || !data.user) {
      setErreur(error?.message ?? 'Erreur lors de la création du compte.')
      setChargement(false)
      return
    }

    const slug = redirect.split('/').filter(Boolean)[0] ?? null
    await fetch('/api/artiste/lier-compte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom, prenom, newsletter_consent: newsletter, slug,
        // Pas de session si email non confirmé — on passe userId+email pour que le serveur vérifie
        ...(!data.session ? { userId: data.user.id, userEmail: data.user.email } : {}),
      }),
    })

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
            <br />Clique dessus pour activer ton compte My Producer.
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
        <div className="mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm mb-4">MP</div>
          <h1 className="text-2xl font-bold text-white mb-1">Créer mon compte artiste</h1>
          <p className="text-gray-400 text-sm">Retrouve tous tes achats, abonnements et favoris en un seul endroit.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm text-gray-300 mb-1">Prénom</label>
              <input
                type="text"
                value={prenom}
                onChange={e => setPrenom(e.target.value)}
                required
                placeholder="Ton prénom"
                className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-300 mb-1">Nom</label>
              <input
                type="text"
                value={nom}
                onChange={e => setNom(e.target.value)}
                required
                placeholder="Ton nom"
                className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
              />
            </div>
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
              minLength={8}
              placeholder="8 caractères minimum"
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={newsletter}
              onChange={e => setNewsletter(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500 flex-shrink-0"
            />
            <span className="text-sm text-gray-400 leading-snug">
              Je souhaite recevoir les nouvelles sorties et offres des beatmakers que je suis
            </span>
          </label>

          {erreur && <p className="text-red-400 text-sm">{erreur}</p>}

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
          <Link href={`/artiste/connexion?redirect=${encodeURIComponent(redirect)}`} className="text-indigo-400 hover:text-indigo-300">
            Se connecter
          </Link>
        </p>

        <p className="text-gray-700 text-xs mt-4 text-center">
          Tu es beatmaker ?{' '}
          <Link href="/connexion" className="text-gray-600 hover:text-gray-400 transition-colors">
            Connexion producteur →
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function InscriptionArtistePage() {
  return (
    <Suspense>
      <InscriptionArtisteForm />
    </Suspense>
  )
}
