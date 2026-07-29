'use client'

import { useEffect, useRef, useState } from 'react'
import type { TypeTemplatePlateforme } from '@/lib/emails'

type Template = { titre: string; intro: string }

type Props = {
  templates: Record<TypeTemplatePlateforme, Template>
  sauvegarderTemplate: (type: TypeTemplatePlateforme, titre: string, intro: string) => Promise<{ erreur?: string }>
  genererApercu: (type: TypeTemplatePlateforme, titreDraft: string, introDraft: string) => Promise<string>
}

const DEBOUNCE_MS = 400

const CARTES: { type: TypeTemplatePlateforme; nom: string; titrePlaceholder: string; description: string; declencheur: string }[] = [
  {
    type: 'confirmation_email',
    nom: 'Confirmation d\'adresse email',
    titrePlaceholder: 'Confirme ton adresse email',
    description: "Envoyé juste après l'inscription, contient le lien de confirmation.",
    declencheur: 'Déclencheur : inscription (avant que le compte soit confirmé)',
  },
  {
    type: 'bienvenue',
    nom: 'Bienvenue',
    titrePlaceholder: 'Bienvenue sur My Producer !',
    description: 'Envoyé juste après la confirmation réelle de l\'adresse email.',
    declencheur: 'Déclencheur : clic sur le lien de confirmation (/confirmation-compte)',
  },
  {
    type: 'confirmation_essai',
    nom: "Confirmation d'essai",
    titrePlaceholder: 'Ton essai gratuit a démarré',
    description: "Envoyé au démarrage de l'essai gratuit de 14 jours.",
    declencheur: 'Déclencheur : souscription réussie (checkout.session.completed)',
  },
  {
    type: 'rappel_fin_essai',
    nom: "Rappel fin d'essai",
    titrePlaceholder: 'Ton essai se termine dans 3 jours',
    description: "Rappel envoyé 3 jours avant la fin de l'essai.",
    declencheur: 'Déclencheur : cron quotidien /api/cron/plateforme-rappels',
  },
  {
    type: 'paiement_echoue',
    nom: 'Paiement échoué',
    titrePlaceholder: 'Le paiement de ton abonnement a échoué',
    description: "Envoyé quand un prélèvement échoue (passage en statut impayé).",
    declencheur: 'Déclencheur : entrée en statut impayé (customer.subscription.updated)',
  },
  {
    type: 'annulation',
    nom: 'Annulation',
    titrePlaceholder: 'Ton abonnement a été annulé',
    description: "Envoyé à l'annulation effective de l'abonnement plateforme.",
    declencheur: 'Déclencheur : customer.subscription.deleted',
  },
]

export default function MailsPlateformeClient({ templates, sauvegarderTemplate, genererApercu }: Props) {
  const [typeActif, setTypeActif] = useState<TypeTemplatePlateforme>('bienvenue')
  const [sectionOuverte, setSectionOuverte] = useState<TypeTemplatePlateforme | null>('bienvenue')
  const [templatesDraft, setTemplatesDraft] = useState(templates)
  const [apercuHtml, setApercuHtml] = useState('')
  const [chargementApercu, setChargementApercu] = useState(true)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const templateActif = templatesDraft[typeActif]

  // Aperçu live — même principe que /dashboard/business/mailing/transactionnels :
  // régénéré automatiquement à chaque frappe (avec un léger délai anti-rafale),
  // pas besoin de bouton "Aperçu" ni d'enregistrer avant de voir le résultat.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setChargementApercu(true)
    debounceRef.current = setTimeout(async () => {
      const html = await genererApercu(typeActif, templateActif.titre, templateActif.intro)
      setApercuHtml(html)
      setChargementApercu(false)
    }, DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeActif, templateActif.titre, templateActif.intro])

  function ouvrirSection(id: TypeTemplatePlateforme) {
    setSectionOuverte(prev => (prev === id ? null : id))
    setTypeActif(id)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Mails My Producer</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Emails transactionnels envoyés par la plateforme aux beatmakers eux-mêmes — branding fixe My Producer, jamais personnalisable par eux. Titre et intro éditables ci-dessous, le reste (dates, prix, liens) reste géré par le code.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-2">
          {CARTES.map(carte => (
            <AccordionSection
              key={carte.type}
              titre={carte.nom}
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

        <div className="lg:sticky lg:top-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
              <p className="text-sm font-bold text-white">Aperçu en direct — {CARTES.find(c => c.type === typeActif)?.nom}</p>
              {chargementApercu && <span className="text-[11px] text-gray-500">Mise à jour…</span>}
            </div>
            <div className="bg-gray-950 flex justify-center py-6 px-4 min-h-[60vh]">
              {apercuHtml ? (
                <iframe
                  srcDoc={apercuHtml}
                  title="Aperçu de l'email"
                  className="bg-white rounded-lg transition-opacity"
                  style={{ width: '100%', maxWidth: 600, height: '60vh', opacity: chargementApercu ? 0.5 : 1 }}
                />
              ) : (
                <p className="text-xs text-gray-500 self-center">Génération…</p>
              )}
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

function CarteTemplate({
  carte,
  template,
  onChangeTemplate,
  sauvegarderTemplate,
}: {
  carte: { type: TypeTemplatePlateforme; titrePlaceholder: string; declencheur: string }
  template: Template
  onChangeTemplate: (template: Template) => void
  sauvegarderTemplate: (type: TypeTemplatePlateforme, titre: string, intro: string) => Promise<{ erreur?: string }>
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
        <label className="block text-xs font-medium text-gray-400 mb-1">Titre</label>
        <input
          type="text"
          value={template.titre}
          onChange={e => onChangeTemplate({ ...template, titre: e.target.value })}
          placeholder={carte.titrePlaceholder}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Intro</label>
        <textarea
          value={template.intro}
          onChange={e => onChangeTemplate({ ...template, intro: e.target.value })}
          rows={4}
          placeholder="Laisse vide pour utiliser le texte par défaut"
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
