// Code promo appliqué dans le panier, repris par la page de paiement (Phase 13,
// lot 3) : avant, le client devait le retaper, et le paiement express du
// panier l'ignorait — le total affiché pouvait différer du montant débité.
// sessionStorage : propre à l'onglet, oublié à la fermeture ; jamais bloquant
// (navigation privée, stockage refusé).

const cle = (slug: string) => `code_promo_panier_${slug}`

export function memoriserCodePromoPanier(slug: string, code: string | null) {
  try {
    if (code) sessionStorage.setItem(cle(slug), code)
    else sessionStorage.removeItem(cle(slug))
  } catch { /* stockage indisponible */ }
}

export function lireCodePromoPanier(slug: string): string | null {
  try {
    return sessionStorage.getItem(cle(slug))
  } catch {
    return null
  }
}

export function oublierCodePromoPanier(slug: string) {
  memoriserCodePromoPanier(slug, null)
}
