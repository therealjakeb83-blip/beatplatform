import { createClient } from '@/utils/supabase/server'
import { r2, R2_BUCKET } from '@/lib/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const ALLOWED_TYPES: Record<string, string> = {
  mp3_tague: 'audio/mpeg',
  mp3_propre: 'audio/mpeg',
  wav: 'audio/wav',
  stems: 'application/zip',
}

const EXTENSIONS: Record<string, string> = {
  mp3_tague: 'mp3',
  mp3_propre: 'mp3',
  wav: 'wav',
  stems: 'zip',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { beatId, fileType } = await request.json()

  if (!beatId || !fileType || !ALLOWED_TYPES[fileType]) {
    return Response.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const key = `beats/${user.id}/${beatId}/${fileType}.${EXTENSIONS[fileType]}`

  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: ALLOWED_TYPES[fileType],
    }),
    { expiresIn: 3600 }
  )

  const fileUrl = `${process.env.R2_ENDPOINT}/${R2_BUCKET}/${key}`
  return Response.json({ uploadUrl: url, fileUrl })
}
