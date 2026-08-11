import { createClient } from '@/utils/supabase/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { raison_sociale, numero_entreprise, adresse, ville, code_postal, email_contact_public } = await request.json()

  const { error } = await supabase
    .from('beatmakers')
    .update({ raison_sociale, numero_entreprise, adresse, ville, code_postal, email_contact_public })
    .eq('id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
