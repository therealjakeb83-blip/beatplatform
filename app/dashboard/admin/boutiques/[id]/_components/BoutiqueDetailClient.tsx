'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { RapportSuspension } from '@/lib/admin-boutiques'

type Beatmaker = {
  id: string
  email: string
  nom_artiste: string
  slug: string
  tagline: string | null
  bio: string | null
  telephone: string | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  pays: string
  numero_entreprise: string | null
  notes_admin: string | null
  statut: string
  suspendu_le: string | null
  suspendu_raison: string | null
  created_at: string
  stripe_account_id: string | null
  devise: string
  abonnement_exempte: boolean
}

type ChampsEditables = Record<'nom_artiste' | 'tagline' | 'bio' | 'telephone' | 'adresse' | 'ville' | 'code_postal' | 'numero_entreprise' | 'notes_admin', string>

type Props = {
  beatmaker: Beatmaker
  nbClients: number
  nbCommandes: number
  statutAbonnementPlateforme: string | null
  annulationPrevueAbonnementPlateforme: string | null
  nbAbosArtistesActifs: number
  suspendreAction: (id: string, raison: string) => Promise<{ rapport?: RapportSuspension; erreur?: string }>
  reactiverAction: (id: string) => Promise<{ rapport?: RapportSuspension; erreur?: string }>
  corrigerBeatmakerAction: (id: string, champs: Partial<ChampsEditables>) => Promise<{ erreur?: string }>
  exempterGateAction: (id: string, exempte: boolean) => Promise<{ erreur?: string }>
}

