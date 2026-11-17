import Link from 'next/link'
import type { CSSProperties } from 'react'
import { adresseBoutique } from '@/lib/adresse-boutique'
import { EMAIL_CONTACT } from '@/lib/constantes'
import { EnTete } from './_composants/EnTete'
import { Faq } from './_composants/Faq'
import { MaquetteMarque, MaquetteRelance } from './_composants/Maquettes'
import { ToutEnUn } from './_composants/ToutEnUn'
import { Logo, Symbole } from './_composants/Logo'
import { CHEMIN_INSCRIPTION, SLUG_BOUTIQUE_EXEMPLE } from './_composants/liens'
import { sansAccents as sa } from './_composants/sansAccents'
import * as I from './_composants/Icones'

// Page test « v5 » : la v4 à l’identique, couleurs des sections INVERSÉES (demande de Jake, 2026-11-17).
// Haut de page CRÈME, puis noir, crème, noir… dans le même ordre que la v4. En-tête inchangé.
// Les retouches de couleur propres à la v5 sont regroupées à la fin de vitrine5.css (bloc v5).

const CHIFFRES_JAKE = [
  { valeur: '220 k€+', texte: 'générés grâce à ses beats' },
  { valeur: '50 k', texte: 'abonnés YouTube' },
  { valeur: '300 M+', texte: 'streams sur sa musique', source: 'Certifié by muso.ai' },
]

