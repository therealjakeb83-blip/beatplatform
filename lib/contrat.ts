import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib'
import { NOM_PLATEFORME } from './constantes'
import type { createAdminClient } from '@/utils/supabase/admin'
import {
  modeleVersTypeLicenceTexte,
  texteTemplateStandard,
  resoudreVariablesLicence,
  blocRolePlateforme,
  type InfosLegalesConcedant,
  type DonneesLicenceContrat,
} from './licences-textes'

interface SplitInfo {
  nom_artiste: string
  pourcentage: number
}

interface ContratData {
  beat: { titre: string; bpm?: number | null; cle?: string | null }
  beatmaker: { nom_artiste: string }
  acheteur: { nom: string | null; email: string | null }
  licence: { nom: string }
  splits: SplitInfo[]
  dateVente: Date
}

// Entrée complète pour une vente de licence "standard" (MP3/WAV/STEMS) —
// tout ce dont resoudreVariablesLicence() a besoin, plus les infos
// nécessaires pour décider quel rendu utiliser (modele) et retomber sur
// l'ancien rendu simple pour illimité/exclusive (pas encore rédigés,
// voir lib/licences-textes.ts).
export interface ContratLicenceInput {
  beat: { titre: string; bpm?: number | null; cle?: string | null }
  beatmaker: {
    nom_artiste: string
    slug: string
  } & InfosLegalesConcedant
  acheteur: { nom: string | null; email: string | null; adresse: string | null }
  licence: {
    nom: string
    modele: string
    inclut_mp3: boolean | null
    inclut_wav: boolean | null
    inclut_stems: boolean | null
    streams_limite: number | null
    ventes_physiques_limite: number | null
    vues_video_limite: number | null
    clips_video_limite: number | null
    radio_tv_limite: number | null
    lives_performances_autorise: boolean | null
  }
  // Collaborateurs réels du beat (hors le beatmaker vendeur lui-même,
  // hors l'acheteur) — sert au bloc collaborateurs conditionnel de
  // l'article préliminaire, pas à un calcul de répartition (la répartition
  // 50/50 est désormais un principe fixe rédigé dans le texte, article 6,
  // plus une liste de pourcentages par personne comme avant).
  splits: SplitInfo[]
  prixPaye: number // euros décimaux, déjà net de remise, pour cette ligne
  // Texte déjà sauvegardé par le beatmaker pour cette catégorie de licence
  // (licences_textes.contenu), ou null pour utiliser le modèle par défaut.
  texteEditable: string | null
  dateVente: Date
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current)
      current = word
    } else {
      current = current ? current + ' ' + word : word
    }
  }
  if (current) lines.push(current)
  return lines
}

