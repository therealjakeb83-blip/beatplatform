import { createAdminClient } from '@/utils/supabase/admin'
import { automatisationActive } from './automatisations'
import { inscrireParClient } from './newsletter'

export async function lierCompteClient(
  userId: string,
  email: string,
  nom?: string | null,
  prenom?: string | null,
  newsletter_consent?: boolean,
  slug?: string | null,
) {
  const admin = createAdminClient()
  // Normalisé en minuscule — sinon la même personne peut se retrouver
  // dupliquée en 2 fiches clients selon la casse de l'email (bug découvert
  // en testant Phase 5.9, 2026-07-16).
  const emailNorm = email.toLowerCase().trim()

  const { data: guestClient } = await admin
    .from('clients')
    .select('id')
    .eq('email', emailNorm)
    .maybeSingle()

  if (guestClient && guestClient.id !== userId) {
    // Fusion en une seule transaction Postgres atomique (supabase/
    // fusionner_compte_client.sql) plutôt qu'en plusieurs appels JS
    // successifs — un webhook Stripe concurrent (invoice.payment_succeeded,
    // quasi simultané à checkout.session.completed) pouvait insérer une
    // nouvelle commande référençant la fiche invitée PILE entre la
    // réassignation et la suppression, aucune fenêtre de tentatives en JS
    // ne s'est montrée fiable (bug reproductible à chaque test le
    // 2026-07-15/16). La fonction verrouille la fiche invitée
    // (SELECT ... FOR UPDATE) : toute transaction concurrente qui tente
    // d'y référencer une nouvelle ligne doit attendre la fin de la fusion
    // au lieu de risquer la course.
    const { error } = await admin.rpc('fusionner_compte_client', {
      id_invite: guestClient.id,
      id_reel: userId,
      email_reel: emailNorm,
      nom_reel: nom ?? null,
      prenom_reel: prenom ?? null,
      // Le consentement n'est plus global (leads.newsletter_statut, par boutique)
      newsletter_consent_reel: null,
    })
    if (error) {
      console.error('[lierCompteClient] Erreur fusion de compte :', guestClient.id, JSON.stringify(error))
      return
    }

  } else if (!guestClient) {
    const { error } = await admin.from('clients').insert({
      id: userId,
      email: emailNorm,
      nom: nom ?? emailNorm.split('@')[0],
      prenom: prenom ?? null,
    })
    if (error) console.error('[lierCompteClient] Erreur insert clients:', JSON.stringify(error))

  } else {
    const updates: Record<string, unknown> = {}
    if (prenom) updates.prenom = prenom
    if (nom) updates.nom = nom
    if (Object.keys(updates).length > 0) {
      await admin.from('clients').update(updates).eq('id', userId)
    }
  }

  await admin
    .from('abonnements_boutique')
    .update({ client_id: userId })
    .eq('acheteur_email', emailNorm)
    .is('client_id', null)

  await admin
    .from('commandes')
    .update({ client_id: userId })
    .eq('acheteur_email', emailNorm)
    .is('client_id', null)

  // Créer un lead pour le beatmaker de la boutique si on connaît le slug
  if (slug) {
    const { data: beatmaker } = await admin
      .from('beatmakers')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (beatmaker) {
      // Case « recevoir les actualités » cochée à l'inscription = inscription à
      // la newsletter de CETTE boutique. Non cochée : on ne touche à rien.
      let lead: { id: string } | null = null
      if (newsletter_consent === true) {
        const res = await inscrireParClient(admin, { clientId: userId, beatmakerId: beatmaker.id, origine: 'inscription_compte', sourceLead: 'visite' })
        lead = res.leadCree && res.leadId ? { id: res.leadId } : null
      } else {
        const { data: existingLead } = await admin
          .from('leads')
          .select('id')
          .eq('client_id', userId)
          .eq('beatmaker_id', beatmaker.id)
          .maybeSingle()
        if (!existingLead) {
          const { data, error } = await admin.from('leads').insert({
            client_id:    userId,
            beatmaker_id: beatmaker.id,
            source:       'visite',
          }).select('id').single()
          if (error) console.error('[lierCompteClient] Erreur insert lead:', JSON.stringify(error))
          lead = data
        }
      }

      // "Bienvenue perso" — 1re fois que ce client est connu de CE
      // beatmaker (nouveau compte global ou connexion sur une nouvelle
      // boutique). La règle de suppression (rien d'autre le même jour) est
      // vérifiée à l'envoi, pas ici — voir doitEtreIgnore dans automatisations.ts.
      if (lead && await automatisationActive(beatmaker.id, 'bienvenue_perso')) {
        const { error: evenementError } = await admin.from('automatisation_evenements').insert({
          beatmaker_id: beatmaker.id,
          client_id:    userId,
          type:         'bienvenue_perso',
          reference_id: lead.id,
        })
        if (evenementError) console.error('[lierCompteClient] Erreur insert automatisation_evenements:', JSON.stringify(evenementError))
      }
    }
  }
}
