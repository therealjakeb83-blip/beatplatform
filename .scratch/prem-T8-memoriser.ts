import { memoriserInfosCompte, TEXTE_CONSENTEMENT_INFOS } from '@/lib/infos-paiement-compte'
let ok = 0, ko = 0
const t = (n: string, c: boolean) => { if (c) ok++; else ko++; console.log(c ? 'OK ' : 'KO ', n) }
function mock(existant: Record<string, unknown> | null) {
  const ecrit: Record<string, unknown>[] = []
  const db = { from: () => { const q: Record<string, unknown> = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: existant, error: null }), upsert: async (v: Record<string, unknown>) => { ecrit.push(v); return { error: null } } }; return q } }
  return { db: db as never, ecrit }
}
const main = async () => {
  let m = mock(null)
  await memoriserInfosCompte(m.db, 'c1', { nomComplet: 'Lea Martin Dupont', telephone: ' 0611 ', adresse: '2 rue Neuve', codePostal: '75001', ville: 'Paris', pays: 'fr', raisonSociale: 'Lea SAS', numeroTva: 'fr123' })
  let e = m.ecrit[0]
  t('nom complet (Apple Pay) decoupe', e.prenom === 'Lea' && e.nom === 'Martin Dupont')
  t('pays et TVA en majuscules, espaces retires', e.pays === 'FR' && e.numero_tva === 'FR123' && e.telephone === '0611')
  t('texte et date du consentement', e.texte_consentement === TEXTE_CONSENTEMENT_INFOS && typeof e.consenti_le === 'string' && e.consenti_le === e.maj_le)
  m = mock({ consenti_le: '2026-01-01T00:00:00Z' })
  await memoriserInfosCompte(m.db, 'c1', { prenom: 'Lea', nom: 'Martin', adresse: '5 av', codePostal: '13001', ville: 'Marseille', pays: 'FR' })
  e = m.ecrit[0]
  t('mise a jour : date du 1er consentement gardee', e.consenti_le === '2026-01-01T00:00:00Z' && e.maj_le !== e.consenti_le)
  t('T9 paiement en particulier : societe et TVA effacees', e.raison_sociale === null && e.numero_tva === null)
  m = mock(null)
  await memoriserInfosCompte(m.db, 'c1', { nom: 'Karim Benali' })
  t('nom complet dans le champ nom (collab Apple Pay) decoupe', m.ecrit[0].prenom === 'Karim' && m.ecrit[0].nom === 'Benali')
  m = mock(null)
  await memoriserInfosCompte(m.db, 'c1', { prenom: 'Lea', nom: 'Martin', pays: 'France' })
  t('pays invalide jamais ecrit', m.ecrit[0].pays === null)
  console.log(`${ok}/${ok + ko}`)
}
main()
