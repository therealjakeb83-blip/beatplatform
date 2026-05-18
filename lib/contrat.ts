import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

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

export async function genererContratPdf(data: ContratData): Promise<Uint8Array> {
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

  // En-tête
  draw('MY PRODUCER', { bold: true, size: 9, color: [0.35, 0.35, 0.75] })
  y -= 4
  draw('CONTRAT DE LICENCE NON-EXCLUSIVE', { bold: true, size: 16, color: [0.1, 0.1, 0.1] })
  y -= 6
  const dateStr = data.dateVente.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
  draw(`Date : ${dateStr}`, { size: 9, color: [0.5, 0.5, 0.5] })
  y -= 4
  sep()

  // Beat
  draw('BEAT', { bold: true, size: 11, color: [0.15, 0.15, 0.15] })
  y -= 2
  draw(`Titre : ${data.beat.titre}`, {})
  if (data.beat.bpm) draw(`BPM : ${data.beat.bpm}`, {})
  if (data.beat.cle) draw(`Tonalité : ${data.beat.cle}`, {})
  sep()

  // Vendeur
  draw('VENDEUR (BEATMAKER)', { bold: true, size: 11, color: [0.15, 0.15, 0.15] })
  y -= 2
  draw(`Nom artistique : ${data.beatmaker.nom_artiste}`, {})
  draw('Plateforme : My Producer', {})
  sep()

  // Acheteur
  draw('ACHETEUR', { bold: true, size: 11, color: [0.15, 0.15, 0.15] })
  y -= 2
  if (data.acheteur.nom) draw(`Nom : ${data.acheteur.nom}`, {})
  if (data.acheteur.email) draw(`Email : ${data.acheteur.email}`, {})
  sep()

  // Licence
  draw('LICENCE ACCORDÉE', { bold: true, size: 11, color: [0.15, 0.15, 0.15] })
  y -= 2
  draw(`Type : ${data.licence.nom}`, {})
  sep()

  // Droits publishing
  draw('RÉPARTITION DES DROITS DE COMPOSITION (PUBLISHING)', { bold: true, size: 11, color: [0.15, 0.15, 0.15] })
  y -= 2
  const nbProducers = data.splits.length || 1
  const partProduceur = Math.round((50 / nbProducers) * 100) / 100
  for (const s of data.splits) {
    draw(`${s.nom_artiste} (compositeur) : ${partProduceur}%`, {})
  }
  draw(`${data.acheteur.nom || 'Acheteur'} (interprète) : 50%`, {})
  sep()

  // Clauses
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

  // Signatures
  draw('SIGNATURES', { bold: true, size: 11, color: [0.15, 0.15, 0.15] })
  y -= 16
  page.drawText('Beatmaker : _______________________________', { x: margin, y, font: fontRegular, size: 10, color: rgb(0.3, 0.3, 0.3) })
  page.drawText('Acheteur : _______________________________', { x: width / 2, y, font: fontRegular, size: 10, color: rgb(0.3, 0.3, 0.3) })
  y -= 20
  page.drawText(data.beatmaker.nom_artiste, { x: margin, y, font: fontRegular, size: 9, color: rgb(0.5, 0.5, 0.5) })
  if (data.acheteur.nom) page.drawText(data.acheteur.nom, { x: width / 2, y, font: fontRegular, size: 9, color: rgb(0.5, 0.5, 0.5) })

  return doc.save()
}
