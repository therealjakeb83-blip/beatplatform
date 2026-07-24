'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { ResultatRechercheAdmin } from '@/lib/admin-recherche'

type Props = {
  rechercher: (requete: string) => Promise<{ resultat?: ResultatRechercheAdmin; erreur?: string }>
}

const STATUT_STYLES: Record<string, string> = {
  actif: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  suspendu: 'bg-red-500/15 text-red-400 border-red-500/30',
  inactif: 'bg-gray-700/30 text-gray-400 border-gray-600/30',
  impaye: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  annule: 'bg-gray-700/30 text-gray-400 border-gray-600/30',
  en_essai: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  payee: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  en_attente: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  remboursee: 'bg-gray-700/30 text-gray-400 border-gray-600/30',
  litige: 'bg-red-500/15 text-red-400 border-red-500/30',
}

function Badge({ statut }: { statut: string }) {
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded border ${STATUT_STYLES[statut] ?? 'bg-gray-700/30 text-gray-400 border-gray-600/30'}`}>
      {statut}
    </span>
  )
}

export default function RechercheClient({ rechercher }: Props) {
  const [q, setQ] = useState('')
  const [resultat, setResultat] = useState<ResultatRechercheAdmin | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [cherche, setCherche] = useState(false)

  function lancer(valeur: string) {
    setQ(valeur)
    if (!valeur.trim()) {
      setResultat(null)
      setCherche(false)
      return
    }
    startTransition(async () => {
      setCherche(true)
      const res = await rechercher(valeur)
      if (res.erreur) setErreur(res.erreur)
      else { setResultat(res.resultat ?? null); setErreur(null) }
    })
  }

  const total = resultat
    ? resultat.beatmakers.length + resultat.clients.length + resultat.commandes.length + resultat.abonnements.length
    : 0

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Recherche</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Email ou slug d&apos;un beatmaker, email/nom d&apos;un artiste, ou identifiant affiché dans le dashboard business (ex. <code className="text-gray-400">A3F92B1C</code>).
        </p>
      </div>

      <input
        autoFocus
        value={q}
        onChange={e => lancer(e.target.value)}
        placeholder="Rechercher..."
        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-gray-600"
      />

      {erreur && <p className="text-sm text-red-400">{erreur}</p>}

      {cherche && !isPending && resultat && total === 0 && (
        <p className="text-sm text-gray-600">Aucun résultat.</p>
      )}

      {resultat && resultat.beatmakers.length > 0 && (
        <Section titre="Boutiques">
          {resultat.beatmakers.map(b => (
            <Link key={b.id} href={`/dashboard/admin/boutiques/${b.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors">
              <div>
                <p className="text-sm text-white">{b.nom_artiste} <span className="text-gray-600">— {b.slug}</span></p>
                <p className="text-xs text-gray-500">{b.email}</p>
              </div>
              <Badge statut={b.statut} />
            </Link>
          ))}
        </Section>
      )}

      {resultat && resultat.clients.length > 0 && (
        <Section titre="Clients (artistes)">
          {resultat.clients.map(c => (
            <Link key={c.id} href={`/dashboard/admin/clients/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors">
              <div>
                <p className="text-sm text-white">{c.prenom} {c.nom}</p>
                <p className="text-xs text-gray-500">{c.email}</p>
              </div>
            </Link>
          ))}
        </Section>
      )}

      {resultat && resultat.commandes.length > 0 && (
        <Section titre="Commandes">
          {resultat.commandes.map(c => (
            <Link key={c.id} href={`/dashboard/admin/commandes/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors">
              <div>
                <p className="text-sm text-white">#{c.id.slice(0, 8).toUpperCase()} <span className="text-gray-600">— {c.acheteur_email ?? 'email inconnu'}</span></p>
                <p className="text-xs text-gray-500">{c.prix_paye}€ — {new Date(c.created_at).toLocaleDateString('fr-FR')}</p>
              </div>
              <Badge statut={c.statut} />
            </Link>
          ))}
        </Section>
      )}

      {resultat && resultat.abonnements.length > 0 && (
        <Section titre="Abonnements boutique">
          {resultat.abonnements.map(a => (
            <Link key={a.id} href={`/dashboard/admin/abonnements/${a.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors">
              <div>
                <p className="text-sm text-white">A-{a.id.slice(0, 8).toUpperCase()} <span className="text-gray-600">— {a.acheteur_email ?? 'email inconnu'}</span></p>
                <p className="text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString('fr-FR')}</p>
              </div>
              <Badge statut={a.statut} />
            </Link>
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">{titre}</p>
      {children}
    </div>
  )
}
