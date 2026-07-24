'use server'

import { estAdmin } from '@/lib/admin'
import { rechercherAdmin, type ResultatRechercheAdmin, type OngletRecherche } from '@/lib/admin-recherche'

export async function rechercher(requete: string, onglet: OngletRecherche): Promise<{ resultat?: ResultatRechercheAdmin; erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }
  const resultat = await rechercherAdmin(requete, onglet)
  return { resultat }
}
