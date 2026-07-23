'use client'

import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'

export type LicenceMin = { id: string; nom: string; prix: number; sur_demande: boolean }

export type BeatMin = {
  id: string
  titre: string
  image_url: string | null
  mp3_tague_url: string | null
  // Facultatifs — alimentés par BeatCatalogue pour l'affichage BPM/tag et
  // le bouton "+ Ajouter" du player (licence la moins chère, ajoutée
  // directement au panier sans repasser par la page du beat).
  bpm?: number | null
  tag?: string | null
  licences?: LicenceMin[]
}

type PlayerContextType = {
  currentBeat: BeatMin | null
  isPlaying: boolean
  queue: BeatMin[]
  progress: number
  duration: number
  isShuffled: boolean
  loopOne: boolean
  play: (beat: BeatMin, queue: BeatMin[]) => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  seek: (pct: number) => void
  toggleShuffle: () => void
  toggleLoop: () => void
}

const PlayerContext = createContext<PlayerContextType | null>(null)

// Mélange persistant (Fisher-Yates) : figé jusqu'à désactivation du shuffle,
// pas un tirage aléatoire à chaque ⏭ — décision Jake du 2026-07-22.
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentBeat, setCurrentBeat] = useState<BeatMin | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [queue, setQueue] = useState<BeatMin[]>([])
  const [shuffleOrder, setShuffleOrder] = useState<BeatMin[]>([])
  const [isShuffled, setIsShuffled] = useState(false)
  const [loopOne, setLoopOne] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const audioRef        = useRef<HTMLAudioElement | null>(null)
  const queueRef        = useRef<BeatMin[]>([])
  const shuffleOrderRef = useRef<BeatMin[]>([])
  const isShuffledRef   = useRef(false)
  const loopOneRef      = useRef(false)
  const currentBeatRef  = useRef<BeatMin | null>(null)
  const playedBeatsRef  = useRef<Set<string>>(new Set())
  const trackingRef     = useRef<{ beatId: string; accumulated: number; playedAt: number | null; play_id: string | null } | null>(null)
  const finalizeRef     = useRef<(beacon: boolean) => void>(() => {})

  useEffect(() => { queueRef.current = queue }, [queue])
  useEffect(() => { shuffleOrderRef.current = shuffleOrder }, [shuffleOrder])
  useEffect(() => { isShuffledRef.current = isShuffled }, [isShuffled])
  useEffect(() => { loopOneRef.current = loopOne }, [loopOne])
  useEffect(() => { currentBeatRef.current = currentBeat }, [currentBeat])

  // File active pour la navigation ⏮/⏭ et l'auto-avance en fin de piste :
  // l'ordre mélangé si shuffle actif, sinon l'ordre d'origine.
  function activeQueue() {
    return isShuffledRef.current ? shuffleOrderRef.current : queueRef.current
  }

  // Envoie la durée à chaque navigation Next.js (le PlayerProvider ne se démonte jamais)
  const pathname = usePathname()
  useEffect(() => {
    return () => { finalizeRef.current(false) }
  }, [pathname])

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    function getSource(): string {
      const cached = sessionStorage.getItem('source_marketing')
      if (cached) return cached
      const params = new URLSearchParams(window.location.search)
      const utm = params.get('utm_source')?.toLowerCase()
      const utmMedium = params.get('utm_medium')?.toLowerCase()
      const gclid = params.get('gclid')
      const gbraid = params.get('gbraid')
      const gadSource = params.get('gad_source')
      let source: string
      if (gclid || gbraid) source = gadSource === '2' ? 'youtube_ads' : 'google_ads'
      else if (utm === 'google' && utmMedium === 'cpc') source = 'google_ads'
      else if (utm === 'youtube' || utm === 'instagram' || utm === 'tiktok' || utm === 'newsletter' || utm === 'google') source = utm
      else if (utm) source = 'autre'
      else {
        const ref = document.referrer.toLowerCase()
        if (ref.includes('youtube.com') || ref.includes('youtu.be')) source = 'youtube'
        else if (ref.includes('instagram.com')) source = 'instagram'
        else if (ref.includes('tiktok.com')) source = 'tiktok'
        else if (ref.includes('google.com')) source = 'google'
        else if (ref && !ref.includes(window.location.hostname)) source = 'autre'
        else source = 'direct'
      }
      sessionStorage.setItem('source_marketing', source)
      return source
    }

    // Capture la source dès l'arrivée sur la boutique, même sans écoute
    getSource()

    async function recordPlay(beatId: string) {
      try {
        const res  = await fetch('/api/boutique/plays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ beat_id: beatId, source_marketing: getSource() }),
        })
        const data = await res.json()
        if (data.play_id && trackingRef.current?.beatId === beatId) {
          trackingRef.current.play_id = data.play_id
        }
      } catch {}
    }

    function finalizeDuration(useBeacon: boolean) {
      const t = trackingRef.current
      if (!t?.play_id) return
      const total = t.accumulated + (t.playedAt != null ? Date.now() - t.playedAt : 0)
      const duree_secondes = Math.round(total / 1000)
      const body = JSON.stringify({ play_id: t.play_id, duree_secondes })
      // Effacer play_id pour ne pas envoyer deux fois
      t.play_id = null
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/boutique/plays/duration', new Blob([body], { type: 'application/json' }))
      } else {
        fetch('/api/boutique/plays/duration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }).catch(() => {})
      }
    }

    // Exposer finalizeDuration pour le watcher de pathname
    finalizeRef.current = finalizeDuration

    function checkThreshold() {
      const t = trackingRef.current
      if (!t || playedBeatsRef.current.has(t.beatId)) return
      const total = t.accumulated + (t.playedAt != null ? Date.now() - t.playedAt : 0)
      if (total >= 30_000) {
        playedBeatsRef.current.add(t.beatId)
        recordPlay(t.beatId)
      }
    }

    const handleBeforeUnload    = () => finalizeDuration(true)
    const handleVisibilityChange = () => { if (document.visibilityState === 'hidden') finalizeDuration(true) }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration)
      checkThreshold()
    })
    audio.addEventListener('durationchange', () => setDuration(audio.duration || 0))
    audio.addEventListener('play', () => {
      setIsPlaying(true)
      const beatId = currentBeatRef.current?.id
      if (!beatId) return
      if (playedBeatsRef.current.has(beatId)) {
        // Écoute déjà comptée — reprend le chrono pour la durée finale
        if (trackingRef.current?.beatId === beatId && trackingRef.current.playedAt === null) {
          trackingRef.current.playedAt = Date.now()
        }
        return
      }
      if (!trackingRef.current || trackingRef.current.beatId !== beatId) {
        finalizeDuration(false) // envoie la durée du beat précédent
        trackingRef.current = { beatId, accumulated: 0, playedAt: Date.now(), play_id: null }
      } else {
        trackingRef.current.playedAt = Date.now()
      }
    })
    audio.addEventListener('pause', () => {
      setIsPlaying(false)
      if (trackingRef.current?.playedAt != null) {
        trackingRef.current.accumulated += Date.now() - trackingRef.current.playedAt
        trackingRef.current.playedAt = null
      }
    })
    audio.addEventListener('ended', () => {
      const cur = currentBeatRef.current
      if (!cur) return
      if (loopOneRef.current) {
        audio.currentTime = 0
        audio.play().catch(() => {})
        return
      }
      const q = isShuffledRef.current ? shuffleOrderRef.current : queueRef.current
      if (q.length === 0) {
        setIsPlaying(false)
        setProgress(0)
        return
      }
      // Boucle circulaire : jamais de silence en fin de liste, on repart au début.
      const idx      = q.findIndex(b => b.id === cur.id)
      const nextBeat = q[idx === -1 ? 0 : (idx + 1) % q.length]
      setCurrentBeat(nextBeat)
      currentBeatRef.current = nextBeat
    })

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      finalizeDuration(false)
      audio.pause()
      audio.src = ''
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentBeat?.mp3_tague_url) return
    setProgress(0)
    audio.src = currentBeat.mp3_tague_url
    audio.load()
    audio.play().catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBeat?.id])

  const play = useCallback((beat: BeatMin, newQueue: BeatMin[]) => {
    setQueue(newQueue)
    queueRef.current = newQueue
    if (isShuffledRef.current) {
      const shuffled = shuffleArray(newQueue)
      setShuffleOrder(shuffled)
      shuffleOrderRef.current = shuffled
    }
    if (currentBeatRef.current?.id === beat.id) {
      const audio = audioRef.current
      if (!audio) return
      if (audio.paused) audio.play().catch(() => {})
      else audio.pause()
    } else {
      setCurrentBeat(beat)
      currentBeatRef.current = beat
    }
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentBeatRef.current) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }, [])

  // ⏮/⏭ bouclent toujours circulairement (retour au début après le dernier
  // morceau) — décision Jake du 2026-07-22 : "jamais laisser l'utilisateur
  // dans le vide". Indépendant du toggle loop (qui gère la fin de piste
  // naturelle en repeat-one).
  const next = useCallback(() => {
    const q   = activeQueue()
    const cur = currentBeatRef.current
    if (!cur || q.length === 0) return
    const idx      = q.findIndex(b => b.id === cur.id)
    const nextBeat = q[idx === -1 ? 0 : (idx + 1) % q.length]
    setCurrentBeat(nextBeat)
    currentBeatRef.current = nextBeat
  }, [])

  const prev = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; return }
    const q   = activeQueue()
    const cur = currentBeatRef.current
    if (!cur || q.length === 0) return
    const idx      = q.findIndex(b => b.id === cur.id)
    const prevBeat = q[idx === -1 ? 0 : (idx - 1 + q.length) % q.length]
    setCurrentBeat(prevBeat)
    currentBeatRef.current = prevBeat
  }, [])

  const seek = useCallback((pct: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = (audio.duration || 0) * pct
  }, [])

  const toggleShuffle = useCallback(() => {
    setIsShuffled(prev => {
      const nextVal = !prev
      isShuffledRef.current = nextVal
      if (nextVal) {
        const shuffled = shuffleArray(queueRef.current)
        setShuffleOrder(shuffled)
        shuffleOrderRef.current = shuffled
      }
      return nextVal
    })
  }, [])

  const toggleLoop = useCallback(() => {
    setLoopOne(prev => !prev)
  }, [])

  return (
    <PlayerContext.Provider value={{
      currentBeat, isPlaying, queue, progress, duration, isShuffled, loopOne,
      play, togglePlay, next, prev, seek, toggleShuffle, toggleLoop,
    }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer doit être utilisé dans un PlayerProvider')
  return ctx
}
