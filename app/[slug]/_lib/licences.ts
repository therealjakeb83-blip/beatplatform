export const FICHIERS_INCLUS: Record<string, string[]> = {
  mp3:       ['MP3'],
  wav:       ['MP3', 'WAV'],
  stems:     ['MP3', 'WAV', 'Stems'],
  illimite:  ['MP3', 'WAV', 'Stems'],
  exclusive: ['MP3', 'WAV', 'Stems'],
}

export function formatStreams(n: number | null) {
  if (n === null) return 'Illimité'
  if (n >= 1_000_000) return `${n / 1_000_000}M`
  if (n >= 1_000) return `${n / 1_000}k`
  return String(n)
}
