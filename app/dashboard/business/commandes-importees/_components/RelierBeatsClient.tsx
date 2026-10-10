'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { BeatCatalogue, DecisionLien, GroupeTitre } from '@/lib/import-externe/liens-beats'
import Pagination from '../../../_pagination/Pagination'
import { usePagination } from '../../../_pagination/usePagination'

type Action = { cle: string; action: 'relier' | 'ne_pas_relier' | 'defaire'; beat_id?: string }

const FILTRES: { cle: DecisionLien; libelle: string }[] = [
  { cle: 'a_traiter', libelle: 'À traiter' },
  { cle: 'relier', libelle: 'Reliés' },
  { cle: 'ne_pas_relier', libelle: 'Ne pas relier' },
]

const nb = (n: number) => n.toLocaleString('fr-FR')

function Roue({ petite }: { petite?: boolean }) {
  return <span className={`inline-block ${petite ? 'w-3 h-3' : 'w-4 h-4'} border-2 border-white/30 border-t-white rounded-full animate-spin align-middle`} />
}

function Pochette({ beat }: { beat: BeatCatalogue }) {
  return beat.image_url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={beat.image_url} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
    : <span className="w-8 h-8 rounded-md bg-gray-800 flex-shrink-0" />
}

function BadgeProposition({ groupe }: { groupe: GroupeTitre }) {
  const sur = groupe.propositionNiveau !== 'ressemblant'
  const detail = groupe.propositionNiveau === 'identique' ? 'titre identique'
    : groupe.propositionNiveau === 'debut' ? 'début du titre'
    : `ressemblant ${Math.round((groupe.propositionScore ?? 0) * 100)} %`
  return (
    <span
      className={`text-[11px] rounded px-1.5 py-0.5 flex-shrink-0 border whitespace-nowrap ${sur
        ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30'
        : 'text-amber-300 bg-amber-500/10 border-amber-500/30'}`}
      title={sur ? undefined : 'Titre proche mais pas identique : vérifie avant de valider'}
    >
      Proposé · {detail}
    </span>
  )
}

function NomBeat({ beat }: { beat: BeatCatalogue }) {
  return (
    <span className="flex items-center gap-2.5 min-w-0">
      <Pochette beat={beat} />
      <span className="truncate text-white">{beat.titre}</span>
      {beat.supprime && <span className="text-[11px] text-gray-500 flex-shrink-0">(supprimé)</span>}
    </span>
  )
}

