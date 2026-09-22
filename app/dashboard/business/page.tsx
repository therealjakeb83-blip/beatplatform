import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { estRoleAdmin } from '@/lib/admin'
import { calculerPretAVendre, type ResultatPretAVendre } from '@/lib/pret-a-vendre'
import PanneauPretAVendre from './_components/PanneauPretAVendre'

export default async function BusinessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('role, abonnement_exempte')
    .eq('id', user.id)
    .single()

  // Même exemption que le garde-fou serveur du checkout (Q7b) — ne jamais
  // afficher un panneau « il te manque X » à un compte de test/admin dont
  // les ventes ne sont de toute façon jamais bloquées.
  const exempte = estRoleAdmin(beatmaker?.role) || !!beatmaker?.abonnement_exempte
  const admin = createAdminClient()
  const resultat: ResultatPretAVendre | null = exempte
    ? null
    : await calculerPretAVendre(admin, user.id, { estConcedant: true })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Vue d&apos;ensemble</h1>
      {resultat && <PanneauPretAVendre resultat={resultat} />}
      <p className="text-gray-400">Phase 1 — CRM à venir.</p>
    </div>
  )
}
