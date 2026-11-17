'use client'

import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode, type TouchEvent } from 'react'
import * as I from './Icones'
import * as M from './IconesMarque'
import { MaquetteTableau } from './Maquettes'

// Section « Tout-en-un » de la v4 : une fenêtre par outil Sonoo.
// Trois façons de passer d'un outil à l'autre, au choix avec le sélecteur
// (demande de Jake : comparer onglets / fenêtres empilées / carrousel).
// Les écrans sont des maquettes codées, sans photo ; tailles en em, la police
// de chaque fenêtre suit sa largeur (container query), donc tout se redimensionne.

type Mode = 'onglets' | 'pile' | 'carrousel'

type Outil = { id: string; nom: string; phrase: string; icone: ComponentType<{ taille?: number }>; ecran: () => ReactNode }

/* ——————————— Écrans ——————————— */

function EcranBoutique() {
  return (
    <div className="y-f-deux">
      <div className="y-f-reglages">
        <p className="y-f-titre">Ta boutique</p>
        <div className="y-f-champ">
          <small>Nom</small>
          <span>Jake B</span>
        </div>
        <div className="y-f-champ">
          <small>Nom de domaine</small>
          <span>
            jakebmusic.com <em className="y-f-ok">Connecté</em>
          </span>
        </div>
        <div className="y-f-champ">
          <small>Couleur principale</small>
          <span className="y-f-pastilles">
            <i className="y-f-choisi" style={{ background: '#050505' }} />
            <i style={{ background: '#2477fb' }} />
            <i style={{ background: '#ef4444' }} />
            <i style={{ background: '#8b5cf6' }} />
            <i style={{ background: '#f5c542' }} />
          </span>
        </div>
        <div className="y-f-champ">
          <small>Logo</small>
          <span className="y-f-logo-jb">JB</span>
        </div>
        <span className="y-f-bouton">Publier</span>
      </div>
      <div className="y-f-apercu">
        <span className="y-f-apercu-barre">
          <strong>JAKE B</strong>
          <span>Beats · Licences · Membres</span>
        </span>
        <strong className="y-f-apercu-titre">Trouve l’instru qu’il te faut, composée par Jake B</strong>
        <span className="y-f-apercu-bouton">Écouter les nouveautés</span>
        <span className="y-f-apercu-pochettes">
          <i style={{ background: 'radial-gradient(circle at 30% 25%, #3a4d78, #0a0a0a 72%)' }} />
          <i style={{ background: 'radial-gradient(circle at 70% 30%, #2477fb, #07122b 75%)' }} />
          <i style={{ background: 'radial-gradient(circle at 40% 70%, #6b6b6b, #050505 70%)' }} />
          <i style={{ background: 'radial-gradient(circle at 60% 40%, #6d28d9, #0a0a0a 70%)' }} />
        </span>
      </div>
    </div>
  )
}

const LICENCES = [
  { nom: 'Basic', fichiers: 'MP3', prix: '29 €', droits: '50 000 streams', active: true },
  { nom: 'Premium', fichiers: 'WAV', prix: '49 €', droits: '500 000 streams', active: true },
  { nom: 'Trackout', fichiers: 'WAV + pistes', prix: '89 €', droits: 'Illimité', active: true },
  { nom: 'Exclusive', fichiers: 'Tous les fichiers', prix: 'Sur offre', droits: 'Illimité · beat retiré', active: false },
]

function EcranLicences() {
  return (
    <div className="y-f-pile-v">
      <div className="y-f-entete">
        <p className="y-f-titre">Licences</p>
        <span className="y-f-bouton">
          <I.Plus taille={12} /> Nouvelle licence
        </span>
      </div>
      <div className="y-f-tableau">
        <span className="y-f-ligne y-f-ligne-tete">
          <span>Licence</span>
          <span>Fichiers</span>
          <span>Droits</span>
          <span>Prix</span>
          <span>En vente</span>
        </span>
        {LICENCES.map(l => (
          <span key={l.nom} className="y-f-ligne">
            <strong>{l.nom}</strong>
            <span>{l.fichiers}</span>
            <span>{l.droits}</span>
            <strong>{l.prix}</strong>
            <span className={l.active ? 'y-f-inter y-f-inter-on' : 'y-f-inter'} />
          </span>
        ))}
      </div>
      <p className="y-f-note">
        <I.Document taille={12} /> Le contrat de chaque licence est généré et envoyé à l’acheteur automatiquement.
      </p>
    </div>
  )
}

