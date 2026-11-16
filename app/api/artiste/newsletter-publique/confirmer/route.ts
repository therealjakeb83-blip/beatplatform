import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { inscrireParClient } from '@/lib/newsletter'
import { ecrireFicheBoutique } from '@/lib/fiche-boutique-ecriture'
import { lireJetonNewsletter } from '@/lib/newsletter-confirmation'

export const runtime = 'nodejs'

// Clic sur « Confirmer mon inscription » (9d lot 3) : l'adresse est prouvée,
// la personne redevient inscrite à la newsletter de CETTE boutique.
export async function POST(request: Request) {
  const { t } = await request.json().catch(() => ({})) as { t?: string }
  const lecture = lireJetonNewsletter(t ?? '')
  if (!lecture.ok) {
    return NextResponse.json({
      erreur: lecture.raison === 'expire'
        ? 'Ce lien a expiré. Inscris-toi à nouveau depuis la boutique.'
        : 'Ce lien est invalide.',
    }, { status: 400 })
  }
  const { beatmakerId, email } = lecture.demande

  const admin = createAdminClient()
  const { data: client } = await admin.from('clients').select('id').eq('email', email).maybeSingle()
  if (!client) return NextResponse.json({ erreur: 'Ce lien est invalide.' }, { status: 400 })

  await ecrireFicheBoutique(admin, { clientId: client.id, beatmakerId, source: 'newsletter', donnees: { email } })
  await inscrireParClient(admin, { clientId: client.id, beatmakerId, origine: 'formulaire', sourceLead: 'newsletter' })

  return NextResponse.json({ ok: true })
}
