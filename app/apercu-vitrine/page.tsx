import Image from 'next/image'
import Link from 'next/link'
import { adresseBoutique } from '@/lib/adresse-boutique'
import { EMAIL_CONTACT } from '@/lib/constantes'
import { EnTete } from './_composants/EnTete'
import { Faq } from './_composants/Faq'
import { ImageAdaptative } from './_composants/ImageAdaptative'
import { Logo, Symbole } from './_composants/Logo'
import { CHEMIN_INSCRIPTION, SLUG_BOUTIQUE_EXEMPLE } from './_composants/liens'
import * as I from './_composants/Icones'

function Etiquette({ children, centree = false }: { children: React.ReactNode; centree?: boolean }) {
  return (
    <p className={centree ? 'v-etiquette v-etiquette-centree' : 'v-etiquette'}>
      <I.Etincelle taille={12} className="v-etiquette-etoile" />
      {children}
    </p>
  )
}

function Pastille({ ton, children }: { ton: 'vert' | 'bleu' | 'ambre'; children: React.ReactNode }) {
  return <span className={`v-pastille v-pastille-${ton}`}>{children}</span>
}

function Interrupteur({ actif }: { actif: boolean }) {
  return <span className={actif ? 'v-interrupteur v-interrupteur-actif' : 'v-interrupteur'} aria-hidden="true" />
}

const COULEURS_THEME = ['#2EE6E0', '#F43F4E', '#9B6CF6', '#22C55E', '#F5B83D', '#FFFFFF']

const SECTIONS_ACCUEIL = [
  { nom: 'Bannière d’accueil', actif: true },
  { nom: 'Réservés aux membres', actif: true },
  { nom: 'Nouveautés', actif: true },
  { nom: 'La sélection du beatmaker', actif: true },
  { nom: 'Parcourir les styles', actif: false },
]

const TELEPHONES = [
  { src: '/apercu-vitrine/telephone-jakeb.webp', adresse: 'beats.jakebmusic.com', couleur: '#2EE6E0', alt: 'Boutique de Jake B sur mobile' },
  { src: '/apercu-vitrine/telephone-achprodd.webp', adresse: 'sonoo.app/achprodd', couleur: '#F43F4E', alt: 'Boutique d’ACHPRODD sur mobile' },
  { src: '/apercu-vitrine/telephone-nehzia.webp', adresse: 'sonoo.app/nehzia', couleur: '#9B6CF6', alt: 'Boutique de Nehzia sur mobile' },
]

const ATOUTS_MARQUE = [
  { icone: I.Globe, titre: 'Ton nom de domaine', texte: 'Ta boutique sur ton adresse, comme beats.tonnom.com.' },
  { icone: I.Palette, titre: 'Ton identité', texte: 'Couleurs, logo, page d’accueil modulable : tout est à ton image.' },
  { icone: I.Telephone, titre: 'Pensée pour le mobile', texte: 'Lecteur intégré, filtres par style, ambiance ou BPM, paiement par carte, Apple Pay et Google Pay.' },
  { icone: I.Cadenas, titre: 'Beats réservés aux membres', texte: 'Playlists, catégories et exclusivités pour tes membres.' },
]

const CLIENTS = [
  { initiales: 'LM', nom: 'Luka M.', detail: '7 achats · Trap, Drill', montant: '487 €', statut: { ton: 'vert', texte: 'Récurrent' } },
  { initiales: 'NK', nom: 'Naya K.', detail: 'Membre Gold · depuis 4 mois', montant: '9,99 €/mois', statut: { ton: 'bleu', texte: 'Membre' } },
  { initiales: 'TR', nom: 'Théo R.', detail: '2 achats · inactif depuis 74 j', montant: '68 €', statut: { ton: 'ambre', texte: 'À relancer' } },
  { initiales: 'IB', nom: 'Inès B.', detail: '4 achats · R&B, Afro', montant: '214 €', statut: { ton: 'vert', texte: 'Récurrent' } },
] as const

const ETAPES_AUTOMATISATION = [
  { icone: I.Eclair, label: 'Déclencheur', texte: 'Client inactif depuis 60 jours', sombre: true, actif: true },
  { icone: I.Horloge, label: 'Délai', texte: 'Attendre 1 jour' },
  { icone: I.Enveloppe, label: 'E-mail', texte: '« Ça fait longtemps ! » à tes couleurs' },
  { icone: I.Ticket, label: 'Code promo', texte: '-15 % généré automatiquement' },
]

