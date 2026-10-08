import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { lireStatutNewsletter } from '@/lib/newsletter'

// Statut newsletter du client connecté pour UNE boutique (fenêtre free download)
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !slug) return NextResponse.json({ statut: null })

  const admin = createAdminClient()
  const { data: beatmaker } = await admin.from('beatmakers').select('id').eq('slug', slug).maybeSingle()
  if (!beatmaker) return NextResponse.json({ statut: null })

  return NextResponse.json({ statut: await lireStatutNewsletter(admin, user.id, beatmaker.id) })
}
