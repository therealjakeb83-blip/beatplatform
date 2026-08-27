'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MANDAT_FULFILLMENT_VERSION_ACTUELLE, texteMandatFulfillment } from '@/lib/fulfillment'
import { MOYENS_PAIEMENT_TOGGLABLES, normaliserMoyensPaiement, type MoyenPaiementNiveauA } from '@/lib/moyens-paiement'
import { validerStatementDescriptor } from '@/lib/statement-descriptor'

const LABEL_MOYEN_PAIEMENT: Record<MoyenPaiementNiveauA, string> = {
  carte: 'Carte bancaire',
  paypal: 'PayPal',
}

type RapportDeblocage = {
  debloques: { beat: string; montant: number }[]
  echecs: { beat: string; erreur: string }[]
}

export default function PaiementsClient({
  stripeAccountId,
  tvaActive,
  tvaTaux,
  tvaNumero,
  fondsEnAttenteCount,
  fondsEnAttenteTotal,
  mandatFulfillmentActif,
  mandatFulfillmentVersion,
  mandatFulfillmentAccepteLe,
  moyensPaiementAcceptes,
  statementDescriptor,
}: {
  stripeAccountId: string | null
  tvaActive: boolean
  tvaTaux: number
  tvaNumero: string
  fondsEnAttenteCount: number
  fondsEnAttenteTotal: number
  mandatFulfillmentActif: boolean
  mandatFulfillmentVersion: number | null
  mandatFulfillmentAccepteLe: string | null
  moyensPaiementAcceptes: string[]
  statementDescriptor: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [chargementConnect, setChargementConnect] = useState(false)
  const [chargementDeblocage, setChargementDeblocage] = useState(false)
  const [erreurDeblocage, setErreurDeblocage] = useState('')
  const [rapportDeblocage, setRapportDeblocage] = useState<RapportDeblocage | null>(null)

  async function debloquerFonds() {
    setChargementDeblocage(true)
    setErreurDeblocage('')
    setRapportDeblocage(null)
    try {
      const res = await fetch('/api/stripe/splits/debloquer', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setErreurDeblocage(data?.erreur || 'Impossible de débloquer les fonds en attente.')
        return
      }
      setRapportDeblocage({ debloques: data.debloques ?? [], echecs: data.echecs ?? [] })
      router.refresh()
    } catch {
      setErreurDeblocage('Erreur lors du déblocage des paiements en attente.')
    } finally {
      setChargementDeblocage(false)
    }
  }

  // Déclenchement automatique au retour de l'onboarding Stripe Connect
  // (return_url avec ?connected=true) — même logique que le bouton manuel.
  useEffect(() => {
    if (searchParams.get('connected') === 'true' && stripeAccountId) {
      debloquerFonds()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [chargementMandat, setChargementMandat] = useState(false)
  const [erreurMandat, setErreurMandat] = useState('')

  async function agirSurMandat(action: 'accepter' | 'revoquer') {
    setChargementMandat(true)
    setErreurMandat('')
    try {
      const res = await fetch('/api/stripe/fulfillment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setErreurMandat(data?.erreur || 'Impossible de mettre à jour le mandat de livraison.')
        return
      }
      router.refresh()
    } catch {
      setErreurMandat('Erreur réseau, réessaie.')
    } finally {
      setChargementMandat(false)
    }
  }

  const [moyens, setMoyens] = useState<MoyenPaiementNiveauA[]>(normaliserMoyensPaiement(moyensPaiementAcceptes))
  const [chargementMoyens, setChargementMoyens] = useState(false)
  const [erreurMoyens, setErreurMoyens] = useState('')
  const [sauvegardeMoyensOk, setSauvegardeMoyensOk] = useState(false)

  function toggleMoyen(moyen: MoyenPaiementNiveauA) {
    setSauvegardeMoyensOk(false)
    setMoyens(prev => prev.includes(moyen) ? prev.filter(m => m !== moyen) : [...prev, moyen])
  }

  async function sauvegarderMoyens() {
    setChargementMoyens(true)
    setErreurMoyens('')
    setSauvegardeMoyensOk(false)
    try {
      const res = await fetch('/api/stripe/moyens-paiement', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moyens_paiement_acceptes: moyens }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setErreurMoyens(data?.erreur || 'Impossible de sauvegarder les moyens de paiement.')
        return
      }
      setSauvegardeMoyensOk(true)
      router.refresh()
    } catch {
      setErreurMoyens('Erreur réseau, réessaie.')
    } finally {
      setChargementMoyens(false)
    }
  }

  const [descripteur, setDescripteur] = useState(statementDescriptor)
  const [chargementDescripteur, setChargementDescripteur] = useState(false)
  const [erreurDescripteur, setErreurDescripteur] = useState('')
  const [sauvegardeDescripteurOk, setSauvegardeDescripteurOk] = useState(false)

  async function sauvegarderDescripteur() {
    setChargementDescripteur(true)
    setErreurDescripteur('')
    setSauvegardeDescripteurOk(false)
    const validation = validerStatementDescriptor(descripteur)
    if (!validation.ok) {
      setErreurDescripteur(validation.erreur)
      setChargementDescripteur(false)
      return
    }
    try {
      const res = await fetch('/api/stripe/statement-descriptor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement_descriptor: descripteur }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setErreurDescripteur(data?.erreur || "Impossible de sauvegarder l'identité sur le relevé.")
        return
      }
      setSauvegardeDescripteurOk(true)
      router.refresh()
    } catch {
      setErreurDescripteur('Erreur réseau, réessaie.')
    } finally {
      setChargementDescripteur(false)
    }
  }

  const [tvaActif, setTvaActif] = useState(tvaActive)
  const [taux, setTaux] = useState(String(tvaTaux || 20))
  const [numero, setNumero] = useState(tvaNumero || '')
  const [sauvegardeOk, setSauvegardeOk] = useState(false)
  const [erreurTva, setErreurTva] = useState('')
  const [chargementTva, setChargementTva] = useState(false)

  async function connecterStripe() {
    setChargementConnect(true)
    const res = await fetch('/api/stripe/connect/creer', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setChargementConnect(false)
  }

  async function sauvegarderTva() {
    setChargementTva(true)
    setSauvegardeOk(false)
    setErreurTva('')
    const res = await fetch('/api/stripe/tva', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tva_active: tvaActif, tva_taux: Number(taux), tva_numero: numero }),
    })
    setChargementTva(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setErreurTva(data?.erreur || 'Impossible de sauvegarder la TVA.')
      return
    }
    setSauvegardeOk(true)
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Paiements</h1>
          <p className="text-gray-400 text-sm">Connecte ton compte bancaire et configure ta TVA.</p>
        </div>

        {/* Mandat de fulfillment */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-1">Mode de livraison</h2>
          <p className="text-gray-400 text-sm mb-4 whitespace-pre-line">
            {texteMandatFulfillment(mandatFulfillmentVersion ?? MANDAT_FULFILLMENT_VERSION_ACTUELLE)}
          </p>

          {mandatFulfillmentActif ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-green-400 font-medium">Mandat actif</span>
                {mandatFulfillmentAccepteLe && (
                  <span className="text-gray-600 text-xs">
                    depuis le {new Date(mandatFulfillmentAccepteLe).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>
              <button
                onClick={() => agirSurMandat('revoquer')}
                disabled={chargementMandat}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium disabled:opacity-50 transition-colors w-fit"
              >
                {chargementMandat ? 'Mise à jour...' : 'Révoquer'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => agirSurMandat('accepter')}
              disabled={chargementMandat}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
            >
              {chargementMandat ? 'Enregistrement...' : "J'accepte ce mode de livraison"}
            </button>
          )}

          {erreurMandat && (
            <p className="text-red-400 text-sm mt-3">{erreurMandat}</p>
          )}
        </section>

        {/* Moyens de paiement */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-1">Moyens de paiement</h2>
          <p className="text-gray-400 text-sm mb-4">
            Choisis les moyens de paiement que tes acheteurs peuvent utiliser. La mise en œuvre technique (Apple Pay, Google Pay, sécurité des paiements) reste gérée automatiquement.
          </p>

          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-white text-xs">✓</div>
              <span className="text-sm text-gray-300">{LABEL_MOYEN_PAIEMENT.carte} <span className="text-gray-600 text-xs">(toujours activée)</span></span>
            </div>
            {MOYENS_PAIEMENT_TOGGLABLES.map(moyen => (
              <label key={moyen} className="flex items-center gap-3 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={moyens.includes(moyen)}
                  onChange={() => toggleMoyen(moyen)}
                  className="w-5 h-5 rounded bg-gray-800 border-gray-700 accent-indigo-600"
                />
                <span className="text-sm text-gray-300">{LABEL_MOYEN_PAIEMENT[moyen]}</span>
              </label>
            ))}
          </div>

          <button
            onClick={sauvegarderMoyens}
            disabled={chargementMoyens}
            className="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {chargementMoyens ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>

          {sauvegardeMoyensOk && (
            <p className="text-green-400 text-sm mt-2">Sauvegardé.</p>
          )}
          {erreurMoyens && (
            <p className="text-red-400 text-sm mt-2">{erreurMoyens}</p>
          )}
        </section>

        {/* Identité sur le relevé bancaire */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-1">Identité sur le relevé bancaire</h2>
          <p className="text-gray-400 text-sm mb-4">
            Le nom qui apparaît sur le relevé de carte bancaire de tes acheteurs. Entre 5 et 22 caractères, au moins une lettre.
          </p>

          <div className="flex flex-col gap-2 mb-4">
            <input
              type="text"
              value={descripteur}
              onChange={e => { setDescripteur(e.target.value); setSauvegardeDescripteurOk(false) }}
              maxLength={22}
              placeholder="MON BEATMAKER"
              className="w-full max-w-xs px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-gray-500 text-xs">
              Aperçu relevé : <span className="text-gray-300 font-mono">{(descripteur.trim() || 'MON BEATMAKER').toUpperCase()}</span>
            </p>
          </div>

          <button
            onClick={sauvegarderDescripteur}
            disabled={chargementDescripteur}
            className="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {chargementDescripteur ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>

          {sauvegardeDescripteurOk && (
            <p className="text-green-400 text-sm mt-2">Sauvegardé.</p>
          )}
          {erreurDescripteur && (
            <p className="text-red-400 text-sm mt-2">{erreurDescripteur}</p>
          )}
        </section>

        {/* Stripe Connect */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-1">Compte Stripe Connect</h2>
          <p className="text-gray-400 text-sm mb-4">
            Lie ton compte bancaire pour recevoir les paiements de tes acheteurs.
          </p>

          {stripeAccountId ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-green-400 font-medium">Compte connecté</span>
                <span className="text-gray-600 text-xs">{stripeAccountId}</span>
              </div>
              <button
                onClick={connecterStripe}
                disabled={chargementConnect}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium disabled:opacity-50 transition-colors w-fit"
              >
                {chargementConnect ? 'Redirection...' : 'Compléter / mettre à jour la configuration Stripe'}
              </button>
            </div>
          ) : (
            <button
              onClick={connecterStripe}
              disabled={chargementConnect}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
            >
              {chargementConnect ? 'Redirection...' : 'Connecter mon compte bancaire'}
            </button>
          )}
        </section>

        {/* Fonds en attente (splits collab) */}
        {(fondsEnAttenteCount > 0 || rapportDeblocage) && (
          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-1">Fonds en attente</h2>
            <p className="text-gray-400 text-sm mb-4">
              Paiements de collaborations pas encore transférés sur ton compte bancaire.
            </p>

            {fondsEnAttenteCount > 0 && (
              <p className="text-sm text-gray-300 mb-4">
                <span className="text-white font-semibold">{fondsEnAttenteTotal.toFixed(2)}€</span> en attente sur {fondsEnAttenteCount} paiement{fondsEnAttenteCount > 1 ? 's' : ''}.
              </p>
            )}

            <button
              onClick={debloquerFonds}
              disabled={chargementDeblocage || !stripeAccountId}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {chargementDeblocage ? 'Déblocage...' : 'Débloquer mes fonds en attente'}
            </button>
            {!stripeAccountId && (
              <p className="text-gray-500 text-xs mt-2">Connecte d&apos;abord ton compte Stripe ci-dessus.</p>
            )}

            {erreurDeblocage && (
              <p className="text-red-400 text-sm mt-3">{erreurDeblocage}</p>
            )}

            {rapportDeblocage && (
              <div className="mt-4 flex flex-col gap-2">
                {rapportDeblocage.debloques.length > 0 && (
                  <div className="text-sm">
                    <p className="text-green-400 font-medium mb-1">{rapportDeblocage.debloques.length} paiement{rapportDeblocage.debloques.length > 1 ? 's' : ''} débloqué{rapportDeblocage.debloques.length > 1 ? 's' : ''} :</p>
                    <ul className="text-gray-300 text-xs flex flex-col gap-0.5">
                      {rapportDeblocage.debloques.map((d, i) => (
                        <li key={i}>• {d.beat} — {d.montant.toFixed(2)}€</li>
                      ))}
                    </ul>
                  </div>
                )}
                {rapportDeblocage.echecs.length > 0 && (
                  <div className="text-sm">
                    <p className="text-orange-400 font-medium mb-1">{rapportDeblocage.echecs.length} échec{rapportDeblocage.echecs.length > 1 ? 's' : ''} :</p>
                    <ul className="text-gray-300 text-xs flex flex-col gap-0.5">
                      {rapportDeblocage.echecs.map((e, i) => (
                        <li key={i}>• {e.beat} — {e.erreur}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {rapportDeblocage.debloques.length === 0 && rapportDeblocage.echecs.length === 0 && (
                  <p className="text-gray-500 text-sm">Rien à débloquer pour l&apos;instant.</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* TVA */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-1">TVA</h2>
          <p className="text-gray-400 text-sm mb-4">
            Active uniquement si tu es assujetti à la TVA. Elle sera ajoutée au prix affiché.
          </p>

          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setTvaActif(!tvaActif)}
              className={`relative w-12 h-6 rounded-full transition-colors ${tvaActif ? 'bg-indigo-600' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${tvaActif ? 'left-7' : 'left-1'}`} />
            </button>
            <span className="text-sm text-gray-300">
              {tvaActif ? 'TVA activée' : 'TVA désactivée'}
            </span>
          </div>

          {tvaActif && (
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Taux de TVA (%)</label>
                <input
                  type="number"
                  value={taux}
                  onChange={e => setTaux(e.target.value)}
                  min="0"
                  max="100"
                  className="w-32 px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Numéro de TVA intracommunautaire</label>
                <input
                  type="text"
                  value={numero}
                  onChange={e => setNumero(e.target.value)}
                  placeholder="FR12345678901"
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <button
            onClick={sauvegarderTva}
            disabled={chargementTva}
            className="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {chargementTva ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>

          {sauvegardeOk && (
            <p className="text-green-400 text-sm mt-2">Sauvegardé.</p>
          )}
          {erreurTva && (
            <p className="text-red-400 text-sm mt-2">{erreurTva}</p>
          )}
        </section>
      </div>
    </main>
  )
}
