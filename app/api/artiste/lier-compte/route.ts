import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { lierCompteClient } from '@/lib/lier-compte-client'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { nom, prenom, newsletter_consent, slug, userId: bodyUserId, userEmail: bodyUserEmail } = body as {
    nom?: string
    prenom?: string
    newsletter_consent?: boolean
    slug?: string
    userId?: string
    userEmail?: string
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let finalUserId: string
  let finalEmail: string
  let finalNom: string | undefined
  let finalPrenom: string | undefined

  if (user?.email) {
    // Flux normal : utilisateur authentifié
    const meta = user.user_metadata as { prenom?: string; nom?: string } | undefined
    finalUserId = user.id
    finalEmail = user.email
    finalNom = nom || meta?.nom
    finalPrenom = prenom || meta?.prenom
  } else if (bodyUserId && bodyUserEmail) {
    // Flux inscription sans session (email non encore confirmé) :
    // on vérifie que l'userId existe réellement dans auth.users avant de procéder
    const admin = createAdminClient()
    const { data: authUser } = await admin.auth.admin.getUserById(bodyUserId)
    if (!authUser.user || authUser.user.email !== bodyUserEmail) {
      return NextResponse.json({ erreur: 'Utilisateur invalide' }, { status: 401 })
    }
    finalUserId = bodyUserId
    finalEmail = bodyUserEmail
    finalNom = nom
    finalPrenom = prenom
  } else {
    return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  }

  await lierCompteClient(finalUserId, finalEmail, finalNom, finalPrenom, newsletter_consent, slug)

  return NextResponse.json({ ok: true })
}
