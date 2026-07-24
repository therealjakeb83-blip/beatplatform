'use server'

import { estAdmin } from '@/lib/admin'
import { rechercherAdmin, type ResultatRechercheAdmin } from '@/lib/admin-recherche'

export async function rechercher(requete: string): Promise<{ resultat?: ResultatRechercheAdmin; erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }
  const resultat = await rechercherAdmin(requete)
  return { resultat }
}
