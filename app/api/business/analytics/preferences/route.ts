import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getPeriodDates, inPeriod, getHistoriqueSlots, type HistoriqueSlot } from '@/app/dashboard/business/analytics/_lib/periode'

export const runtime = 'nodejs'

type PrefRow = { name: string; ca: number; ventes: number }
type HistoPoint = { label: string; fullLabel: string; ca: number; ventes: number }
type RawCmd = { prix_paye: number; created_at: string; licences: unknown; beats: unknown }

function getArr(b: unknown, key: string): string[] {
  if (!b || typeof b !== 'object') return []
  const v = (b as Record<string, unknown>)[key]
  return Array.isArray(v) ? v.filter(Boolean) : []
}

function buildGroups(items: Array<{ labels: string[]; ca: number }>): PrefRow[] {
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
  return [...map.entries()]
    .map(([name, v]) => ({ name, ca: v.ca, ventes: v.ventes }))
    .sort((a, b) => b.ca - a.ca)
}

function sumBySlot(cmds: RawCmd[], slots: HistoriqueSlot[], getLabels: (c: RawCmd) => string[]): HistoPoint[] {
  return slots.map(slot => {
    const mCmds = cmds.filter(c => c.created_at >= slot.from && c.created_at < slot.to)
    let ca = 0, ventes = 0
    for (const c of mCmds) {
      const labels = getLabels(c)
      ca     += c.prix_paye * labels.length
      ventes += labels.length
    }
    return { label: slot.label, fullLabel: slot.fullLabel, ca, ventes }
  })
}

// Licence jointe uniquement — les commandes d'abonnement (licence_id null) sont
// exclues en amont par le filtre type_commande, cette vue ne parle que de ventes de licence
const licenceLabels = (c: RawCmd): string[] => {
  const l = Array.isArray(c.licences) ? c.licences[0] : c.licences
  const nom = (l as { nom: string } | null)?.nom
  return nom ? [nom] : []
}
const beatLabels = (key: string) => (c: RawCmd): string[] =>
  getArr(Array.isArray(c.beats) ? c.beats[0] : c.beats, key)

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { from, to, periode } = getPeriodDates(request)
  const admin = createAdminClient()

  const { data: allCommandes } = await admin.from('commandes')
    .select('prix_paye, created_at, licences(nom), beats(styles, ambiances, instruments, type_beat)')
    .eq('beatmaker_id', user.id)
    .eq('statut', 'payee')
    .or('type_commande.eq.LICENCE,type_commande.is.null')

  const all  = (allCommandes ?? []) as RawCmd[]
  const cmds = all.filter(c => inPeriod(c.created_at, from, to))

  const licences: PrefRow[]    = buildGroups(cmds.map(c => ({ labels: licenceLabels(c),          ca: c.prix_paye })))
  const styles: PrefRow[]      = buildGroups(cmds.map(c => ({ labels: beatLabels('styles')(c),      ca: c.prix_paye })))
  const ambiances: PrefRow[]   = buildGroups(cmds.map(c => ({ labels: beatLabels('ambiances')(c),    ca: c.prix_paye })))
  const instruments: PrefRow[] = buildGroups(cmds.map(c => ({ labels: beatLabels('instruments')(c),  ca: c.prix_paye })))
  const type_beat: PrefRow[]   = buildGroups(cmds.map(c => ({ labels: beatLabels('type_beat')(c),    ca: c.prix_paye })))

  const dataFrom = periode === 'tout' ? all.map(c => c.created_at).sort()[0] : undefined
  const slots = getHistoriqueSlots(periode, from, to, dataFrom)

  const historique = {
    licences:    sumBySlot(all, slots, licenceLabels),
    styles:      sumBySlot(all, slots, beatLabels('styles')),
    ambiances:   sumBySlot(all, slots, beatLabels('ambiances')),
    instruments: sumBySlot(all, slots, beatLabels('instruments')),
    type_beat:   sumBySlot(all, slots, beatLabels('type_beat')),
  }

  return NextResponse.json({ licences, styles, ambiances, instruments, type_beat, historique })
}
