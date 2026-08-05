'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BeatMin, LicenceMin } from './PlayerContext'
import { usePlayer } from './PlayerContext'
import { useCart } from './CartContext'
import { FICHIERS_INCLUS, formatStreams } from '../_lib/licences'
import LicenceExpressPay, { type ExpressStatus } from './LicenceExpressPay'

const BULLET_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 12.5l5 5L20 6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const PAUSE_ICON = (
  <svg viewBox="0 0 12 13" width="14" height="15" fill="currentColor"><rect x="1" y="0.5" width="4" height="12" rx="1.5" /><rect x="7" y="0.5" width="4" height="12" rx="1.5" /></svg>
)
const PLAY_ICON = (
  <svg viewBox="0 0 12 13" width="15" height="16" fill="currentColor"><path d="M10.4312 4.39786C11.7645 5.16766 11.7645 7.09216 10.4312 7.86197L3.64156 11.7819C2.30822 12.5517 0.641555 11.5895 0.641555 10.0499L0.641556 2.20994C0.641556 0.670336 2.30822 -0.291914 3.64156 0.477887L10.4312 4.39786Z" /></svg>
)

function formatPrix(n: number) {
  return `${n.toFixed(2).replace('.', ',')} €`
}

function badgeLicence(l: LicenceMin): string | null {
  if (l.est_exclusive) return 'Exclusif'
  if (l.modele === 'wav') return 'Populaire'
  return null
}

// Format court affiché sous le nom de la carte (ex. "STEMS") — le détail
// complet des fichiers inclus est déjà donné dans le bloc "Inclus avec".
function formatCourt(modele: string) {
  const fichiers = FICHIERS_INCLUS[modele]
  return fichiers?.[fichiers.length - 1]?.toUpperCase() ?? modele.toUpperCase()
}

