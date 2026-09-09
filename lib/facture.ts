import { PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib'
import type { createAdminClient } from '@/utils/supabase/admin'
import { NOM_PLATEFORME } from './constantes'
import type { InfosLegalesConcedant } from './licences-textes'

// Facture PDF distincte du contrat de licence (lib/contrat.ts) — Phase 8 du
// chantier 9 bis. Voir memory/project_grillme_9bis_synthese.md (section
// Facturation) et memory/project_phase8_numerotation_facture.md.
//
// Portée V1 : ventes solo uniquement (une facture par commande). Les ventes
// collaboratives (une facture par collaborateur pour sa quote-part) sont
// renvoyées à la Phase 13 (processeur collab non tranché) — voir le mémo.

export interface LigneFacture {
  designation: string // ex. "Nom du beat — Licence MP3"
  prixTTC: number // prix réellement payé — TVA toujours absorbée (Phase 9, lib/pricing.ts), jamais ajoutée par-dessus
  tauxTva: number // 0 si non applicable — sert à EXTRAIRE le HT du TTC, jamais à l'ajouter
}

export interface FactureInput {
  numeroFacture: string // déjà attribué et figé — jamais recalculé ici
  dateEmission: Date
  vendeur: { nom_artiste: string; slug: string } & InfosLegalesConcedant
  acheteur: { nom: string | null; email: string | null; adresse: string | null }
  lignes: LigneFacture[]
  mandatFacturationVersion: number
  // Numéro de TVA du vendeur au moment de cette vente (snapshot, jamais la
  // valeur live du beatmaker) — null si TVA non applicable à cette vente.
  tvaNumero: string | null
  // Logo retiré pour la V1 (2026-09-09) — le rendu blanc-sur-blanc de
  // certains logos pensés pour un fond sombre les rend invisibles sur une
  // facture à fond blanc, sans solution simple à ce stade. Prévu pour la V2
  // (fond contrastant derrière le logo). Voir memory/project_phase8_numerotation_facture.md.
}

const PAGE_W = 595
const PAGE_H = 842
const MARGIN_X = 55
const MARGIN_TOP = 70

function formaterEuros(montant: number): string {
  return `${montant.toFixed(2).replace('.', ',')} €`
}

function adresseVendeur(v: InfosLegalesConcedant): string | null {
  if (v.siege_social_adresse) return v.siege_social_adresse
  const codePostalVille = [v.code_postal, v.ville].filter(Boolean).join(' ')
  return [v.adresse, codePostalVille].filter(Boolean).join(', ') || null
}

function identiteVendeur(v: InfosLegalesConcedant): string {
  return v.raison_sociale || v.nom_artiste
}

// Même nettoyage que lib/contrat.ts : la police standard (WinAnsi) ne sait
// pas encoder les espaces insécables (U+202F/U+00A0) produits par
// toLocaleString('fr-FR') pour les séparateurs de milliers.
function nettoyerTexte(texte: string): string {
  return texte.replace(/[  ]/g, ' ')
}

export async function genererFacturePdf(input: FactureInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const page = doc.addPage([PAGE_W, PAGE_H])
  const maxWidth = PAGE_W - 2 * MARGIN_X
  let y = PAGE_H - MARGIN_TOP

  const ligneTexte = (texte: string, opts: { font?: PDFFont; size?: number; color?: [number, number, number]; x?: number } = {}) => {
    page.drawText(nettoyerTexte(texte), {
      x: opts.x ?? MARGIN_X,
      y,
      font: opts.font ?? fontRegular,
      size: opts.size ?? 9.5,
      color: rgb(...(opts.color ?? [0.2, 0.2, 0.2])),
    })
  }

  // En-tête — le nom du beatmaker (vendeur réel), jamais My Producer, même
  // principe que lib/contrat.ts (voir commentaire équivalent là-bas).
  ligneTexte(input.vendeur.nom_artiste, { font: fontBold, size: 14, color: [0.1, 0.1, 0.1] })
  y -= 18
  ligneTexte('FACTURE', { font: fontBold, size: 11, color: [0.4, 0.4, 0.75] })
  y -= 30

  // Bloc vendeur / acheteur côte à côte
  const yBlocStart = y
  ligneTexte('Émetteur', { font: fontBold, size: 8, color: [0.5, 0.5, 0.5] })
  y -= 14
  const identite = identiteVendeur(input.vendeur)
  const adresse = adresseVendeur(input.vendeur)
  const lignesVendeur = [
    identite,
    input.vendeur.numero_entreprise ? `SIRET : ${input.vendeur.numero_entreprise}` : null,
    adresse,
    input.tvaNumero ? `N° TVA : ${input.tvaNumero}` : null,
  ].filter(Boolean) as string[]
  for (const l of lignesVendeur) {
    ligneTexte(l, { size: 9 })
    y -= 13
  }

  y = yBlocStart
  const xDroite = MARGIN_X + maxWidth / 2 + 20
  ligneTexte('Client', { font: fontBold, size: 8, color: [0.5, 0.5, 0.5], x: xDroite })
  y -= 14
  const lignesAcheteur = [input.acheteur.nom, input.acheteur.adresse, input.acheteur.email].filter(Boolean) as string[]
  for (const l of lignesAcheteur) {
    ligneTexte(l, { size: 9, x: xDroite })
    y -= 13
  }

  y = Math.min(y, yBlocStart - 14 - lignesVendeur.length * 13) - 20

  // Numéro et date
  ligneTexte(`Facture n° ${input.numeroFacture}`, { font: fontBold, size: 9.5 })
  y -= 14
  ligneTexte(`Date d'émission : ${input.dateEmission.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}`, { size: 9 })
  y -= 28

  // Une facture en franchise de TVA (non assujetti) ne doit comporter ni
  // taux ni montant de TVA — pas juste "0,00 €" ou "—", carrément aucune
  // colonne/ligne de TVA. Deux mises en page distinctes selon le cas,
  // jamais un tableau HT/TVA/TTC avec des zéros pour un non-assujetti.
  const assujettiTva = input.lignes.some(l => l.tauxTva > 0)

  const colDesignationX = MARGIN_X
  const colHTX = MARGIN_X + maxWidth - 190
  const colTvaX = MARGIN_X + maxWidth - 110
  const colTTCX = MARGIN_X + maxWidth - 60
  const colPrixX = MARGIN_X + maxWidth - 60

  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + maxWidth, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  y -= 14
  page.drawText('Produits', { x: colDesignationX, y, font: fontBold, size: 8.5, color: rgb(0.45, 0.45, 0.45) })
  if (assujettiTva) {
    page.drawText('HT', { x: colHTX, y, font: fontBold, size: 8.5, color: rgb(0.45, 0.45, 0.45) })
    page.drawText('TVA', { x: colTvaX, y, font: fontBold, size: 8.5, color: rgb(0.45, 0.45, 0.45) })
    page.drawText('TTC', { x: colTTCX, y, font: fontBold, size: 8.5, color: rgb(0.45, 0.45, 0.45) })
  } else {
    page.drawText('Prix', { x: colPrixX, y, font: fontBold, size: 8.5, color: rgb(0.45, 0.45, 0.45) })
  }
  y -= 8
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + maxWidth, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  y -= 16

  let totalHT = 0
  let totalTVA = 0
  let totalPrix = 0
  for (const ligne of input.lignes) {
    // TVA absorbée (Phase 9) : prixTTC est le prix réellement payé, jamais
    // recalculé à la hausse — le HT est extrait du TTC, jamais l'inverse.
    const ht = ligne.tauxTva > 0 ? ligne.prixTTC / (1 + ligne.tauxTva / 100) : ligne.prixTTC
    const montantTVA = ligne.prixTTC - ht
    totalHT += ht
    totalTVA += montantTVA
    totalPrix += ligne.prixTTC

    page.drawText(nettoyerTexte(ligne.designation), { x: colDesignationX, y, font: fontRegular, size: 9, color: rgb(0.2, 0.2, 0.2) })
    if (assujettiTva) {
      page.drawText(formaterEuros(ht), { x: colHTX, y, font: fontRegular, size: 9, color: rgb(0.2, 0.2, 0.2) })
      page.drawText(ligne.tauxTva > 0 ? `${ligne.tauxTva}%` : '—', { x: colTvaX, y, font: fontRegular, size: 9, color: rgb(0.2, 0.2, 0.2) })
      page.drawText(formaterEuros(ligne.prixTTC), { x: colTTCX, y, font: fontRegular, size: 9, color: rgb(0.2, 0.2, 0.2) })
    } else {
      page.drawText(formaterEuros(ligne.prixTTC), { x: colPrixX, y, font: fontRegular, size: 9, color: rgb(0.2, 0.2, 0.2) })
    }
    y -= 18
  }

  y -= 6
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + maxWidth, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  y -= 18

  const totalTTC = totalHT + totalTVA
  const totaux: [string, string][] = assujettiTva
    ? [
        ['Total HT', formaterEuros(totalHT)],
        ['Total TVA', formaterEuros(totalTVA)],
        ['Total TTC', formaterEuros(totalTTC)],
      ]
    : [['Total', formaterEuros(totalPrix)]]
  for (const [label, montant] of totaux) {
    const estDernier = label === 'Total TTC' || label === 'Total'
    page.drawText(label, { x: colTvaX, y, font: estDernier ? fontBold : fontRegular, size: 9.5, color: rgb(0.1, 0.1, 0.1) })
    page.drawText(montant, { x: colTTCX, y, font: estDernier ? fontBold : fontRegular, size: 9.5, color: rgb(0.1, 0.1, 0.1) })
    y -= 16
  }

  // Juste sous le total, centrées — pas en pied de page fixe (retour de
  // Jake, voir capture annotée) : le texte légal (TVA non applicable, s'il
  // y a lieu) puis la mention courte du mandataire, dans cet ordre.
  const centrer = (texte: string, taille: number, font: PDFFont) => {
    const largeur = font.widthOfTextAtSize(texte, taille)
    return MARGIN_X + (maxWidth - largeur) / 2
  }

  y -= 26

  if (!assujettiTva) {
    const texteTva = 'TVA non applicable, article 293 B du Code général des impôts.'
    page.drawText(texteTva, { x: centrer(texteTva, 8, fontRegular), y, font: fontRegular, size: 8, color: rgb(0.5, 0.5, 0.5) })
    y -= 12
  }

  const texteMandat = nettoyerTexte(`Facture établie par ${NOM_PLATEFORME} au nom et pour le compte de ${input.vendeur.nom_artiste}.`)
  page.drawText(texteMandat, { x: centrer(texteMandat, 7.5, fontRegular), y, font: fontRegular, size: 7.5, color: rgb(0.55, 0.55, 0.55) })

  return doc.save()
}

// ============================================================
// Assemblage depuis la base — regroupe la donnée nécessaire (vendeur,
// acheteur, lignes de commande). N'attribue jamais de nouveau numéro : la
// commande doit déjà porter un numero_facture figé (attribué une seule fois
// au moment de la vente, voir lib/webhook-paiement.ts).
// ============================================================
export async function genererFacturePdfPourCommande(
  admin: ReturnType<typeof createAdminClient>,
  commandeId: string
): Promise<Uint8Array> {
  const { data: commande } = await admin
    .from('commandes')
    .select('id, beatmaker_id, numero_facture, mandat_facturation_version, tva_taux, tva_numero, acheteur_nom, acheteur_email, acheteur_adresse, created_at')
    .eq('id', commandeId)
    .single()

  if (!commande || !commande.numero_facture) {
    throw new Error(`Commande sans numéro de facture attribué: ${commandeId}`)
  }

  const [{ data: beatmaker }, { data: lignes }] = await Promise.all([
    admin.from('beatmakers').select('nom_artiste, slug, raison_sociale, forme_juridique, numero_entreprise, siege_social_adresse, adresse, ville, code_postal, email_contact_public').eq('id', commande.beatmaker_id).single(),
    admin.from('commande_lignes').select('prix_paye, beats(titre), licences(nom)').eq('commande_id', commandeId),
  ])

  if (!beatmaker) throw new Error(`Beatmaker introuvable pour la commande: ${commandeId}`)

  type LigneRow = { prix_paye: number; beats: { titre: string } | null; licences: { nom: string } | null }
  const lignesFacture: LigneFacture[] = ((lignes ?? []) as unknown as LigneRow[]).map(l => ({
    designation: `${l.beats?.titre ?? 'Beat'} — Licence ${l.licences?.nom ?? ''}`,
    prixTTC: Number(l.prix_paye),
    tauxTva: Number(commande.tva_taux ?? 0),
  }))

  return genererFacturePdf({
    numeroFacture: commande.numero_facture,
    dateEmission: new Date(commande.created_at),
    vendeur: beatmaker,
    acheteur: { nom: commande.acheteur_nom, email: commande.acheteur_email, adresse: commande.acheteur_adresse },
    lignes: lignesFacture,
    mandatFacturationVersion: commande.mandat_facturation_version ?? 1,
    tvaNumero: commande.tva_numero ?? null,
  })
}
