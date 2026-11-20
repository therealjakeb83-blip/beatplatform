import { PREFIXE_PRIVE } from './r2'

// Rang 9f, Lot 1 : fichiers audio d'un beat (MP3 tagué, MP3 propre, WAV,
// stems), tous rangés dans l'espace privé sous beats/{vendeur}/{beat}/.
export const TYPES_FICHIER_BEAT = {
  mp3_tague: { colonne: 'mp3_tague_url', contentType: 'audio/mpeg', extension: 'mp3' },
  mp3_propre: { colonne: 'mp3_propre_url', contentType: 'audio/mpeg', extension: 'mp3' },
  wav: { colonne: 'wav_url', contentType: 'audio/wav', extension: 'wav' },
  stems: { colonne: 'stems_url', contentType: 'application/zip', extension: 'zip' },
} as const
export type TypeFichierBeat = keyof typeof TYPES_FICHIER_BEAT

export const UUID_BEAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function cleFichierBeat(vendeurId: string, beatId: string, type: TypeFichierBeat): string {
  return `beats/${vendeurId}/${beatId}/${type}.${TYPES_FICHIER_BEAT[type].extension}`
}

// Le navigateur renvoie l'adresse du fichier qu'il vient d'envoyer : on
// n'accepte QUE celle de ce beat (jamais la clé du fichier d'un autre).
export function valeurFichierBeatValide(valeur: unknown, vendeurId: string, beatId: string, type: TypeFichierBeat): valeur is string {
  if (typeof valeur !== 'string') return false
  const cle = cleFichierBeat(vendeurId, beatId, type)
  return valeur === `${PREFIXE_PRIVE}${cle}` || valeur === `${process.env.R2_PUBLIC_URL}/${cle}`
}
