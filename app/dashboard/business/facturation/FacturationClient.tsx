'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MANDAT_FACTURATION_VERSION_ACTUELLE,
  texteMandatFacturation,
  FORMAT_FACTURATION_PAR_DEFAUT,
  VARIABLES_FACTURATION,
  formatFacturationValide,
  formaterNumeroFacture,
} from '@/lib/facturation'

const LABEL_VARIABLE: Record<string, string> = {
  '{SLUG}': 'Identifiant de ta boutique',
  '{NUM}': 'Compteur séquentiel (inclut déjà le point de départ de cette année)',
  '{JJ}': "Jour d'émission",
  '{MM}': "Mois d'émission",
  '{AA}': "Année d'émission",
}

// Détaille, dans l'ordre où elles apparaissent dans le format choisi,
// chaque variable et sa valeur résolue — pour que le beatmaker comprenne
// concrètement ce que représente chaque partie du numéro, pas juste le
// résultat final collé.
function detailFormat(format: string, valeurs: { slug: string; num: string; jj: string; mm: string; aa: string }) {
  const resolues: Record<string, string> = {
    '{SLUG}': valeurs.slug, '{NUM}': valeurs.num, '{JJ}': valeurs.jj, '{MM}': valeurs.mm, '{AA}': valeurs.aa,
  }
  const trouvees = format.match(/\{SLUG\}|\{NUM\}|\{JJ\}|\{MM\}|\{AA\}/g) ?? []
  return trouvees.map(v => ({ variable: v, valeur: resolues[v], label: LABEL_VARIABLE[v] }))
}

