import Link from 'next/link'
import { adresseBoutique } from '@/lib/adresse-boutique'
import { EMAIL_CONTACT } from '@/lib/constantes'
import { EnTete } from './_composants/EnTete'
import { Faq } from './_composants/Faq'
import { ImageAdaptative } from './_composants/ImageAdaptative'
import { Logo, Symbole } from './_composants/Logo'
import { CHEMIN_INSCRIPTION, SLUG_BOUTIQUE_EXEMPLE } from './_composants/liens'
import { sansAccents as sa } from './_composants/sansAccents'
import * as I from './_composants/Icones'
import * as M from './_composants/IconesMarque'

// Page test « v3 » : la v2 retravaillée selon le retour envoyé au designer le 2026-11-16
// (design/charte-v2/retour-jake/NOTES.md). Priorité ordinateur.
// - fonds alternés crème / noir / bleu, transitions arrondies (inspiration Deezer) ;
// - haut de page sans boutique : cartes Sonoo inclinées autour du titre (inspiration ChronoTask) ;
// - plus de rangées « icône + titre + texte » : une idée, une image, une phrase par section ;
// - texte et image qui changent de côté, annotations « à la main » (inspirations Pro Finance, HackerRank) ;
// - section 04 supprimée (contrats/factures cités dans « Tout-en-un », 0 % dans la section bleue) ;
// - « L'histoire » : logo Jake B au lieu de la photo ; aucune photo sur la page ;
// - Surgena seulement pour le grand titre du haut ; titres de section en Geist.
// Visuels (téléphones, relance, tableau de bord) : découpes WebP de la v2 (public/apercu-vitrine/v2).

function Etiquette({ children, centree = false }: { children: React.ReactNode; centree?: boolean }) {
  return (
    <p className={centree ? 'x-etiquette x-etiquette-centree' : 'x-etiquette'}>
      <I.Etincelle taille={12} className="x-etiquette-etoile" />
      {children}
    </p>
  )
}

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

const OUTILS = [
  { icone: M.MarqueBoutique, nom: 'Boutique' },
  { icone: M.MarqueCatalogue, nom: 'Catalogue' },
  { icone: M.MarqueLicence, nom: 'Licences' },
  { icone: I.Document, nom: 'Contrats & factures' },
  { icone: M.MarqueMembres, nom: 'Clients & e-mails' },
  { icone: M.MarqueStatistiques, nom: 'Statistiques' },
  { icone: M.MarquePaiementSecurise, nom: 'Paiements' },
]

const CHIFFRES_JAKE = [
  { valeur: '220 k€+', texte: 'générés grâce à ses beats' },
  { valeur: '50 k', texte: 'abonnés YouTube' },
  { valeur: '250 M+', texte: 'streams sur sa musique' },
]

const OFFRE_GRATUITE = ['Réception automatique de ta part sur les ventes en collab', 'Accès au compte Sonoo', '[Autres fonctionnalités à confirmer]']
const OFFRE_PRO = [
  'Boutique personnalisable sur ton nom de domaine',
  'Fichier clients, campagnes e-mail et automatisations',
  'Abonnements, codes promo et téléchargements gratuits',
  'Contrats de licence et factures automatiques',
  'Statistiques complètes',
  'Import de tes clients et de tes ventes',
  '0 % de commission sur tes ventes',
]

const BARRES_REVENUS = [38, 52, 44, 60, 56, 72, 66, 84, 78, 100]

const img = (nom: string, largeur: number, hauteur: number) => ({ src: `/apercu-vitrine/v2/${nom}.webp`, largeur, hauteur })

