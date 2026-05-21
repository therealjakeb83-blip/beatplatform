import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const PAYS_FR = new Set(['FR', 'BE', 'CH', 'RE', 'GP', 'MQ', 'GF', 'QC'])

function getLangue(pays: string | null | undefined): 'FR' | 'US' {
  return pays && PAYS_FR.has(pays.toUpperCase()) ? 'FR' : 'US'
}

type Commande = {
  id: string
  created_at: string
  prix_paye: number
  statut: string
  plateforme_source: string | null
  beats: {
    titre: string
    image_url: string | null
    styles: string[] | null
    type_beat: string[] | null
    ambiances: string[] | null
    instruments: string[] | null
  } | null
  licences: { nom: string } | null
}

type BeatPrefs = {
  styles: string[] | null
  type_beat: string[] | null
  ambiances: string[] | null
  instruments: string[] | null
} | null

function topN(counts: Map<string, number>, n: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([v]) => v)
}

function accumPrefs(
  counts: { styles: Map<string, number>; typeBeat: Map<string, number>; ambiances: Map<string, number>; instruments: Map<string, number> },
  beat: BeatPrefs,
  weight: number
) {
  if (!beat) return
  for (const s of beat.styles ?? []) counts.styles.set(s, (counts.styles.get(s) ?? 0) + weight)
  for (const t of beat.type_beat ?? []) counts.typeBeat.set(t, (counts.typeBeat.get(t) ?? 0) + weight)
  for (const a of beat.ambiances ?? []) counts.ambiances.set(a, (counts.ambiances.get(a) ?? 0) + weight)
  for (const i of beat.instruments ?? []) counts.instruments.set(i, (counts.instruments.get(i) ?? 0) + weight)
}

