import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getPeriodDates, inPeriod, getHistoriqueSlots, granularite, type HistoriqueSlot } from '@/app/dashboard/business/analytics/_lib/periode'
import { fuseauSur } from '@/lib/fuseau-horaire'
import { chargerPartsVendeur, partsDeLignes, STATUTS_ANALYTICS } from '@/lib/analytics-parts'
import { evenementsParBeat, evenementsParTranche, type EvenementsTranche } from '@/lib/analytics-evenements'
import { toutesLesLignes, parLots } from '@/app/dashboard/business/_lib/requetes'

export const runtime = 'nodejs'

type PrefRow    = { name: string; ca: number; ventes: number; ecoutes: number; favoris: number; free_dl: number }
type LicenceRow = { name: string; ca: number; ventes: number }
type HistoPoint    = { label: string; fullLabel: string; ca: number; ventes: number; ecoutes: number; favoris: number; free_dl: number }
type LicenceHisto  = { label: string; fullLabel: string; ca: number; ventes: number }
type RawCmd  = { prix_paye: number; created_at: string; licences: unknown; beats: unknown }
// Écoutes / free downloads / favoris d'UN beat, comptés dans la base (lib/analytics-evenements.ts) :
// chaque compte vaut pour chacune des catégories du beat.
type EvtBeat = { beats: unknown; ecoutes: number; free_dl: number; favoris: number }

function getArr(b: unknown, key: string): string[] {
  if (!b || typeof b !== 'object') return []
  const v = (b as Record<string, unknown>)[key]
  return Array.isArray(v) ? v.filter(Boolean) : []
}

const beatLabels = (key: string) => (b: unknown): string[] =>
  getArr(Array.isArray(b) ? b[0] : b, key)

// Licence jointe uniquement — les commandes d'abonnement (licence_id null) sont
// exclues en amont par le filtre type_commande, cette vue ne parle que de ventes de licence
const licenceLabels = (c: RawCmd): string[] => {
  const l = Array.isArray(c.licences) ? c.licences[0] : c.licences
  const nom = (l as { nom: string } | null)?.nom
  return nom ? [nom] : []
}

// target = null → total toutes catégories confondues (un item multi-label compte pour chaque label)
// target = string → occurrences de cette seule catégorie (0 ou 1 par item)
function occ(labels: string[], target: string | null): number {
  return target === null ? labels.length : (labels.includes(target) ? 1 : 0)
}

function buildLicenceGroups(cmds: RawCmd[]): LicenceRow[] {
  const map = new Map<string, { ca: number; ventes: number }>()
  for (const c of cmds) {
    for (const label of licenceLabels(c)) {
      const ex = map.get(label) ?? { ca: 0, ventes: 0 }
      ex.ca     += c.prix_paye
      ex.ventes += 1
      map.set(label, ex)
    }
  }
  return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.ca - a.ca)
}

function sumLicenceBySlot(cmds: RawCmd[], slots: HistoriqueSlot[], target: string | null): LicenceHisto[] {
  return slots.map(slot => {
    const mCmds = cmds.filter(c => c.created_at >= slot.from && c.created_at < slot.to)
    let ca = 0, ventes = 0
    for (const c of mCmds) {
      const n = occ(licenceLabels(c), target)
      ca += c.prix_paye * n
      ventes += n
    }
    return { label: slot.label, fullLabel: slot.fullLabel, ca, ventes }
  })
}

// Groupes par style/ambiance/instrument/type_beat — combine CA+ventes (commandes) et écoutes/favoris/free_dl (events)
function buildBeatGroups(cmds: RawCmd[], evts: EvtBeat[], key: string): PrefRow[] {
  const map = new Map<string, PrefRow>()
  const get = (name: string) => {
    let row = map.get(name)
    if (!row) { row = { name, ca: 0, ventes: 0, ecoutes: 0, favoris: 0, free_dl: 0 }; map.set(name, row) }
    return row
  }
  for (const c of cmds) for (const label of beatLabels(key)(c.beats)) {
    const row = get(label)
    row.ca     += c.prix_paye
    row.ventes += 1
  }
  for (const e of evts) for (const label of beatLabels(key)(e.beats)) {
    const row = get(label)
    row.ecoutes += e.ecoutes
    row.free_dl += e.free_dl
    row.favoris += e.favoris
  }
  return [...map.values()].sort((a, b) => b.ca - a.ca)
}

