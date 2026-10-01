import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import LitigesClient from './_components/LitigesClient'

// Rang 9 ROADMAP — historique daté des litiges Stripe, décidé avec Jake le
// 2026-08-31. Table `litiges` alimentée par lib/litiges.ts (une ligne par
// part contestée, au nom du vendeur dont le compte porte le litige) ; la
// réponse se fait depuis la fiche commande (Phase 13, lot 4b).
export type LitigeRow = {
  id: string
  commande_id: string
  montant: number
  statut: 'en_cours' | 'gagne' | 'perdu'
  ouvert_le: string
  ferme_le: string | null
}

export default async function LitigesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  const { data: rawLitiges } = await admin
    .from('litiges')
    .select('id, commande_id, montant, statut, ouvert_le, ferme_le')
    .eq('beatmaker_id', user.id)
    .order('ouvert_le', { ascending: false })

  return <LitigesClient litiges={(rawLitiges ?? []) as LitigeRow[]} />
}
