'use client'

import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'

export type BeatMin = {
  id: string
  titre: string
  image_url: string | null
  mp3_tague_url: string | null
}

type PlayerContextType = {
  currentBeat: BeatMin | null
  isPlaying: boolean
  queue: BeatMin[]
  progress: number
  duration: number
  play: (beat: BeatMin, queue: BeatMin[]) => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  seek: (pct: number) => void
}

const PlayerContext = createContext<PlayerContextType | null>(null)

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentBeat, setCurrentBeat] = useState<BeatMin | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [queue, setQueue] = useState<BeatMin[]>([])
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const audioRef        = useRef<HTMLAudioElement | null>(null)
  const queueRef        = useRef<BeatMin[]>([])
  const currentBeatRef  = useRef<BeatMin | null>(null)
  const playedBeatsRef  = useRef<Set<string>>(new Set())
  const trackingRef     = useRef<{ beatId: string; accumulated: number; playedAt: number | null } | null>(null)

  useEffect(() => { queueRef.current = queue }, [queue])
  useEffect(() => { currentBeatRef.current = currentBeat }, [currentBeat])

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    function getSource(): string {
      const params = new URLSearchParams(window.location.search)
      const utm = params.get('utm_source')?.toLowerCase()
      if (utm === 'youtube' || utm === 'instagram' || utm === 'google') return utm
      if (utm) return 'autre'
      const ref = document.referrer.toLowerCase()
      if (ref.includes('youtube.com') || ref.includes('youtu.be')) return 'youtube'
      if (ref.includes('instagram.com')) return 'instagram'
      if (ref.includes('google.com')) return 'google'
      if (ref && !ref.includes(window.location.hostname)) return 'autre'
      return 'direct'
    }

    function recordPlay(beatId: string) {
      fetch('/api/boutique/plays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beat_id: beatId, source_marketing: getSource() }),
      }).catch(() => {})
    }

    function checkThreshold() {
      const t = trackingRef.current
      if (!t || playedBeatsRef.current.has(t.beatId)) return
      const total = t.accumulated + (t.playedAt != null ? Date.now() - t.playedAt : 0)
      if (total >= 30_000) {
        playedBeatsRef.current.add(t.beatId)
        recordPlay(t.beatId)
      }
    }

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration)
      checkThreshold()
    })
    audio.addEventListener('durationchange', () => setDuration(audio.duration || 0))
    audio.addEventListener('play', () => {
      setIsPlaying(true)
      const beatId = currentBeatRef.current?.id
      if (!beatId || playedBeatsRef.current.has(beatId)) return
      if (!trackingRef.current || trackingRef.current.beatId !== beatId) {
        trackingRef.current = { beatId, accumulated: 0, playedAt: Date.now() }
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
      const q = queueRef.current
      const cur = currentBeatRef.current
      if (!cur) return
      const idx = q.findIndex(b => b.id === cur.id)
      const nextBeat = q[idx + 1]
      if (nextBeat) {
        setCurrentBeat(nextBeat)
        currentBeatRef.current = nextBeat
      } else {
        setIsPlaying(false)
        setProgress(0)
      }
    })

    return () => {
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

  const next = useCallback(() => {
    const q = queueRef.current
    const cur = currentBeatRef.current
    if (!cur) return
    const idx = q.findIndex(b => b.id === cur.id)
    const nextBeat = q[idx + 1]
    if (nextBeat) { setCurrentBeat(nextBeat); currentBeatRef.current = nextBeat }
  }, [])

  const prev = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    const q = queueRef.current
    const cur = currentBeatRef.current
    if (!cur) return
    const idx = q.findIndex(b => b.id === cur.id)
    const prevBeat = q[idx - 1]
    if (prevBeat) { setCurrentBeat(prevBeat); currentBeatRef.current = prevBeat }
  }, [])

  const seek = useCallback((pct: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = (audio.duration || 0) * pct
  }, [])

  return (
    <PlayerContext.Provider value={{ currentBeat, isPlaying, queue, progress, duration, play, togglePlay, next, prev, seek }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer doit être utilisé dans un PlayerProvider')
  return ctx
}
