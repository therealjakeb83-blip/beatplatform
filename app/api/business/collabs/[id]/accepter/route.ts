import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: { user: fullUser } } = await admin.auth.admin.getUserById(user.id)
  const userEmail = fullUser?.email
  if (!userEmail) return NextResponse.json({ erreur: 'Email introuvable' }, { status: 400 })

  const { data: split } = await admin
    .from('beat_splits')
    .select('id, email_invite, statut')
    .eq('id', id)
    .single()

  if (!split) return NextResponse.json({ erreur: 'Collaboration introuvable' }, { status: 404 })
  if (split.statut !== 'en_attente') return NextResponse.json({ erreur: 'Déjà traité' }, { status: 400 })
  if (split.email_invite?.toLowerCase() !== userEmail.toLowerCase()) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 403 })
  }

  const { error } = await admin
    .from('beat_splits')
    .update({ beatmaker_id: user.id, email_invite: null, statut: 'actif' })
    .eq('id', id)

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
