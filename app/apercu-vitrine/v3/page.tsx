import Link from 'next/link'
import { adresseBoutique } from '@/lib/adresse-boutique'
import { EMAIL_CONTACT } from '@/lib/constantes'
import { EnTete } from './_composants/EnTete'
import { Faq } from './_composants/Faq'
import { MaquetteMarque, MaquetteRelance } from './_composants/Maquettes'
import { ToutEnUn } from './_composants/ToutEnUn'
import { Logo, Symbole } from './_composants/Logo'
import { CHEMIN_INSCRIPTION, CHEMIN_VITRINE, SLUG_BOUTIQUE_EXEMPLE } from './_composants/liens'
import { sansAccents } from './_composants/sansAccents'
import * as I from './_composants/Icones'

// Page test « v3 » : la v2 retravaillée selon le retour envoyé au designer le 2026-11-16
// (design/charte-v2/retour-jake/NOTES.md). Priorité ordinateur.
// - fonds alternés crème / noir / bleu, transitions arrondies (inspiration Deezer) ;
// - haut de page sans boutique : cartes Sonoo inclinées autour du titre (inspiration ChronoTask) ;
// - plus de rangées « icône + titre + texte » : une idée, une image, une phrase par section ;
// - texte et image qui changent de côté, annotations « à la main » (inspirations Pro Finance, HackerRank) ;
// - section 04 supprimée (contrats/factures cités dans « Tout-en-un », 0 % dans la section bleue) ;
// - « L'histoire » : logo Jake B au lieu de la photo ; aucune photo sur la page ;
// - 2026-11-18 : TOUS les titres en Surgena (comme la v4/v5) + test des polices du designer (?police=).
// 2026-11-18 (demande de Jake) : même quantité d'information que la v4/v5 (textes allégés, étiquettes
// au-dessus des titres retirées, schéma Acheteur → Toi retiré, tarifs façon v4) et mêmes maquettes
// codées (_composants/Maquettes.tsx, ToutEnUn.tsx) ; la présentation v3 et les annotations à la main restent.

