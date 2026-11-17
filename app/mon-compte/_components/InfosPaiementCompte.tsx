'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type InfosAffichees = {
  lignes: { libelle: string; valeur: string }[]
  majLe: string
}

// Mon compte (chantier préremplissage, décision 7 de Jake) : tout ce que
// Sonoo garde est affiché en clair, avec la case pour tout retirer.
export default function InfosPaiementCompte({ nomPlateforme, infos }: { nomPlateforme: string; infos: InfosAffichees | null }) {
  const router = useRouter()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function decocher() {
    setEnCours(true)
    setErreur(null)
    try {
      const res = await fetch('/api/artiste/oublier-infos-paiement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setErreur(data.error ?? 'L’effacement a échoué, réessaie.')
        return
      }
      router.refresh()
    } catch {
      setErreur('L’effacement a échoué, réessaie.')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={infos !== null}
          disabled={infos === null || enCours}
          onChange={e => { if (!e.target.checked) void decocher() }}
          className="mt-1"
        />
        <span className="text-sm text-gray-300">
          Se souvenir de mes infos pour mes achats dans les autres boutiques {nomPlateforme}
          <span className="block text-xs text-gray-500 mt-1">
            {infos
              ? 'Décoche pour effacer tout de suite ces infos de ton compte.'
              : 'Rien n’est gardé. Pour l’activer, coche cette case au moment de payer : ce sont les infos de ce paiement qui seront gardées.'}
          </span>
        </span>
      </label>
      {infos && (
        <div className="text-sm">
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
            {infos.lignes.map(l => (
              <div key={l.libelle} className="contents">
                <dt className="text-gray-500">{l.libelle}</dt>
                <dd className="text-gray-200 break-words">{l.valeur}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-gray-500 mt-3">Mises à jour le {infos.majLe}, avec ton dernier paiement.</p>
        </div>
      )}
      {erreur && <p className="text-sm text-red-400">{erreur}</p>}
    </div>
  )
}
