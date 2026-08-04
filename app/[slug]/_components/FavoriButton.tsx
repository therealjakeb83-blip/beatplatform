'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function FavoriButton({
  beatId,
  clientId,
  slug,
  className = 'shop-favori-btn',
}: {
  beatId: string
  clientId: string | null
  slug: string
  className?: string
}) {
  const router = useRouter()
  const [estFavori, setEstFavori] = useState(false)
  const [chargement, setChargement] = useState(false)

  useEffect(() => {
    if (!clientId) return
    const supabase = createClient()
    supabase
      .from('favoris')
      .select('id')
      .eq('client_id', clientId)
      .eq('beat_id', beatId)
      .maybeSingle()
      .then(({ data }) => setEstFavori(!!data))
  }, [beatId, clientId])

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!clientId) {
      router.push(`/artiste/connexion?redirect=/${slug}`)
      return
    }

    if (chargement) return
    setChargement(true)

    const supabase = createClient()

    if (estFavori) {
      await supabase.from('favoris').delete().eq('client_id', clientId).eq('beat_id', beatId)
      setEstFavori(false)
    } else {
      await supabase.from('favoris').insert({ client_id: clientId, beat_id: beatId })
      setEstFavori(true)
    }

    setChargement(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={chargement}
      aria-label={estFavori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      className={`${className}${estFavori ? ' is-active' : ''}`}
      style={chargement ? { cursor: 'wait' } : undefined}
    >
      <svg viewBox="0 0 24 24" fill={estFavori ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    </button>
  )
}
