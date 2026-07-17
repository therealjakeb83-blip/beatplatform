'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { TypeTemplateTransactionnel } from '@/lib/emails'

type Template = { titre: string; intro: string }

type Props = {
  nomArtiste: string
  logoUrl: string | null
  couleurMarque: string | null
  signatureTransactionnels: string | null
  footerMessageReseaux: string | null
  titreFooterReseaux: string | null
  templates: Record<TypeTemplateTransactionnel, Template>
  sauvegarderCouleurMarque: (couleur: string) => Promise<{ erreur?: string }>
  sauvegarderSignatureTransactionnels: (signature: string) => Promise<{ erreur?: string }>
  sauvegarderFooterReseaux: (titre: string, message: string) => Promise<{ erreur?: string }>
  sauvegarderTemplate: (type: TypeTemplateTransactionnel, titre: string, intro: string) => Promise<{ erreur?: string }>
  genererApercu: (
    type: TypeTemplateTransactionnel,
    introDraft: string,
    couleurDraft?: string,
    signatureDraft?: string,
    footerMessageDraft?: string,
    titreDraft?: string,
    footerTitreDraft?: string,
  ) => Promise<string>
}

const COULEUR_DEFAUT = '#4f46e5'
const DEBOUNCE_MS = 400

const CARTES: { type: TypeTemplateTransactionnel; titrePlaceholder: string; description: string; declencheur: string }[] = [
  {
    type: 'confirmation_commande',
    titrePlaceholder: 'Merci pour ton achat !',
    description: 'Envoyé automatiquement juste après un achat de licence.',
    declencheur: "Déclencheur : paiement d'une commande confirmé",
  },
  {
    type: 'confirmation_abonnement',
    titrePlaceholder: 'Ton abonnement est actif !',
    description: 'Envoyé automatiquement à la création d\'un nouvel abonnement.',
    declencheur: 'Déclencheur : nouvel abonnement créé',
  },
  {
    type: 'demande_annulation_abonnement',
    titrePlaceholder: "Ta demande d'annulation est prise en compte",
    description: "Envoyé immédiatement quand le client annule — confirme la prise en compte et la date de fin d'accès.",
    declencheur: 'Déclencheur : décision d\'annuler (accès encore actif jusqu\'à la fin de la période payée)',
  },
  {
    type: 'annulation_abonnement',
    titrePlaceholder: 'Abonnement annulé',
    description: "Envoyé uniquement quand un abonnement se termine sans demande préalable (ex. abonnement impayé résilié directement).",
    declencheur: 'Déclencheur : fin réelle de période sans demande préalable',
  },
  {
    type: 'confirmation_compte_artiste',
    titrePlaceholder: 'Ton compte est prêt !',
    description: "Envoyé quand un artiste confirme son inscription depuis cette boutique. Une ligne fixe (non modifiable) rappelle que c'est un compte My Producer global.",
    declencheur: "Déclencheur : confirmation d'email après inscription artiste",
  },
  {
    type: 'telechargement_gratuit',
    titrePlaceholder: 'Ton free download est prêt !',
    description: 'Envoyé automatiquement avec le lien de téléchargement après un free download.',
    declencheur: 'Déclencheur : demande de téléchargement gratuit',
  },
]

const NOMS_CARTES: Record<TypeTemplateTransactionnel, string> = {
  confirmation_commande: 'Confirmation de commande',
  confirmation_abonnement: "Confirmation d'abonnement",
  demande_annulation_abonnement: "Demande d'annulation",
  annulation_abonnement: "Fin d'abonnement",
  confirmation_compte_artiste: 'Confirmation de compte',
  telechargement_gratuit: 'Free download',
  beat_cadeau_fidelite: 'Beat cadeau de fidélité',
}

type SectionId = 'branding' | 'footer' | TypeTemplateTransactionnel

