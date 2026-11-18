import type { CSSProperties, ReactNode } from "react";
import { Symbole } from "./Logo";
import * as I from "./Icones";

// Maquettes codées (v3) : remplacent les découpes d'images de la v2, qui avaient
// leur propre fond. Aucune photo : les pochettes sont des dégradés.
// Toutes les tailles sont en em : changer la font-size d'une maquette la redimensionne.

/* ——————————— Téléphone ——————————— */

export function Telephone({
  children,
  className = "",
  sombre = false,
}: {
  children: ReactNode;
  className?: string;
  sombre?: boolean;
}) {
  return (
    <div className={`x-m-tel ${sombre ? "x-m-tel-sombre" : ""} ${className}`}>
      <div className="x-m-tel-ecran">
        <div className="x-m-tel-statut">
          <span>9:41</span>
          <span className="x-m-tel-ilot" />
          <span className="x-m-tel-batterie" />
        </div>
        {children}
      </div>
    </div>
  );
}

/* ——————————— 01 : trois boutiques ——————————— */

type Boutique = {
  nom: string;
  titre: string;
  adresse: string;
  accent: string;
  sombre: boolean;
  fond: string;
  pochettes: [string, string, string];
};

const BOUTIQUES: Boutique[] = [
  {
    nom: "ACHPRODD",
    titre: "Trouve l’instru qu’il te faut, prod. by ACHPRODD",
    adresse: "achprodd.com",
    accent: "#ef4444",
    sombre: true,
    fond: "radial-gradient(120% 60% at 50% 0%, #4a0d12 0%, #0b0b0b 60%)",
    pochettes: [
      "radial-gradient(circle at 30% 30%, #7f1d1d, #0a0a0a 70%)",
      "radial-gradient(circle at 70% 40%, #1e3a8a, #050505 70%)",
      "radial-gradient(circle at 40% 70%, #444, #050505 70%)",
    ],
  },
  {
    nom: "JAKE B",
    titre: "Trouve l’instru qu’il te faut, composée par Jake B",
    adresse: "jakebmusic.com",
    accent: "#050505",
    sombre: false,
    fond: "#ffffff",
    pochettes: [
      "radial-gradient(circle at 30% 25%, #3a4d78, #0a0a0a 72%)",
      "radial-gradient(circle at 70% 30%, #2477fb, #07122b 75%)",
      "radial-gradient(circle at 40% 70%, #6b6b6b, #050505 70%)",
    ],
  },
  {
    nom: "NEHZIA",
    titre: "Trouve l’instru qu’il te faut, prod. by Nehzia",
    adresse: "nehziabeats.com",
    accent: "#8b5cf6",
    sombre: true,
    fond: "radial-gradient(120% 60% at 50% 0%, #2e1065 0%, #0b0b0b 60%)",
    pochettes: [
      "radial-gradient(circle at 30% 30%, #6d28d9, #0a0a0a 70%)",
      "radial-gradient(circle at 60% 40%, #333, #050505 70%)",
      "radial-gradient(circle at 40% 70%, #0e7490, #050505 70%)",
    ],
  },
];

const BEATS = [
  { titre: "Ambitieux", genre: "TRAP", bpm: "142 BPM" },
  { titre: "Mélancholia", genre: "DRILL", bpm: "140 BPM" },
  { titre: "Mémoire", genre: "R&B", bpm: "85 BPM" },
];

function EcranBoutique({ b }: { b: Boutique }) {
  return (
    <div
      className={`x-m-boutique ${b.sombre ? "x-m-boutique-sombre" : ""}`}
      style={{ background: b.fond, "--x-m-accent": b.accent } as CSSProperties}
    >
      <div className="x-m-boutique-barre">
        <strong>{b.nom}</strong>
        <span className="x-m-rond">
          <I.Boutique taille={12} />
        </span>
        <span className="x-m-rond">
          <I.Personne taille={12} />
        </span>
      </div>
      <p className="x-m-boutique-titre">{b.titre}</p>
      <p className="x-m-boutique-sous">
        Des beats de qualité, licences claires, téléchargement immédiat.
      </p>
      <span className="x-m-boutique-bouton">
        <I.Couronne taille={12} />
        Devenir membre
      </span>
      <div className="x-m-boutique-rangee">
        <strong>Nouveautés</strong>
        <span>Tout voir</span>
      </div>
      <div className="x-m-pochettes">
        {BEATS.map((beat, i) => (
          <div key={beat.titre}>
            <span
              className="x-m-pochette"
              style={{ background: b.pochettes[i] }}
            >
              <em>{beat.genre}</em>
            </span>
            <strong>{beat.titre}</strong>
            <small>
              {beat.bpm} <b>49 €</b>
            </small>
          </div>
        ))}
      </div>
      <div className="x-m-lecteur">
        <span
          className="x-m-lecteur-pochette"
          style={{ background: b.pochettes[0] }}
        />
        <span>
          <strong>Ambitieux</strong>
          <small>Trap · 142 BPM</small>
        </span>
        <span className="x-m-lecteur-play">
          <I.Lecture taille={11} />
        </span>
      </div>
      <div className="x-m-safari">
        <span className="x-m-safari-aa">aA</span>
        <span className="x-m-safari-adresse">
          <I.Cadenas taille={10} />
          {b.adresse}
        </span>
        <span className="x-m-safari-recharger">↻</span>
      </div>
    </div>
  );
}

