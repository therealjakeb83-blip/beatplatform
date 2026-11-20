import { lienSigneR2, lireFichierR2, deposerFichierPrive, fichierAppartientAuBeat, estPrive } from './r2'

// Rang 9f, Lot 1 : durée des liens vers les fichiers achetés (page de
// téléchargement, recalculés à chaque affichage).
const DUREE_LIEN_FICHIER = 3600

const FICHIERS_PAR_MODELE: Record<string, Array<'mp3_propre_url' | 'wav_url' | 'stems_url'>> = {
  mp3:      ['mp3_propre_url'],
  wav:      ['mp3_propre_url', 'wav_url'],
  stems:    ['mp3_propre_url', 'wav_url', 'stems_url'],
  illimite: ['mp3_propre_url', 'wav_url', 'stems_url'],
  exclusive:['mp3_propre_url', 'wav_url', 'stems_url'],
}

// Fichiers audio d'une licence : les modèles qui les incluent, leur nom dans
// l'adresse /telechargement/[commande]/fichier/{type}-{ligne} et dans le journal.
export type TypeAudio = 'mp3' | 'wav' | 'stems'
export const CHAMP_AUDIO: Record<TypeAudio, 'mp3_propre_url' | 'wav_url' | 'stems_url'> = {
  mp3: 'mp3_propre_url',
  wav: 'wav_url',
  stems: 'stems_url',
}
export function audioInclus(modele: string, type: TypeAudio): boolean {
  return (FICHIERS_PAR_MODELE[modele] ?? ['mp3_propre_url']).includes(CHAMP_AUDIO[type])
}

export const LABEL: Record<string, string> = {
  mp3_propre_url: 'MP3 (sans tag)',
  wav_url: 'WAV',
  stems_url: 'Stems (ZIP)',
}

export const EXTENSION: Record<string, string> = {
  mp3_propre_url: 'mp3',
  wav_url: 'wav',
  stems_url: 'zip',
}

export async function genererUrlsSignees(
  beat: { id?: string; beatmaker_id?: string; titre?: string; mp3_propre_url?: string | null; wav_url?: string | null; stems_url?: string | null },
  modele: string
): Promise<{ label: string; url: string; fichier: string }[]> {
  const champs = FICHIERS_PAR_MODELE[modele] ?? ['mp3_propre_url']
  const urls: { label: string; url: string; fichier: string }[] = []
  const titre = beat.titre ?? 'beat'

  for (const champ of champs) {
    const fileUrl = beat[champ]
    if (!fileUrl) continue
    if (estPrive(fileUrl) && !(beat.id && beat.beatmaker_id && fichierAppartientAuBeat(fileUrl, { id: beat.id, beatmaker_id: beat.beatmaker_id }))) continue

    const ext = EXTENSION[champ] ?? 'bin'
    const filename = `${titre}.${ext}`
    const signed = await lienSigneR2(fileUrl, { secondes: DUREE_LIEN_FICHIER, nomFichier: filename })
    urls.push({ label: LABEL[champ] ?? champ, url: signed, fichier: filename })
  }

  return urls
}

export function uploadPdfContrat(commandeId: string, pdfBytes: Uint8Array): Promise<string> {
  return deposerFichierPrive(`commandes/${commandeId}/contrat.pdf`, Buffer.from(pdfBytes), 'application/pdf')
}

export function uploadPdfFacture(commandeId: string, pdfBytes: Uint8Array): Promise<string> {
  return deposerFichierPrive(`commandes/${commandeId}/facture.pdf`, Buffer.from(pdfBytes), 'application/pdf')
}

// Facture d'un vendeur pour sa tranche (Phase 13, lot 3) — une par vendeur,
// rangée à côté de la commande.
export function uploadPdfFactureTranche(commandeId: string, trancheId: string, pdfBytes: Uint8Array): Promise<string> {
  return deposerFichierPrive(`commandes/${commandeId}/facture-${trancheId}.pdf`, Buffer.from(pdfBytes), 'application/pdf')
}

// Facture d'avoir (Phase 13, lot 4) — une par remboursement d'un vendeur,
// rangée à côté des factures de la commande.
export function uploadPdfAvoir(commandeId: string, avoirId: string, pdfBytes: Uint8Array): Promise<string> {
  return deposerFichierPrive(`commandes/${commandeId}/avoir-${avoirId}.pdf`, Buffer.from(pdfBytes), 'application/pdf')
}

// Lien court vers un PDF (contrat, facture, avoir) : ouvert dans le navigateur
// par défaut, téléchargé sous `filename` si demandé.
export function genererUrlSigneePdf(pdfUrl: string, filename = 'contrat.pdf', telecharger = true): Promise<string> {
  return lienSigneR2(pdfUrl, { secondes: 300, contentType: 'application/pdf', ...(telecharger ? { nomFichier: filename } : {}) })
}

// Contenu d'un PDF stocké sur R2 (contrat, facture) — joint comme preuve à
// la réponse d'un litige (Phase 13, lot 4b).
export function lirePdfR2(pdfUrl: string): Promise<Buffer> {
  return lireFichierR2(pdfUrl)
}
