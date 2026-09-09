import { PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib'
import sharp from 'sharp'
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
  // Logo du beatmaker (live, pas snapshoté — purement décoratif, contrairement
  // aux mentions légales/montants qui doivent rester figés dans le temps).
  logoUrl: string | null
}

const PAGE_W = 595
const PAGE_H = 842
const MARGIN_X = 55
const MARGIN_TOP = 70
const MARGIN_BOTTOM = 55

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

  // Logo du beatmaker, coin supérieur droit — jamais bloquant : toute
  // erreur (réseau, format inattendu) est avalée, une facture ne doit
  // jamais échouer à se générer pour un élément purement décoratif.
  if (input.logoUrl) {
    try {
      const reponse = await fetch(input.logoUrl)
      if (reponse.ok) {
        const webpBuffer = Buffer.from(await reponse.arrayBuffer())
        // pdf-lib ne sait embarquer que du JPG/PNG, jamais du WEBP (format
        // de stockage des logos, voir app/api/profil/logo/route.ts).
        const pngBuffer = await sharp(webpBuffer).png().toBuffer()
        const image = await doc.embedPng(pngBuffer)
        const tailleMax = 50
        const ratio = Math.min(tailleMax / image.width, tailleMax / image.height, 1)
        const w = image.width * ratio
        const h = image.height * ratio
        page.drawImage(image, { x: PAGE_W - MARGIN_X - w, y: PAGE_H - MARGIN_TOP - h + 20, width: w, height: h })
      }
    } catch (err) {
      console.error('[facture] Erreur intégration logo (ignorée, facture générée sans):', err)
    }
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

  // Tableau des lignes
  const colDesignationX = MARGIN_X
  const colHTX = MARGIN_X + maxWidth - 190
  const colTvaX = MARGIN_X + maxWidth - 110
  const colTTCX = MARGIN_X + maxWidth - 60

  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + maxWidth, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  y -= 14
  page.drawText('Désignation', { x: colDesignationX, y, font: fontBold, size: 8.5, color: rgb(0.45, 0.45, 0.45) })
  page.drawText('HT', { x: colHTX, y, font: fontBold, size: 8.5, color: rgb(0.45, 0.45, 0.45) })
  page.drawText('TVA', { x: colTvaX, y, font: fontBold, size: 8.5, color: rgb(0.45, 0.45, 0.45) })
  page.drawText('TTC', { x: colTTCX, y, font: fontBold, size: 8.5, color: rgb(0.45, 0.45, 0.45) })
  y -= 8
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + maxWidth, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  y -= 16

  let totalHT = 0
  let totalTVA = 0
  for (const ligne of input.lignes) {
    // TVA absorbée (Phase 9) : prixTTC est le prix réellement payé, jamais
    // recalculé à la hausse — le HT est extrait du TTC, jamais l'inverse.
    const ht = ligne.tauxTva > 0 ? ligne.prixTTC / (1 + ligne.tauxTva / 100) : ligne.prixTTC
    const montantTVA = ligne.prixTTC - ht
    totalHT += ht
    totalTVA += montantTVA

    page.drawText(nettoyerTexte(ligne.designation), { x: colDesignationX, y, font: fontRegular, size: 9, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(formaterEuros(ht), { x: colHTX, y, font: fontRegular, size: 9, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(ligne.tauxTva > 0 ? `${ligne.tauxTva}%` : '—', { x: colTvaX, y, font: fontRegular, size: 9, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(formaterEuros(ligne.prixTTC), { x: colTTCX, y, font: fontRegular, size: 9, color: rgb(0.2, 0.2, 0.2) })
    y -= 18
  }

  y -= 6
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + maxWidth, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  y -= 18

  const totalTTC = totalHT + totalTVA
  const totaux: [string, string][] = [
    ['Total HT', formaterEuros(totalHT)],
    ['Total TVA', formaterEuros(totalTVA)],
    ['Total TTC', formaterEuros(totalTTC)],
  ]
  for (const [label, montant] of totaux) {
    const estDernier = label === 'Total TTC'
    page.drawText(label, { x: colTvaX, y, font: estDernier ? fontBold : fontRegular, size: 9.5, color: rgb(0.1, 0.1, 0.1) })
    page.drawText(montant, { x: colTTCX, y, font: estDernier ? fontBold : fontRegular, size: 9.5, color: rgb(0.1, 0.1, 0.1) })
    y -= 16
  }

  // Pied de page fixe, en bas de la 1ère page — pas à la suite du contenu.
  // Réservé à la mention du mandataire (courte, non éditable) et aux textes
  // légaux courts (ex. TVA non applicable) plutôt qu'un long paragraphe
  // dans le corps de la facture — la clarification "qui est partie à la
  // vente" est déjà portée par le contrat de licence (RÔLE DE LA
  // PLATEFORME, lib/licences-textes.ts), pas une mention obligatoire ici.
  let yFooter = MARGIN_BOTTOM
  page.drawText(
    nettoyerTexte(`Facture établie par ${NOM_PLATEFORME} au nom et pour le compte de ${input.vendeur.nom_artiste}.`),
    { x: MARGIN_X, y: yFooter, font: fontRegular, size: 7.5, color: rgb(0.55, 0.55, 0.55) }
  )

  if (totalTVA === 0) {
    yFooter += 12
    page.drawText('TVA non applicable, article 293 B du Code général des impôts.', { x: MARGIN_X, y: yFooter, font: fontRegular, size: 8, color: rgb(0.5, 0.5, 0.5) })
  }

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
    admin.from('beatmakers').select('nom_artiste, slug, raison_sociale, forme_juridique, numero_entreprise, siege_social_adresse, adresse, ville, code_postal, email_contact_public, logo_url').eq('id', commande.beatmaker_id).single(),
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
    logoUrl: beatmaker.logo_url ?? null,
  })
}
