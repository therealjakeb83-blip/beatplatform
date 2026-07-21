'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function FavoriButton({
  beatId,
  clientId,
  slug,
}: {
  beatId: string
  clientId: string | null
  slug: string
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
      className={`shop-favori-btn${estFavori ? ' is-active' : ''}`}
      style={chargement ? { cursor: 'wait' } : undefined}
    >
      <span style={{ fontSize: 13 }}>{estFavori ? '♥' : '♡'}</span>
    </button>
  )
}