export function MaquetteMarque() {
  return (
    <div className="x-m-marque" aria-hidden="true">
      {BOUTIQUES.map((b, i) => (
        <figure key={b.nom} className={`x-m-marque-tel x-m-marque-tel-${i}`}>
          <Telephone sombre={b.sombre}>
            <EcranBoutique b={b} />
          </Telephone>
        </figure>
      ))}
    </div>
  );
}

/* ——————————— 02 : la relance ——————————— */

export function MaquetteRelance() {
  return (
    <div className="x-m-relance" aria-hidden="true">
      <div className="x-m-col x-m-col-1">
        <div className="x-m-etape">
          <span className="x-m-etape-num">1</span>
          Il décroche
        </div>
        <div className="x-m-carte-client">
          <span className="x-m-avatar">LM</span>
          <span>
            <strong>Luka M.</strong>
            <small>7 achats · 487 € dépensés</small>
          </span>
          <span className="x-m-inactif">
            <I.Horloge taille={13} />
            Inactif depuis 60 jours
          </span>
        </div>
      </div>

      <div className="x-m-col x-m-col-2">
        <div className="x-m-etape">
          <span className="x-m-etape-num">2</span>
          Sonoo le relance, à ton image
        </div>
        <Telephone className="x-m-relance-tel">
          <div className="x-m-mail">
            <span className="x-m-mail-retour">‹ Boîte de réception</span>
            <div className="x-m-mail-expediteur">
              <span className="x-m-avatar x-m-avatar-petit">JB</span>
              <span>
                <strong>Jake B</strong>
                <small>à moi · 4 juin</small>
              </span>
            </div>
            <div className="x-m-mail-corps">
              <span className="x-m-mail-tete">JAKE B</span>
              <span className="x-m-mail-visuel">
                <Symbole hauteur={46} couleur="#ffffff" />
              </span>
              <strong>Ça fait longtemps, Luka.</strong>
              <small>
                Des nouveautés trap et drill t’attendent. −15 % sur tout le
                catalogue, 48 h.
              </small>
              <span className="x-m-mail-code">LUKA15</span>
              <span className="x-m-mail-bouton">Revenir sur la boutique</span>
            </div>
          </div>
        </Telephone>
      </div>

      <div className="x-m-col x-m-col-3">
        <div className="x-m-etape">
          <span className="x-m-etape-num">3</span>
          Il revient… et s’abonne
        </div>
        <div className="x-m-carte-gold">
          <Symbole
            hauteur={150}
            couleur="rgb(255 255 255 / 0.06)"
            className="x-m-carte-gold-onde"
          />
          <span className="x-m-carte-gold-haut">
            <strong>JAKE B</strong>
            <span>Membre Gold</span>
          </span>
          <span className="x-m-carte-gold-prix">9,99 € / mois</span>
          <small>Accès aux beats réservés aux membres</small>
        </div>
        <p className="x-m-recurrent">
          <I.Courbe taille={16} />
          87 membres · 869 € / mois récurrents
        </p>
      </div>
    </div>
  );
}

/* ——————————— 03 : le tableau de bord ——————————— */

const MENU = [
  {
    titre: "Vendre",
    liens: [
      { i: I.Barres, t: "Mes beats" },
      { i: I.Boutique, t: "Ventes" },
      { i: I.Document, t: "Licences" },
    ],
  },
  {
    titre: "Fidéliser",
    liens: [
      { i: I.Personnes, t: "Clients" },
      { i: I.Megaphone, t: "Campagnes" },
      { i: I.Couronne, t: "Abonnements" },
    ],
  },
  {
    titre: "Ta marque",
    liens: [
      { i: I.Globe, t: "Ma boutique" },
      { i: I.Palette, t: "Apparence" },
    ],
  },
];

