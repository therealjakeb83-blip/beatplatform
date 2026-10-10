import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { RECETTES } from './_lib/recettes'

export default async function AutomatisationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data } = await supabase
    .from('automatisations')
    .select('type, actif')
    .eq('beatmaker_id', user.id)

  const typesRecettes = new Set(RECETTES.map(r => r.type))
  const nbActives = (data ?? []).filter(a => a.actif && typesRecettes.has(a.type)).length

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
        <h1 className="text-xl font-bold text-white">Automatisations</h1>

        <div className="space-y-3">
          <Link
            href="/dashboard/business/marketing/automatisations/mailing"
            className="flex items-center gap-3 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl px-5 py-4 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Mailing</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {RECETTES.length} recettes
                {nbActives > 0 && ` · ${nbActives} active${nbActives > 1 ? 's' : ''}`}
                {' '}— emails envoyés automatiquement selon l&apos;activité de tes clients
              </p>
            </div>
            <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <div className="flex items-center gap-3 bg-gray-900/50 border border-dashed border-gray-800 rounded-2xl px-5 py-4 opacity-70 cursor-default">
            <svg className="w-5 h-5 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-300">
                Import de commandes
                <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 align-middle">Bientôt</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Tes nouvelles ventes faites sur d’autres plateformes (BeatStars…) arriveront toutes seules et pourront déclencher
                tes automatisations (remerciement après achat…). Pour l’instant, les commandes importées par CSV ne déclenchent aucun email.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
