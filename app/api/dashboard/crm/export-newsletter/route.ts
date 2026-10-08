import { createClient } from '@/utils/supabase/server'
import { chargerContactsEnrichis } from '@/app/dashboard/business/_lib/contacts'
import { peutRecevoirCampagne } from '@/lib/newsletter-statut'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'

const PAYS_FR = new Set(['FR', 'BE', 'CH', 'RE', 'GP', 'MQ', 'GF', 'QC'])

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  // Inscrits à la newsletter de CETTE boutique — exactement le public des campagnes
  const { contacts } = await chargerContactsEnrichis(user.id)
  const clients = contacts.filter(c => peutRecevoirCampagne(c.newsletter_statut))

  const lignes = clients.map(c => {
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
