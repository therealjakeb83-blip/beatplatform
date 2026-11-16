'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'

type Compte = {
  id: string
  email: string | null
  prenom: string | null
  nom: string | null
  creeLe: string | null
  supprimeLe: string | null
  connexion: null | { creeLe: string; derniereConnexion: string | null; fournisseurs: string[] }
}
type Boutique = { beatmakerId: string; nom: string; source: string | null; effaceLe: string | null; newsletter: string; premierContact: string | null }
type Commande = { id: string; prix_paye: number; statut: string; created_at: string; boutique: string }

type Props = {
  compte: Compte
  boutiques: Boutique[]
  ficheConsultee: null | { beatmakerId: string; nom: string; lignes: [string, string][] }
  commandes: Commande[]
  abonnementsEnCours: string[]
  supprimerCompteAdminAction: (clientId: string, confirmation: string, desinscrire: string[]) => Promise<{ erreur?: string }>
}

const date = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('fr-FR') : '—'

// 9d lot 4 (option C1) : lecture seule pour le support ; seule action =
// supprimer le compte Sonoo, à la demande de la personne.
export default function ClientDetailClient({ compte, boutiques, ficheConsultee, commandes, abonnementsEnCours, supprimerCompteAdminAction }: Props) {
  const inscrites = boutiques.filter(b => b.newsletter === 'inscrit' && !b.effaceLe)
  const [ouvert, setOuvert] = useState(false)
  const [saisie, setSaisie] = useState('')
  const [coches, setCoches] = useState<Set<string>>(() => new Set(inscrites.map(b => b.beatmakerId)))
  const [erreur, setErreur] = useState<string | null>(null)
  const [fait, setFait] = useState(false)
  const [isPending, startTransition] = useTransition()

  function supprimer() {
    startTransition(async () => {
      const r = await supprimerCompteAdminAction(compte.id, saisie.trim(), [...coches])
      if (r.erreur) { setErreur(r.erreur); return }
      setErreur(null)
      setFait(true)
    })
  }

  const supprime = !!compte.supprimeLe || fait

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
      <div>
        <Link href="/dashboard/admin/recherche" className="text-xs text-gray-500 hover:text-gray-300">← Recherche</Link>
        <h1 className="text-xl font-bold text-white mt-1">
          {supprime ? 'Compte supprimé' : [compte.prenom, compte.nom].filter(Boolean).join(' ') || compte.email || '—'}
        </h1>
        <p className="text-xs text-gray-500 mt-1">Lecture seule (support). Les fiches des boutiques appartiennent aux boutiques : on ne les modifie, ne les exporte ni ne les efface jamais à leur place.</p>
      </div>

      {/* Compte Sonoo */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-1 text-sm">
        <p className="text-sm font-semibold text-white mb-2">Compte de la plateforme</p>
        {supprime ? (
          <p className="text-gray-400">Supprimé le {date(compte.supprimeLe ?? new Date().toISOString())} — ligne anonymisée, connexion supprimée.</p>
        ) : (
          <>
            <p className="text-gray-300">Email : {compte.email ?? '—'}</p>
            <p className="text-gray-400">
              {compte.connexion
                ? `Connexion active — créée le ${date(compte.connexion.creeLe)}, dernière connexion ${date(compte.connexion.derniereConnexion)}${compte.connexion.fournisseurs.length ? ` (${compte.connexion.fournisseurs.join(', ')})` : ''}`
                : 'Pas de connexion (achat ou inscription sans compte)'}
            </p>
            <p className="text-gray-500 text-xs">Fiche créée le {date(compte.creeLe)}</p>
          </>
        )}
      </div>

      {/* Boutiques */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">Fiches dans les boutiques ({boutiques.length})</p>
        {boutiques.length === 0 && <p className="px-4 py-3 text-xs text-gray-600">Aucune.</p>}
        {boutiques.map(b => (
          <div key={b.beatmakerId} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link href={`/dashboard/admin/boutiques/${b.beatmakerId}`} className="text-sm text-white hover:underline">{b.nom}</Link>
              <p className="text-xs text-gray-500">
                {b.effaceLe ? `Contact effacé par la boutique le ${date(b.effaceLe)}` : `${b.source ?? '—'} · 1er contact ${date(b.premierContact)} · newsletter ${b.newsletter}`}
              </p>
            </div>
            {/* Formulaire GET (jamais préchargé) : chaque clic = une consultation tracée */}
            <form method="GET">
              <input type="hidden" name="boutique" value={b.beatmakerId} />
              <button type="submit" className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">
                Consulter la fiche
              </button>
            </form>
          </div>
        ))}
      </div>

      {ficheConsultee && (
        <div className="bg-gray-900 border border-indigo-900/60 rounded-2xl px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-white">Fiche chez {ficheConsultee.nom}</p>
          <p className="text-xs text-gray-500">Consultation enregistrée au journal de la boutique (motif : support).</p>
          <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 text-sm">
            {ficheConsultee.lignes.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-gray-500">{k}</dt>
                <dd className="text-gray-200 whitespace-pre-wrap break-words">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">Commandes récentes ({commandes.length})</p>
        {commandes.length === 0 && <p className="px-4 py-3 text-xs text-gray-600">Aucune.</p>}
        {commandes.map(c => (
          <Link key={c.id} href={`/dashboard/admin/commandes/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors">
            <div>
              <p className="text-sm text-white">#{c.id.slice(0, 8).toUpperCase()} — {c.boutique}</p>
              <p className="text-xs text-gray-500">{date(c.created_at)}</p>
            </div>
            <span className="text-sm text-gray-400">{c.prix_paye}€</span>
          </Link>
        ))}
      </div>

      {/* Seule action : supprimer le compte de la plateforme */}
      {!supprime && (
        <div className="bg-gray-900 border border-red-900/40 rounded-2xl px-5 py-4 space-y-3 text-sm">
          {!ouvert ? (
            <button type="button" onClick={() => setOuvert(true)} className="text-sm text-red-400 hover:text-red-300">Supprimer le compte</button>
          ) : abonnementsEnCours.length > 0 ? (
            <p className="text-orange-300">Abonnement en cours chez {abonnementsEnCours.join(', ')} : il doit d&apos;abord être annulé.</p>
          ) : (
            <>
              <p className="text-gray-300">
                À la demande de la personne : connexion et favoris supprimés, compte anonymisé, fiches des boutiques intactes, email de confirmation envoyé.
              </p>
              {inscrites.length > 0 && (
                <div className="space-y-1">
                  <p className="text-gray-400">Désinscrire aussi de la newsletter de :</p>
                  {inscrites.map(b => (
                    <label key={b.beatmakerId} className="flex items-center gap-2 pl-2 text-gray-300">
                      <input
                        type="checkbox"
                        checked={coches.has(b.beatmakerId)}
                        onChange={() => setCoches(prev => { const n = new Set(prev); if (n.has(b.beatmakerId)) n.delete(b.beatmakerId); else n.add(b.beatmakerId); return n })}
                      />
                      {b.nom}
                    </label>
                  ))}
                </div>
              )}
              <label className="block">
                <span className="text-gray-400">Tape <strong className="text-white">SUPPRIMER</strong> pour confirmer</span>
                <input value={saisie} onChange={e => setSaisie(e.target.value)} autoComplete="off"
                  className="mt-1 w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-600" />
              </label>
              <button type="button" onClick={supprimer} disabled={isPending || saisie.trim() !== 'SUPPRIMER'}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-500 disabled:opacity-40">
                {isPending && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {isPending ? 'Suppression en cours…' : 'Supprimer définitivement le compte'}
              </button>
            </>
          )}
          {erreur && <p className="text-red-400">{erreur}</p>}
        </div>
      )}
    </div>
  )
}
