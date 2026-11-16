'use client'

import { useState } from 'react'
import Link from 'next/link'

type Boutique = { id: string; nom: string }

// « Supprimer mon compte » (9d lot 4). Cases newsletter cochées par défaut
// (le plus protecteur) : cochée = désinscrit de cette boutique.
export default function SupprimerCompte({
  nomPlateforme, newsletters, abonnementsEnCours, estBoutique,
}: {
  nomPlateforme: string
  newsletters: Boutique[]
  abonnementsEnCours: string[]
  estBoutique: boolean
}) {
  const [ouvert, setOuvert] = useState(false)
  const [coches, setCoches] = useState<Set<string>>(() => new Set(newsletters.map(b => b.id)))
  const [saisie, setSaisie] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [fini, setFini] = useState(false)

  const bloque = estBoutique || abonnementsEnCours.length > 0
  const tout = newsletters.length > 0 && coches.size === newsletters.length

  function basculer(id: string) {
    setCoches(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function supprimer() {
    setEnCours(true)
    setErreur(null)
    try {
      const res = await fetch('/api/artiste/supprimer-compte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: saisie.trim(), desinscrire: [...coches] }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErreur(json.error ?? 'La suppression a échoué. Réessaie.')
        setEnCours(false)
        return
      }
      setFini(true)
    } catch {
      setErreur('La suppression a échoué (connexion). Réessaie.')
      setEnCours(false)
    }
  }

  if (fini) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
        <p className="text-white font-semibold">Ton compte {nomPlateforme} a été supprimé.</p>
        <p className="text-gray-400 text-sm">Un email de confirmation vient de t&apos;être envoyé.</p>
        <Link href="/" className="inline-block text-sm text-gray-400 hover:text-white">Quitter →</Link>
      </div>
    )
  }

  return (
    <div className="pt-6 border-t border-gray-800">
      {!ouvert ? (
        <button type="button" onClick={() => setOuvert(true)} className="text-sm text-red-400/80 hover:text-red-400">
          Supprimer mon compte {nomPlateforme}
        </button>
      ) : (
        <div className="bg-gray-900 border border-red-900/60 rounded-xl p-5 space-y-4 text-sm text-gray-300">
          <h2 className="text-white font-semibold">Supprimer mon compte {nomPlateforme}</h2>

          {estBoutique ? (
            <p className="text-orange-300">Cette connexion est aussi celle d&apos;une boutique : elle ne peut pas être supprimée ici.</p>
          ) : abonnementsEnCours.length > 0 ? (
            <p className="text-orange-300">
              Tu as encore un abonnement en cours chez {abonnementsEnCours.join(', ')}. Annule-le d&apos;abord
              (« Mon compte » de la boutique), puis reviens ici.
            </p>
          ) : (
            <>
              <ul className="list-disc pl-5 space-y-1 text-gray-400">
                <li>tu ne pourras plus te connecter avec cette adresse, et tes favoris seront effacés ;</li>
                <li>
                  les boutiques où tu as acheté, téléchargé ou t&apos;es inscrit sont des commerces indépendants : elles gardent
                  leur fiche client et leurs factures. Pour être effacé d&apos;une boutique, écris-lui directement (page Contact
                  de la boutique) ;
                </li>
                <li>tes achats restent valables ; si tu reviens, ce sera avec un nouveau compte.</li>
              </ul>

              {newsletters.length > 0 && (
                <div className="space-y-2">
                  <p className="text-gray-300">Me désinscrire aussi de la newsletter de :</p>
                  <label className="flex items-center gap-2 text-gray-400">
                    <input
                      type="checkbox"
                      checked={tout}
                      onChange={() => setCoches(tout ? new Set() : new Set(newsletters.map(b => b.id)))}
                    />
                    Tout sélectionner
                  </label>
                  {newsletters.map(b => (
                    <label key={b.id} className="flex items-center gap-2 pl-5">
                      <input type="checkbox" checked={coches.has(b.id)} onChange={() => basculer(b.id)} />
                      {b.nom}
                    </label>
                  ))}
                </div>
              )}

              <label className="block">
                <span className="text-gray-400">Tape <strong className="text-white">SUPPRIMER</strong> pour confirmer</span>
                <input
                  value={saisie}
                  onChange={e => setSaisie(e.target.value)}
                  autoComplete="off"
                  className="mt-1 w-full bg-gray-800 border border-gray-700 focus:border-red-500 rounded-lg px-3 py-2 text-white outline-none"
                />
              </label>
              <button
                type="button"
                disabled={bloque || saisie.trim() !== 'SUPPRIMER' || enCours}
                onClick={supprimer}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold disabled:opacity-40"
              >
                {enCours && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {enCours ? 'Suppression en cours…' : 'Supprimer définitivement mon compte'}
              </button>
            </>
          )}
          {erreur && <p className="text-red-400">{erreur}</p>}
          <button type="button" onClick={() => { setOuvert(false); setErreur(null) }} className="block text-xs text-gray-500 hover:text-gray-300">
            Annuler
          </button>
        </div>
      )}
    </div>
  )
}
