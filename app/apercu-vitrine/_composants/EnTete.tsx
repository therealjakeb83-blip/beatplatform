'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Logo } from './Logo'
import { Chevron, Croix, Fleche, Menu } from './Icones'
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
      document.querySelector('.v-evitement'),
      document.querySelector('.v-entete > .v-entete-barre'),
      document.getElementById('v-contenu'),
      document.querySelector('.v-pied'),
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
    <header className="v-entete">
      <div className="v-entete-barre">
        <Link href={CHEMIN_VITRINE} className="v-entete-logo" aria-label="Sonoo, accueil">
          <Logo hauteur={30} />
        </Link>
        <nav className="v-entete-nav" aria-label="Navigation principale">
          {LIENS.map(l => (
            <a key={l.href} href={l.href}>
              {l.libelle}
            </a>
          ))}
        </nav>
        <div className="v-entete-actions">
          <Link href="/connexion" className="v-entete-connexion">
            Connexion
          </Link>
          <Link href={CHEMIN_INSCRIPTION} className="v-bouton v-bouton-bleu v-bouton-petit">
            Essai gratuit
          </Link>
          <button
            ref={boutonMenu}
            type="button"
            className="v-bouton-rond v-entete-burger"
            aria-label="Ouvrir le menu"
            aria-expanded={ouvert}
            aria-controls="v-menu-mobile"
            onClick={() => setOuvert(true)}
          >
            <Menu taille={22} />
          </button>
        </div>
      </div>

      {ouvert && (
        <div id="v-menu-mobile" className="v-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="v-entete-barre">
            <Link href={CHEMIN_VITRINE} className="v-entete-logo" aria-label="Sonoo, accueil" onClick={fermer}>
              <Logo hauteur={30} />
            </Link>
            <button ref={boutonFermer} type="button" className="v-bouton-rond" aria-label="Fermer le menu" onClick={fermer}>
              <Croix taille={22} />
            </button>
          </div>
          <nav className="v-menu-liens" aria-label="Navigation principale">
            {liensMenu.map(l =>
              'externe' in l ? (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" onClick={fermer}>
                  {l.libelle}
                  <Chevron taille={20} />
                </a>
              ) : (
                <a key={l.href} href={l.href} onClick={e => allerA(e, l.href)}>
                  {l.libelle}
                  <Chevron taille={20} />
                </a>
              )
            )}
          </nav>
          <div className="v-menu-actions">
            <Link href={CHEMIN_INSCRIPTION} className="v-bouton v-bouton-bleu v-bouton-large">
              Commencer l’essai gratuit
              <Fleche taille={20} />
            </Link>
            <Link href="/connexion" className="v-bouton v-bouton-contour v-bouton-large">
              Connexion
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
