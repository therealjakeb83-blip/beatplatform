import { createClient } from '@/utils/supabase/server'
import { lierCompteClient } from '@/lib/lier-compte-client'
import { NextResponse } from 'next/server'
import { siteDeLaRequete } from '@/lib/boutique-du-domaine'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { newsletter_consent, slug } = body as { newsletter_consent?: boolean; slug?: string }

  // Connecté seulement (9d lot 3, faille 9) : l'ancien chemin « sans session »
  // (identifiant + email dans la requête, connus d'un beatmaker pour chacun de
  // ses contacts) permettait de rendre n'importe qui contact d'une autre
  // boutique et de l'inscrire à sa newsletter. Plus aucune page ne l'utilisait.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const meta = user.user_metadata as { prenom?: string; nom?: string } | undefined
  const finalUserId = user.id
  const finalEmail = user.email
  const finalNom = meta?.nom
  const finalPrenom = meta?.prenom

  // Sur le domaine d'une boutique, c'est elle, quoi qu'envoie la page.
  const site = await siteDeLaRequete(request)
  const slugFinal = site.surDomaine ? site.slugDomaine : slug

  await lierCompteClient(finalUserId, finalEmail, finalNom, finalPrenom, newsletter_consent, slugFinal)

  return NextResponse.json({ ok: true })
}