export default function TransactionnelsClient({
  nomArtiste,
  logoUrl,
  couleurMarque,
  signatureTransactionnels,
  footerMessageReseaux,
  titreFooterReseaux,
  templates,
  sauvegarderCouleurMarque,
  sauvegarderSignatureTransactionnels,
  sauvegarderFooterReseaux,
  sauvegarderTemplate,
  genererApercu,
}: Props) {
  const [typeActif, setTypeActif] = useState<TypeTemplateTransactionnel>('confirmation_commande')
  const [sectionOuverte, setSectionOuverte] = useState<SectionId | null>('confirmation_commande')
  const [couleur, setCouleur] = useState(couleurMarque ?? COULEUR_DEFAUT)
  const [signature, setSignature] = useState(signatureTransactionnels ?? '')
  const [footerTitre, setFooterTitre] = useState(titreFooterReseaux ?? '')
  const [footerMessage, setFooterMessage] = useState(footerMessageReseaux ?? '')
  const [templatesDraft, setTemplatesDraft] = useState(templates)
  const [apercuHtml, setApercuHtml] = useState('')
  const [chargementApercu, setChargementApercu] = useState(true)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const templateActif = templatesDraft[typeActif]

  // Aperçu live : régénéré automatiquement (avec un léger délai anti-rafale)
  // à chaque changement de couleur, signature, footer, titre/intro ou type
  // sélectionné — pas besoin de bouton "Aperçu" ni d'enregistrer avant de
  // voir le résultat.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setChargementApercu(true)
    debounceRef.current = setTimeout(async () => {
      const html = await genererApercu(typeActif, templateActif.intro, couleur, signature, footerMessage, templateActif.titre, footerTitre)
      setApercuHtml(html)
      setChargementApercu(false)
    }, DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeActif, templateActif.titre, templateActif.intro, couleur, signature, footerMessage, footerTitre])

  function ouvrirSection(id: SectionId) {
    setSectionOuverte(prev => (prev === id ? null : id))
    if (id !== 'branding' && id !== 'footer') setTypeActif(id)
  }

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
          {/* Colonne réglages — accordéon, une section ouverte à la fois */}
          <div className="space-y-2">
            <AccordionSection
              titre="Branding"
              sousTitre="Couleur et signature, partagées par tous les emails"
              ouvert={sectionOuverte === 'branding'}
              onToggle={() => ouvrirSection('branding')}
            >
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
            </AccordionSection>

            <AccordionSection
              titre="Footer réseaux sociaux"
              sousTitre="Titre et phrase affichés en bas de chaque email"
              ouvert={sectionOuverte === 'footer'}
              onToggle={() => ouvrirSection('footer')}
            >
              <CarteFooterReseaux
                footerTitre={footerTitre}
                onChangeFooterTitre={setFooterTitre}
                footerMessage={footerMessage}
                onChangeFooterMessage={setFooterMessage}
                sauvegarderFooterReseaux={sauvegarderFooterReseaux}
              />
            </AccordionSection>

            <div className="pt-2 pb-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">Les emails</p>
            </div>

            {CARTES.map(carte => (
              <AccordionSection
                key={carte.type}
                titre={NOMS_CARTES[carte.type]}
                sousTitre={carte.description}
                ouvert={sectionOuverte === carte.type}
                onToggle={() => ouvrirSection(carte.type)}
              >
                <CarteTemplate
                  carte={carte}
                  template={templatesDraft[carte.type]}
                  onChangeTemplate={valeur => setTemplatesDraft(prev => ({ ...prev, [carte.type]: valeur }))}
                  sauvegarderTemplate={sauvegarderTemplate}
                />
              </AccordionSection>
            ))}
          </div>

          {/* Colonne aperçu live */}
          <div className="lg:sticky lg:top-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
                <p className="text-sm font-bold text-white">Aperçu en direct — {NOMS_CARTES[typeActif]}</p>
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

