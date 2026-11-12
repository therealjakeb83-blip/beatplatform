import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { hotePropreDeLaBoutique } from '@/lib/boutique-du-domaine'
import { cheminInterne } from '@/lib/redirection'

export const runtime = 'nodejs'

const SLUG_VALIDE = /^[a-z0-9][a-z0-9-]*$/i

// Passage inverse (rang 9c, lot 4, décision 2A du lot 3) : depuis sonoo.app/mon-compte,
// un clic vers une boutique qui a son propre domaine y arrive déjà connecté. Même
// laissez-passer à usage unique que /api/artiste/passage-compte, fabriqué au clic
// seulement, et uniquement vers l'adresse propre de CETTE boutique (domaine Actif,
// ou sous-domaine une fois ouverts, rang 9c bis).
export async function POST(request: Request) {
  const formulaire = await request.formData().catch(() => null)
  const slug = String(formulaire?.get('slug') ?? '')
  const chemin = cheminInterne(String(formulaire?.get('chemin') ?? ''), '/')
  if (!SLUG_VALIDE.test(slug)) return NextResponse.redirect(new URL('/mon-compte', request.url), 303)

  const { data: beatmaker } = await createAdminClient().from('beatmakers').select('id').eq('slug', slug).maybeSingle()
  const domaine = beatmaker ? await hotePropreDeLaBoutique(beatmaker.id).catch(() => null) : null
  if (!domaine) {
    return NextResponse.redirect(new URL(`/${slug}${chemin === '/' ? '' : chemin}`, request.url), 303)
  }

  const surDomaine = new URL(chemin, `https://${domaine}`)
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user?.email) return NextResponse.redirect(surDomaine, 303)

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email: user.email })
  if (error || !data?.properties?.hashed_token) {
    console.error('[artiste/passage-boutique] generateLink:', JSON.stringify(error))
    return NextResponse.redirect(surDomaine, 303)
  }

  const destination = new URL('/artiste/passage', `https://${domaine}`)
  destination.searchParams.set('token_hash', data.properties.hashed_token)
  destination.searchParams.set('redirect', chemin)
  return NextResponse.redirect(destination, 303)
}
