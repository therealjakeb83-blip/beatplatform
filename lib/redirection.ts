// Adresse de retour (?redirect=, ?next=…) réduite à un chemin interne au
// site. Un simple test « commence par / et pas par // » ne suffit pas : le
// navigateur lit `/\site.com`, `/<tab>/site.com` ou `/<retour ligne>/site.com`
// comme `//site.com` (autre site), et `javascript:` exécuterait du code.
// On laisse donc le navigateur résoudre l'adresse et on vérifie qu'elle reste
// chez nous.
const BASE = 'https://interne.invalid'

export function cheminInterne(valeur: string | null | undefined, defaut = '/'): string {
  if (!valeur || !valeur.startsWith('/')) return defaut
  try {
    const url = new URL(valeur, BASE)
    if (url.origin !== BASE) return defaut
    return url.pathname + url.search + url.hash
  } catch {
    return defaut
  }
}
