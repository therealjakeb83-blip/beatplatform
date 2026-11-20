import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  lireJetonFreeDownload, urlFichierFreeDownload, resoudreClientFreeDownload, enregistrerFreeDownload,
} from '@/lib/free-download'
import { beatVisible, estAbonneBoutique } from '@/lib/ecoute'

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
    .select('id, beatmaker_id, titre, mp3_tague_url, free_download_actif, statut, supprime_le, date_sortie, hors_vente_collab, beatmakers(slug)')
    .eq('id', d.beatId)
    .eq('beatmaker_id', d.beatmakerId)
    .maybeSingle()
  // Rang 9f, Lot 1 : le beat doit toujours être visible pour ce visiteur
  // (ni retiré, ni vendu, ni passé en privé pour un non-abonné).
  const slugBoutique = (beat?.beatmakers as unknown as { slug: string } | null)?.slug ?? ''
  const visible = !!beat && beatVisible(beat, beat.statut === 'prive' && !!slugBoutique && await estAbonneBoutique(beat.beatmaker_id, slugBoutique))
  if (!beat?.free_download_actif || !beat.mp3_tague_url || !visible) {
    return NextResponse.json({ error: "Ce beat n'est plus disponible en téléchargement gratuit." }, { status: 403 })
  }

  const clientId = await resoudreClientFreeDownload(admin, d.email)
  await enregistrerFreeDownload(admin, {
    clientId, beatmakerId: d.beatmakerId, beatId: d.beatId, newsletterConsent: true, depuis: d.emisLe, formulaire: d,
  })

  const downloadUrl = await urlFichierFreeDownload({ id: beat.id, beatmaker_id: beat.beatmaker_id, titre: beat.titre, mp3_tague_url: beat.mp3_tague_url })
  if (!downloadUrl) return NextResponse.json({ error: "Ce beat n'est plus disponible en téléchargement gratuit." }, { status: 403 })
  return NextResponse.json({ downloadUrl, beatTitre: beat.titre })
}
