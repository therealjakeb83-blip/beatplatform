import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'
import { oublierInfosCompte } from '@/lib/infos-paiement-compte'

// Mon compte → décocher « Se souvenir de mes infos » (chantier préremplissage) :
// infos gardées sur le compte effacées tout de suite. Session obligatoire
// (jamais le cookie d'abonné), JSON seulement, n'agit que sur le compte connecté.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connecte-toi pour modifier ton compte.' }, { status: 401 })
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 415 })
  }
  const ok = await oublierInfosCompte(createAdminClient(), user.id)
  if (!ok) return NextResponse.json({ error: 'L’effacement a échoué, réessaie.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
