import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { clientsLiesABoutique } from '@/app/dashboard/business/_lib/appartenance'

// POST /api/business/listes
// Body: { nom: string; description?: string; client_ids: string[] }
// Crée une liste et y ajoute les contacts
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const { nom, description, client_ids } = await request.json() as {
    nom: string
    description?: string
    client_ids: string[]
  }

  if (!nom?.trim()) return NextResponse.json({ erreur: 'Nom requis' }, { status: 400 })
  if (!Array.isArray(client_ids) || client_ids.length === 0)
    return NextResponse.json({ erreur: 'Aucun contact sélectionné' }, { status: 400 })

  // Confidentialité entre boutiques (9d lot 0) : uniquement des clients liés à cette boutique
  const lies = await clientsLiesABoutique(supabase, user.id, client_ids)
  if (client_ids.some(id => !lies.has(id)))
    return NextResponse.json({ erreur: 'Contact introuvable' }, { status: 404 })

  const { data: liste, error } = await supabase
    .from('listes_crm')
    .insert({ beatmaker_id: user.id, nom: nom.trim(), description: description?.trim() || null })
    .select('id')
    .single()

  if (error || !liste) return NextResponse.json({ erreur: error?.message ?? 'Erreur création' }, { status: 500 })

  const { error: errContacts } = await supabase
    .from('listes_crm_contacts')
    .upsert(
      client_ids.map(client_id => ({ liste_id: liste.id, client_id })),
      { onConflict: 'liste_id,client_id', ignoreDuplicates: true }
    )

  if (errContacts) return NextResponse.json({ erreur: errContacts.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: liste.id })
}
