'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SplitRow } from '../page'
import { CONDITIONS_COLLAB_TEXTES, CONDITIONS_COLLAB_VERSION_ACTUELLE } from '@/lib/collaboration-conditions'

type Onglet = 'demandes' | 'collabs' | 'refusees'

const ONGLETS: { label: string; value: Onglet }[] = [
  { label: 'Demandes',   value: 'demandes' },
  { label: 'Mes collabs', value: 'collabs' },
  { label: 'Refusées',   value: 'refusees' },
]

const LIBELLE_STATUT: Record<SplitRow['statut'], string> = {
  invitee: 'En attente de ta réponse',
  active: 'Active',
  refusee: 'Refusée par toi',
  retiree: 'Invitation retirée',
  quittee: 'Quittée',
  evincee: 'Éviction',
}

function BeatCover({ beat }: { beat: SplitRow['beats'] }) {
  if (!beat) return <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0" />
  return (
    <div
      className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden"
      style={!beat.image_url ? { backgroundColor: beat.couleur ?? '#374151' } : undefined}
    >
      {beat.image_url ? (
        <img src={beat.image_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold">
          {beat.titre.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Acceptation = UN texte (résumé + dépliable) + UNE case (Phase 12, Q8/Q10 du
// grill-me). Le texte lui-même vit dans lib/collaboration-conditions.ts,
// partagé avec l'aperçu qu'en verra une future page d'invitation directe.
function PanneauAcceptation({ split, onAccepte, onErreur }: {
  split: SplitRow
  onAccepte: () => void
  onErreur: (msg: string) => void
}) {
  const [detailOuvert, setDetailOuvert] = useState(false)
  const [coche, setCoche] = useState(false)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const conditions = CONDITIONS_COLLAB_TEXTES[CONDITIONS_COLLAB_VERSION_ACTUELLE]

  async function accepter() {
    setEnvoiEnCours(true)
    const res = await fetch(`/api/business/collabs/${split.id}/accepter`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accepte: true }),
    })
    setEnvoiEnCours(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { onErreur(data.erreur ?? 'Erreur lors de l’acceptation.'); return }
    onAccepte()
  }

  return (
    <div className="mt-3 border-t border-gray-800 pt-3 flex flex-col gap-3">
      <ul className="list-disc pl-5 flex flex-col gap-1">
        {conditions.resume.map((point, i) => (
          <li key={i} className="text-xs text-gray-400">{point}</li>
        ))}
      </ul>
      <button type="button" onClick={() => setDetailOuvert(v => !v)} className="text-xs text-indigo-400 hover:underline self-start">
        {detailOuvert ? 'Masquer le texte complet' : 'Lire le texte complet'}
      </button>
      {detailOuvert && (
        <div className="flex flex-col gap-3 bg-gray-950 border border-gray-800 rounded-lg p-3 max-h-64 overflow-y-auto">
          {conditions.complet.map((section, i) => (
            <div key={i}>
              <p className="text-xs font-semibold text-gray-300 mb-1">{section.titre}</p>
              {section.paragraphes.map((p, j) => (
                <p key={j} className="text-xs text-gray-500 mb-1 last:mb-0">{p}</p>
              ))}
            </div>
          ))}
        </div>
      )}
      <label className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer">
        <input type="checkbox" checked={coche} onChange={e => setCoche(e.target.checked)} className="mt-0.5" />
        J’ai lu et j’accepte ces conditions de collaboration (part fixée à {split.pourcentage}%, mandat donné au propriétaire du beat pour gérer la vente).
      </label>
      <div className="flex gap-2">
        <button type="button" disabled={!coche || envoiEnCours} onClick={accepter}
          className="px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors">
          {envoiEnCours ? 'Envoi…' : 'Accepter la collaboration'}
        </button>
      </div>
    </div>
  )
}

export default function CollabsClient({ splits: initial }: { splits: SplitRow[] }) {
  const router = useRouter()
  const [splits, setSplits] = useState(initial)
  const [onglet, setOnglet] = useState<Onglet>('demandes')
  const [ouvertId, setOuvertId] = useState<string | null>(null)
  const [actionEnCours, setActionEnCours] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')

  const demandes = splits.filter(s => s.statut === 'invitee')
  const actives  = splits.filter(s => s.statut === 'active')
  const refusees = splits.filter(s => ['refusee', 'retiree', 'quittee', 'evincee'].includes(s.statut))

  function majStatutLocal(id: string, statut: SplitRow['statut']) {
    setSplits(prev => prev.map(s => (s.id === id ? { ...s, statut } : s)))
  }

  async function refuser(id: string) {
    setActionEnCours(id); setErreur('')
    const res = await fetch(`/api/business/collabs/${id}/refuser`, { method: 'POST' })
    setActionEnCours(null)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setErreur(data.erreur ?? 'Erreur lors du refus.'); return }
    majStatutLocal(id, 'refusee')
  }

  async function quitter(id: string) {
    setActionEnCours(id); setErreur('')
    const res = await fetch(`/api/business/collabs/${id}/quitter`, { method: 'POST' })
    setActionEnCours(null)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setErreur(data.erreur ?? 'Erreur lors du départ.'); return }
    majStatutLocal(id, 'quittee')
  }

  function onAccepteReussi(id: string) {
    majStatutLocal(id, 'active')
    setOuvertId(null)
    // hors_vente_collab reste vrai tant que la Phase 13 n'ouvre pas les
    // ventes collab (interrupteur global prévu au lot 4) — le beat
    // n'apparaît pas comme "en vente" ailleurs même une fois tout accepté.
    router.refresh()
  }

  function nomBeatmaker(s: SplitRow): string {
    return s.beats?.beatmakers?.nom_artiste ?? 'Un beatmaker'
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-1">Collaborations</h1>
      <p className="text-sm text-gray-500 mb-6">Les collaborations où tu es invité en tant que collaborateur (pas propriétaire).</p>

      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit mb-6">
        {ONGLETS.map(o => (
          <button key={o.value} onClick={() => setOnglet(o.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${onglet === o.value ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            {o.label} {o.value === 'demandes' && demandes.length > 0 && <span className="ml-1 text-indigo-400">({demandes.length})</span>}
          </button>
        ))}
      </div>

      {erreur && <p className="text-red-400 text-sm mb-4">{erreur}</p>}

      {onglet === 'demandes' && (
        demandes.length === 0 ? (
          <p className="text-sm text-gray-600">Aucune demande en attente.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {demandes.map(s => (
              <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <BeatCover beat={s.beats} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{s.beats?.titre ?? 'Beat'}</p>
                    <p className="text-xs text-gray-500">Invité par {nomBeatmaker(s)} — {formatDate(s.created_at)}</p>
                  </div>
                  <span className="text-indigo-400 text-sm font-semibold">{s.pourcentage}%</span>
                </div>
                {ouvertId === s.id ? (
                  <PanneauAcceptation split={s} onAccepte={() => onAccepteReussi(s.id)} onErreur={setErreur} />
                ) : (
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={() => setOuvertId(s.id)}
                      className="px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-medium transition-colors">
                      Voir et répondre
                    </button>
                    <button type="button" disabled={actionEnCours === s.id} onClick={() => refuser(s.id)}
                      className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors disabled:opacity-50">
                      {actionEnCours === s.id ? 'Refus…' : 'Refuser'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {onglet === 'collabs' && (
        actives.length === 0 ? (
          <p className="text-sm text-gray-600">Aucune collaboration active pour l’instant.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {actives.map(s => (
              <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
                <BeatCover beat={s.beats} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{s.beats?.titre ?? 'Beat'}</p>
                  <p className="text-xs text-gray-500">Par {nomBeatmaker(s)}{s.accepte_le ? ` — accepté le ${formatDate(s.accepte_le)}` : ''}</p>
                </div>
                <span className="text-indigo-400 text-sm font-semibold">{s.pourcentage}%</span>
                <button type="button" disabled={actionEnCours === s.id} onClick={() => { if (confirm('Quitter cette collaboration ? Le propriétaire repasse à 100% sur ce beat.')) quitter(s.id) }}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/60 text-gray-300 hover:text-red-300 text-xs transition-colors disabled:opacity-50">
                  {actionEnCours === s.id ? 'Départ…' : 'Quitter'}
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {onglet === 'refusees' && (
        refusees.length === 0 ? (
          <p className="text-sm text-gray-600">Rien ici pour l’instant.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {refusees.map(s => (
              <div key={s.id} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex items-center gap-3 opacity-80">
                <BeatCover beat={s.beats} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-300">{s.beats?.titre ?? 'Beat'}</p>
                  <p className="text-xs text-gray-500">
                    Par {nomBeatmaker(s)} — {LIBELLE_STATUT[s.statut]}
                    {s.statut === 'evincee' && s.motif_eviction ? ` (${s.motif_eviction})` : ''}
                  </p>
                </div>
                <span className="text-gray-500 text-sm">{s.pourcentage}%</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
