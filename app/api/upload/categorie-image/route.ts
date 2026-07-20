import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { estAdmin } from '@/lib/admin'
import { r2, R2_BUCKET } from '@/lib/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const categorieId = formData.get('categorieId') as string | null
  if (!file || !categorieId) return Response.json({ error: 'Fichier ou catégorie manquant' }, { status: 400 })

  const admin = createAdminClient()
  const { data: categorie } = await admin
    .from('categories')
    .select('id, source, beatmaker_id, statut')
    .eq('id', categorieId)
    .single()
  if (!categorie) return Response.json({ error: 'Catégorie introuvable' }, { status: 404 })

  const officielle = categorie.source === 'plateforme' || categorie.statut === 'certifiee'
  const estAdminUser = await estAdmin()

  if (!officielle && categorie.beatmaker_id !== user.id) {
    return Response.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const webp = await sharp(buffer).resize(600, 600, { fit: 'cover' }).webp({ quality: 85 }).toBuffer()

  // Image officielle (plateforme/certifiée) éditée par un beatmaker non-admin
  // → override perso pour sa boutique, jamais l'image officielle partagée.
  if (officielle && !estAdminUser) {
    const key = `categories/overrides/${categorieId}/${user.id}.webp`
    await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: webp, ContentType: 'image/webp' }))
    const url = `${process.env.R2_PUBLIC_URL}/${key}`

    const { error } = await admin
      .from('categories_images_boutique')
      .upsert({ categorie_id: categorieId, beatmaker_id: user.id, image_url: url }, { onConflict: 'categorie_id,beatmaker_id' })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ url })
  }

  // Sinon : image officielle (admin) ou catégorie perso non certifiée
  // (propriétaire) — les deux cas mettent à jour categories.image_url.
  const key = officielle
    ? `categories/officielles/${categorieId}.webp`
    : `categories/perso/${user.id}/${categorieId}.webp`

  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: webp, ContentType: 'image/webp' }))
  const url = `${process.env.R2_PUBLIC_URL}/${key}`

  const { error } = await admin.from('categories').update({ image_url: url }).eq('id', categorieId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ url })
}
