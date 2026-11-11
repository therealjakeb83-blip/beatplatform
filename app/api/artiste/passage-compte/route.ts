import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { URL_APP } from '@/lib/constantes'

export const runtime = 'nodejs'

// Laissez-passer (rang 9c, lot 3, décision 11) : depuis le domaine d'une
// boutique, « Accéder à mon compte Sonoo » mène à sonoo.app/mon-compte déjà
// connecté. Chaque site garde sa propre connexion ; ce lien à usage unique,
// fabriqué seulement au clic, ouvre la session du même compte sur sonoo.app.
export async function POST(request: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user?.email) {
    return NextResponse.redirect(new URL('/artiste/connexion?redirect=/mon-compte', request.url), 303)
  }

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email: user.email })
  if (error || !data?.properties?.hashed_token) {
    console.error('[artiste/passage-compte] generateLink:', JSON.stringify(error))
    return NextResponse.redirect(new URL('/mon-compte', URL_APP), 303)
  }

  const destination = new URL('/artiste/passage', URL_APP)
  destination.searchParams.set('token_hash', data.properties.hashed_token)
  return NextResponse.redirect(destination, 303)
}