/** Annotation « écrite à la main » avec une flèche courbe. */
function Annotation({ texte, className, sens = 'bas-gauche' }: { texte: string; className: string; sens?: 'bas-gauche' | 'bas-droite' }) {
  return (
    <span className={`x-annotation ${className}`} aria-hidden="true">
      <span className="x-annotation-texte">{texte}</span>
      <svg className={`x-annotation-fleche x-annotation-${sens}`} width="64" height="56" viewBox="0 0 64 56" fill="none">
        <path d="M58 4C46 10 30 18 22 34c-3 6-4 11-4 16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M10 42l8 9 8-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

// Test des polices de titres du designer (Brand Style Guide_TH, 2026-11-18) : ?police=…
const POLICES = [
  { cle: 'surgena', nom: 'Surgena' },
  { cle: 'poppins', nom: 'Poppins' },
  { cle: 'ubuntu', nom: 'Ubuntu' },
  { cle: 'calsans', nom: 'Cal Sans' },
] as const

const CHIFFRES_JAKE = [
  { valeur: '220 k€+', texte: 'générés grâce à ses beats' },
  { valeur: '50 k', texte: 'abonnés YouTube' },
  { valeur: '300 M+', texte: 'streams sur sa musique', source: 'Certifié by muso.ai' },
]

// Tarifs façon v4 : même liste sur les deux cartes, cochée ou barrée.
const FONCTIONS = [
  { texte: 'Ta part des ventes en collab', gratuit: true },
  { texte: 'Accès au compte Sonoo', gratuit: true },
  { texte: 'Boutique sur ton nom de domaine', gratuit: false },
  { texte: 'Clients, e-mails et automatisations', gratuit: false },
  { texte: 'Abonnements et codes promo', gratuit: false },
  { texte: 'Contrats et factures automatiques', gratuit: false },
  { texte: 'Statistiques complètes', gratuit: false },
]

export default async function ApercuVitrineV3Page({ searchParams }: { searchParams: Promise<{ police?: string }> }) {
  const { police: demandee } = await searchParams
  const police = POLICES.find(p => p.cle === demandee)?.cle ?? 'surgena'
  // Seule la version d'essai de Surgena n'a pas d'accents : les autres polices les gardent.
  const sa = police === 'surgena' ? sansAccents : (t: string) => t
  const lienBoutique = adresseBoutique(SLUG_BOUTIQUE_EXEMPLE, null).accueil
  const contact = `mailto:${EMAIL_CONTACT}`

  return (
    <>
      <a href="#x-contenu" className="x-evitement">
        Aller au contenu
      </a>
      <EnTete lienBoutique={lienBoutique} />

      <div className={`x-police-${police}`}>
      <main id="x-contenu">
        {/* ——— Accueil : titre centré, cartes Sonoo inclinées autour ——— */}
        <section className="x-hero3">
          <div className="x-conteneur x-hero3-scene">
            <div className="x-hero3-centre">
              <h1 className="x-titre-1">
                {sa('Tes beats méritent mieux')} <span className="x-titre-bleu">{sa('qu’une marketplace.')}</span>
              </h1>
              <p className="x-hero-texte">Ta boutique, tes clients, ton argent. Sans intermédiaire.</p>
              <div className="x-hero-boutons">
                <Link href={CHEMIN_INSCRIPTION} className="x-bouton x-bouton-bleu x-bouton-grand">
                  Commencer l’essai gratuit
                  <I.Fleche taille={20} />
                </Link>
                <a href={lienBoutique} target="_blank" rel="noopener noreferrer" className="x-bouton x-bouton-contour x-bouton-grand">
                  <I.Lecture taille={20} />
                  Voir une boutique
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ——— 01 Ta marque — fond noir, texte à gauche ——— */}
        <section id="fonctionnalites" className="x-bande x-bande-noir x-ancre">
          <div className="x-conteneur x-duo">
            <div className="x-duo-texte">
              <h2 className="x-titre-2">{sa('Ta marque au premier plan.')}</h2>
              <p className="x-duo-phrase">Tes couleurs, ton logo, ton nom de domaine. Sonoo reste en coulisses.</p>
              <a href={lienBoutique} target="_blank" rel="noopener noreferrer" className="x-lien-fleche x-lien-clair">
                Voir une boutique
                <I.Fleche taille={16} />
              </a>
            </div>
            <div className="x-duo-visuel x-maquette3">
              <MaquetteMarque />
              <Annotation texte="sur ton propre nom de domaine" className="x-annot-marque" />
            </div>
          </div>
        </section>

        {/* ——— 02 Croissance — fond crème : texte puis parcours de relance sur toute la largeur ——— */}
        <section className="x-bande x-bande-creme">
          <div className="x-conteneur">
            <div className="x-duo-texte x-relance3-texte">
              <h2 className="x-titre-2">{sa('Vends plus. Fidélise mieux.')}</h2>
              <p className="x-duo-phrase">Sonoo relance tes clients au bon moment, tout seul.</p>
            </div>
            <div className="x-maquette3 x-relance3">
              <MaquetteRelance />
              <Annotation texte="envoyé tout seul, au bon moment" className="x-annot-relance" sens="bas-droite" />
            </div>
          </div>
        </section>

        {/* ——— Section bleue pleine largeur : 0 % ——— */}
        <section className="x-bande x-bande-bleu">
          <div className="x-conteneur x-zero3">
            <p className="x-zero3-chiffre">
              0<span>%</span>
            </p>
            <div className="x-zero3-texte">
              <h2 className="x-titre-2">{sa('de commission.')}</h2>
              <p className="x-duo-phrase">L’argent va directement de l’acheteur à toi. Sonoo n’y touche jamais.</p>
            </div>
          </div>
        </section>

        {/* ——— 03 Tout-en-un — fond noir, carrousel de fenêtres (comme la v4) ——— */}
        <section className="x-bande x-bande-noir">
          <div className="x-conteneur">
            <div className="x-tete x-tete3">
              <h2 className="x-titre-2">{sa('Un seul abonnement. Au lieu de cinq outils.')}</h2>
            </div>
            <div className="x-tout3">
              <ToutEnUn />
              <Annotation texte="tout ton business au même endroit" className="x-annot-tableau" />
            </div>
          </div>
        </section>

        {/* ——— L'histoire — fond crème, logo Jake B ——— */}
        <section className="x-bande x-bande-creme">
          <div className="x-conteneur x-histoire3">
            <div className="x-logo-jb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/apercu-vitrine/v3/logo-jake-b-blanc.png" alt="Logo de Jake B" width={1200} height={1200} />
            </div>
            <div className="x-histoire-texte">
              <h2 className="x-titre-2">{sa('Créé par un beatmaker, pour les beatmakers.')}</h2>
              <p className="x-histoire-intro">
                Compositeur certifié multi-platine, Jake B publie sa musique sur YouTube depuis 2019. Sonoo, c’est le système qu’il a construit pour vivre de ses beats.
              </p>
              <dl className="x-chiffres">
                {CHIFFRES_JAKE.map(c => (
                  <div key={c.valeur}>
                    <dt>{c.valeur}</dt>
                    <dd>{c.texte}{c.source && <span style={{ display: 'flex', alignItems: 'center', gap: '0.4em', marginTop: '0.3em', fontSize: '0.8em' }}><span style={{ opacity: 0.6 }}>{c.source}</span><img src="/apercu-vitrine/muso-ai.png" alt="Logo muso.ai" width={64} height={48} style={{ height: '1.3em', width: 'auto' }} /></span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* ——— Affiliation (carte noire) : seulement « Bientôt », comme la v4 ——— */}
          <div id="affiliation" className="x-conteneur x-ancre x-affiliation-section">
            <div className="x-affiliation x-affiliation-noire x-affiliation3">
              <div className="x-affiliation-texte">
                <span className="x-pastille-claire">
                  <span className="x-point x-point-blanc" />
                  Bientôt
                </span>
                <h2 className="x-titre-3">{sa('Recommande Sonoo. Touche une commission sur chaque abonnement.')}</h2>
              </div>
              <a href={`${contact}?subject=${encodeURIComponent('Programme d’affiliation Sonoo')}`} className="x-bouton x-bouton-blanc x-bouton-grand">
                Être prévenu du lancement
                <I.Fleche taille={20} />
              </a>
            </div>
          </div>
        </section>

        {/* ——— Tarifs — fond noir (contenu de la v4 : Pro 49 €, même liste cochée / barrée) ——— */}
        <section id="tarifs" className="x-bande x-bande-noir x-tarifs3 x-ancre">
          <div className="x-conteneur">
            <h2 className="x-titre-2 x-centre">{sa('Un prix simple. Zéro commission.')}</h2>
            <div className="x-offres">
              <article className="x-offre x-offre-pro">
                <div className="x-offre-tete">
                  <h3>Pro</h3>
                </div>
                <p className="x-offre-desc">Ta boutique et tous les outils. Essai gratuit.</p>
                <p className="x-offre-prix">
                  49 € <small>/ mois</small>
                </p>
                <Link href={CHEMIN_INSCRIPTION} className="x-bouton x-bouton-bleu x-bouton-large">
                  Commencer l’essai gratuit
                </Link>
                <ul className="x-offre-liste">
                  {FONCTIONS.map(f => (
                    <li key={f.texte}>
                      <span className="x-coche-ronde">
                        <I.Coche taille={12} />
                      </span>
                      {f.texte}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="x-offre">
                <div className="x-offre-tete">
                  <h3>Gratuit</h3>
                </div>
                <p className="x-offre-desc">Pour recevoir ta part des ventes en collab.</p>
                <p className="x-offre-prix">
                  0 € <small>/ mois</small>
                </p>
                <Link href={CHEMIN_INSCRIPTION} className="x-bouton x-bouton-contour x-bouton-large">
                  Créer un compte gratuit
                </Link>
                <ul className="x-offre-liste">
                  {FONCTIONS.map(f => (
                    <li key={f.texte} className={f.gratuit ? undefined : 'x-offre-absent'}>
                      <span className="x-coche-ronde">{f.gratuit ? <I.Coche taille={12} /> : <I.Croix taille={12} />}</span>
                      {f.texte}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* ——— FAQ + appel final — fond crème ——— */}
        <section className="x-bande x-bande-creme x-bande-fin">
          <div id="faq" className="x-conteneur x-ancre x-faq">
            <div className="x-faq-intro">
              <h2 className="x-titre-2">{sa('Questions fréquentes')}</h2>
              <p className="x-faq-sous">Une autre question ? Notre équipe te répond.</p>
              <a href={contact} className="x-bouton x-bouton-contour x-bouton-petit">
                <I.Enveloppe taille={18} />
                Contacter l’équipe
              </a>
            </div>
            <Faq />
          </div>

          <div className="x-conteneur x-cta-section">
            <div className="x-cta">
              <Symbole hauteur={620} couleur="#141312" className="x-cta-deco" />
              <div className="x-cta-contenu">
                <h2 className="x-titre-cta">{sa('Arrête de louer ton audience. Construis ta marque.')}</h2>
                <p>Lance ta boutique Sonoo et garde la relation avec tes clients.</p>
                <div className="x-cta-boutons">
                  <Link href={CHEMIN_INSCRIPTION} className="x-bouton x-bouton-bleu x-bouton-grand">
                    Commencer l’essai gratuit
                    <I.Fleche taille={20} />
                  </Link>
                  <a href="#tarifs" className="x-bouton x-bouton-sombre x-bouton-grand">
                    Voir les tarifs
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="x-pied">
        <div className="x-conteneur">
          <div className="x-pied-haut">
            <div className="x-pied-marque">
              <Logo hauteur={32} sombre />
              <p>La plateforme e-commerce des beatmakers indépendants.</p>
              <ul className="x-reseaux" aria-label="Réseaux sociaux (liens à venir)">
                <li><I.YouTube taille={18} /></li>
                <li><I.Instagram taille={18} /></li>
                <li><I.TikTok taille={18} /></li>
              </ul>
            </div>
            <nav className="x-pied-colonnes" aria-label="Pied de page">
              <div>
                <p className="x-pied-titre">Produit</p>
                <ul>
                  <li><a href="#fonctionnalites">Fonctionnalités</a></li>
                  <li><a href={lienBoutique} target="_blank" rel="noopener noreferrer">Voir une boutique</a></li>
                  <li><a href="#tarifs">Tarifs</a></li>
                  <li><a href="#affiliation">Affiliation (bientôt)</a></li>
                </ul>
              </div>
              <div>
                <p className="x-pied-titre">Ressources</p>
                <ul>
                  <li><a href="#faq">FAQ</a></li>
                  <li><span>Chaîne YouTube</span></li>
                  <li><a href={contact}>Contact &amp; support</a></li>
                </ul>
              </div>
              <div>
                <p className="x-pied-titre">Compte</p>
                <ul>
                  <li><Link href="/connexion">Connexion</Link></li>
                  <li><Link href={CHEMIN_INSCRIPTION}>Essai gratuit</Link></li>
                </ul>
              </div>
              <div>
                <p className="x-pied-titre">Légal</p>
                <ul>
                  <li><span>Mentions légales</span></li>
                  <li><span>CGU / CGV</span></li>
                  <li><span>Confidentialité</span></li>
                  <li><span>Cookies</span></li>
                </ul>
              </div>
            </nav>
          </div>
          <div className="x-pied-bas">
            <span>© 2026 Sonoo. Tous droits réservés.</span>
            <span>Français (FR)</span>
          </div>
        </div>
      </footer>

      <nav className="x-test-polices" aria-label="Test des polices de titres">
        <span>Police des titres</span>
        {POLICES.map(p => (
          <Link key={p.cle} href={p.cle === 'surgena' ? CHEMIN_VITRINE : `${CHEMIN_VITRINE}?police=${p.cle}`} scroll={false} className={p.cle === police ? 'x-test-polices-actif' : undefined} aria-current={p.cle === police ? 'true' : undefined}>
            {p.nom}
          </Link>
        ))}
      </nav>
      </div>
    </>
  )
}
