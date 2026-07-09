export type AutomatisationRow = {
  id: string
  type: string
  actif: boolean
  objet: string | null
  corps: string | null
  delai_heures: number
  heure_cible_minutes: number | null
  config: Record<string, number> | null
}

export type EvenementFileAttente = {
  id: string
  flux: string
  clientNom: string
  clientEmail: string
  echeanceISO: string | null
}
