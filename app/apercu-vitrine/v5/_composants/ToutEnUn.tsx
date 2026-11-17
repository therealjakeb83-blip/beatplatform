'use client'

import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode, type TouchEvent } from 'react'
import * as I from './Icones'
import * as M from './IconesMarque'

// Section « Tout-en-un » de la v4 : un carrousel de fenêtres, une par outil Sonoo
// (choix de Jake du 2026-11-17 : 10 fonctionnalités existantes + 5 « Bientôt »).
// Chaque écran est une maquette codée, sans photo, qui ne montre QUE ce qui existe
// vraiment dans la plateforme (vérifié dans le code), sauf les fenêtres « Bientôt ».
// Tailles en em ; la police de chaque fenêtre suit sa largeur (container query).
// Aperçu : ?outil=1..15 dans l'adresse ouvre directement une fenêtre.

type Outil = { id: string; nom: string; phrase: string; icone: ComponentType<{ taille?: number }>; ecran: () => ReactNode; bientot?: boolean }

const P = {
  bleu: 'radial-gradient(circle at 70% 30%, #2477fb, #07122b 75%)',
  nuit: 'radial-gradient(circle at 30% 25%, #3a4d78, #0a0a0a 72%)',
  gris: 'radial-gradient(circle at 40% 70%, #6b6b6b, #050505 70%)',
  violet: 'radial-gradient(circle at 60% 40%, #6d28d9, #0a0a0a 70%)',
  rouge: 'radial-gradient(circle at 30% 30%, #7f1d1d, #0a0a0a 70%)',
}

function Pochette({ fond }: { fond: string }) {
  return <i className="z-f-pochette" style={{ background: fond }} />
}
function Puce({ children, on = false, claire = false }: { children: ReactNode; on?: boolean; claire?: boolean }) {
  return <span className={`z-f-puce ${on ? 'z-f-puce-on' : ''} ${claire ? 'z-f-puce-claire' : ''}`}>{children}</span>
}
function Inter({ on = true }: { on?: boolean }) {
  return <span className={on ? 'z-f-inter z-f-inter-on' : 'z-f-inter'} />
}
function Champ({ lib, children }: { lib: string; children: ReactNode }) {
  return (
    <div className="z-f-champ">
      <small className="z-f-lib">{lib}</small>
      <div className="z-f-valeur">{children}</div>
    </div>
  )
}
function Coche({ children }: { children: ReactNode }) {
  return (
    <span className="z-f-coche">
      <span className="z-f-coche-rond">
        <I.Coche taille={10} />
      </span>
      {children}
    </span>
  )
}

/* ——————————— 1. Boutique ——————————— */
function EcranBoutique() {
  return (
    <div className="z-f-grille3">
      <div className="z-f-carte">
        <p className="z-f-h">Apparence</p>
        <Champ lib="Couleur">
          <span className="z-f-pastilles">
            {['#050505', '#2477fb', '#ef4444', '#8b5cf6', '#22c55e', '#f5c542', '#f97316', '#2ee6e0', '#ffffff'].map((c, i) => (
              <i key={c} className={i === 0 ? 'z-f-choisi' : undefined} style={{ background: c }} />
            ))}
          </span>
        </Champ>
        <Champ lib="Style des titres">
          <span className="z-f-puces">
            <Puce on>Grotesque</Puce>
            <Puce>Condensé</Puce>
            <Puce>Massif</Puce>
            <Puce>Moderne</Puce>
          </span>
        </Champ>
        <Champ lib="Logo">
          <span className="z-f-logo-jb">JB</span>
        </Champ>
        <Champ lib="Haut de page">
          <span className="z-f-saisie">Trouve l’instru qu’il te faut</span>
          <span className="z-f-saisie z-f-saisie-douce">Des beats trap et drill, licences claires</span>
        </Champ>
      </div>
      <div className="z-f-carte">
        <Champ lib="Nom de domaine">
          <span className="z-f-ligne-simple">
            jakebmusic.com <em className="z-f-ok">Connecté</em>
          </span>
        </Champ>
        <Champ lib="Catégories">
          <span className="z-f-puces">
            <Puce claire>Trap</Puce>
            <Puce claire>Drill</Puce>
            <Puce claire>R&amp;B</Puce>
            <Puce claire>Sombre</Puce>
            <Puce claire>Piano</Puce>
          </span>
        </Champ>
        <Champ lib="Playlist mise en avant">
          <span className="z-f-ligne-simple">
            <Pochette fond={P.bleu} /> Hits de l’été · 12 beats
          </span>
        </Champ>
        <Champ lib="Visibilité des beats">
          <span className="z-f-puces">
            <Puce>Publics 84</Puce>
            <Puce>Privés 6</Puce>
            <Puce>Membres 12</Puce>
          </span>
        </Champ>
        <Champ lib="Paiement">
          <span className="z-f-puces">
            <Puce on>✓ Carte</Puce>
            <Puce on>✓ Apple Pay</Puce>
            <Puce on>✓ Google Pay</Puce>
          </span>
        </Champ>
      </div>
      <div className="z-f-apercu z-f-large-seul">
        <span className="z-f-apercu-barre">
          <strong>JAKE B</strong>
          <span>Beats · Membres</span>
        </span>
        <strong className="z-f-apercu-titre">Trouve l’instru qu’il te faut</strong>
        <span className="z-f-apercu-bouton">Devenir membre</span>
        <span className="z-f-apercu-pochettes">
          <Pochette fond={P.nuit} />
          <Pochette fond={P.bleu} />
          <Pochette fond={P.gris} />
          <Pochette fond={P.violet} />
        </span>
      </div>
    </div>
  )
}

