'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PartLitige, ResultatLitige } from '@/lib/litiges'
import { libelleMotifLitige } from '@/lib/litiges-libelles'
import { formatDateTz } from '@/lib/fuseau-horaire'

// Encart « Litige » de la fiche commande du propriétaire (Phase 13, lot 4b) :
// parts contestées, date limite, preuves prêtes, réponse (texte + fichier)
// envoyée sur le compte de chaque vendeur, ou acceptation (= perdu). Rien
// n'est envoyé automatiquement si A ne fait rien.

const TAILLE_MAX = 3 * 1024 * 1024

function Roue() {
  return <span className="inline-block w-3.5 h-3.5 border-2 border-gray-500 border-t-white rounded-full animate-spin align-[-2px]" />
}

const ETAT = {
  en_cours: { label: 'En cours', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
  gagne:    { label: 'Gagné',    cls: 'bg-green-500/15 text-green-400 border-green-500/20' },
  perdu:    { label: 'Perdu',    cls: 'bg-red-500/15 text-red-400 border-red-500/20' },
} as const

export default function EncartLitige({ commandeId, parts, preuves, tz }: {
  commandeId: string
  parts: PartLitige[]
  preuves: string[]
  tz: string
}) {
  const [texte, setTexte] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [etat, setEtat] = useState<'repos' | 'confirmer_reponse' | 'confirmer_acceptation' | 'envoi' | 'fini' | 'erreur'>('repos')
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const date = (iso: string | null) => (iso ? formatDateTz(iso, tz, { day: '2-digit', month: 'long', year: 'numeric' }) : '—')
  const plusieurs = parts.length > 1
  const nom = (p: PartLitige) => (p.estProprietaire ? (plusieurs ? 'Ta part' : 'Toi') : p.vendeurNom)
  const aRepondre = parts.filter(p => p.reponsePossible)
  const enCours = parts.some(p => p.statut === 'en_cours')

  function choisirFichier(f: File | null) {
    setMessage(null)
    if (f && f.size > TAILLE_MAX) {
      setFichier(null)
      setMessage('Fichier trop lourd : 3 Mo maximum.')
      setEtat('erreur')
      return
    }
    setFichier(f)
    if (etat === 'erreur') setEtat('repos')
  }

  async function envoyer(action: 'repondre' | 'accepter') {
    setEtat('envoi')
    setMessage(null)
    try {
      const form = new FormData()
      form.set('action', action)
      if (action === 'repondre') {
        form.set('texte', texte)
        if (fichier) form.set('fichier', fichier)
      }
      const res = await fetch(`/api/business/commandes/${commandeId}/litige`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Erreur inconnue')
      const r = data as ResultatLitige
      const morceaux: string[] = []
      if (r.envoyees.length) morceaux.push(action === 'repondre' ? 'Réponse envoyée.' : 'Litige accepté.')
      r.ignorees.forEach(i => morceaux.push(`Part de ${i.vendeurNom} non traitée : ${i.raison}.`))
      r.echecs.forEach(e => morceaux.push(`Échec pour la part de ${e.vendeurNom} : ${e.erreur}`))
      setMessage(morceaux.join(' ') || 'Rien à envoyer.')
      setEtat(r.echecs.length || !r.envoyees.length ? 'erreur' : 'fini')
      setTimeout(() => router.refresh(), 800)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur inconnue')
      setEtat('erreur')
    }
  }

  return (
    <div className="bg-gray-900 border border-orange-500/30 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-400">Litige</p>
        {enCours && <span className="text-xs text-gray-500">Le montant contesté est bloqué par Stripe jusqu&apos;à la décision de la banque.</span>}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-gray-600">
            <th className="text-left pb-2">{plusieurs ? 'Part' : 'Vendeur'}</th>
            <th className="text-right pb-2">Montant contesté</th>
            <th className="text-left pb-2 pl-4">Motif</th>
            <th className="text-left pb-2">Date limite</th>
            <th className="text-left pb-2">État</th>
            <th className="text-left pb-2">Réponse</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {parts.map(p => (
            <tr key={p.id} className="align-top">
              <td className="py-2 text-gray-200">{nom(p)}</td>
              <td className="py-2 text-right text-gray-300">€{p.montant.toFixed(2)}</td>
              <td className="py-2 pl-4 text-gray-400">{libelleMotifLitige(p.motif)}</td>
              <td className="py-2 text-gray-400">{p.statut === 'en_cours' ? date(p.dateLimite) : '—'}</td>
              <td className="py-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${ETAT[p.statut].cls}`}>{ETAT[p.statut].label}</span>
                {p.fermeLe && <span className="block text-[10px] text-gray-600 mt-0.5">le {date(p.fermeLe)}</span>}
              </td>
              <td className="py-2 text-xs">
                {p.reponsePar === 'proprietaire' && <span className="text-gray-300">Envoyée le {date(p.reponseEnvoyeeAt)}</span>}
                {p.reponsePar === 'acceptation' && <span className="text-gray-300">Litige accepté le {date(p.reponseEnvoyeeAt)}</span>}
                {p.reponsePar === 'vendeur_stripe' && (
                  <span className="text-orange-300">
                    {p.estProprietaire ? 'Tu as' : `${p.vendeurNom} a`} déjà répondu directement depuis Stripe : plus de réponse possible pour cette part.
                  </span>
                )}
                {!p.reponsePar && p.statut === 'en_cours' && <span className="text-gray-500">Pas encore de réponse</span>}
                {!p.reponsePar && p.statut !== 'en_cours' && <span className="text-gray-600">—</span>}
                {p.reponseErreur && p.statut === 'en_cours' && <span className="block text-red-400 mt-0.5">Dernier essai en échec : {p.reponseErreur}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {parts.some(p => p.statut === 'perdu') && (
        <p className="text-xs text-gray-400">
          Une part perdue est reprise sur le compte Stripe du vendeur concerné (avec les frais de litige de Stripe) et une facture d&apos;avoir est émise pour lui.
          La licence n&apos;étant plus payée en entier, elle est annulée ; les autres parts restent acquises.
        </p>
      )}

      {aRepondre.length > 0 && etat !== 'fini' && (
        <div className="border-t border-gray-800 pt-4 space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Preuves jointes automatiquement à ta réponse :</p>
            <ul className="text-xs text-gray-500 space-y-0.5">
              {preuves.map((p, i) => <li key={i}>– {p}</li>)}
            </ul>
          </div>

          {etat === 'envoi' ? (
            <p className="text-sm text-gray-300 flex items-center gap-2"><Roue /> Envoi à Stripe en cours, part par part… (ça peut prendre quelques secondes)</p>
          ) : etat === 'confirmer_reponse' ? (
            <div className="space-y-2 max-w-2xl">
              <p className="text-sm text-gray-200">
                Ta réponse va être envoyée à la banque du client{aRepondre.length > 1 ? `, pour ${aRepondre.length} parts (sur le compte Stripe de chaque vendeur)` : ''}.
                C&apos;est définitif : tu ne pourras plus la modifier ni la compléter.
              </p>
              <div className="flex items-center gap-3">
                <button onClick={() => envoyer('repondre')} className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">Confirmer l&apos;envoi</button>
                <button onClick={() => setEtat('repos')} className="px-3 py-1.5 rounded-lg text-sm border border-gray-700 text-gray-400 hover:text-white transition-colors">Retour</button>
              </div>
            </div>
          ) : etat === 'confirmer_acceptation' ? (
            <div className="space-y-2 max-w-2xl">
              <p className="text-sm text-gray-200">
                Accepter le litige revient à le perdre : le montant contesté reste rendu au client{aRepondre.length > 1 ? ' pour chaque part' : ''}, Stripe garde ses frais de litige,
                une facture d&apos;avoir est émise et la licence est annulée (accès aux fichiers fermé, Exclusive remise en vente). C&apos;est définitif.
              </p>
              <div className="flex items-center gap-3">
                <button onClick={() => envoyer('accepter')} className="px-3 py-1.5 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white transition-colors">Confirmer : accepter le litige</button>
                <button onClick={() => setEtat('repos')} className="px-3 py-1.5 rounded-lg text-sm border border-gray-700 text-gray-400 hover:text-white transition-colors">Retour</button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Ton explication (facultatif)</label>
                <textarea
                  value={texte}
                  onChange={e => setTexte(e.target.value)}
                  rows={4}
                  maxLength={15000}
                  placeholder="Ex. : le client a téléchargé les fichiers le…, il nous a écrit le… pour…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Fichier en plus (facultatif — PDF, JPEG ou PNG, 3 Mo max.)</label>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={e => choisirFichier(e.target.files?.[0] ?? null)}
                  className="text-xs text-gray-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-gray-800 file:text-gray-300"
                />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setEtat('confirmer_reponse')} className="px-4 py-1.5 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">Envoyer la réponse</button>
                <button onClick={() => setEtat('confirmer_acceptation')} className="px-4 py-1.5 rounded-lg text-sm border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors">Accepter le litige</button>
              </div>
              <p className="text-xs text-gray-600">Si tu ne fais rien, aucune réponse n&apos;est envoyée à ta place : passé la date limite, la banque tranche sans ta réponse.</p>
            </>
          )}
        </div>
      )}

      {message && <p className={`text-xs ${etat === 'fini' ? 'text-green-400' : 'text-red-400'}`}>{message}</p>}
    </div>
  )
}