// ============================================================
// Rendu simple (fallback illimité/exclusive — pas encore rédigés)
// ============================================================
async function genererContratPdfSimple(data: ContratData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)

  const margin = 60
  const lh = 16
  let y = height - 55

  const draw = (text: string, opts: { bold?: boolean; size?: number; color?: [number, number, number]; indent?: number }) => {
    const { bold = false, size = 10, color = [0.25, 0.25, 0.25], indent = 0 } = opts
    page.drawText(text, {
      x: margin + indent,
      y,
      font: bold ? fontBold : fontRegular,
      size,
      color: rgb(...(color as [number, number, number])),
    })
    y -= lh
  }

  const sep = () => {
    y -= 4
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    })
    y -= 10
  }

  draw('MY PRODUCER', { bold: true, size: 9, color: [0.35, 0.35, 0.75] })
  y -= 4
  draw('CONTRAT DE LICENCE NON-EXCLUSIVE', { bold: true, size: 16, color: [0.1, 0.1, 0.1] })
  y -= 6
  const dateStr = data.dateVente.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
  draw(`Date : ${dateStr}`, { size: 9, color: [0.5, 0.5, 0.5] })
  y -= 4
  sep()

  draw('BEAT', { bold: true, size: 11, color: [0.15, 0.15, 0.15] })
  y -= 2
  draw(`Titre : ${data.beat.titre}`, {})
  if (data.beat.bpm) draw(`BPM : ${data.beat.bpm}`, {})
  if (data.beat.cle) draw(`Tonalité : ${data.beat.cle}`, {})
  sep()

  draw('VENDEUR (BEATMAKER)', { bold: true, size: 11, color: [0.15, 0.15, 0.15] })
  y -= 2
  draw(`Nom artistique : ${data.beatmaker.nom_artiste}`, {})
  draw(`Plateforme : ${NOM_PLATEFORME}`, {})
  sep()

  draw('ACHETEUR', { bold: true, size: 11, color: [0.15, 0.15, 0.15] })
  y -= 2
  if (data.acheteur.nom) draw(`Nom : ${data.acheteur.nom}`, {})
  if (data.acheteur.email) draw(`Email : ${data.acheteur.email}`, {})
  sep()

  draw('LICENCE ACCORDÉE', { bold: true, size: 11, color: [0.15, 0.15, 0.15] })
  y -= 2
  draw(`Type : ${data.licence.nom}`, {})
  sep()

  draw('RÉPARTITION DES DROITS DE COMPOSITION (PUBLISHING)', { bold: true, size: 11, color: [0.15, 0.15, 0.15] })
  y -= 2
  const nbProducers = data.splits.length || 1
  const partProduceur = Math.round((50 / nbProducers) * 100) / 100
  for (const s of data.splits) {
    draw(`${s.nom_artiste} (compositeur) : ${partProduceur}%`, {})
  }
  draw(`${data.acheteur.nom || 'Acheteur'} (interprète) : 50%`, {})
  sep()

  draw('CONDITIONS DE LA LICENCE', { bold: true, size: 11, color: [0.15, 0.15, 0.15] })
  y -= 2
  const clauses = [
    '1. Cette licence est non-exclusive. Le beatmaker conserve tous les droits de propriété intellectuelle sur le beat.',
    '2. L\'acheteur est autorisé à utiliser ce beat dans les limites définies par le type de licence accordé.',
    '3. Toute modification de ce beat est soumise à l\'accord préalable écrit de tous les compositeurs listés.',
    '4. Cette licence n\'est pas transférable à un tiers sans accord écrit du beatmaker.',
    '5. En cas de litige, les parties s\'engagent à rechercher une solution amiable avant toute procédure judiciaire.',
  ]
  for (const clause of clauses) {
    const lines = wrapText(clause, 85)
    for (let i = 0; i < lines.length; i++) {
      draw(lines[i], { indent: i > 0 ? 12 : 0 })
    }
    y -= 4
  }
  sep()

  draw('SIGNATURES', { bold: true, size: 11, color: [0.15, 0.15, 0.15] })
  y -= 16
  page.drawText('Beatmaker : _______________________________', { x: margin, y, font: fontRegular, size: 10, color: rgb(0.3, 0.3, 0.3) })
  page.drawText('Acheteur : _______________________________', { x: width / 2, y, font: fontRegular, size: 10, color: rgb(0.3, 0.3, 0.3) })
  y -= 20
  page.drawText(data.beatmaker.nom_artiste, { x: margin, y, font: fontRegular, size: 9, color: rgb(0.5, 0.5, 0.5) })
  if (data.acheteur.nom) page.drawText(data.acheteur.nom, { x: width / 2, y, font: fontRegular, size: 9, color: rgb(0.5, 0.5, 0.5) })

  return doc.save()
}

// ============================================================
// Rendu multi-pages du texte de licence complet (standard MP3/WAV/STEMS)
// ============================================================

// Marqueur reconnu par renderPdfMultiPage pour forcer une nouvelle page —
// utilisé uniquement entre le texte éditable et le bloc plateforme, pour
// bien les séparer visuellement (jamais dans le texte éditable lui-même).
const MARQUEUR_SAUT_DE_PAGE = '__SAUT_DE_PAGE__'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN_X = 55
const MARGIN_TOP = 70
const MARGIN_BOTTOM = 55

type LigneType = 'blank' | 'article' | 'sous_article' | 'texte'

function classifierLigne(ligneBrute: string): { type: LigneType; texte: string } {
  const ligne = ligneBrute.trim()
  if (!ligne) return { type: 'blank', texte: '' }
  // Article principal : "1. PRÉAMBULE", "13. DISPOSITIONS GÉNÉRALES"
  if (/^\d+\.\s+[A-ZÀ-Ý0-9''’(),/\s-]+$/.test(ligne) && ligne === ligne.toUpperCase()) {
    return { type: 'article', texte: ligne }
  }
  // Sous-article : "4.1. Nature de la Licence", "13.5. Licences accordées..."
  if (/^\d+\.\d+\.?\s+\S/.test(ligne)) {
    return { type: 'sous_article', texte: ligne }
  }
  return { type: 'texte', texte: ligne }
}

// Découpe un texte en lignes qui tiennent dans maxWidth, en respectant la
// largeur réelle des caractères (pdf-lib) plutôt qu'un simple compte de
// caractères — plus fiable pour un texte aussi long.
function wrapParPixels(texte: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const mots = texte.split(' ')
  const lignes: string[] = []
  let courante = ''
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot
    if (font.widthOfTextAtSize(essai, size) > maxWidth && courante) {
      lignes.push(courante)
      courante = mot
    } else {
      courante = essai
    }
  }
  if (courante) lignes.push(courante)
  return lignes
}