export default async function FicheClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: client } = await admin
    .from('clients')
    .select('id, email, nom, prenom, created_at, pays')
    .eq('id', clientId)
    .single()

  if (!client) redirect('/dashboard/crm')

  const [{ data: commandesRaw }, { data: abonnement }, { data: favorisRaw }] = await Promise.all([
    supabase
      .from('commandes')
      .select(`
        id, created_at, prix_paye, statut, plateforme_source,
        beats(titre, image_url, styles, type_beat, ambiances, instruments),
        licences(nom)
      `)
      .eq('beatmaker_id', user.id)
      .or(`client_id.eq.${clientId},acheteur_email.eq.${client.email}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('abonnements_boutique')
      .select('statut, date_debut, date_fin, en_essai, plan, prix, mois_consecutifs')
      .eq('beatmaker_id', user.id)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('favoris')
      .select('beat_id, beats(styles, type_beat, ambiances, instruments)')
      .eq('client_id', clientId),
  ])

  const commandes = (commandesRaw ?? []) as unknown as Commande[]
  const favoris = (favorisRaw ?? []) as unknown as Array<{ beat_id: string; beats: BeatPrefs }>

  const payees = commandes.filter(c => c.statut === 'payee')
  const nbAchats = payees.length
  const ltv = payees.reduce((s, c) => s + c.prix_paye, 0)

  const statut_abo: 'abonne' | 'ancien' | 'jamais' = !abonnement
    ? 'jamais'
    : abonnement.statut === 'actif'
    ? 'abonne'
    : 'ancien'

  // Mois réglés depuis date_debut (approximatif — Sprint 2 ajoutera mensualites_payees)
  const moisRegles = (abonnement && !abonnement.en_essai && abonnement.date_debut)
    ? Math.max(1, Math.round((Date.now() - new Date(abonnement.date_debut).getTime()) / (30.44 * 86400000)))
    : 0

  // Préférences musicales : achats poids×2, favoris poids×1
  const prefCounts = {
    styles: new Map<string, number>(),
    typeBeat: new Map<string, number>(),
    ambiances: new Map<string, number>(),
    instruments: new Map<string, number>(),
  }
  for (const c of payees) accumPrefs(prefCounts, c.beats, 2)
  for (const f of favoris) accumPrefs(prefCounts, f.beats, 1)

  const prefs = {
    stylePrefere: topN(prefCounts.styles, 1)[0] ?? null,
    typeBeatPrefere: topN(prefCounts.typeBeat, 1)[0] ?? null,
    topStyles: topN(prefCounts.styles, 5),
    topAmbiances: topN(prefCounts.ambiances, 5),
    topInstruments: topN(prefCounts.instruments, 5),
  }
  const hasPrefs = prefs.topStyles.length > 0 || prefs.topAmbiances.length > 0 || prefs.topInstruments.length > 0

  const nomComplet = `${client.prenom ?? ''} ${client.nom ?? ''}`.trim()
  const initiales = [client.prenom?.[0], client.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const langue = getLangue(client.pays)

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/dashboard/crm" className="text-sm text-gray-500 hover:text-gray-300 mb-6 block">
          ← Mon CRM
        </Link>

        {/* En-tête client */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-indigo-900/60 flex items-center justify-center text-indigo-300 font-bold text-xl flex-shrink-0">
              {initiales}
            </div>
            <div>
              <h1 className="text-xl font-bold">{nomComplet || client.email}</h1>
              <p className="text-gray-400 text-sm">{client.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {client.pays && (
                  <span className="text-gray-600 text-xs">{client.pays} · {langue}</span>
                )}
                {statut_abo === 'abonne' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">Abonné</span>
                )}
                {statut_abo === 'ancien' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">Ancien abonné</span>
                )}
                {statut_abo === 'jamais' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 font-medium">Jamais abonné</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-800">
            <div>
              <p className="text-gray-500 text-xs mb-1">Achats</p>
              <p className="text-2xl font-black">{nbAchats}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">LTV</p>
              <p className="text-2xl font-black">{ltv.toLocaleString('fr-FR')} €</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Abonnement</p>
              {abonnement?.statut === 'actif' ? (
                <p className="text-green-400 font-bold">Actif</p>
              ) : (
                <p className="text-gray-600">—</p>
              )}
            </div>
          </div>

          <p className="text-gray-600 text-xs mt-4">
            Client depuis le {new Date(client.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit', month: 'long', year: 'numeric',
            })}
          </p>
        </div>

        {/* Abonnement */}
        {abonnement && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
            <h2 className="font-bold text-white mb-3">Abonnement</h2>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-white capitalize">Plan {abonnement.plan}</p>
                <p className="text-xs text-gray-500">
                  Depuis le {new Date(abonnement.date_debut).toLocaleDateString('fr-FR')}
                  {abonnement.en_essai && ' · Essai gratuit'}
                  {abonnement.prix > 0 && ` · ${(abonnement.prix / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €/mois`}
                </p>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                abonnement.statut === 'actif' ? 'bg-green-500/20 text-green-400'
                : abonnement.statut === 'annule' ? 'bg-gray-700 text-gray-400'
                : 'bg-red-500/20 text-red-400'
              }`}>
                {abonnement.statut === 'actif' ? 'Actif'
                  : abonnement.statut === 'annule' ? 'Annulé'
                  : 'Impayé'}
              </span>
            </div>
            {moisRegles > 0 && (
              <div className="pt-3 border-t border-gray-800">
                <p className="text-xs text-gray-500">
                  <span className="text-white font-medium">{moisRegles} mois</span> réglés
                  <span className="text-gray-700 ml-1">(approx.)</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Préférences musicales */}
        {hasPrefs && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
            <h2 className="font-bold text-white mb-4">Préférences musicales</h2>

            {(prefs.stylePrefere || prefs.typeBeatPrefere) && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                {prefs.stylePrefere && (
                  <div>
                    <p className="text-gray-500 text-xs mb-2">Style</p>
                    <span className="text-sm px-3 py-1.5 rounded-lg bg-indigo-900/40 text-indigo-300 font-medium">
                      {prefs.stylePrefere}
                    </span>
                  </div>
                )}
                {prefs.typeBeatPrefere && (
                  <div>
                    <p className="text-gray-500 text-xs mb-2">Type beat</p>
                    <span className="text-sm px-3 py-1.5 rounded-lg bg-purple-900/40 text-purple-300 font-medium">
                      {prefs.typeBeatPrefere}
                    </span>
                  </div>
                )}
              </div>
            )}

            {prefs.topStyles.length > 1 && (
              <div className="mb-3">
                <p className="text-gray-500 text-xs mb-1.5">Tous les styles</p>
                <div className="flex flex-wrap gap-1.5">
                  {prefs.topStyles.map(s => (
                    <span key={s} className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {prefs.topAmbiances.length > 0 && (
              <div className="mb-3">
                <p className="text-gray-500 text-xs mb-1.5">Ambiances</p>
                <div className="flex flex-wrap gap-1.5">
                  {prefs.topAmbiances.map(a => (
                    <span key={a} className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {prefs.topInstruments.length > 0 && (
              <div>
                <p className="text-gray-500 text-xs mb-1.5">Instruments</p>
                <div className="flex flex-wrap gap-1.5">
                  {prefs.topInstruments.map(inst => (
                    <span key={inst} className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400">{inst}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Historique achats */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-bold text-white mb-4">
            Historique <span className="text-gray-500 font-normal">({commandes.length})</span>
          </h2>

          {commandes.length === 0 ? (
            <p className="text-gray-600 text-sm">Aucun achat pour l&apos;instant.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {commandes.map(c => {
                const isBs = c.plateforme_source === 'beatstars'
                const titre = c.beats?.titre ?? (isBs ? 'Import BeatStars' : 'Beat supprimé')
                const licence = c.licences?.nom ?? (isBs ? '—' : 'Licence inconnue')
                return (
                  <div key={c.id} className="flex items-center gap-3 py-3 border-b border-gray-800 last:border-0">
                    {c.beats?.image_url ? (
                      <img src={c.beats.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center text-gray-600 text-xs font-bold">
                        {isBs ? 'BS' : '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm truncate">{titre}</p>
                      <p className="text-xs text-gray-500">
                        {licence} · {new Date(c.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-white">{c.prix_paye} €</p>
                      {isBs && <p className="text-xs text-orange-400">BeatStars</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
