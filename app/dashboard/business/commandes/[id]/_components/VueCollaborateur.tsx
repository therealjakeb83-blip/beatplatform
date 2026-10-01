import Link from 'next/link'
import { formatDateTz, formatDateTimeTz } from '@/lib/fuseau-horaire'
import { libelleMotifLitige } from '@/lib/litiges-libelles'
import type { PartLitige } from '@/lib/litiges'

// Fiche d'une vente en collaboration vue par un collaborateur (B) — Phase 12
// Q19 / Phase 13 lot 3 : B voit exactement ce qu'imprime SA facture (nom,
// adresse, raison sociale et TVA d'un acheteur pro), sa part, ses frais et son
// net. Jamais l'email ni le téléphone du client, ni sa fiche CRM, ni la
// source marketing, ni l'historique d'achat ; aucune action (A est maître de
// la vente). Le code promo est visible : c'est lui qui explique une part à
// 0 € (beat offert, décision de Jake au lot 3).
// Lot 4b : B voit l'état du litige sur SA part et l'historique de
// téléchargement (fichier + date, jamais l'adresse IP) — exception voulue à
// « logs d'achat visibles par A seul », pour suivre un litige.

export type LigneVueCollaborateur = { titre: string; licence: string; pourcentage: number; montantCents: number }

type Props = {
  commandeId: string
  createdAt: string
  statutLabel: string
  statutCls: string
  boutique: string
  codePromo: string | null
  acheteur: { nom: string | null; adresse: string | null; raisonSociale: string | null; numeroTva: string | null }
  tranche: {
    montantTtcCents: number
    montantHtCents: number | null
    montantTvaCents: number | null
    tvaTaux: number | null
    fraisCents: number | null
    netCents: number | null
    factureNumero: string | null
    facturePdfUrl: string | null
    montantRembourseCents: number
    rembourseAt: string | null
    remboursementErreur: string | null
  }
  avoirs: { id: string; numero: string; url: string | null }[]
  licenceAnnuleeAt: string | null
  litige: PartLitige | null
  telechargements: { id: string; fichier: string; date: string }[]
  lignes: LigneVueCollaborateur[]
  tz: string
}

const euros = (cents: number | null) => (cents == null ? '—' : `€${(cents / 100).toFixed(2)}`)

