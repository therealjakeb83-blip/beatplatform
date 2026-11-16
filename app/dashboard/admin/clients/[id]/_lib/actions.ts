'use server'

import { estAdmin } from '@/lib/admin'
import { supprimerCompteClient } from '@/lib/suppression-compte'

// 9d lot 4 (option C1 de Jake) : l'Admin lit les fiches pour le support, sans
// jamais les modifier ; sa seule action est de supprimer le compte Sonoo de la
// personne, à sa demande. L'ancienne « correction manuelle » de `clients`
// (corrigerClientAction, dernière écriture CRM de la fiche commune) est retirée.
export async function supprimerCompteAdminAction(
  clientId: string,
  confirmation: string,
  desinscrire: string[],
): Promise<{ erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }
  if (confirmation !== 'SUPPRIMER') return { erreur: 'Tape SUPPRIMER pour confirmer.' }
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) return { erreur: 'Compte introuvable.' }
  const r = await supprimerCompteClient({ clientId, desinscrire: Array.isArray(desinscrire) ? desinscrire : [] })
  return r.ok ? {} : { erreur: r.erreur }
}
