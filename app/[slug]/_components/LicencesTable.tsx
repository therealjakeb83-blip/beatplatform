'use client'

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

export default function LicencesTable({
  licences,
  beatId,
  beatTitre,
  beatImageUrl,
  estAbonne = false,
  remisePct = 0,
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
  beatTitre: string
  beatImageUrl: string | null
  estAbonne?: boolean
  remisePct?: number
}) {
  const licencesTriees = [...licences].sort((a, b) => a.prix - b.prix)

  if (licencesTriees.length === 0) return null

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
                        {aRemiseMembre && (
                          <span className="text-sm text-gray-500 line-through">{l.prix}€</span>
                        )}
                        <span className={`text-2xl font-black ${aRemiseMembre ? 'text-green-400' : 'text-white'}`}>
                          {prixApresMembre}€
                        </span>
                        {aRemiseMembre && (
                          <span className="text-xs text-brand-400 font-medium mt-0.5">-{remisePct}% membre</span>
                        )}
                      </div>
                      <AcheterBouton
                        beatId={beatId}
                        licenceId={l.id}
                        titre={beatTitre}
                        imageUrl={beatImageUrl}
                        licenceNom={l.nom}
                        prix={prixApresMembre}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-600 mt-4 text-center">
        Un code promo ? Applique-le depuis ton panier · Propulsé par My Producer · Paiements sécurisés
      </p>
    </div>
  )
}
