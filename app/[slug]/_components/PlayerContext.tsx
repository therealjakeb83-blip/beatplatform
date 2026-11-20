'use client'

import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'

export type LicenceMin = {
  id: string
  nom: string
  modele: string
  prix: number
  sur_demande: boolean
  est_exclusive: boolean
  inclut_mp3: boolean
  inclut_wav: boolean
  inclut_stems: boolean
  streams_limite: number | null
  vues_video_limite: number | null
  clips_video_limite: number | null
}

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
  // Id du beat dont la cover mobile affiche ses contrôles (play/panier) —
  // une seule cover ouverte à la fois, indépendant de isPlaying (le
  // play/pause ne referme pas les contrôles, seul un re-tap sur la cover le fait).
  mobileControlsBeatId: string | null
  setMobileControlsBeatId: (id: string | null) => void
  // Sélecteur de licence — toujours pour `currentBeat`, ouvrable depuis
  // n'importe quel composant (player, carte beat...) sans dupliquer l'état.
  licenceModalOpen: boolean
  openLicenceModal: () => void
  closeLicenceModal: () => void
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
// Rang 9f, Lot 1 (décision 2) : `mp3_tague_url` est un lien TEMPORAIRE vers
// l'espace privé, préparé avec la page. Proche de l'expiration (page laissée
// ouverte) ou refusé en cours de lecture : on en redemande un et la lecture
// reprend au même endroit, sans recharger la page.
function lienExpireBientot(url: string): boolean {
  try {
    const u = new URL(url)
    const d = u.searchParams.get('X-Amz-Date')
    const duree = Number(u.searchParams.get('X-Amz-Expires'))
    if (!d || !duree) return false
    const emis = Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +d.slice(9, 11), +d.slice(11, 13), +d.slice(13, 15))
    return Date.now() > emis + duree * 1000 - 60_000
  } catch {
    return false
  }
}

async function demanderLienEcoute(beatId: string): Promise<string | null> {
  try {
    const res = await fetch('/api/boutique/ecoute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beatId }),
    })
    if (!res.ok) return null
    const data = await res.json() as { url?: string }
    return data.url ?? null
  } catch {
    return null
  }
}

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
  const [mobileControlsBeatId, setMobileControlsBeatId] = useState<string | null>(null)
  const [licenceModalOpen, setLicenceModalOpen] = useState(false)
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
  const liensRef        = useRef<Map<string, string>>(new Map())
  const reprisesRef     = useRef<Map<string, number>>(new Map())
  const positionRef     = useRef<{ beatId: string | null; t: number }>({ beatId: null, t: 0 })
  const lectureRef      = useRef(0)
  const repriseEnCoursRef = useRef(false)
  const attentePositionRef = useRef<(() => void) | null>(null)

  // Lien utilisable tout de suite (encore valide), sinon null.
  const lienImmediat = useCallback((beat: BeatMin): string | null => {
    const lien = liensRef.current.get(beat.id) ?? beat.mp3_tague_url
    return lien && !lienExpireBientot(lien) ? lien : null
  }, [])
  const lienRenouvele = useCallback(async (beatId: string): Promise<string | null> => {
    const lien = await demanderLienEcoute(beatId)
    if (lien) liensRef.current.set(beatId, lien)
    return lien
  }, [])

  const annulerReprise = useCallback(() => {
    lectureRef.current++
    repriseEnCoursRef.current = false
    const audio = audioRef.current
    if (audio && attentePositionRef.current) audio.removeEventListener('loadedmetadata', attentePositionRef.current)
    attentePositionRef.current = null
  }, [])

  const reprendreLecture = useCallback(async (forcer = false) => {
    const audio = audioRef.current
    const beat = currentBeatRef.current
    if (!audio || !beat?.mp3_tague_url) return
    annulerReprise()
    const demande = lectureRef.current
    const position = audio.currentTime || (positionRef.current.beatId === beat.id ? positionRef.current.t : 0)
    let lien = forcer ? null : lienImmediat(beat)
    if (!lien) {
      repriseEnCoursRef.current = true
      lien = await lienRenouvele(beat.id)
      if (demande !== lectureRef.current || currentBeatRef.current?.id !== beat.id) return
      repriseEnCoursRef.current = false
    }
    if (!lien) { setIsPlaying(false); return }
    if (audio.src !== lien || audio.error) {
      const restaurerPosition = () => {
        attentePositionRef.current = null
        if (demande === lectureRef.current && position > 0) audio.currentTime = position
      }
      attentePositionRef.current = restaurerPosition
      audio.addEventListener('loadedmetadata', restaurerPosition, { once: true })
      audio.src = lien
      audio.load()
    }
    // Ne pas attendre loadedmetadata pour play : garder le geste de lecture
    // de l'utilisateur lorsque le lien est déjà disponible (Safari compris).
    audio.play().catch(() => { if (demande === lectureRef.current) setIsPlaying(false) })
  }, [annulerReprise, lienImmediat, lienRenouvele])

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
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') finalizeDuration(true)
      else {
        const beat = currentBeatRef.current
        // Préparer le lien au retour sur une page laissée ouverte, sans
        // relancer un morceau que l'utilisateur a mis en pause.
        if (beat?.mp3_tague_url && !lienImmediat(beat)) void lienRenouvele(beat.id)
      }
    }

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
    // Lien expiré pendant l'écoute (ou au déplacement dans la piste) : nouveau
    // lien, reprise à la même position. Une seule tentative toutes les 10 s.
    // Dernière position atteinte (un lien qui échoue peut remettre le temps à 0).
    audio.addEventListener('timeupdate', () => {
      const id = currentBeatRef.current?.id ?? null
      if (audio.currentTime > 0 && id) positionRef.current = { beatId: id, t: audio.currentTime }
    })

    audio.addEventListener('error', () => {
      const beat = currentBeatRef.current
      if (!beat?.mp3_tague_url || repriseEnCoursRef.current) return
      const derniere = reprisesRef.current.get(beat.id) ?? 0
      if (Date.now() - derniere < 10_000) return
      reprisesRef.current.set(beat.id, Date.now())
      void reprendreLecture(true)
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
      annulerReprise()
      audio.pause()
      audio.src = ''
    }
  }, [annulerReprise, lienImmediat, lienRenouvele, reprendreLecture])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentBeat?.mp3_tague_url) return
    setProgress(0)
    positionRef.current = { beatId: currentBeat.id, t: 0 }
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    void reprendreLecture()
    return () => { annulerReprise() }
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
      if (repriseEnCoursRef.current) { annulerReprise(); audio.pause() }
      else if (audio.paused) void reprendreLecture()
      else { annulerReprise(); audio.pause() }
    } else {
      setCurrentBeat(beat)
      currentBeatRef.current = beat
    }
  }, [annulerReprise, reprendreLecture])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentBeatRef.current) return
    if (repriseEnCoursRef.current) { annulerReprise(); audio.pause() }
    else if (audio.paused) void reprendreLecture()
    else { annulerReprise(); audio.pause() }
  }, [annulerReprise, reprendreLecture])

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

  const openLicenceModal = useCallback(() => setLicenceModalOpen(true), [])
  const closeLicenceModal = useCallback(() => setLicenceModalOpen(false), [])

  return (
    <PlayerContext.Provider value={{
      currentBeat, isPlaying, queue, progress, duration, isShuffled, loopOne,
      mobileControlsBeatId, setMobileControlsBeatId,
      licenceModalOpen, openLicenceModal, closeLicenceModal,
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
