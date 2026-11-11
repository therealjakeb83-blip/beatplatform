'use client'

import { URL_APP } from '@/lib/constantes'
import { estHotePlateforme } from '@/lib/domaine-boutique'

// « Continuer avec Google » (rang 9c, lot 4). Le parcours part toujours de
// sonoo.app (/api/artiste/google) ; sur le domaine d'une boutique, on transmet
// le domaine pour que le client y revienne connecté. Bouton aux couleurs
// imposées par Google (fond blanc, logo « G » officiel).
export default function BoutonGoogle({ redirect }: { redirect: string }) {
  const url = new URL('/api/artiste/google', URL_APP)
  url.searchParams.set('redirect', redirect)

  // Le domaine n'est connu que dans le navigateur : ajouté au clic.
  function auClic(e: React.MouseEvent<HTMLAnchorElement>) {
    if (estHotePlateforme(window.location.host)) return
    e.preventDefault()
    const avecDomaine = new URL(url)
    avecDomaine.searchParams.set('domaine', window.location.host)
    window.location.assign(avecDomaine.toString())
  }

  return (
    <>
      <a
        href={url.toString()}
        onClick={auClic}
        className="w-full flex items-center justify-center gap-3 py-3 rounded-lg bg-white hover:bg-gray-100 text-[#1f1f1f] font-medium border border-[#747775] transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Continuer avec Google
      </a>
      <div className="flex items-center gap-3 text-xs text-gray-600">
        <span className="h-px flex-1 bg-gray-800" />
        ou
        <span className="h-px flex-1 bg-gray-800" />
      </div>
    </>
  )
}
