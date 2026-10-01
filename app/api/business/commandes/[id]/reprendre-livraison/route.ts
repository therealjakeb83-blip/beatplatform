import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { completerCommande } from '@/lib/completion-commande'

export const runtime = 'nodejs'

// Bouton « Réessayer » de la fiche commande : même réparation que la tâche
// de nuit (lib/completion-commande.ts), lancée tout de suite. Ne refait que
// ce qui manque, jamais de nouveau numéro de facture, jamais d'argent.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commandeId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()
  const { data: commande } = await admin
    .from('commandes')
    .select('id')
    .eq('id', commandeId)
    .eq('beatmaker_id', user.id)
    .single()
  if (!commande) return NextResponse.json({ erreur: 'Commande introuvable' }, { status: 404 })

  const resultat = await completerCommande(commandeId)
  return NextResponse.json(resultat)
}
