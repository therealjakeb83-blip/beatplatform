'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MANDAT_FULFILLMENT_VERSION_ACTUELLE, texteMandatFulfillment } from '@/lib/fulfillment'
import { MOYENS_PAIEMENT_TOGGLABLES, normaliserMoyensPaiement, type MoyenPaiementNiveauA } from '@/lib/moyens-paiement'
import { validerStatementDescriptor } from '@/lib/statement-descriptor'
import { PAYS, nomPays, paiementsDisponiblesDans, MESSAGE_PAIEMENTS_INDISPONIBLES } from '@/lib/pays'
import { stripePromise } from '@/lib/stripe-client'
import Link from 'next/link'

const LABEL_MOYEN_PAIEMENT: Record<MoyenPaiementNiveauA, string> = {
  carte: 'Carte bancaire',
}

export default function PaiementsClient({
  stripeAccountId,
  mandatFulfillmentActif,
  mandatFulfillmentVersion,
  mandatFulfillmentAccepteLe,
  moyensPaiementAcceptes,
  statementDescriptor,
  pays: paysInitial,
  adresse,
}: {
  stripeAccountId: string | null
  mandatFulfillmentActif: boolean
  mandatFulfillmentVersion: number | null
  mandatFulfillmentAccepteLe: string | null
  moyensPaiementAcceptes: string[]
  statementDescriptor: string
  pays: string
  adresse: { ligne: string | null; codePostal: string | null; ville: string | null }
}) {
  const router = useRouter()
  const [chargementConnect, setChargementConnect] = useState(false)
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

  const [pays, setPays] = useState(paysInitial)
  const [erreurConnect, setErreurConnect] = useState('')

  async function changerPays(nouveau: string) {
    const precedent = pays
    setPays(nouveau)
    setErreurConnect('')
    const res = await fetch('/api/stripe/pays', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pays: nouveau }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setPays(precedent)
      setErreurConnect(data?.erreur || 'Impossible de changer le pays.')
    }
  }

  const [prenom, setPrenom] = useState('')
  const [nomLegal, setNomLegal] = useState('')
  const adresseComplete = !!(adresse.ligne && adresse.codePostal && adresse.ville)

  // Pré-remplissage par jeton de compte (lot 4, Q7c/Q7d) : prénom, nom et
  // adresse partent du navigateur directement chez Stripe (obligatoire pour
  // une plateforme française), la plateforme ne reçoit qu'un jeton opaque et
  // ne stocke jamais ces données d'identité. Facultatif : sans prénom/nom,
  // le compte est créé comme avant et tout se saisit chez Stripe.
  async function creerJetonCompte(): Promise<string | null> {
    if (!prenom.trim() || !nomLegal.trim()) return null
    try {
      const stripe = await stripePromise
      if (!stripe) return null
      const { token, error } = await stripe.createToken('account', {
        business_type: 'individual',
        individual: {
          first_name: prenom.trim(),
          last_name: nomLegal.trim(),
          ...(adresseComplete
            ? { address: { line1: adresse.ligne!, postal_code: adresse.codePostal!, city: adresse.ville!, country: pays } }
            : {}),
        },
      })
      if (error) console.warn('[paiements] Jeton de compte Stripe refusé :', error.message)
      return token?.id ?? null
    } catch (err) {
      console.warn('[paiements] Jeton de compte Stripe impossible :', err)
      return null
    }
  }

  async function connecterStripe() {
    setChargementConnect(true)
    setErreurConnect('')
    const accountToken = stripeAccountId ? null : await creerJetonCompte()
    const res = await fetch('/api/stripe/connect/creer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountToken ? { account_token: accountToken } : {}),
    })
    const data = await res.json().catch(() => ({}))
    if (data.url) window.location.href = data.url
    else {
      setErreurConnect(data.erreur || 'Impossible de contacter Stripe, réessaie.')
      setChargementConnect(false)
    }
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
            La carte bancaire est toujours acceptée. Apple Pay et Google Pay sont proposés automatiquement quand l&apos;appareil de l&apos;acheteur le permet, sans réglage à faire ici.
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

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-400 mb-1">Pays de ton activité</label>
            {stripeAccountId ? (
              <p className="text-sm text-gray-300">
                {nomPays(pays)} <span className="text-gray-600 text-xs">(fixé à la création du compte Stripe, non modifiable)</span>
              </p>
            ) : (
              <select
                value={pays}
                onChange={e => changerPays(e.target.value)}
                className="w-full max-w-xs px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
              >
                {PAYS.map(p => <option key={p.code} value={p.code}>{p.nom}</option>)}
              </select>
            )}
          </div>

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
            paiementsDisponiblesDans(pays) ? (
              <div className="flex flex-col gap-4">
              <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Gagne du temps chez Stripe (facultatif)</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ton prénom et ton nom légal sont envoyés directement à Stripe depuis ton navigateur pour pré-remplir ton inscription — ils ne sont jamais enregistrés sur notre plateforme.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={prenom}
                    onChange={e => setPrenom(e.target.value)}
                    placeholder="Prénom"
                    autoComplete="given-name"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                  <input
                    type="text"
                    value={nomLegal}
                    onChange={e => setNomLegal(e.target.value)}
                    placeholder="Nom"
                    autoComplete="family-name"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {adresseComplete
                    ? <>Adresse transmise aussi : <span className="text-gray-300">{adresse.ligne}, {adresse.codePostal} {adresse.ville}</span></>
                    : <>Ajoute ton adresse dans <Link href="/dashboard/legal" className="text-indigo-400 hover:underline">Pages légales</Link> pour qu&apos;elle soit pré-remplie aussi.</>}
                </p>
              </div>
              <button
                onClick={connecterStripe}
                disabled={chargementConnect}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
              >
                {chargementConnect ? 'Redirection...' : 'Connecter mon compte bancaire'}
              </button>
              </div>
            ) : (
              <p className="text-sm text-orange-400">{MESSAGE_PAIEMENTS_INDISPONIBLES}</p>
            )
          )}

          {erreurConnect && (
            <p className="text-red-400 text-sm mt-3">{erreurConnect}</p>
          )}
        </section>

      </div>
    </main>
  )
}
