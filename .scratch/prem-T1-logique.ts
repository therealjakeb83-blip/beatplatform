import { chargerPreremplissage } from '@/lib/preremplissage-paiement'
import { choixMemoriser, CLE_MEMORISER } from '@/lib/infos-paiement-compte'

type Row = Record<string, unknown>
function mock(tables: Record<string, Row[]>, journal: string[] = []) {
  return {
    from(nom: string) {
      const filtres: [string, unknown][] = []
      let ordre: [string, boolean] | null = null
      let suppr = false
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (c: string, v: unknown) => { filtres.push([c, v]); return q },
        order: (c: string, o: { ascending: boolean }) => { ordre = [c, o.ascending]; return q },
        limit: () => q,
        delete: () => { suppr = true; return q },
        maybeSingle: async () => {
          let rows = (tables[nom] ?? []).filter(r => filtres.every(([c, v]) => r[c] === v))
          if (ordre) { const [c, asc] = ordre; rows = [...rows].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (asc ? 1 : -1)) }
          return { data: rows[0] ?? null, error: null }
        },
        then: (res: (v: unknown) => void) => { if (suppr) journal.push(`delete ${nom} ${JSON.stringify(filtres)}`); res({ error: null }) },
      }
      return q
    },
  } as never
}
let ok = 0, ko = 0
const t = (nom: string, c: boolean) => { if (c) ok++; else ko++; console.log(c ? 'OK ' : 'KO ', nom) }
const C = 'client-lea', A = 'bm-A', B = 'bm-B'
const adr = (a: string, cp = '75001', v = 'Paris', p = 'FR') => ({ ligne: `${a}, ${cp} ${v}, ${p}`, adresse: a, code_postal: cp, ville: v, pays: p })
const ficheA = { client_id: C, beatmaker_id: A, prenom: 'Lea', nom: 'Martin', telephones: ['0611', '0600'], adresses: [adr('2 rue Neuve'), { ligne: 'vieille adresse en une ligne' }, adr('9 quai Lyon', '69001', 'Lyon')], pays: 'FR', efface_le: null, created_at: '2025-01-01T00:00:00Z' }

