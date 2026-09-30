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

// Une ligne = une facture : celle de la commande (vente solo) ou celle de
// chaque vendeur d'une vente à plusieurs vendeurs (Phase 13).
type FactureRow = {
  cle: string
  libelle: string
  numero: string | null
  montant: number
  date: string
  url: string
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
      .order('created_at', { ascending: false })
    commandes = (data as unknown as CmdRow[]) ?? []
  } else {
    const { data } = await admin
      .from('commandes')
      .select('id, created_at, prix_paye, type_commande, numero_facture, facture_pdf_url')
      .eq('beatmaker_id', beatmaker.id)
      .eq('acheteur_email', emailIdentifie)
      .order('created_at', { ascending: false })
    commandes = (data as unknown as CmdRow[]) ?? []
  }

  const { data: tranches } = commandes.length
    ? await admin
        .from('commande_tranches')
        .select('id, commande_id, vendeur_nom, montant_ttc_cents, facture_numero, facture_pdf_url, est_proprietaire')
        .in('commande_id', commandes.map(c => c.id))
        .not('facture_pdf_url', 'is', null)
        .order('est_proprietaire', { ascending: false })
    : { data: [] }

  // Factures d'avoir (Phase 13, lot 4) : rangées juste après la facture
  // qu'elles annulent, montant en négatif.
  const { data: avoirs } = commandes.length
    ? await admin
        .from('avoirs')
        .select('id, commande_id, tranche_id, numero, montant_cents, pdf_url, created_at')
        .in('commande_id', commandes.map(c => c.id))
        .not('pdf_url', 'is', null)
        .order('created_at', { ascending: true })
    : { data: [] }
  const nomVendeurTranche = new Map((tranches ?? []).map(t => [t.id as string, t.vendeur_nom as string]))

  const factures: FactureRow[] = commandes.flatMap(cmd => [
    ...(cmd.facture_pdf_url ? [{
      cle: cmd.id,
      libelle: LABEL_TYPE_COMMANDE[cmd.type_commande ?? ''] ?? 'Facture',
      numero: cmd.numero_facture,
      montant: Number(cmd.prix_paye),
      date: cmd.created_at,
      url: cmd.facture_pdf_url,
    }] : []),
    ...(tranches ?? []).filter(t => t.commande_id === cmd.id).map(t => ({
      cle: t.id as string,
      libelle: `${LABEL_TYPE_COMMANDE[cmd.type_commande ?? ''] ?? 'Facture'} — ${t.vendeur_nom}`,
      numero: t.facture_numero as string | null,
      montant: (t.montant_ttc_cents as number) / 100,
      date: cmd.created_at,
      url: t.facture_pdf_url as string,
    })),
    ...(avoirs ?? []).filter(a => a.commande_id === cmd.id).map(a => ({
      cle: a.id as string,
      libelle: `Facture d'avoir${a.tranche_id && nomVendeurTranche.get(a.tranche_id) ? ` — ${nomVendeurTranche.get(a.tranche_id)}` : ''}`,
      numero: a.numero as string,
      montant: -(a.montant_cents as number) / 100,
      date: a.created_at as string,
      url: a.pdf_url as string,
    })),
  ])

  return (
    <div className="min-h-screen bg-black px-6 py-16">
      <div className="max-w-lg mx-auto">
        <Link href={`/${slug}/mon-compte`} className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8">
          ← Mon compte
        </Link>

        <h1 className="text-2xl font-black text-white mb-6">
          Mes factures ({factures.length})
        </h1>

        {factures.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">Aucune facture disponible pour l&apos;instant.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {factures.map(f => (
              <div key={f.cle} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center text-gray-500 text-base">
                  🧾
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {f.libelle}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {f.numero ? `${f.numero} · ` : ''}{f.montant.toFixed(2)}€ · {new Date(f.date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <a
                  href={f.url}
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
