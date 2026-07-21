'use client'

import { useEffect, useRef } from 'react'

// Drag-to-scroll + inertie souris pour les rangées/carrousels horizontaux —
// spec exacte : specs/interactions.md §3 du dossier de design. Le tactile
// garde le scroll natif (on ne branche que mouse*), et un drag > 4px
// supprime le clic qui suit pour éviter les navigations accidentelles.
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let isDown = false
    let dragged = false
    let startX = 0
    let startScroll = 0
    let lastX = 0
    let lastT = 0
    let velocity = 0
    let raf = 0

    function stopInertia() {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }

    function runInertia() {
      if (!el) return
      if (Math.abs(velocity) < 0.4) { stopInertia(); return }
      el.scrollLeft += velocity
      velocity *= 0.94
      raf = requestAnimationFrame(runInertia)
    }

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return
      stopInertia()
      isDown = true
      dragged = false
      startX = e.clientX
      startScroll = el!.scrollLeft
      lastX = e.clientX
      lastT = performance.now()
      velocity = 0
      el!.dataset.dragging = 'true'
      e.preventDefault()
    }

    function onMouseMove(e: MouseEvent) {
      if (!isDown) return
      const dx = e.clientX - startX
      if (Math.abs(dx) > 4) dragged = true
      el!.scrollLeft = startScroll - dx

      const now = performance.now()
      const dt = now - lastT
      if (dt > 0) velocity = -((e.clientX - lastX) / dt) * 16
      lastX = e.clientX
      lastT = now
    }

    function onMouseUp() {
      if (!isDown) return
      isDown = false
      delete el!.dataset.dragging
      if (!reduceMotion) runInertia()
    }

    function onClickCapture(e: MouseEvent) {
      if (dragged) {
        e.preventDefault()
        e.stopPropagation()
        dragged = false
      }
    }

    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    el.addEventListener('click', onClickCapture, true)

    return () => {
      stopInertia()
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('click', onClickCapture, true)
    }
  }, [])

  return ref
}
