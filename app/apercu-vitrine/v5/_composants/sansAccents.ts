// Aperçu seulement : la version d'essai de Surgena n'a pas d'accents. Pour juger la
// police sans lettres de secours, les textes en Surgena perdent leurs accents (é → e).
// À RETIRER le jour où la licence complète est achetée.
export function sansAccents(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/Œ/g, 'OE')
}
