// Paiement en cours (Phase 13, lot 2) — noté sur l'appareil juste avant que
// l'argent puisse bouger, effacé dès que l'issue est connue. Si la page est
// rechargée entre les deux, le panier (CartContext) interroge le serveur au
// lieu de se réafficher plein : sans ça, on pouvait payer deux fois.
// L'onglet d'origine est retenu (sessionStorage survit à un rechargement,
// pas à un autre onglet) : seul lui a le droit d'annuler un paiement
// interrompu — un autre onglet ouvert en même temps n'y touche jamais.

const DUREE_VALIDITE_MS = 60 * 60 * 1000

export type TypePaiementEnCours = 'solo' | 'multi'

type Marqueur = { type: TypePaiementEnCours; id: string; onglet: string; date: number }

function cle(slug: string) {
  return `paiement_en_cours_${slug}`
}

function idOnglet(): string {
  try {
    let id = sessionStorage.getItem('paiement_onglet')
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem('paiement_onglet', id)
    }
    return id
  } catch {
    return 'inconnu'
  }
}

export function noterPaiementEnCours(slug: string, type: TypePaiementEnCours, id: string) {
  try {
    const marqueur: Marqueur = { type, id, onglet: idOnglet(), date: Date.now() }
    localStorage.setItem(cle(slug), JSON.stringify(marqueur))
  } catch {}
}

export function lirePaiementEnCours(slug: string): { type: TypePaiementEnCours; id: string; memeOnglet: boolean } | null {
  try {
    const raw = localStorage.getItem(cle(slug))
    if (!raw) return null
    const m = JSON.parse(raw) as Marqueur
    if (!m?.id || Date.now() - m.date > DUREE_VALIDITE_MS) {
      localStorage.removeItem(cle(slug))
      return null
    }
    return { type: m.type, id: m.id, memeOnglet: m.onglet === idOnglet() }
  } catch {
    return null
  }
}

export function effacerPaiementEnCours(slug: string) {
  try { localStorage.removeItem(cle(slug)) } catch {}
}

/** Identifiant Stripe (pi_… ou seti_…) contenu dans un client_secret. */
export function idDepuisClientSecret(clientSecret: string): string {
  return clientSecret.split('_secret_')[0]
}