// Rend un texte de contrat déjà entièrement résolu (variables + bloc
// plateforme inclus) en PDF A4 multi-pages, avec en-tête/pied de page
// répétés et mise en forme simple des titres d'article détectés par ligne.
async function renderPdfMultiPage(texteBrut: string, meta: { titre: string; sousTitre: string }): Promise<Uint8Array> {
  // La police standard (WinAnsi) ne sait pas encoder l'espace insécable fine
  // (U+202F, utilisée par toLocaleString('fr-FR') pour les séparateurs de
  // milliers) ni l'espace insécable classique (U+00A0) — sans ce nettoyage,
  // pdf-lib lève une exception et bloque toute génération de contrat dès
  // qu'un nombre à 4 chiffres ou plus apparaît dans le texte.
  const texteComplet = texteBrut.replace(/[  ]/g, ' ')

  const doc = await PDFDocument.create()
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const maxWidth = PAGE_W - 2 * MARGIN_X
  const sizeTexte = 9.5
  const lhTexte = 13.5
  const sizeArticle = 11.5
  const lhArticle = 20
  const sizeSousArticle = 9.5
  const lhSousArticle = 16

  let page: PDFPage
  let y = 0
  const pages: PDFPage[] = []

  const nouvellePage = () => {
    page = doc.addPage([PAGE_W, PAGE_H])
    pages.push(page)
    y = PAGE_H - MARGIN_TOP
    const largeurTitre = fontBold.widthOfTextAtSize(meta.titre, 8)
    page.drawText(meta.titre, { x: MARGIN_X, y: PAGE_H - 40, font: fontBold, size: 8, color: rgb(0.4, 0.4, 0.75) })
    page.drawText(meta.sousTitre, { x: MARGIN_X + largeurTitre, y: PAGE_H - 40, font: fontRegular, size: 8, color: rgb(0.55, 0.55, 0.55) })
  }
  nouvellePage()

  const assurerEspace = (hauteur: number) => {
    if (y - hauteur < MARGIN_BOTTOM) nouvellePage()
  }

  for (const ligneBrute of texteComplet.split('\n')) {
    if (ligneBrute.trim() === MARQUEUR_SAUT_DE_PAGE) {
      nouvellePage()
      continue
    }

    const { type, texte } = classifierLigne(ligneBrute)

    if (type === 'blank') {
      y -= lhTexte * 0.5
      continue
    }

    if (type === 'article') {
      assurerEspace(lhArticle * 1.5)
      y -= 6
      page!.drawText(texte, { x: MARGIN_X, y, font: fontBold, size: sizeArticle, color: rgb(0.1, 0.1, 0.1) })
      y -= lhArticle
      continue
    }

    if (type === 'sous_article') {
      assurerEspace(lhSousArticle * 1.5)
      page!.drawText(texte, { x: MARGIN_X, y, font: fontBold, size: sizeSousArticle, color: rgb(0.15, 0.15, 0.15) })
      y -= lhSousArticle
      continue
    }

    // Paragraphe normal — puce = léger retrait pour toutes les lignes de
    // continuation, pour un rendu "hanging indent" lisible.
    const estPuce = texte.startsWith('•')
    const indent = estPuce ? 12 : 0
    const lignes = wrapParPixels(texte, fontRegular, sizeTexte, maxWidth - indent)
    for (const l of lignes) {
      assurerEspace(lhTexte)
      page!.drawText(l, { x: MARGIN_X + indent, y, font: fontRegular, size: sizeTexte, color: rgb(0.2, 0.2, 0.2) })
      y -= lhTexte
    }
  }

  for (const [i, p] of pages.entries()) {
    p.drawText(`Page ${i + 1}/${pages.length}`, {
      x: PAGE_W - MARGIN_X - 45,
      y: MARGIN_BOTTOM - 25,
      font: fontRegular,
      size: 8,
      color: rgb(0.55, 0.55, 0.55),
    })
  }

  return doc.save()
}

function formaterEuros(montant: number): string {
  return `${montant.toFixed(2).replace('.', ',')} €`
}

function composerFichiersLivres(licence: ContratLicenceInput['licence']): string {
  const fichiers: string[] = []
  if (licence.inclut_mp3) fichiers.push('1 fichier MP3')
  if (licence.inclut_wav) fichiers.push('1 fichier WAV')
  if (licence.inclut_stems) fichiers.push('1 fichier ZIP (stems)')
  return fichiers.join(', ') || '1 fichier MP3'
}