const CLIENTS_COUCHE = [
  { initiales: 'LM', nom: 'Luka M.', statut: 'Gold', classe: 'z-statut-gold' },
  { initiales: 'NK', nom: 'Naya K.', statut: 'Fidèle', classe: 'z-statut-fidele' },
  { initiales: 'TR', nom: 'Théo R.', statut: 'À relancer', classe: 'z-statut-relance' },
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


export default function ApercuVitrineV5Page() {
  const lienBoutique = adresseBoutique(SLUG_BOUTIQUE_EXEMPLE, null).accueil
  const contact = `mailto:${EMAIL_CONTACT}`


  return (
    <>
      <a href="#z-contenu" className="z-evitement">
        Aller au contenu
      </a>
      <EnTete lienBoutique={lienBoutique} />

      <main id="z-contenu">
        {/* ——— Accueil : fond crème, couches Sonoo empilées ——— */}
        <section className="z-hero4">
          <Symbole hauteur={900} couleur="#050505" className="z-hero4-onde" />
          <div className="z-conteneur z-hero4-grille">
            <div className="z-hero4-texte">
              <h1 className="z-titre-1">
                {sa('Tes beats méritent mieux')} <span className="z-titre-bleu">{sa('qu’une marketplace.')}</span>
              </h1>
              <p className="z-hero-texte">Ta boutique, tes clients, ton argent. Sans intermédiaire.</p>
              <div className="z-hero-boutons">
                <Link href={CHEMIN_INSCRIPTION} className="z-bouton z-bouton-bleu z-bouton-grand">
                  Commencer l’essai gratuit
                  <I.Fleche taille={20} />
                </Link>
                <a href={lienBoutique} target="_blank" rel="noopener noreferrer" className="z-bouton z-bouton-sombre z-bouton-grand">
                  <I.Lecture taille={20} />
                  Voir une boutique
                </a>
              </div>
            </div>

            <div className="z-pile-zone" aria-hidden="true">
              <div className="z-pile">
                {/* Couche du bas : paiements */}
                <div className="z-couche z-couche-paiement" style={{ '--i': 0 } as CSSProperties}>
                  <span className="z-couche-tete">Versé sur ton compte</span>
                  <strong className="z-couche-gros">+ 4 280 €</strong>
                  <span className="z-couche-pastille">0 % de commission</span>
                </div>
                {/* Couche du milieu : clients */}
                <div className="z-couche z-couche-clients" style={{ '--i': 1 } as CSSProperties}>
                  <span className="z-couche-tete">Tes clients</span>
                  <ul>
                    {CLIENTS_COUCHE.map(c => (
                      <li key={c.nom}>
                        <span className="z-couche-avatar">{c.initiales}</span>
                        <span className="z-couche-nom">{c.nom}</span>
                        <span className={`z-couche-statut ${c.classe}`}>{c.statut}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Couche du haut : la boutique */}
                <div className="z-couche z-couche-boutique" style={{ '--i': 2 } as CSSProperties}>
                  <span className="z-couche-barre">
                    <strong>JAKE B</strong>
                    <span className="z-couche-icone">
                      <I.Boutique taille={14} />
                    </span>
                  </span>
                  <span className="z-couche-pochettes">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="z-couche-lecteur">
                    <span className="z-couche-play">
                      <I.Lecture taille={12} />
                    </span>
                    <span>
                      <strong>Ambitieux</strong>
                      <small>Trap · 142 BPM</small>
                    </span>
                    <strong className="z-couche-prix">49 €</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* ——— 01 Ta marque — panneau noir ——— */}
        <section id="fonctionnalites" className="z-panneau z-panneau-noir z-grain z-ancre">
          <div className="z-conteneur z-marque4">
            <div className="z-marque4-texte">
              <h2 className="z-titre-2">Ta marque au premier plan.</h2>
              <p className="z-phrase4">Tes couleurs, ton logo, ton nom de domaine. Sonoo reste en coulisses.</p>
              <a href={lienBoutique} target="_blank" rel="noopener noreferrer" className="z-lien-fleche">
                Voir une boutique
                <I.Fleche taille={16} />
              </a>
            </div>
            <div className="z-marque4-visuel z-deborde">
              <MaquetteMarque />
            </div>
          </div>
        </section>

        {/* ——— 02 Croissance — panneau crème ——— */}
        <section className="z-panneau z-panneau-creme">
          <div className="z-conteneur">
            <div className="z-tete4">
              <h2 className="z-titre-2 z-centre">{sa('Vends plus. Fidélise mieux.')}</h2>
              <p className="z-phrase4 z-centre">Sonoo relance tes clients au bon moment, tout seul.</p>
            </div>
            <div className="z-relance4 z-deborde">
              <MaquetteRelance />
            </div>
          </div>
        </section>

        {/* ——— 0 % — ligne géante sur crème ——— */}
        <section className="z-panneau z-panneau-bleu z-zero4-panneau">
          <div className="z-conteneur">
            <p className="z-zero4">
              <span className="z-zero4-chiffre">0 %</span> de commission.
            </p>
            <div className="z-zero4-bas">
              <p className="z-phrase4">L’argent va directement de l’acheteur à toi. Sonoo n’y touche jamais.</p>
            </div>
          </div>
        </section>

        {/* ——— 03 Tout-en-un — panneau crème, une fenêtre par outil (3 présentations à comparer) ——— */}
        <section className="z-panneau z-panneau-creme z-tout4">
          <div className="z-conteneur">
            <div className="z-tete4">
              <h2 className="z-titre-2 z-centre">Un seul abonnement. Au lieu de cinq outils.</h2>
            </div>
            <ToutEnUn />
          </div>
        </section>

        {/* ——— L’histoire — panneau noir, logo Jake B ——— */}
        <section className="z-panneau z-panneau-noir z-grain z-histoire4-panneau">
          <div className="z-conteneur z-histoire4">
            <div className="z-histoire4-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/apercu-vitrine/v3/logo-jake-b-blanc.png" alt="Logo de Jake B" width={1200} height={1200} />
            </div>
            <div>
              <h2 className="z-titre-2">{sa('Créé par un beatmaker, pour les beatmakers.')}</h2>
              <p className="z-phrase4">Compositeur certifié multi-platine, Jake B publie sa musique sur YouTube depuis 2019. Sonoo, c’est le système qu’il a construit pour vivre de ses beats.</p>
              <dl className="z-chiffres4">
                {CHIFFRES_JAKE.map(c => (
                  <div key={c.valeur}>
                    <dt>{c.valeur}</dt>
                    <dd>{c.texte}{c.source && <span style={{ display: 'flex', alignItems: 'center', gap: '0.4em', marginTop: '0.3em', fontSize: '0.8em' }}><span style={{ opacity: 0.6 }}>{c.source}</span><img src="/apercu-vitrine/muso-ai.png" alt="Logo muso.ai" width={64} height={48} style={{ height: '1.3em', width: 'auto' }} /></span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ——— Tarifs + affiliation — panneau crème ——— */}
        <section id="tarifs" className="z-panneau z-panneau-creme z-tarifs4 z-ancre">
          <div className="z-conteneur">
            <h2 className="z-titre-2 z-centre">{sa('Un prix simple. Zéro commission.')}</h2>
            <div className="z-offres4">
              <article className="z-offre4 z-offre4-pro">
                <span className="z-offre4-pastille">Pro</span>
                <p className="z-offre4-prix">
                  49 € <small>/ mois</small>
                </p>
                <p className="z-offre4-sous">Ta boutique et tous les outils. Essai gratuit.</p>
                <Link href={CHEMIN_INSCRIPTION} className="z-bouton z-bouton-bleu z-bouton-large">
                  Commencer l’essai gratuit
                </Link>
                <ul className="z-offre4-liste">
                  {FONCTIONS.map(f => (
                    <li key={f.texte}>
                      <span className="z-offre4-icone">
                        <I.Coche taille={12} />
                      </span>
                      {f.texte}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="z-offre4 z-offre4-gratuit">
                <span className="z-offre4-pastille">Gratuit</span>
                <p className="z-offre4-prix">
                  0 € <small>/ mois</small>
                </p>
                <p className="z-offre4-sous">Pour recevoir ta part des ventes en collab.</p>
                <Link href={CHEMIN_INSCRIPTION} className="z-bouton z-bouton-blanc z-bouton-large">
                  Créer un compte gratuit
                </Link>
                <ul className="z-offre4-liste">
                  {FONCTIONS.map(f => (
                    <li key={f.texte} className={f.gratuit ? undefined : 'z-offre4-absent'}>
                      <span className="z-offre4-icone">{f.gratuit ? <I.Coche taille={12} /> : <I.Croix taille={12} />}</span>
                      {f.texte}
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            <div id="affiliation" className="z-affil4 z-ancre">
              <div>
                <span className="z-affil4-pastille">Bientôt</span>
                <h3 className="z-affil4-titre">{sa('Recommande Sonoo. Touche une commission sur chaque abonnement.')}</h3>
              </div>
              <a href={`${contact}?subject=${encodeURIComponent('Programme d’affiliation Sonoo')}`} className="z-bouton z-bouton-blanc z-bouton-grand">
                Être prévenu du lancement
                <I.Fleche taille={20} />
              </a>
            </div>
          </div>
        </section>

        {/* ——— FAQ + appel final — panneau noir ——— */}
        <section className="z-panneau z-panneau-noir z-grain z-fin4">
          <div id="faq" className="z-conteneur z-ancre z-faq">
            <div className="z-faq-intro">
              <h2 className="z-titre-2">{sa('Questions fréquentes')}</h2>
              <p className="z-faq-sous">Une autre question ? Notre équipe te répond.</p>
              <a href={contact} className="z-bouton z-bouton-contour z-bouton-petit">
                <I.Enveloppe taille={18} />
                Contacter l’équipe
              </a>
            </div>
            <Faq />
          </div>

          <div className="z-conteneur z-cta-section">
            <div className="z-cta z-grain">
              <Symbole hauteur={620} couleur="#e6e2db" className="z-cta-deco" />
              <div className="z-cta-contenu">
                <h2 className="z-titre-cta">{sa('Arrête de louer ton audience. Construis ta marque.')}</h2>
                <p>Lance ta boutique Sonoo et garde la relation avec tes clients.</p>
                <div className="z-cta-boutons">
                  <Link href={CHEMIN_INSCRIPTION} className="z-bouton z-bouton-bleu z-bouton-grand">
                    Commencer l’essai gratuit
                    <I.Fleche taille={20} />
                  </Link>
                  <a href="#tarifs" className="z-bouton z-bouton-sombre z-bouton-grand">
                    Voir les tarifs
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="z-pied">
        <div className="z-conteneur">
          <div className="z-pied-haut">
            <div className="z-pied-marque">
              <Logo hauteur={32} sombre />
              <p>La plateforme e-commerce des beatmakers indépendants.</p>
              <ul className="z-reseaux" aria-label="Réseaux sociaux (liens à venir)">
                <li><I.YouTube taille={18} /></li>
                <li><I.Instagram taille={18} /></li>
                <li><I.TikTok taille={18} /></li>
              </ul>
            </div>
            <nav className="z-pied-colonnes" aria-label="Pied de page">
              <div>
                <p className="z-pied-titre">Produit</p>
                <ul>
                  <li><a href="#fonctionnalites">Fonctionnalités</a></li>
                  <li><a href={lienBoutique} target="_blank" rel="noopener noreferrer">Voir une boutique</a></li>
                  <li><a href="#tarifs">Tarifs</a></li>
                  <li><a href="#affiliation">Affiliation (bientôt)</a></li>
                </ul>
              </div>
              <div>
                <p className="z-pied-titre">Ressources</p>
                <ul>
                  <li><a href="#faq">FAQ</a></li>
                  <li><span>Chaîne YouTube</span></li>
                  <li><a href={contact}>Contact &amp; support</a></li>
                </ul>
              </div>
              <div>
                <p className="z-pied-titre">Compte</p>
                <ul>
                  <li><Link href="/connexion">Connexion</Link></li>
                  <li><Link href={CHEMIN_INSCRIPTION}>Essai gratuit</Link></li>
                </ul>
              </div>
              <div>
                <p className="z-pied-titre">Légal</p>
                <ul>
                  <li><span>Mentions légales</span></li>
                  <li><span>CGU / CGV</span></li>
                  <li><span>Confidentialité</span></li>
                  <li><span>Cookies</span></li>
                </ul>
              </div>
            </nav>
          </div>
          <div className="z-pied-bas">
            <span>© 2026 Sonoo. Tous droits réservés.</span>
            <span>Français (FR)</span>
          </div>
        </div>
      </footer>
    </>
  )
}
