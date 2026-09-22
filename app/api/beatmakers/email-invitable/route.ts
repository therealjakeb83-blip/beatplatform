import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { normaliserEmail } from '@/lib/email'
import { emailBloquePourInvitation } from '@/lib/collaboration-beat'

// Vérification EN DIRECT (à la saisie), avant même l'enregistrement du beat —
// Phase 12, Q5b du grill-me : Jake voulait que le blocage d'une adresse déjà
// utilisée par un compte artiste soit immédiat, pas découvert seulement à
// l'enregistrement. Réutilise la même fonction que celle appelée côté
// serveur au save (lib/collaboration-beat.ts) : une seule source de vérité.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const email = normaliserEmail(searchParams.get('email') ?? '')
  if (!email || !email.includes('@')) return Response.json({ bloque: false })

  const admin = createAdminClient()
  const bloque = await emailBloquePourInvitation(admin, email)
  return Response.json({ bloque })
}
