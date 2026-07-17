'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { TypeTemplateTransactionnel } from '@/lib/emails'

type Props = {
  nomArtiste: string
  logoUrl: string | null
  signatureEmails: string | null
  couleurMarque: string | null
  introConfirmationCommande: string | null
  introConfirmationAbonnement: string | null
  introAnnulationAbonnement: string | null
  sauvegarderCouleurMarque: (couleur: string) => Promise<{ erreur?: string }>
  sauvegarderIntro: (type: TypeTemplateTransactionnel, intro: string) => Promise<{ erreur?: string }>
  genererApercu: (type: TypeTemplateTransactionnel, introDraft: string) => Promise<string>
}

const COULEUR_DEFAUT = '#4f46e5'

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
    type: 'annulation_abonnement',
    titre: "Annulation d'abonnement",
    description: "Envoyé automatiquement quand un abonnement se termine réellement (fin de période payée).",
    declencheur: 'Déclencheur : fin réelle de période, abonnement résilié',
  },
]

export default function TransactionnelsClient({
  nomArtiste,
  logoUrl,
  signatureEmails,
  couleurMarque,
  introConfirmationCommande,
  introConfirmationAbonnement,
  introAnnulationAbonnement,
  sauvegarderCouleurMarque,
  sauvegarderIntro,
  genererApercu,
}: Props) {
  const introsInitiaux: Record<TypeTemplateTransactionnel, string> = {
    confirmation_commande: introConfirmationCommande ?? '',
    confirmation_abonnement: introConfirmationAbonnement ?? '',
    annulation_abonnement: introAnnulationAbonnement ?? '',
    beat_cadeau_fidelite: '',
  }

  const [apercuOuvert, setApercuOuvert] = useState<{ html: string; chargement: boolean } | null>(null)

  async function handleApercu(type: TypeTemplateTransactionnel, introDraft: string) {
    setApercuOuvert({ html: '', chargement: true })
    const html = await genererApercu(type, introDraft)
    setApercuOuvert({ html, chargement: false })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Mailing — Transactionnels</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Emails de confirmation envoyés automatiquement après un achat ou un abonnement — jamais de ciblage, jamais désactivables.
          </p>
        </div>

        <CarteBranding
          nomArtiste={nomArtiste}
          logoUrl={logoUrl}
          signatureEmails={signatureEmails}
          couleurMarque={couleurMarque}
          sauvegarderCouleurMarque={sauvegarderCouleurMarque}
        />

        <div className="space-y-3">
          {CARTES.map(carte => (
            <CarteTemplate
              key={carte.type}
              carte={carte}
              introInitial={introsInitiaux[carte.type]}
              sauvegarderIntro={sauvegarderIntro}
              onApercu={introDraft => handleApercu(carte.type, introDraft)}
            />
          ))}
        </div>
      </div>

      {apercuOuvert && (
        <ModaleApercu
          html={apercuOuvert.html}
          chargement={apercuOuvert.chargement}
          onClose={() => setApercuOuvert(null)}
        />
      )}
    </div>
  )
}

function CarteBranding({
  nomArtiste,
  logoUrl,
  signatureEmails,
  couleurMarque,
  sauvegarderCouleurMarque,
}: {
  nomArtiste: string
  logoUrl: string | null
  signatureEmails: string | null
  couleurMarque: string | null
  sauvegarderCouleurMarque: (couleur: string) => Promise<{ erreur?: string }>
}) {
  const [couleur, setCouleur] = useState(couleurMarque ?? COULEUR_DEFAUT)
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
      <p className="text-sm font-semibold text-white">Branding — partagé par les 3 emails</p>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-400 mb-1">Couleur de marque</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(couleur) ? couleur : COULEUR_DEFAUT}
              onChange={e => setCouleur(e.target.value)}
              className="w-10 h-10 rounded-lg bg-gray-950 border border-gray-800 cursor-pointer"
            />
            <input
              type="text"
              value={couleur}
              onChange={e => setCouleur(e.target.value)}
              placeholder={COULEUR_DEFAUT}
              className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Utilisée pour l&apos;en-tête et le bouton des emails — vide = indigo par défaut.</p>
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
  introInitial,
  sauvegarderIntro,
  onApercu,
}: {
  carte: { type: TypeTemplateTransactionnel; titre: string; description: string; declencheur: string }
  introInitial: string
  sauvegarderIntro: (type: TypeTemplateTransactionnel, intro: string) => Promise<{ erreur?: string }>
  onApercu: (introDraft: string) => void
}) {
  const [intro, setIntro] = useState(introInitial)
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
          onChange={e => setIntro(e.target.value)}
          rows={3}
          placeholder="Laisse vide pour utiliser le texte par défaut de My Producer"
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-none"
        />
      </div>

      {erreur && <p className="text-xs text-red-400">{erreur}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSauvegarder}
          disabled={enregistrement}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-50"
        >
          {enregistrement ? 'Enregistrement…' : enregistre ? 'Enregistré ✓' : 'Enregistrer'}
        </button>
        <button
          onClick={() => onApercu(intro)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800/60 hover:bg-gray-700 text-gray-300 transition-colors"
        >
          Aperçu
        </button>
      </div>
    </div>
  )
}

function ModaleApercu({ html, chargement, onClose }: { html: string; chargement: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
          <p className="text-sm font-bold text-white">Aperçu</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg leading-none">×</button>
        </div>
        <div className="flex-1 overflow-auto bg-gray-950 flex justify-center py-4">
          {chargement ? (
            <p className="text-xs text-gray-500 self-center">Génération…</p>
          ) : (
            <iframe srcDoc={html} title="Aperçu de l'email" className="bg-white" style={{ width: 480, height: '100%', minHeight: '60vh' }} />
          )}
        </div>
      </div>
    </div>
  )
}
