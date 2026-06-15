import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import FusionWizard from './_components/FusionWizard'
import type { RaisonData } from '../_components/DoublonsView'

export default async function FusionnerPage({
  searchParams,
}: {
  searchParams: Promise<{ conserve?: string; archive?: string; raisons?: string }>
}) {
  const { conserve: id_conserve, archive: id_archive, raisons: raisonsParam } = await searchParams

  if (!id_conserve || !id_archive) redirect('/dashboard/business/doublons')

  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const beatmakerId = user.id

  // Vérifier que les deux contacts appartiennent à ce beatmaker
  const allIdsRes = await Promise.all([
    supabase.from('commandes').select('client_id').eq('beatmaker_id', beatmakerId).in('client_id', [id_conserve, id_archive]),
    supabase.from('abonnements_boutique').select('client_id').eq('beatmaker_id', beatmakerId).in('client_id', [id_conserve, id_archive]),
    supabase.from('leads').select('client_id').eq('beatmaker_id', beatmakerId).in('client_id', [id_conserve, id_archive]),
  ])

  const knownIds = new Set([
    ...(allIdsRes[0].data ?? []).map(r => r.client_id as string),
    ...(allIdsRes[1].data ?? []).map(r => r.client_id as string),
    ...(allIdsRes[2].data ?? []).map(r => r.client_id as string),
  ])

  if (!knownIds.has(id_conserve) || !knownIds.has(id_archive)) notFound()

  // Charger les données des deux clients
  const [clientsRes, commandesRes] = await Promise.all([
    admin.from('clients')
      .select('id, prenom, nom, email, pays, telephone, instagram, spotify, youtube, tiktok, notes, nom_artiste')
      .in('id', [id_conserve, id_archive]),
    supabase.from('commandes')
      .select('client_id, prix_paye, statut, type_commande')
      .eq('beatmaker_id', beatmakerId)
      .in('client_id', [id_conserve, id_archive]),
  ])

  const clients = clientsRes.data ?? []
  const commandes = commandesRes.data ?? []

  const raw_conserve = clients.find(c => c.id === id_conserve)
  const raw_archive  = clients.find(c => c.id === id_archive)

  if (!raw_conserve || !raw_archive) notFound()

  // Calcul LTV + achats par client
  const ltvMap    = new Map<string, number>()
  const achatsMap = new Map<string, number>()
  for (const cmd of commandes) {
    const id = cmd.client_id as string
    if (cmd.statut === 'payee') ltvMap.set(id, (ltvMap.get(id) ?? 0) + (cmd.prix_paye ?? 0))
    if (cmd.type_commande === 'LICENCE') achatsMap.set(id, (achatsMap.get(id) ?? 0) + 1)
  }

  function enrichir(c: NonNullable<typeof raw_conserve>) {
    return {
      ...c,
      ltv:       ltvMap.get(c.id) ?? 0,
      nb_achats: achatsMap.get(c.id) ?? 0,
    }
  }

  const conserve = enrichir(raw_conserve)
  const archive  = enrichir(raw_archive)

  let raisons: RaisonData[] = []
  try { raisons = raisonsParam ? JSON.parse(decodeURIComponent(raisonsParam)) : [] } catch {}

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">

      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
        <Link href="/dashboard/business/doublons" className="hover:text-white transition-colors">
          Doublons
        </Link>
        <span className="text-gray-700">›</span>
        <span className="text-white">Fusion</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">Fusionner deux contacts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Le contact conservé (LTV la plus haute) reste visible dans le CRM. Le contact archivé disparaît de la liste mais ses données sont intégrées.
        </p>
      </div>

      <FusionWizard conserve={conserve} archive={archive} raisons={raisons} />

    </div>
  )
}
