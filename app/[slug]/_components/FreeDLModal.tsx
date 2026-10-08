'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const DISCLAIMER =
  "Ce téléchargement gratuit est réservé à un usage personnel et non commercial. " +
  "Vous pouvez l'utiliser pour créer une maquette ou le poster sur les réseaux sociaux et SoundCloud. " +
  "Il est interdit de le diffuser sur des plateformes de streaming (Spotify, Apple Music, YouTube, etc.) " +
  "ou de l'utiliser à des fins commerciales sans acheter une licence."

type Props = {
  open: boolean
  onClose: () => void
  beatId: string
  beatTitre: string
  slug: string
  clientId: string | null
}

const PAYS = [
  { code: 'FR', label: 'France' }, { code: 'BE', label: 'Belgique' },
  { code: 'CH', label: 'Suisse' }, { code: 'CA', label: 'Canada' },
  { code: 'US', label: 'États-Unis' }, { code: 'GB', label: 'Royaume-Uni' },
  { code: 'DE', label: 'Allemagne' }, { code: 'ES', label: 'Espagne' },
  { code: 'IT', label: 'Italie' }, { code: 'NL', label: 'Pays-Bas' },
  { code: 'SN', label: 'Sénégal' }, { code: 'CI', label: "Côte d'Ivoire" },
  { code: 'MA', label: 'Maroc' }, { code: 'DZ', label: 'Algérie' },
  { code: 'TN', label: 'Tunisie' }, { code: 'CM', label: 'Cameroun' },
  { code: 'ML', label: 'Mali' }, { code: 'BJ', label: 'Bénin' },
]

