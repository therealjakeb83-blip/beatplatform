import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import { estAdmin } from '@/lib/admin'
import { createAdminClient } from '@/utils/supabase/admin'
import DecisionsClient from '@/app/dashboard/business/logs/decisions/_components/DecisionsClient'
import type { DecisionLogRow } from '@/app/dashboard/business/logs/decisions/page'

const PAGE_SIZE = 50

export default async function AdminBoutiqueDecisionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string; entity_type?: string }>
}) {
  if (!(await estAdmin())) redirect('/dashboard')

  const { id } = await params
  const { page: pageParam, entity_type } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1') || 1)

  const admin = createAdminClient()

  const { data: beatmaker } = await admin.from('beatmakers').select('id, nom_artiste, slug').eq('id', id).maybeSingle()
  if (!beatmaker) notFound()

  let requeteCount = admin.from('merchant_decisions_log').select('id', { count: 'exact', head: true }).eq('beatmaker_id', id)
  if (entity_type) requeteCount = requeteCount.eq('entity_type', entity_type)
  const { count: totalCount } = await requeteCount

  let requetePage = admin
    .from('merchant_decisions_log')
    .select('id, created_at, actor_type, entity_type, entity_id, action, motif, reference_version, details')
    .eq('beatmaker_id', id)
  if (entity_type) requetePage = requetePage.eq('entity_type', entity_type)

  const offset = (page - 1) * PAGE_SIZE
  const { data } = await requetePage
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE))

  const { data: licences } = await admin.from('licences').select('id, nom').eq('beatmaker_id', id)
  const licenceNoms = Object.fromEntries((licences ?? []).map(l => [l.id, l.nom]))

  return (
    <div>
      <div className="max-w-screen-xl mx-auto px-6 pt-6">
        <a href={`/dashboard/admin/boutiques/${id}`} className="text-xs text-gray-500 hover:text-gray-300">
          ← {beatmaker.nom_artiste}
        </a>
      </div>
      <DecisionsClient
        logs={(data ?? []) as DecisionLogRow[]}
        total={totalCount ?? 0}
        page={page}
        totalPages={totalPages}
        filtreEntite={entity_type ?? ''}
        permettreComparaison={false}
        licenceNoms={licenceNoms}
      />
    </div>
  )
}
