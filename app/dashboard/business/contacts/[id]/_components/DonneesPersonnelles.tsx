'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// RGPD (9d lot 4) : la boutique répond elle-même aux demandes de son client
// (Sonoo fournit les outils, n'agit jamais à sa place).
export default function DonneesPersonnelles({ clientId, abonnementActif }: { clientId: string; abonnementActif: boolean }) {
  const router = useRouter()
  const [ouvert, setOuvert] = useState<null | 'exporter' | 'effacer'>(null)
  const [saisie, setSaisie] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function effacer() {
    setEnCours(true)
    setErreur(null)
    try {
      const res = await fetch(`/api/business/contacts/${clientId}/effacer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: saisie.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErreur(json.error ?? "L'effacement a échoué. Réessaie.")
        setEnCours(false)
        return
      }
      router.refresh()
    } catch {
      setErreur("L'effacement a échoué (connexion). Réessaie.")
      setEnCours(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Données personnelles</h2>
        <p className="text-xs text-gray-500 mt-1">
          Si ce client te demande ses données ou leur effacement, c&apos;est à toi d&apos;y répondre (ta boutique est responsable de ses clients).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setOuvert(ouvert === 'exporter' ? null : 'exporter'); setErreur(null) }}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium"
        >
          Exporter
        </button>
        <button
          type="button"
          onClick={() => { setOuvert(ouvert === 'effacer' ? null : 'effacer'); setSaisie(''); setErreur(null) }}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/50 text-red-400 font-medium"
        >
          Effacer ce contact
        </button>
      </div>

      {ouvert === 'exporter' && (
        <div className="border border-gray-800 rounded-xl p-4 space-y-3 text-xs text-gray-300">
          <p>
            Un fichier CSV avec tout ce que ta boutique détient sur ce contact : fiche, commandes, abonnements, free downloads,
            ventes importées, emails envoyés, listes, favoris.
          </p>
          <p className="text-orange-300">
            ⚠️ Le fichier contient aussi tes <strong>notes et tags internes</strong>. Relis-le avant de l&apos;envoyer au client.
          </p>
          <a
            href={`/api/business/contacts/${clientId}/export`}
            className="inline-block px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
          >
            Télécharger le fichier
          </a>
        </div>
      )}

      {ouvert === 'effacer' && (
        <div className="border border-red-900/60 rounded-xl p-4 space-y-3 text-xs text-gray-300">
          {abonnementActif ? (
            <p className="text-orange-300">
              Ce contact a un abonnement actif : annule d&apos;abord son abonnement (page Abonnements), puis tu pourras l&apos;effacer.
            </p>
          ) : (
            <>
              <p>Effacer ce contact <strong>dans ta boutique seulement</strong> :</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-400">
                <li>sa fiche est vidée (emails, téléphones, adresses, noms, notes, tags, réseaux…) ;</li>
                <li>il disparaît de Contacts, segments, listes, doublons, campagnes et automatisations ;</li>
                <li>sur ses commandes, on garde seulement ce qui figure sur la facture (nom, adresse, raison sociale, TVA) ; son email et son téléphone sont effacés pour de bon ;</li>
                <li>tes commandes, factures et Analytics ne bougent pas ; il garde ses achats dans son compte.</li>
              </ul>
              <p className="text-red-400">C&apos;est définitif. Pense à exporter d&apos;abord si le client t&apos;a aussi demandé ses données.</p>
              <label className="block">
                <span className="text-gray-400">Tape <strong className="text-white">EFFACER</strong> pour confirmer</span>
                <input
                  value={saisie}
                  onChange={e => setSaisie(e.target.value)}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 focus:border-red-500 rounded-lg px-3 py-1.5 text-white outline-none"
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                disabled={saisie.trim() !== 'EFFACER' || enCours}
                onClick={effacer}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold disabled:opacity-40"
              >
                {enCours && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {enCours ? 'Effacement en cours…' : 'Effacer définitivement'}
              </button>
            </>
          )}
          {erreur && <p className="text-red-400">{erreur}</p>}
        </div>
      )}
    </div>
  )
}
