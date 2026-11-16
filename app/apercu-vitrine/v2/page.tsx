import Link from 'next/link'
import { adresseBoutique } from '@/lib/adresse-boutique'
import { EMAIL_CONTACT } from '@/lib/constantes'
import { EnTete } from './_composants/EnTete'
import { Faq } from './_composants/Faq'
import { ImageAdaptative } from './_composants/ImageAdaptative'
import { Logo, Symbole } from './_composants/Logo'
import { CHEMIN_INSCRIPTION, SLUG_BOUTIQUE_EXEMPLE } from './_composants/liens'
import * as I from './_composants/Icones'
import * as M from './_composants/IconesMarque'

// Page test du site vitrine — maquettes de la charte v2 (design/charte-v2/sources/Maquettes site).
// Icônes : iconographie de marque (IconesMarque.tsx), placées comme sur la maquette.
// Les visuels complexes (boutique, téléphones, relance, tableau de bord) sont des découpes WebP des maquettes.

function Etiquette({ children, centree = false }: { children: React.ReactNode; centree?: boolean }) {
  return (
    <p className={centree ? 'w-etiquette w-etiquette-centree' : 'w-etiquette'}>
      <I.Etincelle taille={12} className="w-etiquette-etoile" />
      {children}
    </p>
  )
}

function Pastille({ ton, children }: { ton: 'vert' | 'bleu' | 'ambre'; children: React.ReactNode }) {
  return <span className={`w-pastille w-pastille-${ton}`}>{children}</span>
}

type Atout = { icone: (p: { taille?: number }) => React.ReactNode; titre: string; texte: string }

function Atouts({ liste, colonnes }: { liste: Atout[]; colonnes: 3 | 4 }) {
  return (
    <ul className={`w-atouts w-atouts-${colonnes}`}>
      {liste.map(a => (
        <li key={a.titre}>
          <span className="w-atout-icone">
            <a.icone taille={26} />
          </span>
          <h3>{a.titre}</h3>
          <p>{a.texte}</p>
        </li>
      ))}
    </ul>
  )
}

const ATOUTS_MARQUE: Atout[] = [
  { icone: M.MarqueDomaine, titre: 'Ton nom de domaine', texte: 'Ta boutique sur ton adresse, comme beats.tonnom.com.' },
  { icone: M.MarquePersonnalisation, titre: 'Ton identité', texte: 'Couleurs, logo, page d’accueil modulable : tout est à ton image.' },
  { icone: M.MarqueBoutique, titre: 'Pensée pour le mobile', texte: 'Lecteur intégré, filtres par style, ambiance ou BPM, paiement par carte, Apple Pay et Google Pay.' },
  { icone: M.MarqueCatalogue, titre: 'Beats réservés aux membres', texte: 'Playlists, catégories et exclusivités pour tes membres.' },
]

const ATOUTS_CROISSANCE: Atout[] = [
  { icone: M.MarqueMembres, titre: 'Tes clients t’appartiennent', texte: 'Achats, dépenses et goûts musicaux de chaque client. Importe ta base depuis BeatStars, Airbit ou toute autre source.' },
  { icone: M.MarqueCloud, titre: 'Des relances qui tournent seules', texte: 'Bienvenue, remerciement, relance des inactifs avec code promo : des e-mails à ton image, envoyés au bon moment.' },
  { icone: M.MarqueStatistiques, titre: 'Un revenu chaque mois', texte: 'Abonnements pour tes beats exclusifs, codes promo, offres groupées et téléchargements gratuits contre e-mail.' },
]

const OUTILS = [
  { icone: M.MarqueBoutique, nom: 'Boutique' },
  { icone: M.MarqueCatalogue, nom: 'Catalogue' },
  { icone: M.MarqueLicence, nom: 'Licences' },
  { icone: M.MarqueMembres, nom: 'Clients & e-mails' },
  { icone: M.MarqueStatistiques, nom: 'Statistiques' },
  { icone: M.MarquePaiementSecurise, nom: 'Paiements' },
]

const ATOUTS_TABLEAU: Atout[] = [
  { icone: M.MarqueStatistiques, titre: 'Ventes et revenus', texte: 'Suis ton chiffre d’affaires jour après jour, beat par beat.' },
  { icone: M.MarqueMembres, titre: 'Clients et membres', texte: 'Vois qui achète, qui revient et qui décroche.' },
  { icone: M.MarqueDomaine, titre: 'Top beats et trafic', texte: 'Écoutes, meilleures ventes, sources de trafic : tu ne rates aucune donnée.' },
]

