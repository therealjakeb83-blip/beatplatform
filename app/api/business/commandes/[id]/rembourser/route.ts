import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commandeId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()

  const { data: commande } = await admin
    .from('commandes')
    .select('id, statut, beatmaker_id')
    .eq('id', commandeId)
    .eq('beatmaker_id', user.id)
    .single()

  if (!commande) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
  if (commande.statut !== 'payee') {
    return NextResponse.json({ error: 'Seules les commandes payées peuvent être remboursées' }, { status: 400 })
  }

  const { error } = await admin
    .from('commandes')
    .update({ statut: 'remboursee' })
    .eq('id', commandeId)
    .eq('beatmaker_id', user.id)

  if (error) return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
