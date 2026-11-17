// Délai maximum accordé à Supabase pour répondre à CHAQUE requête faite par
// proxy.ts (proxy.ts s'exécute avant tout rendu). Sans cette limite, un
// ralentissement ponctuel de Supabase (incident du 2026-08-28) bloque le site
// entier pendant les 5 minutes du timeout Vercel.
export const TIMEOUT_VERIFICATION_MS = 5000

// Rang 9e : chaque dépassement laisse une ligne dans les journaux Vercel
// (étape + durée, aucune donnée personnelle). Avant, la page « Petit souci
// technique » ne laissait aucune trace.
export function avecTimeout<T>(etape: string, promise: PromiseLike<T>, delaiMs = TIMEOUT_VERIFICATION_MS): Promise<T> {
  const debut = Date.now()
  let chrono: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    chrono = setTimeout(() => {
      console.warn(`[proxy] délai dépassé : étape=${etape} durée=${Date.now() - debut} ms`)
      reject(new Error('Timeout vérification session'))
    }, delaiMs)
  })
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(chrono))
}