const VENTES = [
  {
    titre: "Ambitieux",
    detail: "Licence WAV · Luka M.",
    prix: "49 €",
    quand: "2 min",
    fond: "radial-gradient(circle at 30% 25%, #3a4d78, #0a0a0a 72%)",
  },
  {
    titre: "Pack Drill",
    detail: "Licence Premium · Inès B.",
    prix: "89 €",
    quand: "18 min",
    fond: "radial-gradient(circle at 70% 30%, #2477fb, #07122b 75%)",
  },
  {
    titre: "Abonnement Gold",
    detail: "Naya K. · nouveau membre",
    prix: "9,99 €",
    quand: "41 min",
    fond: "radial-gradient(circle at 40% 60%, #6d28d9, #0a0a0a 70%)",
  },
  {
    titre: "Mirage",
    detail: "Licence MP3 · Théo R.",
    prix: "29 €",
    quand: "1 h",
    fond: "radial-gradient(circle at 40% 70%, #555, #050505 70%)",
  },
];

const BARRES = [
  40, 46, 42, 50, 48, 55, 52, 60, 58, 64, 61, 70, 68, 74, 72, 80, 77, 86, 83,
  92, 88, 100,
];

const SEGMENTS = [
  { nom: "Membres Gold", valeur: "87", couleur: "#2477fb" },
  { nom: "Clients fidèles", valeur: "389", couleur: "#9cc0ff" },
  { nom: "Nouveaux clients", valeur: "142", couleur: "#dceaff" },
  { nom: "À relancer", valeur: "23", couleur: "#6e7d94" },
];

export function MaquetteTableau() {
  return (
    <div className="x-m-fenetre" aria-hidden="true">
      <div className="x-m-tdb">
        <aside className="x-m-tdb-menu">
          <span className="x-m-tdb-logo">
            <Symbole hauteur={20} couleur="#2477fb" />
            Sonoo
          </span>
          <span className="x-m-tdb-compte">
            <span className="x-m-avatar x-m-avatar-blanc">JB</span>
            <span>
              <strong>Jake B</strong>
              <small>jakebmusic.com</small>
            </span>
          </span>
          <span className="x-m-tdb-actif">
            <I.Barres taille={14} />
            Vue d’ensemble
          </span>
          {MENU.map((g) => (
            <div key={g.titre} className="x-m-tdb-groupe">
              <small>{g.titre}</small>
              {g.liens.map((l) => (
                <span key={l.t}>
                  <l.i taille={14} />
                  {l.t}
                </span>
              ))}
            </div>
          ))}
        </aside>
        <div className="x-m-tdb-contenu">
          <div className="x-m-tdb-entete">
            <span>
              <strong>Bonjour Jake</strong>
              <small>Voici ce qui se passe sur ta boutique.</small>
            </span>
            <span className="x-m-tdb-periodes">
              <span>7 j</span>
              <span className="x-m-actif">30 j</span>
              <span>12 mois</span>
            </span>
            <span className="x-m-tdb-ajouter">
              <I.Plus taille={13} />
              Ajouter un beat
            </span>
          </div>
          <div className="x-m-tdb-ligne">
            <div className="x-m-revenus">
              <span className="x-m-revenus-texte">
                <small>Revenus · 30 derniers jours</small>
                <strong>4 280 €</strong>
                <span className="x-m-hausse">+12,4 %</span>
                <span className="x-m-legende">
                  <i /> Abonnements <b>869 €</b>
                </span>
                <span className="x-m-legende x-m-legende-claire">
                  <i /> Ventes de beats <b>3 411 €</b>
                </span>
              </span>
              <span className="x-m-revenus-barres">
                {BARRES.map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </span>
            </div>
            <div className="x-m-ventes">
              <span className="x-m-carte-titre">
                <span className="x-m-point-vert" />
                Ventes en direct
                <em>Tout voir</em>
              </span>
              {VENTES.map((v) => (
                <span key={v.titre} className="x-m-vente">
                  <span
                    className="x-m-vente-pochette"
                    style={{ background: v.fond }}
                  />
                  <span>
                    <strong>{v.titre}</strong>
                    <small>{v.detail}</small>
                  </span>
                  <span className="x-m-vente-prix">
                    <strong>{v.prix}</strong>
                    <small>{v.quand}</small>
                  </span>
                </span>
              ))}
            </div>
          </div>
          <div className="x-m-clients">
            <span className="x-m-carte-titre">
              <span>
                Tes clients
                <small>641 clients actifs · 30 derniers jours</small>
              </span>
              <span className="x-m-relancer">
                <I.Envoi taille={13} />
                Relancer 23 clients
              </span>
            </span>
            <span className="x-m-segments">
              <span style={{ flex: 87, background: "#2477fb" }} />
              <span style={{ flex: 389, background: "#9cc0ff" }} />
              <span style={{ flex: 142, background: "#dceaff" }} />
              <span style={{ flex: 23, background: "#6e7d94" }} />
            </span>
            <span className="x-m-chiffres">
              {SEGMENTS.map((s) => (
                <span key={s.nom}>
                  <small>
                    <i style={{ background: s.couleur }} />
                    {s.nom}
                  </small>
                  <strong>{s.valeur}</strong>
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
