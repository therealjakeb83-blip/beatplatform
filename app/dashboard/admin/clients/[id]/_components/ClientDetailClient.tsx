'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'

type Client = { id: string; email: string; nom: string; prenom: string; telephone: string | null; langue: string | null; created_at: string }
type Lead = { beatmaker_id: string; source: string; converti: boolean; beatmakers: { nom_artiste: string; slug: string } | null }
type Commande = { id: string; beatmaker_id: string; prix_paye: number; statut: string; created_at: string; beatmakers: { nom_artiste: string } | null }

type Props = {
  client: Client
  leads: Lead[]
  commandes: Commande[]
  corrigerClientAction: (id: string, champs: Partial<Record<'nom' | 'prenom' | 'telephone' | 'langue', string>>) => Promise<{ erreur?: string }>
}

export default function ClientDetailClient({ client, leads, commandes, corrigerClientAction }: Props) {
  const [champs, setChamps] = useState({ nom: client.nom, prenom: client.prenom, telephone: client.telephone ?? '', langue: client.langue ?? '' })
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistre, setEnregistre] = useState(false)
  const [isPending, startTransition] = useTransition()

  function enregistrer() {
    startTransition(async () => {
      const res = await corrigerClientAction(client.id, champs)
      if (res.erreur) { setErreur(res.erreur); return }
      setErreur(null)
      setEnregistre(true)
      setTimeout(() => setEnregistre(false), 2000)
    })
  }

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
      <div>
        <Link href="/dashboard/admin/recherche" className="text-xs text-gray-500 hover:text-gray-300">← Recherche</Link>
        <h1 className="text-xl font-bold text-white mt-1">{client.prenom} {client.nom}</h1>
        <p className="text-sm text-gray-500">{client.email} — inscrit le {new Date(client.created_at).toLocaleDateString('fr-FR')}</p>
      </div>

      {erreur && <p className="text-sm text-red-400">{erreur}</p>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-3">
        <p className="text-sm font-semibold text-white">Infos (correction manuelle)</p>
        <p className="text-xs text-gray-500">L&apos;email n&apos;est pas modifiable depuis l&apos;admin (identifiant de connexion partagé entre boutiques).</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Champ label="Prénom" valeur={champs.prenom} onChange={v => setChamps(c => ({ ...c, prenom: v }))} />
          <Champ label="Nom" valeur={champs.nom} onChange={v => setChamps(c => ({ ...c, nom: v }))} />
          <Champ label="Téléphone" valeur={champs.telephone} onChange={v => setChamps(c => ({ ...c, telephone: v }))} />
          <Champ label="Langue" valeur={champs.langue} onChange={v => setChamps(c => ({ ...c, langue: v }))} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={enregistrer} disabled={isPending} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50">
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {enregistre && <span className="text-xs text-emerald-400">Enregistré.</span>}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">Boutiques ({leads.length})</p>
        {leads.length === 0 && <p className="px-4 py-3 text-xs text-gray-600">Aucune.</p>}
        {leads.map(l => (
          <Link key={l.beatmaker_id} href={`/dashboard/admin/boutiques/${l.beatmaker_id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors">
            <span className="text-sm text-white">{l.beatmakers?.nom_artiste ?? '—'}</span>
            <span className="text-xs text-gray-500">{l.source}{l.converti ? ' — converti' : ''}</span>
          </Link>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">Commandes récentes ({commandes.length})</p>
        {commandes.length === 0 && <p className="px-4 py-3 text-xs text-gray-600">Aucune.</p>}
        {commandes.map(c => (
          <Link key={c.id} href={`/dashboard/admin/commandes/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors">
            <div>
              <p className="text-sm text-white">#{c.id.slice(0, 8).toUpperCase()} — {c.beatmakers?.nom_artiste ?? '—'}</p>
              <p className="text-xs text-gray-500">{new Date(c.created_at).toLocaleDateString('fr-FR')}</p>
            </div>
            <span className="text-sm text-gray-400">{c.prix_paye}€</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Champ({ label, valeur, onChange }: { label: string; valeur: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        value={valeur}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-600"
      />
    </label>
  )
}
