import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { inscrireParClient, lireStatutNewsletter } from '@/lib/newsletter'
import { ecrireFicheBoutique } from '@/lib/fiche-boutique-ecriture'
import { genererJetonNewsletter } from '@/lib/newsletter-confirmation'
import { confirmationNewsletter } from '@/lib/emails'
import { siteDeLaRequete } from '@/lib/boutique-du-domaine'
import { lienBoutique } from '@/lib/domaine-boutique'

export const runtime = 'nodejs'

// Formulaire newsletter d'une boutique. Nouvelle adresse : inscrite d'un clic.
// Adresse DÉSINSCRITE de cette boutique (9d lot 3, faille 10) : rien ne change
// sans le clic sur le lien « Confirme ton inscription » reçu par email —
// sinon n'importe qui pouvait réinscrire quelqu'un en tapant son adresse.
// Même réponse dans tous les cas : le formulaire ne révèle rien.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { slug, email } = body as { slug?: string; email?: string }

  const emailNorm = (email ?? '').toLowerCase().trim()
  if (!slug || !emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return NextResponse.json({ erreur: 'Email invalide.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!beatmaker) {
    return NextResponse.json({ erreur: 'Boutique introuvable.' }, { status: 404 })
  }

  // Fiche commune = identifiant seul (9d lot 3)
  const { data: existing } = await admin
    .from('clients')
    .select('id')
    .eq('email', emailNorm)
    .maybeSingle()

  let clientId: string
  if (existing) {
    clientId = existing.id
  } else {
    clientId = crypto.randomUUID()
    const { error } = await admin.from('clients').insert({ id: clientId, email: emailNorm, nom: '' })
    if (error) {
      const { data: course } = await admin.from('clients').select('id').eq('email', emailNorm).maybeSingle()
      if (!course) {
        console.error('[newsletter-publique] Erreur insert client:', JSON.stringify(error))
        return NextResponse.json({ erreur: 'Inscription impossible pour le moment.' }, { status: 500 })
      }
      clientId = course.id
    }
  }

  if ((await lireStatutNewsletter(admin, clientId, beatmaker.id)) === 'desinscrit') {
    const jeton = genererJetonNewsletter({ beatmakerId: beatmaker.id, email: emailNorm })
    const site = await siteDeLaRequete(request)
    const lien = `${site.origine}${lienBoutique(slug, `/newsletter-confirmee?t=${encodeURIComponent(jeton)}`, site.surDomaine)}`
    await confirmationNewsletter({ to: emailNorm, beatmakerId: beatmaker.id, lien })
      .catch(err => console.error('[newsletter-publique] Email de confirmation:', err))
    return NextResponse.json({ ok: true })
  }

  await ecrireFicheBoutique(admin, { clientId, beatmakerId: beatmaker.id, source: 'newsletter', donnees: { email: emailNorm } })
  await inscrireParClient(admin, { clientId, beatmakerId: beatmaker.id, origine: 'formulaire', sourceLead: 'newsletter' })

  return NextResponse.json({ ok: true })
}