const LIGNES_CONTRAT = [
  ['Date', '12 nov. 2026'],
  ['Licence', 'WAV · non exclusive'],
  ['Montant', '49,00 €'],
  ['TVA', 'Non applicable, art. 293 B du CGI'],
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

// La tablette reprend la découpe ordinateur (même composition sur la maquette).
const img = (nom: string, largeur: number, hauteur: number) => ({ src: `/apercu-vitrine/v2/${nom}.webp`, largeur, hauteur })

export default function ApercuVitrineV2Page() {
  const lienBoutique = adresseBoutique(SLUG_BOUTIQUE_EXEMPLE, null).accueil
  const contact = `mailto:${EMAIL_CONTACT}`

  const hero = img('hero-ordinateur', 2440, 1300)
  const telephones = img('telephones-ordinateur', 2564, 1740)
  const relance = img('relance-ordinateur', 2564, 1375)
  const tableau = img('tableau-ordinateur', 2564, 1630)

  return (
    <>
      <a href="#w-contenu" className="w-evitement">
        Aller au contenu
      </a>
      <EnTete lienBoutique={lienBoutique} />

      <main id="w-contenu">
        {/* ——— Accueil ——— */}
        <section className="w-hero w-conteneur">
          <p className="w-badge">
            <I.Etincelle taille={14} className="w-etiquette-etoile" />
            La plateforme e-commerce des beatmakers
          </p>
          <h1 className="w-titre-1">
            Tes beats méritent mieux <span className="w-titre-bleu">qu’une marketplace.</span>
          </h1>
          <p className="w-hero-texte">
            Ta boutique à ton image, tes clients rien qu’à toi et tous les outils pour faire grandir ton business. Sans
            commission sur tes ventes.
          </p>
          <div className="w-hero-boutons">
            <Link href={CHEMIN_INSCRIPTION} className="w-bouton w-bouton-bleu w-bouton-grand">
              Commencer l’essai gratuit
              <I.Fleche taille={20} />
            </Link>
            <a href={lienBoutique} target="_blank" rel="noopener noreferrer" className="w-bouton w-bouton-contour w-bouton-grand">
              <I.Lecture taille={20} />
              Voir une boutique
            </a>
          </div>
          <ul className="w-hero-preuves">
            {['0 % de commission', 'Paiements directs', 'Ton nom de domaine'].map(t => (
              <li key={t}>
                <I.Coche taille={16} />
                {t}
              </li>
            ))}
          </ul>
          <ImageAdaptative
            className="w-hero-visuel w-pleine-largeur-mobile"
            prioritaire
            alt="La boutique de Jake B sur ordinateur et sur mobile"
            ordinateur={hero}
            tablette={hero}
            mobile={img('hero-mobile', 780, 990)}
          />
        </section>

        {/* ——— 01 Ta marque ——— */}
        <section id="fonctionnalites" className="w-section w-conteneur w-ancre">
          <div className="w-tete">
            <div>
              <Etiquette>01 — Ta marque</Etiquette>
              <h2 className="w-titre-2">Ta marque au premier plan. Sonoo reste en coulisses.</h2>
            </div>
            <p className="w-tete-texte">
              Tes couleurs, ton logo, ton nom de domaine : ta boutique raconte ton univers. Sonoo n’apparaît que dans une
              discrète mention en pied de page.
            </p>
          </div>
          <ImageAdaptative
            className="w-visuel w-pleine-largeur-mobile"
            alt="Trois boutiques personnalisées sur mobile : Jake B (beats.jakebmusic.com), ACHPRODD (sonoo.app/achprodd) et Nehzia (sonoo.app/nehzia)"
            ordinateur={telephones}
            tablette={telephones}
            mobile={img('telephones-mobile', 780, 1334)}
          />
          <Atouts liste={ATOUTS_MARQUE} colonnes={4} />
        </section>

        {/* ——— 02 Croissance ——— */}
        <section className="w-section w-conteneur">
          <div className="w-tete-centree">
            <Etiquette centree>02 — Croissance</Etiquette>
            <h2 className="w-titre-2">Vends plus. Fidélise mieux.</h2>
            <p className="w-tete-texte">
              Sonoo garde le lien avec chacun de tes clients, les relance au bon moment et transforme tes fans en abonnés.
              Automatiquement.
            </p>
          </div>
          <ImageAdaptative
            className="w-visuel w-pleine-largeur-mobile"
            alt="Un client inactif depuis 60 jours reçoit un e-mail « Ça fait longtemps, Luka » avec un code promo, revient et s’abonne à 9,99 € par mois"
            ordinateur={relance}
            tablette={relance}
            mobile={img('relance-mobile', 780, 1378)}
          />
          <Atouts liste={ATOUTS_CROISSANCE} colonnes={3} />
        </section>

        {/* ——— 03 Tout-en-un ——— */}
        <section className="w-sombre">
          <div className="w-section w-conteneur">
            <div className="w-tete">
              <div>
                <Etiquette>03 — Tout-en-un</Etiquette>
                <h2 className="w-titre-2">Un seul abonnement. Au lieu de cinq outils.</h2>
              </div>
              <p className="w-tete-texte">
                Boutique, licences, clients, marketing, statistiques et administratif : tout ton business se pilote depuis un
                seul tableau de bord.
              </p>
            </div>
            <ul className="w-outils">
              {OUTILS.map(o => (
                <li key={o.nom}>
                  <o.icone taille={22} />
                  {o.nom}
                </li>
              ))}
            </ul>
            <ImageAdaptative
              className="w-tableau"
              alt="Le tableau de bord Sonoo : revenus des 30 derniers jours, ventes en direct, clients, top beats et automatisations"
              ordinateur={tableau}
              tablette={tableau}
              mobile={img('tableau-mobile', 660, 1320)}
            />
            <Atouts liste={ATOUTS_TABLEAU} colonnes={3} />
          </div>
        </section>

        {/* ——— 04 Administratif & paiements ——— */}
        <section className="w-section w-conteneur">
          <Etiquette>04 — Administratif &amp; paiements</Etiquette>
          <h2 className="w-titre-2 w-titre-admin">L’administratif se fait tout seul. L’argent arrive chez toi.</h2>

          <div className="w-admin-grille">
            <article className="w-panneau w-bloc w-contrats">
              <h3 className="w-bloc-titre">Contrats et factures automatiques</h3>
              <p className="w-bloc-texte">
                À chaque vente, le contrat de licence et la facture sont générés et téléchargeables immédiatement par
                l’acheteur. TVA gérée selon ton statut, conforme aux normes françaises.
              </p>
              <div className="w-documents" role="img" aria-label="Exemple de contrat de licence généré automatiquement">
                <div className="w-facture-fond">
                  <span>Facture N° 2026-0142</span>
                  <span>49,00 €</span>
                </div>
                <div className="w-carte-blanche w-contrat">
                  <div className="w-contrat-tete">
                    <span className="w-etape-icone">
                      <I.Document taille={20} />
                    </span>
                    <span className="w-contrat-titre">
                      <span>Contrat de licence — WAV</span>
                      <small>« Ambitieux » · Jake B → Luka M.</small>
                    </span>
                    <Pastille ton="vert">Généré automatiquement</Pastille>
                  </div>
                  <dl className="w-contrat-lignes">
                    {LIGNES_CONTRAT.map(([l, v]) => (
                      <div key={l}>
                        <dt>{l}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <span className="w-mini-bouton w-mini-bouton-contour w-mini-bouton-icone">
                    <I.DocumentTelechargement taille={18} />
                    Télécharger le PDF
                  </span>
                </div>
              </div>
            </article>

            <article className="w-bloc w-zero">
              <p className="w-zero-chiffre">0 %</p>
              <h3 className="w-bloc-titre">de commission sur tes ventes</h3>
              <p className="w-bloc-texte">
                Les paiements vont directement de l’acheteur à toi, sans jamais passer par Sonoo. C’est toi le vendeur.
              </p>
              <div className="w-flux" role="img" aria-label="49,00 € vont directement de l’acheteur à ta boutique, Sonoo prélève 0 €">
                <div className="w-flux-ligne">
                  <span className="w-flux-bout">
                    <span className="w-flux-rond">
                      <I.Personne taille={22} />
                    </span>
                    <small>Acheteur</small>
                  </span>
                  <span className="w-flux-trait">
                    <small>49,00 € · paiement direct</small>
                    <span className="w-flux-barre" />
                  </span>
                  <span className="w-flux-bout">
                    <span className="w-flux-rond w-flux-rond-bleu">
                      <I.Boutique taille={22} />
                    </span>
                    <small className="w-blanc">Ta boutique</small>
                  </span>
                </div>
                <span className="w-flux-sonoo">
                  <Symbole hauteur={14} couleur="#fff" />
                  Sonoo · 0 € prélevé sur la vente
                </span>
              </div>
            </article>
          </div>

          <div className="w-admin-petits">
            <article className="w-petit-bloc">
              <M.MarqueMembres taille={26} className="w-bleu" />
              <div>
                <h3>Collabs simplifiées</h3>
                <p>La part de chaque collaborateur est versée automatiquement.</p>
              </div>
            </article>
            <article className="w-petit-bloc">
              <M.MarqueStatistiques taille={26} className="w-bleu" />
              <div>
                <h3>
                  Suivi des sorties
                  <span className="w-bientot">
                    <I.Etincelle taille={10} />
                    Bientôt
                  </span>
                </h3>
                <p>Retrouve sur Spotify les morceaux sortis sur tes beats.</p>
              </div>
            </article>
          </div>
        </section>

        {/* ——— 05 L'histoire ——— */}
        <section className="w-section w-conteneur w-histoire-section">
          <div className="w-histoire">
            <ImageAdaptative
              className="w-photo"
              alt="Visuel d’ambiance d’un studio : photo de Jake B à fournir"
              ordinateur={img('photo-studio', 1082, 1290)}
              tablette={img('photo-studio', 1082, 1290)}
              mobile={img('photo-studio', 1082, 1290)}
            />
            <div className="w-histoire-texte">
              <Etiquette>05 — L’histoire</Etiquette>
              <h2 className="w-titre-2">Créé par un beatmaker, pour les beatmakers.</h2>
              <p className="w-histoire-intro">
                Jake B compose sur YouTube depuis 2019. Sonoo, c’est le système qu’il a construit pour vivre de ses beats,
                ouvert à tous les beatmakers.
              </p>
              <dl className="w-chiffres">
                {CHIFFRES_JAKE.map(c => (
                  <div key={c.valeur}>
                    <dt>{c.valeur}</dt>
                    <dd>{c.texte}</dd>
                  </div>
                ))}
              </dl>
              <p className="w-chiffres-note">Le parcours de Jake B, fondateur — pas des résultats clients Sonoo.</p>
            </div>
          </div>
        </section>

        {/* ——— Affiliation ——— */}
        <section id="affiliation" className="w-conteneur w-ancre w-affiliation-section">
          <div className="w-affiliation">
            <div className="w-affiliation-texte">
              <span className="w-pastille-claire">
                <span className="w-point w-point-blanc" />
                Programme d’affiliation · bientôt
              </span>
              <h2 className="w-titre-3">Recommande Sonoo. Touche une commission sur chaque abonnement.</h2>
              <p>
                Le programme d’affiliation arrive : partage Sonoo avec d’autres beatmakers et gagne une commission généreuse
                sur chaque abonnement vendu.
              </p>
              <a href={`${contact}?subject=${encodeURIComponent('Programme d’affiliation Sonoo')}`} className="w-bouton w-bouton-blanc w-bouton-grand">
                Être prévenu du lancement
                <I.Fleche taille={20} />
              </a>
            </div>
            <div className="w-carte-blanche w-parrainage" role="img" aria-label="Exemple de lien de parrainage, bientôt disponible">
              <div className="w-parrainage-tete">
                <span>Ton lien de parrainage</span>
                <span className="w-bientot">
                  <I.Etincelle taille={10} />
                  Bientôt
                </span>
              </div>
              <div className="w-parrainage-lien">
                <span className="w-mono">sonoo.app/r/jakeb</span>
                <span className="w-parrainage-copier">
                  <I.Copier taille={16} />
                </span>
              </div>
              <dl className="w-parrainage-lignes">
                <div>
                  <dt>Beatmakers parrainés</dt>
                  <dd>—</dd>
                </div>
                <div>
                  <dt>Commission</dt>
                  <dd className="w-ambre">[Taux à définir]</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* ——— Tarifs ——— */}
        <section id="tarifs" className="w-tarifs w-ancre">
          <div className="w-section w-conteneur">
            <Etiquette centree>Tarifs</Etiquette>
            <h2 className="w-titre-2 w-centre">Un prix simple. Zéro commission.</h2>
            <p className="w-tete-texte w-centre w-tarifs-intro">
              Un abonnement fixe, tous les outils inclus. Essai gratuit disponible sur l’offre Pro.
            </p>
            <div className="w-offres">
              <article className="w-offre">
                <div className="w-offre-tete">
                  <h3>Gratuit</h3>
                  <span className="w-gris-pastille">Pour collaborer</span>
                </div>
                <p className="w-offre-desc">Pour recevoir ta part des ventes de beats en collab réalisées sur les boutiques Pro.</p>
                <p className="w-offre-prix">
                  0 € <small>/ mois</small>
                </p>
                <Link href={CHEMIN_INSCRIPTION} className="w-bouton w-bouton-contour w-bouton-large">
                  Créer un compte gratuit
                </Link>
                <ul className="w-offre-liste">
                  {OFFRE_GRATUITE.map(t => (
                    <li key={t}>
                      <span className="w-coche-ronde">
                        <I.Coche taille={12} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="w-offre w-offre-pro">
                <div className="w-offre-tete">
                  <h3>Pro</h3>
                  <span className="w-bientot w-bientot-plein">
                    <I.Etincelle taille={10} />
                    Essai gratuit
                  </span>
                </div>
                <p className="w-offre-desc">Pour créer ta boutique et accéder à tous les outils.</p>
                <p className="w-offre-prix">
                  [XX] € <small>/ mois · prix à confirmer</small>
                </p>
                <Link href={CHEMIN_INSCRIPTION} className="w-bouton w-bouton-bleu w-bouton-large">
                  Commencer l’essai gratuit
                </Link>
                <ul className="w-offre-liste">
                  {OFFRE_PRO.map(t => (
                    <li key={t}>
                      <span className="w-coche-ronde">
                        <I.Coche taille={12} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
            <p className="w-centre">
              <a href="#tarifs" className="w-lien-fleche">
                Comparer les offres en détail
                <I.Fleche taille={16} />
              </a>
            </p>
          </div>
        </section>

        {/* ——— FAQ ——— */}
        <section id="faq" className="w-section w-conteneur w-ancre w-faq">
          <div className="w-faq-intro">
            <Etiquette>FAQ</Etiquette>
            <h2 className="w-titre-2">Questions fréquentes</h2>
            <p className="w-faq-sous">Une autre question ? Notre équipe te répond.</p>
            <a href={contact} className="w-bouton w-bouton-contour w-bouton-petit">
              <I.Enveloppe taille={18} />
              Contacter l’équipe
            </a>
          </div>
          <Faq />
        </section>

        {/* ——— Appel final ——— */}
        <section className="w-conteneur w-cta-section">
          <div className="w-cta">
            <Symbole hauteur={620} couleur="#141312" className="w-cta-deco" />
            <div className="w-cta-contenu">
              <Etiquette>Prêt à te lancer ?</Etiquette>
              <h2 className="w-titre-cta">Arrête de louer ton audience. Construis ta marque.</h2>
              <p>Lance ta boutique Sonoo et garde la relation avec tes clients.</p>
              <div className="w-cta-boutons">
                <Link href={CHEMIN_INSCRIPTION} className="w-bouton w-bouton-bleu w-bouton-grand">
                  Commencer l’essai gratuit
                  <I.Fleche taille={20} />
                </Link>
                <a href="#tarifs" className="w-bouton w-bouton-sombre w-bouton-grand">
                  Voir les tarifs
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-pied">
        <div className="w-conteneur">
          <div className="w-pied-haut">
            <div className="w-pied-marque">
              <Logo hauteur={32} sombre />
              <p>La plateforme e-commerce des beatmakers indépendants.</p>
              <ul className="w-reseaux" aria-label="Réseaux sociaux (liens à venir)">
                <li><I.YouTube taille={18} /></li>
                <li><I.Instagram taille={18} /></li>
                <li><I.TikTok taille={18} /></li>
              </ul>
            </div>
            <nav className="w-pied-colonnes" aria-label="Pied de page">
              <div>
                <p className="w-pied-titre">Produit</p>
                <ul>
                  <li><a href="#fonctionnalites">Fonctionnalités</a></li>
                  <li><a href={lienBoutique} target="_blank" rel="noopener noreferrer">Voir une boutique</a></li>
                  <li><a href="#tarifs">Tarifs</a></li>
                  <li><a href="#affiliation">Affiliation (bientôt)</a></li>
                </ul>
              </div>
              <div>
                <p className="w-pied-titre">Ressources</p>
                <ul>
                  <li><a href="#faq">FAQ</a></li>
                  <li><span>Chaîne YouTube</span></li>
                  <li><a href={contact}>Contact &amp; support</a></li>
                </ul>
              </div>
              <div>
                <p className="w-pied-titre">Compte</p>
                <ul>
                  <li><Link href="/connexion">Connexion</Link></li>
                  <li><Link href={CHEMIN_INSCRIPTION}>Essai gratuit</Link></li>
                </ul>
              </div>
              <div>
                <p className="w-pied-titre">Légal</p>
                <ul>
                  <li><span>Mentions légales</span></li>
                  <li><span>CGU / CGV</span></li>
                  <li><span>Confidentialité</span></li>
                  <li><span>Cookies</span></li>
                </ul>
              </div>
            </nav>
          </div>
          <div className="w-pied-bas">
            <span>© 2026 Sonoo. Tous droits réservés.</span>
            <span>Français (FR)</span>
          </div>
        </div>
      </footer>
    </>
  )
}
