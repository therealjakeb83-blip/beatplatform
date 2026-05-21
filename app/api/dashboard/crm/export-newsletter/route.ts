import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'

const PAYS_FR = new Set(['FR', 'BE', 'CH', 'RE', 'GP', 'MQ', 'GF', 'QC'])

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  // Récupérer tous les client_id liés à ce beatmaker
  const [{ data: commandes }, { data: abonnements }] = await Promise.all([
    admin.from('commandes').select('client_id').eq('beatmaker_id', user.id).not('client_id', 'is', null),
    admin.from('abonnements_boutique').select('client_id').eq('beatmaker_id', user.id).not('client_id', 'is', null),
  ])

  const clientIds = [...new Set([
    ...(commandes ?? []).map(c => c.client_id as string),
    ...(abonnements ?? []).map(a => a.client_id as string),
  ])]

  if (clientIds.length === 0) {
    return new NextResponse('email,prenom,nom,langue\n', {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="newsletter.csv"',
      },
    })
  }

  const { data: clients } = await admin
    .from('clients')
    .select('email, prenom, nom, pays')
    .in('id', clientIds)
    .eq('newsletter_consent', true)

  const lignes = (clients ?? []).map(c => {
    const langue = c.pays && PAYS_FR.has((c.pays as string).toUpperCase()) ? 'FR' : 'US'
    const prenom = (c.prenom ?? '').replace(/"/g, '""')
    const nom = (c.nom ?? '').replace(/"/g, '""')
    return `"${c.email}","${prenom}","${nom}","${langue}"`
  })

  const csv = ['email,prenom,nom,langue', ...lignes].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="newsletter.csv"',
    },
  })
}
