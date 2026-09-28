import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { estAdmin } from '@/lib/admin'
import { rafraichirPretAVendre } from '@/lib/pret-a-vendre-suivi'

// Recalcul ponctuel du statut « prêt à vendre » de tous les beatmakers
// (Phase 12 lot 4) — à ouvrir une fois après la migration
// phase12_lot4_pret_a_vendre_stocke.sql, puis en secours si besoin.
// Aucun email n'en part au premier passage : les colonnes valent false
// au départ, seul un passage prêt → pas prêt notifie.
export async function GET() {
  if (!(await estAdmin())) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 403 })

  const admin = createAdminClient()
  const { data: beatmakers, error } = await admin.from('beatmakers').select('id')
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })

  for (const bm of (beatmakers ?? []) as { id: string }[]) {
    await rafraichirPretAVendre(bm.id)
  }

  const { data: resultat } = await admin
    .from('beatmakers')
    .select('slug, pret_a_vendre_concedant, pret_a_vendre_collaborateur')
    .order('slug')
  return NextResponse.json({ recalcules: beatmakers?.length ?? 0, resultat })
}
