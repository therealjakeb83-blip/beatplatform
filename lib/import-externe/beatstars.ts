import { lireCsv, type LigneCsv } from './csv'
import { normaliserEmail } from '@/lib/email'

// Lecture de l'export « Transactions » de BeatStars — format validé sur un
// vrai fichier (memory/project_import_commandes_externes_grillme_2026_10_06.md) :
// - 2 lignes avant les en-têtes (« Transactions », ligne vide) ;
// - une ligne par beat ; la 1re ligne d'une commande porte le n° de facture,
//   la date et l'acheteur, les beats suivants de la même commande n'ont que
//   l'article et les prix ;
// - beat en collab = ligne du beat (1re part) + ligne suivante sans article ni
//   prix (autre part) ; chaque part dit PRIMARY (vendeur) ou COLLABORATOR ;
// - « (COLLABORATOR) » est ajouté à la fin de TOUS les titres (bruit) ;
// - beat offert = remise égale au prix ; montants en USD ;
// - Sale Price = prix − remise + frais marketplace / TVA BeatStars.

export const PLATEFORME_BEATSTARS = 'beatstars'
export const DEVISE_BEATSTARS = 'USD'

const COLONNES = {
  facture: 'Invoice Number',
  date: 'Date',
  statut: 'Status',
  boutique: 'Store Type',
  nom: 'Customer Name',
  email: 'Customer Email',
  article: 'Item Name',
  prix: 'List Price',
  remise: 'Discount',
  paye: 'Sale Price',
  partNom: 'Split Payment Id',
  partType: 'Split Payment Type',
} as const

type Cle = keyof typeof COLONNES

export type BeatLu = {
  ordre: number
  titre: string
  titreOriginal: string
  prixCatalogue: number
  remise: number
  montantDepense: number
  montantPaye: number
  offert: boolean
  parts: { nom: string; type: string }[]
}

export type CommandeLue = {
  numeroExterne: string
  dateVente: Date
  acheteurEmail: string
  acheteurNom: string | null
  typeBoutique: string | null
  referencePaiement: string | null
  beats: BeatLu[]
}

export type LigneRejetee = { numero: number; raison: string; cellules: string[] }

export type LectureBeatStars = {
  enTetes: string[]
  commandes: CommandeLue[]
  rejets: LigneRejetee[]
  nbCommandesRejetees: number
  nomVendeur: string | null
}

function index(enTetes: string[]): Record<Cle, number> | null {
  const propres = enTetes.map(h => h.trim().toLowerCase())
  const res = {} as Record<Cle, number>
  for (const [cle, nom] of Object.entries(COLONNES) as [Cle, string][]) {
    const i = propres.indexOf(nom.toLowerCase())
    if (i < 0) return null
    res[cle] = i
  }
  return res
}

function ligneEnTetes(lignes: LigneCsv[]): number {
  return lignes.slice(0, 10).findIndex(l => index(l.cellules) !== null)
}

export function estFichierBeatStars(texte: string): boolean {
  return ligneEnTetes(lireCsv(texte.slice(0, 5000))) >= 0
}

// « (COLLABORATOR) » est ajouté par BeatStars à la fin de TOUS les titres
// (bruit, la vraie collab est lue dans les parts) : seul ce suffixe est retiré.
// Le reste est le titre entier choisi par le beatmaker (« Sanglot | Piano
// Solo/No Drums ») : aucun format standard, on ne le coupe pas (Jake, 2026-10-09).
export function nettoyerTitre(article: string): string {
  return article.replace(/(\s*\(COLLABORATOR\))+\s*$/i, '').trim()
}

function montant(v: string): number | null {
  const s = v.trim().replace(/[$,\s]/g, '')
  if (s === '') return null
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  return Math.round(Number(s) * 100) / 100
}

const MOIS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
}
const DECALAGES: Record<string, number> = {
  EST: -5, EDT: -4, CST: -6, CDT: -5, MST: -7, MDT: -6, PST: -8, PDT: -7, UTC: 0, GMT: 0,
}

// « February 12, 2026 Thursday, 4:16:40 AM EST » → instant UTC exact
export function lireDateBeatStars(v: string): Date | null {
  const m = v.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?:\s+[A-Za-z]+)?,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\s+([A-Z]{2,4})$/i)
  if (!m) return null
  const mois = MOIS[m[1].toLowerCase()]
  const decalage = DECALAGES[m[8].toUpperCase()]
  if (!mois || decalage === undefined) return null
  let heure = Number(m[4]) % 12
  if (m[7].toUpperCase() === 'PM') heure += 12
  const jour = Number(m[2])
  const d = new Date(Date.UTC(Number(m[3]), mois - 1, jour, heure - decalage, Number(m[5]), Number(m[6] ?? 0)))
  if (Number.isNaN(d.getTime())) return null
  return d
}

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type CommandeEnCours = {
  commande: CommandeLue
  lignes: LigneCsv[]
  erreur: string | null
}

