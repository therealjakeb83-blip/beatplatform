'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Profil = {
  slug: string
  nom_artiste: string
  tagline: string | null
  logo_url: string | null
  instagram_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
}

export default function ProfilForm({ profil }: { profil: Profil }) {
  const router = useRouter()
  const [slug, setSlug] = useState(profil.slug)
  const [nomArtiste, setNomArtiste] = useState(profil.nom_artiste)
  const [tagline, setTagline] = useState(profil.tagline ?? '')
  const [logoUrl, setLogoUrl] = useState(profil.logo_url ?? '')
  const [instagram, setInstagram] = useState(profil.instagram_url ?? '')
  const [youtube, setYoutube] = useState(profil.youtube_url ?? '')
  const [tiktok, setTiktok] = useState(profil.tiktok_url ?? '')

  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'disponible' | 'pris' | 'court'>('idle')
  const [slugSanitized, setSlugSanitized] = useState(profil.slug)
  const [logoLoading, setLogoLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const checkSlug = useCallback(async (value: string) => {
    if (value === profil.slug) { setSlugStatus('idle'); return }
    if (value.length < 3) { setSlugStatus('court'); return }
    setSlugStatus('checking')
    const res = await fetch(`/api/profil/modifier?slug=${encodeURIComponent(value)}`)
    const data = await res.json()
    setSlugSanitized(data.slug)
    setSlugStatus(data.disponible ? 'disponible' : 'pris')
  }, [profil.slug])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => checkSlug(slug), 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [slug, checkSlug])

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/profil/logo', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.url) setLogoUrl(data.url)
    setLogoLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (slugStatus === 'pris' || slugStatus === 'court') return
    setSaving(true)
    setErreur('')
    setSucces(false)

    const res = await fetch('/api/profil/modifier', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        nom_artiste: nomArtiste,
        tagline,
        logo_url: logoUrl,
        instagram_url: instagram,
        youtube_url: youtube,
        tiktok_url: tiktok,
      }),
    })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setErreur(data.error ?? 'Erreur inconnue')
      return
    }

    setSucces(true)
    router.refresh()
  }

  const slugIndicator = () => {
    if (slug === profil.slug || slugStatus === 'idle') return null
    if (slugStatus === 'checking') return <span className="text-gray-400 text-xs">Vérification...</span>
    if (slugStatus === 'court') return <span className="text-yellow-400 text-xs">Minimum 3 caractères</span>
    if (slugStatus === 'disponible') return <span className="text-green-400 text-xs">✓ Disponible — URL : monproducer.com/{slugSanitized}</span>
    if (slugStatus === 'pris') return <span className="text-red-400 text-xs">✗ Déjà pris</span>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">

      {/* Logo */}
      <div>
        <label className="block text-sm text-gray-300 mb-2">Logo / Photo de profil</label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gray-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-500 text-2xl font-bold">{nomArtiste.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={logoLoading}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors disabled:opacity-50"
            >
              {logoLoading ? 'Upload...' : 'Changer le logo'}
            </button>
            <p className="text-gray-500 text-xs mt-1">JPG, PNG ou WebP — carré recommandé</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
        </div>
      </div>

      {/* Nom d'artiste */}
      <div>
        <label className="block text-sm text-gray-300 mb-1">Nom d'artiste</label>
        <input
          type="text"
          value={nomArtiste}
          onChange={e => setNomArtiste(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="block text-sm text-gray-300 mb-1">URL de ta boutique</label>
        <div className="flex items-center rounded-lg bg-gray-800 border border-gray-700 focus-within:border-indigo-500 overflow-hidden">
          <span className="pl-4 text-gray-500 text-sm whitespace-nowrap">monproducer.com/</span>
          <input
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            required
            className="flex-1 px-2 py-3 bg-transparent text-white focus:outline-none"
            placeholder="ton-slug"
          />
        </div>
        <div className="mt-1 h-4">{slugIndicator()}</div>
      </div>

      {/* Tagline */}
      <div>
        <label className="block text-sm text-gray-300 mb-1">Tagline <span className="text-gray-500">(optionnel)</span></label>
        <input
          type="text"
          value={tagline}
          onChange={e => setTagline(e.target.value)}
          placeholder="ex: Beats trap & afro exclusifs"
          className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Réseaux sociaux */}
      <div className="space-y-3">
        <label className="block text-sm text-gray-300">Réseaux sociaux <span className="text-gray-500">(optionnel)</span></label>
        <input
          type="url"
          value={instagram}
          onChange={e => setInstagram(e.target.value)}
          placeholder="https://instagram.com/toncompte"
          className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
        />
        <input
          type="url"
          value={youtube}
          onChange={e => setYoutube(e.target.value)}
          placeholder="https://youtube.com/@tachaîne"
          className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
        />
        <input
          type="url"
          value={tiktok}
          onChange={e => setTiktok(e.target.value)}
          placeholder="https://tiktok.com/@toncompte"
          className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {erreur && <p className="text-red-400 text-sm">{erreur}</p>}
      {succes && <p className="text-green-400 text-sm">✓ Profil mis à jour</p>}

      <button
        type="submit"
        disabled={saving || slugStatus === 'pris' || slugStatus === 'court'}
        className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </form>
  )
}
