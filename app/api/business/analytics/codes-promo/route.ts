import { createClient }      from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse }       from 'next/server'
import { getPeriodDates, inPeriod, getHistoriqueSlots } from '@/app/dashboard/business/analytics/_lib/periode'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { from, to, periode } = getPeriodDates(request)
  const admin = createAdminClient()

  const [{ data: codes }, { data: allCommandes }, { data: beatmaker }] = await Promise.all([
    admin.from('codes_promo')
      .select('id, code, description, type_remise, type_valeur, valeur, statut, created_at')
      .eq('beatmaker_id', user.id)
      .order('created_at', { ascending: false }),
    admin.from('commandes')
      .select('created_at, prix_paye, reduction_montant, code_promo')
      .eq('beatmaker_id', user.id)
      .eq('statut', 'payee')
      .not('code_promo', 'is', null),
    admin.from('beatmakers').select('tva_active, tva_taux').eq('id', user.id).single(),
  ])

  const promos = codes ?? []

  // CA net (HT) = brut − remises − TVA, cohérent avec les onglets Revenus/Overview/Ventes
  const tvaTaux = beatmaker?.tva_active ? (beatmaker.tva_taux ?? 20) : 0
  const tvaRate = tvaTaux / 100
  const netHt   = (brut: number, remises: number) => {
    const apresRemise = brut - remises
    return tvaRate > 0 ? apresRemise / (1 + tvaRate) : apresRemise
  }

  // Toutes les données de la page sont scopées à la période sélectionnée
  const cmds = (allCommandes ?? []).filter(c => inPeriod(c.created_at, from, to))

  // KPIs
  const utilisations  = cmds.length
  const remises_total = cmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
  const ca_brut       = cmds.reduce((s, c) => s + c.prix_paye, 0)
  const ca_net        = netHt(ca_brut, remises_total)
  const actifs        = promos.filter(c => c.statut === 'actif' && (!to || c.created_at <= to)).length

  // Table enrichie par code — masque les codes sans utilisation sur la période
  const codesEnrichis = promos
    .map(code => {
      const cmdsCode = cmds.filter(c => c.code_promo === code.code)
      const brut    = cmdsCode.reduce((s, c) => s + c.prix_paye, 0)
      const remises = cmdsCode.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
      return {
        id:           code.id,
        code:         code.code,
        description:  code.description ?? null,
        type_remise:  code.type_remise,
        type_valeur:  code.type_valeur,
        valeur:       code.valeur,
        utilisations: cmdsCode.length,
        remise_total: remises,
        ca_brut:      brut,
        ca_net:       netHt(brut, remises),
        statut:       code.statut,
      }
    })
    .filter(c => c.utilisations > 0)

  const dataFrom = periode === 'tout' ? cmds.map(c => c.created_at).sort()[0] : undefined
  const slots = getHistoriqueSlots(periode, from, to, dataFrom)
  const historique = slots.map(slot => {
    const mCmds  = cmds.filter(c => c.created_at >= slot.from && c.created_at < slot.to)
    const brut   = mCmds.reduce((s, c) => s + c.prix_paye, 0)
    const remises = mCmds.reduce((s, c) => s + (c.reduction_montant ?? 0), 0)
    return {
      label:        slot.label,
      fullLabel:    slot.fullLabel,
      utilisations: mCmds.length,
      remises,
      ca_brut:      brut,
      ca_net:       netHt(brut, remises),
      actifs:       promos.filter(p => p.statut === 'actif' && p.created_at <= slot.to).length,
    }
  })

  return NextResponse.json({
    kpis: { utilisations, remises_total, ca_brut, ca_net, actifs },
    historique,
    codes: codesEnrichis,
  })
}