async function genererContratLicenceStandardPdf(input: ContratLicenceInput): Promise<Uint8Array> {
  const collaborateurs = input.splits
    .filter(s => s.nom_artiste !== input.beatmaker.nom_artiste)
    .map(s => ({ nom: s.nom_artiste }))

  const donnees: DonneesLicenceContrat = {
    typeLicenceLabel: input.licence.nom,
    boutique: input.beatmaker.slug,
    titreBeat: input.beat.titre,
    prixPaye: formaterEuros(input.prixPaye),
    fichiersLivres: composerFichiersLivres(input.licence),
    concedant: input.beatmaker,
    licencieNom: input.acheteur.nom,
    licencieAdresse: input.acheteur.adresse,
    collaborateurs,
    limiteStreams: input.licence.streams_limite,
    limiteVentesPhysiques: input.licence.ventes_physiques_limite,
    limiteVuesVideo: input.licence.vues_video_limite,
    limiteClipsVideo: input.licence.clips_video_limite,
    limiteRadioTv: input.licence.radio_tv_limite,
    performancesAutorisees: input.licence.lives_performances_autorise ?? false,
    dateAchat: input.dateVente.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }),
  }

  const texteBase = input.texteEditable ?? texteTemplateStandard()
  const texteResolu = resoudreVariablesLicence(texteBase, donnees)
  const texteFinal = `${texteResolu}\n\n${MARQUEUR_SAUT_DE_PAGE}\n\n${blocRolePlateforme()}`

  return renderPdfMultiPage(texteFinal, {
    titre: NOM_PLATEFORME,
    sousTitre: ` — Licence ${input.licence.nom} — ${input.beat.titre}`,
  })
}

// ============================================================
// Point d'entrée public — bascule entre le rendu riche (standard) et le
// rendu simple existant (illimité/exclusive, textes pas encore rédigés).
// ============================================================
export async function genererContratPdf(input: ContratLicenceInput): Promise<Uint8Array> {
  const typeTexte = modeleVersTypeLicenceTexte(input.licence.modele)
  if (typeTexte !== 'standard') {
    return genererContratPdfSimple({
      beat: input.beat,
      beatmaker: { nom_artiste: input.beatmaker.nom_artiste },
      acheteur: { nom: input.acheteur.nom, email: input.acheteur.email },
      licence: { nom: input.licence.nom },
      splits: input.splits,
      dateVente: input.dateVente,
    })
  }
  return genererContratLicenceStandardPdf(input)
}

// ============================================================
// Assemblage depuis la base — regroupe les 3 points d'appel (vente
// réelle, reprise de livraison, page de téléchargement) qui devaient
// chacun reconstruire cette même donnée à la main. Va chercher le beat, la
// licence (limites en vigueur), le beatmaker (infos légales complètes) et
// le texte éditable sauvegardé pour sa catégorie de licence.
// ============================================================
export async function genererContratPdfPourVente(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    beatId: string
    licenceId: string
    beatmakerId: string
    acheteurNom: string | null
    acheteurEmail: string | null
    acheteurAdresse: string | null
    prixPaye: number
    splits: SplitInfo[]
    dateVente: Date
  }
): Promise<Uint8Array> {
  const [{ data: beat }, { data: licence }, { data: beatmaker }] = await Promise.all([
    admin.from('beats').select('titre, bpm, cle').eq('id', params.beatId).single(),
    admin.from('licences').select('nom, modele, inclut_mp3, inclut_wav, inclut_stems, streams_limite, ventes_physiques_limite, vues_video_limite, clips_video_limite, radio_tv_limite, lives_performances_autorise').eq('id', params.licenceId).single(),
    admin.from('beatmakers').select('nom_artiste, slug, raison_sociale, forme_juridique, numero_entreprise, siege_social_adresse, adresse, ville, code_postal, email_contact_public').eq('id', params.beatmakerId).single(),
  ])

  if (!beat || !licence || !beatmaker) {
    throw new Error(`Données manquantes pour générer le contrat (beat=${!!beat}, licence=${!!licence}, beatmaker=${!!beatmaker})`)
  }

  const typeTexte = modeleVersTypeLicenceTexte(licence.modele)
  const { data: texteSauvegarde } = await admin
    .from('licences_textes')
    .select('contenu')
    .eq('beatmaker_id', params.beatmakerId)
    .eq('type_licence', typeTexte)
    .maybeSingle()

  return genererContratPdf({
    beat,
    beatmaker,
    acheteur: { nom: params.acheteurNom, email: params.acheteurEmail, adresse: params.acheteurAdresse },
    licence,
    splits: params.splits,
    prixPaye: params.prixPaye,
    texteEditable: texteSauvegarde?.contenu ?? null,
    dateVente: params.dateVente,
  })
}
