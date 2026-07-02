import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getPeriodDates, inPeriod, getHistoriqueSlots, type HistoriqueSlot } from '@/app/dashboard/business/analytics/_lib/periode'

export const runtime = 'nodejs'

type PrefRow    = { name: string; ca: number; ventes: number; ecoutes: number; favoris: number; free_dl: number }
type LicenceRow = { name: string; ca: number; ventes: number }
type HistoPoint    = { label: string; fullLabel: string; ca: number; ventes: number; ecoutes: number; favoris: number; free_dl: number }
type LicenceHisto  = { label: string; fullLabel: string; ca: number; ventes: number }
type RawCmd  = { prix_paye: number; created_at: string; licences: unknown; beats: unknown }
type RawEvt  = { created_at: string; beats: unknown } // beat_plays / free_downloads / favoris (colonnes de date différentes, normalisées en amont)

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

function sumLicenceBySlot(cmds: RawCmd[], slots: HistoriqueSlot[]): LicenceHisto[] {
  return slots.map(slot => {
    const mCmds = cmds.filter(c => c.created_at >= slot.from && c.created_at < slot.to)
    let ca = 0, ventes = 0
    for (const c of mCmds) {
      const n = licenceLabels(c).length
      ca += c.prix_paye * n
      ventes += n
    }
    return { label: slot.label, fullLabel: slot.fullLabel, ca, ventes }
  })
}

// Groupes par style/ambiance/instrument/type_beat — combine CA+ventes (commandes) et écoutes/favoris/free_dl (events)
function buildBeatGroups(cmds: RawCmd[], plays: RawEvt[], freeDl: RawEvt[], favoris: RawEvt[], key: string): PrefRow[] {
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
  for (const p of plays)   for (const label of beatLabels(key)(p.beats))   get(label).ecoutes += 1
  for (const f of freeDl)  for (const label of beatLabels(key)(f.beats))   get(label).free_dl += 1
  for (const f of favoris) for (const label of beatLabels(key)(f.beats))   get(label).favoris += 1
  return [...map.values()].sort((a, b) => b.ca - a.ca)
}

function sumBeatBySlot(cmds: RawCmd[], plays: RawEvt[], freeDl: RawEvt[], favoris: RawEvt[], key: string, slots: HistoriqueSlot[]): HistoPoint[] {
  return slots.map(slot => {
    const inSlot = (dateIso: string) => dateIso >= slot.from && dateIso < slot.to
    const mCmds    = cmds.filter(c => inSlot(c.created_at))
    const mPlays   = plays.filter(p => inSlot(p.created_at))
    const mFreeDl  = freeDl.filter(f => inSlot(f.created_at))
    const mFavoris = favoris.filter(f => inSlot(f.created_at))

    let ca = 0, ventes = 0
    for (const c of mCmds) { const n = beatLabels(key)(c.beats).length; ca += c.prix_paye * n; ventes += n }
    const ecoutes = mPlays.reduce((s, p) => s + beatLabels(key)(p.beats).length, 0)
    const free_dl = mFreeDl.reduce((s, f) => s + beatLabels(key)(f.beats).length, 0)
    const favorisCount = mFavoris.reduce((s, f) => s + beatLabels(key)(f.beats).length, 0)

    return { label: slot.label, fullLabel: slot.fullLabel, ca, ventes, ecoutes, free_dl, favoris: favorisCount }
  })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { from, to, periode } = getPeriodDates(request)
  const admin = createAdminClient()

  const [
    { data: allCommandes },
    { data: allPlays },
    { data: allFreeDl },
    { data: allFavoris },
  ] = await Promise.all([
    admin.from('commandes')
      .select('prix_paye, created_at, licences(nom), beats(styles, ambiances, instruments, type_beat)')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'payee')
      .or('type_commande.eq.LICENCE,type_commande.is.null'),
    admin.from('beat_plays')
      .select('played_at, beats(styles, ambiances, instruments, type_beat)')
      .eq('beatmaker_id', user.id),
    admin.from('free_downloads')
      .select('downloaded_at, beats(styles, ambiances, instruments, type_beat)')
      .eq('beatmaker_id', user.id),
    admin.from('favoris')
      .select('created_at, beats!inner(beatmaker_id, styles, ambiances, instruments, type_beat)')
      .eq('beats.beatmaker_id', user.id),
  ])

  const allCmds    = (allCommandes ?? []) as RawCmd[]
  const allPlaysN  = (allPlays   ?? []).map(p => ({ created_at: p.played_at,     beats: p.beats })) as RawEvt[]
  const allFreeDlN = (allFreeDl  ?? []).map(f => ({ created_at: f.downloaded_at, beats: f.beats })) as RawEvt[]
  const allFavN    = (allFavoris ?? []) as unknown as RawEvt[]

  const cmds    = allCmds.filter(c => inPeriod(c.created_at, from, to))
  const plays   = allPlaysN.filter(p => inPeriod(p.created_at, from, to))
  const freeDl  = allFreeDlN.filter(f => inPeriod(f.created_at, from, to))
  const favoris = allFavN.filter(f => inPeriod(f.created_at, from, to))

  const licences    = buildLicenceGroups(cmds)
  const styles      = buildBeatGroups(cmds, plays, freeDl, favoris, 'styles')
  const ambiances   = buildBeatGroups(cmds, plays, freeDl, favoris, 'ambiances')
  const instruments = buildBeatGroups(cmds, plays, freeDl, favoris, 'instruments')
  const type_beat   = buildBeatGroups(cmds, plays, freeDl, favoris, 'type_beat')

  const dataFrom = periode === 'tout' ? allCmds.map(c => c.created_at).sort()[0] : undefined
  const slots = getHistoriqueSlots(periode, from, to, dataFrom)

  const historique = {
    licences:    sumLicenceBySlot(allCmds, slots),
    styles:      sumBeatBySlot(allCmds, allPlaysN, allFreeDlN, allFavN, 'styles', slots),
    ambiances:   sumBeatBySlot(allCmds, allPlaysN, allFreeDlN, allFavN, 'ambiances', slots),
    instruments: sumBeatBySlot(allCmds, allPlaysN, allFreeDlN, allFavN, 'instruments', slots),
    type_beat:   sumBeatBySlot(allCmds, allPlaysN, allFreeDlN, allFavN, 'type_beat', slots),
  }

  return NextResponse.json({ licences, styles, ambiances, instruments, type_beat, historique })
}
