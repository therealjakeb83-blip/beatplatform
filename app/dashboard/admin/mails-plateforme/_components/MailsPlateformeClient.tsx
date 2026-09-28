'use client'

import { useEffect, useRef, useState } from 'react'
import type { TypeTemplatePlateforme } from '@/lib/emails'
import { NOM_PLATEFORME } from '@/lib/constantes'
import { prevenirMiseAJourConditions } from '../_lib/actions'

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
    titrePlaceholder: `Bienvenue sur ${NOM_PLATEFORME} !`,
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
  {
    type: 'collab_invitation',
    nom: 'Invitation à collaborer',
    titrePlaceholder: 'Tu es invité à collaborer sur un beat',
    description: "Envoyé au collaborateur invité (par email ou par son @slug) quand le propriétaire enregistre le beat.",
    declencheur: "Déclencheur : enregistrement d'un beat avec un nouveau collaborateur → B",
  },
  {
    type: 'collab_acceptation',
    nom: 'Collab — acceptation',
    titrePlaceholder: 'Ta collaboration a été acceptée',
    description: 'Envoyé au propriétaire du beat quand le collaborateur accepte.',
    declencheur: "Déclencheur : B accepte l'invitation (page Collaborations) → A",
  },
  {
    type: 'collab_refus',
    nom: 'Collab — refus',
    titrePlaceholder: 'Ta demande de collaboration a été refusée',
    description: 'Envoyé au propriétaire du beat quand le collaborateur refuse.',
    declencheur: "Déclencheur : B refuse l'invitation → A",
  },
  {
    type: 'collab_retrait',
    nom: 'Collab — invitation retirée',
    titrePlaceholder: 'Une invitation à collaborer a été retirée',
    description: 'Envoyé au collaborateur quand le propriétaire retire une invitation encore en attente (jamais après un refus).',
    declencheur: 'Déclencheur : A retire une invitation non répondue → B',
  },
  {
    type: 'collab_depart',
    nom: 'Collab — départ',
    titrePlaceholder: 'Un collaborateur a quitté ton beat',
    description: 'Envoyé au propriétaire quand un collaborateur actif quitte la collaboration.',
    declencheur: 'Déclencheur : B quitte la collaboration → A',
  },
  {
    type: 'collab_eviction',
    nom: 'Collab — collaborateur retiré',
    titrePlaceholder: 'Ta collaboration a pris fin',
    description: 'Envoyé au collaborateur quand le propriétaire le retire (avec le motif).',
    declencheur: 'Déclencheur : A retire un collaborateur actif → B',
  },
  {
    type: 'collab_beat_supprime',
    nom: 'Collab — beat supprimé',
    titrePlaceholder: 'Un beat en collaboration a été supprimé',
    description: 'Envoyé aux collaborateurs (actifs ou invités) quand le propriétaire supprime le beat.',
    declencheur: 'Déclencheur : A supprime un beat en collaboration → B',
  },
  {
    type: 'collab_pause',
    nom: 'Collab — beat en pause',
    titrePlaceholder: 'Un beat en collaboration est en pause',
    description: "Envoyé à tous les vendeurs d'un beat collab quand le compte Stripe de l'un d'eux n'est plus opérationnel.",
    declencheur: 'Déclencheur : webhook Stripe account.updated (compte devenu non opérationnel) → A et B',
  },
  {
    type: 'conditions_mise_a_jour',
    nom: 'Mise à jour des conditions',
    titrePlaceholder: 'Mise à jour des conditions',
    description: "Email d'information envoyé à tous les beatmakers 30 jours avant l'entrée en vigueur d'un texte modifié.",
    declencheur: 'Déclencheur : bouton « Prévenir tous les beatmakers » (sous cette carte)',
  },
  {
    type: 'suspension',
    nom: 'Suspension de compte',
    titrePlaceholder: 'Ton compte a été suspendu',
    description: "Envoyé quand l'admin suspend une boutique, en plus du message affiché à la prochaine tentative de connexion.",
    declencheur: 'Déclencheur : suspension manuelle depuis /dashboard/admin/boutiques/[id]',
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
        <h1 className="text-xl font-bold text-white">Mails {NOM_PLATEFORME}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Emails transactionnels envoyés par la plateforme aux beatmakers eux-mêmes — branding fixe {NOM_PLATEFORME}, jamais personnalisable par eux. Titre et intro éditables ci-dessous, le reste (dates, prix, liens) reste géré par le code.
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

      {carte.type === 'conditions_mise_a_jour' && <PrevenirConditions />}
    </div>
  )
}

function PrevenirConditions() {
  const [texteConcerne, setTexteConcerne] = useState('')
  const [resume, setResume] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [resultat, setResultat] = useState('')
  const [erreur, setErreur] = useState('')

  async function handleEnvoyer() {
    if (!confirm('Envoyer cet email à TOUS les beatmakers inscrits ? (tant que le verrou pré-lancement est actif, seules tes adresses le reçoivent vraiment)')) return
    setEnvoi(true)
    setErreur('')
    setResultat('')
    const r = await prevenirMiseAJourConditions(texteConcerne, resume)
    setEnvoi(false)
    if (r.erreur) { setErreur(r.erreur); return }
    const date = r.dateEffet ? new Date(r.dateEffet).toLocaleDateString('fr-FR') : ''
    setResultat(`${r.envoyes} envoyé(s), ${r.bloques} bloqué(s) par le verrou — entrée en vigueur le ${date}.`)
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
      <p className="text-xs font-semibold text-white">Prévenir tous les beatmakers</p>
      <input
        type="text"
        value={texteConcerne}
        onChange={e => setTexteConcerne(e.target.value)}
        placeholder="Texte concerné (ex. Conditions de collaboration)"
        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
      />
      <textarea
        value={resume}
        onChange={e => setResume(e.target.value)}
        rows={3}
        placeholder="Ce qui change, en quelques lignes"
        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-none"
      />
      {erreur && <p className="text-xs text-red-400">{erreur}</p>}
      {resultat && <p className="text-xs text-green-400">{resultat}</p>}
      <button
        onClick={handleEnvoyer}
        disabled={envoi || !texteConcerne.trim() || !resume.trim()}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
      >
        {envoi ? 'Envoi en cours…' : 'Prévenir tous les beatmakers'}
      </button>
      <p className="text-[11px] text-gray-600">Entrée en vigueur automatique 30 jours après l&apos;envoi. Chaque envoi apparaît dans l&apos;onglet Logs.</p>
    </div>
  )
}
