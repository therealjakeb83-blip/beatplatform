'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { TypeTemplateTransactionnel } from '@/lib/emails'

type Props = {
  nomArtiste: string
  logoUrl: string | null
  signatureEmails: string | null
  couleurMarque: string | null
  intros: Record<TypeTemplateTransactionnel, string>
  sauvegarderCouleurMarque: (couleur: string) => Promise<{ erreur?: string }>
  sauvegarderIntro: (type: TypeTemplateTransactionnel, intro: string) => Promise<{ erreur?: string }>
  genererApercu: (type: TypeTemplateTransactionnel, introDraft: string, couleurDraft?: string) => Promise<string>
}

const COULEUR_DEFAUT = '#4f46e5'
const DEBOUNCE_MS = 400

const CARTES: { type: TypeTemplateTransactionnel; titre: string; description: string; declencheur: string }[] = [
  {
    type: 'confirmation_commande',
    titre: 'Confirmation de commande',
    description: 'Envoyé automatiquement juste après un achat de licence.',
    declencheur: "Déclencheur : paiement d'une commande confirmé",
  },
  {
    type: 'confirmation_abonnement',
    titre: "Confirmation d'abonnement",
    description: 'Envoyé automatiquement à la création d\'un nouvel abonnement.',
    declencheur: 'Déclencheur : nouvel abonnement créé',
  },
  {
    type: 'demande_annulation_abonnement',
    titre: "Demande d'annulation",
    description: "Envoyé immédiatement quand le client annule — confirme la prise en compte et la date de fin d'accès.",
    declencheur: 'Déclencheur : décision d\'annuler (accès encore actif jusqu\'à la fin de la période payée)',
  },
  {
    type: 'annulation_abonnement',
    titre: "Fin d'abonnement",
    description: "Envoyé uniquement quand un abonnement se termine sans demande préalable (ex. abonnement impayé résilié directement).",
    declencheur: 'Déclencheur : fin réelle de période sans demande préalable',
  },
]

