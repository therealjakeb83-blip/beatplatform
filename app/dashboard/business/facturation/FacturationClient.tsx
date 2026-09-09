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
  '{NUM}': 'Point de départ + compteur de cette année',
  '{JJ}': "Jour d'émission",
  '{MM}': "Mois d'émission",
  '{AA}': "Année d'émission",
}

function detailFormat(
  format: string,
  valeurs: { slug: string; num: string; jj: string; mm: string; aa: string },
  detailNum: { offset: number; compteurEmis: number } | null,
) {
  const resolues: Record<string, string> = {
    '{SLUG}': valeurs.slug, '{NUM}': valeurs.num, '{JJ}': valeurs.jj, '{MM}': valeurs.mm, '{AA}': valeurs.aa,
  }
  const labelNum = detailNum
    ? `Point de départ ${detailNum.offset} + compteur de cette année ${detailNum.compteurEmis}`
    : LABEL_VARIABLE['{NUM}']
  const labels: Record<string, string> = { ...LABEL_VARIABLE, '{NUM}': labelNum }
  const trouvees = format.match(/\{SLUG\}|\{NUM\}|\{JJ\}|\{MM\}|\{AA\}/g) ?? []
  return trouvees.map(v => ({ variable: v, valeur: resolues[v], label: labels[v] }))
}

const AVERTISSEMENT_FORMAT = "Tu as déjà émis au moins une facture cette année. Changer de format maintenant fera cohabiter deux formats différents dans ton historique de factures de l'année — assure-toi que c'est justifiable en cas de contrôle. Confirmer le changement ?"