export default function FreeDLModal({ open, onClose, beatId, beatTitre, slug, clientId }: Props) {
  const [email, setEmail]             = useState('')
  const [prenom, setPrenom]           = useState('')
  const [nom, setNom]                 = useState('')
  const [nomArtiste, setNomArtiste]   = useState('')
  const [pays, setPays]               = useState('')
  const [newsletter, setNewsletter]   = useState(false)
  const [compte, setCompte]           = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [emailEnvoye, setEmailEnvoye] = useState<string | null>(null)
  const [disclaimer, setDisclaimer]   = useState(false)
  // Connecté : déjà inscrit à la newsletter de CETTE boutique ? (null = en cours de vérification)
  const [dejaInscrit, setDejaInscrit] = useState<boolean | null>(null)

  useEffect(() => {
    if (!open || !clientId) return
    let annule = false
    fetch(`/api/artiste/newsletter-statut?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => { if (!annule) setDejaInscrit(d.statut === 'inscrit') })
      .catch(() => { if (!annule) setDejaInscrit(false) })
    return () => { annule = true }
  }, [open, clientId, slug])

  const canSubmit = clientId
    ? dejaInscrit !== null && disclaimer && (dejaInscrit || newsletter)
    : newsletter && compte && email.includes('@') && pays !== '' && prenom.trim() !== ''

  function handleClose() {
    setDownloadUrl(null)
    setEmailEnvoye(null)
    setError(null)
    setEmail('')
    setPrenom('')
    setNom('')
    setNomArtiste('')
    setPays('')
    setNewsletter(false)
    setCompte(false)
    setDisclaimer(false)
    setDejaInscrit(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const body = clientId
      ? { beatId, slug, newsletterConsent: !dejaInscrit && newsletter, disclaimerAccepte: disclaimer }
      : { beatId, slug, email, prenom: prenom || undefined, nom: nom || undefined, nomArtiste: nomArtiste || undefined, pays: pays || undefined, newsletterConsent: newsletter, disclaimerAccepte: compte }

    const res = await fetch('/api/free-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Une erreur est survenue.')
      setLoading(false)
      return
    }

    if (data.emailEnvoye) {
      setEmailEnvoye(data.email)
      setLoading(false)
      return
    }

    setDownloadUrl(data.downloadUrl)
    const a = document.createElement('a')
    a.href = data.downloadUrl
    a.download = data.beatTitre + '.mp3'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setLoading(false)
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-bold text-base text-white">Téléchargement gratuit</h2>
            <p className="text-xs text-brand-400 mt-0.5">{beatTitre}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none ml-4 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Disclaimer */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4">
          <p className="text-[11px] text-yellow-300/90 leading-relaxed">{DISCLAIMER}</p>
        </div>

        {emailEnvoye ? (
          /* Visiteur : lien envoyé par email (confirme l'adresse) */
          <div className="text-center py-2">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-2xl mx-auto mb-3">
              ✉
            </div>
            <p className="text-green-400 font-semibold text-sm mb-1">Vérifie ta boîte mail</p>
            <p className="text-xs text-gray-400 mb-1">
              On t&apos;a envoyé le lien de téléchargement à <span className="text-white">{emailEnvoye}</span>.
            </p>
            <p className="text-xs text-gray-500">
              Clique sur le lien pour confirmer ton email et télécharger le beat (pense à regarder dans les spams).
            </p>
          </div>
        ) : downloadUrl ? (
          /* Success state */
          <div className="text-center py-2">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-2xl mx-auto mb-3">
              ✓
            </div>
            <p className="text-green-400 font-semibold text-sm mb-1">Téléchargement lancé !</p>
            <p className="text-xs text-gray-500 mb-4">
              Un email avec le lien t&apos;a également été envoyé.
            </p>
            <a
              href={downloadUrl}
              className="text-xs text-brand-400 hover:text-brand-300 underline underline-offset-2"
            >
              Cliquer ici si le téléchargement ne démarre pas
            </a>
          </div>
        ) : clientId ? (
          /* Connected user — newsletter (si pas encore inscrit à cette boutique) + conditions */
          <form onSubmit={handleSubmit} className="space-y-3">
            {dejaInscrit === null ? (
              <p className="flex items-center justify-center gap-2 text-xs text-gray-500 py-2">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Vérification de ton inscription…
              </p>
            ) : (
              <>
                {!dejaInscrit && (
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newsletter}
                      onChange={e => setNewsletter(e.target.checked)}
                      className="mt-0.5 flex-shrink-0 accent-brand-600 cursor-pointer"
                    />
                    <span className="text-xs text-gray-400 leading-relaxed">
                      Je m&apos;inscris à la newsletter de cette boutique pour recevoir les prochains beats et nouveautés{' '}
                      <span className="text-red-400">*</span>
                    </span>
                  </label>
                )}
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={disclaimer}
                    onChange={e => setDisclaimer(e.target.checked)}
                    className="mt-0.5 flex-shrink-0 accent-brand-600 cursor-pointer"
                  />
                  <span className="text-xs text-gray-400 leading-relaxed">
                    J&apos;ai lu et j&apos;accepte les conditions ci-dessus{' '}
                    <span className="text-red-400">*</span>
                  </span>
                </label>
              </>
            )}
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
            >
              {loading ? 'Préparation…' : 'Télécharger gratuitement'}
            </button>
          </form>
        ) : (
          /* Non-connected — email + infos + checkboxes */
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value.toLowerCase())}
              placeholder="ton@email.com *"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-brand-500 text-white placeholder-gray-500 text-sm outline-none transition-colors"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={prenom}
                onChange={e => setPrenom(e.target.value)}
                placeholder="Prénom *"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-brand-500 text-white placeholder-gray-500 text-sm outline-none transition-colors"
              />
              <input
                type="text"
                value={nom}
                onChange={e => setNom(e.target.value)}
                placeholder="Nom"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-brand-500 text-white placeholder-gray-500 text-sm outline-none transition-colors"
              />
            </div>
            <input
              type="text"
              value={nomArtiste}
              onChange={e => setNomArtiste(e.target.value)}
              placeholder="Nom d'artiste"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-brand-500 text-white placeholder-gray-500 text-sm outline-none transition-colors"
            />
            <div>
              <p className="text-[10px] text-gray-500 mb-1 pl-1">Pays <span className="text-red-400">*</span></p>
              <select
                value={pays}
                onChange={e => setPays(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-brand-500 text-sm outline-none transition-colors cursor-pointer text-gray-500"
                style={{ color: pays ? 'white' : undefined }}
              >
                <option value="" disabled>Sélectionner…</option>
                {PAYS.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </div>
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newsletter}
                onChange={e => setNewsletter(e.target.checked)}
                className="mt-0.5 flex-shrink-0 accent-brand-600 cursor-pointer"
              />
              <span className="text-xs text-gray-400 leading-relaxed">
                Je m&apos;inscris à la newsletter de cette boutique pour recevoir les prochains beats et nouveautés{' '}
                <span className="text-red-400">*</span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={compte}
                onChange={e => setCompte(e.target.checked)}
                className="mt-0.5 flex-shrink-0 accent-brand-600 cursor-pointer"
              />
              <span className="text-xs text-gray-400 leading-relaxed">
                J&apos;accepte de créer un compte et je confirme avoir lu les conditions ci-dessus{' '}
                <span className="text-red-400">*</span>
              </span>
            </label>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
            >
              {loading ? 'Envoi…' : 'Recevoir le lien par email'}
            </button>
            <p className="text-[11px] text-gray-600 text-center">
              Le lien de téléchargement te sera envoyé par email.
            </p>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}
