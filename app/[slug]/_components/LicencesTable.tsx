'use client'

import { useState } from 'react'
import type { LicencePublic } from './BeatCard'
import AcheterBouton from './AcheterBouton'

const FICHIERS: Record<string, string[]> = {
  mp3:       ['MP3'],
  wav:       ['MP3', 'WAV'],
  stems:     ['MP3', 'WAV', 'Stems'],
  illimite:  ['MP3', 'WAV', 'Stems'],
  exclusive: ['MP3', 'WAV', 'Stems'],
}

function formatStreams(n: number | null) {
  if (n === null) return 'Illimité'
  if (n >= 1_000_000) return `${n / 1_000_000}M`
  if (n >= 1_000) return `${n / 1_000}k`
  return String(n)
}

type CodeApplique = {
  code: string
  type_valeur: 'pourcentage' | 'montant'
  valeur: number
  depense_min: number | null
  licences_eligibles: string[] | null
  a_restriction_email: boolean
}

export default function LicencesTable({
  licences,
  beatId,
  slug,
  estAbonne = false,
  remisePct = 0,
  userEmail = null,
}: {
  licences: (LicencePublic & {
    streams_limite: number | null
    vues_video_limite: number | null
    clips_video_limite: number | null
    est_exclusive: boolean
    inclut_mp3: boolean
    inclut_wav: boolean
    inclut_stems: boolean
  })[]
  beatId: string
  slug: string
  estAbonne?: boolean
  remisePct?: number
  userEmail?: string | null
}) {
  const [codeInput, setCodeInput] = useState('')
  const [codeEnAttente, setCodeEnAttente] = useState<CodeApplique | null>(null)
  const [codeApplique, setCodeApplique] = useState<CodeApplique | null>(null)
  const [erreurCode, setErreurCode] = useState<string | null>(null)
  const [chargementCode, setChargementCode] = useState(false)
  const [emailAcheteur, setEmailAcheteur] = useState('')

  const licencesTriees = [...licences].sort((a, b) => a.prix - b.prix)

  if (licencesTriees.length === 0) return null

  async function validerCode() {
    const code = codeInput.trim().toUpperCase()
    if (!code) return
    setChargementCode(true)
    setErreurCode(null)
    try {
      const res = await fetch('/api/stripe/valider-code-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, beat_id: beatId, slug }),
      })
      const data = await res.json()
      if (data.valide) {
        // Vérifier que le code s'applique à au moins une licence sur cette page
        const auMoinsUne = licencesTriees.some(l => {
          if (l.modele === 'illimite' || l.modele === 'exclusive') return false
          if (data.licences_eligibles?.length && !data.licences_eligibles.includes(l.nom)) return false
          if (data.depense_min && l.prix < data.depense_min) return false
          return true
        })
        if (auMoinsUne) {
          if (data.a_restriction_email && !userEmail) {
            setCodeEnAttente({ code, ...data })
          } else {
            setCodeApplique({ code, ...data })
          }
          setCodeInput('')
        } else if (data.depense_min) {
          setErreurCode(`Ce code requiert un achat minimum de ${data.depense_min}€`)
        } else if (data.licences_eligibles?.length) {
          setErreurCode("Ce code ne s'applique pas aux licences disponibles sur ce beat")
        } else {
          setErreurCode("Ce code ne s'applique pas à cet achat")
        }
      } else {
        setErreurCode(data.erreur ?? 'Code invalide')
      }
    } catch {
      setErreurCode('Erreur réseau')
    } finally {
      setChargementCode(false)
    }
  }

  function supprimerCode() {
    setCodeApplique(null)
    setCodeEnAttente(null)
    setErreurCode(null)
    setEmailAcheteur('')
  }

  async function confirmerEmail() {
    if (!emailAcheteur.trim()) {
      setErreurCode('Entrez votre adresse email')
      return
    }
    setChargementCode(true)
    setErreurCode(null)
    try {
      const res = await fetch('/api/stripe/valider-code-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeEnAttente!.code, beat_id: beatId, slug, email: emailAcheteur.trim() }),
      })
      const data = await res.json()
      if (data.valide) {
        setCodeApplique(codeEnAttente!)
        setCodeEnAttente(null)
      } else {
        setErreurCode(data.erreur ?? 'Adresse email non autorisée')
      }
    } catch {
      setErreurCode('Erreur réseau')
    } finally {
      setChargementCode(false)
    }
  }

  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold text-white mb-4">Licences disponibles</h2>
      <div className="flex flex-col gap-3">
        {licencesTriees.map(l => {
          const estIllimiteOuExclusive = l.modele === 'illimite' || l.modele === 'exclusive'
          const aRemiseMembre = estAbonne && remisePct > 0 && !estIllimiteOuExclusive
          const prixApresMembre = aRemiseMembre
            ? Math.round(l.prix * (1 - remisePct / 100))
            : l.prix

          const codeEstApplicable = !estIllimiteOuExclusive &&
            codeApplique !== null &&
            (!codeApplique.licences_eligibles?.length || codeApplique.licences_eligibles.includes(l.nom)) &&
            (!codeApplique.depense_min || prixApresMembre >= codeApplique.depense_min)

          const prixFinal = codeEstApplicable
            ? (codeApplique!.type_valeur === 'pourcentage'
                ? Math.round(prixApresMembre * (1 - codeApplique!.valeur / 100))
                : Math.max(0, prixApresMembre - codeApplique!.valeur))
            : prixApresMembre

          const aUneReduction = prixFinal < l.prix

          return (
            <div
              key={l.id}
              className={`rounded-xl border p-5 ${
                l.est_exclusive
                  ? 'border-yellow-500/40 bg-yellow-500/5'
                  : 'border-gray-800 bg-gray-900'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">{l.nom}</span>
                    {l.est_exclusive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium">
                        Exclusive
                      </span>
                    )}
                    {FICHIERS[l.modele]?.map(f => (
                      <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                        {f}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    {l.streams_limite !== undefined && (
                      <span>
                        Streams monétisés : <span className="text-gray-400">{formatStreams(l.streams_limite)}</span>
                      </span>
                    )}
                    {l.vues_video_limite !== undefined && (
                      <span>
                        Vues vidéo : <span className="text-gray-400">{formatStreams(l.vues_video_limite)}</span>
                      </span>
                    )}
                    {l.clips_video_limite !== undefined && l.clips_video_limite !== null && (
                      <span>
                        Clips : <span className="text-gray-400">{l.clips_video_limite}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 text-right flex flex-col items-end gap-2">
                  {l.sur_demande ? (
                    <span className="text-brand-400 font-semibold">Sur demande</span>
                  ) : (
                    <>
                      <div className="flex flex-col items-end">
                        {aUneReduction && (
                          <span className="text-sm text-gray-500 line-through">{l.prix}€</span>
                        )}
                        <span className={`text-2xl font-black ${aUneReduction ? 'text-green-400' : 'text-white'}`}>
                          {prixFinal}€
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {aRemiseMembre && (
                            <span className="text-xs text-brand-400 font-medium">-{remisePct}% membre</span>
                          )}
                          {codeEstApplicable && (
                            <span className="text-xs text-green-500 font-medium">
                              {codeApplique!.type_valeur === 'pourcentage'
                                ? `-${codeApplique!.valeur}% code`
                                : `-${codeApplique!.valeur}€ code`}
                            </span>
                          )}
                        </div>
                      </div>
                      <AcheterBouton
                        beatId={beatId}
                        licenceId={l.id}
                        slug={slug}
                        label="Acheter"
                        codePromo={codeEstApplicable ? codeApplique!.code : undefined}
                        emailAcheteur={userEmail ?? (emailAcheteur || undefined)}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Section code promo */}
      <div className="mt-6 pt-5 border-t border-gray-800">
        {codeApplique ? (
          /* État 3 : code pleinement actif */
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-green-400">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>
                Code <strong>{codeApplique.code}</strong> appliqué —{' '}
                <span className="text-gray-400">
                  {codeApplique.type_valeur === 'pourcentage'
                    ? `-${codeApplique.valeur}%`
                    : `-${codeApplique.valeur}€`}
                </span>
              </span>
            </div>
            <button
              onClick={supprimerCode}
              className="text-gray-500 hover:text-gray-300 text-xs underline transition-colors"
            >
              Supprimer
            </button>
          </div>
        ) : codeEnAttente ? (
          /* État 2 : code validé mais email requis avant activation */
          <div>
            <p className="text-sm text-gray-400 mb-3">
              Code <strong className="text-white">{codeEnAttente.code}</strong> — entrez votre adresse email pour l&apos;activer
            </p>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={emailAcheteur}
                onChange={e => { setEmailAcheteur(e.target.value); setErreurCode(null) }}
                onKeyDown={e => e.key === 'Enter' && confirmerEmail()}
                placeholder="votre@email.com"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
              />
              <button
                onClick={confirmerEmail}
                disabled={!emailAcheteur.trim() || chargementCode}
                className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {chargementCode ? '...' : 'Confirmer'}
              </button>
            </div>
            {erreurCode && <p className="text-red-400 text-xs mt-2">{erreurCode}</p>}
            <button onClick={supprimerCode} className="text-gray-600 hover:text-gray-400 text-xs mt-2 underline transition-colors">
              Annuler
            </button>
          </div>
        ) : (
          /* État 1 : saisie du code */
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={codeInput}
                onChange={e => { setCodeInput(e.target.value.toUpperCase()); setErreurCode(null) }}
                onKeyDown={e => e.key === 'Enter' && validerCode()}
                placeholder="Code promo"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
              />
              <button
                onClick={validerCode}
                disabled={!codeInput.trim() || chargementCode}
                className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {chargementCode ? '...' : 'Appliquer'}
              </button>
            </div>
            {erreurCode && (
              <p className="text-red-400 text-xs mt-2">{erreurCode}</p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-600 mt-4 text-center">
        Propulsé par My Producer · Les paiements sont sécurisés
      </p>
    </div>
  )
}
