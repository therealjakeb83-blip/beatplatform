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
      <svg viewBox="0 0 24 24" fill={estFavori ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
        <path d="M12 21s-7.5-4.8-9.8-9.2C.7 8.9 2.4 5.5 5.7 5.1c1.9-.2 3.8.7 4.9 2.3l1.4 2 1.4-2c1.1-1.6 3-2.5 4.9-2.3 3.3.4 5 3.8 3.5 6.7C19.5 16.2 12 21 12 21z" />
      </svg>
    </button>
  )
}
