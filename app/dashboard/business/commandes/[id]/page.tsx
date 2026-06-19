import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

/* ─── types ──────────────────────────────────────────────────────── */

type Note = { texte: string; date: string }

type CommandeDetail = {
  id: string
  created_at: string
  prix_paye: number
  devise: string | null
  statut: 'en_attente' | 'payee' | 'remboursee' | 'litige'
  methode_paiement: string | null
  code_promo: string | null
  reduction_montant: number | null
  fichiers_livres: boolean | null
  contrat_pdf_url: string | null
  facture_pdf_url: string | null
  source_marketing: string | null
  type_transaction: string | null
  plateforme_source: string | null
  acheteur_email: string | null
  acheteur_nom: string | null
  notes: Note[] | null
  client_id: string | null
  clients: {
    id: string
    prenom: string | null
    nom: string
    email: string
    pays: string | null
  } | null
  beats: { id: string; titre: string; couleur: string | null; image_url: string | null } | null
  licences: { id: string; nom: string; modele: string } | null
}

type HistoriqueCommande = {
  id: string
  created_at: string
  prix_paye: number
  statut: string
  type_transaction: string | null
}

/* ─── constants ─────────────────────────────────────────────────── */

const STATUT = {
  en_attente: { label: 'En attente', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/20' },
  payee:      { label: 'Payée',      cls: 'bg-green-500/15  text-green-400  border border-green-500/20' },
  remboursee: { label: 'Remboursée', cls: 'bg-red-500/15    text-red-400    border border-red-500/20' },
  litige:     { label: 'Litige',     cls: 'bg-orange-500/15 text-orange-400 border border-orange-500/20' },
} as const

const SOURCE_LABEL: Record<string, string> = {
  youtube: 'YouTube', instagram: 'Instagram', google: 'Google',
  direct: 'Direct', autre: 'Autre',
}

/* ─── helpers ────────────────────────────────────────────────────── */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* ─── page ───────────────────────────────────────────────────────── */

export default async function CommandeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: commande } = await supabase
    .from('commandes')
    .select(
      `id, created_at, prix_paye, devise, statut,
       methode_paiement, code_promo, reduction_montant,
       fichiers_livres, contrat_pdf_url, facture_pdf_url,
       source_marketing, type_transaction, plateforme_source,
       acheteur_email, acheteur_nom, notes, client_id,
       clients (id, prenom, nom, email, pays),
       beats (id, titre, couleur, image_url),
       licences (id, nom, modele)`
    )
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .single()

  if (!commande) notFound()

  const c = commande as unknown as CommandeDetail

  /* Historique client */
  let historiqueClient: HistoriqueCommande[] = []
  if (c.client_id) {
    const { data } = await supabase
      .from('commandes')
      .select('id, created_at, prix_paye, statut, type_transaction')
      .eq('beatmaker_id', user.id)
      .eq('client_id', c.client_id)
      .order('created_at', { ascending: false })
    historiqueClient = (data ?? []) as HistoriqueCommande[]
  }

  const ltv = historiqueClient
    .filter(h => h.statut === 'payee')
    .reduce((sum, h) => sum + (h.prix_paye ?? 0), 0)

  /* Calculs financiers */
  const remise    = c.reduction_montant ?? 0
  const prixTTC   = c.prix_paye
  const prixHT    = prixTTC / 1.2
  const tva       = prixTTC - prixHT
  const sousTotal = prixTTC + remise

  /* Timeline */
  const timeline: { date: string; texte: string; type: 'auto' | 'note' }[] = []
  timeline.push({ date: c.created_at, texte: 'Commande créée', type: 'auto' })
  if (c.statut === 'payee' || c.statut === 'remboursee' || c.statut === 'litige') {
    timeline.push({ date: c.created_at, texte: 'Paiement reçu', type: 'auto' })
  }
  if (c.fichiers_livres) {
    timeline.push({ date: c.created_at, texte: 'Fichiers livrés au client', type: 'auto' })
  }
  if (c.statut === 'remboursee') {
    timeline.push({ date: c.created_at, texte: 'Commande remboursée', type: 'auto' })
  }
  if (c.statut === 'litige') {
    timeline.push({ date: c.created_at, texte: 'Litige ouvert', type: 'auto' })
  }
  ;(c.notes ?? []).forEach(n => timeline.push({ date: n.date, texte: n.texte, type: 'note' }))
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const s = STATUT[c.statut] ?? { label: c.statut, cls: 'bg-gray-700 text-gray-300 border border-gray-600' }
  const nomClient = c.clients
    ? [c.clients.prenom, c.clients.nom].filter(Boolean).join(' ')
    : c.acheteur_nom ?? c.acheteur_email ?? '—'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <Link
            href="/dashboard/business/commandes"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Commandes
          </Link>

          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-xl font-bold text-white font-mono">
              #{c.id.slice(0, 8).toUpperCase()}
            </h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
              {s.label}
            </span>
            <span className="text-sm text-gray-500">{fmtDateTime(c.created_at)}</span>
            {c.source_marketing && (
              <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-full">
                {SOURCE_LABEL[c.source_marketing] ?? c.source_marketing}
              </span>
            )}
          </div>
        </div>

        {/* 3-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Général */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Général</h2>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">Client</p>
                {c.clients ? (
                  <Link
                    href={`/dashboard/business/contacts/${c.clients.id}`}
                    className="text-sm font-medium text-white hover:text-indigo-300"
                  >
                    {nomClient}
                  </Link>
                ) : (
                  <p className="text-sm text-white">{nomClient}</p>
                )}
                <p className="text-xs text-gray-400">{c.clients?.email ?? c.acheteur_email ?? '—'}</p>
              </div>

              {c.clients?.pays && (
                <div>
                  <p className="text-[10px] text-gray-600 mb-0.5">Pays</p>
                  <div className="flex items-center gap-2">
                    <img
                      src={`https://flagcdn.com/w40/${c.clients.pays.toLowerCase()}.png`}
                      alt={c.clients.pays}
                      className="w-5 h-3.5 object-cover rounded-sm"
                    />
                    <span className="text-xs text-gray-300">{c.clients.pays.toUpperCase()}</span>
                  </div>
                </div>
              )}

              {c.beats && (
                <div>
                  <p className="text-[10px] text-gray-600 mb-0.5">Beat</p>
                  <p className="text-sm text-white">{c.beats.titre}</p>
                </div>
              )}

              {c.licences && (
                <div>
                  <p className="text-[10px] text-gray-600 mb-0.5">Licence</p>
                  <p className="text-sm text-white">{c.licences.nom}</p>
                  <p className="text-xs text-gray-500">{c.licences.modele}</p>
                </div>
              )}

              {c.type_transaction && (
                <div>
                  <p className="text-[10px] text-gray-600 mb-0.5">Type</p>
                  <p className="text-xs text-gray-300 capitalize">{c.type_transaction}</p>
                </div>
              )}
            </div>
          </div>

          {/* Facturation */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Facturation</h2>

            <div className="space-y-3">
              {c.methode_paiement && (
                <div>
                  <p className="text-[10px] text-gray-600 mb-0.5">Méthode</p>
                  <p className="text-sm text-white capitalize">{c.methode_paiement}</p>
                </div>
              )}

              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">Devise</p>
                <p className="text-sm text-white">{c.devise?.toUpperCase() ?? 'EUR'}</p>
              </div>

              {c.code_promo && (
                <div>
                  <p className="text-[10px] text-gray-600 mb-0.5">Code promo</p>
                  <p className="font-mono text-sm text-indigo-400">{c.code_promo}</p>
                  {remise > 0 && (
                    <p className="text-xs text-green-400">−{remise}€ appliqué</p>
                  )}
                </div>
              )}

              {/* Totaux */}
              <div className="bg-gray-800 rounded-xl p-4 space-y-2 mt-2">
                {remise > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Sous-total TTC</span>
                      <span>{sousTotal}€</span>
                    </div>
                    <div className="flex justify-between text-xs text-green-400">
                      <span>Remise</span>
                      <span>−{remise}€</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Total HT</span>
                  <span>{prixHT.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>TVA (20%)</span>
                  <span>{tva.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-gray-700">
                  <span>Total TTC</span>
                  <span>{prixTTC}€</span>
                </div>
              </div>

              {/* Documents */}
              {(c.facture_pdf_url || c.contrat_pdf_url) && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] text-gray-600">Documents</p>
                  {c.facture_pdf_url && (
                    <a
                      href={c.facture_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Facture PDF
                    </a>
                  )}
                  {c.contrat_pdf_url && (
                    <a
                      href={c.contrat_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Contrat PDF
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Attribution + Historique client */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Attribution</h2>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">Source marketing</p>
                <p className="text-sm text-white">
                  {c.source_marketing ? SOURCE_LABEL[c.source_marketing] ?? c.source_marketing : '—'}
                </p>
              </div>
              {c.plateforme_source && (
                <div>
                  <p className="text-[10px] text-gray-600 mb-0.5">Plateforme</p>
                  <p className="text-sm text-white capitalize">{c.plateforme_source.replace('_', ' ')}</p>
                </div>
              )}
            </div>

            {/* Historique client */}
            {c.client_id && historiqueClient.length > 0 && (
              <>
                <div className="border-t border-gray-800 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Historique client</h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-lg font-bold text-white">{historiqueClient.length}</p>
                      <p className="text-[10px] text-gray-500">commande{historiqueClient.length > 1 ? 's' : ''}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-lg font-bold text-white">{ltv}€</p>
                      <p className="text-[10px] text-gray-500">LTV totale</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {historiqueClient.slice(0, 5).map(h => {
                      return (
                        <Link
                          key={h.id}
                          href={`/dashboard/business/commandes/${h.id}`}
                          className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-lg transition-colors ${
                            h.id === c.id
                              ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300'
                              : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          <span className="font-mono">#{h.id.slice(0, 6).toUpperCase()}</span>
                          <span className="text-gray-600">
                            {new Date(h.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </span>
                          <span className="font-semibold text-white">{h.prix_paye}€</span>
                        </Link>
                      )
                    })}
                    {historiqueClient.length > 5 && (
                      <Link
                        href={`/dashboard/business/commandes?clientId=${c.client_id}`}
                        className="block text-center text-xs text-indigo-400 hover:text-indigo-300 pt-1"
                      >
                        Voir les {historiqueClient.length - 5} autres →
                      </Link>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Articles */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Articles</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  <th className="text-left px-5 py-3">Produit</th>
                  <th className="text-center px-4 py-3">Qté</th>
                  <th className="text-right px-4 py-3">Prix HT</th>
                  <th className="text-right px-4 py-3">TVA 20%</th>
                  {remise > 0 && <th className="text-right px-4 py-3">Remise</th>}
                  <th className="text-right px-5 py-3">Total TTC</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {c.beats?.image_url ? (
                        <img
                          src={c.beats.image_url}
                          alt={c.beats.titre}
                          className="w-10 h-10 rounded-lg object-cover bg-gray-800"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: c.beats?.couleur ?? '#374151' }}
                        >
                          <svg className="w-4 h-4 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                          </svg>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-white">{c.beats?.titre ?? '—'}</p>
                        {c.licences && (
                          <p className="text-xs text-gray-500">{c.licences.nom} · {c.licences.modele}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center text-gray-400">1</td>
                  <td className="px-4 py-4 text-right text-gray-300">{prixHT.toFixed(2)}€</td>
                  <td className="px-4 py-4 text-right text-gray-300">{tva.toFixed(2)}€</td>
                  {remise > 0 && (
                    <td className="px-4 py-4 text-right text-green-400">−{remise}€</td>
                  )}
                  <td className="px-5 py-4 text-right font-bold text-white">{prixTTC}€</td>
                </tr>
              </tbody>
              <tfoot className="border-t border-gray-800">
                {remise > 0 && (
                  <tr>
                    <td colSpan={remise > 0 ? 5 : 4} className="px-5 py-2 text-right text-xs text-gray-500">
                      Remise code promo ({c.code_promo})
                    </td>
                    <td className="px-5 py-2 text-right text-xs text-green-400">−{remise}€</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={remise > 0 ? 5 : 4} className="px-5 py-3 text-right text-sm font-bold text-white">
                    Total payé
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-white">{prixTTC}€</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Fichiers */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Livraison des fichiers</h2>
          <div className="flex items-center gap-3">
            {c.fichiers_livres ? (
              <>
                <div className="w-8 h-8 rounded-full bg-green-500/15 border border-green-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Fichiers livrés</p>
                  <p className="text-xs text-gray-500">Le client a reçu les fichiers · Non remboursable</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300">Fichiers non livrés</p>
                  <p className="text-xs text-gray-500">Le client n&apos;a pas encore téléchargé ses fichiers</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Timeline */}
        {timeline.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-5">Historique</h2>
            <div className="space-y-4">
              {timeline.map((event, i) => (
                <div key={i} className="flex gap-3">
                  <div className="relative flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                      event.type === 'note' ? 'bg-indigo-400' : 'bg-gray-600'
                    }`} />
                    {i < timeline.length - 1 && (
                      <div className="w-px flex-1 bg-gray-800 mt-1" />
                    )}
                  </div>
                  <div className="pb-4 flex-1 min-w-0">
                    <p className="text-sm text-white">{event.texte}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{fmtDateTime(event.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
