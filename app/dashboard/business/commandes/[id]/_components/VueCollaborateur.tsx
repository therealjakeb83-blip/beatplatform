import Link from 'next/link'
import { formatDateTz } from '@/lib/fuseau-horaire'

// Fiche d'une vente en collaboration vue par un collaborateur (B) — Phase 12
// Q19 / Phase 13 lot 3 : B voit exactement ce qu'imprime SA facture (nom,
// adresse, raison sociale et TVA d'un acheteur pro), sa part, ses frais et son
// net. Jamais l'email ni le téléphone du client, ni sa fiche CRM, ni la
// source marketing, ni l'historique d'achat ; aucune action (A est maître de
// la vente). Le code promo est visible : c'est lui qui explique une part à
// 0 € (beat offert, décision de Jake au lot 3).

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
  }
  lignes: LigneVueCollaborateur[]
  tz: string
}

const euros = (cents: number | null) => (cents == null ? '—' : `€${(cents / 100).toFixed(2)}`)

export default function VueCollaborateur(p: Props) {
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
          <p className="text-xs text-gray-600 mt-3">Cette vente est gérée par {p.boutique} (remboursements, litiges, renvoi des fichiers).</p>
        </div>
      </div>
    </div>
  )
}
