import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import RenvoyerButton from './_components/RenvoyerButton'
import CopyButton from './_components/CopyButton'
import RemboursementButton from './_components/RemboursementButton'
import AnnulerCommandeButton from './_components/AnnulerCommandeButton'
import { STATUTS_REMBOURSABLES } from '@/lib/remboursement'
import ReprendreLivraisonButton from './_components/ReprendreLivraisonButton'
import { calculerStatutLivraison } from '@/lib/livraison-statut'
import { fuseauSur, formatDateTz, formatDateTimeTz } from '@/lib/fuseau-horaire'
import VueCollaborateur from './_components/VueCollaborateur'
import { decomposerTva } from '@/lib/collaboration-parts'

/* ─── types ──────────────────────────────────────────────────────── */

type Note = { texte: string; date: string }

type LigneDetail = {
  id: string
  beat_id: string
  licence_id: string
  prix_paye: number
  reduction_montant: number | null
  contrat_pdf_url: string | null
  type_transaction: string | null
  licence_nom: string | null
  licence_inclut_mp3: boolean | null
  licence_inclut_wav: boolean | null
  licence_inclut_stems: boolean | null
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

type CommandeDetail = {
  id: string
  created_at: string
  prix_paye: number
  statut: 'en_attente' | 'payee' | 'remboursee' | 'litige' | 'annulee' | 'remboursement_incomplet' | 'remboursee_partielle'
  licence_annulee_at: string | null
  licence_annulee_motif: string | null
  montant_rembourse_cents: number
  rembourse_at: string | null
  methode_paiement: string | null
  code_promo: string | null
  reduction_montant: number | null
  fichiers_livres: boolean | null
  statut_livraison: 'en_cours' | 'livree' | 'probleme'
  facture_pdf_url: string | null
  numero_facture: string | null
  source_marketing: string | null
  type_commande: string | null
  plateforme_source: string | null
  acheteur_email: string | null
  acheteur_nom: string | null
  acheteur_adresse: string | null
  acheteur_telephone: string | null
  acheteur_raison_sociale: string | null
  acheteur_numero_tva: string | null
  notes: Note[] | null
  client_id: string | null
  stripe_transfer_group: string | null
  tva_taux: number | null
  clients: {
    id: string
    prenom: string | null
    nom: string
    email: string
    pays: string | null
  } | null
  commande_lignes: LigneDetail[]
}

type TrancheDetail = {
  id: string
  vendeur_id: string | null
  vendeur_nom: string
  est_proprietaire: boolean
  quote_part_pct: number | null
  montant_ttc_cents: number
  montant_ht_cents: number | null
  montant_tva_cents: number | null
  tva_taux: number | null
  frais_stripe_cents: number | null
  net_cents: number | null
  facture_numero: string | null
  facture_pdf_url: string | null
  detail_lignes: { beat_id: string; licence_id: string; pourcentage: number; montant_cents: number }[] | null
  montant_rembourse_cents: number
  statut: string
  rembourse_par: string | null
  rembourse_at: string | null
  remboursement_erreur: string | null
}

type AvoirDetail = {
  id: string
  tranche_id: string | null
  vendeur_id: string | null
  numero: string
  montant_cents: number
  pdf_url: string | null
  created_at: string
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
  annulee:    { label: 'Annulée',    cls: 'bg-gray-700/40   text-gray-300   border border-gray-600' },
  remboursement_incomplet: { label: 'Remboursement incomplet', cls: 'bg-red-500/15 text-red-300 border border-red-500/30' },
  remboursee_partielle:    { label: 'Remboursée en partie',   cls: 'bg-orange-500/15 text-orange-300 border border-orange-500/20' },
} as const

const MOTIF_LICENCE_ANNULEE: Record<string, string> = {
  remboursement: 'commande remboursée',
  annulation: 'commande annulée',
  remboursement_vendeur: 'une part a été rendue au client depuis Stripe',
  litige_perdu: 'litige perdu',
}

const TYPES_ABONNEMENT = new Set(['CREATION_ABONNEMENT', 'RENOUVELLEMENT'])

const STATUT_LIVRAISON = {
  en_cours: { label: 'En cours',           cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/20' },
  livree:   { label: 'Livrée',             cls: 'bg-green-500/15 text-green-400 border border-green-500/20' },
  probleme: { label: 'Problème détecté',   cls: 'bg-red-500/15   text-red-400   border border-red-500/20' },
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

function dateRelative(iso: string, tz: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 2)   return 'à l\'instant'
  if (mins < 60)  return `il y a ${mins} min`
  if (hours < 24) return `il y a ${hours}h`
  if (days === 1) return 'hier'
  if (days < 30)  return `il y a ${days} jours`
  return fmtDate(iso, tz)
}

function fmtDate(iso: string, tz: string) {
  return formatDateTz(iso, tz, { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtDateTime(iso: string, tz: string) {
  return formatDateTimeTz(iso, tz, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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

  const { data: beatmakerRow } = await supabase.from('beatmakers').select('fuseau_horaire').eq('id', user.id).single()
  const tz = fuseauSur(beatmakerRow?.fuseau_horaire)

  const { data: commande } = await admin
    .from('commandes')
    .select(`
      id, created_at, prix_paye, statut, beatmaker_id,
      methode_paiement, code_promo, reduction_montant,
      fichiers_livres, statut_livraison, facture_pdf_url, numero_facture,
      source_marketing, type_commande, plateforme_source,
      acheteur_email, acheteur_nom, acheteur_adresse, acheteur_telephone,
      acheteur_raison_sociale, acheteur_numero_tva,
      notes, client_id, stripe_transfer_group, tva_taux,
      licence_annulee_at, licence_annulee_motif, montant_rembourse_cents, rembourse_at,
      clients (id, prenom, nom, email, pays),
      commande_lignes (
        id, beat_id, licence_id, prix_paye, reduction_montant, contrat_pdf_url, type_transaction,
        licence_nom, licence_inclut_mp3, licence_inclut_wav, licence_inclut_stems,
        beats (id, titre, couleur, image_url, mp3_propre_url, wav_url, stems_url),
        licences (id, nom, modele, inclut_mp3, inclut_wav, inclut_stems)
      )
    `)
    .eq('id', id)
    .single()

  if (!commande) notFound()

  const c = commande as unknown as CommandeDetail & { beatmaker_id: string }

  const { data: tranchesRaw } = await admin
    .from('commande_tranches')
    .select('id, vendeur_id, vendeur_nom, est_proprietaire, quote_part_pct, montant_ttc_cents, montant_ht_cents, montant_tva_cents, tva_taux, frais_stripe_cents, net_cents, facture_numero, facture_pdf_url, detail_lignes, montant_rembourse_cents, statut, rembourse_par, rembourse_at, remboursement_erreur')
    .eq('commande_id', id)
    .order('est_proprietaire', { ascending: false })
  const tranches = (tranchesRaw ?? []) as TrancheDetail[]

  const { data: avoirsRaw } = await admin
    .from('avoirs')
    .select('id, tranche_id, vendeur_id, numero, montant_cents, pdf_url, created_at')
    .eq('commande_id', id)
    .not('numero', 'like', 'reserve-%')
    .order('created_at', { ascending: true })
  const avoirs = (avoirsRaw ?? []) as AvoirDetail[]

  // Vente en collaboration sur la boutique d'un autre (Phase 13, lot 3) : vue
  // limitée du collaborateur, identifiée par le numéro de SA facture.
  if (c.beatmaker_id !== user.id) {
    const maTranche = tranches.find(t => t.vendeur_id === user.id)
    if (!maTranche) notFound()
    const { data: boutique } = await admin.from('beatmakers').select('nom_artiste').eq('id', c.beatmaker_id).maybeSingle()
    const libelleLigne = new Map((c.commande_lignes ?? []).map(l => [
      `${l.beat_id}:${l.licence_id}`,
      { titre: l.beats?.titre ?? 'Beat', licence: l.licence_nom ?? l.licences?.nom ?? '' },
    ]))
    const statut = STATUT[c.statut] ?? { label: c.statut, cls: 'bg-gray-700 text-gray-300 border border-gray-600' }
    return (
      <VueCollaborateur
        commandeId={c.id}
        createdAt={c.created_at}
        statutLabel={statut.label}
        statutCls={statut.cls}
        boutique={boutique?.nom_artiste ?? 'la boutique'}
        codePromo={c.code_promo}
        acheteur={{ nom: c.acheteur_nom, adresse: c.acheteur_adresse, raisonSociale: c.acheteur_raison_sociale, numeroTva: c.acheteur_numero_tva }}
        tranche={{
          montantTtcCents: maTranche.montant_ttc_cents,
          montantHtCents: maTranche.montant_ht_cents,
          montantTvaCents: maTranche.montant_tva_cents,
          tvaTaux: maTranche.tva_taux,
          fraisCents: maTranche.frais_stripe_cents,
          netCents: maTranche.net_cents,
          factureNumero: maTranche.facture_numero,
          facturePdfUrl: maTranche.facture_pdf_url,
          montantRembourseCents: maTranche.montant_rembourse_cents,
          rembourseAt: maTranche.rembourse_at,
          remboursementErreur: maTranche.statut === 'remboursement_echoue' ? maTranche.remboursement_erreur : null,
        }}
        avoirs={avoirs.filter(a => a.tranche_id === maTranche.id).map(a => ({ id: a.id, numero: a.numero, url: a.pdf_url }))}
        licenceAnnuleeAt={c.licence_annulee_at}
        lignes={(maTranche.detail_lignes ?? []).map(d => ({
          ...(libelleLigne.get(`${d.beat_id}:${d.licence_id}`) ?? { titre: 'Beat', licence: '' }),
          pourcentage: d.pourcentage,
          montantCents: d.montant_cents,
        }))}
        tz={tz}
      />
    )
  }

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

  const lignes = c.commande_lignes ?? []
  const multiArticles = lignes.length > 1

  /* Détail des problèmes de livraison (Phase 5) — recalculé depuis l'état
     réel, jamais depuis un texte figé, pour ne jamais afficher un problème
     déjà réparé entre-temps sans que le statut n'ait été relu. */
  const { problemes: problemesLivraison } = c.statut_livraison === 'probleme'
    ? await calculerStatutLivraison(id)
    : { problemes: [] }
  const { data: splitsDetail } = problemesLivraison.some(p => p.type === 'transfert_echoue')
    ? await admin.from('split_payments').select('id, beatmakers(nom_artiste)').eq('commande_id', id)
    : { data: null }
  const beatParLigneId = new Map(lignes.map(l => [l.id, l.beats?.titre ?? 'Beat']))
  const nomParSplitId = new Map(((splitsDetail ?? []) as unknown as { id: string; beatmakers: { nom_artiste: string } | null }[])
    .map(sp => [sp.id, sp.beatmakers?.nom_artiste ?? 'un collaborateur']))
  const problemesTextes = problemesLivraison.map(p =>
    p.type === 'contrat_manquant'
      ? `Contrat PDF manquant — ${beatParLigneId.get(p.commandeLigneId) ?? 'un article'}`
      : `Transfert échoué vers ${nomParSplitId.get(p.splitPaymentId) ?? 'un collaborateur'}`
  )

  /* Fichiers disponibles par article (licence + fichiers audio + contrat) */
  const lignesDispo = lignes.map(l => {
    // Snapshot transactionnel (Phase 4) — ce que la licence incluait au
    // moment de l'achat (licence_inclut_*), jamais ce qu'elle inclut
    // *aujourd'hui* (l.licences.inclut_*) si elle a été modifiée depuis
    // (licences éditables, Phase 6). NULL sur les commandes antérieures à
    // la Phase 4 : comportement inchangé, on retombe sur la licence actuelle.
    const fichiers: { label: string; url: string | null }[] = []
    if (l.licences && l.beats) {
      const incluMp3 = l.licence_inclut_mp3 ?? l.licences.inclut_mp3
      const incluWav = l.licence_inclut_wav ?? l.licences.inclut_wav
      const incluStems = l.licence_inclut_stems ?? l.licences.inclut_stems
      if (incluMp3 && l.beats.mp3_propre_url)
        fichiers.push({ label: 'MP3 (sans tag)', url: l.beats.mp3_propre_url })
      if (incluWav && l.beats.wav_url)
        fichiers.push({ label: 'WAV', url: l.beats.wav_url })
      if (incluStems && l.beats.stems_url)
        fichiers.push({ label: 'Stems (ZIP)', url: l.beats.stems_url })
    }
    if (l.contrat_pdf_url)
      fichiers.push({ label: 'Contrat PDF', url: l.contrat_pdf_url })
    return { ligne: l, fichiers }
  })
  const fichiersDispos = lignesDispo.flatMap(({ ligne, fichiers }) =>
    fichiers.map(f => ({ ...f, titreArticle: ligne.beats?.titre ?? null }))
  )

  /* Données affichage */
  const s = STATUT[c.statut] ?? { label: c.statut, cls: 'bg-gray-700 text-gray-300 border border-gray-600' }
  const nomClient = c.clients
    ? [c.clients.prenom, c.clients.nom].filter(Boolean).join(' ')
    : c.acheteur_nom ?? c.acheteur_email ?? '—'
  const emailClient = c.clients?.email ?? c.acheteur_email
  const destinataire = emailClient ?? ''
  const sourceDisplay = c.source_marketing ? (SOURCE_LABEL[c.source_marketing] ?? c.source_marketing) : 'Direct'
  const uneLigneEstUpgrade = lignes.some(l => l.type_transaction === 'upgrade')
  const typeDisplay = TYPE_LABEL[c.type_commande ?? (uneLigneEstUpgrade ? 'upgrade' : '')] ?? 'Achat de licence'

  /* Calculs financiers globaux (header) — taux réellement appliqué à cette
     vente (Phase 4, snapshot transactionnel), jamais le taux *actuel* du
     beatmaker. 20% de repli uniquement pour les commandes antérieures à la
     Phase 4 (tva_taux non renseigné), comportement inchangé pour elles. */
  const remiseTTC    = c.reduction_montant ?? 0
  const prixTTC      = c.prix_paye
  const tauxTva      = c.tva_taux ?? 20
  const diviseurTva  = 1 + tauxTva / 100

  /* Vente à plusieurs vendeurs (Phase 13, lot 3) : chaque vendeur applique SA
     TVA à SA part (un non-assujetti aucune) — même calcul que les factures,
     jamais le taux de A sur le total. */
  const tvaParLigneCents = new Map<string, number>()
  for (const t of tranches) {
    for (const d of t.detail_lignes ?? []) {
      const cle = `${d.beat_id}:${d.licence_id}`
      tvaParLigneCents.set(cle, (tvaParLigneCents.get(cle) ?? 0) + decomposerTva(d.montant_cents, Number(t.tva_taux ?? 0)).tvaCents)
    }
  }
  const tauxDesParts = [...new Set(tranches.filter(t => t.montant_ttc_cents > 0).map(t => Number(t.tva_taux ?? 0)))]
  const libelleTva = tranches.length
    ? (tauxDesParts.length === 1 ? `TVA (${tauxDesParts[0]}%)` : 'TVA')
    : `TVA (${tauxTva}%)`
  const tvaDeLigne = (l: LigneDetail) => tranches.length
    ? (tvaParLigneCents.get(`${l.beat_id}:${l.licence_id}`) ?? 0) / 100
    : l.prix_paye - l.prix_paye / diviseurTva

  const tva          = tranches.length
    ? tranches.reduce((s, t) => s + (t.montant_tva_cents ?? 0), 0) / 100
    : prixTTC - prixTTC / diviseurTva
  const prixHT       = prixTTC - tva
  const remiseHT     = prixTTC > 0 ? remiseTTC * (prixHT / prixTTC) : remiseTTC / diviseurTva
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

  const estAbonnement = TYPES_ABONNEMENT.has(c.type_commande ?? '')
  const resteARembourserCents = tranches.length
    ? tranches.reduce((s, t) => s + Math.max(t.montant_ttc_cents - t.montant_rembourse_cents, 0), 0)
    : Math.round(prixTTC * 100) - (c.montant_rembourse_cents ?? 0)
  const tranchesEnEchec = tranches.filter(t => t.statut === 'remboursement_echoue')
  const tranchesRembourseesParVendeur = tranches.filter(t => t.rembourse_par === 'vendeur_stripe' && t.montant_rembourse_cents > 0)
  const nomVendeurAvoir = new Map(tranches.map(t => [t.id, t.vendeur_nom]))
  const montantRembourseCents = tranches.length
    ? tranches.reduce((s, t) => s + t.montant_rembourse_cents, 0)
    : c.montant_rembourse_cents ?? 0

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
              Paiement via {c.methode_paiement ?? 'Stripe'} · {dateRelative(c.created_at, tz)} · Origine : {sourceDisplay}
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
                <p className="text-sm text-gray-300">{dateRelative(c.created_at, tz)}</p>
                <p className="text-xs text-gray-600">{fmtDate(c.created_at, tz)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">État</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${s.cls}`}>
                  {s.label}
                </span>
              </div>
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">Livraison</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUT_LIVRAISON[c.statut_livraison]?.cls ?? STATUT_LIVRAISON.en_cours.cls}`}>
                  {STATUT_LIVRAISON[c.statut_livraison]?.label ?? 'En cours'}
                </span>
                {problemesTextes.length > 0 && (
                  <>
                    <ul className="mt-1.5 space-y-0.5">
                      {problemesTextes.map((texte, i) => (
                        <li key={i} className="text-xs text-red-400">{texte}</li>
                      ))}
                    </ul>
                    <div className="mt-2">
                      <ReprendreLivraisonButton commandeId={id} />
                    </div>
                  </>
                )}
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
              {c.acheteur_raison_sociale && (
                <div>
                  <p className="text-[10px] text-gray-600 mb-0.5">Raison sociale</p>
                  <p className="text-sm text-gray-300">{c.acheteur_raison_sociale}</p>
                </div>
              )}
              {c.acheteur_numero_tva && (
                <div>
                  <p className="text-[10px] text-gray-600 mb-0.5">N° de TVA intracommunautaire</p>
                  <p className="font-mono text-sm text-gray-300">{c.acheteur_numero_tva}</p>
                </div>
              )}
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
                <p className="text-[10px] text-gray-600 mb-0.5">Adresse</p>
                <p className="text-sm text-gray-300">{c.acheteur_adresse ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">Téléphone</p>
                {c.acheteur_telephone ? (
                  <a href={`tel:${c.acheteur_telephone}`} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                    {c.acheteur_telephone}
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
                <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">{libelleTva}</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(l => {
                const ligneTTC       = l.prix_paye
                const ligneRemiseTTC = l.reduction_montant ?? 0
                const ligneTva       = tvaDeLigne(l)
                const ligneHT        = ligneTTC - ligneTva
                const ligneRemiseHT  = ligneTTC > 0 ? ligneRemiseTTC * (ligneHT / ligneTTC) : ligneRemiseTTC / diviseurTva
                const ligneHtAvantRemise = ligneHT + ligneRemiseHT
                const produitLabel = l.beats && l.licences
                  ? `${l.beats.titre} — Licence ${l.licences.modele}`
                  : l.beats?.titre ?? '—'
                return (
                  <tr key={l.id} className="border-b border-gray-800/50">
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-200">{produitLabel}</p>
                      {l.type_transaction === 'upgrade' && (
                        <span className="text-[10px] text-purple-400 font-medium">↑ Upgrade</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-gray-400">€{ligneHtAvantRemise.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right text-sm text-gray-400">× 1</td>
                    <td className="px-5 py-4 text-right">
                      <p className="text-sm text-gray-300">€{ligneHtAvantRemise.toFixed(2)}</p>
                      {ligneRemiseHT > 0 && (
                        <p className="text-xs text-green-400 mt-0.5">remise de €{ligneRemiseHT.toFixed(2)}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-gray-400">€{ligneTva.toFixed(2)}</td>
                  </tr>
                )
              })}
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
                <span className="text-gray-500">{libelleTva}</span>
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
              {montantRembourseCents > 0 && (
                <div className="flex items-center gap-8 text-sm">
                  <span className="text-gray-500">Remboursé</span>
                  <span className="text-red-400 w-24 text-right font-semibold">−€{(montantRembourseCents / 100).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Bouton remboursement — caché si produit déjà téléchargé.
              Vente avec collaborateur(s) : badge à la place, remboursement
              Stripe pas encore automatisé (clawback des parts déjà transférées
              gelé jusqu'au choix du processeur collab, Phase 13). */}
          {c.statut === 'payee' && c.stripe_transfer_group && !tranches.length && (
            <div className="px-5 py-3 border-t border-gray-800">
              <span className="text-xs text-amber-400">Vente avec collaborateur(s) (ancien système) — remboursement à traiter manuellement.</span>
            </div>
          )}
          {/* Remboursement (Phase 13, lot 4a) : tant qu'il reste de l'argent
              au vendeur, même après téléchargement (A décide, la fenêtre de
              confirmation le prévient). Commande à 0 € : annulation. */}
          {!estAbonnement && prixTTC === 0 && c.statut === 'payee' && (
            <div className="px-5 py-3 border-t border-gray-800">
              <AnnulerCommandeButton commandeId={id} />
            </div>
          )}
          {!estAbonnement && prixTTC > 0 && STATUTS_REMBOURSABLES.has(c.statut) && resteARembourserCents > 0 && !(c.stripe_transfer_group && !tranches.length) && (
            <div className="px-5 py-3 border-t border-gray-800">
              <RemboursementButton
                commandeId={id}
                tz={tz}
                libelle={c.statut === 'remboursement_incomplet' ? 'Réessayer le remboursement' : c.statut === 'remboursee_partielle' ? 'Rembourser le reste' : 'Remboursement'}
              />
            </div>
          )}
          {(c.licence_annulee_at || tranchesEnEchec.length > 0 || tranchesRembourseesParVendeur.length > 0) && (
            <div className="px-5 py-3 border-t border-gray-800 space-y-1">
              {tranchesEnEchec.map(t => (
                <p key={t.id} className="text-xs text-red-400">
                  La part de {t.vendeur_nom} (€{((t.montant_ttc_cents - t.montant_rembourse_cents) / 100).toFixed(2)}) n&apos;a pas pu être remboursée
                  {t.remboursement_erreur ? ` : ${t.remboursement_erreur}` : ''}.
                </p>
              ))}
              {tranchesRembourseesParVendeur.map(t => (
                <p key={t.id} className="text-xs text-orange-300">
                  {t.est_proprietaire ? 'Tu as' : `${t.vendeur_nom} a`} remboursé {t.est_proprietaire ? 'ta' : 'sa'} part (€{(t.montant_rembourse_cents / 100).toFixed(2)}) directement depuis Stripe
                  {t.rembourse_at ? ` le ${fmtDate(t.rembourse_at, tz)}` : ''}.
                </p>
              ))}
              {c.licence_annulee_at && (
                <p className="text-xs text-gray-400">
                  Licence annulée le {fmtDate(c.licence_annulee_at, tz)} ({MOTIF_LICENCE_ANNULEE[c.licence_annulee_motif ?? ''] ?? 'annulée'}) : l&apos;accès aux fichiers est fermé.
                </p>
              )}
            </div>
          )}
        </div>

        {/* RÉPARTITION — vente à plusieurs vendeurs (Phase 13) : un encaissement
            et une facture par vendeur, frais Stripe et net lus sur chaque
            encaissement. */}
        {tranches.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-4">Répartition</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-gray-600">
                  <th className="text-left pb-2">Vendeur</th>
                  <th className="text-right pb-2">Part</th>
                  <th className="text-right pb-2">Montant</th>
                  <th className="text-right pb-2">TVA</th>
                  <th className="text-right pb-2">Frais Stripe</th>
                  <th className="text-right pb-2">Net</th>
                  <th className="text-right pb-2">Remboursé</th>
                  <th className="text-right pb-2">Facture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {tranches.map(t => (
                  <tr key={t.id}>
                    <td className="py-2 text-gray-200">{t.vendeur_nom}{t.est_proprietaire && <span className="text-gray-600 text-xs"> (toi)</span>}</td>
                    <td className="py-2 text-right text-gray-400">{t.quote_part_pct != null ? `${t.quote_part_pct} %` : 'mixte'}</td>
                    <td className="py-2 text-right text-gray-300">€{(t.montant_ttc_cents / 100).toFixed(2)}</td>
                    <td className="py-2 text-right text-gray-400">
                      {t.tva_taux && Number(t.tva_taux) > 0
                        ? <>€{((t.montant_tva_cents ?? 0) / 100).toFixed(2)} <span className="text-gray-600 text-xs">({Number(t.tva_taux)} %)</span></>
                        : '—'}
                    </td>
                    <td className="py-2 text-right text-gray-400">{t.frais_stripe_cents != null ? `−€${(t.frais_stripe_cents / 100).toFixed(2)}` : '—'}</td>
                    <td className="py-2 text-right text-green-400">{t.net_cents != null ? `€${(t.net_cents / 100).toFixed(2)}` : '—'}</td>
                    <td className="py-2 text-right">
                      {t.statut === 'remboursement_echoue'
                        ? <span className="text-xs text-red-400">échec</span>
                        : t.montant_rembourse_cents > 0
                          ? <span className="text-red-400">−€{(t.montant_rembourse_cents / 100).toFixed(2)}</span>
                          : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="py-2 text-right">
                      {t.facture_pdf_url ? (
                        <a href={t.facture_pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300">n° {t.facture_numero}</a>
                      ) : (
                        <span className="text-xs text-gray-600">{t.montant_ttc_cents === 0 ? 'offert' : '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* HISTORIQUE DES TÉLÉCHARGEMENTS */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Historique des téléchargements</p>
            {aTelechargé ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-amber-500/10 text-amber-400 border-amber-500/20">
                Téléchargé — remboursement plus obligatoire
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-green-500/10 text-green-400 border-green-500/20">
                Jamais téléchargé
              </span>
            )}
          </div>

          {/* Badges fichiers inclus */}
          {fichiersDispos.length > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {fichiersDispos.map((f, i) => (
                <span key={`${f.titreArticle}-${f.label}-${i}`} className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-gray-800 text-gray-400 border-gray-700">
                  {multiArticles && f.titreArticle ? `${f.titreArticle} — ${f.label}` : f.label}
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
                      {dateRelative(dl.downloaded_at, tz)}
                      <span className="block text-[10px] text-gray-600">{fmtDateTime(dl.downloaded_at, tz)}</span>
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
            {fichiersDispos.map((f, i) => f.url ? (
              <div key={`${f.titreArticle}-${f.label}-${i}`} className="flex items-center justify-between gap-4 bg-gray-800/40 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-medium text-gray-400 w-36 shrink-0">
                    {multiArticles && f.titreArticle ? `${f.titreArticle} — ${f.label}` : f.label}
                  </span>
                  <span className="text-xs font-mono text-gray-600 truncate">{f.url}</span>
                </div>
                <CopyButton text={f.url} />
              </div>
            ) : null)}
            {tranches.filter(t => t.facture_pdf_url).map(t => (
              <div key={t.id} className="flex items-center justify-between gap-4 bg-gray-800/40 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-medium text-gray-400 w-36 shrink-0">
                    Facture n° {t.facture_numero} ({t.vendeur_nom})
                  </span>
                  <span className="text-xs font-mono text-gray-600 truncate">{t.facture_pdf_url}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={t.facture_pdf_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                  >
                    Ouvrir
                  </a>
                  <CopyButton text={t.facture_pdf_url!} />
                </div>
              </div>
            ))}
            {avoirs.filter(a => a.pdf_url).map(a => (
              <div key={a.id} className="flex items-center justify-between gap-4 bg-gray-800/40 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-medium text-gray-400 w-36 shrink-0">
                    Avoir n° {a.numero}{a.tranche_id && nomVendeurAvoir.get(a.tranche_id) ? ` (${nomVendeurAvoir.get(a.tranche_id)})` : ''} · −€{(a.montant_cents / 100).toFixed(2)}
                  </span>
                  <span className="text-xs font-mono text-gray-600 truncate">{a.pdf_url}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={a.pdf_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                  >
                    Ouvrir
                  </a>
                  <CopyButton text={a.pdf_url!} />
                </div>
              </div>
            ))}
            {c.facture_pdf_url && (
              <div className="flex items-center justify-between gap-4 bg-gray-800/40 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-medium text-gray-400 w-36 shrink-0">
                    Facture {c.numero_facture ? `n° ${c.numero_facture}` : 'PDF'}
                  </span>
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
                <p className="text-[10px] text-gray-600 mt-1">{fmtDateTime(e.date, tz)}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
