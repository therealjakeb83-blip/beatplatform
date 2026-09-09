import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

type CmdRow = {
  id: string
  created_at: string
  prix_paye: number
  type_commande: string | null
  numero_facture: string | null
  facture_pdf_url: string | null
}

const LABEL_TYPE_COMMANDE: Record<string, string> = {
  LICENCE: 'Achat de licence',
  CREATION_ABONNEMENT: 'Abonnement — souscription',
  RENOUVELLEMENT: 'Abonnement — renouvellement',
}

// Tous les documents financiers de cette boutique (licences + abonnements
// confondus) — juste le téléchargement de la facture, pas les fichiers
// audio (ça reste le rôle de "Mes achats", /mon-compte/achats).
export default async function FacturesBoutiquePage({
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
      .select('id, created_at, prix_paye, type_commande, numero_facture, facture_pdf_url')
      .eq('beatmaker_id', beatmaker.id)
      .or(`client_id.eq.${clientId},acheteur_email.eq.${emailIdentifie}`)
      .not('facture_pdf_url', 'is', null)
      .order('created_at', { ascending: false })
    commandes = (data as unknown as CmdRow[]) ?? []
  } else {
    const { data } = await admin
      .from('commandes')
      .select('id, created_at, prix_paye, type_commande, numero_facture, facture_pdf_url')
      .eq('beatmaker_id', beatmaker.id)
      .eq('acheteur_email', emailIdentifie)
      .not('facture_pdf_url', 'is', null)
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
          Mes factures ({commandes.length})
        </h1>

        {commandes.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">Aucune facture disponible pour l&apos;instant.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {commandes.map(cmd => (
              <div key={cmd.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center text-gray-500 text-base">
                  🧾
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {LABEL_TYPE_COMMANDE[cmd.type_commande ?? ''] ?? 'Facture'}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {cmd.numero_facture ? `${cmd.numero_facture} · ` : ''}{Number(cmd.prix_paye).toFixed(2)}€ · {new Date(cmd.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <a
                  href={cmd.facture_pdf_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors flex-shrink-0"
                >
                  ⬇ Télécharger
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
