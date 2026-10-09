import { lireCsv } from './csv'

// Taux de référence de la BCE (devise pour 1 €), un seul appel pour toute la
// période d'un import. Le taux d'une vente = celui du jour de la vente, ou du
// dernier jour publié avant (week-end, jours fériés). Jamais d'approximation :
// BCE injoignable ou taux manquant = erreur, l'import échoue proprement.

export class ErreurTauxBce extends Error {}

// Écart maximal entre une vente et le dernier taux publié avant elle
// (week-end de Pâques = 4 jours) ; au-delà, la série est incomplète.
const ECART_MAX_JOURS = 6

export type TauxParJour = { devise: string; taux: (jour: string) => { taux: number; dateTaux: string } }

function jourAvant(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

export async function chargerTauxBce(devise: string, premierJour: string, dernierJour: string): Promise<TauxParJour> {
  const code = devise.toUpperCase()
  if (code === 'EUR') return { devise: code, taux: jour => ({ taux: 1, dateTaux: jour }) }
  if (!/^[A-Z]{3}$/.test(code)) throw new ErreurTauxBce(`Devise inconnue : ${devise}`)

  const debut = jourAvant(premierJour, ECART_MAX_JOURS + 4)
  const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${code}.EUR.SP00.A?startPeriod=${debut}&endPeriod=${dernierJour}&format=csvdata&detail=dataonly`
  let texte: string
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    texte = await res.text()
  } catch (e) {
    console.error('[taux-bce] appel BCE impossible:', e)
    throw new ErreurTauxBce('La Banque centrale européenne ne répond pas pour le moment : impossible de convertir les montants en euros. Rien n’a été importé, réessaie dans quelques minutes.')
  }

  const lignes = lireCsv(texte)
  const enTetes = lignes[0]?.cellules ?? []
  const iJour = enTetes.indexOf('TIME_PERIOD')
  const iValeur = enTetes.indexOf('OBS_VALUE')
  if (iJour < 0 || iValeur < 0) throw new ErreurTauxBce('Réponse de la Banque centrale européenne illisible. Rien n’a été importé, réessaie plus tard.')

  const serie = new Map<string, number>()
  for (const l of lignes.slice(1)) {
    const jour = l.cellules[iJour]
    const valeur = Number(l.cellules[iValeur])
    if (jour && valeur > 0) serie.set(jour, valeur)
  }
  if (serie.size === 0) throw new ErreurTauxBce(`Aucun taux ${code} publié par la Banque centrale européenne sur cette période. Rien n’a été importé.`)

  return {
    devise: code,
    taux: (jour: string) => {
      for (let n = 0; n <= ECART_MAX_JOURS; n++) {
        const j = jourAvant(jour, n)
        const t = serie.get(j)
        if (t) return { taux: t, dateTaux: j }
      }
      throw new ErreurTauxBce(`Taux ${code} de la Banque centrale européenne introuvable autour du ${jour}. Rien n’a été importé.`)
    },
  }
}

export function convertirEnEuros(montant: number, taux: number): number {
  return Math.round((montant / taux) * 100) / 100
}