export default function TransactionnelsClient({
  nomArtiste,
  logoUrl,
  signatureEmails,
  couleurMarque,
  intros,
  sauvegarderCouleurMarque,
  sauvegarderIntro,
  genererApercu,
}: Props) {
  const [typeActif, setTypeActif] = useState<TypeTemplateTransactionnel>('confirmation_commande')
  const [couleur, setCouleur] = useState(couleurMarque ?? COULEUR_DEFAUT)
  const [introsDraft, setIntrosDraft] = useState(intros)
  const [apercuHtml, setApercuHtml] = useState('')
  const [chargementApercu, setChargementApercu] = useState(true)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Aperçu live : régénéré automatiquement (avec un léger délai anti-rafale)
  // à chaque changement de couleur, d'intro ou de type sélectionné — pas
  // besoin de bouton "Aperçu" ni d'enregistrer avant de voir le résultat.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setChargementApercu(true)
    debounceRef.current = setTimeout(async () => {
      const html = await genererApercu(typeActif, introsDraft[typeActif], couleur)
      setApercuHtml(html)
      setChargementApercu(false)
    }, DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeActif, introsDraft[typeActif], couleur])

  const carteActive = CARTES.find(c => c.type === typeActif)!

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Mailing — Transactionnels</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Emails de confirmation envoyés automatiquement après un achat ou un abonnement — jamais de ciblage, jamais désactivables.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Colonne réglages */}
          <div className="space-y-4">
            <CarteBranding
              nomArtiste={nomArtiste}
              logoUrl={logoUrl}
              signatureEmails={signatureEmails}
              couleur={couleur}
              onChangeCouleur={setCouleur}
              sauvegarderCouleurMarque={sauvegarderCouleurMarque}
            />

            <div className="flex flex-wrap gap-2">
              {CARTES.map(carte => (
                <button
                  key={carte.type}
                  onClick={() => setTypeActif(carte.type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    typeActif === carte.type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                  }`}
                >
                  {carte.titre}
                </button>
              ))}
            </div>

            <CarteTemplate
              key={carteActive.type}
              carte={carteActive}
              intro={introsDraft[carteActive.type]}
              onChangeIntro={valeur => setIntrosDraft(prev => ({ ...prev, [carteActive.type]: valeur }))}
              sauvegarderIntro={sauvegarderIntro}
            />
          </div>

          {/* Colonne aperçu live */}
          <div className="lg:sticky lg:top-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
                <p className="text-sm font-bold text-white">Aperçu en direct</p>
                {chargementApercu && <span className="text-[11px] text-gray-500">Mise à jour…</span>}
              </div>
              <div className="bg-gray-950 flex justify-center py-6 px-4 min-h-[70vh]">
                {apercuHtml ? (
                  <iframe
                    srcDoc={apercuHtml}
                    title="Aperçu de l'email"
                    className="bg-white rounded-lg transition-opacity"
                    style={{ width: '100%', maxWidth: 600, height: '70vh', opacity: chargementApercu ? 0.5 : 1 }}
                  />
                ) : (
                  <p className="text-xs text-gray-500 self-center">Génération…</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CarteBranding({
  nomArtiste,
  logoUrl,
  signatureEmails,
  couleur,
  onChangeCouleur,
  sauvegarderCouleurMarque,
}: {
  nomArtiste: string
  logoUrl: string | null
  signatureEmails: string | null
  couleur: string
  onChangeCouleur: (couleur: string) => void
  sauvegarderCouleurMarque: (couleur: string) => Promise<{ erreur?: string }>
}) {
  const [enregistrement, setEnregistrement] = useState(false)
  const [enregistre, setEnregistre] = useState(false)
  const [erreur, setErreur] = useState('')

  async function handleSauvegarder() {
    setEnregistrement(true)
    setErreur('')
    setEnregistre(false)
    const { erreur: err } = await sauvegarderCouleurMarque(couleur)
    setEnregistrement(false)
    if (err) setErreur(err)
    else {
      setEnregistre(true)
      setTimeout(() => setEnregistre(false), 2000)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-4">
      <p className="text-sm font-semibold text-white">Branding — partagé par les 4 emails</p>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-400 mb-1">Couleur de marque</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(couleur) ? couleur : COULEUR_DEFAUT}
              onChange={e => onChangeCouleur(e.target.value)}
              className="w-10 h-10 rounded-lg bg-gray-950 border border-gray-800 cursor-pointer"
            />
            <input
              type="text"
              value={couleur}
              onChange={e => onChangeCouleur(e.target.value)}
              placeholder={COULEUR_DEFAUT}
              className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Utilisée pour l&apos;en-tête et le bouton des emails — vide = indigo par défaut. L&apos;aperçu à droite se met à jour automatiquement.</p>
        </div>
        <button
          onClick={handleSauvegarder}
          disabled={enregistrement}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {enregistrement ? 'Enregistrement…' : enregistre ? 'Enregistré ✓' : 'Enregistrer'}
        </button>
      </div>
      {erreur && <p className="text-xs text-red-400">{erreur}</p>}

      <p className="text-xs text-gray-500 pt-3 border-t border-gray-800">
        Logo ({logoUrl ? 'configuré' : 'non configuré'}) : modifiable sur{' '}
        <Link href="/dashboard/profil" className="text-indigo-400 hover:underline">ton profil</Link>.{' '}
        Signature ({signatureEmails || nomArtiste}) : modifiable sur{' '}
        <Link href="/dashboard/business/marketing/automatisations" className="text-indigo-400 hover:underline">Automatisations</Link>.
      </p>
    </div>
  )
}

function CarteTemplate({
  carte,
  intro,
  onChangeIntro,
  sauvegarderIntro,
}: {
  carte: { type: TypeTemplateTransactionnel; titre: string; description: string; declencheur: string }
  intro: string
  onChangeIntro: (intro: string) => void
  sauvegarderIntro: (type: TypeTemplateTransactionnel, intro: string) => Promise<{ erreur?: string }>
}) {
  const [enregistrement, setEnregistrement] = useState(false)
  const [enregistre, setEnregistre] = useState(false)
  const [erreur, setErreur] = useState('')

  async function handleSauvegarder() {
    setEnregistrement(true)
    setErreur('')
    setEnregistre(false)
    const { erreur: err } = await sauvegarderIntro(carte.type, intro)
    setEnregistrement(false)
    if (err) setErreur(err)
    else {
      setEnregistre(true)
      setTimeout(() => setEnregistre(false), 2000)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">{carte.titre}</p>
        <p className="text-xs text-gray-500 mt-0.5">{carte.description}</p>
        <p className="text-[11px] text-gray-600 mt-1">{carte.declencheur}</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Texte d&apos;intro personnalisé</label>
        <textarea
          value={intro}
          onChange={e => onChangeIntro(e.target.value)}
          rows={3}
          placeholder="Laisse vide pour utiliser le texte par défaut de My Producer"
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">L&apos;aperçu à droite se met à jour automatiquement pendant que tu écris.</p>
      </div>

      {erreur && <p className="text-xs text-red-400">{erreur}</p>}

      <button
        onClick={handleSauvegarder}
        disabled={enregistrement}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-50"
      >
        {enregistrement ? 'Enregistrement…' : enregistre ? 'Enregistré ✓' : 'Enregistrer'}
      </button>
    </div>
  )
}