/* ——————————— 2. Espace client ——————————— */
function EcranEspaceClient() {
  return (
    <div className="z-f-colonne">
      <div className="z-f-espace-tete">
        <strong>JAKE B</strong>
        <span className="z-f-puces">
          <Puce on>Mes achats</Puce>
          <Puce>Factures</Puce>
          <Puce>Favoris</Puce>
          <Puce>Abonnement</Puce>
        </span>
      </div>
      <div className="z-f-grille2">
        <div className="z-f-carte">
          <p className="z-f-h">Mes achats</p>
          {[
            { t: 'Ambitieux', l: 'Licence Premium · WAV', f: P.nuit },
            { t: 'Pack Drill', l: 'Licence Trackout · pistes', f: P.bleu },
            { t: 'Mirage', l: 'Licence Basic · MP3', f: P.gris },
          ].map(a => (
            <span key={a.t} className="z-f-rang">
              <Pochette fond={a.f} />
              <span className="z-f-pile-texte">
                <strong>{a.t}</strong>
                <small>{a.l}</small>
              </span>
              <span className="z-f-mini-bouton z-f-droite">
                <I.Telechargement taille={11} /> Télécharger
              </span>
            </span>
          ))}
        </div>
        <div className="z-f-colonne">
          <div className="z-f-carte z-f-carte-sombre">
            <span className="z-f-ligne-simple">
              <strong>Membre Gold</strong>
              <em className="z-f-ok">Actif</em>
            </span>
            <small className="z-f-mini">9,99 € / mois · beat cadeau dans 2 mois</small>
          </div>
          <div className="z-f-carte">
            <p className="z-f-h">Mes playlists</p>
            <span className="z-f-rang">
              <Pochette fond={P.violet} />
              <span className="z-f-pile-texte">
                <strong>Pour mon EP</strong>
                <small>8 beats</small>
              </span>
            </span>
            <span className="z-f-rang">
              <Pochette fond={P.rouge} />
              <span className="z-f-pile-texte">
                <strong>Clips</strong>
                <small>5 beats</small>
              </span>
            </span>
          </div>
          <span className="z-f-mini">Factures à télécharger · Supprimer mon compte</span>
        </div>
      </div>
    </div>
  )
}

/* ——————————— 3. Codes promo ——————————— */
function EcranCodesPromo() {
  return (
    <div className="z-f-grille2">
      <div className="z-f-carte">
        <Champ lib="Code">
          <span className="z-f-ligne-simple">
            <span className="z-f-saisie z-f-mono">LUKA15</span>
            <span className="z-f-mini-bouton">Générer</span>
          </span>
        </Champ>
        <Champ lib="Type de remise">
          <span className="z-f-segment">
            <span>Panier</span>
            <span className="z-f-segment-on">Produit</span>
            <span>Abonnement</span>
          </span>
        </Champ>
        <Champ lib="Valeur">
          <span className="z-f-segment">
            <span className="z-f-segment-on">15 %</span>
            <span>Montant fixe</span>
          </span>
        </Champ>
        <Champ lib="Beats inclus">
          <span className="z-f-puces">
            <Puce claire>Ambitieux</Puce>
            <Puce claire>Mirage</Puce>
            <Puce>+ Ajouter</Puce>
          </span>
        </Champ>
        <Champ lib="Licences éligibles">
          <span className="z-f-puces">
            <Puce>MP3</Puce>
            <Puce on>✓ WAV</Puce>
            <Puce on>✓ Trackout</Puce>
            <Puce>Exclusive</Puce>
          </span>
        </Champ>
      </div>
      <div className="z-f-carte">
        <Champ lib="Réservé à">
          <span className="z-f-saisie">luka.m@exemple.fr</span>
        </Champ>
        <div className="z-f-grille2 z-f-serre">
          <Champ lib="Panier minimum">
            <span className="z-f-saisie">30 €</span>
          </Champ>
          <Champ lib="Panier maximum">
            <span className="z-f-saisie z-f-saisie-douce">Aucun</span>
          </Champ>
          <Champ lib="Utilisations">
            <span className="z-f-saisie">1 au total</span>
          </Champ>
          <Champ lib="Par client">
            <span className="z-f-saisie">1</span>
          </Champ>
          <Champ lib="Début">
            <span className="z-f-saisie">Maintenant</span>
          </Champ>
          <Champ lib="Fin">
            <span className="z-f-saisie">Dans 48 h</span>
          </Champ>
        </div>
        <span className="z-f-rang z-f-rang-bleu">
          <I.Eclair taille={12} />
          Codes créés tout seuls par tes relances
          <span className="z-f-droite">
            <Inter />
          </span>
        </span>
        <span className="z-f-bouton">Créer le code</span>
      </div>
    </div>
  )
}

