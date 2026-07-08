import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import BeatCard from '../_components/BeatCard'
import type { BeatPublic, LicencePublic } from '../_components/BeatCard'

export default async function MembresPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, nom_artiste, abo_actif, abo_nom, abo_description, abo_prix, abo_remise_pct')
    .eq('slug', slug)
    .single()

  if (!beatmaker) notFound()

  // Vérifier abonné — session Supabase en priorité, cookie en fallback
  const { data: { user } } = await supabase.auth.getUser()
  let estAbonne = false

  if (user && beatmaker.abo_actif) {
    const { data: abo } = await admin
      .from('abonnements_boutique')
      .select('id')
      .eq('beatmaker_id', beatmaker.id)
      .or(`client_id.eq.${user.id},acheteur_email.eq.${user.email}`)
      .eq('statut', 'actif')
      .maybeSingle()
    estAbonne = !!abo
  }

  if (!estAbonne) {
    const cookieStore = await cookies()
    const emailCookie = cookieStore.get(`abo_${slug}`)?.value
    if (emailCookie) {
      const { data: abo } = await admin
        .from('abonnements_boutique')
        .select('id')
        .eq('beatmaker_id', beatmaker.id)
        .eq('acheteur_email', emailCookie)
        .eq('statut', 'actif')
        .maybeSingle()
      estAbonne = !!abo
    }
  }

  const { data: rawBeats } = await supabase
    .from('beats')
    .select(`
      id, titre, bpm, cle, image_url, mp3_tague_url,
      styles, ambiances, instruments, type_beat,
      beat_licences (
        actif, prix_override, sur_demande,
        licences (id, nom, modele, prix, actif)
      )
    `)
    .eq('beatmaker_id', beatmaker.id)
    .eq('statut', 'prive')
    .is('supprime_le', null)
    .order('created_at', { ascending: false })

  type RawBeat = { id: string; titre: string; bpm: number | null; cle: string | null; image_url: string | null; mp3_tague_url: string | null; styles: string[] | null; ambiances: string[] | null; instruments: string[] | null; type_beat: string[] | null; beat_licences: { actif: boolean; prix_override: number | null; sur_demande: boolean; licences: { id: string; nom: string; modele: string; prix: number; actif: boolean } | null }[] | null }

  const beats: BeatPublic[] = (rawBeats as unknown as RawBeat[] ?? []).map(beat => ({
    id: beat.id,
    titre: beat.titre,
    bpm: beat.bpm,
    cle: beat.cle,
    image_url: beat.image_url,
    mp3_tague_url: beat.mp3_tague_url,
    styles: beat.styles,
    ambiances: beat.ambiances,
    instruments: beat.instruments,
    type_beat: beat.type_beat,
    prive: true,
    licences: (beat.beat_licences ?? [])
      .filter(bl => bl.actif && bl.licences?.actif)
      .map((bl): LicencePublic => ({
        id: bl.licences!.id,
        nom: bl.licences!.nom,
        modele: bl.licences!.modele,
        prix: bl.prix_override ?? bl.licences!.prix,
        sur_demande: bl.sur_demande,
      })),
  }))

  const prixAffiche = beatmaker.abo_prix ? (beatmaker.abo_prix / 100).toFixed(2).replace('.', ',') : null

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Link href={`/${slug}`} className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8">
        ← Boutique de {beatmaker.nom_artiste}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-white">
          Réservés aux membres <span className="text-gray-500 font-normal text-lg">({beats.length})</span>
        </h1>
        {estAbonne && (
          <Link href={`/${slug}/mon-abonnement`} className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
            Mon abonnement →
          </Link>
        )}
      </div>

      {/* Paywall pour non-abonnés */}
      {!estAbonne && beatmaker.abo_actif && (
        <div className="bg-brand-900/20 border border-brand-500/30 rounded-2xl p-8 mb-10 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-xl font-black text-white mb-2">Ces beats sont réservés aux membres</h2>
          {beatmaker.abo_description && (
            <p className="text-gray-400 text-sm mb-4">{beatmaker.abo_description}</p>
          )}
          <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
            {prixAffiche && (
              <div className="text-center">
                <p className="text-2xl font-black text-white">{prixAffiche}€<span className="text-gray-400 text-base font-normal">/mois</span></p>
              </div>
            )}
            {beatmaker.abo_remise_pct > 0 && (
              <p className="text-gray-400 text-sm">-{beatmaker.abo_remise_pct}% sur toutes les licences</p>
            )}
          </div>
          <Link
            href={`/${slug}/abonnement`}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors shadow-[0_6px_20px_-4px_rgba(0,41,255,0.5)]"
          >
            S&apos;abonner pour {prixAffiche}€/mois
          </Link>
        </div>
      )}

      {/* Grille beats */}
      {beats.length === 0 ? (
        <p className="text-gray-500 text-center py-20">Aucun beat privé pour l'instant.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {beats.map(beat => (
            <BeatCard key={beat.id} beat={beat} slug={slug} queue={beats} estAbonne={estAbonne} clientId={user?.id ?? null} />
          ))}
        </div>
      )}
    </div>
  )
}
