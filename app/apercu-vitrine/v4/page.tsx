import Link from 'next/link'
import type { CSSProperties } from 'react'
import { adresseBoutique } from '@/lib/adresse-boutique'
import { EMAIL_CONTACT } from '@/lib/constantes'
import { EnTete } from './_composants/EnTete'
import { Faq } from './_composants/Faq'
import { MaquetteMarque, MaquetteRelance, MaquetteTableau } from './_composants/Maquettes'
import { Logo, Symbole } from './_composants/Logo'
import { CHEMIN_INSCRIPTION, SLUG_BOUTIQUE_EXEMPLE } from './_composants/liens'
import { sansAccents as sa } from './_composants/sansAccents'
import * as I from './_composants/Icones'
import * as M from './_composants/IconesMarque'

// Page test « v4 » : une AUTRE interprétation du retour envoyé au designer le 2026-11-16
// (design/charte-v2/retour-jake/NOTES.md), à comparer avec la v3. Priorité ordinateur.
// - haut de page NOIR : 3 couches d'interface Sonoo empilées (boutique, clients, paiements),
//   inspiration Stable ; ambiance studio sans photo (grain, onde du logo) ;
// - sections = panneaux arrondis aux 4 coins qui se chevauchent (noir, crème, bleu) ;
// - section bleue = « L'histoire » (logo Jake B) ; le 0 % devient une ligne géante sur crème ;
// - tous les titres en Surgena (version d'essai, sans accents) ; chiffres des maquettes en Space Grotesk ;
// - visuels = maquettes codées (_composants/Maquettes.tsx), sans fond plaqué ni photo.