export default function BoutiqueDetailClient({
  beatmaker, nbClients, nbCommandes, statutAbonnementPlateforme, annulationPrevueAbonnementPlateforme, nbAbosArtistesActifs,
  suspendreAction, reactiverAction, corrigerBeatmakerAction, exempterGateAction,
}: Props) {
  const [statut, setStatut] = useState(beatmaker.statut)
  const [exempte, setExempte] = useState(beatmaker.abonnement_exempte)
  const [raison, setRaison] = useState('')
  const [modaleOuverte, setModaleOuverte] = useState(false)
  const [rapport, setRapport] = useState<RapportSuspension | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [champs, setChamps] = useState<ChampsEditables>({
    nom_artiste: beatmaker.nom_artiste, tagline: beatmaker.tagline ?? '', bio: beatmaker.bio ?? '',
    telephone: beatmaker.telephone ?? '', adresse: beatmaker.adresse ?? '', ville: beatmaker.ville ?? '',
    code_postal: beatmaker.code_postal ?? '', numero_entreprise: beatmaker.numero_entreprise ?? '', notes_admin: beatmaker.notes_admin ?? '',
  })
  const [enregistre, setEnregistre] = useState(false)

  function confirmerSuspension() {
    startTransition(async () => {
      const res = await suspendreAction(beatmaker.id, raison)
      if (res.erreur) { setErreur(res.erreur); return }
      setErreur(null)
      setRapport(res.rapport ?? null)
      setStatut('suspendu')
      setModaleOuverte(false)
      setRaison('')
    })
  }

  function reactiver() {
    startTransition(async () => {
      const res = await reactiverAction(beatmaker.id)
      if (res.erreur) { setErreur(res.erreur); return }
      setErreur(null)
      setRapport(res.rapport ?? null)
      setStatut('actif')
    })
  }

  function toggleExemption() {
    const nouvelleValeur = !exempte
    startTransition(async () => {
      const res = await exempterGateAction(beatmaker.id, nouvelleValeur)
      if (res.erreur) { setErreur(res.erreur); return }
      setErreur(null)
      setExempte(nouvelleValeur)
    })
  }

  function enregistrerChamps() {
    startTransition(async () => {
      const res = await corrigerBeatmakerAction(beatmaker.id, champs)
      if (res.erreur) { setErreur(res.erreur); return }
      setErreur(null)
      setEnregistre(true)
      setTimeout(() => setEnregistre(false), 2000)
    })
  }

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/admin/recherche" className="text-xs text-gray-500 hover:text-gray-300">← Recherche</Link>
          <h1 className="text-xl font-bold text-white mt-1">{beatmaker.nom_artiste}</h1>
          <p className="text-sm text-gray-500">{beatmaker.slug} — {beatmaker.email}</p>
        </div>
        <StatutBadge statut={statut} />
      </div>

      {erreur && <p className="text-sm text-red-400">{erreur}</p>}

      {statut === 'suspendu' && beatmaker.suspendu_raison && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          Suspendue {beatmaker.suspendu_le ? `le ${new Date(beatmaker.suspendu_le).toLocaleString('fr-FR')}` : ''} — {beatmaker.suspendu_raison}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Clients" valeur={nbClients} />
        <Stat label="Commandes" valeur={nbCommandes} />
        <Stat
          label="Abo. plateforme"
          valeur={statutAbonnementPlateforme ?? '—'}
          note={annulationPrevueAbonnementPlateforme ? `annulation ${new Date(annulationPrevueAbonnementPlateforme).toLocaleDateString('fr-FR')}` : undefined}
        />
        <Stat label="Artistes abonnés actifs" valeur={nbAbosArtistesActifs} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-3">
        <p className="text-sm font-semibold text-white">Gate abonnement plateforme (Étape 8b)</p>
        <p className="text-xs text-gray-500">
          Laisser-passer pour boutique de test — bypass le blocage dashboard même sans abonnement Stripe réel. Ne jamais activer sur une vraie boutique.
        </p>
        <button
          onClick={toggleExemption}
          disabled={isPending}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
            exempte ? 'bg-amber-600 text-white hover:bg-amber-500' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {isPending ? 'Mise à jour…' : exempte ? 'Exemptée — retirer le laisser-passer' : 'Exempter du gate'}
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-3">
        <p className="text-sm font-semibold text-white">Suspension</p>
        <p className="text-xs text-gray-500">
          Bloque le dashboard et la boutique publique, et met en pause (réversible) l&apos;abonnement plateforme du beatmaker ainsi que chaque abonnement artiste actif de sa boutique.
        </p>
        {statut === 'suspendu' ? (
          <button onClick={reactiver} disabled={isPending} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50">
            {isPending ? 'Réactivation…' : 'Réactiver la boutique'}
          </button>
        ) : (
          <button onClick={() => setModaleOuverte(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-500 transition-colors">
            Suspendre la boutique
          </button>
        )}

        {rapport && <RapportAffichage rapport={rapport} />}
      </div>

      {modaleOuverte && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 max-w-md w-full space-y-3">
            <p className="text-sm font-semibold text-white">Suspendre {beatmaker.nom_artiste} ?</p>
            <p className="text-xs text-gray-500">
              Ceci bloque immédiatement le dashboard ET la boutique publique de {beatmaker.nom_artiste}, et met en pause son abonnement plateforme ainsi que {nbAbosArtistesActifs} abonnement(s) artiste actif(s).
            </p>
            <textarea
              value={raison}
              onChange={e => setRaison(e.target.value)}
              placeholder="Raison de la suspension (obligatoire)"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setModaleOuverte(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white transition-colors">
                Annuler
              </button>
              <button onClick={confirmerSuspension} disabled={isPending || !raison.trim()} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50">
                {isPending ? 'Suspension…' : 'Confirmer la suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-3">
        <p className="text-sm font-semibold text-white">Infos (correction manuelle)</p>
        <p className="text-xs text-gray-500">
          Email, slug et Stripe Connect ne sont pas modifiables depuis l&apos;admin (voir cadrage Étape 15).
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Champ label="Nom d'artiste" valeur={champs.nom_artiste ?? ''} onChange={v => setChamps(c => ({ ...c, nom_artiste: v }))} />
          <Champ label="Téléphone" valeur={champs.telephone ?? ''} onChange={v => setChamps(c => ({ ...c, telephone: v }))} />
          <Champ label="Tagline" valeur={champs.tagline ?? ''} onChange={v => setChamps(c => ({ ...c, tagline: v }))} />
          <Champ label="Numéro d'entreprise" valeur={champs.numero_entreprise ?? ''} onChange={v => setChamps(c => ({ ...c, numero_entreprise: v }))} />
          <Champ label="Adresse" valeur={champs.adresse ?? ''} onChange={v => setChamps(c => ({ ...c, adresse: v }))} />
          <Champ label="Ville" valeur={champs.ville ?? ''} onChange={v => setChamps(c => ({ ...c, ville: v }))} />
          <Champ label="Code postal" valeur={champs.code_postal ?? ''} onChange={v => setChamps(c => ({ ...c, code_postal: v }))} />
        </div>
        <Champ label="Bio" valeur={champs.bio ?? ''} onChange={v => setChamps(c => ({ ...c, bio: v }))} multiline />
        <Champ label="Notes admin" valeur={champs.notes_admin ?? ''} onChange={v => setChamps(c => ({ ...c, notes_admin: v }))} multiline />

        <div className="flex items-center gap-3">
          <button onClick={enregistrerChamps} disabled={isPending} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50">
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {enregistre && <span className="text-xs text-emerald-400">Enregistré.</span>}
        </div>
      </div>

      <p className="text-xs text-gray-600">
        Stripe Connect : {beatmaker.stripe_account_id ? `${beatmaker.stripe_account_id.slice(0, 12)}…` : 'non connecté'} (lecture seule)
      </p>
    </div>
  )
}

function StatutBadge({ statut }: { statut: string }) {
  const styles: Record<string, string> = {
    actif: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    suspendu: 'bg-red-500/15 text-red-400 border-red-500/30',
    inactif: 'bg-gray-700/30 text-gray-400 border-gray-600/30',
  }
  return <span className={`text-xs px-2 py-1 rounded border ${styles[statut] ?? styles.inactif}`}>{statut}</span>
}

function Stat({ label, valeur, note }: { label: string; valeur: string | number; note?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
      <p className="text-lg font-bold text-white">{valeur}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {note && <p className="text-xs text-amber-400 mt-0.5">{note}</p>}
    </div>
  )
}

function Champ({ label, valeur, onChange, multiline }: { label: string; valeur: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-gray-500">{label}</span>
      {multiline ? (
        <textarea
          value={valeur}
          onChange={e => onChange(e.target.value)}
          rows={3}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-600"
        />
      ) : (
        <input
          value={valeur}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-600"
        />
      )}
    </label>
  )
}

function RapportAffichage({ rapport }: { rapport: RapportSuspension }) {
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 space-y-1 text-xs">
      <p className="text-gray-400">
        Abonnement plateforme : {!rapport.plateforme.existe ? 'aucun abonnement actif' : rapport.plateforme.pause ? 'mis en pause ✓' : `échec — ${rapport.plateforme.erreur}`}
      </p>
      <p className="text-gray-400">
        Abonnements artistes : {rapport.artistes.reussis}/{rapport.artistes.total} mis en pause
        {rapport.artistes.ignores > 0 && `, ${rapport.artistes.ignores} ignoré(s) (pas de Stripe lié)`}
      </p>
      {rapport.artistes.echecs.length > 0 && (
        <div className="text-red-400">
          Échecs à traiter manuellement :
          <ul className="list-disc list-inside">
            {rapport.artistes.echecs.map(e => <li key={e.id}>{e.email ?? e.id} — {e.erreur}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
