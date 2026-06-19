import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/business/listes/[id]/contacts
// Body: { client_ids: string[] }
// Ajoute des contacts à une liste existante (idempotent)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const { client_ids } = await request.json() as { client_ids: string[] }
  if (!Array.isArray(client_ids) || client_ids.length === 0)
    return NextResponse.json({ erreur: 'Aucun contact sélectionné' }, { status: 400 })

  // Vérifier que la liste appartient bien à ce beatmaker (RLS le fait aussi, mais on veut un 404 propre)
  const { data: liste } = await supabase
    .from('listes_crm')
    .select('id')
    .eq('id', listeId)
    .eq('beatmaker_id', user.id)
    .single()

  if (!liste) return NextResponse.json({ erreur: 'Liste introuvable' }, { status: 404 })

  const { error } = await supabase
    .from('listes_crm_contacts')
    .upsert(
      client_ids.map(client_id => ({ liste_id: listeId, client_id })),
      { onConflict: 'liste_id,client_id', ignoreDuplicates: true }
    )

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
