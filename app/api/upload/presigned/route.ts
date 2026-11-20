import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { r2, destinationPrivee } from '@/lib/r2'
import { TYPES_FICHIER_BEAT, UUID_BEAT, cleFichierBeat, type TypeFichierBeat } from '@/lib/fichiers-beat'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Rang 9f, Lot 1 : les fichiers audio partent dans l'espace PRIVÉ (aucune
// adresse publique) ; la valeur renvoyée (« prive:… ») est revérifiée par
// les routes de création / modification du beat.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  // Un compte artiste (créé librement depuis une boutique) ne doit jamais
  // pouvoir déposer de fichiers sur le stockage.
  const admin = createAdminClient()
  const { data: beatmaker } = await admin.from('beatmakers').select('id').eq('id', user.id).maybeSingle()
  if (!beatmaker) return Response.json({ error: 'Non autorisé' }, { status: 403 })

  const { beatId, fileType } = await request.json() as { beatId?: string; fileType?: string }

  if (!beatId || !UUID_BEAT.test(beatId) || !fileType || !(fileType in TYPES_FICHIER_BEAT)) {
    return Response.json({ error: 'Paramètres invalides' }, { status: 400 })
  }
  // Beat déjà créé : il doit être à ce vendeur (un nouveau beat n'existe pas encore).
  const { data: existant } = await admin.from('beats').select('beatmaker_id').eq('id', beatId).maybeSingle()
  if (existant && existant.beatmaker_id !== user.id) return Response.json({ error: 'Non autorisé' }, { status: 403 })

  const type = fileType as TypeFichierBeat
  const key = cleFichierBeat(user.id, beatId, type)
  const { bucket, valeurEnBase } = destinationPrivee(key)

  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: TYPES_FICHIER_BEAT[type].contentType,
    }),
    { expiresIn: 3600 }
  )

  return Response.json({ uploadUrl: url, fileUrl: valeurEnBase })
}