export default function ApercuVitrineV3Page() {
  const lienBoutique = adresseBoutique(SLUG_BOUTIQUE_EXEMPLE, null).accueil
  const contact = `mailto:${EMAIL_CONTACT}`

  const telephones = img('telephones-ordinateur', 2564, 1740)
  const relance = img('relance-ordinateur', 2564, 1375)
  const tableau = img('tableau-ordinateur', 2564, 1630)

  return (
    <>
      <a href="#x-contenu" className="x-evitement">
        Aller au contenu
      </a>
      <EnTete lienBoutique={lienBoutique} />

      <main id="x-contenu">
        {/* ——— Accueil : titre centré, cartes Sonoo inclinées autour ——— */}
        <section className="x-hero3">
          <div className="x-conteneur x-hero3-scene">
            <div className="x-flottant x-flottant-vente" aria-hidden="true">
              <span className="x-flottant-tete">
                <span className="x-point-vert" />
                Nouvelle vente
              </span>
              <span className="x-flottant-ligne">
                <span className="x-pochette" />
                <span>
                  <strong>Ambitieux</strong>
                  <small>Licence WAV · Luka M.</small>
                </span>
                <strong className="x-flottant-montant">+49 €</strong>
              </span>
            </div>

            <div className="x-flottant x-flottant-revenus" aria-hidden="true">
              <span className="x-flottant-tete">Revenus · 30 jours</span>
              <strong className="x-flottant-gros">4 280 €</strong>
              <span className="x-flottant-hausse">+12,4 %</span>
              <span className="x-mini-barres">
                {BARRES_REVENUS.map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </span>
            </div>

            <div className="x-flottant x-flottant-relance" aria-hidden="true">
              <span className="x-avatar">LM</span>
              <span>
                <strong>Luka M. est revenu</strong>
                <small>grâce à la relance automatique</small>
              </span>
            </div>

            <div className="x-flottant x-flottant-membre" aria-hidden="true">
              <span className="x-flottant-icone">
                <I.Couronne taille={18} />
              </span>
              <span>
                <strong>Nouveau membre Gold</strong>
                <small>Naya K. · 9,99 € / mois</small>
              </span>
            </div>

            <div className="x-flottant x-flottant-symbole" aria-hidden="true">
              <Symbole hauteur={30} couleur="#2477fb" />
            </div>

            <div className="x-hero3-centre">
              <p className="x-badge">
                <I.Etincelle taille={14} className="x-etiquette-etoile" />
                La plateforme e-commerce des beatmakers
              </p>
              <h1 className="x-titre-1">
                {sa('Tes beats méritent mieux')} <span className="x-titre-bleu">{sa('qu’une marketplace.')}</span>
              </h1>
              <p className="x-hero-texte">
                Ta boutique à ton image, tes clients rien qu’à toi et tous les outils pour faire grandir ton business.
              </p>
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
              <ul className="x-hero-preuves">
                {['0 % de commission', 'Paiements directs', 'Ton nom de domaine'].map(t => (
                  <li key={t}>
                    <I.Coche taille={16} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ——— 01 Ta marque — fond noir, texte à gauche ——— */}
        <section id="fonctionnalites" className="x-bande x-bande-noir x-ancre">
          <div className="x-conteneur x-duo">
            <div className="x-duo-texte">
              <Etiquette>01 — Ta marque</Etiquette>
              <h2 className="x-titre-2">Ta marque au premier plan. Sonoo reste en coulisses.</h2>
              <p className="x-duo-phrase">Tes couleurs, ton logo, ton nom de domaine. Sonoo ne se voit pas.</p>
              <a href={lienBoutique} target="_blank" rel="noopener noreferrer" className="x-lien-fleche x-lien-clair">
                Voir une boutique
                <I.Fleche taille={16} />
              </a>
            </div>
            <div className="x-duo-visuel x-deborde-droite">
              <ImageAdaptative
                className="x-visuel"
                alt="Trois boutiques personnalisées sur mobile : Jake B (beats.jakebmusic.com), ACHPRODD (sonoo.app/achprodd) et Nehzia (sonoo.app/nehzia)"
                ordinateur={telephones}
                tablette={telephones}
                mobile={telephones /* les 3 téléphones entiers, rien de coupé (retour de Jake sur la v2 mobile) */}
              />
              <Annotation texte="sur ton propre nom de domaine" className="x-annot-marque" />
            </div>
          </div>
        </section>

        {/* ——— 02 Croissance — fond crème, image à gauche ——— */}
        <section className="x-bande x-bande-creme">
          <div className="x-conteneur x-duo x-duo-inverse">
            <div className="x-duo-visuel x-deborde-gauche">
              <ImageAdaptative
                className="x-visuel"
                alt="Un client inactif depuis 60 jours reçoit un e-mail « Ça fait longtemps, Luka » avec un code promo, revient et s’abonne à 9,99 € par mois"
                ordinateur={relance}
                tablette={relance}
                mobile={img('relance-mobile', 780, 1378)}
              />
              <Annotation texte="envoyé tout seul, au bon moment" className="x-annot-relance" sens="bas-droite" />
            </div>
            <div className="x-duo-texte">
              <Etiquette>02 — Croissance</Etiquette>
              <h2 className="x-titre-2">Vends plus. Fidélise mieux.</h2>
              <p className="x-duo-phrase">Sonoo relance tes clients au bon moment et transforme tes fans en abonnés.</p>
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
              <h2 className="x-titre-2">de commission sur tes ventes.</h2>
              <p className="x-duo-phrase">L’argent va directement de l’acheteur à toi. Sonoo n’y touche jamais.</p>
              <div className="x-zero3-flux" role="img" aria-label="49 € vont directement de l’acheteur à ta boutique, Sonoo prélève 0 €">
                <span className="x-zero3-bout">
                  <I.Personne taille={20} />
                  Acheteur
                </span>
                <span className="x-zero3-trait">49 €</span>
                <span className="x-zero3-bout x-zero3-bout-plein">
                  <I.Boutique taille={20} />
                  Toi
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ——— 03 Tout-en-un — fond noir ——— */}
        <section className="x-bande x-bande-noir">
          <div className="x-conteneur">
            <div className="x-tete x-tete3">
              <div>
                <Etiquette>03 — Tout-en-un</Etiquette>
                <h2 className="x-titre-2">Un seul abonnement. Au lieu de cinq outils.</h2>
              </div>
              <p className="x-tete-texte">
                Boutique, licences, contrats et factures automatiques, clients, marketing, statistiques : tout se pilote d’ici.
              </p>
            </div>
            <ul className="x-outils">
              {OUTILS.map(o => (
                <li key={o.nom}>
                  <o.icone taille={22} />
                  {o.nom}
                </li>
              ))}
            </ul>
            <div className="x-tableau3">
              <ImageAdaptative
                className="x-tableau"
                alt="Le tableau de bord Sonoo : revenus des 30 derniers jours, ventes en direct, clients, top beats et automatisations"
                ordinateur={tableau}
                tablette={tableau}
                mobile={img('tableau-mobile', 660, 1320)}
              />
              <Annotation texte="tout ton business sur un seul écran" className="x-annot-tableau" />
            </div>
          </div>
        </section>

        {/* ——— 05 L'histoire — fond crème, logo Jake B ——— */}
        <section className="x-bande x-bande-creme">
          <div className="x-conteneur x-histoire3">
            <div className="x-logo-jb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/apercu-vitrine/v3/logo-jake-b-blanc.png" alt="Logo de Jake B" width={1200} height={1200} />
            </div>
            <div className="x-histoire-texte">
              <Etiquette>04 — L’histoire</Etiquette>
              <h2 className="x-titre-2">Créé par un beatmaker, pour les beatmakers.</h2>
              <p className="x-histoire-intro">
                Jake B compose sur YouTube depuis 2019. Sonoo, c’est le système qu’il a construit pour vivre de ses beats.
              </p>
              <dl className="x-chiffres">
                {CHIFFRES_JAKE.map(c => (
                  <div key={c.valeur}>
                    <dt>{c.valeur}</dt>
                    <dd>{c.texte}</dd>
                  </div>
                ))}
              </dl>
              <p className="x-chiffres-note">Le parcours de Jake B, fondateur — pas des résultats clients Sonoo.</p>
            </div>
          </div>

          {/* ——— Affiliation (carte noire, la grande section bleue étant plus haut) ——— */}
          <div id="affiliation" className="x-conteneur x-ancre x-affiliation-section">
            <div className="x-affiliation x-affiliation-noire">
              <div className="x-affiliation-texte">
                <span className="x-pastille-claire">
                  <span className="x-point x-point-blanc" />
                  Programme d’affiliation · bientôt
                </span>
                <h2 className="x-titre-3">Recommande Sonoo. Touche une commission sur chaque abonnement.</h2>
                <a href={`${contact}?subject=${encodeURIComponent('Programme d’affiliation Sonoo')}`} className="x-bouton x-bouton-blanc x-bouton-grand">
                  Être prévenu du lancement
                  <I.Fleche taille={20} />
                </a>
              </div>
              <div className="x-carte-blanche x-parrainage" role="img" aria-label="Exemple de lien de parrainage, bientôt disponible">
                <div className="x-parrainage-tete">
                  <span>Ton lien de parrainage</span>
                  <span className="x-bientot">
                    <I.Etincelle taille={10} />
                    Bientôt
                  </span>
                </div>
                <div className="x-parrainage-lien">
                  <span className="x-mono">sonoo.app/r/jakeb</span>
                  <span className="x-parrainage-copier">
                    <I.Copier taille={16} />
                  </span>
                </div>
                <dl className="x-parrainage-lignes">
                  <div>
                    <dt>Beatmakers parrainés</dt>
                    <dd>—</dd>
                  </div>
                  <div>
                    <dt>Commission</dt>
                    <dd className="x-ambre">[Taux à définir]</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* ——— Tarifs — fond noir ——— */}
        <section id="tarifs" className="x-bande x-bande-noir x-tarifs3 x-ancre">
          <div className="x-conteneur">
            <Etiquette centree>Tarifs</Etiquette>
            <h2 className="x-titre-2 x-centre">Un prix simple. Zéro commission.</h2>
            <p className="x-tete-texte x-centre x-tarifs-intro">Un abonnement fixe, tous les outils inclus.</p>
            <div className="x-offres">
              <article className="x-offre">
                <div className="x-offre-tete">
                  <h3>Gratuit</h3>
                  <span className="x-gris-pastille">Pour collaborer</span>
                </div>
                <p className="x-offre-desc">Pour recevoir ta part des ventes de beats en collab réalisées sur les boutiques Pro.</p>
                <p className="x-offre-prix">
                  0 € <small>/ mois</small>
                </p>
                <Link href={CHEMIN_INSCRIPTION} className="x-bouton x-bouton-contour x-bouton-large">
                  Créer un compte gratuit
                </Link>
                <ul className="x-offre-liste">
                  {OFFRE_GRATUITE.map(t => (
                    <li key={t}>
                      <span className="x-coche-ronde">
                        <I.Coche taille={12} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="x-offre x-offre-pro">
                <div className="x-offre-tete">
                  <h3>Pro</h3>
                  <span className="x-bientot x-bientot-plein">
                    <I.Etincelle taille={10} />
                    Essai gratuit
                  </span>
                </div>
                <p className="x-offre-desc">Pour créer ta boutique et accéder à tous les outils.</p>
                <p className="x-offre-prix">
                  [XX] € <small>/ mois · prix à confirmer</small>
                </p>
                <Link href={CHEMIN_INSCRIPTION} className="x-bouton x-bouton-bleu x-bouton-large">
                  Commencer l’essai gratuit
                </Link>
                <ul className="x-offre-liste">
                  {OFFRE_PRO.map(t => (
                    <li key={t}>
                      <span className="x-coche-ronde">
                        <I.Coche taille={12} />
                      </span>
                      {t}
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
              <Etiquette>FAQ</Etiquette>
              <h2 className="x-titre-2">Questions fréquentes</h2>
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
                <Etiquette>Prêt à te lancer ?</Etiquette>
                <h2 className="x-titre-cta">Arrête de louer ton audience. Construis ta marque.</h2>
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
    </>
  )
}
