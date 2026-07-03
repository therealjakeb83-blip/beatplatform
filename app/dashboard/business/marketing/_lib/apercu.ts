import { createAdminClient } from '@/utils/supabase/admin'
import { rendreEmailHtml, type BlocEmail, type BrandingBoutique } from '@/lib/email-blocs'

// Rendu HTML d'aperçu — mêmes blocs et même moteur de rendu que l'envoi réel
// (lib/mailing.ts), tokens laissés en placeholders (pas de destinataire réel ici).
export async function construireApercu(beatmakerId: string, blocs: BlocEmail[]): Promise<string> {
  const admin = createAdminClient()
  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('nom_artiste, slug, logo_url, instagram_url')
    .eq('id', beatmakerId)
    .single()

  const branding: BrandingBoutique = beatmaker ?? {
    nom_artiste: 'Ta boutique',
    slug: '',
    logo_url: null,
    instagram_url: null,
  }

  return rendreEmailHtml(blocs, beatmakerId, branding)
}