const main = async () => {
  t('T5 pas connecte = rien', (await chargerPreremplissage(mock({ leads: [ficheA] }), null, A)) === null)
  t('T5 jamais passe dans la boutique, pas de case = rien', (await chargerPreremplissage(mock({ leads: [ficheA] }), C, B)) === null)
  t('T5 contact efface = rien', (await chargerPreremplissage(mock({ leads: [{ ...ficheA, efface_le: '2026-01-01' }] }), C, A)) === null)
  t('T5 fiche d un autre client jamais lue', (await chargerPreremplissage(mock({ leads: [{ ...ficheA, client_id: 'autre' }] }), C, A)) === null)

  const p1 = await chargerPreremplissage(mock({ leads: [ficheA], commandes: [] }), C, A)
  t('T1 prenom/nom/tel recent/pays', p1?.prenom === 'Lea' && p1?.nom === 'Martin' && p1?.telephone === '0611' && p1?.pays === 'FR')
  t('T1 adresse la plus recente en tete', p1?.adresses[0]?.adresse === '2 rue Neuve' && p1?.adresses[0]?.codePostal === '75001')
  t('T3 2 adresses completes, ligne seule ignoree', p1?.adresses.length === 2 && p1?.adresses[1]?.ville === 'Lyon')
  t('T4 sans commande pro = pas pro', p1?.pro === null)
  t('T8 case decochee par defaut', p1?.memoriserActif === false)

  const cmds = [
    { client_id: C, beatmaker_id: A, created_at: '2026-03-01', acheteur_raison_sociale: 'Lea SAS', acheteur_numero_tva: 'FR123' },
    { client_id: C, beatmaker_id: A, created_at: '2026-01-01', acheteur_raison_sociale: null, acheteur_numero_tva: null },
    { client_id: C, beatmaker_id: B, created_at: '2026-06-01', acheteur_raison_sociale: 'Autre SAS', acheteur_numero_tva: 'FR999' },
  ]
  const p2 = await chargerPreremplissage(mock({ leads: [ficheA], commandes: cmds }), C, A)
  t('T4 derniere commande pro DANS la boutique', p2?.pro?.raisonSociale === 'Lea SAS' && p2?.pro?.numeroTva === 'FR123')
  const p3 = await chargerPreremplissage(mock({ leads: [ficheA], commandes: [{ ...cmds[0], created_at: '2025-12-01' }, { ...cmds[1], created_at: '2026-04-01' }] }), C, A)
  t('T4 derniere commande en particulier = pas pro', p3?.pro === null)

  const compte = { client_id: C, prenom: 'Lea', nom: 'Martin-Neuf', telephone: '0799', adresse: '5 av Nouvelle', code_postal: '13001', ville: 'Marseille', pays: 'FR', raison_sociale: null, numero_tva: null, consenti_le: '2026-05-01', maj_le: '2026-05-01T00:00:00Z' }
  const p4 = await chargerPreremplissage(mock({ leads: [ficheA], commandes: cmds, infos_paiement_compte: [compte] }), C, A)
  t('T11 compte plus recent : compte prerempli', p4?.adresses[0]?.ville === 'Marseille' && p4?.telephone === '0799' && p4?.nom === 'Martin-Neuf')
  t('T11 adresses de la fiche dans le menu', p4?.adresses.length === 3 && p4?.adresses[1]?.adresse === '2 rue Neuve')
  t('T11 pro = celui de la source preremplie (compte particulier)', p4?.pro === null)
  t('T9 case deja cochee', p4?.memoriserActif === true)
  const p5 = await chargerPreremplissage(mock({ leads: [ficheA], commandes: [{ ...cmds[0], created_at: '2026-09-01' }], infos_paiement_compte: [compte] }), C, A)
  t('T11 boutique plus recente : fiche preremplie, compte dans le menu', p5?.adresses[0]?.adresse === '2 rue Neuve' && p5?.adresses[2]?.ville === 'Marseille' && p5?.pro?.raisonSociale === 'Lea SAS')
  const p6 = await chargerPreremplissage(mock({ infos_paiement_compte: [compte] }), C, B)
  t('T11 autre boutique sans fiche : infos du compte', p6?.adresses.length === 1 && p6?.prenom === 'Lea')
  const p7 = await chargerPreremplissage(mock({ leads: [{ ...ficheA, efface_le: '2026-01-01' }], infos_paiement_compte: [compte] }), C, A)
  t('T5 contact efface : fiche ignoree, compte seul', p7?.adresses.length === 1 && p7?.adresses[0]?.ville === 'Marseille')
  const p8 = await chargerPreremplissage(mock({ leads: [{ ...ficheA, adresses: [adr('5 av Nouvelle', '13001', 'Marseille')] }], infos_paiement_compte: [compte] }), C, A)
  t('T3 meme adresse jamais en double', p8?.adresses.length === 1)

  const j: string[] = []
  t('choix : pas connecte = rien', Object.keys(await choixMemoriser(mock({}, j), null, true)).length === 0)
  t('T8 choix : coche = identifiant du compte connecte', (await choixMemoriser(mock({}, j), C, true))[CLE_MEMORISER] === C)
  const r = await choixMemoriser(mock({}, j), C, false)
  t('T10 choix : decoche = effacement immediat', Object.keys(r).length === 0 && j.some(l => l.includes('delete infos_paiement_compte') && l.includes(C)))
  t('T9 choix : case absente + deja cochee = mise a jour', (await choixMemoriser(mock({ infos_paiement_compte: [compte] }), C, undefined))[CLE_MEMORISER] === C)
  t('choix : case absente + jamais cochee = rien', Object.keys(await choixMemoriser(mock({}), C, undefined)).length === 0)
  console.log(`${ok}/${ok + ko}`)
}
main()