const OUTILS = [
  { icone: M.MarqueBoutique, nom: 'Boutique' },
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

const CLIENTS_COUCHE = [
  { initiales: 'LM', nom: 'Luka M.', statut: 'Gold', classe: 'y-statut-gold' },
  { initiales: 'NK', nom: 'Naya K.', statut: 'Fidèle', classe: 'y-statut-fidele' },
  { initiales: 'TR', nom: 'Théo R.', statut: 'À relancer', classe: 'y-statut-relance' },
]

// Tarifs façon Deezer : même liste sur les deux cartes, cochée ou barrée.
const FONCTIONS = [
  { texte: 'Ta part des ventes en collab', gratuit: true },
  { texte: 'Accès au compte Sonoo', gratuit: true },
  { texte: 'Boutique sur ton nom de domaine', gratuit: false },
  { texte: 'Clients, e-mails et automatisations', gratuit: false },
  { texte: 'Abonnements et codes promo', gratuit: false },
  { texte: 'Contrats et factures automatiques', gratuit: false },
  { texte: 'Statistiques complètes', gratuit: false },
]


export default function ApercuVitrineV4Page() {
  const lienBoutique = adresseBoutique(SLUG_BOUTIQUE_EXEMPLE, null).accueil
  const contact = `mailto:${EMAIL_CONTACT}`


  return (
    <>
      <a href="#y-contenu" className="y-evitement">
        Aller au contenu
      </a>
      <EnTete lienBoutique={lienBoutique} />

      <main id="y-contenu">
        {/* ——— Accueil : fond noir, couches Sonoo empilées ——— */}
        <section className="y-hero4 y-grain">
          <Symbole hauteur={900} couleur="#ffffff" className="y-hero4-onde" />
          <div className="y-conteneur y-hero4-grille">
            <div className="y-hero4-texte">
              <h1 className="y-titre-1">
                {sa('Tes beats méritent mieux')} <span className="y-titre-bleu">{sa('qu’une marketplace.')}</span>
              </h1>
              <p className="y-hero-texte">Ta boutique, tes clients, ton argent. Sans intermédiaire.</p>
              <div className="y-hero-boutons">
                <Link href={CHEMIN_INSCRIPTION} className="y-bouton y-bouton-bleu y-bouton-grand">
                  Commencer l’essai gratuit
                  <I.Fleche taille={20} />
                </Link>
                <a href={lienBoutique} target="_blank" rel="noopener noreferrer" className="y-bouton y-bouton-sombre y-bouton-grand">
                  <I.Lecture taille={20} />
                  Voir une boutique
                </a>
              </div>
            </div>

            <div className="y-pile-zone" aria-hidden="true">
              <div className="y-pile">
                {/* Couche du bas : paiements */}
                <div className="y-couche y-couche-paiement" style={{ '--i': 0 } as CSSProperties}>
                  <span className="y-couche-tete">Versé sur ton compte</span>
                  <strong className="y-couche-gros">+ 4 280 €</strong>
                  <span className="y-couche-pastille">0 % de commission</span>
                </div>
                {/* Couche du milieu : clients */}
                <div className="y-couche y-couche-clients" style={{ '--i': 1 } as CSSProperties}>
                  <span className="y-couche-tete">Tes clients</span>
                  <ul>
                    {CLIENTS_COUCHE.map(c => (
                      <li key={c.nom}>
                        <span className="y-couche-avatar">{c.initiales}</span>
                        <span className="y-couche-nom">{c.nom}</span>
                        <span className={`y-couche-statut ${c.classe}`}>{c.statut}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Couche du haut : la boutique */}
                <div className="y-couche y-couche-boutique" style={{ '--i': 2 } as CSSProperties}>
                  <span className="y-couche-barre">
                    <strong>JAKE B</strong>
                    <span className="y-couche-icone">
                      <I.Boutique taille={14} />
                    </span>
                  </span>
                  <span className="y-couche-pochettes">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="y-couche-lecteur">
                    <span className="y-couche-play">
                      <I.Lecture taille={12} />
                    </span>
                    <span>
                      <strong>Ambitieux</strong>
                      <small>Trap · 142 BPM</small>
                    </span>
                    <strong className="y-couche-prix">49 €</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* ——— 01 Ta marque — panneau crème ——— */}
        <section id="fonctionnalites" className="y-panneau y-panneau-creme y-ancre">
          <div className="y-conteneur y-marque4">
            <div className="y-marque4-texte">
              <h2 className="y-titre-2">Ta marque au premier plan.</h2>
              <p className="y-phrase4">Tes couleurs, ton logo, ton nom de domaine. Sonoo reste en coulisses.</p>
              <a href={lienBoutique} target="_blank" rel="noopener noreferrer" className="y-lien-fleche">
                Voir une boutique
                <I.Fleche taille={16} />
              </a>
            </div>
            <div className="y-marque4-visuel y-deborde">
              <MaquetteMarque />
            </div>
          </div>
        </section>

        {/* ——— 02 Croissance — panneau noir ——— */}
        <section className="y-panneau y-panneau-noir y-grain">
          <div className="y-conteneur">
            <div className="y-tete4">
              <h2 className="y-titre-2 y-centre">{sa('Vends plus. Fidélise mieux.')}</h2>
              <p className="y-phrase4 y-centre">Sonoo relance tes clients au bon moment, tout seul.</p>
            </div>
            <div className="y-relance4 y-deborde">
              <MaquetteRelance />
            </div>
          </div>
        </section>

        {/* ——— 0 % — ligne géante sur crème ——— */}
        <section className="y-panneau y-panneau-creme y-zero4-panneau">
          <div className="y-conteneur">
            <p className="y-zero4">
              <span className="y-zero4-chiffre">0 %</span> de commission.
            </p>
            <div className="y-zero4-bas">
              <p className="y-phrase4">L’argent va directement de l’acheteur à toi. Sonoo n’y touche jamais.</p>
              <span className="y-flux4" role="img" aria-label="49 € vont directement de l’acheteur à toi, Sonoo prélève 0 €">
                <span>Acheteur</span>
                <span className="y-flux4-trait">49 €</span>
                <span className="y-flux4-toi">Toi</span>
              </span>
            </div>
          </div>
        </section>

        {/* ——— 03 Tout-en-un — panneau noir, écran incliné ——— */}
        <section className="y-panneau y-panneau-noir y-grain y-tout4">
          <div className="y-conteneur">
            <div className="y-tete4">
              <h2 className="y-titre-2 y-centre">Un seul abonnement. Au lieu de cinq outils.</h2>
            </div>
            <ul className="y-outils4">
              {OUTILS.map(o => (
                <li key={o.nom}>
                  <o.icone taille={20} />
                  {o.nom}
                </li>
              ))}
            </ul>
            <div className="y-ecran4 y-deborde">
              <MaquetteTableau />
            </div>
          </div>
        </section>

        {/* ——— L'histoire — panneau crème, logo Jake B ——— */}
        <section className="y-panneau y-panneau-creme y-histoire4-panneau">
          <div className="y-conteneur y-histoire4">
            <div className="y-histoire4-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/apercu-vitrine/v3/logo-jake-b-blanc.png" alt="Logo de Jake B" width={1200} height={1200} />
            </div>
            <div>
              <h2 className="y-titre-2">{sa('Créé par un beatmaker, pour les beatmakers.')}</h2>
              <p className="y-phrase4">Jake B compose sur YouTube depuis 2019. Sonoo, c’est le système qu’il a construit pour vivre de ses beats.</p>
              <dl className="y-chiffres4">
                {CHIFFRES_JAKE.map(c => (
                  <div key={c.valeur}>
                    <dt>{c.valeur}</dt>
                    <dd>{c.texte}</dd>
                  </div>
                ))}
              </dl>
              <p className="y-chiffres4-note">Le parcours de Jake B, fondateur — pas des résultats clients Sonoo.</p>
            </div>
          </div>
        </section>

        {/* ——— Tarifs + affiliation — panneau noir ——— */}
        <section id="tarifs" className="y-panneau y-panneau-noir y-grain y-tarifs4 y-ancre">
          <div className="y-conteneur">
            <h2 className="y-titre-2 y-centre">{sa('Un prix simple. Zéro commission.')}</h2>
            <div className="y-offres4">
              <article className="y-offre4 y-offre4-pro">
                <span className="y-offre4-pastille">Pro</span>
                <p className="y-offre4-prix">
                  49 € <small>/ mois</small>
                </p>
                <p className="y-offre4-sous">Ta boutique et tous les outils. Essai gratuit.</p>
                <Link href={CHEMIN_INSCRIPTION} className="y-bouton y-bouton-bleu y-bouton-large">
                  Commencer l’essai gratuit
                </Link>
                <ul className="y-offre4-liste">
                  {FONCTIONS.map(f => (
                    <li key={f.texte}>
                      <span className="y-offre4-icone">
                        <I.Coche taille={12} />
                      </span>
                      {f.texte}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="y-offre4 y-offre4-gratuit">
                <span className="y-offre4-pastille">Gratuit</span>
                <p className="y-offre4-prix">
                  0 € <small>/ mois</small>
                </p>
                <p className="y-offre4-sous">Pour recevoir ta part des ventes en collab.</p>
                <Link href={CHEMIN_INSCRIPTION} className="y-bouton y-bouton-blanc y-bouton-large">
                  Créer un compte gratuit
                </Link>
                <ul className="y-offre4-liste">
                  {FONCTIONS.map(f => (
                    <li key={f.texte} className={f.gratuit ? undefined : 'y-offre4-absent'}>
                      <span className="y-offre4-icone">{f.gratuit ? <I.Coche taille={12} /> : <I.Croix taille={12} />}</span>
                      {f.texte}
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            <div id="affiliation" className="y-affil4 y-ancre">
              <div>
                <span className="y-affil4-pastille">Bientôt</span>
                <h3 className="y-affil4-titre">{sa('Recommande Sonoo. Touche une commission sur chaque abonnement.')}</h3>
              </div>
              <a href={`${contact}?subject=${encodeURIComponent('Programme d’affiliation Sonoo')}`} className="y-bouton y-bouton-blanc y-bouton-grand">
                Être prévenu du lancement
                <I.Fleche taille={20} />
              </a>
            </div>
          </div>
        </section>

        {/* ——— FAQ + appel final — panneau crème ——— */}
        <section className="y-panneau y-panneau-creme y-fin4">
          <div id="faq" className="y-conteneur y-ancre y-faq">
            <div className="y-faq-intro">
              <h2 className="y-titre-2">{sa('Questions fréquentes')}</h2>
              <p className="y-faq-sous">Une autre question ? Notre équipe te répond.</p>
              <a href={contact} className="y-bouton y-bouton-contour y-bouton-petit">
                <I.Enveloppe taille={18} />
                Contacter l’équipe
              </a>
            </div>
            <Faq />
          </div>

          <div className="y-conteneur y-cta-section">
            <div className="y-cta y-grain">
              <Symbole hauteur={620} couleur="#141312" className="y-cta-deco" />
              <div className="y-cta-contenu">
                <h2 className="y-titre-cta">{sa('Arrête de louer ton audience. Construis ta marque.')}</h2>
                <p>Lance ta boutique Sonoo et garde la relation avec tes clients.</p>
                <div className="y-cta-boutons">
                  <Link href={CHEMIN_INSCRIPTION} className="y-bouton y-bouton-bleu y-bouton-grand">
                    Commencer l’essai gratuit
                    <I.Fleche taille={20} />
                  </Link>
                  <a href="#tarifs" className="y-bouton y-bouton-sombre y-bouton-grand">
                    Voir les tarifs
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="y-pied">
        <div className="y-conteneur">
          <div className="y-pied-haut">
            <div className="y-pied-marque">
              <Logo hauteur={32} sombre />
              <p>La plateforme e-commerce des beatmakers indépendants.</p>
              <ul className="y-reseaux" aria-label="Réseaux sociaux (liens à venir)">
                <li><I.YouTube taille={18} /></li>
                <li><I.Instagram taille={18} /></li>
                <li><I.TikTok taille={18} /></li>
              </ul>
            </div>
            <nav className="y-pied-colonnes" aria-label="Pied de page">
              <div>
                <p className="y-pied-titre">Produit</p>
                <ul>
                  <li><a href="#fonctionnalites">Fonctionnalités</a></li>
                  <li><a href={lienBoutique} target="_blank" rel="noopener noreferrer">Voir une boutique</a></li>
                  <li><a href="#tarifs">Tarifs</a></li>
                  <li><a href="#affiliation">Affiliation (bientôt)</a></li>
                </ul>
              </div>
              <div>
                <p className="y-pied-titre">Ressources</p>
                <ul>
                  <li><a href="#faq">FAQ</a></li>
                  <li><span>Chaîne YouTube</span></li>
                  <li><a href={contact}>Contact &amp; support</a></li>
                </ul>
              </div>
              <div>
                <p className="y-pied-titre">Compte</p>
                <ul>
                  <li><Link href="/connexion">Connexion</Link></li>
                  <li><Link href={CHEMIN_INSCRIPTION}>Essai gratuit</Link></li>
                </ul>
              </div>
              <div>
                <p className="y-pied-titre">Légal</p>
                <ul>
                  <li><span>Mentions légales</span></li>
                  <li><span>CGU / CGV</span></li>
                  <li><span>Confidentialité</span></li>
                  <li><span>Cookies</span></li>
                </ul>
              </div>
            </nav>
          </div>
          <div className="y-pied-bas">
            <span>© 2026 Sonoo. Tous droits réservés.</span>
            <span>Français (FR)</span>
          </div>
        </div>
      </footer>
    </>
  )
}
