'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CommandeDetail } from '@/app/dashboard/business/_lib/commandes-externes'
import { LigneTableauImportee, BadgePlateforme, MentionsLigne, MontantLigne, fmtDevise } from '@/app/dashboard/business/_components/CommandeImportee'
import { libellePlateforme } from '@/lib/import-externe/plateformes'
import AssistantImport from './AssistantImport'

export type ImportHistorique = {
  id: string
  created_at: string
  plateforme: string
  nom_fichier: string | null
  nom_vendeur: string | null
  devise: string
  periode_debut: string | null
  periode_fin: string | null
  nb_commandes: number
  nb_lignes: number
  nb_contacts_crees: number
  nb_rejetees: number
  total_depense: number
  total_depense_eur: number
  statut: 'importe' | 'annule'
  annule_at: string | null
  annulation_rapport: { nb_commandes_supprimees: number; nb_contacts_supprimes: number; nb_contacts_conserves: number } | null
}

const PAR_PAGE = 50

const pluriel = (n: number, un: string, plusieurs: string) => `${n.toLocaleString('fr-FR')} ${n > 1 ? plusieurs : un}`

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

function Roue() {
  return <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin align-middle" />
}

export default function CommandesImporteesClient({
  commandes, imports, planPayant, ouvrirImport,
}: {
  commandes: CommandeDetail[]
  imports: ImportHistorique[]
  planPayant: boolean
  ouvrirImport: boolean
}) {
  const router = useRouter()
  const [assistant, setAssistant] = useState(ouvrirImport && planPayant)
  const [recherche, setRecherche] = useState('')
  const [plateforme, setPlateforme] = useState('')
  const [nbAffiches, setNbAffiches] = useState(PAR_PAGE)
  const [aAnnuler, setAAnnuler] = useState<ImportHistorique | null>(null)
  const [annulationEnCours, setAnnulationEnCours] = useState(false)
  const [erreurAnnulation, setErreurAnnulation] = useState<string | null>(null)

  const plateformes = useMemo(() => [...new Set(commandes.map(c => c.plateforme))], [commandes])

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return commandes.filter(c => {
      if (plateforme && c.plateforme !== plateforme) return false
      if (!q) return true
      return (c.acheteur_nom ?? '').toLowerCase().includes(q)
        || c.acheteur_email.includes(q)
        || c.numero_externe.toLowerCase().includes(q)
        || c.lignes.some(l => l.titre.toLowerCase().includes(q))
    })
  }, [commandes, recherche, plateforme])

  async function annuler() {
    if (!aAnnuler) return
    setAnnulationEnCours(true)
    setErreurAnnulation(null)
    try {
      const res = await fetch('/api/business/imports-externes/annuler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: aAnnuler.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setErreurAnnulation(json.error ?? 'L’annulation a échoué.'); return }
      setAAnnuler(null)
      router.refresh()
    } finally {
      setAnnulationEnCours(false)
    }
  }

  const importsActifs = imports.filter(i => i.statut === 'importe')

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Commandes importées</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Tes ventes réalisées sur d’autres plateformes (BeatStars, Airbit, Instrurap…). Elles complètent ton CRM
            (total dépensé, achats, ancienneté de tes clients) sans jamais toucher tes Analytics ni tes factures.
          </p>
        </div>
        {planPayant ? (
          <button
            onClick={() => setAssistant(true)}
            className="shrink-0 text-sm font-semibold px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Importer des commandes externes
          </button>
        ) : (
          <Link
            href="/dashboard/abonnement"
            className="shrink-0 text-sm font-semibold px-4 py-2.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Réservé au plan payant (essai compris)"
          >
            🔒 Importer des commandes externes
          </Link>
        )}
      </div>

      {/* ── Historique des imports ── */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Historique des imports</h2>
        {imports.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl py-8 text-center text-sm text-gray-600">
            Aucun import pour l’instant.
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-semibold">Import</th>
                  <th className="text-left px-5 py-3 font-semibold">Période des ventes</th>
                  <th className="text-right px-5 py-3 font-semibold">Commandes</th>
                  <th className="text-right px-5 py-3 font-semibold">Contacts créés</th>
                  <th className="text-right px-5 py-3 font-semibold">Total dépensé</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {imports.map((i, n) => (
                  <tr key={i.id} className={n < imports.length - 1 ? 'border-b border-gray-800' : ''}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <BadgePlateforme plateforme={i.plateforme} />
                        <span className="text-white text-xs">{fmtDate(i.created_at)}</span>
                      </div>
                      {i.nom_fichier && <p className="text-[11px] text-gray-600 mt-1 truncate max-w-[260px]">{i.nom_fichier}</p>}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {i.periode_debut && i.periode_fin ? `${fmtDate(i.periode_debut)} → ${fmtDate(i.periode_fin)}` : '–'}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-gray-300">{i.nb_commandes.toLocaleString('fr-FR')}</td>
                    <td className="px-5 py-3 text-right text-xs text-gray-300">{i.nb_contacts_crees.toLocaleString('fr-FR')}</td>
                    <td className="px-5 py-3 text-right text-xs whitespace-nowrap">
                      <span className="text-white font-semibold">{fmtDevise(i.total_depense, i.devise)}</span>
                      {i.devise !== 'EUR' && <span className="text-gray-500"> ≈ {fmtDevise(i.total_depense_eur, 'EUR')}</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {i.statut === 'importe' ? (
                        <button
                          onClick={() => { setErreurAnnulation(null); setAAnnuler(i) }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-red-300 hover:border-red-500/40 transition-colors whitespace-nowrap"
                        >
                          Annuler cet import
                        </button>
                      ) : (
                        <div className="text-[11px] text-gray-500 text-right">
                          <span className="text-red-300/80 font-medium">Annulé</span>{i.annule_at ? ` le ${fmtDate(i.annule_at)}` : ''}
                          {i.annulation_rapport && (
                            <p className="mt-0.5">
                              {pluriel(i.annulation_rapport.nb_commandes_supprimees, 'commande supprimée', 'commandes supprimées')}
                              {', '}{pluriel(i.annulation_rapport.nb_contacts_supprimes, 'contact supprimé', 'contacts supprimés')}
                              {i.annulation_rapport.nb_contacts_conserves > 0 && `, ${pluriel(i.annulation_rapport.nb_contacts_conserves, 'contact conservé', 'contacts conservés')}`}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Liste des commandes ── */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-sm font-semibold text-gray-300">
            Commandes <span className="text-gray-600 font-normal">({filtrees.length.toLocaleString('fr-FR')})</span>
          </h2>
          <div className="flex items-center gap-2">
            <input
              value={recherche}
              onChange={e => { setRecherche(e.target.value); setNbAffiches(PAR_PAGE) }}
              placeholder="Rechercher un client, un titre, un n° de facture…"
              className="w-80 text-sm bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
            {plateformes.length > 1 && (
              <select
                value={plateforme}
                onChange={e => { setPlateforme(e.target.value); setNbAffiches(PAR_PAGE) }}
                className="text-sm bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none"
              >
                <option value="">Toutes les plateformes</option>
                {plateformes.map(p => <option key={p} value={p}>{libellePlateforme(p)}</option>)}
              </select>
            )}
          </div>
        </div>

        {filtrees.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl py-10 text-center text-sm text-gray-600">
            {commandes.length === 0 ? 'Aucune commande importée.' : 'Aucune commande ne correspond à ta recherche.'}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-semibold">Date</th>
                  <th className="text-left px-5 py-3 font-semibold">Client</th>
                  <th className="text-left px-5 py-3 font-semibold">Beats</th>
                  <th className="text-right px-5 py-3 font-semibold">Dépensé</th>
                </tr>
              </thead>
              <tbody>
                {filtrees.slice(0, nbAffiches).map((c, n, arr) => (
                  <LigneTableauImportee
                    key={c.id}
                    commande={c}
                    className={`${n < arr.length - 1 ? 'border-b border-gray-800' : ''} hover:bg-gray-800/40 transition-colors align-top`}
                  >
                    <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {fmtDate(c.date_vente)}
                      <div className="mt-1"><BadgePlateforme plateforme={c.plateforme} /></div>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/business/contacts/${c.client_id}`}
                        onClick={e => e.stopPropagation()}
                        className="text-white font-medium hover:text-indigo-300 transition-colors"
                      >
                        {c.acheteur_nom ?? c.acheteur_email}
                      </Link>
                      {c.acheteur_nom && <p className="text-[11px] text-gray-600">{c.acheteur_email}</p>}
                    </td>
                    <td className="px-5 py-3">
                      {c.lignes.map(l => (
                        <div key={l.id} className="mb-1.5 last:mb-0">
                          <span className="text-gray-200">{l.titre}</span>
                          <MentionsLigne ligne={l} typeBoutique={l === c.lignes[0] ? c.type_boutique : null} />
                        </div>
                      ))}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.lignes.every(l => l.offert)
                        ? <span className="text-green-400 font-semibold">Offert</span>
                        : <MontantLigne ligne={{ ...c.lignes[0], offert: false, montant_depense: c.total_depense, montant_depense_eur: c.total_depense_eur }} devise={c.devise} />}
                    </td>
                  </LigneTableauImportee>
                ))}
              </tbody>
            </table>
            {filtrees.length > nbAffiches && (
              <div className="border-t border-gray-800 p-3 text-center">
                <button onClick={() => setNbAffiches(n => n + PAR_PAGE)} className="text-xs text-indigo-300 hover:text-indigo-200">
                  Afficher {Math.min(PAR_PAGE, filtrees.length - nbAffiches)} de plus ({(filtrees.length - nbAffiches).toLocaleString('fr-FR')} restantes)
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {assistant && (
        <AssistantImport
          onFermer={() => setAssistant(false)}
          onTermine={() => router.refresh()}
        />
      )}

      {aAnnuler && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !annulationEnCours && setAAnnuler(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-white font-bold text-lg mb-3">Annuler cet import ?</h2>
            <ul className="text-sm text-gray-400 space-y-2 mb-5 list-disc pl-5">
              <li>Les <strong className="text-white">{aAnnuler.nb_commandes.toLocaleString('fr-FR')} commandes</strong> de cet import seront supprimées.</li>
              <li>Les contacts créés par cet import seront supprimés <strong className="text-white">seulement s’ils n’ont rien d’autre</strong> dans ton CRM (aucune commande, pas inscrits à ta newsletter, dans aucune liste, jamais fusionnés ni modifiés). Les autres sont conservés.</li>
              <li>Les contacts qui existaient avant l’import ne sont jamais touchés.</li>
            </ul>
            {importsActifs.length > 1 && (
              <p className="text-xs text-gray-500 mb-4">Tes autres imports ne sont pas concernés.</p>
            )}
            {erreurAnnulation && <p className="text-sm text-red-400 mb-4">{erreurAnnulation}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAAnnuler(null)}
                disabled={annulationEnCours}
                className="text-sm px-4 py-2 rounded-xl text-gray-400 hover:text-white disabled:opacity-50"
              >
                Garder l’import
              </button>
              <button
                onClick={annuler}
                disabled={annulationEnCours}
                className="text-sm font-semibold px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white disabled:opacity-70 flex items-center gap-2"
              >
                {annulationEnCours ? <><Roue /> Annulation en cours…</> : 'Annuler l’import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
