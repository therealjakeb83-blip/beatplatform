'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ApercuRemboursement } from '@/lib/remboursement'

// Remboursement d'une commande (Phase 13, lot 4a) : la fenêtre de
// confirmation détaille ce que chaque vendeur rend (et les frais Stripe qu'il
// ne récupère pas), prévient si le client a déjà téléchargé (plus
// d'obligation légale) ou si un compte vendeur ne peut plus rembourser.

const euros = (cents: number) => `€${(cents / 100).toFixed(2)}`

function Roue() {
  return <span className="inline-block w-3.5 h-3.5 border-2 border-gray-500 border-t-white rounded-full animate-spin align-[-2px]" />
}

export default function RemboursementButton({
  commandeId,
  libelle,
  tz,
}: {
  commandeId: string
  libelle: string
  tz: string
}) {
  const [etat, setEtat] = useState<'repos' | 'apercu' | 'confirmation' | 'envoi' | 'fini' | 'erreur'>('repos')
  const [apercu, setApercu] = useState<ApercuRemboursement | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  async function ouvrir() {
    setEtat('apercu')
    setMessage(null)
    try {
      const res = await fetch(`/api/business/commandes/${commandeId}/rembourser`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Erreur inconnue')
      const a = data as ApercuRemboursement
      if (a.action !== 'rembourser') throw new Error(a.raison ?? 'Rien à rembourser.')
      setApercu(a)
      setEtat('confirmation')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur inconnue')
      setEtat('erreur')
    }
  }

  async function confirmer() {
    setEtat('envoi')
    try {
      const res = await fetch(`/api/business/commandes/${commandeId}/rembourser`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Erreur inconnue')
      const echecs = (data.echecs ?? []) as { vendeurNom: string; erreur: string }[]
      setMessage(echecs.length
        ? `Remboursement incomplet : la part de ${echecs.map(e => e.vendeurNom).join(', ')} n'a pas pu être rendue (${echecs.map(e => e.erreur).join(' ; ')}). Les autres parts sont remboursées.`
        : 'Client remboursé, commande marquée comme remboursée.')
      setEtat(echecs.length ? 'erreur' : 'fini')
      setTimeout(() => router.refresh(), 800)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur inconnue')
      setEtat('erreur')
    }
  }

  if (etat === 'fini') return <span className="text-xs text-green-400">{message}</span>

  if (etat === 'apercu' || etat === 'envoi') {
    return (
      <span className="text-sm text-gray-300 flex items-center gap-2">
        <Roue /> {etat === 'apercu' ? 'Préparation du remboursement…' : 'Remboursement en cours auprès de Stripe…'}
      </span>
    )
  }

  if (etat === 'confirmation' && apercu) {
    const plusieurs = apercu.parts.length > 1
    const partsARendre = apercu.parts.filter(p => !p.dejaRembourse)
    const comptesInutilisables = partsARendre.filter(p => !p.compteUtilisable)
    return (
      <div className="space-y-3 max-w-xl">
        <p className="text-sm text-gray-200 font-medium">Tu vas rembourser {euros(apercu.totalCents)} au client :</p>
        <ul className="space-y-1">
          {partsARendre.map((p, i) => (
            <li key={i} className="text-sm text-gray-400">
              – {plusieurs ? (p.estProprietaire ? 'ta part' : `part de ${p.vendeurNom}`) : 'montant'} : {euros(p.montantCents)}
              {p.fraisCents != null && (
                <span className="text-gray-500"> (les frais Stripe de {euros(p.fraisCents)} {p.estProprietaire ? 'ne te sont pas rendus' : 'ne lui sont pas rendus'})</span>
              )}
            </li>
          ))}
        </ul>
        {apercu.telechargeLe && (
          <p className="text-xs text-amber-400">
            Le client a déjà téléchargé les fichiers le {new Date(apercu.telechargeLe).toLocaleDateString('fr-FR', { timeZone: tz })}.
            Tu n&apos;es plus légalement obligé de le rembourser, et s&apos;il est remboursé, il garde les fichiers.
          </p>
        )}
        {comptesInutilisables.map((p, i) => (
          <p key={i} className="text-xs text-red-400">
            Le compte Stripe de {p.vendeurNom} ne peut plus rembourser : sa part ({euros(p.montantCents)}) risque de ne pas être rendue.
            Elle reste sous sa responsabilité.
          </p>
        ))}
        <p className="text-xs text-gray-500">La licence sera annulée et l&apos;accès aux fichiers fermé. Une facture d&apos;avoir est émise pour chaque facture concernée.</p>
        <div className="flex items-center gap-3">
          <button onClick={confirmer} className="px-3 py-1.5 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white transition-colors">
            Confirmer le remboursement
          </button>
          <button onClick={() => setEtat('repos')} className="px-3 py-1.5 rounded-lg text-sm border border-gray-700 text-gray-400 hover:text-white transition-colors">
            Annuler
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={ouvrir}
        className="px-4 py-1.5 rounded-lg text-sm border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
      >
        {libelle}
      </button>
      {etat === 'erreur' && message && <p className="text-xs text-red-400 max-w-xl">{message}</p>}
    </div>
  )
}
