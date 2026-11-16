import { createAdminClient } from '@/utils/supabase/admin'

// 9d lot 4 (décision de Jake) : l'IP des téléchargements d'un contact effacé
// est gardée 120 jours après l'achat (preuve en cas de contestation bancaire),
// puis effacée ici, chaque nuit.
export async function effacerIpEchues(): Promise<{ effacees: number }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('licence_downloads')
    .update({ ip_address: null, ip_effacer_apres: null })
    .lte('ip_effacer_apres', new Date().toISOString())
    .select('id')
  if (error) {
    console.error('[ip-echues]', JSON.stringify(error))
    return { effacees: 0 }
  }
  return { effacees: data?.length ?? 0 }
}
