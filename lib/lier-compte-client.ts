import { createAdminClient } from '@/utils/supabase/admin'
import { automatisationActive } from './automatisations'
import { inscrireParClient, lireStatutNewsletter } from './newsletter'
import { ecrireFicheBoutique } from './fiche-boutique-ecriture'

// Ce que la boutique reçoit en plus de l'email (9d lot 3) : prénom/nom saisis
// à l'inscription, ou transmis par Google. Rien pour une simple connexion.
export type OptionsLierCompte = {
  transmis?: { prenom?: string | null; nom?: string | null }
  reporterSiDesinscrit?: boolean
}

export async function lierCompteClient(
  userId: string,
  email: string,
  nom?: string | null,
  prenom?: string | null,
  newsletter_consent?: boolean,
  slug?: string | null,
  options?: OptionsLierCompte,
): Promise<{ newsletterReportee?: string }> {
  const admin = createAdminClient()
  const resultat: { newsletterReportee?: string } = {}
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
      return resultat
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

  // Fiche de la boutique où la personne se connecte / s'inscrit (9d lot 3) :
  // elle ne reçoit que ce qui lui est transmis à ce moment-là — l'email du
  // compte, + le prénom/nom saisis à l'inscription ou transmis par Google
  // (options.transmis). Une simple connexion ne transmet que l'email.
  if (slug) {
    const { data: beatmaker } = await admin
      .from('beatmakers')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (beatmaker) {
      const { leadId, cree } = await ecrireFicheBoutique(admin, {
        clientId: userId,
        beatmakerId: beatmaker.id,
        source: 'visite',
        donnees: { email: emailNorm, prenom: options?.transmis?.prenom, nom: options?.transmis?.nom },
      })

      // Case « recevoir les actualités » cochée = inscription à la newsletter
      // de CETTE boutique. Non cochée : on ne touche à rien. Une adresse
      // désinscrite de cette boutique n'est réinscrite qu'une fois le compte
      // confirmé (options.reporterSiDesinscrit, inscription d'un compte).
      if (newsletter_consent === true) {
        if (options?.reporterSiDesinscrit && (await lireStatutNewsletter(admin, userId, beatmaker.id)) === 'desinscrit') {
          resultat.newsletterReportee = beatmaker.id
        } else {
          await inscrireParClient(admin, { clientId: userId, beatmakerId: beatmaker.id, origine: 'inscription_compte', sourceLead: 'visite' })
        }
      }

      // "Bienvenue perso" — 1re fois que ce client est connu de CE
      // beatmaker (nouveau compte global ou connexion sur une nouvelle
      // boutique). La règle de suppression (rien d'autre le même jour) est
      // vérifiée à l'envoi, pas ici — voir doitEtreIgnore dans automatisations.ts.
      if (cree && leadId && await automatisationActive(beatmaker.id, 'bienvenue_perso')) {
        const { error: evenementError } = await admin.from('automatisation_evenements').insert({
          beatmaker_id: beatmaker.id,
          client_id:    userId,
          type:         'bienvenue_perso',
          reference_id: leadId,
        })
        if (evenementError) console.error('[lierCompteClient] Erreur insert automatisation_evenements:', JSON.stringify(evenementError))
      }
    }
  }

  return resultat
}
