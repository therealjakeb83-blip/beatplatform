'use client'

import { createPortal } from 'react-dom'

// Écran d'attente pendant l'encaissement après Apple Pay / Google Pay / Link
// (demande de Jake, 2026-09-30) : une fois la fenêtre du wallet fermée,
// l'encaissement prend 5 à 15 s (plusieurs vendeurs, contrat) et rien ne se
// voyait — le client pouvait croire que le paiement avait échoué.
// Rendu dans <body> : le panneau du panier est transformé, un `fixed` à
// l'intérieur serait limité au panneau.
export default function PaiementEnAttente({ message, titre }: { message?: string | null; titre?: string }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div role="status" aria-live="polite" style={{
      position: 'fixed', inset: 0, zIndex: 2147483000,
      background: 'rgba(255,255,255,.92)', color: '#0A0A0C',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 14, padding: '0 24px', textAlign: 'center', fontFamily: 'inherit',
    }}>
      <style>{`
        @keyframes paiement-attente-tour { to { transform: rotate(360deg) } }
        .paiement-attente-roue { animation: paiement-attente-tour .8s linear infinite }
        @media (prefers-reduced-motion: reduce) { .paiement-attente-roue { animation-duration: 2.4s } }
      `}</style>
      <span className="paiement-attente-roue" aria-hidden="true" style={{
        width: 34, height: 34, borderRadius: '50%',
        border: '3px solid rgba(10,10,12,.15)', borderTopColor: '#0A0A0C',
      }} />
      <strong style={{ fontSize: 17 }}>{titre ?? 'Paiement en cours…'}</strong>
      <span style={{ fontSize: 14, color: 'rgba(10,10,12,.7)', maxWidth: 360, lineHeight: 1.45 }}>
        {message ?? 'Ne ferme pas cette page, ça peut prendre quelques secondes.'}
      </span>
    </div>,
    document.body,
  )
}
