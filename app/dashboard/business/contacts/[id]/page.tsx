import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
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
  type_commande: string | null
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
  for (const s of beat.styles ?? [])    counts.styles.set(s,    (counts.styles.get(s)    ?? 0) + weight)
  for (const t of beat.type_beat ?? []) counts.typeBeat.set(t,  (counts.typeBeat.get(t)  ?? 0) + weight)
  for (const a of beat.ambiances ?? []) counts.ambiances.set(a, (counts.ambiances.get(a) ?? 0) + weight)
  for (const i of beat.instruments ?? []) counts.instruments.set(i, (counts.instruments.get(i) ?? 0) + weight)
}

// ── RFM ──────────────────────────────────────────────────────────────────────

type Segment = 'champion' | 'fidele' | 'potentiel' | 'a_risque' | 'dormant' | 'a_reactiver' | 'nouveau' | 'lead'

const SEGMENT_CONFIG: Record<Segment, { label: string; color: string; desc: string }> = {
  champion:    { label: 'Champion',     color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',  desc: 'Client très actif, acheteur régulier et haute valeur' },
  fidele:      { label: 'Fidèle',       color: 'bg-green-500/20 text-green-400 border-green-500/30',     desc: "Achète régulièrement, bon niveau d'engagement" },
  potentiel:   { label: 'Potentiel',    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',        desc: 'Nouvel acheteur à fort potentiel, à fidéliser' },
  a_risque:    { label: 'À risque',     color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',  desc: "Bon client qui n'achète plus depuis un moment" },
  dormant:     { label: 'Dormant',      color: 'bg-gray-600/30 text-gray-500 border-gray-600/30',        desc: 'Inactif depuis plusieurs mois' },
  a_reactiver: { label: 'À réactiver', color: 'bg-red-500/20 text-red-400 border-red-500/30',           desc: 'Ancien abonné ayant résilié — à reconquérir' },
  nouveau:     { label: 'Nouveau',      color: 'bg-teal-500/20 text-teal-400 border-teal-500/30',        desc: 'Premier achat récent — à convertir en régulier' },
  lead:        { label: 'Lead',         color: 'bg-gray-700/40 text-gray-400 border-gray-600/30',        desc: 'Contact sans achat ni abonnement' },
}

function scoreR(derniere_commande: string | null): number {
  if (!derniere_commande) return 0
  const jours = (Date.now() - new Date(derniere_commande).getTime()) / 86400000
  if (jours < 7)   return 5
  if (jours < 30)  return 4
  if (jours < 90)  return 3
  if (jours < 180) return 2
  if (jours < 365) return 1
  return 0
}

function scoreF(nb: number): number {
  if (nb >= 10) return 5
  if (nb >= 5)  return 4
  if (nb >= 3)  return 3
  if (nb >= 2)  return 2
  if (nb >= 1)  return 1
  return 0
}

function scoreM(ltv: number): number {
  if (ltv >= 500) return 5
  if (ltv >= 200) return 4
  if (ltv >= 100) return 3
  if (ltv >= 50)  return 2
  if (ltv >= 1)   return 1
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
  else if (statut_abo === 'ancien')              segment = 'a_reactiver'
  else if (r >= 4 && f >= 4 && m >= 3)          segment = 'champion'
  else if (f >= 3 && m >= 2 && r >= 2)          segment = 'fidele'
  else if ((f >= 2 || m >= 3) && r <= 2)        segment = 'a_risque'
  else if (r <= 1)                              segment = 'dormant'
  else if (nb_achats <= 2 && r >= 3 && m >= 2) segment = 'potentiel'
  else if (nb_achats >= 1 && r >= 3)            segment = 'nouveau'
  else                                          segment = 'dormant'

  return { r, f, m, rfm, segment }
}

const SCORE_LABELS: Record<number, string> = {
  0: 'Nul', 1: 'Faible', 2: 'Moyen', 3: 'Correct', 4: 'Bon', 5: 'Excellent',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function FicheClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: clientId } = await params
  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: client } = await admin
    .from('clients')
    .select('id, email, nom, prenom, nom_artiste, created_at, pays, telephone, instagram, spotify, youtube, tiktok, newsletter_consent')
    .eq('id', clientId)
    .single()

  if (!client) redirect('/dashboard/business/contacts')

  const [{ data: commandesRaw }, { data: abonnement }, { data: favorisRaw }] = await Promise.all([
    supabase
      .from('commandes')
      .select(`
        id, created_at, prix_paye, statut, plateforme_source, type_commande,
        beats(titre, image_url, styles, type_beat, ambiances, instruments),
        licences(nom)
      `)
      .eq('beatmaker_id', user.id)
      .or(`client_id.eq.${clientId},acheteur_email.eq.${client.email}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('abonnements_boutique')
      .select('statut, date_debut, date_fin, en_essai, annulation_en_cours, plan, prix, mois_consecutifs, mensualites_payees')
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

  const commandes  = (commandesRaw ?? []) as unknown as Commande[]
  const favoris    = (favorisRaw   ?? []) as unknown as Array<{ beat_id: string; beats: BeatPrefs }>

  const payees    = commandes.filter(c => c.statut === 'payee')
  const nbAchats  = payees.filter(c => c.type_commande !== 'RENOUVELLEMENT').length
  const ltv       = payees.reduce((s, c) => s + c.prix_paye, 0)
  const licencesPayees = payees.filter(c => c.type_commande === 'LICENCE')
  const licenceLtv     = licencesPayees.reduce((s, c) => s + c.prix_paye, 0)
  const panierMoyen    = nbAchats > 0 ? Math.round(licenceLtv / nbAchats) : null
  const derniereCmd    = licencesPayees.map(c => c.created_at).sort().at(-1) ?? null

  const statut_abo: 'abonne' | 'ancien' | 'jamais' = !abonnement
    ? 'jamais'
    : (abonnement.statut === 'actif' || abonnement.statut === 'impaye')
    ? 'abonne'
    : 'ancien'

  const moisRegles = abonnement?.en_essai ? 0
    : (abonnement?.mensualites_payees ?? 0) > 0
    ? (abonnement.mensualites_payees ?? 0)
    : (abonnement?.date_debut
      ? Math.max(1, Math.round((Date.now() - new Date(abonnement.date_debut).getTime()) / (30.44 * 86400000)))
      : 0)

  const rfmScores = getSegment(nbAchats, ltv, derniereCmd, statut_abo)
  const segConfig = SEGMENT_CONFIG[rfmScores.segment]

  // Préférences — achats payés ×2, favoris ×1
  const prefCounts = {
    styles:     new Map<string, number>(),
    typeBeat:   new Map<string, number>(),
    ambiances:  new Map<string, number>(),
    instruments: new Map<string, number>(),
  }
  for (const c of payees)  accumPrefs(prefCounts, c.beats, 2)
  for (const f of favoris) accumPrefs(prefCounts, f.beats, 1)

  const prefs = {
    stylePrefere:    topN(prefCounts.styles,   1)[0] ?? null,
    typeBeatPrefere: topN(prefCounts.typeBeat, 1)[0] ?? null,
    topStyles:       topN(prefCounts.styles,   5),
    topAmbiances:    topN(prefCounts.ambiances, 5),
    topInstruments:  topN(prefCounts.instruments, 5),
  }
  const hasPrefs = prefs.topStyles.length > 0 || prefs.topAmbiances.length > 0 || prefs.topInstruments.length > 0

  async function sauvegarderInstagram(formData: FormData) {
    'use server'
    const admin2 = createAdminClient()
    const ig = (formData.get('instagram') as string ?? '').trim()
    await admin2.from('clients').update({ instagram: ig || null }).eq('id', clientId)
    revalidatePath(`/dashboard/business/contacts/${clientId}`)
  }

  const nomComplet = `${client.prenom ?? ''} ${client.nom ?? ''}`.trim()
  const initiales  = [client.prenom?.[0], client.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const langue     = getLangue(client.pays)

  const socials = [
    client.spotify  && { href: `https://open.spotify.com/artist/${client.spotify}`,  label: 'Spotify',   color: 'hover:text-green-400'  },
    client.youtube  && { href: `https://youtube.com/@${client.youtube}`,             label: 'YouTube',   color: 'hover:text-red-400'    },
    client.tiktok   && { href: `https://tiktok.com/@${client.tiktok}`,              label: 'TikTok',    color: 'hover:text-pink-300'   },
  ].filter(Boolean) as { href: string; label: string; color: string }[]

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/dashboard/business/contacts" className="text-sm text-gray-500 hover:text-gray-300 mb-6 block">
          ← Contacts
        </Link>

        {/* ── Bloc 1 : Header client ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-indigo-900/60 flex items-center justify-center text-indigo-300 font-bold text-xl flex-shrink-0">
              {initiales}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">
                {nomComplet || client.email}
                {client.nom_artiste && (
                  <span className="ml-2 text-sm font-normal text-gray-500">({client.nom_artiste})</span>
                )}
              </h1>
              <p className="text-gray-400 text-sm">{client.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {client.pays && (
                  <span className="text-gray-600 text-xs">{client.pays} · {langue}</span>
                )}
                {statut_abo === 'abonne' && abonnement?.annulation_en_cours && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">Annulation en cours</span>
                )}
                {statut_abo === 'abonne' && !abonnement?.annulation_en_cours && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">Abonné</span>
                )}
                {statut_abo === 'ancien' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">Ancien abonné</span>
                )}
                {statut_abo === 'jamais' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 font-medium">Jamais abonné</span>
                )}
                {client.newsletter_consent && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">Newsletter</span>
                )}
                {client.instagram && (
                  <a
                    href={`https://instagram.com/${client.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 hover:text-pink-400 transition-colors"
                  >
                    @{client.instagram.replace('@', '')}
                  </a>
                )}
                {socials.map(s => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                    className={`text-xs text-gray-500 transition-colors ${s.color}`}>
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-800">
            <div>
              <p className="text-gray-500 text-xs mb-1">Licences</p>
              <p className="text-2xl font-black">{nbAchats}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">LTV</p>
              <p className="text-2xl font-black">{ltv.toLocaleString('fr-FR')} €</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Panier moy.</p>
              <p className="text-2xl font-black">{panierMoyen !== null ? `${panierMoyen} €` : '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Abonnement</p>
              {abonnement?.statut === 'actif' ? (
                <p className="text-green-400 font-bold">Actif</p>
              ) : abonnement?.statut === 'impaye' ? (
                <p className="text-red-400 font-bold">Impayé</p>
              ) : (
                <p className="text-gray-600">—</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-gray-600 text-xs">
              Client depuis le {new Date(client.created_at).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
            <form action={sauvegarderInstagram} className="flex items-center gap-1">
              <span className="text-gray-600 text-xs">@</span>
              <input
                name="instagram"
                type="text"
                defaultValue={client.instagram ?? ''}
                placeholder="instagram"
                className="w-28 text-xs bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
              <button type="submit" className="text-xs px-2 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                OK
              </button>
            </form>
          </div>
        </div>

        {/* ── Bloc 2 : Score RFM ── */}
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
              { label: 'Récence',   score: rfmScores.r, hint: 'Dernier achat' },
              { label: 'Fréquence', score: rfmScores.f, hint: 'Nb achats'     },
              { label: 'Valeur',    score: rfmScores.m, hint: 'LTV'           },
            ].map(({ label, score, hint }) => (
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

        {/* ── Bloc 3 : Abonnement ── */}
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
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  abonnement.statut === 'actif'  ? 'bg-green-500/20 text-green-400'
                  : abonnement.statut === 'impaye' ? 'bg-red-500/20 text-red-400'
                  : 'bg-gray-700 text-gray-400'
                }`}>
                  {abonnement.statut === 'actif' ? 'Actif'
                    : abonnement.statut === 'impaye' ? 'Impayé'
                    : 'Annulé'}
                </span>
                {abonnement.annulation_en_cours && (
                  <span className="text-xs text-orange-400">Annulation en cours</span>
                )}
              </div>
            </div>
            {moisRegles > 0 && (
              <div className="pt-3 border-t border-gray-800">
                <p className="text-xs text-gray-500">
                  <span className="text-white font-medium">{moisRegles} mois</span> réglés
                  {!abonnement.mensualites_payees && (
                    <span className="text-gray-700 ml-1">(approx.)</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Bloc 4 : Préférences musicales ── */}
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

        {/* ── Bloc 5 : Historique ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-bold text-white mb-4">
            Historique <span className="text-gray-500 font-normal">({commandes.length})</span>
          </h2>

          {commandes.length === 0 ? (
            <p className="text-gray-600 text-sm">Aucun achat pour l&apos;instant.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {commandes.map(c => {
                const isAbo  = c.type_commande === 'CREATION_ABONNEMENT'
                const isRnvt = c.type_commande === 'RENOUVELLEMENT'
                const isBs   = c.plateforme_source === 'beatstars'
                const titre  = isAbo  ? 'Création abonnement'
                  : isRnvt ? 'Renouvellement abonnement'
                  : c.beats?.titre ?? (isBs ? 'Import BeatStars' : 'Beat supprimé')
                const licence = isAbo || isRnvt ? '—'
                  : c.licences?.nom ?? (isBs ? '—' : 'Licence inconnue')
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
