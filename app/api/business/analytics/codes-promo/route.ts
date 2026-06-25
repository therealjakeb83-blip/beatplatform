import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { inPeriod, getLast12Months } from '@/app/dashboard/business/analytics/_lib/periode'

export const runtime = 'nodejs'

export async function GET(_request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const [{ data: codes }, { data: allCommandes }] = await Promise.all([
    admin.from('codes_promo')
      .select('id, code, description, type_valeur, valeur, utilisations, statut, created_at')
      .eq('beatmaker_id', user.id)
      .order('created_at', { ascending: false }),
    admin.from('commandes')
      .select('created_at, prix_paye, reduction_montant, code_promo')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'payee')
      .not('code_promo', 'is', null),
  ])

  const promos = codes ?? []
  const cmds   = allCommandes ?? []

  // KPIs
  const utilisations  = promos.reduce((s, c) => s + (c.utilisations ?? 0), 0)
  const remises_total = cmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
  const ca_genere     = cmds.reduce((s, c) => s + c.prix_paye, 0)
  const actifs        = promos.filter(c => c.statut === 'actif').length

  // Table enrichie par code
  const codesEnrichis = promos.map(code => {
    const cmdsCode = cmds.filter(c => c.code_promo === code.code)
    return {
      id:          code.id,
      code:        code.code,
      description: code.description ?? null,
      type_valeur: code.type_valeur,
      valeur:      code.valeur,
      utilisations: code.utilisations ?? 0,
      remise_total: cmdsCode.reduce((s, c) => s + (c.reduction_montant ?? 0), 0),
      ca_genere:    cmdsCode.reduce((s, c) => s + c.prix_paye, 0),
      statut:       code.statut,
    }
  })

  // Historique 12 mois (aggregé sur toutes les commandes avec promo)
  const mois12 = getLast12Months()
  const historique = mois12.map(({ year, month, label, fullLabel }) => {
    const start = new Date(year, month, 1).toISOString()
    const end   = new Date(year, month + 1, 1).toISOString()
    const mCmds = cmds.filter(c => c.created_at >= start && c.created_at < end)
    return {
      label,
      fullLabel,
      utilisations: mCmds.length,
      remises:      mCmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0),
      ca:           mCmds.reduce((s, c) => s + c.prix_paye, 0),
      actifs:       promos.filter(p => p.statut === 'actif' && p.created_at <= end).length,
    }
  })

  return NextResponse.json({
    kpis: { utilisations, remises_total, ca_genere, actifs },
    historique,
    codes: codesEnrichis,
  })
}