function EcranContrats() {
  return (
    <div className="y-f-deux">
      <div className="y-f-papier">
        <span className="y-f-papier-tete">
          <strong>Contrat de licence Premium</strong>
          <em className="y-f-ok">Envoyé</em>
        </span>
        <span className="y-f-papier-parties">
          <span>
            <small>Producteur</small>Jake B
          </span>
          <span>
            <small>Artiste</small>Luka M.
          </span>
          <span>
            <small>Beat</small>Ambitieux
          </span>
        </span>
        <span className="y-f-lignes-texte">
          <i style={{ width: '100%' }} />
          <i style={{ width: '92%' }} />
          <i style={{ width: '96%' }} />
          <i style={{ width: '70%' }} />
          <i style={{ width: '100%' }} />
          <i style={{ width: '84%' }} />
        </span>
        <span className="y-f-signature">Jake B</span>
      </div>
      <div className="y-f-documents">
        <p className="y-f-titre">Envoyés automatiquement</p>
        {[
          { t: 'Facture F-2026-0142', d: 'Luka M. · Ambitieux', m: '49 €' },
          { t: 'Contrat Premium', d: 'Luka M. · Ambitieux', m: 'PDF' },
          { t: 'Facture F-2026-0141', d: 'Inès B. · Pack Drill', m: '89 €' },
          { t: 'Contrat Trackout', d: 'Inès B. · Pack Drill', m: 'PDF' },
        ].map(doc => (
          <span key={doc.t} className="y-f-doc">
            <span className="y-f-doc-icone">
              <I.Document taille={13} />
            </span>
            <span>
              <strong>{doc.t}</strong>
              <small>{doc.d}</small>
            </span>
            <em>{doc.m}</em>
          </span>
        ))}
      </div>
    </div>
  )
}

const CLIENTS = [
  { i: 'LM', nom: 'Luka M.', achats: '7 achats', total: '487 €', seg: 'Gold', c: 'y-f-seg-gold' },
  { i: 'NK', nom: 'Naya K.', achats: '4 achats', total: '212 €', seg: 'Fidèle', c: 'y-f-seg-fidele' },
  { i: 'IB', nom: 'Inès B.', achats: '2 achats', total: '138 €', seg: 'Nouveau', c: 'y-f-seg-nouveau' },
  { i: 'TR', nom: 'Théo R.', achats: '3 achats', total: '97 €', seg: 'À relancer', c: 'y-f-seg-relance' },
]

function EcranClients() {
  return (
    <div className="y-f-deux">
      <div className="y-f-liste-clients">
        <p className="y-f-titre">Tes clients</p>
        {CLIENTS.map(c => (
          <span key={c.nom} className="y-f-client">
            <span className="y-f-avatar">{c.i}</span>
            <span>
              <strong>{c.nom}</strong>
              <small>
                {c.achats} · {c.total}
              </small>
            </span>
            <em className={c.c}>{c.seg}</em>
          </span>
        ))}
      </div>
      <div className="y-f-campagne">
        <span className="y-f-campagne-tete">
          <small>Campagne e-mail</small>
          <em className="y-f-ok">Envoyée</em>
        </span>
        <strong>Nouveautés de novembre</strong>
        <span className="y-f-stats">
          <span>
            <b>641</b>
            <small>envoyés</small>
          </span>
          <span>
            <b>48 %</b>
            <small>ouverts</small>
          </span>
          <span>
            <b>1 240 €</b>
            <small>de ventes</small>
          </span>
        </span>
        <span className="y-f-auto">
          <I.Eclair taille={13} />
          Relance des inactifs
          <span className="y-f-inter y-f-inter-on" />
        </span>
        <span className="y-f-auto">
          <I.Enveloppe taille={13} />
          E-mail de bienvenue
          <span className="y-f-inter y-f-inter-on" />
        </span>
      </div>
    </div>
  )
}