const OUTILS = [
  { icone: I.Boutique, nom: 'Boutique' },
  { icone: I.Document, nom: 'Licences' },
  { icone: I.Personnes, nom: 'CRM' },
  { icone: I.Megaphone, nom: 'Marketing' },
  { icone: I.Barres, nom: 'Statistiques' },
  { icone: I.FactureDollar, nom: 'Administratif' },
]

const ATOUTS_TABLEAU = [
  { icone: I.Courbe, titre: 'Ventes et revenus', texte: 'Suis ton chiffre d’affaires jour après jour, beat par beat.' },
  { icone: I.PersonneCourbe, titre: 'Clients et membres', texte: 'Vois qui achète, qui revient et qui décroche.' },
  { icone: I.Barres, titre: 'Top beats et trafic', texte: 'Écoutes, meilleures ventes, sources de trafic : tu ne rates aucune donnée.' },
]

const LIGNES_CONTRAT = [
  ['Date', '12 nov. 2026'],
  ['Licence', 'WAV · non exclusive'],
  ['Montant', '49,00 €'],
  ['TVA', 'Non applicable, art. 293 B du CGI'],
]

const CHIFFRES_JAKE = [
  { valeur: '220 k€+', texte: 'générés grâce à mes beats' },
  { valeur: '50 k', texte: 'abonnés sur YouTube' },
  { valeur: '250 M+', texte: 'streams sur ma musique' },
]

const OFFRE_GRATUITE = ['Réception automatique de ta part sur les ventes en collab', 'Accès au compte Sonoo', '[Autres fonctionnalités à confirmer]']
const OFFRE_PRO = [
  'Boutique personnalisable sur ton nom de domaine',
  'Fichier clients, campagnes e-mail et automatisations',
  'Abonnements, codes promo et téléchargements gratuits',
  'Contrats de licence et factures automatiques',
  'Statistiques complètes',
  'Import de tes clients et de tes ventes',
  '0 % de commission sur tes ventes',
]

