import type { Role } from './association'
import type { Tableau } from './tableau'
import { deviseEcrite, formeDate, lireMontant } from './valeurs'

// Devinette du rôle de chaque colonne : d'abord par son CONTENU (@, dates,
// montants, valeurs qui se répètent), le nom de la colonne ne sert que
// d'indice. Ce n'est qu'une proposition : le beatmaker valide chaque colonne.

const sansAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

type Profil = {
  remplies: number
  distinctes: number
  pEmail: number
  pDate: number
  pMontant: number
  pEntier: number
  pDecimal: number
  pSymbole: number
  pDevise: number
  pCode3: number
  pTelephone: number
  pEspace: number
  pLettres: number
  longueurMoy: number
  maxEntier: number
  constanteParCommande: number | null
}

function profil(valeurs: string[], numeros: string[] | null): Profil {
  const v = valeurs.filter(x => x)
  const n = v.length || 1
  const part = (f: (x: string) => boolean) => v.filter(f).length / n
  const entiers = v.filter(x => /^\d+$/.test(x)).map(Number)
  let constante: number | null = null
  if (numeros) {
    const parCmd = new Map<string, Set<string>>()
    valeurs.forEach((x, i) => {
      const num = numeros[i]
      if (!num) return
      const s = parCmd.get(num) ?? new Set<string>()
      s.add(x)
      parCmd.set(num, s)
    })
    const multi = [...parCmd.values()].filter(s => s.size > 0)
    const cmdsMultiLignes = numeros.filter((num, i) => num && numeros.indexOf(num) !== i).length
    if (cmdsMultiLignes > 0) constante = multi.filter(s => s.size === 1).length / (multi.length || 1)
  }
  return {
    remplies: v.length,
    distinctes: new Set(v).size,
    pEmail: part(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)),
    pDate: part(x => formeDate(x) !== null),
    pMontant: part(x => lireMontant(x) !== undefined && /\d/.test(x)),
    pEntier: part(x => /^\d+$/.test(x)),
    pDecimal: part(x => /\d[.,]\d{1,2}\b/.test(x)),
    pSymbole: part(x => /[€$]|\b(eur|usd)\b/i.test(x)),
    pDevise: part(x => deviseEcrite(x) !== null && x.trim().length <= 5),
    pCode3: part(x => /^[A-Z]{3}$/.test(x.trim()) || /^[€$£¥]$/.test(x.trim())),
    pTelephone: part(x => /^\+?[\d\s().-]{6,20}$/.test(x.trim())),
    pEspace: part(x => /\S\s+\S/.test(x.trim())),
    pLettres: part(x => /\p{L}/u.test(x)),
    longueurMoy: v.reduce((s, x) => s + x.length, 0) / n,
    maxEntier: entiers.length ? Math.max(...entiers) : 0,
    constanteParCommande: constante,
  }
}

const INDICES: Partial<Record<Role, RegExp>> = {
  email: /mail/,
  date: /date|jour|day|time|cree|created/,
  numero: /(n°|no\b|num|numero|number|commande|order|facture|invoice|transaction|\bid\b|ref)/,
  nom_complet: /(client|customer|acheteur|buyer|nom complet|full name|^name$|^nom$)/,
  prenom: /(prenom|first ?name|given)/,
  nom: /(nom de famille|last ?name|surname|family)/,
  titre: /(produit|product|item|article|titre|title|beat|element|morceau|track|instru)/,
  licence: /(licen[cs]e|lease)/,
  montant_commande: /(total|montant|amount|paye|paid|revenu|revenue|ca\b|chiffre)/,
  montant_ligne: /(prix|price|unit|tarif)/,
  quantite: /(quantite|qty|qte|quantity|nombre d.articles|articles vendus|items sold)/,
  remise: /(remise|discount|reduction|coupon amount|rabais)/,
  statut: /(statut|status|etat|state)/,
  devise: /(devise|currency|monnaie)/,
  adresse: /(adresse|address|rue\b|street)/,
  ville: /(ville|city|town|localite)/,
  code_postal: /(code postal|postcode|postal|zip)/,
  pays: /(pays|country)/,
  telephone: /(telephone|phone|\btel\b|mobile|portable)/,
  moyen_paiement: /(paiement|payment|moyen de|gateway|passerelle)/,
  source: /(source|origine|provenance|canal|referent|referer|attribution|utm|trafic|traffic)/,
}

