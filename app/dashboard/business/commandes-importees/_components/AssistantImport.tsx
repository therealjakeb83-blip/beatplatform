'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import type { Apercu } from '@/lib/import-externe/preparation'
import { ecrireCsv } from '@/lib/import-externe/csv'
import { BadgePlateforme, MentionsLigne, MontantLigne, fmtDevise } from '@/app/dashboard/business/_components/CommandeImportee'

// Import en 3 temps : fichier → écran de vérification (RIEN n'est écrit) →
// import en un seul bloc (tout ou rien). Le fichier est renvoyé au serveur
// à l'étape d'import : il relit et recalcule tout lui-même.

type Etape = 'choix' | 'analyse' | 'verification' | 'import' | 'termine'
type Resultat = { nb_commandes: number; nb_lignes: number; nb_contacts_crees: number; nb_titres_non_relies?: number }

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
const nb = (n: number) => n.toLocaleString('fr-FR')

function Attente({ texte, detail }: { texte: string; detail: string }) {
  return (
    <div className="py-12 flex flex-col items-center gap-4 text-center">
      <span className="inline-block w-8 h-8 border-[3px] border-white/20 border-t-indigo-400 rounded-full animate-spin" />
      <p className="text-white font-semibold">{texte}</p>
      <p className="text-xs text-gray-500 max-w-sm">{detail}</p>
    </div>
  )
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2">{titre}</p>
      {children}
    </div>
  )
}

