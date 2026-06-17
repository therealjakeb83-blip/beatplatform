'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RaisonData } from '../../_components/DoublonsView'

type ClientInfo = {
  id: string
  prenom: string | null
  nom: string | null
  email: string
  pays: string | null
  telephone: string | null
  instagram: string | null
  spotify: string | null
  youtube: string | null
  tiktok: string | null
  notes: string | null
  nom_artiste: string | null
  ltv: number
  nb_achats: number
}

type ChampComparable = {
  key: keyof ClientInfo
  label: string
}

const CHAMPS: ChampComparable[] = [
  { key: 'telephone',   label: 'Téléphone'      },
  { key: 'pays',        label: 'Pays'           },
  { key: 'nom_artiste', label: "Nom d'artiste"  },
  { key: 'instagram',   label: 'Instagram'      },
  { key: 'spotify',     label: 'Spotify'        },
  { key: 'youtube',     label: 'YouTube'        },
  { key: 'tiktok',      label: 'TikTok'         },
  { key: 'notes',       label: 'Notes'          },
]

function Avatar({ client, badge }: { client: ClientInfo; badge: string }) {
  const initiales = [client.prenom?.[0], client.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
          {client.pays ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`https://flagcdn.com/w40/${client.pays.toLowerCase()}.png`} alt={client.pays} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm text-indigo-300 font-bold">{initiales}</span>
          )}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm text-white">{client.prenom} {client.nom}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${badge === 'CONSERVÉ' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {badge}
          </span>
        </div>
        <p className="text-xs text-gray-500">{client.email}</p>
      </div>
    </div>
  )
}

