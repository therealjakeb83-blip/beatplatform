// Réduit une image DANS LE NAVIGATEUR avant de l'envoyer à une route API.
// Sur Vercel, un envoi de plus de ~500 Ko suivi d'une petite réponse JSON
// revient illisible (« Unexpected token 'e' … is not valid JSON ») — voir
// mémoire feedback_vercel_gros_envoi_reponse_illisible. La route serveur
// recompresse toujours l'image avec sharp : ceci ne sert qu'à alléger l'envoi.
//
// `cote` = taille finale côté serveur (carré, recadrage « cover ») : on réduit
// pour que le plus petit côté fasse `cote`, sans jamais agrandir.
const POIDS_MAX = 400 * 1024

export class ErreurFormatImage extends Error {}

export async function reduireImage(fichier: File, cote: number): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(fichier)
  } catch {
    // Format que le navigateur ne sait pas lire (HEIC d'iPhone…) : léger, on
    // laisse le serveur décider ; lourd, l'envoi provoquerait la réponse
    // illisible — on explique plutôt quoi faire.
    if (fichier.size <= POIDS_MAX) return fichier
    throw new ErreurFormatImage("Format d'image non pris en charge. Enregistre-la en JPG ou PNG, puis réessaie.")
  }

  const echelle = Math.min(1, cote / Math.min(bitmap.width, bitmap.height))
  const largeur = Math.max(1, Math.round(bitmap.width * echelle))
  const hauteur = Math.max(1, Math.round(bitmap.height * echelle))
  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, largeur, hauteur)
  bitmap.close()

  for (const qualite of [0.9, 0.8, 0.65, 0.5]) {
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/webp', qualite))
    if (blob && (blob.size <= POIDS_MAX || qualite === 0.5)) {
      return new File([blob], fichier.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' })
    }
  }
  return fichier
}
