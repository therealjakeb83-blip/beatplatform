'use client'

import { useState } from 'react'

export default function ReglagesGlobaux({
  signatureActuelle,
  nomArtiste,
  activerToutesLesAutomatisations,
  sauvegarderSignature,
}: {
  signatureActuelle: string | null
  nomArtiste: string
  activerToutesLesAutomatisations: () => Promise<{ erreur?: string }>
  sauvegarderSignature: (signature: string) => Promise<{ erreur?: string }>
}) {
  const [signature, setSignature] = useState(signatureActuelle ?? '')
  const [enregistrementSignature, setEnregistrementSignature] = useState(false)
  const [signatureEnregistree, setSignatureEnregistree] = useState(false)
  const [erreurSignature, setErreurSignature] = useState('')

  const [activationEnCours, setActivationEnCours] = useState(false)
  const [activationFaite, setActivationFaite] = useState(false)
  const [erreurActivation, setErreurActivation] = useState('')

  async function handleSauvegarderSignature() {
    setEnregistrementSignature(true)
    setErreurSignature('')
    setSignatureEnregistree(false)
    const { erreur } = await sauvegarderSignature(signature)
    setEnregistrementSignature(false)
    if (erreur) setErreurSignature(erreur)
    else {
      setSignatureEnregistree(true)
      setTimeout(() => setSignatureEnregistree(false), 2000)
    }
  }

  async function handleToutActiver() {
    if (!confirm("Activer toutes les recettes d'Automatisations avec les textes par défaut (ceux déjà configurés ne seront pas modifiés) ?")) return
    setActivationEnCours(true)
    setErreurActivation('')
    setActivationFaite(false)
    const { erreur } = await activerToutesLesAutomatisations()
    setActivationEnCours(false)
    if (erreur) setErreurActivation(erreur)
    else setActivationFaite(true)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Ta signature dans les mails
          </label>
          <input
            type="text"
            value={signature}
            onChange={e => setSignature(e.target.value)}
            placeholder={nomArtiste}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">
            Utilisée par le token {'{{signature}}'} à la fin des recettes — vide = ton nom d&apos;artiste ({nomArtiste}).
          </p>
        </div>
        <button
          onClick={handleSauvegarderSignature}
          disabled={enregistrementSignature}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {enregistrementSignature ? 'Enregistrement…' : signatureEnregistree ? 'Enregistré ✓' : 'Enregistrer'}
        </button>
      </div>
      {erreurSignature && <p className="text-xs text-red-400">{erreurSignature}</p>}

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-800">
        <p className="text-xs text-gray-500">
          Envie de faire confiance aux réglages par défaut plutôt que d&apos;activer chaque recette une par une ?
        </p>
        <button
          onClick={handleToutActiver}
          disabled={activationEnCours}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-white text-gray-950 hover:bg-gray-200 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {activationEnCours ? 'Activation…' : activationFaite ? 'Tout est activé ✓' : 'Tout activer'}
        </button>
      </div>
      {erreurActivation && <p className="text-xs text-red-400">{erreurActivation}</p>}
    </div>
  )
}
