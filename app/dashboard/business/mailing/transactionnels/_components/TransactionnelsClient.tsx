'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { TypeTemplateTransactionnel } from '@/lib/emails'

type Props = {
  nomArtiste: string
  logoUrl: string | null
  couleurMarque: string | null
  signatureTransactionnels: string | null
  footerMessageReseaux: string | null
  intros: Record<TypeTemplateTransactionnel, string>
  sauvegarderCouleurMarque: (couleur: string) => Promise<{ erreur?: string }>
  sauvegarderSignatureTransactionnels: (signature: string) => Promise<{ erreur?: string }>
  sauvegarderFooterMessage: (message: string) => Promise<{ erreur?: string }>
  sauvegarderIntro: (type: TypeTemplateTransactionnel, intro: string) => Promise<{ erreur?: string }>
  genererApercu: (type: TypeTemplateTransactionnel, introDraft: string, couleurDraft?: string, signatureDraft?: string, footerMessageDraft?: string) => Promise<string>
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
  couleurMarque,
  signatureTransactionnels,
  footerMessageReseaux,
  intros,
  sauvegarderCouleurMarque,
  sauvegarderSignatureTransactionnels,
  sauvegarderFooterMessage,
  sauvegarderIntro,
  genererApercu,
}: Props) {
  const [typeActif, setTypeActif] = useState<TypeTemplateTransactionnel>('confirmation_commande')
  const [couleur, setCouleur] = useState(couleurMarque ?? COULEUR_DEFAUT)
  const [signature, setSignature] = useState(signatureTransactionnels ?? '')
  const [footerMessage, setFooterMessage] = useState(footerMessageReseaux ?? '')
  const [introsDraft, setIntrosDraft] = useState(intros)
  const [apercuHtml, setApercuHtml] = useState('')
  const [chargementApercu, setChargementApercu] = useState(true)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Aperçu live : régénéré automatiquement (avec un léger délai anti-rafale)
  // à chaque changement de couleur, signature, phrase du footer, intro ou
  // type sélectionné — pas besoin de bouton "Aperçu" ni d'enregistrer avant
  // de voir le résultat.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setChargementApercu(true)
    debounceRef.current = setTimeout(async () => {
      const html = await genererApercu(typeActif, introsDraft[typeActif], couleur, signature, footerMessage)
      setApercuHtml(html)
      setChargementApercu(false)
    }, DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeActif, introsDraft[typeActif], couleur, signature, footerMessage])

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
              logoUrl={logoUrl}
              couleur={couleur}
              onChangeCouleur={setCouleur}
              sauvegarderCouleurMarque={sauvegarderCouleurMarque}
              signature={signature}
              onChangeSignature={setSignature}
              nomArtiste={nomArtiste}
              sauvegarderSignatureTransactionnels={sauvegarderSignatureTransactionnels}
            />

            <CarteFooterReseaux
              footerMessage={footerMessage}
              onChangeFooterMessage={setFooterMessage}
              sauvegarderFooterMessage={sauvegarderFooterMessage}
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

function ChampAvecEnregistrer({
  label,
  aide,
  valeur,
  onChange,
  placeholder,
  onSauvegarder,
}: {
  label: string
  aide: string
  valeur: string
  onChange: (v: string) => void
  placeholder?: string
  onSauvegarder: (v: string) => Promise<{ erreur?: string }>
}) {
  const [enregistrement, setEnregistrement] = useState(false)
  const [enregistre, setEnregistre] = useState(false)
  const [erreur, setErreur] = useState('')

  async function handleSauvegarder() {
    setEnregistrement(true)
    setErreur('')
    setEnregistre(false)
    const { erreur: err } = await onSauvegarder(valeur)
    setEnregistrement(false)
    if (err) setErreur(err)
    else {
      setEnregistre(true)
      setTimeout(() => setEnregistre(false), 2000)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
        <input
          type="text"
          value={valeur}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        <p className="text-xs text-gray-500 mt-1">{aide}</p>
        {erreur && <p className="text-xs text-red-400 mt-1">{erreur}</p>}
      </div>
      <button
        onClick={handleSauvegarder}
        disabled={enregistrement}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {enregistrement ? 'Enregistrement…' : enregistre ? 'Enregistré ✓' : 'Enregistrer'}
      </button>
    </div>
  )
}

function CarteBranding({
  logoUrl,
  couleur,
  onChangeCouleur,
  sauvegarderCouleurMarque,
  signature,
  onChangeSignature,
  nomArtiste,
  sauvegarderSignatureTransactionnels,
}: {
  logoUrl: string | null
  couleur: string
  onChangeCouleur: (couleur: string) => void
  sauvegarderCouleurMarque: (couleur: string) => Promise<{ erreur?: string }>
  signature: string
  onChangeSignature: (signature: string) => void
  nomArtiste: string
  sauvegarderSignatureTransactionnels: (signature: string) => Promise<{ erreur?: string }>
}) {
  const [enregistrement, setEnregistrement] = useState(false)
  const [enregistre, setEnregistre] = useState(false)
  const [erreur, setErreur] = useState('')

  async function handleSauvegarderCouleur() {
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
          <p className="text-xs text-gray-500 mt-1">Utilisée pour l&apos;en-tête et le bouton des emails — vide = indigo par défaut.</p>
        </div>
        <button
          onClick={handleSauvegarderCouleur}
          disabled={enregistrement}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {enregistrement ? 'Enregistrement…' : enregistre ? 'Enregistré ✓' : 'Enregistrer'}
        </button>
      </div>
      {erreur && <p className="text-xs text-red-400">{erreur}</p>}

      <div className="pt-3 border-t border-gray-800">
        <ChampAvecEnregistrer
          label="Signature de fin d'email"
          aide={`Propre aux emails transactionnels — vide = ton nom d'artiste (${nomArtiste}). La signature des Automatisations reste séparée, modifiable sur Automatisations.`}
          valeur={signature}
          onChange={onChangeSignature}
          placeholder={nomArtiste}
          onSauvegarder={sauvegarderSignatureTransactionnels}
        />
      </div>

      <p className="text-xs text-gray-500 pt-3 border-t border-gray-800">
        Logo ({logoUrl ? 'configuré' : 'non configuré'}) : modifiable sur{' '}
        <Link href="/dashboard/profil" className="text-indigo-400 hover:underline">ton profil</Link>.
      </p>
    </div>
  )
}

function CarteFooterReseaux({
  footerMessage,
  onChangeFooterMessage,
  sauvegarderFooterMessage,
}: {
  footerMessage: string
  onChangeFooterMessage: (message: string) => void
  sauvegarderFooterMessage: (message: string) => Promise<{ erreur?: string }>
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">Footer réseaux sociaux</p>
        <p className="text-xs text-gray-500 mt-0.5">Affiché en bas de chaque email si au moins un réseau est renseigné sur ton profil.</p>
      </div>
      <ChampAvecEnregistrer
        label="Phrase sous « Suis-moi sur les réseaux sociaux »"
        aide="Laisse vide pour utiliser le texte par défaut."
        valeur={footerMessage}
        onChange={onChangeFooterMessage}
        placeholder="Rejoins-moi sur mes réseaux pour rester à jour et me contacter facilement !"
        onSauvegarder={sauvegarderFooterMessage}
      />
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
