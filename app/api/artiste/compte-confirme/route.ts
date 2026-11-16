import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { confirmationCompteArtiste } from '@/lib/emails'
import { normaliserEmail } from '@/lib/email'
import { inscrireParClient } from '@/lib/newsletter'
import { beatmakerIdDuSlug, contexteCompteArtiste } from '@/lib/compte-artiste'

export const runtime = 'nodejs'

// Appelé par /artiste/confirmation une fois le compte réellement confirmé :
// email « Bienvenue » au nom de la boutique de départ (aucun sans boutique,
// décision de Jake du 2026-07-17).
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user?.email) return NextResponse.json({ erreur: 'Non connecté' }, { status: 401 })

  // Case newsletter cochée à l'inscription par une adresse désinscrite de la
  // boutique (9d lot 3) : appliquée maintenant que l'adresse est prouvée.
  const enAttente = (user.user_metadata as { newsletter_a_confirmer?: string | null } | undefined)?.newsletter_a_confirmer
  if (enAttente) {
    const admin = createAdminClient()
    await inscrireParClient(admin, { clientId: user.id, beatmakerId: enAttente, origine: 'inscription_compte', sourceLead: 'visite' })
    const { error: erreurMeta } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, newsletter_a_confirmer: null },
    })
    if (erreurMeta) console.error('[artiste/compte-confirme] newsletter à confirmer:', JSON.stringify(erreurMeta))
  }

  const contexte = await contexteCompteArtiste(request, body.redirect)
  const beatmakerId = await beatmakerIdDuSlug(contexte.slug)
  if (!beatmakerId) return NextResponse.json({ ok: true })

  const email = normaliserEmail(user.email)
  const { data: client } = await createAdminClient().from('clients').select('id').eq('email', email).maybeSingle()
  await confirmationCompteArtiste({
    to: email,
    beatmakerId,
    clientId: client?.id ?? null,
    lienCompte: `${contexte.origine}${contexte.redirect}`,
  }).catch(err => console.error('[artiste/compte-confirme] Email de bienvenue:', err))

  return NextResponse.json({ ok: true })
}
