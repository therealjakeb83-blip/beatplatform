'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { changerSlugAdminAction, libererAncienNomAction, verifierSlugAdminAction } from '../_lib/actions-slug'

export type AncienNom = {
  id: string
  slug: string
  automatique: boolean
  cree_le: string
  libere_le: string | null
}

function date(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function AdresseBoutiqueAdmin({ beatmakerId, slug, slugChoisiLe, anciensNoms }: {
  beatmakerId: string
  slug: string
  slugChoisiLe: string | null
  anciensNoms: AncienNom[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saisie, setSaisie] = useState('')
  const [verifie, setVerifie] = useState<{ slug: string; disponible: boolean; refus?: string } | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function verifier() {
    setErreur(null); setMessage(null); setConfirmation('')
    startTransition(async () => {
      const r = await verifierSlugAdminAction(beatmakerId, saisie)
      if ('erreur' in r) { setErreur(r.erreur); setVerifie(null); return }
      setVerifie(r)
    })
  }

  function changer() {
    if (!verifie?.disponible) return
    setErreur(null)
    startTransition(async () => {
      const r = await changerSlugAdminAction(beatmakerId, verifie.slug, confirmation)
      if (r.erreur) { setErreur(r.erreur); return }
      setMessage(`Adresse changée : ${slug} → ${r.slug}. L'ancienne renvoie vers la nouvelle.`)
      setSaisie(''); setVerifie(null); setConfirmation('')
      router.refresh()
    })
  }

  function liberer(ancien: AncienNom) {
    if (!window.confirm(`Libérer « ${ancien.slug} » ? Il ne renverra plus vers cette boutique et n'importe qui pourra le prendre.`)) return
    setErreur(null); setMessage(null)
    startTransition(async () => {
      const r = await libererAncienNomAction(ancien.id)
      if (r.erreur) { setErreur(r.erreur); return }
      setMessage(`« ${ancien.slug} » libéré.`)
      router.refresh()
    })
  }

  const actifs = anciensNoms.filter(a => !a.libere_le)
  const liberes = anciensNoms.filter(a => a.libere_le)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-white">Adresse de la boutique</p>
        <p className="text-xs text-gray-500 mt-1">
          Slug actuel : <span className="text-white">{slug}</span> —{' '}
          {slugChoisiLe ? `choisi le ${date(slugChoisiLe)} (figé pour le beatmaker)` : 'automatique (le beatmaker peut encore le choisir une fois)'}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-gray-400">Changer le slug (l&apos;actuel devient un ancien nom qui renvoie vers le nouveau)</p>
        <div className="flex gap-2">
          <input
            value={saisie}
            onChange={e => { setSaisie(e.target.value); setVerifie(null); setConfirmation('') }}
            placeholder="nouveau-slug"
            aria-label="Nouveau slug"
            className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <button type="button" onClick={verifier} disabled={isPending || !saisie.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50">
            Vérifier
          </button>
        </div>
        {verifie && !verifie.disponible && (
          <p className="text-xs text-yellow-400">{verifie.refus ?? `« ${verifie.slug} » est déjà pris (slug ou ancien nom d'une autre boutique).`}</p>
        )}
        {verifie?.disponible && (
          <div className="space-y-2">
            <p className="text-xs text-green-400">✓ « {verifie.slug} » est disponible. Pour confirmer, tape-le :</p>
            <div className="flex gap-2">
              <input
                value={confirmation}
                onChange={e => setConfirmation(e.target.value)}
                autoComplete="off"
                aria-label="Confirmation du nouveau slug"
                className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <button type="button" onClick={changer} disabled={isPending || confirmation !== verifie.slug}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">
                {isPending ? 'Changement…' : 'Changer le slug'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-gray-400">Anciens noms (renvoient vers cette boutique, réservés)</p>
        {actifs.length === 0 && <p className="text-xs text-gray-600">Aucun.</p>}
        {actifs.map(a => (
          <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-white break-all">
              {a.slug} <span className="text-xs text-gray-500">({a.automatique ? 'automatique' : 'choisi'}, depuis le {date(a.cree_le)})</span>
            </span>
            <button type="button" onClick={() => liberer(a)} disabled={isPending}
              className="px-2 py-1 rounded-lg text-xs text-red-300 border border-red-500/40 hover:bg-red-500/10 disabled:opacity-50">
              Libérer
            </button>
          </div>
        ))}
        {liberes.length > 0 && (
          <p className="text-xs text-gray-600">
            Libérés : {liberes.map(a => `${a.slug} (le ${date(a.libere_le!)})`).join(', ')}
          </p>
        )}
      </div>

      {erreur && <p className="text-xs text-red-400">{erreur}</p>}
      {message && <p className="text-xs text-green-400">{message}</p>}
    </div>
  )
}
