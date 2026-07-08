import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import StatutButton from './_components/StatutButton'

/* ─── helpers ─────────────────────────────────────────────────────── */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 7)   return `Il y a ${days} j`
  if (days < 30)  return `Il y a ${Math.floor(days / 7)} sem.`
  if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`
  return `Il y a ${Math.floor(days / 365)} an${Math.floor(days / 365) > 1 ? 's' : ''}`
}

function idCourt(id: string): string {
  return `A-${id.slice(0, 8).toUpperCase()}`
}

function methodLabel(m: string): string {
  if (m === 'paypal') return 'PayPal'
  return 'Stripe'
}

/* ─── badge statut ────────────────────────────────────────────────── */

type UIStatut = 'actif' | 'annulation en cours' | 'en attente' | 'annulé'

const STATUT_BADGE: Record<UIStatut, string> = {
  'actif':               'bg-green-500/15 text-green-400 border border-green-500/20',
  'annulation en cours': 'bg-gray-500/15 text-gray-400 border border-gray-500/20',
  'en attente':          'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  'annulé':              'bg-red-500/15 text-red-400 border border-red-500/20',
}

const COMMANDE_STATUT_BADGE: Record<string, string> = {
  payee:      'bg-green-500/15 text-green-400 border border-green-500/20',
  en_attente: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  remboursee: 'bg-red-500/15 text-red-400 border border-red-500/20',
  litige:     'bg-orange-500/15 text-orange-400 border border-orange-500/20',
  echouee:    'bg-rose-500/15 text-rose-400 border border-rose-500/20',
}

const COMMANDE_STATUT_LABEL: Record<string, string> = {
  payee: 'Payée', en_attente: 'En attente', remboursee: 'Remboursée', litige: 'Litige', echouee: 'Échouée',
}

/* ─── page ────────────────────────────────────────────────────────── */

export default async function AbonnementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  type AboDetail = {
    id: string
    client_id: string | null
    beatmaker_id: string
    created_at: string
    plan: string
    periode: string
    prix: number
    devise: string
    statut: 'actif' | 'annule' | 'impaye'
    date_debut: string
    date_fin: string
    date_annulation: string | null
    methode_paiement: string
    annulation_en_cours: boolean
    mensualites_payees: number | null
    mois_consecutifs: number
    acheteur_email: string | null
    acheteur_nom: string | null
    stripe_subscription_id: string | null
    clients: { id: string; prenom: string | null; nom: string; email: string; pays: string | null } | null
  }

  /* ── queries parallèles ── */
  const [{ data: rawAbo }, { data: beatmakerData }, { data: tentativesRaw }] = await Promise.all([
    admin
      .from('abonnements_boutique')
      .select(`
        id, client_id, beatmaker_id, created_at,
        plan, periode, prix, devise,
        statut, date_debut, date_fin, date_annulation,
        methode_paiement, annulation_en_cours,
        mensualites_payees, mois_consecutifs,
        acheteur_email, acheteur_nom, stripe_subscription_id,
        clients (id, prenom, nom, email, pays)
      `)
      .eq('id', id)
      .eq('beatmaker_id', user.id)
      .single(),

    admin
      .from('beatmakers')
      .select('abo_nom, abo_prix')
      .eq('id', user.id)
      .single(),

    // Échecs de renouvellement — rien n'est payé, donc pas de commande, mais
    // on veut les voir malgré tout (cf. tentatives_paiement, Phase 2b étendue)
    admin
      .from('tentatives_paiement')
      .select('id, created_at, prix, statut')
      .eq('type', 'renouvellement_abonnement')
      .eq('abonnement_id', id)
      .order('created_at', { ascending: false }),
  ])

  const tentativesEchouees = tentativesRaw ?? []

  const abo = rawAbo as unknown as AboDetail | null
  if (!abo) notFound()

  /* ── commandes associées ── */
  const clientId = abo.client_id
  let commandesAssociees: Array<{
    id: string
    created_at: string
    statut: string
    type_commande: string | null
    prix_paye: number
    devise: string
  }> = []

  if (clientId) {
    const { data: cmds } = await admin
      .from('commandes')
      .select('id, created_at, statut, type_commande, prix_paye, devise')
      .eq('beatmaker_id', user.id)
      .eq('client_id', clientId)
      .in('type_commande', ['CREATION_ABONNEMENT', 'RENOUVELLEMENT'])
      .order('created_at', { ascending: false })

    commandesAssociees = cmds ?? []
  }

  /* ── dériver les champs affichés ── */
  const uiStatut: UIStatut = abo.annulation_en_cours
    ? 'annulation en cours'
    : abo.statut === 'annule'
    ? 'annulé'
    : abo.statut === 'impaye'
    ? 'en attente'
    : 'actif'

  const nomClient = abo.clients
    ? [abo.clients.prenom, abo.clients.nom].filter(Boolean).join(' ')
    : (abo.acheteur_nom ?? abo.acheteur_email ?? '—')

  const email = abo.clients?.email ?? abo.acheteur_email ?? '—'
  const pays  = abo.clients?.pays ?? null

  const planNom = beatmakerData?.abo_nom ?? 'Abonnement Standard'
  const prixEuros = abo.prix / 100
  const ht  = parseFloat((prixEuros / 1.2).toFixed(2))
  const tva = parseFloat((prixEuros - ht).toFixed(2))

  const nbRenouvellements = Math.max(0, (abo.mensualites_payees ?? 1) - 1)
  const totalEncaisse     = (abo.mensualites_payees ?? 0) * prixEuros

  const commandeParente = commandesAssociees.find(c => c.type_commande === 'CREATION_ABONNEMENT')

  const paiementSuivant = (abo.statut === 'actif' && !abo.annulation_en_cours) ? abo.date_fin : null
  const dateFinDisplay  = (abo.statut === 'annule' || abo.annulation_en_cours)  ? abo.date_fin : null

  /* ── historique auto-généré ── */
  type Evt = { texte: string; date: string }
  const events: Evt[] = []

  if (commandeParente) {
    events.push({
      texte: `Abonnement créé via la boutique en ligne · Commande parente ${idCourt(commandeParente.id)}.`,
      date:  commandeParente.created_at,
    })
    events.push({
      texte: 'Paiement initial confirmé · Statut passé de En attente à Actif.',
      date:  commandeParente.created_at,
    })
  } else {
    events.push({ texte: 'Abonnement créé.', date: abo.date_debut })
  }

  commandesAssociees
    .filter(c => c.type_commande === 'RENOUVELLEMENT')
    .slice()
    .reverse()
    .forEach(c => {
      events.push({ texte: `Commande de renouvellement ${idCourt(c.id)} créée.`, date: c.created_at })
      events.push({ texte: 'Paiement confirmé · En attente → Actif.',             date: c.created_at })
    })

  tentativesEchouees
    .slice()
    .reverse()
    .forEach(t => {
      events.push({ texte: `Renouvellement échoué (${t.prix.toFixed(2)}€) · Statut passé à En attente.`, date: t.created_at })
    })

  if (abo.annulation_en_cours) {
    events.push({
      texte: "Le client a demandé l'annulation. Accès maintenu jusqu'à la fin de la période en cours.",
      date: abo.date_annulation ?? new Date().toISOString(),
    })
  }
  if (abo.statut === 'annule' && abo.date_fin) {
    events.push({ texte: 'Abonnement résilié. Accès révoqué.', date: abo.date_fin })
  }

  const historique = events.reverse()

  /* ── ligne fusionnée pour "Commandes associées" (commandes + tentatives échouées) ── */
  type LigneAssociee = {
    id: string
    created_at: string
    relation: string
    statut: string
    prix: number
    lienCommande: boolean
  }

  const lignesAssociees: LigneAssociee[] = [
    ...commandesAssociees.map(c => ({
      id: c.id,
      created_at: c.created_at,
      relation: c.type_commande === 'CREATION_ABONNEMENT' ? 'Commande parente' : 'Commande de renouvellement',
      statut: c.statut,
      prix: c.prix_paye,
      lienCommande: true,
    })),
    ...tentativesEchouees.map(t => ({
      id: t.id,
      created_at: t.created_at,
      relation: 'Tentative de renouvellement',
      statut: 'echouee',
      prix: t.prix,
      lienCommande: false,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-7">
          <Link href="/dashboard/business/abonnements" className="text-gray-600 hover:text-white transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7-7 7"/>
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold">Abonnement {idCourt(abo.id)}</h1>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUT_BADGE[uiStatut]}`}>
                {uiStatut.charAt(0).toUpperCase() + uiStatut.slice(1)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {nomClient} · {planNom} · {formatDate(abo.date_debut)}
            </p>
          </div>
        </div>

        {/* Grid 2/3 + 1/3 */}
        <div className="grid grid-cols-3 gap-5">

          {/* ── MAIN ──────────────────────────────────────────── */}
          <div className="col-span-2 space-y-4">

            {/* Abonné */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-4">Abonné</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">Client</p>
                    <div className="flex items-center gap-2">
                      {pays && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`https://flagcdn.com/w40/${pays.toLowerCase()}.png`} alt="" className="w-5 h-3.5 object-cover rounded-sm flex-shrink-0" />
                      )}
                      {abo.client_id ? (
                        <Link href={`/dashboard/business/contacts/${abo.client_id}`} className="text-sm font-medium text-white hover:text-indigo-300 transition-colors">
                          {nomClient}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-white">{nomClient}</p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">Méthode de paiement</p>
                    <p className="text-sm text-gray-300">{methodLabel(abo.methode_paiement)}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">Plan</p>
                    <p className="text-sm text-gray-300">{planNom}</p>
                  </div>
                  {commandeParente && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">Commande parente</p>
                      <Link
                        href={`/dashboard/business/commandes/${commandeParente.id}`}
                        className="text-sm font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        {idCourt(commandeParente.id)}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Articles */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Article</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Prix HT</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Qté</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Total HT</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">TVA (20%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-white">{planNom}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Facturation mensuelle</p>
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-gray-300">€{ht.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right text-sm text-gray-300">×1</td>
                    <td className="px-5 py-4 text-right text-sm text-gray-300">€{ht.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right text-sm text-gray-300">€{tva.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              {/* Totaux */}
              <div className="border-t border-gray-800 px-5 py-4 flex justify-end">
                <div className="w-60 space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Sous-total HT</span>
                    <span>€{ht.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>TVA (20%)</span>
                    <span>€{tva.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-white pt-2 border-t border-gray-800">
                    <span>Total / mois</span>
                    <span>€{prixEuros.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Commandes associées */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Commandes associées</h2>
                <span className="text-[10px] text-gray-600">{lignesAssociees.length}</span>
              </div>
              {lignesAssociees.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-600">N° commande</th>
                      <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-600">Relation</th>
                      <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-600">Date</th>
                      <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-600">État</th>
                      <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {lignesAssociees.map(c => (
                      <tr key={c.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="px-5 py-2.5">
                          {c.lienCommande ? (
                            <Link href={`/dashboard/business/commandes/${c.id}`} className="text-sm font-mono text-indigo-400 hover:text-indigo-300 transition-colors">
                              {idCourt(c.id)}
                            </Link>
                          ) : (
                            <span className="text-sm font-mono text-gray-600">{idCourt(c.id)}</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5">
                          <span className="text-xs text-gray-400">{c.relation}</span>
                        </td>
                        <td className="px-5 py-2.5">
                          <span className="text-xs text-gray-500" title={formatDate(c.created_at)}>
                            {formatRelative(c.created_at)}
                          </span>
                        </td>
                        <td className="px-5 py-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${COMMANDE_STATUT_BADGE[c.statut] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>
                            {COMMANDE_STATUT_LABEL[c.statut] ?? c.statut}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <span className="text-sm font-medium text-white">€{c.prix.toFixed(2)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-5 py-8 text-xs text-gray-700 text-center">Aucune commande associée</p>
              )}
            </div>

            {/* Historique */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-800">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Historique</h2>
              </div>
              <div className="divide-y divide-gray-800/50">
                {historique.map((h, i) => (
                  <div key={i} className="px-5 py-3 flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-300">{h.texte}</p>
                      <p className="text-xs text-gray-600 mt-0.5" title={formatDate(h.date)}>
                        {formatRelative(h.date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── SIDEBAR ───────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Actions */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-4">Actions</h2>
              <StatutButton
                aboId={abo.id}
                statut={abo.statut}
                annulationEnCours={abo.annulation_en_cours}
              />
            </div>

            {/* Programmer */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-4">Programmer</h2>
              <div className="space-y-0 divide-y divide-gray-800">
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-xs text-gray-500">Date de début</span>
                  <span className="text-xs text-gray-300">{formatDate(abo.date_debut)}</span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-xs text-gray-500">Paiement suivant</span>
                  <span className={`text-xs ${paiementSuivant ? 'text-gray-300' : 'text-gray-700'}`}>
                    {formatDate(paiementSuivant)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-xs text-gray-500">Date de fin</span>
                  <span className={`text-xs ${dateFinDisplay ? 'text-gray-300' : 'text-gray-700'}`}>
                    {formatDate(dateFinDisplay)}
                  </span>
                </div>
              </div>
            </div>

            {/* Statistiques */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-4">Statistiques</h2>
              <div className="space-y-0 divide-y divide-gray-800">
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-xs text-gray-500">Renouvellements</span>
                  <span className="text-xs font-semibold text-white">{nbRenouvellements}</span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-xs text-gray-500">Total encaissé</span>
                  <span className="text-xs font-semibold text-white">€{totalEncaisse.toFixed(2)}</span>
                </div>
                {abo.mois_consecutifs > 0 && (
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-xs text-gray-500">Mois consécutifs</span>
                    <span className="text-xs font-semibold text-white">{abo.mois_consecutifs}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Infos Stripe */}
            {abo.stripe_subscription_id && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">Stripe</h2>
                <p className="text-[10px] text-gray-600 mb-1">Subscription ID</p>
                <p className="text-xs font-mono text-gray-400 break-all">{abo.stripe_subscription_id}</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
