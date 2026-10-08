import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  lireJetonFreeDownload, urlFichierFreeDownload, resoudreClientFreeDownload, enregistrerFreeDownload,
} from '@/lib/free-download'

export const runtime = 'nodejs'

// Clic sur le lien reçu par email (visiteur non connecté) : l'adresse est
// prouvée, on enregistre maintenant le contact, son inscription newsletter et
// le téléchargement. Appelé en POST depuis la page (jamais au simple
// chargement, que les antivirus de messagerie déclenchent tout seuls).
export async function POST(req: Request) {
  const { t } = await req.json().catch(() => ({})) as { t?: string }
  const lecture = t ? lireJetonFreeDownload(t) : { ok: false as const, raison: 'invalide' as const }
  if (!lecture.ok) {
    return NextResponse.json({
      error: lecture.raison === 'expire'
        ? 'Ce lien a expiré (valable 7 jours). Refais une demande de téléchargement gratuit sur la boutique.'
        : 'Ce lien de téléchargement est invalide.',
    }, { status: 400 })
  }
  const d = lecture.demande

  const admin = createAdminClient()
  const { data: beat } = await admin
    .from('beats')
    .select('id, titre, mp3_tague_url, free_download_actif')
    .eq('id', d.beatId)
    .eq('beatmaker_id', d.beatmakerId)
    .maybeSingle()
  if (!beat?.free_download_actif || !beat.mp3_tague_url) {
    return NextResponse.json({ error: "Ce beat n'est plus disponible en téléchargement gratuit." }, { status: 403 })
  }

  const clientId = await resoudreClientFreeDownload(admin, d)
  await enregistrerFreeDownload(admin, {
    clientId, beatmakerId: d.beatmakerId, beatId: d.beatId, newsletterConsent: true, depuis: d.emisLe,
  })

  const downloadUrl = await urlFichierFreeDownload({ titre: beat.titre, mp3_tague_url: beat.mp3_tague_url })
  return NextResponse.json({ downloadUrl, beatTitre: beat.titre })
}
