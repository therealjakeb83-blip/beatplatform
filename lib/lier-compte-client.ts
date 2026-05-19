import { createAdminClient } from '@/utils/supabase/admin'

// Crée la ligne `clients` si absente, puis lie les abonnements et commandes non encore associés.
// Appelé après connexion ou inscription d'un artiste acheteur.
export async function lierCompteClient(
  userId: string,
  email: string,
  nom?: string | null,
  prenom?: string | null,
) {
  const admin = createAdminClient()

  // Créer ou ignorer si la ligne existe déjà
  const { data: existing } = await admin
    .from('clients')
    .select('id')
    .eq('id', userId)
    .single()

  if (!existing) {
    const { error } = await admin.from('clients').insert({
      id: userId,
      email,
      nom: nom ?? email.split('@')[0],
      prenom: prenom ?? '',
    })
    if (error) {
      console.error('[lierCompteClient] Erreur insert clients:', JSON.stringify(error))
      return
    }
  } else if (nom || prenom) {
    await admin.from('clients').update({
      ...(prenom ? { prenom } : {}),
      ...(nom ? { nom } : {}),
    }).eq('id', userId)
  }

  // Lier les abonnements boutique non encore associés à ce client
  await admin
    .from('abonnements_boutique')
    .update({ client_id: userId })
    .eq('acheteur_email', email)
    .is('client_id', null)

  // Lier les commandes non encore associées à ce client
  await admin
    .from('commandes')
    .update({ client_id: userId })
    .eq('acheteur_email', email)
    .is('client_id', null)
}