function EcranStatistiques() {
  return (
    <div className="y-f-stats-ecran">
      <MaquetteTableau />
    </div>
  )
}

function EcranPaiements() {
  return (
    <div className="y-f-pile-v">
      <p className="y-f-titre">Paiements</p>
      <div className="y-f-soldes">
        <span className="y-f-solde y-f-solde-bleu">
          <small>Disponible</small>
          <strong>1 284,50 €</strong>
        </span>
        <span className="y-f-solde">
          <small>En route vers ta banque</small>
          <strong>3 411,00 €</strong>
        </span>
        <span className="y-f-solde">
          <small>Commission Sonoo</small>
          <strong>0 €</strong>
        </span>
      </div>
      <div className="y-f-tableau">
        {[
          { d: '14 nov.', t: 'Ambitieux · Licence Premium', m: '+ 49,00 €', s: 'Versé' },
          { d: '14 nov.', t: 'Pack Drill · collab ACHPRODD (50 %)', m: '+ 44,50 €', s: 'Versé' },
          { d: '13 nov.', t: 'Abonnement Gold · Naya K.', m: '+ 9,99 €', s: 'Versé' },
          { d: '12 nov.', t: 'Mirage · Licence Basic', m: '+ 29,00 €', s: 'En route' },
        ].map(v => (
          <span key={v.t} className="y-f-ligne y-f-ligne-paiement">
            <span>{v.d}</span>
            <strong>{v.t}</strong>
            <strong className="y-f-montant">{v.m}</strong>
            <em className={v.s === 'Versé' ? 'y-f-ok' : 'y-f-attente'}>{v.s}</em>
          </span>
        ))}
      </div>
    </div>
  )
}

const OUTILS: Outil[] = [
  { id: 'boutique', nom: 'Boutique', icone: M.MarqueBoutique, phrase: 'Ta boutique à tes couleurs, sur ton nom de domaine.', ecran: EcranBoutique },
  { id: 'licences', nom: 'Licences', icone: M.MarqueLicence, phrase: 'Tes licences, tes prix, tes droits. En deux clics.', ecran: EcranLicences },
  { id: 'contrats', nom: 'Contrats & factures', icone: I.Document, phrase: 'Chaque vente part avec son contrat et sa facture. Tout seul.', ecran: EcranContrats },
  { id: 'clients', nom: 'Clients & e-mails', icone: M.MarqueMembres, phrase: 'Tes clients, tes campagnes, tes relances automatiques.', ecran: EcranClients },
  { id: 'stats', nom: 'Statistiques', icone: M.MarqueStatistiques, phrase: 'Tout ton business sur un seul écran.', ecran: EcranStatistiques },
  { id: 'paiements', nom: 'Paiements', icone: M.MarquePaiementSecurise, phrase: 'L’argent arrive directement sur ton compte. 0 % de commission.', ecran: EcranPaiements },
]

/* ——————————— Fenêtre ——————————— */

function Fenetre({ outil, active = true }: { outil: Outil; active?: boolean }) {
  const Ecran = outil.ecran
  return (
    <div className={`y-f-fenetre ${active ? 'y-f-fenetre-active' : ''}`}>
      <div className="y-f-fenetre-tete">
        <span className="y-f-fenetre-icone">
          <outil.icone taille={14} />
        </span>
        {outil.nom}
        <span className="y-f-fenetre-adresse">sonoo.app/dashboard/{outil.id}</span>
      </div>
      <div className="y-f-ecran">
        <Ecran />
      </div>
    </div>
  )
}

