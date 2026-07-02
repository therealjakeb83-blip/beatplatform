import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { evaluerFiltres, couleurCls, type Condition } from '../../_lib/segments'
import { chargerContactsEnrichis, nomAffichage, type ContactEnrichi } from '../../_lib/contacts'

export default async function SegmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: segmentId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')
  const beatmakerId = user.id

  const { data: segment } = await supabase
    .from('segments_crm')
    .select('id, nom, description, couleur, filtres')
    .eq('id', segmentId)
    .eq('beatmaker_id', beatmakerId)
    .single()

  if (!segment) notFound()

  const filtres = segment.filtres as Condition[]

  const { contacts: tousLesContacts } = await chargerContactsEnrichis(beatmakerId)

  if (tousLesContacts.length === 0) {
    return <EmptyState segment={segment} />
  }

  const contacts: ContactEnrichi[] = tousLesContacts
    .filter(c => evaluerFiltres(c, filtres))
    .sort((a, b) => b.ltv - a.ltv)

  const fmt        = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  const fmtDateRel = (iso: string | null) => {
    if (!iso) return '–'
    const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (j === 0) return "Aujourd'hui"
    if (j < 7)   return `Il y a ${j}j`
    if (j < 30)  return `Il y a ${Math.floor(j / 7)} sem`
    if (j < 365) return `Il y a ${Math.floor(j / 30)} mois`
    return `Il y a ${Math.floor(j / 365)} an${Math.floor(j / 365) > 1 ? 's' : ''}`
  }

  const badgeCls = couleurCls(segment.couleur)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <Link href="/dashboard/business/segments" className="hover:text-white transition-colors">
            Segments
          </Link>
          <span className="text-gray-700">›</span>
          <span className="text-white">{segment.nom}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white">{segment.nom}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {segment.description && <span>{segment.description} · </span>}
              <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${badgeCls}`}>
                {contacts.length} contact{contacts.length > 1 ? 's' : ''}
              </span>
            </p>
          </div>
          <Link
            href={`/dashboard/business/marketing/campagnes?segment=${segment.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold text-white transition-colors"
          >
            ✉ Lancer une campagne
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {contacts.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-600 text-sm">
            Aucun contact ne correspond à ce segment pour l&apos;instant.
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">NWT</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Style</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dernier achat</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">LTV</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => {
                const prenomAffiche = nomAffichage(c)
                return (
                <tr
                  key={c.id}
                  className={`border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors ${i % 2 !== 0 ? 'bg-gray-950/40' : ''}`}
                >
                  <td className="px-4 py-3 text-center">
                    {c.newsletter_consent
                      ? <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                      : <span className="text-gray-700 text-xs">–</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/business/contacts/${c.id}`} className="flex items-center gap-3 group">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
                        {c.pays ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`https://flagcdn.com/w40/${c.pays.toLowerCase()}.png`} alt={c.pays} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-indigo-300 font-bold text-xs">
                            {[prenomAffiche?.[0], c.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors text-xs block">
                          {[prenomAffiche, c.nom].filter(Boolean).join(' ') || '–'}
                        </span>
                        <span className="text-xs text-gray-500">{c.email}</span>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {c.statut === 'abonne' && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Abonné</span>}
                    {c.statut === 'ancien' && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">Ancien</span>}
                    {c.statut === 'client' && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">Client</span>}
                    {c.statut === 'lead'   && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">Lead</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {[c.pref_style, c.pref_type_beat].filter(Boolean).join(' · ') || <span className="text-gray-700">–</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
                    {fmtDateRel(c.dernier_achat_iso)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-white text-xs whitespace-nowrap">
                    {fmt(c.ltv)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Link href={`/dashboard/business/contacts/${c.id}`} className="text-gray-600 hover:text-indigo-400 transition-colors">→</Link>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function EmptyState({ segment }: { segment: { nom: string; description: string | null } }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <Link href="/dashboard/business/segments" className="hover:text-white transition-colors">Segments</Link>
          <span className="text-gray-700">›</span>
          <span className="text-white">{segment.nom}</span>
        </div>
        <h1 className="text-base font-bold text-white">{segment.nom}</h1>
      </div>
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Aucun contact pour l&apos;instant.
      </div>
    </div>
  )
}
