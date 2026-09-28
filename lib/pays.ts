// Pays proposés à l'inscription beatmaker (Phase 12, Q6/Q6b du grill-me) :
// tous les pays où la plateforme peut ouvrir un compte Stripe Connect avec
// encaissement par carte, + les pays francophones non couverts par Stripe
// (affichés pour que le beatmaker puisse s'inscrire, avec un message clair
// au moment de connecter ses paiements). Si Stripe refuse quand même un
// pays de la liste, la création du compte renvoie le même message clair.
// Comptes BE/CH/CA à tester en conditions réelles en Phase 13.

export type Pays = { code: string; nom: string; paiementsDisponibles: boolean }

const PAIEMENTS_DISPONIBLES: [string, string][] = [
  ['FR', 'France'],
  ['BE', 'Belgique'],
  ['CH', 'Suisse'],
  ['CA', 'Canada'],
  ['LU', 'Luxembourg'],
  ['MC', 'Monaco'],
  ['DE', 'Allemagne'],
  ['AT', 'Autriche'],
  ['AU', 'Australie'],
  ['BG', 'Bulgarie'],
  ['CY', 'Chypre'],
  ['HR', 'Croatie'],
  ['DK', 'Danemark'],
  ['ES', 'Espagne'],
  ['EE', 'Estonie'],
  ['US', 'États-Unis'],
  ['FI', 'Finlande'],
  ['GI', 'Gibraltar'],
  ['GR', 'Grèce'],
  ['HK', 'Hong Kong'],
  ['HU', 'Hongrie'],
  ['IE', 'Irlande'],
  ['IT', 'Italie'],
  ['JP', 'Japon'],
  ['LV', 'Lettonie'],
  ['LI', 'Liechtenstein'],
  ['LT', 'Lituanie'],
  ['MT', 'Malte'],
  ['NO', 'Norvège'],
  ['NZ', 'Nouvelle-Zélande'],
  ['NL', 'Pays-Bas'],
  ['PL', 'Pologne'],
  ['PT', 'Portugal'],
  ['CZ', 'République tchèque'],
  ['RO', 'Roumanie'],
  ['GB', 'Royaume-Uni'],
  ['SG', 'Singapour'],
  ['SK', 'Slovaquie'],
  ['SI', 'Slovénie'],
  ['SE', 'Suède'],
  ['AE', 'Émirats arabes unis'],
]

const PAIEMENTS_INDISPONIBLES: [string, string][] = [
  ['DZ', 'Algérie'],
  ['BJ', 'Bénin'],
  ['BF', 'Burkina Faso'],
  ['CM', 'Cameroun'],
  ['CG', 'Congo'],
  ['CD', 'Congo (RDC)'],
  ['CI', "Côte d'Ivoire"],
  ['GA', 'Gabon'],
  ['GN', 'Guinée'],
  ['HT', 'Haïti'],
  ['LB', 'Liban'],
  ['MG', 'Madagascar'],
  ['ML', 'Mali'],
  ['MA', 'Maroc'],
  ['NE', 'Niger'],
  ['SN', 'Sénégal'],
  ['TG', 'Togo'],
  ['TN', 'Tunisie'],
]

const parNom = (a: Pays, b: Pays) => a.nom.localeCompare(b.nom, 'fr')

export const PAYS: Pays[] = [
  ...PAIEMENTS_DISPONIBLES.map(([code, nom]) => ({ code, nom, paiementsDisponibles: true })),
  ...PAIEMENTS_INDISPONIBLES.map(([code, nom]) => ({ code, nom, paiementsDisponibles: false })),
].sort((a, b) => (a.code === 'FR' ? -1 : b.code === 'FR' ? 1 : parNom(a, b)))

export const PAYS_PAR_DEFAUT = 'FR'

export const MESSAGE_PAIEMENTS_INDISPONIBLES = "Les paiements ne sont pas encore disponibles dans ton pays."

export function paysValide(code: unknown): code is string {
  return typeof code === 'string' && PAYS.some(p => p.code === code)
}

export function paiementsDisponiblesDans(code: string | null | undefined): boolean {
  return PAYS.some(p => p.code === code && p.paiementsDisponibles)
}

export function nomPays(code: string | null | undefined): string {
  return PAYS.find(p => p.code === code)?.nom ?? code ?? ''
}