function sumBeatBySlot(cmds: RawCmd[], evtsSlots: EvenementsTranche[][], tags: Map<string, unknown>, key: string, slots: HistoriqueSlot[], target: string | null): HistoPoint[] {
  return slots.map((slot, i) => {
    const mCmds    = cmds.filter(c => c.created_at >= slot.from && c.created_at < slot.to)

    let ca = 0, ventes = 0
    for (const c of mCmds) { const n = occ(beatLabels(key)(c.beats), target); ca += c.prix_paye * n; ventes += n }
    let ecoutes = 0, free_dl = 0, favorisCount = 0
    for (const e of evtsSlots[i] ?? []) {
      const n = occ(beatLabels(key)(tags.get(e.beat_id ?? '')), target)
      ecoutes += e.ecoutes * n
      free_dl += e.free_dl * n
      favorisCount += e.favoris * n
    }

    return { label: slot.label, fullLabel: slot.fullLabel, ca, ventes, ecoutes, free_dl, favoris: favorisCount }
  })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const [
    lignesBoutique,
    { data: beatmaker },
  ] = await Promise.all([
    // Niveau article (commande_lignes) — un panier de plusieurs beats donne
    // plusieurs lignes ici, chacune avec ses propres styles/licence.
    toutesLesLignes((debut, fin) => admin.from('commande_lignes')
      .select('commande_id, beat_id, licence_id, prix_paye, created_at, licences(nom), beats(styles, ambiances, instruments, type_beat), commandes!inner(beatmaker_id, statut)')
      .eq('commandes.beatmaker_id', user.id)
      .in('commandes.statut', STATUTS_ANALYTICS)
      .order('id')
      .range(debut, fin)),
    admin.from('beatmakers').select('fuseau_horaire').eq('id', user.id).single(),
  ])

  const tz = fuseauSur(beatmaker?.fuseau_horaire)
  const { from, to, periode } = getPeriodDates(request, tz)

  // CA d'un beat collab = part du propriétaire (Phase 13, lot 3).
  const allCmds = partsDeLignes(lignesBoutique, await chargerPartsVendeur(admin, user.id)) as unknown as RawCmd[]
  const cmds    = allCmds.filter(c => inPeriod(c.created_at, from, to))

  const dataFrom = periode === 'tout' ? allCmds.map(c => c.created_at).sort()[0] : undefined
  const slots = getHistoriqueSlots(periode, from, to, dataFrom, tz)

  const [evtsPeriode, evtsSlots] = await Promise.all([
    evenementsParBeat(admin, user.id, from, to),
    evenementsParTranche(admin, user.id, tz, granularite(periode, from, to), slots, true),
  ])
  const idsBeats = [...evtsPeriode.keys(), ...evtsSlots.flat().map(e => e.beat_id ?? '').filter(Boolean)]
  const beatsTags = await parLots<{ id: string }>(idsBeats, lot =>
    admin.from('beats').select('id, styles, ambiances, instruments, type_beat').in('id', lot))
  const tags = new Map<string, unknown>(beatsTags.map(b => [b.id, b]))
  const evts: EvtBeat[] = [...evtsPeriode.entries()].map(([id, e]) => ({ beats: tags.get(id), ecoutes: e.ecoutes, free_dl: e.free_dl, favoris: e.favoris }))

  const licences    = buildLicenceGroups(cmds)
  const styles      = buildBeatGroups(cmds, evts, 'styles')
  const ambiances   = buildBeatGroups(cmds, evts, 'ambiances')
  const instruments = buildBeatGroups(cmds, evts, 'instruments')
  const type_beat   = buildBeatGroups(cmds, evts, 'type_beat')

  // Historique par vue : total agrégé + une série par catégorie (pour l'analyse ciblée dans le graphique)
  const licenceHisto = {
    total:        sumLicenceBySlot(allCmds, slots, null),
    parCategorie: Object.fromEntries(licences.map(r => [r.name, sumLicenceBySlot(allCmds, slots, r.name)])),
  }
  const beatHisto = (rows: PrefRow[], key: string) => ({
    total:        sumBeatBySlot(allCmds, evtsSlots, tags, key, slots, null),
    parCategorie: Object.fromEntries(rows.map(r => [r.name, sumBeatBySlot(allCmds, evtsSlots, tags, key, slots, r.name)])),
  })

  const historique = {
    licences:    licenceHisto,
    styles:      beatHisto(styles, 'styles'),
    ambiances:   beatHisto(ambiances, 'ambiances'),
    instruments: beatHisto(instruments, 'instruments'),
    type_beat:   beatHisto(type_beat, 'type_beat'),
  }

  return NextResponse.json({ licences, styles, ambiances, instruments, type_beat, historique })
}