// Colonnes qui ressemblent à une info utile mais n'en sont pas une
const PAS_UTILE = /(societe|company|note|comment|livraison|shipping|tax|tva|vat|frais|fee|rembours|refund|sous-total|subtotal|ugs|sku|type de client|code promo|coupon(?! amount)|ip\b|etat \(|state\b|region|province)/

function scores(enTete: string, p: Profil): Partial<Record<Role, number>> {
  const h = sansAccents(enTete)
  const indice = (r: Role) => (INDICES[r]?.test(h) ? 1 : 0)
  const inutile = PAS_UTILE.test(h)
  const s: Partial<Record<Role, number>> = {}
  if (p.remplies === 0) return s
  const tauxDistinct = p.distinctes / p.remplies

  // Coordonnées (facturation) : reconnues au nom de la colonne, vérifiées par
  // le contenu ; une colonne « livraison / shipping » reste ignorée (doublon)
  // source de la vente : peu de valeurs différentes, du texte
  if (!inutile && indice('source') && p.pLettres > 0.8 && p.distinctes <= 40 && p.pEmail === 0) return { source: 70 }
  if (!inutile && indice('moyen_paiement') && p.pLettres > 0.8 && p.distinctes <= 2000 && !/(date|montant|amount|total|frais|fee|statut|status|etat)/.test(h)) return { moyen_paiement: 70 }
  if (!inutile && p.pEmail < 0.05 && p.pDate < 0.5) {
    if (indice('pays') && p.longueurMoy <= 30) s.pays = 72
    else if (indice('code_postal') && p.longueurMoy <= 10) s.code_postal = 72
    else if (indice('telephone') && p.pTelephone > 0.8) s.telephone = 72
    else if (indice('ville') && p.pLettres > 0.8) s.ville = 70
    else if (indice('adresse') && p.pLettres > 0.8) s.adresse = 70
    if (s.pays || s.code_postal || s.telephone || s.ville || s.adresse) return s
  }

  if (p.pEmail > 0.8) s.email = 100 + indice('email') * 10 - (/livraison|shipping/.test(h) ? 20 : 0)
  if (p.pDate > 0.8) s.date = 90 + indice('date') * 10 - (/modif|update|paiement|payment|termin|complet/.test(h) ? 15 : 0)
  if ((p.pDevise > 0.9 || p.pCode3 > 0.9) && p.distinctes <= 5) s.devise = 80 + indice('devise') * 10

  // la quantité passe avant la liste des colonnes inutiles (« Quantité (- Remboursement) »)
  if (indice('quantite') && p.pEntier > 0.95 && p.maxEntier <= 50) s.quantite = 75
  const montant = p.pMontant > 0.9 && p.pEmail === 0 && p.pDate < 0.5 && !h.includes('#')
  // remise : la version TVA comprise est préférée (cohérente avec le montant
  // payé) ; « Taxe de la réduction » n'est pas une remise
  // TVA payée sur la commande (pas la taxe d'une remise ni de la livraison)
  if (montant && /(taxe|\btax\b|tva|vat)/.test(h) && !/(reduction|discount|remise|coupon|inc\.?|ttc|livraison|shipping|taux|rate|%)/.test(h)) {
    return { tva: 70 }
  }
  if (montant && !s.quantite && indice('remise') && !/^(taxe|tax)\b/.test(h)) {
    return { remise: 70 + (/(inc\.? ?tax|ttc|tva comprise|incl)/.test(h) ? 10 : 0) }
  }
  if (montant && !inutile && !s.quantite) {
    const decimaux = p.pDecimal > 0.2 || p.pSymbole > 0.5
    if (indice('remise')) s.remise = 70
    else if (decimaux || indice('montant_commande') || indice('montant_ligne')) {
      const constante = p.constanteParCommande
      const ligne = indice('montant_ligne') && !/total|pay|paid|regle/.test(h)
      s.montant_commande = 55 + indice('montant_commande') * 15 + (constante !== null && constante > 0.95 ? 10 : 0) - (ligne ? 20 : 0)
      s.montant_ligne = 45 + (ligne ? 25 : 0) + (constante !== null && constante < 0.95 ? 15 : 0)
    }
  }
  if (p.pEntier > 0.95 && !inutile) {
    if (tauxDistinct > 0.3 && (indice('numero') || p.maxEntier > 50)) s.numero = 60 + indice('numero') * 20
    if (p.maxEntier <= 50 && indice('quantite')) s.quantite = Math.max(s.quantite ?? 0, 75)
  } else if (indice('numero') && p.longueurMoy < 30 && tauxDistinct > 0.3 && p.pEmail === 0 && p.pDate < 0.5 && !inutile) {
    s.numero = 55
  }

  const texte = p.pLettres > 0.8 && p.pEmail < 0.2 && p.pDate < 0.2
  if (texte && !inutile) {
    if (p.distinctes <= 12 && indice('statut')) s.statut = 80
    if (indice('licence')) s.licence = 70
    if (indice('prenom')) s.prenom = 70
    if (indice('nom') && !indice('prenom')) s.nom = 68
    // « client » qui ne contient presque jamais d'espace = un prénom ou un pseudo
    if (indice('nom_complet') && !indice('prenom') && !indice('nom')) {
      if (p.pEspace < 0.2) s.prenom = 65
      else s.nom_complet = 65
    }
    if (p.longueurMoy >= 3 && p.longueurMoy <= 120) s.titre = 30 + indice('titre') * 40 + (tauxDistinct > 0.05 ? 5 : 0)
  }
  return s
}

const VALEURS_STATUT = /^(terminee|completed?|paid|payee?|en attente|pending|processing|en cours|refunded|remboursee|cancell?ed|annulee|failed|echouee|attente paiement|on-hold|wc-[a-z-]+)$/

export function devinerColonnes(tableau: Tableau): Role[] {
  const nbCol = tableau.enTetes.length
  const valeurs = (i: number) => tableau.lignes.map(l => l.cellules[i] ?? '')
  // n° de commande deviné d'abord (sert à savoir si un montant est répété par commande)
  const profilsSansNum = tableau.enTetes.map((h, i) => ({ h, s: scores(h, profil(valeurs(i), null)) }))
  const iNum = profilsSansNum.map((x, i) => ({ i, s: x.s.numero ?? 0 })).sort((a, b) => b.s - a.s)[0]
  const numeros = iNum && iNum.s > 0 ? valeurs(iNum.i) : null

  const candidats: { col: number; role: Role; score: number }[] = []
  for (let i = 0; i < nbCol; i++) {
    const p = profil(valeurs(i), numeros)
    const s = scores(tableau.enTetes[i], p)
    // statut reconnu à ses valeurs, même sans nom de colonne parlant
    if (!s.statut && p.distinctes <= 12 && p.remplies > 0) {
      const vals = [...new Set(valeurs(i).filter(Boolean).map(v => sansAccents(v.trim())))]
      if (vals.length && vals.filter(v => VALEURS_STATUT.test(v)).length / vals.length >= 0.5) s.statut = 75
    }
    for (const [role, score] of Object.entries(s) as [Role, number][]) {
      if (score > 0) candidats.push({ col: i, role, score })
    }
  }
  candidats.sort((a, b) => b.score - a.score || a.col - b.col)
  const roles: Role[] = Array(nbCol).fill('ignorer')
  const pris = new Set<Role>()
  for (const c of candidats) {
    if (roles[c.col] !== 'ignorer' || pris.has(c.role)) continue
    roles[c.col] = c.role
    pris.add(c.role)
  }
  // nom complet inutile si prénom + nom sont trouvés
  if (pris.has('prenom') && pris.has('nom')) {
    const i = roles.indexOf('nom_complet')
    if (i >= 0) roles[i] = 'ignorer'
  }
  return roles
}
