import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib'
import type { createAdminClient } from '@/utils/supabase/admin'
import {
  modeleVersTypeLicenceTexte,
  texteTemplateStandard,
  texteTemplateIllimite,
  texteTemplateExclusive,
  resoudreVariablesLicence,
  blocRolePlateforme,
  type TypeLicenceTexte,
  type InfosLegalesConcedant,
  type DonneesLicenceContrat,
} from './licences-textes'

interface SplitInfo {
  nom_artiste: string
  pourcentage: number
}

// Entrée complète pour une vente de licence — tout ce dont
// resoudreVariablesLicence() a besoin, plus les infos nécessaires pour
// choisir le bon modèle de texte selon la catégorie (standard/illimité/
// exclusive, voir modeleVersTypeLicenceTexte dans lib/licences-textes.ts).
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
// ============================================================
// Rendu multi-pages du texte de licence complet
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

function templateParDefaut(typeTexte: TypeLicenceTexte): string {
  if (typeTexte === 'illimite') return texteTemplateIllimite()
  if (typeTexte === 'exclusive') return texteTemplateExclusive()
  return texteTemplateStandard()
}

async function genererContratLicenceRichePdf(input: ContratLicenceInput, typeTexte: TypeLicenceTexte): Promise<Uint8Array> {
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

  const texteBase = input.texteEditable ?? templateParDefaut(typeTexte)
  const texteResolu = resoudreVariablesLicence(texteBase, donnees)
  const texteFinal = `${texteResolu}\n\n${MARQUEUR_SAUT_DE_PAGE}\n\n${blocRolePlateforme()}`

  // En-tête du contrat : le nom du beatmaker (le Concédant, vendeur réel),
  // jamais My Producer — le contrat est conclu entre le beatmaker et
  // l'acheteur, My Producer n'étant qu'un prestataire technique (voir le
  // bloc RÔLE DE LA PLATEFORME). Le brander en haut de chaque page
  // suggérerait visuellement le contraire, à l'exact opposé de l'objectif
  // du chantier 9 bis (éviter le statut de fournisseur réputé).
  return renderPdfMultiPage(texteFinal, {
    titre: input.beatmaker.nom_artiste,
    sousTitre: ` — Licence ${input.licence.nom} — ${input.beat.titre}`,
  })
}

// ============================================================
// Point d'entrée public
// ============================================================
export async function genererContratPdf(input: ContratLicenceInput): Promise<Uint8Array> {
  const typeTexte = modeleVersTypeLicenceTexte(input.licence.modele)
  return genererContratLicenceRichePdf(input, typeTexte)
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
