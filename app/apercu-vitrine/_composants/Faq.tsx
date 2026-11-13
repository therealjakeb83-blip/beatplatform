'use client'

import { useState } from 'react'
import { Moins, Plus } from './Icones'

const QUESTIONS = [
  {
    q: 'À qui s’adresse Sonoo ?',
    r: 'Aux beatmakers qui veulent vendre leurs beats sous leur propre marque, en particulier ceux qui réalisent déjà des ventes et veulent passer un cap. Les débutants sont aussi les bienvenus.',
  },
  {
    q: 'Est-ce que je peux utiliser mon propre nom de domaine ?',
    r: 'Oui. Tu branches ton adresse (par exemple beats.tonnom.com) depuis ton tableau de bord. En attendant, ta boutique a sa propre adresse sur Sonoo.',
  },
  {
    q: 'Est-ce que je peux importer mes clients existants ?',
    r: 'Oui. Tu importes tes clients et tes ventes depuis BeatStars, Airbit ou n’importe quel fichier. Tu peux réimporter quand tu veux, sans jamais créer de doublon.',
  },
  {
    q: 'Sonoo prend-il une commission sur mes ventes ?',
    r: 'Non, 0 % de commission. Les paiements vont directement de l’acheteur à toi : seuls les frais du prestataire de paiement s’appliquent.',
  },
  {
    q: 'Est-ce que je peux essayer Sonoo avant de m’abonner ?',
    r: 'Oui, l’offre Pro commence par un essai gratuit. Tu crées ta boutique et tu testes tous les outils avant de payer.',
  },
  {
    q: 'Comment fonctionnent les collabs ?',
    r: 'Tu invites tes collaborateurs sur un beat et tu fixes la part de chacun. À chaque vente, chaque part est versée directement à chaque collaborateur.',
  },
]

export function Faq() {
  const [ouverte, setOuverte] = useState<number | null>(0)

  return (
    <div className="v-faq-liste">
      {QUESTIONS.map((item, i) => {
        const estOuverte = ouverte === i
        return (
          <div key={item.q} className="v-faq-item">
            <h3>
              <button
                type="button"
                className="v-faq-question"
                aria-expanded={estOuverte}
                aria-controls={`v-faq-${i}`}
                id={`v-faq-q-${i}`}
                onClick={() => setOuverte(estOuverte ? null : i)}
              >
                <span>{item.q}</span>
                <span className={estOuverte ? 'v-faq-signe v-faq-signe-ouvert' : 'v-faq-signe'}>
                  {estOuverte ? <Moins taille={16} /> : <Plus taille={16} />}
                </span>
              </button>
            </h3>
            <div id={`v-faq-${i}`} role="region" aria-labelledby={`v-faq-q-${i}`} hidden={!estOuverte} className="v-faq-reponse">
              <p>{item.r}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
