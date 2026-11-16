'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Logo, Symbole } from './Logo'
import { Croix, Etincelle, Fleche, FlecheDiagonale, Menu } from './Icones'
import { CHEMIN_INSCRIPTION, CHEMIN_VITRINE } from './liens'

const LIENS = [
  { libelle: 'Fonctionnalités', href: '#fonctionnalites' },
  { libelle: 'Tarifs', href: '#tarifs' },
  { libelle: 'Affiliation', href: '#affiliation' },
  { libelle: 'FAQ', href: '#faq' },
]

export function EnTete({ lienBoutique }: { lienBoutique: string }) {
  const [ouvert, setOuvert] = useState(false)
  const boutonMenu = useRef<HTMLButtonElement>(null)
  const boutonFermer = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!ouvert) return
    const bouton = boutonMenu.current
    const avant = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Le reste de la page devient inatteignable au clavier tant que le menu est ouvert.
    const derriere = [
      document.querySelector('.w-evitement'),
      document.querySelector('.w-entete > .w-entete-barre'),
      document.getElementById('w-contenu'),
      document.querySelector('.w-pied'),
    ].filter(
      (e): e is HTMLElement => e instanceof HTMLElement
    )
    derriere.forEach(e => (e.inert = true))
    boutonFermer.current?.focus()
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('keydown', surTouche)
    return () => {
      document.body.style.overflow = avant
      derriere.forEach(e => (e.inert = false))
      bouton?.focus({ preventScroll: true })
      document.removeEventListener('keydown', surTouche)
    }
  }, [ouvert])

  function fermer() {
    setOuvert(false)
  }

  // Le défilement vers la section attend que le menu soit fermé et la page débloquée.
  function allerA(e: MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault()
    setOuvert(false)
    requestAnimationFrame(() => {
      document.querySelector(href)?.scrollIntoView()
      history.replaceState(null, '', href)
    })
  }

  const liensMenu = [LIENS[0], { libelle: 'Voir une boutique', href: lienBoutique, externe: true }, ...LIENS.slice(1)]

  return (
    <header className="w-entete">
      <div className="w-entete-barre">
        <Link href={CHEMIN_VITRINE} className="w-entete-logo" aria-label="Sonoo, accueil">
          <Logo hauteur={30} />
        </Link>
        <nav className="w-entete-nav" aria-label="Navigation principale">
          {liensMenu.map(l =>
            'externe' in l ? (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                {l.libelle}
              </a>
            ) : (
              <a key={l.href} href={l.href}>
                {l.libelle}
              </a>
            )
          )}
        </nav>
        <div className="w-entete-actions">
          <Link href="/connexion" className="w-entete-connexion">
            Connexion
          </Link>
          <Link href={CHEMIN_INSCRIPTION} className="w-bouton w-bouton-bleu w-bouton-petit">
            Essai gratuit
          </Link>
          <button
            ref={boutonMenu}
            type="button"
            className="w-bouton-rond w-entete-burger"
            aria-label="Ouvrir le menu"
            aria-expanded={ouvert}
            aria-controls="w-menu-mobile"
            onClick={() => setOuvert(true)}
          >
            <Menu taille={22} />
          </button>
        </div>
      </div>

      {ouvert && (
        <div id="w-menu-mobile" className="w-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="w-entete-barre">
            <Link href={CHEMIN_VITRINE} className="w-entete-logo" aria-label="Sonoo, accueil" onClick={fermer}>
              <Logo hauteur={30} />
            </Link>
            <button ref={boutonFermer} type="button" className="w-bouton-rond" aria-label="Fermer le menu" onClick={fermer}>
              <Croix taille={22} />
            </button>
          </div>
          <nav className="w-menu-liens" aria-label="Navigation principale">
            {liensMenu.map((l, i) => {
              const contenu = (
                <>
                  <span className="w-menu-numero">{String(i + 1).padStart(2, '0')}</span>
                  <span className="w-menu-libelle">{l.libelle}</span>
                  <FlecheDiagonale taille={20} />
                </>
              )
              return 'externe' in l ? (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" onClick={fermer}>
                  {contenu}
                </a>
              ) : (
                <a key={l.href} href={l.href} onClick={e => allerA(e, l.href)}>
                  {contenu}
                </a>
              )
            })}
          </nav>
          <Symbole hauteur={460} couleur="#e9e7e2" className="w-menu-deco" />
          <div className="w-menu-actions">
            <p className="w-menu-accroche">
              <Etincelle taille={12} className="w-etiquette-etoile" />
              Essai gratuit · 0 % de commission
            </p>
            <Link href={CHEMIN_INSCRIPTION} className="w-bouton w-bouton-bleu w-bouton-large">
              Commencer l’essai gratuit
              <Fleche taille={20} />
            </Link>
            <Link href="/connexion" className="w-bouton w-bouton-contour w-bouton-large">
              Connexion
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
