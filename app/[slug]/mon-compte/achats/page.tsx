import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

type LigneRow = {
  beats: { titre: string; image_url: string | null } | null
  licences: { nom: string } | null
}

type CmdRow = {
  id: string
  created_at: string
  prix_paye: number
  devise: string
  commande_lignes: LigneRow[]
}

export default async function AchatsBoutiquePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, nom_artiste')
    .eq('slug', slug)
    .single()

  if (!beatmaker) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  let emailIdentifie: string | null = null
  let clientId: string | null = null

  if (user) {
    emailIdentifie = user.email ?? null
    clientId = user.id
  } else {
    const cookieStore = await cookies()
    const emailCookie = cookieStore.get(`abo_${slug}`)?.value
    if (emailCookie) emailIdentifie = emailCookie
  }

  if (!emailIdentifie) redirect(`/${slug}/mon-compte`)

  let commandes: CmdRow[] = []
  if (clientId) {
    const { data } = await admin
      .from('commandes')
      .select('id, created_at, prix_paye, devise, commande_lignes(beats(titre, image_url), licences(nom))')
      .eq('beatmaker_id', beatmaker.id)
      .or(`client_id.eq.${clientId},acheteur_email.eq.${emailIdentifie}`)
      .order('created_at', { ascending: false })
    commandes = (data as unknown as CmdRow[]) ?? []
  } else {
    const { data } = await admin
      .from('commandes')
      .select('id, created_at, prix_paye, devise, commande_lignes(beats(titre, image_url), licences(nom))')
      .eq('beatmaker_id', beatmaker.id)
      .eq('acheteur_email', emailIdentifie)
      .order('created_at', { ascending: false })
    commandes = (data as unknown as CmdRow[]) ?? []
  }

  return (
    <div className="min-h-screen bg-black px-6 py-16">
      <div className="max-w-lg mx-auto">
        <Link href={`/${slug}/mon-compte`} className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8">
          ← Mon compte
        </Link>

        <h1 className="text-2xl font-black text-white mb-6">
          Mes achats ({commandes.length})
        </h1>

        {commandes.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm mb-4">Aucun achat sur cette boutique.</p>
            <Link href={`/${slug}`} className="text-brand-400 hover:text-brand-300 text-sm transition-colors">
              Découvrir les beats →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {commandes.map(cmd => {
              const lignes = cmd.commande_lignes ?? []
              const beat = lignes[0]?.beats
              const licence = lignes[0]?.licences
              const autres = lignes.length - 1
              return (
                <div key={cmd.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
                  {beat?.image_url ? (
                    <img src={beat.image_url} alt={beat.titre} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center text-gray-600 text-xs font-bold">
                      {beat?.titre?.slice(0, 2).toUpperCase() ?? '??'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {beat?.titre ?? 'Beat'}
                      {autres > 0 && <span className="text-gray-500"> +{autres} autre{autres > 1 ? 's' : ''}</span>}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {licence?.nom ?? '—'} · {Number(cmd.prix_paye).toFixed(2)}€ · {new Date(cmd.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <Link
                    href={`/telechargement/${cmd.id}`}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors flex-shrink-0"
                  >
                    ⬇ Télécharger
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
