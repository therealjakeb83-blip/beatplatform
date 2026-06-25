import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getPeriodDates, inPeriod } from '@/app/dashboard/business/analytics/_lib/periode'

export const runtime = 'nodejs'

type PrefRow = { name: string; ca: number; ventes: number; ecoutes: number; free_dl: number }

function buildGroups(
  items: Array<{ labels: string[]; ca: number }>,
  playsMap: Map<string, number>,
  freeDlMap: Map<string, number>,
): PrefRow[] {
  const map = new Map<string, { ca: number; ventes: number }>()
  for (const { labels, ca } of items) {
    for (const label of labels) {
      if (!label) continue
      const ex = map.get(label) ?? { ca: 0, ventes: 0 }
      ex.ca     += ca
      ex.ventes += 1
      map.set(label, ex)
    }
  }
  const allLabels = new Set([...map.keys(), ...playsMap.keys(), ...freeDlMap.keys()])
  return [...allLabels]
    .map(label => ({
      name:    label,
      ca:      (map.get(label)?.ca ?? 0) / 100,
      ventes:  map.get(label)?.ventes ?? 0,
      ecoutes: playsMap.get(label) ?? 0,
      free_dl: freeDlMap.get(label) ?? 0,
    }))
    .sort((a, b) => b.ca - a.ca)
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { from, to } = getPeriodDates(request)
  const admin = createAdminClient()

  const [
    { data: allCommandes },
    { data: allPlays },
    { data: allFreeDl },
    { data: allBeats },
  ] = await Promise.all([
    admin.from('commandes')
      .select('prix_paye, created_at, beat_id, licence_id, licences(nom, modele), beats(styles, ambiances, instruments, type_beat)')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'payee'),
    admin.from('beat_plays')
      .select('played_at, beat_id, beats(styles, ambiances, instruments, type_beat)')
      .eq('beatmaker_id', user.id),
    admin.from('free_downloads')
      .select('downloaded_at, beat_id, beats(styles, ambiances, instruments, type_beat)')
      .eq('beatmaker_id', user.id),
    admin.from('beats')
      .select('id, styles, ambiances, instruments, type_beat')
      .eq('beatmaker_id', user.id),
  ])

  const cmds   = (allCommandes ?? []).filter(c => inPeriod(c.created_at, from, to))
  const plays  = (allPlays    ?? []).filter(p => inPeriod(p.played_at,    from, to))
  const freeDl = (allFreeDl   ?? []).filter(f => inPeriod(f.downloaded_at, from, to))

  // Helper: construire une map label -> count pour écoutes / free_dl
  function buildCountMap(items: Array<{ beat: unknown; inc: number }>, getLabels: (b: unknown) => string[]): Map<string, number> {
    const map = new Map<string, number>()
    for (const { beat, inc } of items) {
      for (const label of getLabels(beat)) {
        map.set(label, (map.get(label) ?? 0) + inc)
      }
    }
    return map
  }

  function getArr(b: unknown, key: string): string[] {
    if (!b || typeof b !== 'object') return []
    const v = (b as Record<string, unknown>)[key]
    return Array.isArray(v) ? v.filter(Boolean) : []
  }

  const playBeatArr = plays.map(p => ({ beat: Array.isArray(p.beats) ? p.beats[0] : p.beats, inc: 1 }))
  const dlBeatArr   = freeDl.map(f => ({ beat: Array.isArray(f.beats) ? f.beats[0] : f.beats, inc: 1 }))

  // Licences
  const licenceMap = new Map<string, { ca: number; ventes: number }>()
  for (const c of cmds) {
    const l = Array.isArray(c.licences) ? c.licences[0] : c.licences
    const nom = (l as { nom: string } | null)?.nom ?? 'Autre'
    const ex = licenceMap.get(nom) ?? { ca: 0, ventes: 0 }
    ex.ca     += c.prix_paye
    ex.ventes += 1
    licenceMap.set(nom, ex)
  }
  const licences: PrefRow[] = [...licenceMap.entries()]
    .map(([name, v]) => ({ name, ca: v.ca / 100, ventes: v.ventes, ecoutes: 0, free_dl: 0 }))
    .sort((a, b) => b.ca - a.ca)

  // Styles
  const stylesPlays  = buildCountMap(playBeatArr, b => getArr(b, 'styles'))
  const stylesDl     = buildCountMap(dlBeatArr,   b => getArr(b, 'styles'))
  const styles = buildGroups(
    cmds.map(c => ({ labels: getArr(Array.isArray(c.beats) ? c.beats[0] : c.beats, 'styles'), ca: c.prix_paye })),
    stylesPlays, stylesDl,
  )

  // Ambiances
  const ambiPlays = buildCountMap(playBeatArr, b => getArr(b, 'ambiances'))
  const ambiDl    = buildCountMap(dlBeatArr,   b => getArr(b, 'ambiances'))
  const ambiances = buildGroups(
    cmds.map(c => ({ labels: getArr(Array.isArray(c.beats) ? c.beats[0] : c.beats, 'ambiances'), ca: c.prix_paye })),
    ambiPlays, ambiDl,
  )

  // Instruments
  const instruPlays = buildCountMap(playBeatArr, b => getArr(b, 'instruments'))
  const instruDl    = buildCountMap(dlBeatArr,   b => getArr(b, 'instruments'))
  const instruments = buildGroups(
    cmds.map(c => ({ labels: getArr(Array.isArray(c.beats) ? c.beats[0] : c.beats, 'instruments'), ca: c.prix_paye })),
    instruPlays, instruDl,
  )

  // Type beat
  const typePlays = buildCountMap(playBeatArr, b => getArr(b, 'type_beat'))
  const typeDl    = buildCountMap(dlBeatArr,   b => getArr(b, 'type_beat'))
  const type_beat = buildGroups(
    cmds.map(c => ({ labels: getArr(Array.isArray(c.beats) ? c.beats[0] : c.beats, 'type_beat'), ca: c.prix_paye })),
    typePlays, typeDl,
  )

  return NextResponse.json({ licences, styles, ambiances, instruments, type_beat })
}
