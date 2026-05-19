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
      className={`absolute top-2 right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
        estFavori
          ? 'bg-rose-600 text-white shadow-lg'
          : 'bg-black/50 text-gray-400 hover:bg-black/70 hover:text-white opacity-0 group-hover:opacity-100'
      } ${chargement ? 'cursor-wait' : ''}`}
    >
      <span className="text-sm">{estFavori ? '♥' : '♡'}</span>
    </button>
  )
}
