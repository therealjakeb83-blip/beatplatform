import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

type Commande = {
  id: string
  created_at: string
  prix_paye: number
  statut: string
  type_commande: string | null
  plateforme_source: string | null
  acheteur_nom: string | null
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

// --- RFM ---

type Segment = 'champion' | 'fidele' | 'potentiel' | 'a_risque' | 'dormant' | 'a_reactiver' | 'nouveau' | 'lead'

const SEGMENT_CONFIG: Record<Segment, { label: string; color: string; desc: string }> = {
  champion:    { label: 'Champion',    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', desc: 'Client très actif, acheteur régulier et haute valeur' },
  fidele:      { label: 'Fidèle',      color: 'bg-green-500/20 text-green-400 border-green-500/30',   desc: 'Achète régulièrement, bon niveau d\'engagement' },
  potentiel:   { label: 'Potentiel',   color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',      desc: 'Nouvel acheteur à fort potentiel, à fidéliser' },
  a_risque:    { label: 'À risque',    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', desc: 'Bon client qui n\'achète plus depuis un moment' },
  dormant:     { label: 'Dormant',     color: 'bg-gray-600/30 text-gray-500 border-gray-600/30',      desc: 'Inactif depuis plusieurs mois' },
  a_reactiver: { label: 'À réactiver', color: 'bg-red-500/20 text-red-400 border-red-500/30',         desc: 'Ancien abonné ayant résilié — à reconquérir' },
  nouveau:     { label: 'Nouveau',     color: 'bg-teal-500/20 text-teal-400 border-teal-500/30',      desc: 'Premier achat récent — à convertir en régulier' },
  lead:        { label: 'Lead',        color: 'bg-gray-700/40 text-gray-400 border-gray-600/30',      desc: 'Contact sans achat ni abonnement' },
}

function scoreR(derniere_commande: string | null): number {
  if (!derniere_commande) return 0
  const jours = (Date.now() - new Date(derniere_commande).getTime()) / 86400000
  if (jours < 7) return 5
  if (jours < 30) return 4
  if (jours < 90) return 3
  if (jours < 180) return 2
  if (jours < 365) return 1
  return 0
}

function scoreF(nb: number): number {
  if (nb >= 10) return 5
  if (nb >= 5) return 4
  if (nb >= 3) return 3
  if (nb >= 2) return 2
  if (nb >= 1) return 1
  return 0
}

function scoreM(ltv: number): number {
  if (ltv >= 500) return 5
  if (ltv >= 200) return 4
  if (ltv >= 100) return 3
  if (ltv >= 50) return 2
  if (ltv >= 1) return 1
  return 0
}

function getSegment(
  nb_achats: number,
  ltv: number,
  derniere_commande: string | null,
  statut_abo: 'abonne' | 'ancien' | 'jamais'
): { r: number; f: number; m: number; rfm: number; segment: Segment } {
  const r = scoreR(derniere_commande)
  const f = scoreF(nb_achats)
  const m = scoreM(ltv)
  const rfm = Math.round((r + f + m) / 15 * 100)

  let segment: Segment
  if (nb_achats === 0 && statut_abo === 'jamais') segment = 'lead'
  else if (statut_abo === 'ancien') segment = 'a_reactiver'
  else if (r >= 4 && f >= 4 && m >= 3) segment = 'champion'
  else if (f >= 3 && m >= 2 && r >= 2) segment = 'fidele'
  else if ((f >= 2 || m >= 3) && r <= 2) segment = 'a_risque'
  else if (r <= 1) segment = 'dormant'
  else if (nb_achats <= 2 && r >= 3 && m >= 2) segment = 'potentiel'
  else if (nb_achats >= 1 && r >= 3) segment = 'nouveau'
  else segment = 'dormant'

  return { r, f, m, rfm, segment }
}

const SCORE_LABELS: Record<number, string> = { 0: 'Nul', 1: 'Faible', 2: 'Moyen', 3: 'Correct', 4: 'Bon', 5: 'Excellent' }

export default async function FicheInvitePage({
  params,
}: {
  params: Promise<{ encodedEmail: string }>
}) {
  const { encodedEmail } = await params
  const email = decodeURIComponent(encodedEmail)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [{ data: commandesRaw }, { data: abonnement }] = await Promise.all([
    supabase
      .from('commandes')
      .select(`
        id, created_at, prix_paye, statut, plateforme_source, type_commande, acheteur_nom,
        beats(titre, image_url, styles, type_beat, ambiances, instruments),
        licences(nom)
      `)
      .eq('beatmaker_id', user.id)
      .eq('acheteur_email', email)
      .order('created_at', { ascending: false }),
    supabase
      .from('abonnements_boutique')
      .select('statut, date_debut, en_essai, plan, prix, mensualites_payees')
      .eq('beatmaker_id', user.id)
      .eq('acheteur_email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const commandes = (commandesRaw ?? []) as unknown as Commande[]

  if (commandes.length === 0 && !abonnement) redirect('/dashboard/crm')

  const nom = commandes.find(c => c.acheteur_nom)?.acheteur_nom ?? email.split('@')[0]
  const initiales = nom.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('') || '?'

  const payees = commandes.filter(c => c.statut === 'payee')
  const nbAchats = payees.filter(c => c.type_commande !== 'RENOUVELLEMENT').length
  const ltv = payees.reduce((s, c) => s + c.prix_paye, 0)
  const derniereCmd = payees
    .filter(c => c.type_commande !== 'RENOUVELLEMENT')
    .map(c => c.created_at)
    .sort()
    .at(-1) ?? null

  const statut_abo: 'abonne' | 'ancien' | 'jamais' = !abonnement
    ? 'jamais'
    : abonnement.statut === 'actif' ? 'abonne' : 'ancien'

  const moisRegles = abonnement?.en_essai ? 0
    : (abonnement?.mensualites_payees ?? 0) > 0
    ? (abonnement?.mensualites_payees ?? 0)
    : (abonnement?.date_debut
      ? Math.max(1, Math.round((Date.now() - new Date(abonnement.date_debut).getTime()) / (30.44 * 86400000)))
      : 0)

  const rfmScores = getSegment(nbAchats, ltv, derniereCmd, statut_abo)
  const segConfig = SEGMENT_CONFIG[rfmScores.segment]

  const prefCounts = {
    styles: new Map<string, number>(),
    typeBeat: new Map<string, number>(),
    ambiances: new Map<string, number>(),
    instruments: new Map<string, number>(),
  }
  for (const c of payees) accumPrefs(prefCounts, c.beats, 2)

  const prefs = {
    stylePrefere: topN(prefCounts.styles, 1)[0] ?? null,
    typeBeatPrefere: topN(prefCounts.typeBeat, 1)[0] ?? null,
    topStyles: topN(prefCounts.styles, 5),
    topAmbiances: topN(prefCounts.ambiances, 5),
    topInstruments: topN(prefCounts.instruments, 5),
  }
  const hasPrefs = prefs.topStyles.length > 0 || prefs.topAmbiances.length > 0 || prefs.topInstruments.length > 0

  const premierContact = commandes.at(-1)?.created_at ?? abonnement?.date_debut ?? null

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/dashboard/crm" className="text-sm text-gray-500 hover:text-gray-300 mb-6 block">
          ← Mon CRM
        </Link>

        {/* En-tête */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 font-bold text-xl flex-shrink-0">
              {initiales}
            </div>
            <div>
              <h1 className="text-xl font-bold">{nom}</h1>
              <p className="text-gray-400 text-sm">{email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 font-medium">Invité</span>
                {statut_abo === 'abonne' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">Abonné</span>
                )}
                {statut_abo === 'ancien' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">Ancien abonné</span>
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

          {premierContact && (
            <p className="text-gray-600 text-xs mt-4">
              Premier contact le {new Date(premierContact).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
          )}
        </div>

        {/* Score RFM */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">Score RFM</h2>
            <span className={`text-xs px-3 py-1 rounded-full font-medium border ${segConfig.color}`}>
              {segConfig.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-4">{segConfig.desc}</p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Récence', score: rfmScores.r },
              { label: 'Fréquence', score: rfmScores.f },
              { label: 'Valeur', score: rfmScores.m },
            ].map(({ label, score }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-black text-white">
                  {score}<span className="text-gray-600 text-sm font-normal">/5</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                <p className="text-xs text-gray-700 mt-0.5">{SCORE_LABELS[score]}</p>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-gray-800 text-center">
            <span className="text-xs text-gray-600">Score global : </span>
            <span className="text-sm font-bold text-white">{rfmScores.rfm}</span>
            <span className="text-xs text-gray-600">/100</span>
          </div>
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
                {abonnement.statut === 'actif' ? 'Actif' : abonnement.statut === 'annule' ? 'Annulé' : 'Impayé'}
              </span>
            </div>
            {moisRegles > 0 && (
              <div className="pt-3 border-t border-gray-800">
                <p className="text-xs text-gray-500">
                  <span className="text-white font-medium">{moisRegles} mois</span> réglés
                  {!(abonnement?.mensualites_payees) && <span className="text-gray-700 ml-1">(approx.)</span>}
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
                    <span className="text-sm px-3 py-1.5 rounded-lg bg-indigo-900/40 text-indigo-300 font-medium">{prefs.stylePrefere}</span>
                  </div>
                )}
                {prefs.typeBeatPrefere && (
                  <div>
                    <p className="text-gray-500 text-xs mb-2">Type beat</p>
                    <span className="text-sm px-3 py-1.5 rounded-lg bg-purple-900/40 text-purple-300 font-medium">{prefs.typeBeatPrefere}</span>
                  </div>
                )}
              </div>
            )}

            {prefs.topStyles.length > 1 && (
              <div className="mb-3">
                <p className="text-gray-500 text-xs mb-1.5">Tous les styles</p>
                <div className="flex flex-wrap gap-1.5">
                  {prefs.topStyles.map(s => <span key={s} className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400">{s}</span>)}
                </div>
              </div>
            )}

            {prefs.topAmbiances.length > 0 && (
              <div className="mb-3">
                <p className="text-gray-500 text-xs mb-1.5">Ambiances</p>
                <div className="flex flex-wrap gap-1.5">
                  {prefs.topAmbiances.map(a => <span key={a} className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400">{a}</span>)}
                </div>
              </div>
            )}

            {prefs.topInstruments.length > 0 && (
              <div>
                <p className="text-gray-500 text-xs mb-1.5">Instruments</p>
                <div className="flex flex-wrap gap-1.5">
                  {prefs.topInstruments.map(inst => <span key={inst} className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400">{inst}</span>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Historique */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-bold text-white mb-4">
            Historique <span className="text-gray-500 font-normal">({commandes.length})</span>
          </h2>
          {commandes.length === 0 ? (
            <p className="text-gray-600 text-sm">Aucun achat pour l&apos;instant.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {commandes.map(c => {
                const isAbo = c.type_commande === 'CREATION_ABONNEMENT'
                const isRnvt = c.type_commande === 'RENOUVELLEMENT'
                const isBs = c.plateforme_source === 'beatstars'
                const titre = isAbo ? 'Création abonnement'
                  : isRnvt ? 'Renouvellement abonnement'
                  : c.beats?.titre ?? (isBs ? 'Import BeatStars' : 'Beat supprimé')
                const licence = isAbo || isRnvt ? '—' : c.licences?.nom ?? (isBs ? '—' : 'Licence inconnue')
                const avatarLabel = isAbo ? 'ABO' : isRnvt ? 'RNV' : isBs ? 'BS' : '?'

                return (
                  <div key={c.id} className="flex items-center gap-3 py-3 border-b border-gray-800 last:border-0">
                    {c.beats?.image_url ? (
                      <img src={c.beats.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                        isAbo || isRnvt ? 'bg-indigo-900/40 text-indigo-400' : 'bg-gray-800 text-gray-600'
                      }`}>
                        {avatarLabel}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm truncate">{titre}</p>
                      <p className="text-xs text-gray-500">{licence} · {new Date(c.created_at).toLocaleDateString('fr-FR')}</p>
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
