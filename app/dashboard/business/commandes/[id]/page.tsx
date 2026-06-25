import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import RenvoyerButton from './_components/RenvoyerButton'
import CopyButton from './_components/CopyButton'
import RemboursementButton from './_components/RemboursementButton'

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
  type_commande: string | null
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
  beats: {
    id: string
    titre: string
    couleur: string | null
    image_url: string | null
    mp3_propre_url: string | null
    wav_url: string | null
    stems_url: string | null
  } | null
  licences: {
    id: string
    nom: string
    modele: string
    inclut_mp3: boolean
    inclut_wav: boolean
    inclut_stems: boolean
  } | null
}

type HistoriqueCommande = {
  id: string
  created_at: string
  prix_paye: number
  statut: string
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

const TYPE_LABEL: Record<string, string> = {
  LICENCE:             'Achat de licence',
  CREATION_ABONNEMENT: "Création d'abonnement",
  RENOUVELLEMENT:      'Renouvellement',
  achat:               'Achat de licence',
  upgrade:             'Upgrade de licence',
}

/* ─── helpers ────────────────────────────────────────────────────── */

function dateRelative(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 2)   return 'à l\'instant'
  if (mins < 60)  return `il y a ${mins} min`
  if (hours < 24) return `il y a ${hours}h`
  if (days === 1) return 'hier'
  if (days < 30)  return `il y a ${days} jours`
  return fmtDate(iso)
}

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  const { data: commande } = await admin
    .from('commandes')
    .select(`
      id, created_at, prix_paye, devise, statut,
      methode_paiement, code_promo, reduction_montant,
      fichiers_livres, contrat_pdf_url, facture_pdf_url,
      source_marketing, type_transaction, type_commande, plateforme_source,
      acheteur_email, acheteur_nom, notes, client_id,
      clients (id, prenom, nom, email, pays),
      beats (id, titre, couleur, image_url, mp3_propre_url, wav_url, stems_url),
      licences (id, nom, modele, inclut_mp3, inclut_wav, inclut_stems)
    `)
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .single()

  if (!commande) notFound()

  const c = commande as unknown as CommandeDetail

  /* Historique client */
  let historiqueClient: HistoriqueCommande[] = []
  if (c.client_id) {
    const { data } = await admin
      .from('commandes')
      .select('id, created_at, prix_paye, statut')
      .eq('beatmaker_id', user.id)
      .eq('client_id', c.client_id)
      .order('created_at', { ascending: false })
    historiqueClient = (data ?? []) as HistoriqueCommande[]
  }

  const ltv = historiqueClient
    .filter(h => h.statut === 'payee')
    .reduce((sum, h) => sum + (h.prix_paye ?? 0), 0)

  /* Historique téléchargements */
  const { data: downloadsRaw } = await admin
    .from('licence_downloads')
    .select('id, fichier, downloaded_at, ip_address')
    .eq('commande_id', id)
    .order('downloaded_at', { ascending: false })
  const downloads = (downloadsRaw ?? []) as { id: string; fichier: string; downloaded_at: string; ip_address: string | null }[]

  /* Fichiers disponibles selon la licence */
  const fichiersDispos: { label: string; url: string | null }[] = []
  if (c.licences && c.beats) {
    if (c.licences.inclut_mp3 && c.beats.mp3_propre_url)
      fichiersDispos.push({ label: 'MP3 (sans tag)', url: c.beats.mp3_propre_url })
    if (c.licences.inclut_wav && c.beats.wav_url)
      fichiersDispos.push({ label: 'WAV', url: c.beats.wav_url })
    if (c.licences.inclut_stems && c.beats.stems_url)
      fichiersDispos.push({ label: 'Stems (ZIP)', url: c.beats.stems_url })
  }
  if (c.contrat_pdf_url)
    fichiersDispos.push({ label: 'Contrat PDF', url: c.contrat_pdf_url })

  /* Données affichage */
  const s = STATUT[c.statut] ?? { label: c.statut, cls: 'bg-gray-700 text-gray-300 border border-gray-600' }
  const nomClient = c.clients
    ? [c.clients.prenom, c.clients.nom].filter(Boolean).join(' ')
    : c.acheteur_nom ?? c.acheteur_email ?? '—'
  const emailClient = c.clients?.email ?? c.acheteur_email
  const destinataire = emailClient ?? ''
  const sourceDisplay = c.source_marketing ? (SOURCE_LABEL[c.source_marketing] ?? c.source_marketing) : 'Direct'
  const typeDisplay = TYPE_LABEL[c.type_commande ?? c.type_transaction ?? ''] ?? 'Achat de licence'

  /* Label article format proto : "Beat — Licence MP3" */
  const produitLabel = c.beats && c.licences
    ? `${c.beats.titre} — Licence ${c.licences.modele}`
    : c.beats?.titre ?? '—'
  const produitDetail = c.licences ? `Licence : ${c.licences.modele}` : ''

  /* Calculs financiers */
  const remiseTTC    = c.reduction_montant ?? 0
  const prixTTC      = c.prix_paye
  const prixHT       = prixTTC / 1.2
  const tva          = prixTTC - prixHT
  const remiseHT     = remiseTTC / 1.2
  const htAvantRemise = prixHT + remiseHT

  /* URL permanente de téléchargement */
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://beatplatform.vercel.app'
  const downloadPageUrl = `${APP_URL}/telechargement/${id}`

  /* Timeline auto-générée */
  type TL = { date: string; texte: string }
  const timeline: TL[] = []
  timeline.push({ date: c.created_at, texte: 'Commande créée via la boutique en ligne.' })
  if (c.statut !== 'en_attente') {
    timeline.push({ date: c.created_at, texte: `Paiement via ${c.methode_paiement ?? 'Stripe'} · ${sourceDisplay}.` })
    timeline.push({ date: c.created_at, texte: `Commande passée de En attente à ${s.label}.` })
  }
  if (c.fichiers_livres) {
    timeline.push({ date: c.created_at, texte: 'Fichiers livrés au client.' })
  }
  ;(c.notes ?? []).forEach(n => timeline.push({ date: n.date, texte: n.texte }))
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const aTelechargé = downloads.filter(d => d.fichier !== 'email_renvoi').length > 0

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/dashboard/business/commandes" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                ← Commandes
              </Link>
            </div>
            <h1 className="text-xl font-bold text-white">
              Commande #{c.id.slice(0, 8).toUpperCase()}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Paiement via {c.methode_paiement ?? 'Stripe'} · {dateRelative(c.created_at)} · Origine : {sourceDisplay}
            </p>
          </div>
          <span className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${s.cls}`}>
            {s.label}
          </span>
        </div>

        {/* 3 colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* GÉNÉRAL */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-4">Général</p>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">Date de création</p>
                <p className="text-sm text-gray-300">{dateRelative(c.created_at)}</p>
                <p className="text-xs text-gray-600">{fmtDate(c.created_at)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">État</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${s.cls}`}>
                  {s.label}
                </span>
              </div>
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">Type</p>
                <p className="text-sm text-gray-300">{typeDisplay}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">Client</p>
                {c.clients ? (
                  <Link
                    href={`/dashboard/business/contacts/${c.clients.id}`}
                    className="text-sm text-white hover:text-indigo-300 transition-colors block"
                  >
                    {nomClient}
                  </Link>
                ) : (
                  <p className="text-sm text-gray-300">{nomClient}</p>
                )}
                {emailClient && (
                  <p className="text-xs text-indigo-400 mt-0.5">{emailClient}</p>
                )}
              </div>
            </div>
          </div>

          {/* FACTURATION */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-4">Facturation</p>
            <div className="space-y-3">
              <p className="text-sm text-gray-200">{nomClient}</p>
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">Adresse e-mail</p>
                {emailClient ? (
                  <a href={`mailto:${emailClient}`} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                    {emailClient}
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">—</p>
                )}
              </div>
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">Paiement via</p>
                <p className="text-sm text-gray-300 capitalize">{c.methode_paiement ?? 'Stripe'}</p>
              </div>
              {c.code_promo && (
                <div>
                  <p className="text-[10px] text-gray-600 mb-0.5">Code promo</p>
                  <p className="font-mono text-sm text-indigo-400">{c.code_promo}</p>
                  {remiseTTC > 0 && (
                    <p className="text-xs text-green-400">−{Number(remiseTTC).toFixed(2)}€ appliqué</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Colonne droite : Attribution + Historique client */}
          <div className="space-y-4">

            {/* ATTRIBUTION DE COMMANDE */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-4">Attribution de commande</p>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] text-gray-600">Origine</p>
                  <p className="text-sm text-gray-300">{sourceDisplay}</p>
                </div>
              </div>
            </div>

            {/* HISTORIQUE DU CLIENT */}
            {c.clients && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-4">Historique du client</p>
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[10px] text-gray-600">Commandes totales</p>
                    <p className="text-sm text-gray-300">{historiqueClient.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600">Revenu total (LTV)</p>
                    <p className="text-sm text-gray-300">€{ltv.toFixed(2)}</p>
                  </div>
                  <Link
                    href={`/dashboard/business/contacts/${c.clients.id}`}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors block mt-1"
                  >
                    Voir la fiche client →
                  </Link>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ARTICLES */}
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
              <tr className="border-b border-gray-800/50">
                <td className="px-5 py-4">
                  <p className="text-sm text-gray-200">{produitLabel}</p>
                  {produitDetail && <p className="text-xs text-gray-500 mt-0.5">{produitDetail}</p>}
                </td>
                <td className="px-5 py-4 text-right text-sm text-gray-400">€{htAvantRemise.toFixed(2)}</td>
                <td className="px-5 py-4 text-right text-sm text-gray-400">× 1</td>
                <td className="px-5 py-4 text-right">
                  <p className="text-sm text-gray-300">€{htAvantRemise.toFixed(2)}</p>
                  {remiseHT > 0 && (
                    <p className="text-xs text-green-400 mt-0.5">remise de €{remiseHT.toFixed(2)}</p>
                  )}
                </td>
                <td className="px-5 py-4 text-right text-sm text-gray-400">€{(htAvantRemise * 0.2).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {/* Totaux */}
          <div className="px-5 py-4 flex items-start justify-between border-t border-gray-800">
            <div>
              {c.code_promo && (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Code promo</p>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                    {c.code_promo}
                  </span>
                </>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-8 text-sm">
                <span className="text-gray-500">Sous-total des articles</span>
                <span className="text-gray-300 w-24 text-right">€{htAvantRemise.toFixed(2)}</span>
              </div>
              {remiseHT > 0 && (
                <div className="flex items-center gap-8 text-sm">
                  <span className="text-gray-500">Remise</span>
                  <span className="text-green-400 w-24 text-right">−€{remiseHT.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center gap-8 text-sm">
                <span className="text-gray-500">TVA (20%)</span>
                <span className="text-gray-300 w-24 text-right">€{tva.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-8 text-sm font-semibold border-t border-gray-800 pt-1.5 mt-0.5">
                <span className="text-gray-300">Total de la commande</span>
                <span className="text-white w-24 text-right">€{prixTTC.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-8 text-sm">
                <span className="text-gray-500">Payé</span>
                <span className="text-green-400 w-24 text-right font-semibold">€{prixTTC.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Bouton remboursement — caché si produit déjà téléchargé */}
          {c.statut === 'payee' && !aTelechargé && (
            <div className="px-5 py-3 border-t border-gray-800">
              <RemboursementButton commandeId={id} montant={prixTTC} />
            </div>
          )}
        </div>

        {/* HISTORIQUE DES TÉLÉCHARGEMENTS */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Historique des téléchargements</p>
            {aTelechargé ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-red-500/10 text-red-400 border-red-500/20">
                Non remboursable — produit téléchargé
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-green-500/10 text-green-400 border-green-500/20">
                Remboursable — jamais téléchargé
              </span>
            )}
          </div>

          {/* Badges fichiers inclus */}
          {fichiersDispos.length > 0 && (
            <div className="flex gap-2 mb-4">
              {fichiersDispos.map(f => (
                <span key={f.label} className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-gray-800 text-gray-400 border-gray-700">
                  {f.label}
                </span>
              ))}
            </div>
          )}

          {downloads.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-600 pb-2 pr-4 w-8">#</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-600 pb-2">Fichier</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-600 pb-2">Date</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-600 pb-2">Adresse IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {downloads.map((dl, i) => (
                  <tr key={dl.id}>
                    <td className="py-2.5 pr-4 text-xs text-gray-600">{i + 1}</td>
                    <td className="py-2.5 text-sm text-gray-300 capitalize">{dl.fichier.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 text-sm text-gray-400">
                      {dateRelative(dl.downloaded_at)}
                      <span className="block text-[10px] text-gray-600">{fmtDateTime(dl.downloaded_at)}</span>
                    </td>
                    <td className="py-2.5 text-sm font-mono text-gray-500">{dl.ip_address ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">Aucun téléchargement enregistré.</p>
          )}
        </div>

        {/* LIENS DE TÉLÉCHARGEMENT */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Liens de téléchargement</p>
            {destinataire && (
              <RenvoyerButton commandeId={id} destinataire={destinataire} />
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4 bg-gray-800/40 rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[10px] font-medium text-gray-400 w-36 shrink-0">Page de téléchargement</span>
                <span className="text-xs font-mono text-gray-600 truncate">{downloadPageUrl}</span>
              </div>
              <CopyButton text={downloadPageUrl} />
            </div>
            {fichiersDispos.map(f => f.url ? (
              <div key={f.label} className="flex items-center justify-between gap-4 bg-gray-800/40 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-medium text-gray-400 w-36 shrink-0">{f.label}</span>
                  <span className="text-xs font-mono text-gray-600 truncate">{f.url}</span>
                </div>
                <CopyButton text={f.url} />
              </div>
            ) : null)}
            {c.facture_pdf_url && (
              <div className="flex items-center justify-between gap-4 bg-gray-800/40 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-medium text-gray-400 w-36 shrink-0">Facture PDF</span>
                  <span className="text-xs font-mono text-gray-600 truncate">{c.facture_pdf_url}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={c.facture_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                  >
                    Ouvrir
                  </a>
                  <CopyButton text={c.facture_pdf_url} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* HISTORIQUE */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-4">Historique</p>
          <div className="space-y-2.5">
            {timeline.map((e, i) => (
              <div key={i} className="bg-gray-800/50 rounded-lg px-4 py-3">
                <p className="text-sm text-gray-300">{e.texte}</p>
                <p className="text-[10px] text-gray-600 mt-1">{fmtDateTime(e.date)}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