const ETAT_LITIGE = {
  en_cours: { label: 'En cours', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
  gagne:    { label: 'Gagné',    cls: 'bg-green-500/15 text-green-400 border-green-500/20' },
  perdu:    { label: 'Perdu',    cls: 'bg-red-500/15 text-red-400 border-red-500/20' },
} as const

export default function VueCollaborateur(p: Props) {
  const date = (iso: string | null) => (iso ? formatDateTz(iso, p.tz, { day: '2-digit', month: 'long', year: 'numeric' }) : '—')
  const identifiant = p.tranche.factureNumero ?? `#${p.commandeId.slice(0, 8).toUpperCase()}`
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <Link href="/dashboard/business/commandes" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              ← Commandes
            </Link>
            <h1 className="text-xl font-bold text-white mt-1">Vente {identifiant}</h1>
            <p className="text-xs text-gray-500 mt-1">
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 mr-2">Vendue par {p.boutique}</span>
              {formatDateTz(p.createdAt, p.tz, { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <span className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${p.statutCls}`}>{p.statutLabel}</span>
        </div>

        {p.litige && (
          <div className="bg-gray-900 border border-orange-500/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-400">Litige sur ta part</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${ETAT_LITIGE[p.litige.statut].cls}`}>{ETAT_LITIGE[p.litige.statut].label}</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div><p className="text-[10px] text-gray-600">Montant contesté</p><p className="text-gray-200">€{p.litige.montant.toFixed(2)}</p></div>
              <div><p className="text-[10px] text-gray-600">Motif</p><p className="text-gray-300">{libelleMotifLitige(p.litige.motif)}</p></div>
              <div><p className="text-[10px] text-gray-600">Ouvert le</p><p className="text-gray-300">{date(p.litige.ouvertLe)}</p></div>
              <div>
                <p className="text-[10px] text-gray-600">{p.litige.statut === 'en_cours' ? 'Date limite de réponse' : 'Clos le'}</p>
                <p className="text-gray-300">{date(p.litige.statut === 'en_cours' ? p.litige.dateLimite : p.litige.fermeLe)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {p.litige.reponsePar === 'proprietaire' && `${p.boutique} a envoyé la réponse pour ta part le ${date(p.litige.reponseEnvoyeeAt)}.`}
              {p.litige.reponsePar === 'acceptation' && `${p.boutique} a accepté le litige le ${date(p.litige.reponseEnvoyeeAt)}.`}
              {p.litige.reponsePar === 'vendeur_stripe' && 'Tu as répondu directement depuis ton espace Stripe : le propriétaire ne peut plus répondre pour ta part.'}
              {!p.litige.reponsePar && p.litige.statut === 'en_cours' && `${p.boutique} gère ce litige et enverra la réponse sur ton compte. Répondre toi-même depuis Stripe est déconseillé : une réponse est définitive.`}
            </p>
            {p.litige.statut === 'perdu' && (
              <p className="text-xs text-gray-400">Ta part a été reprise sur ton compte Stripe (avec les frais de litige) et une facture d&apos;avoir a été émise pour toi.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-4">Client (tel qu&apos;il figure sur ta facture)</p>
            <div className="space-y-3">
              {p.acheteur.raisonSociale && <p className="text-sm text-gray-200">{p.acheteur.raisonSociale}</p>}
              <p className="text-sm text-gray-200">{p.acheteur.nom ?? '—'}</p>
              <p className="text-sm text-gray-400">{p.acheteur.adresse ?? '—'}</p>
              {p.acheteur.numeroTva && <p className="font-mono text-sm text-gray-400">N° TVA : {p.acheteur.numeroTva}</p>}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-4">Ta part</p>
            <div className="space-y-2 text-sm">
              {p.tranche.tvaTaux ? (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">HT</span><span className="text-gray-300">{euros(p.tranche.montantHtCents)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">TVA ({p.tranche.tvaTaux} %)</span><span className="text-gray-300">{euros(p.tranche.montantTvaCents)}</span></div>
                </>
              ) : null}
              <div className="flex justify-between font-semibold"><span className="text-gray-300">Total</span><span className="text-white">{euros(p.tranche.montantTtcCents)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Frais Stripe</span><span className="text-gray-300">{p.tranche.fraisCents == null ? '—' : `−${euros(p.tranche.fraisCents)}`}</span></div>
              <div className="flex justify-between border-t border-gray-800 pt-2"><span className="text-gray-300">Net</span><span className="text-green-400 font-semibold">{euros(p.tranche.netCents)}</span></div>
              {p.tranche.montantRembourseCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Remboursé au client{p.tranche.rembourseAt ? ` le ${formatDateTz(p.tranche.rembourseAt, p.tz, { day: '2-digit', month: 'long', year: 'numeric' })}` : ''}</span>
                  <span className="text-red-400">−{euros(p.tranche.montantRembourseCents)}</span>
                </div>
              )}
              {p.tranche.remboursementErreur && (
                <p className="text-xs text-red-400">Ta part n&apos;a pas pu être remboursée : {p.tranche.remboursementErreur}</p>
              )}
              {p.codePromo && (
                <div className="flex justify-between pt-2"><span className="text-gray-500">Code promo</span><span className="font-mono text-indigo-400">{p.codePromo}</span></div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-4">Articles</p>
          <div className="space-y-2">
            {p.lignes.map((l, i) => (
              <div key={i} className="flex justify-between text-sm bg-gray-800/40 rounded-lg px-4 py-2.5">
                <span className="text-gray-200">{l.titre} — Licence {l.licence} <span className="text-gray-500">· ta part : {l.pourcentage} %</span></span>
                <span className="text-gray-300">{euros(l.montantCents)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-4">Historique des téléchargements</p>
          {p.telechargements.length ? (
            <div className="space-y-1.5">
              {p.telechargements.map(t => (
                <div key={t.id} className="flex justify-between text-sm">
                  <span className="text-gray-300">{t.fichier === 'email_renvoi' ? 'Lien renvoyé par email' : t.fichier}</span>
                  <span className="text-gray-500">{formatDateTimeTz(t.date, p.tz, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucun téléchargement enregistré.</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-4">Ta facture</p>
          {p.tranche.facturePdfUrl ? (
            <a href={p.tranche.facturePdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300">
              Facture n° {p.tranche.factureNumero} — ouvrir le PDF
            </a>
          ) : (
            <p className="text-sm text-gray-500">
              {p.tranche.montantTtcCents === 0 ? 'Aucune facture : ce beat a été offert (0 €).' : 'Facture pas encore disponible.'}
            </p>
          )}
          {p.avoirs.filter(a => a.url).map(a => (
            <a key={a.id} href={a.url!} target="_blank" rel="noopener noreferrer" className="block text-sm text-indigo-400 hover:text-indigo-300 mt-2">
              Facture d&apos;avoir n° {a.numero} — ouvrir le PDF
            </a>
          ))}
          {p.licenceAnnuleeAt && (
            <p className="text-xs text-gray-400 mt-3">
              Licence annulée le {formatDateTz(p.licenceAnnuleeAt, p.tz, { day: '2-digit', month: 'long', year: 'numeric' })} : l&apos;acheteur n&apos;a plus accès aux fichiers.
            </p>
          )}
          <p className="text-xs text-gray-600 mt-3">Cette vente est gérée par {p.boutique} (remboursements, litiges, renvoi des fichiers).</p>
        </div>
      </div>
    </div>
  )
}
