'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function NouveauMotDePasseArtisteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/mon-compte'
  const bienvenue = searchParams.get('bienvenue') === '1'

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)
  const [sessionPrete, setSessionPrete] = useState(false)

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type')

    if (!tokenHash || type !== 'recovery') {
      setErreur('Lien invalide ou expiré.')
      return
    }

    const supabase = createClient()
    supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }).then(({ error }) => {
      if (error) {
        setErreur('Lien invalide ou expiré. Recommence depuis "Mot de passe oublié".')
      } else {
        setSessionPrete(true)
      }
    })
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')

    if (password !== confirmation) {
      setErreur('Les deux mots de passe ne correspondent pas.')
      return
    }

    setChargement(true)
    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setErreur(error.message)
      setChargement(false)
      return
    }

    router.push(redirect)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm mb-4">MP</div>
          <h1 className="text-2xl font-bold text-white mb-1">
            {bienvenue ? 'Bienvenue !' : 'Nouveau mot de passe'}
          </h1>
          <p className="text-gray-400 text-sm">
            {bienvenue
              ? 'Ton compte est prêt — choisis un mot de passe pour pouvoir te reconnecter depuis n\'importe quel appareil.'
              : 'Choisis un nouveau mot de passe pour ton compte.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={!sessionPrete}
              placeholder="8 caractères minimum"
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              required
              minLength={8}
              disabled={!sessionPrete}
              placeholder="8 caractères minimum"
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
          </div>

          {erreur && <p className="text-red-400 text-sm">{erreur}</p>}

          <button
            type="submit"
            disabled={chargement || !sessionPrete}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {chargement ? 'Enregistrement...' : bienvenue ? 'Valider et continuer' : 'Enregistrer le mot de passe'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function NouveauMotDePasseArtistePage() {
  return (
    <Suspense>
      <NouveauMotDePasseArtisteForm />
    </Suspense>
  )
}
