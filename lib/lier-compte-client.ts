import { createAdminClient } from '@/utils/supabase/admin'

export async function lierCompteClient(
  userId: string,
  email: string,
  nom?: string | null,
  prenom?: string | null,
  newsletter_consent?: boolean,
  slug?: string | null,
) {
  const admin = createAdminClient()

  const { data: guestClient } = await admin
    .from('clients')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (guestClient && guestClient.id !== userId) {
    await admin.from('commandes')
      .update({ client_id: userId })
      .eq('client_id', guestClient.id)

    await admin.from('abonnements_boutique')
      .update({ client_id: userId })
      .eq('client_id', guestClient.id)

    await admin.from('clients').delete().eq('id', guestClient.id)

    const { error } = await admin.from('clients').insert({
      id: userId,
      email,
      nom: nom ?? guestClient.id,
      prenom: prenom ?? null,
      ...(newsletter_consent !== undefined ? { newsletter_consent } : {}),
    })
    if (error) console.error('[lierCompteClient] Erreur insert post-fusion:', JSON.stringify(error))

  } else if (!guestClient) {
    const { error } = await admin.from('clients').insert({
      id: userId,
      email,
      nom: nom ?? email.split('@')[0],
      prenom: prenom ?? null,
      ...(newsletter_consent !== undefined ? { newsletter_consent } : {}),
    })
    if (error) console.error('[lierCompteClient] Erreur insert clients:', JSON.stringify(error))

  } else {
    const updates: Record<string, unknown> = {}
    if (prenom) updates.prenom = prenom
    if (nom) updates.nom = nom
    if (newsletter_consent !== undefined) updates.newsletter_consent = newsletter_consent
    if (Object.keys(updates).length > 0) {
      await admin.from('clients').update(updates).eq('id', userId)
    }
  }

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

  // Créer un lead pour le beatmaker de la boutique si on connaît le slug
  if (slug) {
    const { data: beatmaker } = await admin
      .from('beatmakers')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (beatmaker) {
      const { data: existingLead } = await admin
        .from('leads')
        .select('id')
        .eq('client_id', userId)
        .eq('beatmaker_id', beatmaker.id)
        .maybeSingle()

      if (!existingLead) {
        const { error } = await admin.from('leads').insert({
          client_id:          userId,
          beatmaker_id:       beatmaker.id,
          source:             'visite',
          newsletter_inscrit: newsletter_consent ?? false,
        })
        if (error) console.error('[lierCompteClient] Erreur insert lead:', JSON.stringify(error))
      }
    }
  }
}