export default function RelierBeatsClient({ groupes, beats, planPayant }: { groupes: GroupeTitre[]; beats: BeatCatalogue[]; planPayant: boolean }) {
  const router = useRouter()
  const [filtre, setFiltre] = useState<DecisionLien>('a_traiter')
  const [recherche, setRecherche] = useState('')
  const [seulementPropositions, setSeulementPropositions] = useState(false)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [choix, setChoix] = useState<GroupeTitre | null>(null)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [choixGroupe, setChoixGroupe] = useState(false)
  const [rafraichissement, demarrerRafraichissement] = useTransition()

  const beatsParId = useMemo(() => new Map(beats.map(b => [b.id, b])), [beats])
  const compteurs = useMemo(() => {
    const c: Record<DecisionLien, number> = { a_traiter: 0, relier: 0, ne_pas_relier: 0 }
    for (const g of groupes) c[g.decision]++
    return c
  }, [groupes])
  const nbPropositions = useMemo(() => groupes.filter(g => g.decision === 'a_traiter' && g.propositionId).length, [groupes])
  const filtrerPropositions = filtre === 'a_traiter' && seulementPropositions && nbPropositions > 0

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return groupes.filter(g => {
      if (g.decision !== filtre) return false
      if (filtrerPropositions && !g.propositionId) return false
      if (!q) return true
      const beat = g.beatId ? beatsParId.get(g.beatId) : g.propositionId ? beatsParId.get(g.propositionId) : null
      return g.titres.some(t => t.toLowerCase().includes(q)) || (beat?.titre.toLowerCase().includes(q) ?? false)
    })
  }, [groupes, filtre, recherche, beatsParId, filtrerPropositions])

  // « Valider les N » : seulement les propositions sûres (titre identique ou
  // début du titre identique) ; les « ressemblant » demandent un choix individuel
  // ou une sélection explicite, avec avertissement avant la validation groupée.
  const propositions = filtres.filter(g => g.decision === 'a_traiter' && g.propositionId && g.propositionNiveau !== 'ressemblant')
  const pagination = usePagination(filtres, [filtre, recherche, filtrerPropositions])
  const occupe = enCours !== null || rafraichissement
  const selectionnes = filtres.filter(g => selection.has(g.cle))
  const propositionsSelectionnees = selectionnes.filter(g => g.decision === 'a_traiter' && g.propositionId)
  const touteLaPage = pagination.lignes.length > 0 && pagination.lignes.every(g => selection.has(g.cle))

  function viderSelection() {
    setSelection(new Set())
    setChoixGroupe(false)
  }

  function cocher(cle: string) {
    setSelection(prev => {
      const suivant = new Set(prev)
      if (suivant.has(cle)) suivant.delete(cle)
      else suivant.add(cle)
      return suivant
    })
  }

  async function envoyer(liens: Action[], cle: string) {
    if (!planPayant) return
    setEnCours(cle)
    setErreur(null)
    try {
      const res = await fetch('/api/business/imports-externes/relier-beats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liens }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setErreur(json.error ?? 'L’enregistrement a échoué.'); return }
      setChoix(null)
      viderSelection()
      demarrerRafraichissement(() => router.refresh())
    } catch {
      setErreur('Erreur réseau : recharge la page pour vérifier l’enregistrement avant de réessayer.')
    } finally {
      setEnCours(null)
    }
  }

  const bouton = 'text-xs px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed'
  const verrou = planPayant ? undefined : 'Réservé au plan payant (essai compris)'

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <Link href="/dashboard/business/commandes-importees" className="text-xs text-gray-500 hover:text-white transition-colors">
        ← Commandes importées
      </Link>
      <div className="flex items-start justify-between gap-6 mt-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Relier les beats</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Associe les titres de tes ventes importées aux beats de ton catalogue. Ça complète les préférences musicales
            et les pochettes de tes clients dans le CRM, sans toucher tes Analytics. Rien n’est relié sans ton accord ; ton choix
            vaut pour toutes les ventes du titre et sera réappliqué à tes prochains imports.
          </p>
        </div>
        {!planPayant && (
          <Link href="/dashboard/abonnement" className="shrink-0 text-sm font-semibold px-4 py-2.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white transition-colors">
            🔒 Réservé au plan payant
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {FILTRES.map(f => (
            <button
              key={f.cle}
              onClick={() => { setFiltre(f.cle); viderSelection() }}
              disabled={occupe}
              className={`text-sm px-4 py-1.5 rounded-lg transition-colors ${filtre === f.cle ? 'bg-gray-800 text-white font-semibold' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {f.libelle} <span className="text-gray-500 font-normal">({nb(compteurs[f.cle])})</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {filtre === 'a_traiter' && nbPropositions > 0 && (
            <button
              onClick={() => { setSeulementPropositions(v => !v); viderSelection() }}
              disabled={occupe}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${seulementPropositions
                ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-200'
                : 'border-gray-700 text-gray-400 hover:text-white'}`}
            >
              {seulementPropositions ? '✓ ' : ''}Propositions seulement ({nb(nbPropositions)})
            </button>
          )}
          <input
            type="text"
            value={recherche}
            onChange={e => { setRecherche(e.target.value); viderSelection() }}
            disabled={occupe}
            placeholder="Rechercher un titre…"
            className="w-56 bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none transition-colors"
          />
          {propositions.length > 0 && (
            <button
              onClick={() => envoyer(propositions.map(g => ({ cle: g.cle, action: 'relier', beat_id: g.propositionId as string })), '__toutes__')}
              disabled={!planPayant || occupe}
              title={verrou}
              className={`${bouton} text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold`}
            >
              {enCours === '__toutes__' ? <><Roue petite /> Enregistrement…</> : `${planPayant ? '' : '🔒 '}Valider les ${nb(propositions.length)} proposition${propositions.length > 1 ? 's' : ''} sûre${propositions.length > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>

      {erreur && <p className="text-red-400 text-xs mb-3">{erreur}</p>}
      {rafraichissement && <p className="text-xs text-gray-400 mb-3 flex items-center gap-2"><Roue petite /> Mise à jour de la liste…</p>}

      {selectionnes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl p-3 mb-3">
          <span className="text-sm text-white mr-2">{nb(selectionnes.length)} titre{selectionnes.length > 1 ? 's' : ''} sélectionné{selectionnes.length > 1 ? 's' : ''}</span>
          {enCours === '__selection__' && <span className="text-xs text-gray-400"><Roue petite /> Enregistrement…</span>}
          {propositionsSelectionnees.length > 0 && (
            <button disabled={!planPayant || occupe}
              onClick={() => envoyer(propositionsSelectionnees.map(g => ({ cle: g.cle, action: 'relier', beat_id: g.propositionId as string })), '__selection__')}
              className={`${bouton} bg-indigo-600 hover:bg-indigo-500 text-white`}
            >Valider les {nb(propositionsSelectionnees.length)} propositions sélectionnées</button>
          )}
          <button disabled={!planPayant || occupe} onClick={() => { setErreur(null); setChoixGroupe(true) }} className={`${bouton} border border-gray-600 text-gray-300 hover:text-white`}>Choisir un beat pour la sélection</button>
          <button disabled={!planPayant || occupe} onClick={() => envoyer(selectionnes.map(g => ({ cle: g.cle, action: 'ne_pas_relier' })), '__selection__')} className={`${bouton} border border-gray-600 text-gray-300 hover:text-white`}>Ne pas relier</button>
          <button disabled={occupe} onClick={viderSelection} className={`${bouton} text-gray-400 hover:text-white`}>Désélectionner</button>
          {propositionsSelectionnees.some(g => g.propositionNiveau === 'ressemblant') && <p className="w-full text-xs text-amber-300">La sélection contient des propositions par ressemblance : vérifie les beats affichés avant de valider.</p>}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
              <th className="pl-5 py-3 w-10">
                <input type="checkbox" aria-label="Sélectionner les titres de cette page" checked={touteLaPage} disabled={!planPayant || occupe || pagination.lignes.length === 0}
                  onChange={() => setSelection(prev => {
                    const suivant = new Set(prev)
                    for (const g of pagination.lignes) {
                      if (touteLaPage) suivant.delete(g.cle)
                      else suivant.add(g.cle)
                    }
                    return suivant
                  })} />
              </th>
              <th className="text-left px-5 py-3 font-semibold">Titre importé</th>
              <th className="text-right px-5 py-3 font-semibold">Ventes</th>
              <th className="text-left px-5 py-3 font-semibold">Beat de ton catalogue</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {pagination.lignes.map((g, i, arr) => {
              const lie = g.beatId ? beatsParId.get(g.beatId) : undefined
              const propose = g.propositionId ? beatsParId.get(g.propositionId) : undefined
              const ceTitre = enCours === g.cle
              return (
                <tr key={g.cle} className={i < arr.length - 1 ? 'border-b border-gray-800' : ''}>
                  <td className="pl-5 py-3"><input type="checkbox" aria-label={`Sélectionner ${g.libelle}`} checked={selection.has(g.cle)} disabled={!planPayant || occupe} onChange={() => cocher(g.cle)} /></td>
                  <td className="px-5 py-3 max-w-[280px]">
                    <p className="text-white truncate">{g.libelle}</p>
                    {g.titres.length > 1 && (
                      <p className="text-[11px] text-gray-600 mt-0.5 truncate" title={g.titres.join('\n')}>
                        + {g.titres.length - 1} écriture{g.titres.length > 2 ? 's' : ''} proche{g.titres.length > 2 ? 's' : ''}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-gray-300">{nb(g.nbVentes)}</td>
                  <td className="px-5 py-3 max-w-[300px]">
                    {g.decision === 'relier' && lie ? <NomBeat beat={lie} />
                      : g.decision === 'ne_pas_relier' ? <span className="text-xs text-gray-500">Ne pas relier</span>
                      : propose ? (
                        <span className="flex items-center gap-2 min-w-0">
                          <BadgeProposition groupe={g} />
                          <NomBeat beat={propose} />
                        </span>
                      ) : <span className="text-xs text-gray-600">Aucun beat proche</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {ceTitre && <Roue petite />}
                      {g.decision === 'a_traiter' && propose && (
                        <button
                          onClick={() => envoyer([{ cle: g.cle, action: 'relier', beat_id: propose.id }], g.cle)}
                          disabled={!planPayant || occupe} title={verrou}
                          className={`${bouton} bg-indigo-600 hover:bg-indigo-500 text-white font-semibold`}
                        >
                          {planPayant ? '' : '🔒 '}Valider
                        </button>
                      )}
                      {(g.decision === 'a_traiter' || g.decision === 'relier') && (
                        <button
                          onClick={() => { setErreur(null); setChoix(g) }}
                          disabled={!planPayant || occupe} title={verrou}
                          className={`${bouton} border border-gray-700 text-gray-300 hover:text-white`}
                        >
                          {planPayant ? '' : '🔒 '}{g.decision === 'relier' ? 'Changer' : propose ? 'Choisir un autre beat' : 'Choisir un beat'}
                        </button>
                      )}
                      {g.decision === 'a_traiter' && (
                        <button
                          onClick={() => envoyer([{ cle: g.cle, action: 'ne_pas_relier' }], g.cle)}
                          disabled={!planPayant || occupe} title={verrou}
                          className={`${bouton} border border-gray-700 text-gray-400 hover:text-white`}
                        >
                          {planPayant ? '' : '🔒 '}Ne pas relier
                        </button>
                      )}
                      {g.decision !== 'a_traiter' && (
                        <button
                          onClick={() => envoyer([{ cle: g.cle, action: 'defaire' }], g.cle)}
                          disabled={!planPayant || occupe} title={verrou}
                          className={`${bouton} border border-gray-700 text-gray-400 hover:text-red-300 hover:border-red-500/40`}
                        >
                          {planPayant ? '' : '🔒 '}Défaire
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtres.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-600 text-sm">
                {groupes.length === 0 ? 'Aucune commande importée pour l’instant.' : 'Aucun titre dans cette vue.'}
              </td></tr>
            )}
          </tbody>
        </table>
        <Pagination {...pagination.barre} />
      </div>

      {choixGroupe && selectionnes.length > 0 && (
        <ChoixBeat
          groupe={selectionnes[0]}
          description={`${nb(selectionnes.length)} titres sélectionnés seront reliés au même beat.`}
          beats={beats}
          enCours={occupe}
          erreur={erreur}
          onChoisir={beatId => envoyer(selectionnes.map(g => ({ cle: g.cle, action: 'relier', beat_id: beatId })), '__selection__')}
          onFermer={() => { if (!occupe) setChoixGroupe(false) }}
        />
      )}

      {choix && (
        <ChoixBeat
          groupe={choix}
          beats={beats}
          enCours={enCours === choix.cle}
          erreur={erreur}
          onChoisir={beatId => envoyer([{ cle: choix.cle, action: 'relier', beat_id: beatId }], choix.cle)}
          onFermer={() => { if (enCours === null) setChoix(null) }}
        />
      )}
    </div>
  )
}

function ChoixBeat({ groupe, description, beats, enCours, erreur, onChoisir, onFermer }: {
  groupe: GroupeTitre
  description?: string
  beats: BeatCatalogue[]
  enCours: boolean
  erreur: string | null
  onChoisir: (beatId: string) => void
  onFermer: () => void
}) {
  const [q, setQ] = useState('')
  const correspondants = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? beats.filter(b => b.titre.toLowerCase().includes(t)) : beats
  }, [beats, q])
  const trouves = correspondants.slice(0, 100)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onFermer}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-white mb-1">Choisir un beat</h2>
        <p className="text-xs text-gray-500 mb-4">
          {description ?? `Pour « ${groupe.libelle} » · ${nb(groupe.nbVentes)} vente${groupe.nbVentes > 1 ? 's' : ''}`}
        </p>
        <input
          autoFocus
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Rechercher dans ton catalogue…"
          className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors"
        />
        <div className="flex flex-col gap-1 mt-3 max-h-72 overflow-auto">
          {trouves.map(b => (
            <button
              key={b.id}
              onClick={() => onChoisir(b.id)}
              disabled={enCours}
              className={`text-left text-sm px-3 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors ${b.id === groupe.beatId ? 'bg-gray-800' : ''}`}
            >
              <NomBeat beat={b} />
            </button>
          ))}
          {trouves.length === 0 && <p className="text-xs text-gray-600 py-4 text-center">Aucun beat trouvé.</p>}
          {correspondants.length > trouves.length && (
            <p className="text-xs text-gray-600 py-2 text-center">
              {nb(correspondants.length - trouves.length)} autres beats : affine la recherche.
            </p>
          )}
        </div>
        {erreur && <p className="text-red-400 text-xs mt-2">{erreur}</p>}
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-400">{enCours && <><Roue petite /> Enregistrement…</>}</span>
          <button onClick={onFermer} disabled={enCours} className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-400 transition-colors">
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
