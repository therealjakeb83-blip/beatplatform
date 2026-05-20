import { createAdminClient } from '@/utils/supabase/admin'

// Crée la ligne `clients` si absente, fusionne le compte invité si existant,
// puis lie les commandes et abonnements orphelins par email.
// Appelé après connexion ou inscription d'un artiste acheteur.
export async function lierCompteClient(
  userId: string,
  email: string,
  nom?: string | null,
  prenom?: string | null,
) {
  const admin = createAdminClient()

  // Chercher si un compte invité (UUID différent) existe avec cet email
  const { data: guestClient } = await admin
    .from('clients')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (guestClient && guestClient.id !== userId) {
    // Fusionner : transférer les commandes et abonnements du compte invité
    await admin.from('commandes')
      .update({ client_id: userId })
      .eq('client_id', guestClient.id)

    await admin.from('abonnements_boutique')
      .update({ client_id: userId })
      .eq('client_id', guestClient.id)

    // Supprimer le compte invité — les leads/favoris/doublons cascadent (vides pour un invité)
    await admin.from('clients').delete().eq('id', guestClient.id)

    // Créer le compte auth avec id = auth.uid()
    const { error } = await admin.from('clients').insert({
      id: userId,
      email,
      nom: nom ?? guestClient.id,
      prenom: prenom ?? null,
    })
    if (error) console.error('[lierCompteClient] Erreur insert post-fusion:', JSON.stringify(error))

  } else if (!guestClient) {
    // Aucun compte existant — création simple
    const { error } = await admin.from('clients').insert({
      id: userId,
      email,
      nom: nom ?? email.split('@')[0],
      prenom: prenom ?? null,
    })
    if (error) console.error('[lierCompteClient] Erreur insert clients:', JSON.stringify(error))

  } else {
    // Compte auth déjà existant — mettre à jour si besoin
    if (nom || prenom) {
      await admin.from('clients').update({
        ...(prenom ? { prenom } : {}),
        ...(nom ? { nom } : {}),
      }).eq('id', userId)
    }
  }

  // Lier les commandes/abonnements orphelins (acheteur_email sans client_id)
  await admin
    .from('abonnements_boutique')
    .update({ client_id: userId })
    .eq('acheteur_email', email)
    .is('client_id', null)

  await admin
    .from('commandes')
    .update({ client_id: userId })
    .eq('acheteur_email', email)
    .is('client_id', null)
}
