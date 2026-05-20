import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import IgnorerButton from './IgnorerButton'

function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

function sontSimilaires(nomA: string, nomB: string): boolean {
  const na = normaliser(nomA)
  const nb = normaliser(nomB)
  if (!na || !nb || na.length < 3 || nb.length < 3) return false
  if (na === nb) return true
  const wordsA = na.split(' ').filter(w => w.length > 2)
  const wordsB = new Set(nb.split(' ').filter(w => w.length > 2))
  if (wordsA.length === 0 || wordsB.size === 0) return false
  const communs = wordsA.filter(w => wordsB.has(w))
  return communs.length / Math.max(wordsA.length, wordsB.size) >= 0.6
}

export default async function DoublonsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [{ data: commandes }, { data: abonnements }] = await Promise.all([
    supabase.from('commandes').select('client_id').eq('beatmaker_id', user.id).not('client_id', 'is', null),
    supabase.from('abonnements_boutique').select('client_id').eq('beatmaker_id', user.id).not('client_id', 'is', null),
  ])

  const clientIds = [...new Set([
    ...(commandes ?? []).map(c => c.client_id as string),
    ...(abonnements ?? []).map(a => a.client_id as string),
  ])]

  if (clientIds.length < 2) {
    return (
      <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
        <div className="max-w-3xl mx-auto">
          <Link href="/dashboard/crm" className="text-sm text-gray-500 hover:text-gray-300 mb-6 block">← Mon CRM</Link>
          <h1 className="text-2xl font-bold mb-4">Détection de doublons</h1>
          <p className="text-gray-600">Pas assez de clients avec un compte pour détecter des doublons.</p>
        </div>
      </main>
    )
  }

  const [{ data: clients }, { data: ignoresRaw }] = await Promise.all([
    admin.from('clients').select('id, email, nom, prenom').in('id', clientIds),
    supabase.from('doublons_ignores').select('client_id_1, client_id_2').eq('beatmaker_id', user.id),
  ])

  const ignoresSet = new Set(
    (ignoresRaw ?? []).map(p => [p.client_id_1, p.client_id_2].sort().join('|'))
  )

  type ClientRow = { id: string; email: string; nom: string | null; prenom: string | null }
  const arr = (clients ?? []) as ClientRow[]

  const paires: { a: ClientRow; b: ClientRow }[] = []
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j]
      if (ignoresSet.has([a.id, b.id].sort().join('|'))) continue
      const nomA = `${a.prenom ?? ''} ${a.nom ?? ''}`.trim()
      const nomB = `${b.prenom ?? ''} ${b.nom ?? ''}`.trim()
      if (sontSimilaires(nomA, nomB)) paires.push({ a, b })
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/dashboard/crm" className="text-sm text-gray-500 hover:text-gray-300 mb-6 block">← Mon CRM</Link>

        <h1 className="text-2xl font-bold mb-2">Détection de doublons</h1>
        <p className="text-gray-500 text-sm mb-8">
          {paires.length === 0
            ? 'Aucun doublon détecté — tes clients sont tous distincts.'
            : `${paires.length} doublon${paires.length > 1 ? 's' : ''} potentiel${paires.length > 1 ? 's' : ''} détecté${paires.length > 1 ? 's' : ''}.`}
        </p>

        {paires.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-4xl mb-4">✓</p>
            <p className="text-gray-400">Aucune entrée suspecte trouvée.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {paires.map(({ a, b }) => {
              const nomA = `${a.prenom ?? ''} ${a.nom ?? ''}`.trim() || a.email
              const nomB = `${b.prenom ?? ''} ${b.nom ?? ''}`.trim() || b.email
              return (
                <div key={`${a.id}-${b.id}`} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex-1 p-3 bg-gray-800 rounded-xl">
                      <p className="font-semibold text-white text-sm">{nomA}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{a.email}</p>
                    </div>
                    <div className="text-gray-600 font-bold pt-3">≈</div>
                    <div className="flex-1 p-3 bg-gray-800 rounded-xl">
                      <p className="font-semibold text-white text-sm">{nomB}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{b.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-600">Noms similaires détectés — même personne ?</p>
                    <div className="flex gap-2">
                      <Link
                        href={`/dashboard/crm/${a.id}`}
                        className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                      >
                        Voir fiche A
                      </Link>
                      <Link
                        href={`/dashboard/crm/${b.id}`}
                        className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                      >
                        Voir fiche B
                      </Link>
                      <IgnorerButton id1={a.id} id2={b.id} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