export default function ApercuVitrinePage() {
  const lienBoutique = adresseBoutique(SLUG_BOUTIQUE_EXEMPLE, null).accueil
  const contact = `mailto:${EMAIL_CONTACT}`

  return (
    <>
      <a href="#v-contenu" className="v-evitement">
        Aller au contenu
      </a>
      <EnTete lienBoutique={lienBoutique} />

      <main id="v-contenu">
        {/* ——— Accueil ——— */}
        <section className="v-hero v-conteneur">
          <p className="v-badge">
            <I.Etincelle taille={14} className="v-etiquette-etoile" />
            La plateforme e-commerce des beatmakers
          </p>
          <h1 className="v-titre-1">
            Tes beats méritent mieux <span className="v-titre-gris">qu’une marketplace.</span>
          </h1>
          <div className="v-hero-bas">
            <p className="v-hero-texte">
              Ta boutique à ton image, tes clients rien qu’à toi et tous les outils pour faire grandir ton business. Sans
              commission sur tes ventes.
            </p>
            <div className="v-hero-actions">
              <div className="v-hero-boutons">
                <Link href={CHEMIN_INSCRIPTION} className="v-bouton v-bouton-bleu v-bouton-grand">
                  Commencer l’essai gratuit
                  <I.Fleche taille={20} />
                </Link>
                <a href={lienBoutique} target="_blank" rel="noopener noreferrer" className="v-bouton v-bouton-contour v-bouton-grand">
                  <I.Lecture taille={20} />
                  Voir une boutique
                </a>
              </div>
              <ul className="v-hero-preuves">
                {['0 % de commission', 'Paiements directs', 'Ton nom de domaine'].map(t => (
                  <li key={t}>
                    <I.Coche taille={16} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <ImageAdaptative
            className="v-hero-visuel"
            prioritaire
            alt="La boutique de Jake B sur ordinateur et sur mobile, avec une notification « Nouvelle vente : +49,00 € »"
            ordinateur={{ src: '/apercu-vitrine/hero-ordinateur.webp', largeur: 1280, hauteur: 680 }}
            tablette={{ src: '/apercu-vitrine/hero-tablette.webp', largeur: 688, hauteur: 560 }}
            mobile={{ src: '/apercu-vitrine/hero-mobile.webp', largeur: 350, hauteur: 520 }}
          />
        </section>

        {/* ——— 01 Ta marque ——— */}
        <section id="fonctionnalites" className="v-section v-conteneur v-ancre">
          <div className="v-tete">
            <div>
              <Etiquette>01 — Ta marque</Etiquette>
              <h2 className="v-titre-2">Ta marque au premier plan. Sonoo reste en coulisses.</h2>
            </div>
            <p className="v-tete-texte">
              Tes couleurs, ton logo, ton nom de domaine : ta boutique raconte ton univers. Sonoo n’apparaît que dans une
              discrète mention en pied de page.
            </p>
          </div>

          <div className="v-marque-grille">
            <div className="v-carte-blanche v-reglages" aria-label="Exemple de réglages de la boutique" role="img">
              <div className="v-reglages-tete">
                <span className="v-reglages-titre">Apparence de la boutique</span>
                <Pastille ton="vert">Enregistré</Pastille>
              </div>
              <p className="v-mini-label">Couleur du thème</p>
              <div className="v-pastilles-couleur">
                {COULEURS_THEME.map((c, i) => (
                  <span key={c} className={i === 0 ? 'v-couleur v-couleur-choisie' : 'v-couleur'} style={{ background: c }} />
                ))}
              </div>
              <p className="v-mini-label">Logo</p>
              <div className="v-reglages-logo">
                <span className="v-carre-jb">JB</span>
                <span className="v-reglages-fichier">
                  <span>logo-jakeb.svg</span>
                  <small>SVG · 24 Ko</small>
                </span>
                <span className="v-lien-bleu">Remplacer</span>
              </div>
              <p className="v-mini-label">Nom de domaine</p>
              <div className="v-champ-domaine">
                <I.Globe taille={18} />
                <span className="v-mono">beats.jakebmusic.com</span>
                <Pastille ton="vert">Connecté</Pastille>
              </div>
              <p className="v-mini-label">Sections de l’accueil</p>
              <ul className="v-sections-accueil">
                {SECTIONS_ACCUEIL.map(s => (
                  <li key={s.nom}>
                    <I.Poignee taille={14} className="v-poignee" />
                    <span>{s.nom}</span>
                    <Interrupteur actif={s.actif} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="v-panneau v-telephones">
              <ul className="v-telephones-liste">
                {TELEPHONES.map(t => (
                  <li key={t.adresse}>
                    <Image src={t.src} alt={t.alt} width={234} height={489} className="v-telephone" />
                    <span className="v-telephone-adresse">
                      <span className="v-point" style={{ background: t.couleur }} />
                      {t.adresse}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <ul className="v-atouts v-atouts-4">
            {ATOUTS_MARQUE.map(a => (
              <li key={a.titre}>
                <span className="v-atout-icone">
                  <a.icone taille={20} />
                </span>
                <h3>{a.titre}</h3>
                <p>{a.texte}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ——— 02 Croissance ——— */}
        <section className="v-section v-conteneur">
          <div className="v-tete">
            <div>
              <Etiquette>02 — Croissance</Etiquette>
              <h2 className="v-titre-2">Vends plus. Fidélise mieux.</h2>
            </div>
            <p className="v-tete-texte v-tete-texte-large">
              Fichier clients, e-mails, automatisations, abonnements, codes promo : les outils des meilleures boutiques en
              ligne, pensés pour vendre des beats.
            </p>
          </div>

          <div className="v-croissance">
            <article className="v-panneau v-bloc v-bloc-large">
              <p className="v-bloc-label">Fichier clients</p>
              <h3 className="v-bloc-titre">Connais chaque client par cœur.</h3>
              <p className="v-bloc-texte">
                Ce que chacun a acheté, combien il a dépensé, ce qu’il écoute. Segmente et relance en un clic.
              </p>
              <div className="v-carte-blanche v-clients" role="img" aria-label="Exemple de fichier clients">
                <div className="v-clients-tete">
                  <span className="v-clients-titre">
                    Clients <span className="v-gris">1 284</span>
                  </span>
                  <span className="v-clients-boutons">
                    <span className="v-mini-bouton v-mini-bouton-contour v-cache-mobile">Exporter</span>
                    <span className="v-mini-bouton v-mini-bouton-bleu">
                      <I.Megaphone taille={16} className="v-montre-mobile" />
                      <span className="v-cache-mobile">Nouvelle campagne</span>
                      <span className="v-montre-mobile">Campagne</span>
                    </span>
                  </span>
                </div>
                <div className="v-clients-filtres">
                  <span className="v-filtre v-filtre-actif">Tous</span>
                  <span className="v-filtre">Récurrents · 312</span>
                  <span className="v-filtre v-cache-mobile">Membres · 87</span>
                  <span className="v-filtre">Inactifs 60 j · 145</span>
                </div>
                <ul className="v-clients-liste">
                  {CLIENTS.map(c => (
                    <li key={c.nom}>
                      <span className="v-avatar">{c.initiales}</span>
                      <span className="v-client-nom">
                        <span>{c.nom}</span>
                        <small>{c.detail}</small>
                      </span>
                      <span className="v-client-montant">{c.montant}</span>
                      <Pastille ton={c.statut.ton}>{c.statut.texte}</Pastille>
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="v-panneau v-bloc">
              <p className="v-bloc-label">Automatisations</p>
              <h3 className="v-bloc-titre">Des relances qui tournent seules.</h3>
              <p className="v-bloc-texte">
                Bienvenue, remerciement après achat, relance des inactifs avec code promo, suivi après un téléchargement
                gratuit.
              </p>
              <ol className="v-etapes" aria-label="Exemple d’automatisation">
                {ETAPES_AUTOMATISATION.map(e => (
                  <li key={e.label} className="v-carte-blanche v-etape">
                    <span className={e.sombre ? 'v-etape-icone v-etape-icone-sombre' : 'v-etape-icone'}>
                      <e.icone taille={20} />
                    </span>
                    <span className="v-etape-texte">
                      <span className="v-mini-label">{e.label}</span>
                      <span>{e.texte}</span>
                    </span>
                    {e.actif && <Pastille ton="vert">Active</Pastille>}
                  </li>
                ))}
              </ol>
            </article>

            <article className="v-panneau v-bloc">
              <p className="v-bloc-label">Campagnes e-mail</p>
              <h3 className="v-bloc-titre">Des e-mails à ton image.</h3>
              <p className="v-bloc-texte">Chaque e-mail porte ton logo et tes couleurs, pas ceux de Sonoo.</p>
              <div className="v-carte-blanche v-email" role="img" aria-label="Exemple d’e-mail envoyé aux clients">
                <div className="v-email-tete">
                  <span>De : Jake B · Objet : Le pack drill est là</span>
                  <Pastille ton="vert">Envoyée</Pastille>
                </div>
                <div className="v-email-corps">
                  <div className="v-email-banniere">JAKE B</div>
                  <div className="v-email-contenu">
                    <p className="v-email-titre">Le pack drill de l’hiver est disponible</p>
                    <p>Salut Luka, 5 nouvelles prods t’attendent sur la boutique. -15 % pendant 48 h avec le code HIVER15.</p>
                    <span className="v-email-bouton">Écouter le pack</span>
                  </div>
                </div>
                <div className="v-email-pied">
                  <span>
                    <I.Envoi taille={16} />1 284 destinataires
                  </span>
                  <span>
                    <I.EnveloppeOuverte taille={16} />
                    42 % d’ouverture
                  </span>
                </div>
              </div>
            </article>

            <article className="v-panneau v-bloc v-bloc-large">
              <p className="v-bloc-label">Revenus récurrents</p>
              <h3 className="v-bloc-titre">Abonnements, codes promo, téléchargements gratuits.</h3>
              <p className="v-bloc-texte">
                Des revenus chaque mois, des ventes boostées et une liste e-mail qui grandit à chaque téléchargement.
              </p>
              <div className="v-revenus" role="img" aria-label="Exemples : abonnement Membre Gold, code promo HIVER15, téléchargement gratuit">
                <div className="v-revenu v-revenu-noir">
                  <span className="v-revenu-ligne">
                    <I.Couronne taille={20} />
                    <small>Revenu récurrent</small>
                  </span>
                  <span className="v-revenu-nom">Membre Gold</span>
                  <span className="v-revenu-prix">
                    9,99 € <small>/ mois</small>
                  </span>
                  <small className="v-revenu-note">87 membres actifs</small>
                </div>
                <div className="v-revenu v-revenu-blanc">
                  <span className="v-mini-label">Code promo</span>
                  <span className="v-code">HIVER15</span>
                  <span className="v-revenu-nom-petit">-15 % sur tout le catalogue</span>
                  <small className="v-revenu-note">Utilisé 64 fois · offres groupées</small>
                </div>
                <div className="v-revenu v-revenu-bleu">
                  <I.Telechargement taille={20} className="v-bleu" />
                  <span className="v-revenu-nom-petit">Téléchargement gratuit</span>
                  <small className="v-revenu-note">« Mirage » offert en MP3</small>
                  <span className="v-revenu-compteur">
                    +212 <small>e-mails collectés</small>
                  </span>
                </div>
              </div>
              <div className="v-import">
                <span className="v-import-icone">
                  <I.Envoyer taille={20} />
                </span>
                <div>
                  <p className="v-import-titre">Ne repars pas de zéro.</p>
                  <p className="v-bloc-texte">Importe tes clients et tes ventes depuis BeatStars, Airbit ou n’importe quelle autre source.</p>
                </div>
              </div>
              <div className="v-import-schema" role="img" aria-label="BeatStars, Airbit ou un fichier CSV : 1 284 clients importés">
                <ul className="v-import-sources">
                  {['BeatStars', 'Airbit', 'Fichier CSV'].map(s => (
                    <li key={s}>
                      <span className="v-point v-point-gris" />
                      {s}
                    </li>
                  ))}
                </ul>
                <I.Fleche taille={20} className="v-import-fleche v-cache-mobile" />
                <I.FlecheBas taille={20} className="v-import-fleche v-montre-mobile" />
                <div className="v-carte-blanche v-import-resultat">
                  <Symbole hauteur={28} />
                  <span className="v-import-chiffres">
                    <span>1 284 clients importés</span>
                    <small>3 412 ventes · historique conservé</small>
                  </span>
                  <I.CercleCoche taille={20} className="v-vert" />
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* ——— 03 Tout-en-un ——— */}
        <section className="v-sombre">
          <div className="v-section v-conteneur">
            <div className="v-tete">
              <div>
                <Etiquette>03 — Tout-en-un</Etiquette>
                <h2 className="v-titre-2">Un seul abonnement. Au lieu de cinq outils.</h2>
              </div>
              <p className="v-tete-texte">
                Boutique, licences, clients, marketing, statistiques et administratif : tout ton business se pilote depuis un
                seul tableau de bord.
              </p>
            </div>
            <ul className="v-outils">
              {OUTILS.map(o => (
                <li key={o.nom}>
                  <o.icone taille={18} />
                  {o.nom}
                </li>
              ))}
            </ul>
            <ImageAdaptative
              className="v-tableau"
              alt="Le tableau de bord Sonoo : revenus, ventes, nouveaux clients, membres actifs et ventes récentes"
              ordinateur={{ src: '/apercu-vitrine/tableau-ordinateur.webp', largeur: 1280, hauteur: 780 }}
              tablette={{ src: '/apercu-vitrine/tableau-tablette.webp', largeur: 688, hauteur: 560 }}
              mobile={{ src: '/apercu-vitrine/tableau-mobile.webp', largeur: 282, hauteur: 590 }}
            />
            <ul className="v-atouts v-atouts-3">
              {ATOUTS_TABLEAU.map(a => (
                <li key={a.titre}>
                  <span className="v-atout-icone">
                    <a.icone taille={20} />
                  </span>
                  <h3>{a.titre}</h3>
                  <p>{a.texte}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ——— 04 Administratif & paiements ——— */}
        <section className="v-section v-conteneur">
          <Etiquette>04 — Administratif &amp; paiements</Etiquette>
          <h2 className="v-titre-2 v-titre-admin">L’administratif se fait tout seul. L’argent arrive chez toi.</h2>

          <div className="v-admin-grille">
            <article className="v-panneau v-bloc v-contrats">
              <h3 className="v-bloc-titre">Contrats et factures automatiques</h3>
              <p className="v-bloc-texte">
                À chaque vente, le contrat de licence et la facture sont générés et téléchargeables immédiatement par
                l’acheteur. TVA gérée selon ton statut, conforme aux normes françaises.
              </p>
              <div className="v-documents" role="img" aria-label="Exemple de contrat de licence généré automatiquement">
                <div className="v-facture-fond">
                  <span>Facture N° 2026-0142</span>
                  <span>49,00 €</span>
                </div>
                <div className="v-carte-blanche v-contrat">
                  <div className="v-contrat-tete">
                    <span className="v-etape-icone">
                      <I.Document taille={20} />
                    </span>
                    <span className="v-contrat-titre">
                      <span>Contrat de licence — WAV</span>
                      <small>« Ambitieux » · Jake B → Luka M.</small>
                    </span>
                    <Pastille ton="vert">Généré automatiquement</Pastille>
                  </div>
                  <dl className="v-contrat-lignes">
                    {LIGNES_CONTRAT.map(([l, v]) => (
                      <div key={l}>
                        <dt>{l}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <span className="v-mini-bouton v-mini-bouton-contour v-mini-bouton-icone">
                    <I.DocumentTelechargement taille={18} />
                    Télécharger le PDF
                  </span>
                </div>
              </div>
            </article>

            <article className="v-bloc v-zero">
              <p className="v-zero-chiffre">0 %</p>
              <h3 className="v-bloc-titre">de commission sur tes ventes</h3>
              <p className="v-bloc-texte">
                Les paiements vont directement de l’acheteur à toi, sans jamais passer par Sonoo. C’est toi le vendeur.
              </p>
              <div className="v-flux" role="img" aria-label="49,00 € vont directement de l’acheteur à ta boutique, Sonoo prélève 0 €">
                <div className="v-flux-ligne">
                  <span className="v-flux-bout">
                    <span className="v-flux-rond">
                      <I.Personne taille={22} />
                    </span>
                    <small>Acheteur</small>
                  </span>
                  <span className="v-flux-trait">
                    <small>49,00 € · paiement direct</small>
                    <span className="v-flux-barre" />
                  </span>
                  <span className="v-flux-bout">
                    <span className="v-flux-rond v-flux-rond-bleu">
                      <I.Boutique taille={22} />
                    </span>
                    <small className="v-blanc">Ta boutique</small>
                  </span>
                </div>
                <span className="v-flux-sonoo">
                  <Symbole hauteur={14} couleur="#fff" />
                  Sonoo · 0 € prélevé sur la vente
                </span>
              </div>
            </article>
          </div>

          <div className="v-admin-petits">
            <article className="v-carte-blanche v-petit-bloc">
              <span className="v-etape-icone">
                <I.PoigneeMains taille={22} />
              </span>
              <div>
                <h3>Collabs simplifiées</h3>
                <p>La part de chaque collaborateur est versée automatiquement.</p>
              </div>
            </article>
            <article className="v-carte-blanche v-petit-bloc">
              <span className="v-etape-icone">
                <I.Cible taille={22} />
              </span>
              <div>
                <h3>
                  Suivi des sorties
                  <span className="v-bientot">
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
        <section className="v-section v-conteneur v-histoire-section">
          <div className="v-histoire">
            <div className="v-photo-attente" role="img" aria-label="Emplacement de la photo de Jake B, à fournir">
              <I.Photo taille={28} />
              <span>Photo de Jake B</span>
              <small>Portrait du fondateur — à fournir</small>
            </div>
            <div className="v-histoire-texte">
              <Etiquette>05 — L’histoire</Etiquette>
              <h2 className="v-titre-2">Créé par un beatmaker, pour les beatmakers.</h2>
              <blockquote className="v-citation">
                « Je compose sur YouTube depuis 2019. Sonoo, c’est le système que j’ai construit au fil des années, standardisé
                pour que chaque beatmaker puisse faire pareil. »
              </blockquote>
              <div className="v-auteur">
                <span className="v-avatar v-avatar-noir">JB</span>
                <span className="v-client-nom">
                  <span>Jake B</span>
                  <small>Compositeur, fondateur de Sonoo</small>
                </span>
              </div>
              <p className="v-mini-label">Le parcours de Jake B</p>
              <dl className="v-chiffres">
                {CHIFFRES_JAKE.map(c => (
                  <div key={c.valeur}>
                    <dt>{c.valeur}</dt>
                    <dd>{c.texte}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="v-temoignages-tete">
            <p>Bientôt ici : les retours des premiers beatmakers Sonoo.</p>
            <Pastille ton="ambre">Placeholder</Pastille>
          </div>
          <ul className="v-temoignages">
            {[0, 1, 2].map(i => (
              <li key={i} className="v-temoignage">
                <div className="v-temoignage-tete">
                  <span className="v-gris-pastille">Emplacement témoignage</span>
                  <I.Photo taille={18} />
                </div>
                <p className="v-temoignage-citation">« Citation du beatmaker à intégrer après le lancement. »</p>
                <div className="v-temoignage-pied">
                  <span className="v-avatar-vide" />
                  <span className="v-client-nom">
                    <span>Nom du beatmaker</span>
                    <small>Nom de la boutique</small>
                  </span>
                  <span className="v-temoignage-chiffre">
                    <span>[Chiffre]</span>
                    <small>Chiffre clé</small>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ——— Affiliation ——— */}
        <section id="affiliation" className="v-conteneur v-ancre v-affiliation-section">
          <div className="v-affiliation">
            <div className="v-affiliation-texte">
              <span className="v-pastille-claire">
                <span className="v-point v-point-blanc" />
                Programme d’affiliation · bientôt
              </span>
              <h2 className="v-titre-3">Recommande Sonoo. Touche une commission sur chaque abonnement.</h2>
              <p>
                Le programme d’affiliation arrive : partage Sonoo avec d’autres beatmakers et gagne une commission généreuse
                sur chaque abonnement vendu.
              </p>
              <a href={`${contact}?subject=${encodeURIComponent('Programme d’affiliation Sonoo')}`} className="v-bouton v-bouton-blanc v-bouton-grand">
                Être prévenu du lancement
                <I.Fleche taille={20} />
              </a>
            </div>
            <div className="v-carte-blanche v-parrainage" role="img" aria-label="Exemple de lien de parrainage, bientôt disponible">
              <div className="v-parrainage-tete">
                <span>Ton lien de parrainage</span>
                <span className="v-bientot">
                  <I.Etincelle taille={10} />
                  Bientôt
                </span>
              </div>
              <div className="v-parrainage-lien">
                <span className="v-mono">sonoo.app/r/jakeb</span>
                <span className="v-parrainage-copier">
                  <I.Copier taille={16} />
                </span>
              </div>
              <dl className="v-parrainage-lignes">
                <div>
                  <dt>Beatmakers parrainés</dt>
                  <dd>—</dd>
                </div>
                <div>
                  <dt>Commission</dt>
                  <dd className="v-ambre">[Taux à définir]</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* ——— Tarifs ——— */}
        <section id="tarifs" className="v-tarifs v-ancre">
          <div className="v-section v-conteneur">
            <Etiquette centree>Tarifs</Etiquette>
            <h2 className="v-titre-2 v-centre">Un prix simple. Zéro commission.</h2>
            <p className="v-tete-texte v-centre v-tarifs-intro">
              Un abonnement fixe, tous les outils inclus. Essai gratuit disponible sur l’offre Pro.
            </p>
            <div className="v-offres">
              <article className="v-offre">
                <div className="v-offre-tete">
                  <h3>Gratuit</h3>
                  <span className="v-gris-pastille">Pour collaborer</span>
                </div>
                <p className="v-offre-desc">Pour recevoir ta part des ventes de beats en collab réalisées sur les boutiques Pro.</p>
                <p className="v-offre-prix">
                  0 € <small>/ mois</small>
                </p>
                <Link href={CHEMIN_INSCRIPTION} className="v-bouton v-bouton-contour v-bouton-large">
                  Créer un compte gratuit
                </Link>
                <ul className="v-offre-liste">
                  {OFFRE_GRATUITE.map(t => (
                    <li key={t}>
                      <span className="v-coche-ronde">
                        <I.Coche taille={12} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="v-offre v-offre-pro">
                <div className="v-offre-tete">
                  <h3>Pro</h3>
                  <span className="v-bientot v-bientot-plein">
                    <I.Etincelle taille={10} />
                    Essai gratuit
                  </span>
                </div>
                <p className="v-offre-desc">Pour créer ta boutique et accéder à tous les outils.</p>
                <p className="v-offre-prix">
                  [XX] € <small>/ mois · prix à confirmer</small>
                </p>
                <Link href={CHEMIN_INSCRIPTION} className="v-bouton v-bouton-bleu v-bouton-large">
                  Commencer l’essai gratuit
                </Link>
                <ul className="v-offre-liste">
                  {OFFRE_PRO.map(t => (
                    <li key={t}>
                      <span className="v-coche-ronde">
                        <I.Coche taille={12} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
            <p className="v-centre">
              <a href="#tarifs" className="v-lien-fleche">
                Comparer les offres en détail
                <I.Fleche taille={16} />
              </a>
            </p>
          </div>
        </section>

        {/* ——— FAQ ——— */}
        <section id="faq" className="v-section v-conteneur v-ancre v-faq">
          <div className="v-faq-intro">
            <Etiquette>FAQ</Etiquette>
            <h2 className="v-titre-2">Questions fréquentes</h2>
            <p className="v-faq-sous">Une autre question ? Notre équipe te répond.</p>
            <a href={contact} className="v-bouton v-bouton-contour v-bouton-petit">
              <I.Enveloppe taille={18} />
              Contacter l’équipe
            </a>
          </div>
          <Faq />
        </section>

        {/* ——— Appel final ——— */}
        <section className="v-conteneur v-cta-section">
          <div className="v-cta">
            <Symbole hauteur={620} couleur="#141312" className="v-cta-deco" />
            <div className="v-cta-contenu">
              <Etiquette>Prêt à te lancer ?</Etiquette>
              <h2 className="v-titre-cta">Arrête de louer ton audience. Construis ta marque.</h2>
              <p>Lance ta boutique Sonoo et garde la relation avec tes clients.</p>
              <div className="v-cta-boutons">
                <Link href={CHEMIN_INSCRIPTION} className="v-bouton v-bouton-bleu v-bouton-grand">
                  Commencer l’essai gratuit
                  <I.Fleche taille={20} />
                </Link>
                <a href="#tarifs" className="v-bouton v-bouton-sombre v-bouton-grand">
                  Voir les tarifs
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="v-pied">
        <div className="v-conteneur">
          <div className="v-pied-haut">
            <div className="v-pied-marque">
              <Logo hauteur={32} sombre />
              <p>La plateforme e-commerce des beatmakers indépendants.</p>
              <ul className="v-reseaux" aria-label="Réseaux sociaux (liens à venir)">
                <li><I.YouTube taille={18} /></li>
                <li><I.Instagram taille={18} /></li>
                <li><I.TikTok taille={18} /></li>
              </ul>
            </div>
            <nav className="v-pied-colonnes" aria-label="Pied de page">
              <div>
                <p className="v-pied-titre">Produit</p>
                <ul>
                  <li><a href="#fonctionnalites">Fonctionnalités</a></li>
                  <li><a href={lienBoutique} target="_blank" rel="noopener noreferrer">Voir une boutique</a></li>
                  <li><a href="#tarifs">Tarifs</a></li>
                  <li><a href="#affiliation">Affiliation (bientôt)</a></li>
                </ul>
              </div>
              <div>
                <p className="v-pied-titre">Ressources</p>
                <ul>
                  <li><a href="#faq">FAQ</a></li>
                  <li><span>Chaîne YouTube</span></li>
                  <li><a href={contact}>Contact &amp; support</a></li>
                </ul>
              </div>
              <div>
                <p className="v-pied-titre">Compte</p>
                <ul>
                  <li><Link href="/connexion">Connexion</Link></li>
                  <li><Link href={CHEMIN_INSCRIPTION}>Essai gratuit</Link></li>
                </ul>
              </div>
              <div>
                <p className="v-pied-titre">Légal</p>
                <ul>
                  <li><span>Mentions légales</span></li>
                  <li><span>CGU / CGV</span></li>
                  <li><span>Confidentialité</span></li>
                  <li><span>Cookies</span></li>
                </ul>
              </div>
            </nav>
          </div>
          <div className="v-pied-bas">
            <span>© 2026 Sonoo. Tous droits réservés.</span>
            <span>Français (FR)</span>
          </div>
        </div>
      </footer>
    </>
  )
}
