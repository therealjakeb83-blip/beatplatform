'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DOMAINE_PLATEFORME, EMAIL_CONTACT, SOUS_DOMAINES_OUVERTS } from '@/lib/constantes'
import { sousDomainePossible } from '@/lib/slug-regles'

// Rang 9c bis, lot 3 : le beatmaker remplace UNE fois son adresse automatique
// (avertissement + adresse à retaper), ensuite elle est figée et seul le
// support la change (décision 4).

function adresseAffichee(slug: string): string {
  return SOUS_DOMAINES_OUVERTS && sousDomainePossible(slug) ? `${slug}.${DOMAINE_PLATEFORME}` : `${DOMAINE_PLATEFORME}/${slug}`
}

type Etat = 'vide' | 'verification' | 'disponible' | 'pris' | 'refuse'

export default function ChoixSlug({ slug, choisi }: { slug: string; choisi: boolean }) {
  const router = useRouter()
  const [saisie, setSaisie] = useState('')
  const [etat, setEtat] = useState<Etat>('vide')
  const [propre, setPropre] = useState('')
  const [refus, setRefus] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const sequence = useRef(0)

  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current) }, [])

  function saisir(brut: string) {
    setSaisie(brut)
    setConfirmation('')
    if (minuteur.current) clearTimeout(minuteur.current)
    const valeur = brut.trim()
    const numero = ++sequence.current
    if (!valeur) { setEtat('vide'); return }
    setEtat('verification')
    minuteur.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profil/modifier?slug=${encodeURIComponent(valeur)}`)
        const data = await res.json()
        if (numero !== sequence.current) return
        setPropre(data.slug ?? '')
        if (data.refus) { setRefus(data.refus); setEtat('refuse'); return }
        if (data.slug === slug) { setRefus("C'est déjà ton adresse actuelle."); setEtat('refuse'); return }
        setEtat(data.disponible ? 'disponible' : 'pris')
      } catch {
        if (numero === sequence.current) { setRefus('Vérification impossible, réessaie.'); setEtat('refuse') }
      }
    }, 400)
  }

  async function choisir() {
    if (etat !== 'disponible' || confirmation !== propre) return
    setEnvoi(true)
    setErreur('')
    const res = await fetch('/api/profil/modifier', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: propre, confirmation_slug: confirmation }),
    })
    const data = await res.json().catch(() => ({}))
    setEnvoi(false)
    if (!res.ok) { setErreur(data.error ?? 'Erreur inconnue'); return }
    router.refresh()
  }

  if (choisi) {
    return (
      <div>
        <label className="block text-sm text-gray-300 mb-1">Adresse de ta boutique</label>
        <p className="px-4 py-3 rounded-lg bg-gray-900 border border-gray-800 text-white break-all">{adresseAffichee(slug)}</p>
        <p className="text-gray-500 text-xs mt-1">
          Une erreur ? <a href={`mailto:${EMAIL_CONTACT}`} className="underline hover:text-white">Contacte le support</a>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm text-gray-300 mb-1">Adresse de ta boutique</label>
        <p className="text-gray-400 text-sm">
          Adresse provisoire : <span className="text-white break-all">{adresseAffichee(slug)}</span>
        </p>
        <p className="text-gray-500 text-xs mt-1">Choisis ton adresse définitive. Tu ne pourras la choisir qu&apos;une seule fois.</p>
      </div>
      <input
        type="text"
        value={saisie}
        onChange={e => saisir(e.target.value)}
        placeholder="ton-nom"
        aria-label="Adresse souhaitée"
        className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
      />
      <div className="min-h-4 text-xs">
        {etat === 'verification' && <span className="text-gray-400">Vérification...</span>}
        {etat === 'refuse' && <span className="text-yellow-400">{refus}</span>}
        {etat === 'pris' && <span className="text-red-400">✗ Cette adresse est déjà prise.</span>}
        {etat === 'disponible' && <span className="text-green-400">✓ Disponible : {adresseAffichee(propre)}</span>}
      </div>

      {etat === 'disponible' && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-3">
          <p className="text-sm text-yellow-200">
            Attention : ce choix est définitif. Ta boutique sera à l&apos;adresse <strong className="break-all">{adresseAffichee(propre)}</strong>{' '}et
            tu ne pourras plus la changer toi-même. L&apos;adresse provisoire renverra automatiquement vers la nouvelle.
          </p>
          <label className="block text-sm text-gray-300">
            Pour confirmer, tape <strong className="text-white">{propre}</strong>
            <input
              type="text"
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              autoComplete="off"
              aria-label="Confirmation de l'adresse"
              className="mt-1 w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
          </label>
          <button
            type="button"
            onClick={choisir}
            disabled={envoi || confirmation !== propre}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {envoi ? 'Enregistrement...' : 'Choisir cette adresse définitivement'}
          </button>
        </div>
      )}
      {erreur && <p className="text-red-400 text-sm">{erreur}</p>}
    </div>
  )
}
