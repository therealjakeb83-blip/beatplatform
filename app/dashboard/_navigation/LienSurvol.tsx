'use client'

import Link from 'next/link'
import { useState, type ComponentProps } from 'react'

// Rang 9e : dans le dashboard, une page n'est préparée qu'au survol (ou au
// toucher / au clavier), jamais pour tous les liens visibles d'un coup —
// pratique recommandée par la doc Next.js 16 (« prefetch on hover »). Avant,
// chaque page lançait 30 à 55 préparations, chacune repassant par proxy.ts et
// la base. Même usage que <Link> ; prefetch={false} reste respecté.
export default function LienSurvol({ prefetch, onMouseEnter, onTouchStart, onFocus, ...props }: ComponentProps<typeof Link>) {
  const [intention, setIntention] = useState(false)
  if (prefetch === false) return <Link {...props} prefetch={false} onMouseEnter={onMouseEnter} onTouchStart={onTouchStart} onFocus={onFocus} />
  return (
    <Link
      {...props}
      prefetch={intention ? (prefetch ?? null) : false}
      onMouseEnter={e => { setIntention(true); onMouseEnter?.(e) }}
      onTouchStart={e => { setIntention(true); onTouchStart?.(e) }}
      onFocus={e => { setIntention(true); onFocus?.(e) }}
    />
  )
}
