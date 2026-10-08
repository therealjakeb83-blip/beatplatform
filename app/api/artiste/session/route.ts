import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// L'utilisateur connecté est-il un artiste (fiche clients) ? Lu côté serveur :
// le navigateur n'a pas le droit de lire la table clients directement.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ artiste: false })
  const { data } = await createAdminClient().from('clients').select('id').eq('id', user.id).maybeSingle()
  return NextResponse.json({ artiste: !!data })
}