export default function LicenceSelectorModal({
  open,
  onClose,
  beat,
  slug,
}: {
  open: boolean
  onClose: () => void
  beat: BeatMin | null
  slug: string
}) {
  const { addItem, open: openCart } = useCart()
  const { isPlaying, togglePlay } = usePlayer()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)
  const [expressStatus, setExpressStatus] = useState<ExpressStatus>('loading')
  const [expressRedirection, setExpressRedirection] = useState(false)

  // Porté à l'intérieur de .shop-root (pas document.body) : --ac/--text/--lc-*
  // etc. sont des custom properties scopées à .shop-root, invisibles hors de
  // cet arbre — un portail vers document.body les laisserait toutes non résolues.
  useEffect(() => {
    setPortalTarget(document.querySelector('.shop-root'))
  }, [])

  useEffect(() => {
    if (open) {
      setSelectedId(null)
      setExpressStatus('loading')
      setExpressRedirection(false)
    }
  }, [open, beat?.id])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!beat || !portalTarget) return null

  const licences = (beat.licences ?? [])
    .filter(l => !l.sur_demande)
    .sort((a, b) => a.prix - b.prix)
  const selected: LicenceMin | undefined = licences.find(l => l.id === selectedId)
  const meta = [beat.tag, beat.bpm ? `${beat.bpm} BPM` : null].filter(Boolean).join(' · ')

  function confirmer() {
    if (!selected || !beat) return
    addItem({
      beatId: beat.id,
      licenceId: selected.id,
      titre: beat.titre,
      imageUrl: beat.image_url,
      licenceNom: selected.nom,
      prix: selected.prix,
    })
    openCart()
    onClose()
  }

  // Apple Pay/Google Pay (pas de redirection externe) : le webhook crée la
  // commande de façon asynchrone, on interroge jusqu'à ce qu'elle existe
  // puis on va directement à la page de téléchargement (pas de détour par
  // la bannière boutique). PayPal (redirection externe) est géré séparément
  // au retour, dans SuccessBanner.tsx via ?express_pi=.
  async function apresSuccesExpress({ paymentIntentId }: { paymentIntentId: string }) {
    setExpressRedirection(true)
    for (let tentative = 0; tentative < 10; tentative++) {
      const res = await fetch(`/api/telechargement/lookup?payment_intent=${paymentIntentId}`)
      if (res.ok) {
        const data = await res.json() as { commande_id?: string }
        if (data.commande_id) {
          window.location.href = `/telechargement/${data.commande_id}`
          return
        }
      }
      await new Promise(r => setTimeout(r, 1000))
    }
    // Le webhook a pu prendre plus de temps que prévu — le client reçoit de
    // toute façon l'email de confirmation, on ne bloque pas indéfiniment.
    window.location.href = `/${slug}`
  }

  return createPortal(
    <>
      {/* Sorties volontairement limitées à la croix et Échap — le clic sur
          l'overlay ne ferme pas, pour garder le client dans le tunnel d'achat. */}
      <div className={`shop-lc-overlay${open ? ' is-open' : ''}`} />
      <div className={`shop-lc-modal${open ? ' is-open' : ''}`} role="dialog" aria-modal="true">
        <div className="shop-lc-head">
          <button className="shop-lc-close" type="button" aria-label="Fermer" onClick={onClose}>&times;</button>
          <div className="shop-lc-beat">
            {beat.image_url && (
              <div className="shop-lc-cover-wrap">
                <img className="shop-lc-cover" src={beat.image_url} alt="" />
                <button
                  className="shop-lc-play"
                  type="button"
                  aria-label={isPlaying ? 'Pause' : 'Écouter'}
                  onClick={togglePlay}
                >
                  {isPlaying ? PAUSE_ICON : PLAY_ICON}
                </button>
              </div>
            )}
            <div>
              <div className="shop-lc-title">{beat.titre}</div>
              {meta && <div className="shop-lc-meta">{meta}</div>}
            </div>
          </div>
        </div>

        <div className="shop-lc-body">
          <div className="shop-lc-list">
            {licences.map(l => {
              const badge = badgeLicence(l)
              return (
                <button
                  key={l.id}
                  type="button"
                  className={`shop-lc-opt${l.id === selectedId ? ' is-selected' : ''}${l.est_exclusive ? ' shop-lc-opt--wide' : ''}`}
                  onClick={() => setSelectedId(l.id)}
                >
                  <div className="shop-lc-opt-top">
                    <span className="shop-lc-name">{l.nom}</span>
                    {badge && <span className="shop-lc-tag">{badge}</span>}
                    <span className="shop-lc-price">{formatPrix(l.prix)}</span>
                  </div>
                  <div className="shop-lc-short">{formatCourt(l.modele)}</div>
                </button>
              )
            })}
          </div>

          <div className="shop-lc-incl">
            <div className="shop-lc-incl-title">Inclus avec {selected ? selected.nom : '—'}</div>
            <div className="shop-lc-bullets">
              {selected ? (
                <>
                  <div className="shop-lc-bullet">{BULLET_ICON}Inclus : {FICHIERS_INCLUS[selected.modele]?.join(' + ')}</div>
                  <div className="shop-lc-bullet">{BULLET_ICON}Streams monétisés : {formatStreams(selected.streams_limite)}</div>
                  <div className="shop-lc-bullet">{BULLET_ICON}Vues vidéo : {formatStreams(selected.vues_video_limite)}</div>
                  {selected.clips_video_limite !== null && (
                    <div className="shop-lc-bullet">{BULLET_ICON}Clips vidéo : {selected.clips_video_limite}</div>
                  )}
                </>
              ) : (
                <div className="shop-lc-bullet">{BULLET_ICON}Sélectionne une licence pour voir le détail</div>
              )}
            </div>
          </div>
        </div>

        <div className="shop-lc-foot">
          {expressRedirection ? (
            <div className="shop-lc-express-redirecting">Paiement confirmé — préparation de tes fichiers…</div>
          ) : (
            <>
              {open && (
                <LicenceExpressPay
                  slug={slug}
                  beatId={beat.id}
                  selectedLicence={selected}
                  onStatusChange={setExpressStatus}
                  onSuccess={apresSuccesExpress}
                />
              )}
              <div className="shop-lc-totalRow">
                <div className="shop-lc-total">
                  <span className="shop-lc-total-label">Total</span>
                  <span className="shop-lc-total-value">{selected ? formatPrix(selected.prix) : '—'}</span>
                </div>
                <button
                  className={`shop-lc-submit${expressStatus === 'visible' ? ' shop-lc-submit--secondary' : ''}`}
                  type="button"
                  disabled={!selected}
                  onClick={confirmer}
                >
                  Ajouter au panier
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>,
    portalTarget
  )
}