/* ——————————— 4. Marketing : formule d'abonnement ——————————— */
function EcranMarketing() {
  return (
    <div className="z-f-grille2">
      <div className="z-f-carte">
        <span className="z-f-ligne-simple">
          <p className="z-f-h">Formule d’abonnement</p>
          <span className="z-f-droite">
            <Inter />
          </span>
        </span>
        <div className="z-f-grille2 z-f-serre">
          <Champ lib="Nom">
            <span className="z-f-saisie">Gold</span>
          </Champ>
          <Champ lib="Prix mensuel">
            <span className="z-f-saisie">9,99 €</span>
          </Champ>
        </div>
        <Champ lib="Remise membres">
          <span className="z-f-saisie">−20 % sur toutes les licences sauf Illimité</span>
        </Champ>
        <div className="z-f-grille2 z-f-serre">
          <Champ lib="Beat cadeau">
            <span className="z-f-saisie">Tous les 4 mois</span>
          </Champ>
          <Champ lib="Code fidélité">
            <span className="z-f-saisie">Après 6 mois</span>
          </Champ>
        </div>
        <Champ lib="Beats réservés aux membres">
          <span className="z-f-ligne-simple">
            <Pochette fond={P.violet} />
            <Pochette fond={P.nuit} />
            <Pochette fond={P.bleu} />
            <small className="z-f-mini">12 beats</small>
          </span>
        </Champ>
      </div>
      <div className="z-f-colonne">
        <div className="z-f-carte z-f-carte-sombre z-f-carte-gold">
          <span className="z-f-ligne-simple">
            <strong>JAKE B</strong>
            <em className="z-f-puce z-f-puce-verre z-f-droite">Membre Gold</em>
          </span>
          <span className="z-f-gros">9,99 € / mois</span>
          <small className="z-f-mini">−20 % · beat cadeau · beats réservés</small>
        </div>
        <div className="z-f-grille2 z-f-serre z-f-reste-deux">
          <div className="z-f-carte">
            <small className="z-f-lib">Membres</small>
            <span className="z-f-gros">87</span>
          </div>
          <div className="z-f-carte">
            <small className="z-f-lib">Récurrent / mois</small>
            <span className="z-f-gros">869 €</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ——————————— 5. CRM ——————————— */
function EcranCrm() {
  return (
    <div className="z-f-grille2 z-f-grille-large-gauche">
      <div className="z-f-carte">
        <span className="z-f-puces">
          <Puce on>Client</Puce>
          <Puce on>Chaud</Puce>
          <Puce on>Trap</Puce>
          <Puce>+ Filtre</Puce>
        </span>
        {[
          { i: 'LM', n: 'Luka M.', s: 'Gold', c: 'z-f-seg-gold', t: '487 €', ch: 'z-f-chaud', sel: true },
          { i: 'NK', n: 'Naya K.', s: 'Fidèle', c: 'z-f-seg-fidele', t: '212 €', ch: 'z-f-chaud' },
          { i: 'IB', n: 'Inès B.', s: 'Nouveau', c: 'z-f-seg-nouveau', t: '138 €', ch: 'z-f-tiede' },
          { i: 'TR', n: 'Théo R.', s: 'À relancer', c: 'z-f-seg-relance', t: '97 €', ch: 'z-f-froid' },
          { i: 'SA', n: 'Sami A.', s: 'Fidèle', c: 'z-f-seg-fidele', t: '264 €', ch: 'z-f-chaud' },
        ].map(c => (
          <span key={c.n} className={`z-f-rang ${c.sel ? 'z-f-rang-choisi' : ''}`}>
            <span className="z-f-avatar">{c.i}</span>
            <strong>{c.n}</strong>
            <i className={`z-f-chaleur ${c.ch}`} />
            <em className={`z-f-seg ${c.c} z-f-droite`}>{c.s}</em>
            <span className="z-f-montant-fin">{c.t}</span>
          </span>
        ))}
        <span className="z-f-mini">Campagnes · Segments automatiques · Doublons · Newsletter</span>
      </div>
      <div className="z-f-carte z-f-large-seul">
        <span className="z-f-ligne-simple">
          <span className="z-f-avatar z-f-avatar-grand">LM</span>
          <span className="z-f-pile-texte">
            <strong>Luka M.</strong>
            <small>Client depuis 2024 · France</small>
          </span>
        </span>
        <span className="z-f-puces">
          <Puce claire>Gold</Puce>
          <Puce claire>Fan de trap sombre</Puce>
        </span>
        <div className="z-f-grille3 z-f-serre z-f-reste-trois">
          <span className="z-f-stat">
            <b>7</b>
            <small>achats</small>
          </span>
          <span className="z-f-stat">
            <b>487 €</b>
            <small>dépensés</small>
          </span>
          <span className="z-f-stat">
            <b>9/12</b>
            <small>e-mails ouverts</small>
          </span>
        </div>
        <small className="z-f-lib">Goûts</small>
        {(
          [
            ['Trap', 62],
            ['Drill', 25],
            ['R&B', 13],
          ] as const
        ).map(([g, v]) => (
          <span key={g} className="z-f-jauge">
            <span>{g}</span>
            <span className="z-f-barre">
              <i style={{ width: `${v}%` }} />
            </span>
            <span>{v} %</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ——————————— 6. Automatisations ——————————— */
const SCENARIOS = [
  'Bienvenue perso',
  'Bienvenue abonnement',
  'Remerciement — 1er achat',
  'Remerciement — 2e achat',
  'Remerciement — 3e achat',
  'Remerciement — 4e achat et +',
  '1er achat + invitation membre',
  'Achats réguliers + invitation',
  'Relance des inactifs',
  'Suivi téléchargement gratuit',
  'Abonnement en attente',
  'Départ d’un membre',
  'Membre parti trop vite',
]

function EcranAutomatisations() {
  return (
    <div className="z-f-grille2">
      <div className="z-f-carte z-f-carte-liste z-f-large-seul">
        {SCENARIOS.map(s => (
          <span key={s} className={`z-f-rang z-f-rang-fin ${s === 'Relance des inactifs' ? 'z-f-rang-choisi' : ''}`}>
            <span>{s}</span>
            <span className="z-f-droite">
              <Inter on={s !== 'Abonnement en attente'} />
            </span>
          </span>
        ))}
      </div>
      <div className="z-f-carte">
        <span className="z-f-ligne-simple">
          <p className="z-f-h">Relance des inactifs</p>
          <span className="z-f-droite">
            <Inter />
          </span>
        </span>
        <div className="z-f-flux">
          {[
            ['Déclencheur', '3 mois sans achat'],
            ['E-mail à ton image', '« Ça fait longtemps, {prénom} »'],
            ['Code personnel créé tout seul', '−50 % · valable 30 jours'],
          ].map(([t, d], i) => (
            <span key={t} className="z-f-etape">
              <i>{i + 1}</i>
              <span className="z-f-pile-texte">
                <strong>{t}</strong>
                <small>{d}</small>
              </span>
            </span>
          ))}
        </div>
        <div className="z-f-grille3 z-f-serre z-f-reste-trois">
          <span className="z-f-stat">
            <b>23</b>
            <small>relancés</small>
          </span>
          <span className="z-f-stat">
            <b>6</b>
            <small>revenus</small>
          </span>
          <span className="z-f-stat">
            <b>412 €</b>
            <small>de ventes</small>
          </span>
        </div>
      </div>
    </div>
  )
}

/* ——————————— 7. Factures & TVA ——————————— */
function EcranFactures() {
  return (
    <div className="z-f-grille2">
      <div className="z-f-papier">
        <span className="z-f-ligne-simple">
          <strong>Facture JAKEB-0142</strong>
          <em className="z-f-ok z-f-droite">Envoyée</em>
        </span>
        <span className="z-f-papier-parties">
          <span>
            <small>Vendeur</small>Jake B
          </span>
          <span>
            <small>Client</small>Luka M.
          </span>
          <span>
            <small>Date</small>14/11/2026
          </span>
        </span>
        <span className="z-f-rang">
          <span>Ambitieux · Licence Premium</span>
          <span className="z-f-droite">40,83 €</span>
        </span>
        <span className="z-f-rang">
          <span>TVA 20 %</span>
          <span className="z-f-droite">8,17 €</span>
        </span>
        <span className="z-f-rang z-f-rang-total">
          <strong>Total TTC</strong>
          <strong className="z-f-droite">49,00 €</strong>
        </span>
        <small className="z-f-mini">Modèle français · numérotation automatique · tes mentions</small>
      </div>
      <div className="z-f-colonne">
        <div className="z-f-carte">
          <Champ lib="Numérotation">
            <span className="z-f-saisie z-f-mono">{'{SLUG}-{NUM}{MM}{AA}'}</span>
          </Champ>
          <div className="z-f-grille2 z-f-serre z-f-reste-deux">
            <Champ lib="TVA">
              <span className="z-f-saisie">20 %</span>
            </Champ>
            <Champ lib="Modèle">
              <span className="z-f-saisie">Français</span>
            </Champ>
          </div>
        </div>
        <div className="z-f-carte">
          <p className="z-f-h">Collab · Pack Drill</p>
          <span className="z-f-rang">
            <span className="z-f-avatar">JB</span>
            <span className="z-f-pile-texte">
              <strong>Jake B · 50 %</strong>
              <small>Sa facture · TVA 20 %</small>
            </span>
          </span>
          <span className="z-f-rang">
            <span className="z-f-avatar">AC</span>
            <span className="z-f-pile-texte">
              <strong>ACHPRODD · 50 %</strong>
              <small>Sa facture · sans TVA (art. 293 B)</small>
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

/* ——————————— 8. Litiges ——————————— */
function EcranLitiges() {
  return (
    <div className="z-f-colonne">
      <span className="z-f-ligne-simple">
        <p className="z-f-h">Commande #142 · Ambitieux · 49 €</p>
        <em className="z-f-alerte z-f-droite">Litige</em>
      </span>
      <div className="z-f-carte z-f-carte-litige">
        <span className="z-f-ligne-simple">
          <strong>Réponds avant le 24 novembre</strong>
          <small className="z-f-mini z-f-droite z-f-large-seul">Rappel envoyé 3 jours avant</small>
        </span>
        <small className="z-f-lib">Preuves rassemblées automatiquement</small>
        <div className="z-f-grille2 z-f-serre">
          {[
            'Description de la vente',
            'Contrat de licence de l’acheteur',
            'Facture JAKEB-0142',
            'Téléchargements et adresses IP',
            'Coordonnées de l’acheteur',
            'Date d’achat',
          ].map(p => (
            <Coche key={p}>{p}</Coche>
          ))}
        </div>
        <span className="z-f-saisie z-f-saisie-douce z-f-saisie-haute">Ajouter un message ou un fichier (facultatif)</span>
        <span className="z-f-ligne-simple">
          <span className="z-f-bouton">Répondre au litige</span>
          <span className="z-f-mini-bouton">Accepter</span>
        </span>
      </div>
    </div>
  )
}

/* ——————————— 9. Centralisation ——————————— */
function EcranCentralisation() {
  return (
    <div className="z-f-colonne">
      <div className="z-f-grille3 z-f-serre">
        <div className="z-f-carte z-f-carte-bleue">
          <small className="z-f-lib">Toutes plateformes</small>
          <span className="z-f-gros">48 920 €</span>
        </div>
        <div className="z-f-carte">
          <small className="z-f-lib">Commandes</small>
          <span className="z-f-gros">1 284</span>
        </div>
        <div className="z-f-carte z-f-large-seul">
          <small className="z-f-lib">Sources</small>
          <span className="z-f-gros">5</span>
        </div>
      </div>
      <div className="z-f-carte">
        {[
          { d: '14 nov.', c: 'Luka M.', b: 'Ambitieux', s: 'Sonoo', sc: 'z-f-src-sonoo', m: '49 €' },
          { d: '13 nov.', c: 'Naya K.', b: 'Mirage', s: 'BeatStars · Marketplace', sc: 'z-f-src-bs', m: '29,99 €' },
          { d: '12 nov.', c: 'Inès B.', b: 'Pack Drill', s: 'BeatStars · Pro Page', sc: 'z-f-src-bs', m: '89 €' },
          { d: '10 nov.', c: 'Théo R.', b: 'Nuit', s: 'Airbit', sc: 'z-f-src-autre', m: '34,95 €' },
          { d: '09 nov.', c: 'Sami A.', b: 'Mémoire', s: 'Mon site', sc: 'z-f-src-autre', m: '45 €' },
        ].map(o => (
          <span key={o.d + o.c} className="z-f-rang">
            <span className="z-f-date z-f-large-seul">{o.d}</span>
            <span className="z-f-pile-texte">
              <strong>{o.b}</strong>
              <small>{o.c}</small>
            </span>
            <em className={`z-f-source ${o.sc} z-f-droite`}>{o.s}</em>
            <strong className="z-f-montant-fin">{o.m}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ——————————— 10. Piloter ——————————— */
function EcranPiloter() {
  return (
    <div className="z-f-mosaique">
      <div className="z-f-carte">
        <small className="z-f-lib">CA par licence</small>
        {(
          [
            ['Premium', 82],
            ['Basic', 40],
            ['Trackout', 26],
            ['Exclusive', 12],
          ] as const
        ).map(([nom, v]) => (
          <span key={nom} className="z-f-jauge">
            <span>{nom}</span>
            <span className="z-f-barre">
              <i style={{ width: `${v}%` }} />
            </span>
          </span>
        ))}
      </div>
      <div className="z-f-carte">
        <small className="z-f-lib">Top beats</small>
        {['Ambitieux', 'Nuit', 'Mirage', 'Pack Drill'].map((b, i) => (
          <span key={b} className="z-f-rang z-f-rang-fin">
            <span>
              {i + 1}. {b}
            </span>
            <span className="z-f-droite">{[148, 97, 81, 63][i]}</span>
          </span>
        ))}
      </div>
      <div className="z-f-carte">
        <small className="z-f-lib">Appareils</small>
        <span className="z-f-ligne-simple">
          <i className="z-f-donut" />
          <span className="z-f-pile-texte">
            <small>Téléphone 68 %</small>
            <small>Ordinateur 32 %</small>
          </span>
        </span>
      </div>
      <div className="z-f-carte">
        <small className="z-f-lib">Pays</small>
        {(
          [
            ['France', 96],
            ['Belgique', 28],
            ['Canada', 22],
          ] as const
        ).map(([nom, v]) => (
          <span key={nom} className="z-f-jauge">
            <span>{nom}</span>
            <span className="z-f-barre">
              <i style={{ width: `${v}%` }} />
            </span>
          </span>
        ))}
      </div>
      <div className="z-f-carte">
        <small className="z-f-lib">Sources</small>
        <span className="z-f-colonnes">
          {[70, 45, 88, 30, 55].map((h, i) => (
            <i key={i} style={{ height: `${h}%` }} />
          ))}
        </span>
        <small className="z-f-mini">Insta · YouTube · Direct · TikTok · Google</small>
      </div>
      <div className="z-f-carte z-f-carte-bleue">
        <small className="z-f-lib">Abonnements</small>
        <span className="z-f-gros">87 actifs</span>
        <small className="z-f-mini">Durée moyenne 7 mois</small>
      </div>
    </div>
  )
}

/* ——————————— Bientôt : assistant IA interne ——————————— */
function EcranIaInterne() {
  return (
    <div className="z-f-chat">
      <div className="z-f-bulle z-f-bulle-moi">
        Ajoute ACHPRODD en collaborateur sur le beat « NUIT » à 50 %, exporte toutes mes factures et envoie une campagne par mail à mes clients fans de TRAP SOMBRE
      </div>
      <div className="z-f-bulle z-f-bulle-ia">
        <span className="z-f-ia-nom">
          <I.Etincelle taille={12} /> Sonoo IA
        </span>
        <span>C’est fait :</span>
        <Coche>ACHPRODD ajouté sur « NUIT » · 50 %</Coche>
        <Coche>Export prêt : 412 factures (ZIP)</Coche>
        <Coche>Campagne envoyée à 186 fans de trap sombre</Coche>
      </div>
      <div className="z-f-saisie-ia">
        <I.Etincelle taille={14} />
        <span>Demande à Sonoo…</span>
        <span className="z-f-envoyer">
          <I.Fleche taille={14} />
        </span>
      </div>
    </div>
  )
}

/* ——————————— Bientôt : assistant IA sur la boutique ——————————— */
function EcranIaBoutique() {
  return (
    <div className="z-f-grille2">
      <div className="z-f-apercu z-f-large-seul">
        <span className="z-f-apercu-barre">
          <strong>JAKE B</strong>
          <span>jakebmusic.com</span>
        </span>
        <strong className="z-f-apercu-titre">Trouve l’instru qu’il te faut</strong>
        <span className="z-f-apercu-pochettes">
          <Pochette fond={P.nuit} />
          <Pochette fond={P.bleu} />
          <Pochette fond={P.gris} />
          <Pochette fond={P.violet} />
        </span>
      </div>
      <div className="z-f-chat z-f-chat-widget">
        <span className="z-f-ia-nom">
          <I.Etincelle taille={12} /> Assistant de Jake B
        </span>
        <div className="z-f-bulle z-f-bulle-moi">Je cherche un beat trap sombre pour mon clip, budget 50 €</div>
        <div className="z-f-bulle z-f-bulle-ia">
          <span>Ces 2 beats collent. La licence Premium (49 €) couvre ton clip YouTube.</span>
          {[
            { t: 'Nuit', d: 'Trap sombre · 140 BPM', f: P.nuit },
            { t: 'Ambitieux', d: 'Trap · 142 BPM', f: P.violet },
          ].map(b => (
            <span key={b.t} className="z-f-rang">
              <Pochette fond={b.f} />
              <span className="z-f-pile-texte">
                <strong>{b.t}</strong>
                <small>{b.d}</small>
              </span>
              <span className="z-f-mini-bouton z-f-droite">Ajouter</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ——————————— Bientôt : support centralisé ——————————— */
function EcranSupport() {
  return (
    <div className="z-f-grille2">
      <div className="z-f-carte z-f-large-seul">
        <p className="z-f-h">Boîte de réception</p>
        {[
          { i: <I.Instagram taille={12} />, n: 'Luka M.', t: 'J’ai pas reçu mon fichier WAV', sel: true },
          { i: <I.Enveloppe taille={12} />, n: 'Naya K.', t: 'Quelle licence pour un clip ?' },
          { i: <I.TikTok taille={12} />, n: 'Inès B.', t: 'Nuit est dispo en exclu ?' },
          { i: <I.YouTube taille={12} />, n: 'Théo R.', t: 'Je peux le sortir sur Spotify ?' },
        ].map(m => (
          <span key={m.n} className={`z-f-rang ${m.sel ? 'z-f-rang-choisi' : ''}`}>
            <span className="z-f-canal">{m.i}</span>
            <span className="z-f-pile-texte">
              <strong>{m.n}</strong>
              <small>{m.t}</small>
            </span>
          </span>
        ))}
      </div>
      <div className="z-f-chat">
        <div className="z-f-bulle z-f-bulle-client">J’ai pas reçu mon fichier WAV pour Ambitieux</div>
        <div className="z-f-bulle z-f-bulle-ia">
          <span className="z-f-ia-nom">
            <I.Etincelle taille={12} /> Réponse proposée
          </span>
          <span>Salut Luka ! Ton WAV t’attend dans ton espace client, rubrique « Mes achats ». Je te renvoie aussi le lien par e-mail.</span>
        </div>
        <span className="z-f-ligne-simple">
          <span className="z-f-bouton">Envoyer</span>
          <span className="z-f-mini-bouton">Modifier</span>
        </span>
      </div>
    </div>
  )
}

/* ——————————— Bientôt : beat tracking ——————————— */
function EcranTracking() {
  return (
    <div className="z-f-colonne">
      <div className="z-f-grille3 z-f-serre z-f-reste-trois">
        <div className="z-f-carte">
          <small className="z-f-lib">Morceaux trouvés</small>
          <span className="z-f-gros">37</span>
        </div>
        <div className="z-f-carte">
          <small className="z-f-lib">Écoutes</small>
          <span className="z-f-gros">2,4 M</span>
        </div>
        <div className="z-f-carte z-f-carte-alerte">
          <small className="z-f-lib">Sans licence</small>
          <span className="z-f-gros">2</span>
        </div>
      </div>
      <div className="z-f-carte">
        {[
          { m: '« Minuit » — Luka M.', b: 'beat Ambitieux · YouTube 120 k vues', ok: 'Licence valide' },
          { m: '« Sans toi » — Naya K.', b: 'beat Mirage · Spotify 48 k écoutes', ok: 'Licence valide' },
          { m: '« Zone » — inconnu', b: 'beat Nuit · TikTok 310 k vues', ko: 'Aucune licence' },
        ].map(t => (
          <span key={t.m} className="z-f-rang">
            <span className="z-f-pile-texte">
              <strong>{t.m}</strong>
              <small>{t.b}</small>
            </span>
            {t.ok ? <em className="z-f-ok z-f-droite">{t.ok}</em> : <em className="z-f-alerte z-f-droite">{t.ko}</em>}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ——————————— Bientôt : SACEM ——————————— */
function EcranSacem() {
  return (
    <div className="z-f-grille2">
      <div className="z-f-carte">
        <p className="z-f-h">Contrat SACEM · « Minuit »</p>
        {[
          { n: 'Luka M.', i: 'LM', r: 'Auteur', p: '50 %' },
          { n: 'Jake B', i: 'JB', r: 'Compositeur', p: '50 %' },
        ].map(a => (
          <span key={a.n} className="z-f-rang">
            <span className="z-f-avatar">{a.i}</span>
            <span className="z-f-pile-texte">
              <strong>{a.n}</strong>
              <small>{a.r}</small>
            </span>
            <strong className="z-f-droite">{a.p}</strong>
          </span>
        ))}
        <span className="z-f-bouton">Générer le contrat</span>
      </div>
      <div className="z-f-carte z-f-large-seul">
        <p className="z-f-h">Tes morceaux</p>
        {[
          { t: 'Minuit', a: 'Luka M.', ok: false },
          { t: 'Sans toi', a: 'Naya K.', ok: true },
          { t: 'Zone', a: 'Sami A.', ok: true },
          { t: 'Nuit blanche', a: 'Inès B.', ok: false },
        ].map(m => (
          <span key={m.t} className="z-f-rang">
            <span className="z-f-pile-texte">
              <strong>{m.t}</strong>
              <small>{m.a}</small>
            </span>
            <em className={`${m.ok ? 'z-f-ok' : 'z-f-attente'} z-f-droite`}>{m.ok ? 'Déclaré' : 'À déclarer'}</em>
          </span>
        ))}
      </div>
    </div>
  )
}

const OUTILS: Outil[] = [
  { id: 'boutique', nom: 'Boutique à ton image', icone: M.MarqueBoutique, phrase: 'Couleurs, logo, domaine, catégories, paiements : tu règles tout toi-même.', ecran: EcranBoutique },
  { id: 'espace-client', nom: 'Espace client', icone: I.Personne, phrase: 'Tes clients retrouvent tous leurs achats chez toi, pas sur une marketplace.', ecran: EcranEspaceClient },
  { id: 'codes-promo', nom: 'Codes promo', icone: I.Ticket, phrase: 'Tu peux tout faire avec. Et même les laisser se créer tout seuls.', ecran: EcranCodesPromo },
  { id: 'marketing', nom: 'Marketing', icone: I.Couronne, phrase: 'Transforme tes fans en abonnés, avec des avantages qui donnent envie de rester.', ecran: EcranMarketing },
  { id: 'crm', nom: 'CRM', icone: M.MarqueMembres, phrase: 'Tu sais tout sur tes clients, et tu les tries comme tu veux.', ecran: EcranCrm },
  { id: 'automatisations', nom: 'Automatisations', icone: I.Eclair, phrase: 'Treize scénarios qui tournent tout seuls, pendant que tu composes.', ecran: EcranAutomatisations },
  { id: 'factures', nom: 'Factures & TVA', icone: I.Document, phrase: 'Factures aux normes, TVA gérée. En collab, chacun la sienne.', ecran: EcranFactures },
  { id: 'litiges', nom: 'Litiges', icone: I.Cadenas, phrase: 'Un litige ? Sonoo rassemble les preuves. Tu contestes en un clic.', ecran: EcranLitiges },
  { id: 'centralisation', nom: 'Centralisation', icone: M.MarqueCommandes, phrase: 'Toutes tes ventes, d’où qu’elles viennent, au même endroit.', ecran: EcranCentralisation },
  { id: 'piloter', nom: 'Piloter', icone: M.MarqueStatistiques, phrase: 'Tout se mesure : tes beats, tes clients, ton argent.', ecran: EcranPiloter },
  { id: 'ia', nom: 'Assistant IA', icone: I.Etincelle, phrase: 'Tu demandes, Sonoo s’en occupe.', ecran: EcranIaInterne, bientot: true },
  { id: 'ia-boutique', nom: 'IA sur ta boutique', icone: I.Etincelle, phrase: 'Un assistant aide tes clients à choisir leur beat et leur licence.', ecran: EcranIaBoutique, bientot: true },
  { id: 'support', nom: 'Support client', icone: I.Enveloppe, phrase: 'Tous tes e-mails et DM au même endroit. L’IA propose les réponses.', ecran: EcranSupport, bientot: true },
  { id: 'tracking', nom: 'Beat tracking', icone: I.Globe, phrase: 'Où tes beats sont exploités, et qui a vraiment une licence.', ecran: EcranTracking, bientot: true },
  { id: 'sacem', nom: 'Gestion SACEM', icone: I.Document, phrase: 'Tes contrats SACEM générés, tes morceaux suivis.', ecran: EcranSacem, bientot: true },
]

/* ——————————— Fenêtre + carrousel ——————————— */

function Fenetre({ outil }: { outil: Outil }) {
  const Ecran = outil.ecran
  return (
    <div className={`z-f-fenetre ${outil.bientot ? 'z-f-fenetre-bientot' : ''}`}>
      <div className="z-f-fenetre-tete">
        <span className="z-f-fenetre-icone">
          <outil.icone taille={14} />
        </span>
        {outil.nom}
        {outil.bientot && <span className="z-f-badge-bientot">Bientôt</span>}
      </div>
      <div className="z-f-ecran">
        <Ecran />
      </div>
    </div>
  )
}

export function ToutEnUn() {
  const [actif, setActif] = useState(0)
  const depart = useRef<number | null>(null)
  const n = OUTILS.length

  useEffect(() => {
    const num = Number(new URLSearchParams(window.location.search).get('outil'))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique de l'adresse au chargement (aperçu)
    if (num >= 1 && num <= OUTILS.length) setActif(num - 1)
  }, [])

  const aller = (i: number) => setActif(((i % n) + n) % n)
  const surDebut = (e: TouchEvent) => {
    depart.current = e.touches[0].clientX
  }
  const surFin = (e: TouchEvent) => {
    if (depart.current === null) return
    const dx = e.changedTouches[0].clientX - depart.current
    depart.current = null
    if (Math.abs(dx) > 40) aller(actif + (dx < 0 ? 1 : -1))
  }

  const outil = OUTILS[actif]

  return (
    <div className="z-f">
      <div className="z-f-carrousel" onTouchStart={surDebut} onTouchEnd={surFin}>
        <div className="z-f-piste" style={{ '--a': actif } as CSSProperties}>
          {OUTILS.map((o, i) => (
            <div key={o.id} className={`z-f-diapo ${i === actif ? 'z-f-diapo-active' : ''}`} aria-hidden={i !== actif} onClick={() => i !== actif && aller(i)}>
              <Fenetre outil={o} />
            </div>
          ))}
        </div>
      </div>

      <div className="z-f-legende" aria-live="polite">
        <strong>
          {outil.nom}
          {outil.bientot && <span className="z-f-badge-bientot">Bientôt</span>}
        </strong>
        <span>{outil.phrase}</span>
      </div>

      <div className="z-f-commandes">
        <button type="button" className="z-f-fleche" aria-label="Outil précédent" onClick={() => aller(actif - 1)}>
          <I.Fleche taille={18} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <span className="z-f-points">
          {OUTILS.map((o, i) => (
            <button
              key={o.id}
              type="button"
              aria-label={o.nom}
              className={`${i === actif ? 'z-f-point-actif' : ''} ${o.bientot ? 'z-f-point-bientot' : ''}`}
              onClick={() => aller(i)}
            />
          ))}
        </span>
        <button type="button" className="z-f-fleche" aria-label="Outil suivant" onClick={() => aller(actif + 1)}>
          <I.Fleche taille={18} />
        </button>
      </div>
      <p className="z-f-rgpd">
        <I.Cadenas taille={13} /> Conforme au RGPD
      </p>
    </div>
  )
}
