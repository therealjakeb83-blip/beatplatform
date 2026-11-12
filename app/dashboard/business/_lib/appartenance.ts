import type { SupabaseClient } from '@supabase/supabase-js'

// Garde de confidentialité entre boutiques (rang 9d, lot 0) : une boutique ne
// voit et ne modifie QUE les clients liés à elle — inscrit/connecté/importé
// (leads), acheteur (commandes) ou abonné (abonnements_boutique). Le client
// Supabase passé est celui du beatmaker connecté ; beatmaker_id est filtré
// explicitement en plus des règles RLS.
export async function clientsLiesABoutique(
  supabase: SupabaseClient,
  beatmakerId: string,
  clientIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(clientIds.filter(id => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)))]
  const lies = new Set<string>()
  for (let i = 0; i < ids.length; i += 200) {
    const lot = ids.slice(i, i + 200)
    const [leads, commandes, abos] = await Promise.all([
      supabase.from('leads').select('client_id').eq('beatmaker_id', beatmakerId).in('client_id', lot),
      supabase.from('commandes').select('client_id').eq('beatmaker_id', beatmakerId).in('client_id', lot),
      supabase.from('abonnements_boutique').select('client_id').eq('beatmaker_id', beatmakerId).in('client_id', lot),
    ])
    if (leads.error || commandes.error || abos.error) {
      console.error('[appartenance] lecture impossible', JSON.stringify(leads.error ?? commandes.error ?? abos.error))
      throw new Error('Vérification des contacts impossible')
    }
    for (const r of [...(leads.data ?? []), ...(commandes.data ?? []), ...(abos.data ?? [])]) {
      if (r.client_id) lies.add(r.client_id as string)
    }
  }
  return lies
}

export async function clientLieABoutique(supabase: SupabaseClient, beatmakerId: string, clientId: string): Promise<boolean> {
  return (await clientsLiesABoutique(supabase, beatmakerId, [clientId])).has(clientId)
}