export default function AssistantImport({ onFermer, onTermine }: { onFermer: () => void; onTermine: () => void }) {
  const [etape, setEtape] = useState<Etape>('choix')
  const [fichier, setFichier] = useState<File | null>(null)
  const [apercu, setApercu] = useState<Apercu | null>(null)
  const [resultat, setResultat] = useState<Resultat | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const occupe = etape === 'analyse' || etape === 'import'

  async function envoyer(url: string, f: File) {
    const form = new FormData()
    form.append('fichier', f)
    const res = await fetch(url, { method: 'POST', body: form })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error ?? 'Une erreur est survenue.')
    return json
  }

  async function analyser(f: File) {
    setFichier(f)
    setErreur(null)
    setEtape('analyse')
    try {
      const json = await envoyer('/api/business/imports-externes/analyser', f)
      setApercu(json.apercu)
      setEtape('verification')
    } catch (e) {
      setErreur((e as Error).message)
      setEtape('choix')
    }
  }

  async function importer() {
    if (!fichier) return
    setErreur(null)
    setEtape('import')
    try {
      const json = await envoyer('/api/business/imports-externes/importer', fichier)
      setResultat(json.resultat)
      setEtape('termine')
      onTermine()
    } catch (e) {
      setErreur((e as Error).message)
      setEtape('verification')
    }
  }

  function telechargerRejets() {
    if (!apercu) return
    const lignes = [['Ligne du fichier', 'Raison', ...apercu.enTetes], ...apercu.rejets.map(r => [String(r.numero), r.raison, ...r.cellules])]
    const blob = new Blob(['﻿' + ecrireCsv(lignes)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lignes-rejetees-${(apercu.nomFichier || 'import').replace(/\.csv$/i, '')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !occupe && onFermer()}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Importer des commandes externes</h2>
          {!occupe && <button onClick={onFermer} className="text-gray-600 hover:text-white text-xl leading-none">×</button>}
        </div>

        <div className="p-6">
          {erreur && (
            <div className="mb-5 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{erreur}</div>
          )}

          {etape === 'choix' && (
            <div>
              <p className="text-sm text-gray-400 mb-1">
                Ajoute à ton CRM l’historique de tes ventes faites sur une autre plateforme : BeatStars, Airbit, Instrurap…
              </p>
              <p className="text-xs text-gray-500 mb-5">
                Pour l’instant, seul l’export <strong className="text-gray-300">« Transactions »</strong> de BeatStars est accepté
                (BeatStars → Sales → Transactions → Export CSV). Les autres plateformes arrivent bientôt.
              </p>
              <button
                onClick={() => input.current?.click()}
                className="w-full border-2 border-dashed border-gray-700 hover:border-indigo-500/60 rounded-2xl py-10 text-center transition-colors group"
              >
                <p className="text-white font-semibold group-hover:text-indigo-300">Choisir le fichier CSV</p>
                <p className="text-xs text-gray-500 mt-1">Rien n’est enregistré avant ta validation, sur l’écran suivant.</p>
                <p className="text-xs text-gray-500 mt-1">Tu peux redéposer un fichier complet : seules les nouvelles ventes seront ajoutées.</p>
              </button>
              <input
                ref={input}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) analyser(f) }}
              />
            </div>
          )}

          {etape === 'analyse' && (
            <Attente texte="Lecture du fichier…" detail="On vérifie chaque ligne et on récupère les taux de change officiels de la Banque centrale européenne. Ça peut prendre quelques secondes." />
          )}

          {etape === 'import' && (
            <Attente texte="Import en cours…" detail="Ne ferme pas cette fenêtre. Si quoi que ce soit échoue, rien n’est enregistré." />
          )}

          {etape === 'verification' && apercu && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Bloc titre="Fichier">
                  <div className="flex items-center gap-2 mb-1">
                    <BadgePlateforme plateforme={apercu.plateforme} />
                    <span className="text-sm text-white">Format reconnu</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{apercu.nomFichier}</p>
                  {apercu.nomVendeur && (
                    <p className="text-xs text-gray-400 mt-2">Ton nom sur {apercu.plateformeLibelle} : <strong className="text-white">{apercu.nomVendeur}</strong></p>
                  )}
                </Bloc>
                <Bloc titre="Période des ventes">
                  <p className="text-sm text-white">
                    {apercu.periodeDebut && apercu.periodeFin ? <>Du {fmtDate(apercu.periodeDebut)}<br />au {fmtDate(apercu.periodeFin)}</> : '–'}
                  </p>
                </Bloc>
                <Bloc titre="Commandes">
                  <p className="text-2xl font-black text-white">{nb(apercu.nbNouvelles)} <span className="text-sm font-normal text-gray-400">à importer</span></p>
                  <p className="text-xs text-gray-500 mt-1">
                    {nb(apercu.nbCommandesFichier)} dans le fichier
                    {apercu.nbDejaImportees > 0 && <>, dont <strong className="text-gray-300">{nb(apercu.nbDejaImportees)} déjà importées</strong> (ignorées)</>}
                    {' '}· {nb(apercu.nbBeats)} beats vendus
                  </p>
                </Bloc>
                <Bloc titre="Acheteurs">
                  <p className="text-2xl font-black text-white">{nb(apercu.nbAcheteurs)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {nb(apercu.nbAcheteursNouveaux)} nouveaux dans ton CRM · {nb(apercu.nbAcheteursExistants)} déjà dans ton CRM
                  </p>
                </Bloc>
              </div>

              <Bloc titre="Total dépensé par ces acheteurs">
                <p className="text-xl font-black text-white">
                  {fmtDevise(apercu.totalDepense, apercu.devise)}
                  {apercu.devise !== 'EUR' && <span className="text-base font-semibold text-gray-400"> ≈ {fmtDevise(apercu.totalDepenseEur, 'EUR')}</span>}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Prix des beats après remise, hors frais et TVA de la plateforme. Conversion au taux officiel de la BCE du jour de chaque vente, figé à l’import.
                </p>
              </Bloc>

              {apercu.echantillon.length > 0 && (
                <Bloc titre={`Exemples (${apercu.echantillon.length} commandes telles qu’elles apparaîtront)`}>
                  <table className="w-full text-sm">
                    <tbody>
                      {apercu.echantillon.map(c => (
                        <tr key={c.numero_externe} className="border-b border-gray-800 last:border-0 align-top">
                          <td className="py-2 pr-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(c.date_vente)}</td>
                          <td className="py-2 pr-3 text-xs text-gray-300">{c.acheteur_nom ?? c.acheteur_email}</td>
                          <td className="py-2 pr-3">
                            {c.lignes.map((l, i) => (
                              <div key={i} className="mb-1.5 last:mb-0">
                                <span className="text-gray-200">{l.titre}</span>
                                <MentionsLigne
                                  ligne={{ ...l, id: String(i), image_url: null }}
                                  typeBoutique={i === 0 ? c.type_boutique : null}
                                />
                              </div>
                            ))}
                          </td>
                          <td className="py-2 text-right text-xs">
                            {c.lignes.map((l, i) => (
                              <div key={i} className="mb-1.5 last:mb-0">
                                <MontantLigne ligne={{ ...l, id: String(i), image_url: null }} devise={c.devise} />
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Bloc>
              )}

              {apercu.rejets.length > 0 ? (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <p className="text-sm text-amber-200 font-semibold">
                      {nb(apercu.rejets.length)} ligne{apercu.rejets.length > 1 ? 's' : ''} rejetée{apercu.rejets.length > 1 ? 's' : ''}
                      {apercu.nbCommandesRejetees > 0 && <> ({nb(apercu.nbCommandesRejetees)} commande{apercu.nbCommandesRejetees > 1 ? 's' : ''} non importée{apercu.nbCommandesRejetees > 1 ? 's' : ''})</>}
                    </p>
                    <button onClick={telechargerRejets} className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-200 hover:bg-amber-500/10 whitespace-nowrap">
                      Télécharger les lignes rejetées (CSV)
                    </button>
                  </div>
                  <ul className="text-xs text-gray-400 space-y-1 max-h-40 overflow-y-auto">
                    {apercu.rejets.slice(0, 50).map((r, i) => (
                      <li key={i}><span className="text-gray-500">Ligne {r.numero} :</span> {r.raison}</li>
                    ))}
                    {apercu.rejets.length > 50 && <li className="text-gray-600">… et {nb(apercu.rejets.length - 50)} autres (dans le CSV)</li>}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-green-400">✓ Toutes les lignes du fichier sont lisibles.</p>
              )}

              <p className="text-xs text-gray-500">
                Les nouveaux contacts arrivent « Non inscrits » à ta newsletter : aucun email ne leur est envoyé, aucune
                automatisation n’est déclenchée. Tu pourras annuler cet import à tout moment depuis l’historique.
              </p>

              <div className="flex items-center justify-between gap-4 pt-2">
                <button onClick={() => { setApercu(null); setFichier(null); setEtape('choix') }} className="text-sm text-gray-400 hover:text-white">
                  ← Choisir un autre fichier
                </button>
                <button
                  onClick={importer}
                  disabled={apercu.nbNouvelles === 0}
                  className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                  title={apercu.nbNouvelles === 0 ? 'Aucune nouvelle commande dans ce fichier' : undefined}
                >
                  {apercu.nbNouvelles === 0 ? 'Rien de nouveau à importer' : `Importer ${nb(apercu.nbNouvelles)} commande${apercu.nbNouvelles > 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          )}

          {etape === 'termine' && resultat && (
            <div className="py-8 text-center">
              <p className="text-4xl mb-3">✓</p>
              <p className="text-white font-bold text-lg">Import terminé</p>
              <p className="text-sm text-gray-400 mt-2">
                {nb(resultat.nb_commandes)} commandes ({nb(resultat.nb_lignes)} beats vendus) importées · {nb(resultat.nb_contacts_crees)} contacts ajoutés à ton CRM.
              </p>
              {!!resultat.nb_titres_non_relies && (
                <p className="text-sm text-gray-400 mt-4">
                  {nb(resultat.nb_titres_non_relies)} titre{resultat.nb_titres_non_relies > 1 ? 's' : ''} non relié{resultat.nb_titres_non_relies > 1 ? 's' : ''} à ton catalogue ·{' '}
                  <Link href="/dashboard/business/commandes-importees/relier-beats" className="text-indigo-400 hover:text-indigo-300 font-semibold">
                    Relier les beats →
                  </Link>
                </p>
              )}
              <div className="flex justify-center gap-3 mt-6">
                <Link href="/dashboard/business/contacts" className="text-sm px-4 py-2 rounded-xl border border-gray-700 text-gray-300 hover:text-white">
                  Voir mes contacts
                </Link>
                <button onClick={onFermer} className="text-sm font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white">
                  Voir les commandes importées
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