export default function FacturationClient({
  slug,
  mandatVersion,
  mandatAccepteLe,
  formatPersonnalise,
  offset,
  anneeCourante,
  dernierNumero,
  serieDemarree,
  offsetMode,
  offsetManuel,
}: {
  slug: string
  mandatVersion: number | null
  mandatAccepteLe: string | null
  formatPersonnalise: string | null
  offset: number | null
  anneeCourante: number
  dernierNumero: number | null
  serieDemarree: boolean
  offsetMode: 'aleatoire' | 'manuel'
  offsetManuel: number | null
}) {
  const router = useRouter()
  const mandatActif = !!mandatAccepteLe

  const [chargementMandat, setChargementMandat] = useState(false)
  const [erreurMandat, setErreurMandat] = useState('')

  const [formatSaisi, setFormatSaisi] = useState(formatPersonnalise ?? FORMAT_FACTURATION_PAR_DEFAUT)
  const [chargementFormat, setChargementFormat] = useState(false)
  const [erreurFormat, setErreurFormat] = useState('')
  const [sauvegardeOk, setSauvegardeOk] = useState(false)

  const [modeSaisi, setModeSaisi] = useState<'aleatoire' | 'manuel'>(offsetMode)
  const [manuelSaisi, setManuelSaisi] = useState(offsetManuel ? String(offsetManuel) : '1')
  const [chargementOffset, setChargementOffset] = useState(false)
  const [erreurOffset, setErreurOffset] = useState('')
  const [offsetSauvegardeOk, setOffsetSauvegardeOk] = useState(false)

  // router.refresh() ne démonte jamais ce composant client — sans ça, l'état
  // local resterait bloqué sur la dernière saisie de l'utilisateur après un
  // enregistrement, donnant l'impression trompeuse que rien n'a été vraiment
  // sauvegardé (bug réel remonté par Jake). Resynchronisation pendant le
  // rendu (pattern React recommandé, pas un useEffect) dès que le serveur
  // renvoie des props différentes des dernières connues.
  const [propsPrecedentes, setPropsPrecedentes] = useState({ formatPersonnalise, offsetMode, offsetManuel })
  if (
    propsPrecedentes.formatPersonnalise !== formatPersonnalise ||
    propsPrecedentes.offsetMode !== offsetMode ||
    propsPrecedentes.offsetManuel !== offsetManuel
  ) {
    setPropsPrecedentes({ formatPersonnalise, offsetMode, offsetManuel })
    setFormatSaisi(formatPersonnalise ?? FORMAT_FACTURATION_PAR_DEFAUT)
    setModeSaisi(offsetMode)
    setManuelSaisi(offsetManuel ? String(offsetManuel) : '1')
  }

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

  async function envoyerFormat(action: 'definir_format' | 'reinitialiser_format', format?: string) {
    setChargementFormat(true)
    setErreurFormat('')
    setSauvegardeOk(false)
    try {
      const res = await fetch('/api/business/facturation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, format }),
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

  function sauvegarderFormat() {
    if (serieDemarree && !window.confirm(AVERTISSEMENT_FORMAT)) return
    envoyerFormat('definir_format', formatSaisi)
  }

  function reinitialiserFormat() {
    if (serieDemarree && !window.confirm(AVERTISSEMENT_FORMAT)) return
    setFormatSaisi(FORMAT_FACTURATION_PAR_DEFAUT)
    envoyerFormat('reinitialiser_format')
  }

  const [valeurGeneree, setValeurGeneree] = useState<number | null>(null)

  async function sauvegarderOffset() {
    setChargementOffset(true)
    setErreurOffset('')
    setOffsetSauvegardeOk(false)
    try {
      const manuel = modeSaisi === 'manuel' ? parseInt(manuelSaisi, 10) : undefined
      const res = await fetch('/api/business/facturation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'definir_offset', offsetMode: modeSaisi, offsetManuel: manuel }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setErreurOffset(data?.erreur || 'Impossible d’enregistrer ce réglage.')
        return
      }
      setOffsetSauvegardeOk(true)
      // Le mode aléatoire est désormais tiré immédiatement au clic (pas à
      // la 1ère facture) — l'API renvoie la valeur tirée pour l'afficher
      // tout de suite, sans attendre le prochain rendu serveur.
      if (typeof data?.valeur === 'number') setValeurGeneree(data.valeur)
      router.refresh()
    } catch {
      setErreurOffset('Erreur réseau, réessaie.')
    } finally {
      setChargementOffset(false)
    }
  }

  const formatValide = formatFacturationValide(formatSaisi)
  const exempleDate = new Date()
  // Année à laquelle s'applique le réglage éditable : l'année en cours si
  // sa série n'a pas encore démarré, sinon l'année suivante (le réglage ne
  // peut plus jamais rattraper une série déjà en cours — voir la colonne
  // facturation_offset, séparée et jamais relue une fois l'année démarrée).
  const anneeCible = serieDemarree ? anneeCourante + 1 : anneeCourante
  // Un point de départ est "connu" quand la série a démarré (compteur réel
  // en base), ou en mode manuel (toujours déterministe, même avant
  // sauvegarde), ou en mode aléatoire déjà tiré et pas encore changé de
  // sélection depuis (offsetManuel enregistré correspond au mode courant).
  // Sinon (aléatoire jamais encore tiré), rien à montrer de précis — le
  // prochain tirage n'est pas prévisible avant qu'il ait eu lieu.
  const offsetDejaCommis = !serieDemarree && modeSaisi === 'aleatoire' && offsetMode === 'aleatoire' && offsetManuel != null
    ? offsetManuel
    : null
  const detailNum = serieDemarree
    ? { offset: offset ?? 0, compteurEmis: (dernierNumero ?? 0) - (offset ?? 0) + 1 }
    : modeSaisi === 'manuel'
      ? { offset: parseInt(manuelSaisi, 10) || 1, compteurEmis: 0 }
      : offsetDejaCommis != null
        ? { offset: offsetDejaCommis, compteurEmis: 0 }
        : null
  const numEstIllustratif = !serieDemarree && detailNum === null
  const exempleNum = serieDemarree
    ? (dernierNumero ?? 0) + 1
    : detailNum
      ? detailNum.offset
      : 5790 // aléatoire, jamais encore tiré — illustratif seulement (voir numEstIllustratif)
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
  const detail = formatValide ? detailFormat(formatSaisi, valeursApercu, detailNum) : []

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

        {/* Point de départ (offset) */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-1">Point de départ</h2>
          <p className="text-gray-400 text-sm mb-4">
            Ta série de factures démarre chaque année à un nombre de départ plutôt qu&apos;à 1 — le compteur avance ensuite normalement de 1 en 1 à partir de là (continuité garantie par le système, jamais recalculée). Ça évite qu&apos;une seule facture révèle ton nombre total de ventes depuis le début de l&apos;année.
          </p>

          {serieDemarree && (
            <div className="bg-gray-800/40 border border-gray-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-300">
                Cette année ({anneeCourante}) : déjà fixé à <span className="font-mono text-white">{offset}</span> ({offsetMode === 'manuel' ? 'choisi par toi' : 'tiré au hasard'}), depuis ta première facture — ne peut plus changer.
              </p>
            </div>
          )}

          <p className="text-xs font-medium text-gray-400 mb-2">
            Pour {anneeCible} {serieDemarree && <span className="text-gray-600">— modifiable dès maintenant, prend effet au 1er janvier {anneeCible}, jamais besoin d&apos;attendre le jour même</span>}
          </p>
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" checked={modeSaisi === 'aleatoire'} onChange={() => setModeSaisi('aleatoire')} className="accent-indigo-600 mt-0.5" />
              <span>
                <span className="text-sm text-gray-300 block">Aléatoire <span className="text-gray-600 text-xs">(recommandé)</span></span>
                <span className="text-gray-600 text-xs">Un nouveau nombre est tiré chaque année — le point de départ change à chaque 1er janvier.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" checked={modeSaisi === 'manuel'} onChange={() => setModeSaisi('manuel')} className="accent-indigo-600 mt-0.5" />
              <span>
                <span className="text-sm text-gray-300 block">Je choisis mon point de départ</span>
                <span className="text-gray-600 text-xs">Le même nombre est réutilisé chaque année, sans que tu aies à le reconfigurer — modifiable à tout moment.</span>
              </span>
            </label>
            {modeSaisi === 'manuel' && (
              <input
                type="number"
                min={1}
                value={manuelSaisi}
                onChange={e => setManuelSaisi(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-white w-40"
              />
            )}
            <button
              onClick={sauvegarderOffset}
              disabled={chargementOffset}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors w-fit"
            >
              {chargementOffset ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            {offsetSauvegardeOk && (
              <p className="text-green-400 text-sm">
                {modeSaisi === 'aleatoire' && valeurGeneree != null
                  ? `Point de départ tiré au hasard : ${valeurGeneree} — sera utilisé à ta prochaine facture de ${anneeCible}. Réenregistre pour en tirer un autre.`
                  : `Réglage enregistré — appliqué à ta prochaine facture de ${anneeCible}.`}
              </p>
            )}
            {!offsetSauvegardeOk && offsetDejaCommis != null && (
              <p className="text-gray-500 text-xs">
                Déjà fixé pour {anneeCible} : <span className="font-mono text-gray-300">{offsetDejaCommis}</span> (tiré au hasard) — sera utilisé à ta prochaine facture, sauf si tu réenregistres.
              </p>
            )}
            {erreurOffset && <p className="text-red-400 text-sm">{erreurOffset}</p>}
          </div>
        </section>

        {/* Numérotation */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-1">Numérotation des factures</h2>
          <p className="text-gray-400 text-sm mb-4">
            Format par défaut : ordre naturel, conforme aux exemples que l&apos;administration fiscale autorise explicitement. Tu peux le personnaliser si tu préfères un autre ordre.
          </p>

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
                {numEstIllustratif && <span className="text-gray-600 text-xs ml-2">(nombre d&apos;exemple — le vrai point de départ sera tiré au hasard à ta 1ère facture)</span>}
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

          {serieDemarree && (
            <p className="text-amber-400 text-xs mb-3">
              Tu as déjà émis des factures cette année — un changement de format ici te sera redemandé en confirmation.
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
