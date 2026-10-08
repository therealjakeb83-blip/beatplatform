'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Etat =
  | { kind: 'chargement' }
  | { kind: 'ok'; downloadUrl: string; beatTitre: string }
  | { kind: 'erreur'; message: string }

export default function ConfirmationFreeDownload({ slug, nomArtiste, jeton }: { slug: string; nomArtiste: string; jeton: string }) {
  const [etat, setEtat] = useState<Etat>({ kind: 'chargement' })
  const lance = useRef(false)

  useEffect(() => {
    if (lance.current) return
    lance.current = true
    ;(async () => {
      try {
        const res = await fetch('/api/free-download/confirmer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ t: jeton }),
        })
        const data = await res.json()
        if (!res.ok) {
          setEtat({ kind: 'erreur', message: data.error ?? 'Une erreur est survenue.' })
          return
        }
        setEtat({ kind: 'ok', downloadUrl: data.downloadUrl, beatTitre: data.beatTitre })
        // Cadre invisible plutôt que de faire naviguer l'onglet vers le fichier :
        // un onglet ouvert depuis Gmail est refermé par Chrome dès que sa propre
        // navigation devient un téléchargement (page disparue, rien de téléchargé).
        const cadre = document.createElement('iframe')
        cadre.style.display = 'none'
        cadre.src = data.downloadUrl
        document.body.appendChild(cadre)
      } catch {
        setEtat({ kind: 'erreur', message: 'Une erreur est survenue. Réessaie dans un instant.' })
      }
    })()
  }, [jeton])

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      {etat.kind === 'chargement' && (
        <>
          <svg className="animate-spin w-8 h-8 mx-auto mb-4 text-gray-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-sm text-gray-400">Confirmation de ton email…</p>
        </>
      )}

      {etat.kind === 'ok' && (
        <>
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-2xl mx-auto mb-4 text-green-400">✓</div>
          <h1 className="text-xl font-black text-white mb-2">Email confirmé</h1>
          <p className="text-sm text-gray-400 mb-6">
            Le téléchargement de <span className="text-white font-semibold">{etat.beatTitre}</span> démarre.
          </p>
          <a
            href={etat.downloadUrl}
            className="inline-block px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition-colors"
          >
            Télécharger
          </a>
          <p className="text-xs text-gray-600 mt-3">Si le téléchargement ne démarre pas tout seul.</p>
        </>
      )}

      {etat.kind === 'erreur' && (
        <>
          <h1 className="text-xl font-black text-white mb-2">Téléchargement impossible</h1>
          <p className="text-sm text-gray-400 mb-6">{etat.message}</p>
        </>
      )}

      <Link href={`/${slug}`} className="inline-block mt-8 text-gray-500 hover:text-white text-sm transition-colors">
        ← Boutique de {nomArtiste}
      </Link>
    </div>
  )
}
