import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerCompteSupprime } from '@/lib/emails'
import { oublierInfosCompte } from '@/lib/infos-paiement-compte'
import { NOM_PLATEFORME, EMAIL_CONTACT } from '@/lib/constantes'

// Suppression d'un compte Sonoo (9d lot 4), par la personne (« Mon compte »)
// ou par l'Admin à sa demande (support). La ligne `clients` est ANONYMISÉE,
// jamais supprimée (supprimer_compte_client) ; les fiches des boutiques
// restent ; la connexion est supprimée ; email « compte supprimé ».
export type ResultatSuppression = { ok: true } | { ok: false; statut: number; erreur: string }

export async function supprimerCompteClient(params: {
  clientId: string
  desinscrire: string[]
}): Promise<ResultatSuppression> {
  const admin = createAdminClient()
  const { clientId } = params
  const desinscrire = params.desinscrire.filter(v => /^[0-9a-f-]{36}$/i.test(v)).slice(0, 500)

  const { data: boutique } = await admin.from('beatmakers').select('id').eq('id', clientId).maybeSingle()
  if (boutique) {
    return { ok: false, statut: 409, erreur: `Cette connexion est aussi celle d’une boutique : écris à ${NOM_PLATEFORME} (${EMAIL_CONTACT}) pour fermer la boutique.` }
  }

  // Adresse à prévenir, lue AVANT l'anonymisation
  const [{ data: auth }, { data: client }] = await Promise.all([
    admin.auth.admin.getUserById(clientId),
    admin.from('clients').select('email').eq('id', clientId).maybeSingle(),
  ])
  const email = auth?.user?.email ?? (client?.email && !client.email.endsWith('@supprime.invalid') ? client.email : null)

  const { error } = await admin.rpc('supprimer_compte_client', { p_client_id: clientId, p_desinscrire: desinscrire })
  if (error) {
    if (error.message?.includes('abonnement_actif')) {
      return { ok: false, statut: 409, erreur: "Il reste un abonnement en cours : il faut d'abord l'annuler (« Mon compte » de la boutique), puis revenir ici." }
    }
    if (error.message?.includes('compte_boutique')) {
      return { ok: false, statut: 409, erreur: `Cette connexion est aussi celle d’une boutique : écris à ${NOM_PLATEFORME} (${EMAIL_CONTACT}) pour fermer la boutique.` }
    }
    if (!error.message?.includes('compte_introuvable')) {
      console.error('[suppression-compte] rpc:', JSON.stringify(error))
      return { ok: false, statut: 500, erreur: 'La suppression a échoué, rien n’a été modifié. Réessaie.' }
    }
    // compte_introuvable = déjà anonymisé ou connexion sans fiche : on ferme quand même la connexion
    if (!auth?.user) return { ok: false, statut: 404, erreur: 'Ce compte est déjà supprimé.' }
  }

  // Infos gardées par la case « se souvenir » : effacées avec le compte.
  await oublierInfosCompte(admin, clientId)

  if (auth?.user) {
    const { error: eAuth } = await admin.auth.admin.deleteUser(clientId)
    if (eAuth) {
      console.error('[suppression-compte] connexion:', JSON.stringify(eAuth))
      return { ok: false, statut: 500, erreur: `Le compte est presque supprimé : la connexion n’a pas pu être fermée. Réessaie, ou écris à ${EMAIL_CONTACT}.` }
    }
  }

  if (email) await envoyerCompteSupprime({ to: email, le: new Date() }).catch(e => console.error('[suppression-compte] email:', e))
  return { ok: true }
}
