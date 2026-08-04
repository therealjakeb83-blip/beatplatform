'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BeatMin, LicenceMin } from './PlayerContext'
import { useCart } from './CartContext'
import { FICHIERS_INCLUS, formatStreams } from '../_lib/licences'

const BULLET_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" /><path d="M7 12.5l3 3 7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

function formatPrix(n: number) {
  return `${n.toFixed(2).replace('.', ',')} €`
}

function badgeLicence(l: LicenceMin): string | null {
  if (l.est_exclusive) return 'Exclusif'
  if (l.modele === 'wav') return 'Populaire'
  return null
}

export default function LicenceSelectorModal({
  open,
  onClose,
  beat,
}: {
  open: boolean
  onClose: () => void
  beat: BeatMin | null
}) {
  const { addItem, open: openCart } = useCart()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [portalTarget, setPortalTarget] = useState<Element | null>(null)

  // Porté à l'intérieur de .shop-root (pas document.body) : --ac/--text/--lc-*
  // etc. sont des custom properties scopées à .shop-root, invisibles hors de
  // cet arbre — un portail vers document.body les laisserait toutes non résolues.
  useEffect(() => {
    setPortalTarget(document.querySelector('.shop-root'))
  }, [])

  useEffect(() => {
    if (open) setSelectedId(null)
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

  return createPortal(
    <>
      {/* Sorties volontairement limitées à la croix et Échap — le clic sur
          l'overlay ne ferme pas, pour garder le client dans le tunnel d'achat. */}
      <div className={`shop-lc-overlay${open ? ' is-open' : ''}`} />
      <div className={`shop-lc-modal${open ? ' is-open' : ''}`} role="dialog" aria-modal="true">
        <div className="shop-lc-head">
          <button className="shop-lc-close" type="button" aria-label="Fermer" onClick={onClose}>&times;</button>
          <div className="shop-lc-beat">
            {beat.image_url && <img className="shop-lc-cover" src={beat.image_url} alt="" />}
            <div>
              <div className="shop-lc-eyebrow">Choisir une licence</div>
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
                  <div className="shop-lc-short">{FICHIERS_INCLUS[l.modele]?.join(' + ')}</div>
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
                <div className="shop-lc-bullet">Sélectionne une licence pour voir le détail</div>
              )}
            </div>
          </div>
        </div>

        <div className="shop-lc-foot">
          <div className="shop-lc-totalRow">
            <div className="shop-lc-total">
              <span className="shop-lc-total-label">Total</span>
              <span className="shop-lc-total-value">{selected ? formatPrix(selected.prix) : '—'}</span>
            </div>
            <button className="shop-lc-submit" type="button" disabled={!selected} onClick={confirmer}>
              Ajouter au panier
            </button>
          </div>
          <div className="shop-lc-legal">Licences PDF envoyées par email · téléchargement immédiat</div>
        </div>
      </div>
    </>,
    portalTarget
  )
}