function formatLtv(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

export default function FusionWizard({
  conserve,
  archive,
  raisons,
}: {
  conserve: ClientInfo
  archive: ClientInfo
  raisons: RaisonData[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur]   = useState<string | null>(null)

  // Pour chaque champ en conflit, stocke la valeur choisie
  // Par défaut : valeur du conservé
  const champsCandidats = CHAMPS.filter(c => {
    const vC = conserve[c.key] as string | null
    const vA = archive[c.key] as string | null
    return vC && vA && vC.trim() !== vA.trim()
  })

  const [choix, setChoix] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const c of champsCandidats) {
      init[c.key] = conserve[c.key] as string
    }
    return init
  })

  // Champs qui seront transférés automatiquement (seul l'archivé les a)
  const champsAutoTransfer = CHAMPS.filter(c => {
    const vC = conserve[c.key] as string | null
    const vA = archive[c.key] as string | null
    return !vC && !!vA
  })

  async function confirmer() {
    setLoading(true)
    setErreur(null)

    // champs_conserves = champs où on a choisi la valeur de l'archivé
    //                  + champs où seul l'archivé a une valeur (transfert automatique)
    const champs_conserves: Record<string, string> = {}
    for (const c of champsCandidats) {
      const valArchive = archive[c.key] as string
      if (choix[c.key] === valArchive) {
        champs_conserves[c.key] = valArchive
      }
    }
    for (const c of CHAMPS) {
      const vC = conserve[c.key] as string | null
      const vA = archive[c.key] as string | null
      if (!vC && vA) {
        champs_conserves[c.key] = vA
      }
    }

    const res = await fetch('/api/business/doublons/fusionner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id_conserve: conserve.id,
        client_id_archive:  archive.id,
        emails_archives:    [archive.email],
        champs_conserves,
        snapshot_archive: {
          prenom:    archive.prenom,
          nom:       archive.nom,
          email:     archive.email,
          ltv:       archive.ltv,
          nb_achats: archive.nb_achats,
          pays:      archive.pays,
          instagram: archive.instagram,
          spotify:   archive.spotify,
          youtube:   archive.youtube,
          tiktok:    archive.tiktok,
          notes:     archive.notes,
        },
        raisons,
      }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setErreur(json.erreur ?? 'Erreur serveur — la fusion n\'a pas été sauvegardée.')
      setLoading(false)
      return
    }

    router.push('/dashboard/business/doublons')
    router.refresh()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Aperçu CONSERVÉ / ARCHIVÉ */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { client: conserve, badge: 'CONSERVÉ', borderColor: 'border-green-500/30 bg-green-500/5' },
          { client: archive,  badge: 'ARCHIVÉ',  borderColor: 'border-red-500/20 bg-red-500/5 opacity-80' },
        ].map(({ client, badge, borderColor }) => (
          <div key={client.id} className={`rounded-2xl border p-5 ${borderColor}`}>
            <Avatar client={client} badge={badge} />
            <div className="flex gap-6 mt-4 text-xs">
              <div>
                <p className="text-gray-600 uppercase tracking-wide text-[10px]">LTV</p>
                <p className="font-bold text-white">{formatLtv(client.ltv)}</p>
              </div>
              <div>
                <p className="text-gray-600 uppercase tracking-wide text-[10px]">Achats</p>
                <p className="font-bold text-white">{client.nb_achats}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Email secondaire */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Emails</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-600/20 text-indigo-400 font-medium">Principal</span>
            <span className="text-sm text-white">{conserve.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-500 font-medium">Secondaire</span>
            <span className="text-sm text-gray-400">{archive.email}</span>
          </div>
        </div>
        <p className="text-xs text-gray-700 mt-3">Les commandes avec l'adresse secondaire apparaîtront sur la fiche fusionnée.</p>
      </div>

      {/* Transfert automatique */}
      {champsAutoTransfer.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Transfert automatique</p>
          <p className="text-xs text-gray-600 mb-4">Ces champs n&apos;existent que sur le contact archivé — ils seront copiés sur le contact conservé.</p>
          <div className="space-y-2">
            {champsAutoTransfer.map(c => (
              <div key={c.key} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0 gap-4">
                <span className="text-xs text-gray-500 flex-shrink-0">{c.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-400 font-medium">{archive[c.key] as string}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20 font-medium">→ conservé</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Résolution des conflits */}
      {champsCandidats.length > 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Champs en conflit</p>
          <p className="text-xs text-gray-600 mb-5">Choisis quelle valeur conserver pour chaque champ.</p>

          <div className="space-y-4">
            {champsCandidats.map(c => {
              const vC = conserve[c.key] as string
              const vA = archive[c.key] as string
              return (
                <div key={c.key}>
                  <p className="text-xs text-gray-500 mb-2">{c.label}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { valeur: vC, label: 'Conservé', color: 'green' },
                      { valeur: vA, label: 'Archivé',  color: 'red'   },
                    ].map(({ valeur, label, color }) => {
                      const selected = choix[c.key] === valeur
                      return (
                        <button
                          key={label}
                          onClick={() => setChoix(prev => ({ ...prev, [c.key]: valeur }))}
                          className={`text-left rounded-xl border p-3 transition-all ${
                            selected
                              ? color === 'green'
                                ? 'border-green-500/50 bg-green-500/10 ring-1 ring-green-500/30'
                                : 'border-red-500/50 bg-red-500/10 ring-1 ring-red-500/30'
                              : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                          }`}
                        >
                          <p className={`text-[10px] font-bold mb-1 ${color === 'green' ? 'text-green-500' : 'text-red-500'}`}>
                            {label} {selected && '✓'}
                          </p>
                          <p className="text-xs text-white truncate">{valeur}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center">
          <p className="text-xs text-gray-600">Aucun conflit à résoudre — tous les champs sont identiques ou vides sur l'un des contacts.</p>
        </div>
      )}

      {/* Erreur */}
      {erreur && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
          {erreur}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={confirmer}
          disabled={loading}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-bold text-white transition-colors"
        >
          {loading ? 'Fusion en cours…' : 'Confirmer la fusion'}
        </button>
        <button
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Annuler
        </button>
      </div>

    </div>
  )
}