export function lireBeatStars(texte: string): LectureBeatStars | null {
  const lignes = lireCsv(texte)
  const iEnTetes = ligneEnTetes(lignes)
  if (iEnTetes < 0) return null
  const enTetes = lignes[iEnTetes].cellules.map(h => h.trim())
  const col = index(enTetes)!
  const cel = (l: LigneCsv, cle: Cle) => (l.cellules[col[cle]] ?? '').trim()

  const groupes: CommandeEnCours[] = []
  const rejets: LigneRejetee[] = []
  let courant: CommandeEnCours | null = null

  for (const l of lignes.slice(iEnTetes + 1)) {
    if (l.cellules.every(c => c.trim() === '')) continue
    const facture = cel(l, 'facture')
    const article = cel(l, 'article')
    const partNom = cel(l, 'partNom')
    const partType = cel(l, 'partType').toUpperCase()

    if (facture) {
      courant = {
        commande: {
          numeroExterne: facture,
          dateVente: new Date(NaN),
          acheteurEmail: normaliserEmail(cel(l, 'email')),
          acheteurNom: (() => {
            const n = cel(l, 'nom')
            return n && n !== '_not_available_' ? n : null
          })(),
          typeBoutique: cel(l, 'boutique') || null,
          referencePaiement: cel(l, 'statut') || null,
          beats: [],
        },
        lignes: [l],
        erreur: null,
      }
      groupes.push(courant)
      const date = lireDateBeatStars(cel(l, 'date'))
      if (!date) courant.erreur = `date illisible (« ${cel(l, 'date')} »)`
      else courant.commande.dateVente = date
      if (!courant.erreur && !EMAIL_VALIDE.test(courant.commande.acheteurEmail)) {
        courant.erreur = courant.commande.acheteurEmail ? `email invalide (« ${courant.commande.acheteurEmail} »)` : 'email de l’acheteur manquant'
      }
    } else if (!courant) {
      rejets.push({ numero: l.numero, raison: 'ligne sans commande au-dessus (n° de facture manquant)', cellules: l.cellules })
      continue
    } else {
      courant.lignes.push(l)
    }

    if (article) {
      const prix = montant(cel(l, 'prix'))
      const remise = montant(cel(l, 'remise')) ?? 0
      const paye = montant(cel(l, 'paye'))
      if (!courant.erreur) {
        if (/[\r\n]/.test(article)) courant.erreur = 'plusieurs beats dans une même case (prix de chaque beat inconnu)'
        else if (prix === null) courant.erreur = `prix illisible (« ${cel(l, 'prix')} »)`
        else if (paye === null) courant.erreur = `montant payé illisible (« ${cel(l, 'paye')} »)`
        else if (remise < 0 || remise > prix + 0.001) courant.erreur = 'remise supérieure au prix'
      }
      const depense = Math.max(Math.round(((prix ?? 0) - remise) * 100) / 100, 0)
      courant.commande.beats.push({
        ordre: courant.commande.beats.length,
        titre: nettoyerTitre(article),
        titreOriginal: article,
        prixCatalogue: prix ?? 0,
        remise,
        montantDepense: depense,
        montantPaye: paye ?? 0,
        offert: depense === 0,
        parts: partNom ? [{ nom: partNom, type: partType }] : [],
      })
    } else {
      // Ligne de part (autre vendeur d'un beat collab) : rattachée au beat au-dessus
      const beat = courant.commande.beats.at(-1)
      if (!courant.erreur) {
        if (!beat) courant.erreur = 'ligne de part sans beat au-dessus'
        else if (!partNom) courant.erreur = 'ligne sans article ni vendeur'
        else if (cel(l, 'prix') || cel(l, 'paye')) courant.erreur = 'ligne de part avec un prix (format inattendu)'
      }
      if (beat && partNom) beat.parts.push({ nom: partNom, type: partType })
    }
  }

  // Contrôles par commande + factures en double dans le fichier
  const vues = new Set<string>()
  const commandes: CommandeLue[] = []
  let nbCommandesRejetees = 0
  for (const g of groupes) {
    let erreur = g.erreur
    if (!erreur && g.commande.beats.length === 0) erreur = 'commande sans beat'
    if (!erreur) {
      for (const b of g.commande.beats) {
        const nbPrimary = b.parts.filter(p => p.type === 'PRIMARY').length
        if (nbPrimary !== 1) { erreur = `« ${b.titre} » : ${nbPrimary === 0 ? 'aucun vendeur principal' : 'plusieurs vendeurs principaux'}`; break }
      }
    }
    if (!erreur && vues.has(g.commande.numeroExterne)) erreur = 'n° de facture en double dans le fichier'
    if (erreur) {
      const multi = g.commande.beats.length > 1 ? ' — toute la commande est rejetée' : ''
      for (const l of g.lignes) rejets.push({ numero: l.numero, raison: erreur + multi, cellules: l.cellules })
      nbCommandesRejetees++
      continue
    }
    vues.add(g.commande.numeroExterne)
    commandes.push(g.commande)
  }
  rejets.sort((a, b) => a.numero - b.numero)

  // Nom BeatStars du beatmaker = celui qui apparaît sur le plus de parts
  const compte = new Map<string, number>()
  for (const c of commandes) for (const b of c.beats) for (const p of b.parts) compte.set(p.nom, (compte.get(p.nom) ?? 0) + 1)
  const nomVendeur = [...compte.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return { enTetes, commandes, rejets, nbCommandesRejetees, nomVendeur }
}