/* ——————————— Section ——————————— */

const MODES: { id: Mode; nom: string }[] = [
  { id: 'onglets', nom: 'Onglets' },
  { id: 'pile', nom: 'Fenêtres empilées' },
  { id: 'carrousel', nom: 'Carrousel' },
]

export function ToutEnUn() {
  const [mode, setMode] = useState<Mode>('onglets')
  const [actif, setActif] = useState(0)
  const depart = useRef<number | null>(null)
  const n = OUTILS.length

  // Aperçu : ?vue=onglets|pile|carrousel&outil=1..6 dans l'adresse ouvre directement un mode et un outil.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const vue = p.get('vue')
    const num = Number(p.get('outil'))
    /* eslint-disable react-hooks/set-state-in-effect -- lecture unique de l'adresse au chargement */
    if (vue === 'onglets' || vue === 'pile' || vue === 'carrousel') setMode(vue)
    if (num >= 1 && num <= OUTILS.length) setActif(num - 1)
    /* eslint-enable react-hooks/set-state-in-effect */
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
  const commandes = (
    <div className="y-f-commandes">
      <button type="button" className="y-f-fleche" aria-label="Outil précédent" onClick={() => aller(actif - 1)}>
        <I.Fleche taille={18} style={{ transform: 'rotate(180deg)' }} />
      </button>
      <span className="y-f-points">
        {OUTILS.map((o, i) => (
          <button key={o.id} type="button" aria-label={o.nom} className={i === actif ? 'y-f-point-actif' : undefined} onClick={() => aller(i)} />
        ))}
      </span>
      <button type="button" className="y-f-fleche" aria-label="Outil suivant" onClick={() => aller(actif + 1)}>
        <I.Fleche taille={18} />
      </button>
    </div>
  )

  return (
    <div className={`y-f y-f-mode-${mode}`}>
      {/* Sélecteur réservé à l'aperçu : comparer les 3 présentations */}
      <div className="y-f-selecteur" role="group" aria-label="Présentation à comparer (aperçu)">
        <span>Aperçu :</span>
        {MODES.map(m => (
          <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
            {m.nom}
          </button>
        ))}
      </div>

      {mode === 'onglets' && (
        <div className="y-f-onglets" role="tablist" aria-label="Outils Sonoo">
          {OUTILS.map((o, i) => (
            <button key={o.id} type="button" role="tab" aria-selected={i === actif} onClick={() => aller(i)}>
              <o.icone taille={18} />
              {o.nom}
            </button>
          ))}
        </div>
      )}

      <div className="y-f-scene" onTouchStart={surDebut} onTouchEnd={surFin}>
        {mode === 'onglets' && <Fenetre outil={outil} />}

        {mode === 'pile' && (
          <div className="y-f-pile">
            {OUTILS.map((o, i) => {
              const profondeur = (i - actif + n) % n
              return (
                <div
                  key={o.id}
                  className="y-f-pile-carte"
                  style={{ '--p': profondeur, zIndex: n - profondeur } as CSSProperties}
                  aria-hidden={profondeur !== 0}
                  onClick={() => profondeur !== 0 && aller(i)}
                >
                  <Fenetre outil={o} active={profondeur === 0} />
                </div>
              )
            })}
          </div>
        )}

        {mode === 'carrousel' && (
          <div className="y-f-carrousel">
            <div className="y-f-piste" style={{ '--a': actif } as CSSProperties}>
              {OUTILS.map((o, i) => (
                <div
                  key={o.id}
                  className={`y-f-diapo ${i === actif ? 'y-f-diapo-active' : ''}`}
                  aria-hidden={i !== actif}
                  onClick={() => i !== actif && aller(i)}
                >
                  <Fenetre outil={o} active={i === actif} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="y-f-legende" aria-live="polite">
        <strong>{outil.nom}</strong>
        <span>{outil.phrase}</span>
      </div>
      {commandes}
    </div>
  )
}
