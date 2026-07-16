import { createAdminClient } from '@/utils/supabase/admin'
import { automatisationActive } from './automatisations'

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
    // Réassigner TOUTES les tables qui référencent clients.id avant de
    // supprimer la fiche invité — sinon 2 problèmes selon la table :
    // (1) FK sans cascade (tentatives_paiement, licence_downloads) → la
    //     suppression échoue silencieusement (jamais vérifiée avant 2026-07-15),
    //     laissant la fiche invité en place puis l'insert de la nouvelle fiche
    //     échoue en doublon d'email (bug trouvé en testant Phase 5.7 avec Jake) ;
    //     (2) FK en cascade (leads, favoris, free_downloads, automatisation_*...)
    //     → la suppression réussit mais efface silencieusement l'historique du
    //     client au lieu de le transférer sur le nouveau compte.
    const idGuest = guestClient.id

    const reassignerTout = () => Promise.all([
      admin.from('commandes').update({ client_id: userId }).eq('client_id', idGuest),
      admin.from('abonnements_boutique').update({ client_id: userId }).eq('client_id', idGuest),
      admin.from('leads').update({ client_id: userId }).eq('client_id', idGuest),
      admin.from('favoris').update({ client_id: userId }).eq('client_id', idGuest),
      admin.from('free_downloads').update({ client_id: userId }).eq('client_id', idGuest),
      admin.from('licence_downloads').update({ client_id: userId }).eq('client_id', idGuest),
      admin.from('tentatives_paiement').update({ client_id: userId }).eq('client_id', idGuest),
      admin.from('morceaux_clients').update({ client_id: userId }).eq('client_id', idGuest),
      admin.from('beat_plays').update({ client_id: userId }).eq('client_id', idGuest),
      admin.from('email_logs').update({ client_id: userId }).eq('client_id', idGuest),
      admin.from('listes_crm_contacts').update({ client_id: userId }).eq('client_id', idGuest),
      admin.from('doublons_ignores').update({ client_id_1: userId }).eq('client_id_1', idGuest),
      admin.from('doublons_ignores').update({ client_id_2: userId }).eq('client_id_2', idGuest),
      admin.from('automatisation_evenements').update({ client_id: userId }).eq('client_id', idGuest),
      admin.from('automatisation_envois').update({ client_id: userId }).eq('client_id', idGuest),
    ])

    // Jusqu'à 5 tentatives espacées de 1,2s (~5s au total) : un paiement
    // d'abonnement en cours de traitement (invoice.payment_succeeded,
    // événement Stripe séparé qui peut arriver au même moment que
    // checkout.session.completed, retardé par un démarrage à froid des
    // fonctions Vercel) peut insérer une nouvelle commande référençant
    // idGuest PILE entre notre réassignation et la suppression — on retente
    // plutôt que d'abandonner direct (bug constaté le 2026-07-15/16, 3
    // tentatives sur 3s se sont révélées insuffisantes en pratique). Budget
    // volontairement borné : les appelants (ex. /abonnement/succes) tournent
    // sur des fonctions Vercel plafonnées à 10s d'exécution.
    let supprime = false
    let derniereErreur: unknown = null
    for (let tentative = 0; tentative < 5 && !supprime; tentative++) {
      await reassignerTout()
      const { error: deleteError, count } = await admin.from('clients').delete({ count: 'exact' }).eq('id', idGuest)
      if (!deleteError && count && count > 0) {
        supprime = true
      } else {
        derniereErreur = deleteError
        if (tentative < 4) await new Promise(r => setTimeout(r, 1200))
      }
    }

    if (!supprime) {
      // Une table qui référence clients.id sans cascade a été oubliée
      // ci-dessus (ou une course qui n'a pas eu le temps de se résoudre en 3
      // tentatives) — on arrête là plutôt que de tenter l'insert qui
      // échouerait de toute façon en doublon d'email, en laissant les 2
      // fiches non fusionnées.
      console.error('[lierCompteClient] Suppression de la fiche invité impossible (fusion incomplète) :', idGuest, JSON.stringify(derniereErreur))
      return
    }

    const { error } = await admin.from('clients').insert({
      id: userId,
      email,
      nom: nom ?? idGuest,
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
        const { data: lead, error } = await admin.from('leads').insert({
          client_id:          userId,
          beatmaker_id:       beatmaker.id,
          source:             'visite',
          newsletter_inscrit: newsletter_consent ?? false,
        }).select('id').single()
        if (error) console.error('[lierCompteClient] Erreur insert lead:', JSON.stringify(error))

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
}
