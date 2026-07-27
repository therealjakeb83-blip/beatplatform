import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'
import RenvoyerButton from './_components/RenvoyerButton'
import { renvoyerEmailAction } from './_lib/actions'

const TYPE_LABELS: Record<string, string> = {
  transactionnel: 'Transactionnel',
  automatisation: 'Automatisation',
}

export default async function AdminMailsPage({ searchParams }: { searchParams: Promise<{ filtre?: string; type?: string }> }) {
  const { filtre, type } = await searchParams
  const admin = createAdminClient()

  let query = admin
    .from('email_logs')
    .select('id, destinataire, sujet, type, evenement, statut, erreur, created_at, beatmakers(nom_artiste, slug)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (filtre !== 'tous') query = query.eq('statut', 'echoue')
  if (type === 'transactionnel' || type === 'automatisation') query = query.eq('type', type)

  const { data: logs } = await query

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Mails transactionnels</h1>
        <p className="text-sm text-gray-500 mt-0.5">Échecs d&apos;envoi toutes boutiques confondues, avec renvoi manuel — pas un log exhaustif de tout ce qui part (voir Marketing/Campagnes côté boutique pour ça).</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={{ pathname: '/dashboard/admin/mails', query: { ...(type ? { type } : {}) } }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtre !== 'tous' ? 'bg-red-600 text-white' : 'bg-gray-900 border border-gray-800 text-red-400 hover:text-red-300 hover:border-gray-700'}`}
        >
          Échecs uniquement
        </Link>
        <Link
          href={{ pathname: '/dashboard/admin/mails', query: { filtre: 'tous', ...(type ? { type } : {}) } }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtre === 'tous' ? 'bg-indigo-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'}`}
        >
          Tous
        </Link>
        <div className="w-px bg-gray-800 mx-1" />
        {(['transactionnel', 'automatisation'] as const).map(t => (
          <Link
            key={t}
            href={{ pathname: '/dashboard/admin/mails', query: { ...(filtre ? { filtre } : {}), type: type === t ? undefined : t } }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${type === t ? 'bg-gray-700 text-white' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'}`}
          >
            {TYPE_LABELS[t]}
          </Link>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
        {(!logs || logs.length === 0) && <p className="px-4 py-6 text-sm text-gray-600 text-center">Aucun email.</p>}
        {logs?.map(log => {
          const boutique = Array.isArray(log.beatmakers) ? log.beatmakers[0] : log.beatmakers
          return (
            <div key={log.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-white">{log.sujet}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded border ${log.statut === 'echoue' ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'}`}>
                    {log.statut}
                  </span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded border bg-gray-800/50 text-gray-400 border-gray-700/50">
                    {TYPE_LABELS[log.type] ?? log.type}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {boutique ? `${boutique.nom_artiste} (${boutique.slug})` : 'Boutique inconnue'} → {log.destinataire}
                </p>
                <p className="text-[11px] text-gray-600">{new Date(log.created_at).toLocaleString('fr-FR')} — {log.evenement}</p>
                {log.erreur && <p className="text-xs text-red-400 mt-1 break-words">{log.erreur}</p>}
              </div>
              {log.statut === 'echoue' && (
                <div className="shrink-0">
                  <RenvoyerButton logId={log.id} action={renvoyerEmailAction} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
