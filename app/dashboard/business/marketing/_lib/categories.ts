export type CategorieTemplate = 'newsletter' | 'promotion' | 'reactivation' | 'annonce' | 'abonnement'

export const CATEGORIE_LABEL: Record<string, string> = {
  newsletter:   'Newsletter',
  promotion:    'Promotion',
  reactivation: 'Réactivation',
  annonce:      'Annonce',
  abonnement:   'Abonnement',
}

export const CATEGORIE_CLS: Record<string, string> = {
  newsletter:   'bg-indigo-500/15 text-indigo-400',
  promotion:    'bg-red-500/15 text-red-400',
  reactivation: 'bg-cyan-500/15 text-cyan-400',
  annonce:      'bg-gray-700 text-gray-300',
  abonnement:   'bg-green-500/15 text-green-400',
}
