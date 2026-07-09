import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { calculerEcheance, LABELS_AUTOMATISATION, type TypeAutomatisation } from '@/lib/automatisations'
import { RECETTES, ORDRE_CATEGORIES, slugCategorie } from './_lib/recettes'
import type { AutomatisationRow, EvenementFileAttente } from './_lib/types'
import { executerMaintenant, previsualiser, supprimerEvenement } from './_lib/actions'
import FileAttenteTable from './_components/FileAttenteTable'

export default async function AutomatisationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data } = await supabase
    .from('automatisations')
    .select('id, type, actif, objet, corps, delai_heures, heure_cible_minutes')
    .eq('beatmaker_id', user.id)

  const automatisations = (data ?? []) as AutomatisationRow[]

  const admin = createAdminClient()
  const { data: evenementsRaw } = await admin
    .from('automatisation_evenements')
    .select('id, type, created_at, clients(prenom, nom, email)')
    .eq('beatmaker_id', user.id)
    .eq('traite', false)
    .order('created_at', { ascending: false })

  type EvenementRaw = {
    id: string
    type: TypeAutomatisation
    created_at: string
    clients: { prenom: string | null; nom: string; email: string } | null
  }

  const fileAttente: EvenementFileAttente[] = ((evenementsRaw ?? []) as unknown as EvenementRaw[]).map(e => {
    const config = automatisations.find(a => a.type === e.type)
    const echeance = config?.actif
      ? calculerEcheance(e.created_at, config.delai_heures, config.heure_cible_minutes)
      : null
    return {
      id: e.id,
      flux: LABELS_AUTOMATISATION[e.type] ?? e.type,
      clientNom: [e.clients?.prenom, e.clients?.nom].filter(Boolean).join(' ') || '—',
      clientEmail: e.clients?.email ?? '—',
      echeanceISO: echeance ? echeance.toISOString() : null,
    }
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Automatisations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Emails envoyés automatiquement selon l&apos;activité de tes clients — jamais à l&apos;heure exacte de l&apos;événement.
          </p>
        </div>

        <div className="space-y-3">
          {ORDRE_CATEGORIES.map(categorie => {
            const recettesCategorie = RECETTES.filter(r => r.categorie === categorie)
            if (recettesCategorie.length === 0) return null
            const nbActives = recettesCategorie.filter(r => automatisations.find(a => a.type === r.type)?.actif).length

            return (
              <Link
                key={categorie}
                href={`/dashboard/business/marketing/automatisations/${slugCategorie(categorie)}`}
                className="flex items-center gap-3 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl px-5 py-4 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{categorie}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {recettesCategorie.length} recette{recettesCategorie.length > 1 ? 's' : ''}
                    {nbActives > 0 && ` · ${nbActives} active${nbActives > 1 ? 's' : ''}`}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )
          })}
        </div>

        <FileAttenteTable
          fileAttente={fileAttente}
          executerMaintenant={executerMaintenant}
          previsualiser={previsualiser}
          supprimerEvenement={supprimerEvenement}
        />
      </div>
    </div>
  )
}
