import { createClient } from '@/utils/supabase/server'
import { r2, R2_BUCKET } from '@/lib/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const beatId = formData.get('beatId') as string | null

  if (!file || !beatId) {
    return Response.json({ error: 'Fichier ou beatId manquant' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const webp = await sharp(buffer).resize(1000, 1000, { fit: 'cover' }).webp({ quality: 85 }).toBuffer()

  const key = `beats/${user.id}/${beatId}/cover.webp`

  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: webp,
    ContentType: 'image/webp',
  }))

  const url = `${process.env.R2_PUBLIC_URL}/${key}`
  return Response.json({ url })
}
