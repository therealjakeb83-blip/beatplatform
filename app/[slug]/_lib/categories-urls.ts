export type TypeCategorieDb = 'styles' | 'ambiances' | 'instruments' | 'type_beat'
export type TypeCategorieUrl = 'styles' | 'ambiances' | 'instruments' | 'type-beat'

export const TYPE_URL_VERS_DB: Record<TypeCategorieUrl, TypeCategorieDb> = {
  styles: 'styles',
  ambiances: 'ambiances',
  instruments: 'instruments',
  'type-beat': 'type_beat',
}

export const TYPE_DB_VERS_URL: Record<TypeCategorieDb, TypeCategorieUrl> = {
  styles: 'styles',
  ambiances: 'ambiances',
  instruments: 'instruments',
  type_beat: 'type-beat',
}

export const TITRE_SECTION: Record<TypeCategorieDb, string> = {
  styles: 'Parcourir les styles',
  ambiances: 'Parcourir les ambiances',
  instruments: 'Parcourir les instruments',
  type_beat: 'Parcourir les type beats',
}

export function estTypeCategorieUrlValide(valeur: string): valeur is TypeCategorieUrl {
  return valeur in TYPE_URL_VERS_DB
}
