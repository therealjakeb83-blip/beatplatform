import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { debloquerCollaborationsRefusees } from '@/lib/collaboration'

// "Publier quand même" depuis la liste des beats (Phase 12, lot 3, retour de
// Jake 2026-09-28) : débloque en un clic un beat resté hors vente à cause
// d'une collaboration refusée, sans ouvrir la fiche du beat. Même effet que
// ré-enregistrer la fiche (app/api/beats/[id]/modifier), voir
// lib/collaboration.ts::debloquerCollaborationsRefusees pour le détail.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()
  const { data: beat } = await admin.from('beats').select('id').eq('id', id).eq('beatmaker_id', user.id).maybeSingle()
  if (!beat) return Response.json({ error: 'Beat introuvable.' }, { status: 404 })

  await debloquerCollaborationsRefusees(admin, { beatId: id, acteurId: user.id })

  revalidatePath('/dashboard/business/beats')
  return Response.json({ success: true })
}