function AccordionSection({
  titre,
  sousTitre,
  ouvert,
  onToggle,
  children,
}: {
  titre: string
  sousTitre: string
  ouvert: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-gray-800/40 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{titre}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{sousTitre}</p>
        </div>
        <span
          className="text-gray-500 text-xs flex-shrink-0 transition-transform duration-150"
          style={{ transform: ouvert ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▾
        </span>
      </button>
      {ouvert && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-800">
          {children}
        </div>
      )}
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
  onSauvegarder: () => Promise<{ erreur?: string }>
}) {
  const [enregistrement, setEnregistrement] = useState(false)
  const [enregistre, setEnregistre] = useState(false)
  const [erreur, setErreur] = useState('')

  async function handleSauvegarder() {
    setEnregistrement(true)
    setErreur('')
    setEnregistre(false)
    const { erreur: err } = await onSauvegarder()
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
    <div className="space-y-4">
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
          onSauvegarder={() => sauvegarderSignatureTransactionnels(signature)}
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
  footerTitre,
  onChangeFooterTitre,
  footerMessage,
  onChangeFooterMessage,
  sauvegarderFooterReseaux,
}: {
  footerTitre: string
  onChangeFooterTitre: (titre: string) => void
  footerMessage: string
  onChangeFooterMessage: (message: string) => void
  sauvegarderFooterReseaux: (titre: string, message: string) => Promise<{ erreur?: string }>
}) {
  const [enregistrement, setEnregistrement] = useState(false)
  const [enregistre, setEnregistre] = useState(false)
  const [erreur, setErreur] = useState('')

  async function handleSauvegarder() {
    setEnregistrement(true)
    setErreur('')
    setEnregistre(false)
    const { erreur: err } = await sauvegarderFooterReseaux(footerTitre, footerMessage)
    setEnregistrement(false)
    if (err) setErreur(err)
    else {
      setEnregistre(true)
      setTimeout(() => setEnregistre(false), 2000)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Affiché en bas de chaque email si au moins un réseau est renseigné sur ton profil.</p>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Titre</label>
        <input
          type="text"
          value={footerTitre}
          onChange={e => onChangeFooterTitre(e.target.value)}
          placeholder="Suis-moi sur les réseaux sociaux"
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Phrase</label>
        <input
          type="text"
          value={footerMessage}
          onChange={e => onChangeFooterMessage(e.target.value)}
          placeholder="Rejoins-moi sur mes réseaux pour rester à jour et me contacter facilement !"
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        <p className="text-xs text-gray-500 mt-1">Laisse les deux champs vides pour utiliser le texte par défaut.</p>
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

function CarteTemplate({
  carte,
  template,
  onChangeTemplate,
  sauvegarderTemplate,
}: {
  carte: { type: TypeTemplateTransactionnel; titrePlaceholder: string; description: string; declencheur: string }
  template: Template
  onChangeTemplate: (template: Template) => void
  sauvegarderTemplate: (type: TypeTemplateTransactionnel, titre: string, intro: string) => Promise<{ erreur?: string }>
}) {
  const [enregistrement, setEnregistrement] = useState(false)
  const [enregistre, setEnregistre] = useState(false)
  const [erreur, setErreur] = useState('')

  async function handleSauvegarder() {
    setEnregistrement(true)
    setErreur('')
    setEnregistre(false)
    const { erreur: err } = await sauvegarderTemplate(carte.type, template.titre, template.intro)
    setEnregistrement(false)
    if (err) setErreur(err)
    else {
      setEnregistre(true)
      setTimeout(() => setEnregistre(false), 2000)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-600">{carte.declencheur}</p>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Titre personnalisé</label>
        <input
          type="text"
          value={template.titre}
          onChange={e => onChangeTemplate({ ...template, titre: e.target.value })}
          placeholder={carte.titrePlaceholder}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Texte d&apos;intro personnalisé</label>
        <textarea
          value={template.intro}
          onChange={e => onChangeTemplate({ ...template, intro: e.target.value })}
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