export default function FacturationClient({
  slug,
  mandatVersion,
  mandatAccepteLe,
  formatPersonnalise,
  offset,
  anneeCourante,
  dernierNumero,
}: {
  slug: string
  mandatVersion: number | null
  mandatAccepteLe: string | null
  formatPersonnalise: string | null
  offset: number | null
  anneeCourante: number | null
  dernierNumero: number | null
}) {
  const router = useRouter()
  const mandatActif = !!mandatAccepteLe

  const [chargementMandat, setChargementMandat] = useState(false)
  const [erreurMandat, setErreurMandat] = useState('')

  const [formatSaisi, setFormatSaisi] = useState(formatPersonnalise ?? FORMAT_FACTURATION_PAR_DEFAUT)
  const [chargementFormat, setChargementFormat] = useState(false)
  const [erreurFormat, setErreurFormat] = useState('')
  const [sauvegardeOk, setSauvegardeOk] = useState(false)

  async function accepterMandat() {
    setChargementMandat(true)
    setErreurMandat('')
    try {
      const res = await fetch('/api/business/facturation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accepter_mandat' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setErreurMandat(data?.erreur || 'Impossible d’enregistrer le mandat de facturation.')
        return
      }
      router.refresh()
    } catch {
      setErreurMandat('Erreur réseau, réessaie.')
    } finally {
      setChargementMandat(false)
    }
  }

  async function sauvegarderFormat() {
    setChargementFormat(true)
    setErreurFormat('')
    setSauvegardeOk(false)
    try {
      const res = await fetch('/api/business/facturation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'definir_format', format: formatSaisi }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setErreurFormat(data?.erreur || 'Format invalide.')
        return
      }
      setSauvegardeOk(true)
      router.refresh()
    } catch {
      setErreurFormat('Erreur réseau, réessaie.')
    } finally {
      setChargementFormat(false)
    }
  }

  async function reinitialiserFormat() {
    setChargementFormat(true)
    setErreurFormat('')
    setSauvegardeOk(false)
    try {
      await fetch('/api/business/facturation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reinitialiser_format' }),
      })
      setFormatSaisi(FORMAT_FACTURATION_PAR_DEFAUT)
      router.refresh()
    } finally {
      setChargementFormat(false)
    }
  }

  const formatValide = formatFacturationValide(formatSaisi)
  const exempleDate = new Date()
  const exempleNum = dernierNumero != null ? dernierNumero + 1 : 5790
  const valeursApercu = {
    slug: slug || 'ta-boutique',
    num: String(exempleNum),
    jj: String(exempleDate.getDate()).padStart(2, '0'),
    mm: String(exempleDate.getMonth() + 1).padStart(2, '0'),
    aa: String(exempleDate.getFullYear()).slice(-2),
  }
  const apercu = formatValide ? formaterNumeroFacture(formatSaisi, {
    slug: valeursApercu.slug, num: exempleNum,
    jour: exempleDate.getDate(), mois: exempleDate.getMonth() + 1, annee: exempleDate.getFullYear(),
  }) : null
  const detail = formatValide ? detailFormat(formatSaisi, valeursApercu) : []

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Facturation</h1>
          <p className="text-gray-400 text-sm">Génération automatique de tes factures de vente.</p>
        </div>

        {/* Mandat de facturation */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-1">Mandat de facturation</h2>
          <p className="text-gray-400 text-sm mb-4 whitespace-pre-line">
            {texteMandatFacturation(mandatVersion ?? MANDAT_FACTURATION_VERSION_ACTUELLE)}
          </p>

          {mandatActif ? (
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-green-400 font-medium">Mandat accepté</span>
              {mandatAccepteLe && (
                <span className="text-gray-600 text-xs">
                  depuis le {new Date(mandatAccepteLe).toLocaleDateString('fr-FR')}
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={accepterMandat}
              disabled={chargementMandat}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
            >
              {chargementMandat ? 'Enregistrement...' : "J'accepte ce mandat"}
            </button>
          )}

          {erreurMandat && <p className="text-red-400 text-sm mt-3">{erreurMandat}</p>}

          {!mandatActif && (
            <p className="text-amber-400 text-xs mt-3">
              Tant que ce mandat n&apos;est pas accepté, aucune facture n&apos;est générée pour tes ventes.
            </p>
          )}
        </section>

        {/* Numérotation */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-1">Numérotation des factures</h2>
          <p className="text-gray-400 text-sm mb-4">
            Format par défaut : ordre naturel, conforme aux exemples que l&apos;administration fiscale autorise explicitement. Tu peux le personnaliser si tu préfères un autre ordre.
          </p>

          {/* Explication du point de départ (offset) */}
          <div className="bg-gray-800/40 border border-gray-800 rounded-lg p-4 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Point de départ de ta série {anneeCourante ?? new Date().getFullYear()}</p>
            {offset != null ? (
              <p className="text-sm text-gray-300">
                Ta première facture de l&apos;année a démarré à <span className="font-mono text-white">{offset}</span> plutôt qu&apos;à 1 — un nombre tiré une seule fois, au hasard, pour qu&apos;on ne puisse pas deviner ton nombre total de ventes depuis une seule facture. Ensuite, chaque nouvelle facture avance simplement de 1 en 1 ({offset} → {offset + 1} → {offset + 2}...) — c&apos;est ce qui rend la numérotation continue et conforme, comme l&apos;exige la loi. Un nouveau point de départ sera tiré au 1er janvier prochain.
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                Pas encore de facture émise cette année — un point de départ sera tiré au hasard automatiquement à ta toute première facture, puis chaque facture suivante avancera de 1 en 1 à partir de là.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 mb-4">
            <label className="text-xs font-medium text-gray-400">Variables disponibles</label>
            <div className="flex flex-wrap gap-2">
              {VARIABLES_FACTURATION.map(v => (
                <span key={v.variable} title={v.description} className="text-xs font-mono px-2 py-1 rounded bg-gray-800 text-gray-300 border border-gray-700">
                  {v.variable}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-3">
            <label className="text-xs font-medium text-gray-400">Format</label>
            <input
              value={formatSaisi}
              onChange={e => { setFormatSaisi(e.target.value); setSauvegardeOk(false) }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-white"
              spellCheck={false}
            />
          </div>

          {apercu ? (
            <div className="mb-4">
              <p className="text-sm text-gray-300 mb-2">
                Aperçu : <span className="font-mono text-white">{apercu}</span>
              </p>
              <div className="flex flex-col gap-1">
                {detail.map((d, i) => (
                  <p key={`${d.variable}-${i}`} className="text-xs text-gray-500">
                    <span className="font-mono text-gray-400">{d.variable}</span> = <span className="font-mono text-gray-300">{d.valeur}</span> — {d.label}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-red-400 mb-3">
              Format invalide — {'{NUM}'} doit apparaître exactement une fois, aucune autre variable dupliquée.
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={sauvegarderFormat}
              disabled={chargementFormat || !formatValide}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {chargementFormat ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            {formatPersonnalise && (
              <button
                onClick={reinitialiserFormat}
                disabled={chargementFormat}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                Revenir au modèle par défaut
              </button>
            )}
          </div>

          {sauvegardeOk && <p className="text-green-400 text-sm mt-3">Format enregistré.</p>}
          {erreurFormat && <p className="text-red-400 text-sm mt-3">{erreurFormat}</p>}
        </section>
      </div>
    </main>
  )
}
