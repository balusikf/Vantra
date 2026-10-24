'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { advanceNookConversation, nookGenreFromGenres, nookGenreVariants, nookInteractionVariants, NookVariantDeck, type NookConversation, type NookCue, type NookReaction } from '@/lib/nook-personality'
import NookIcon from './NookIcon'
import NookWardrobe from './NookWardrobe'
import n from './nook.module.css'

const NookAvatar = dynamic(() => import('./NookAvatar'), { ssr: false, loading: () => <NookIcon size={170} /> })
type Interaction = 'pet' | 'five' | 'trick'

export function useNookReactions(initial = 'Hey. What are we watching tonight?') {
  const [conversation, setConversation] = useState<NookConversation>({ reaction: { state: 'idle', serial: 0 }, speech: initial })
  const [deck] = useState(() => new NookVariantDeck())
  const respond = useCallback((cue: NookCue, expectedSelection?: string) => {
    setConversation(previous => advanceNookConversation(previous, cue, expectedSelection))
  }, [])
  const reactToGenres = useCallback((genres: unknown, selection: string, enrich = false) => {
    const genre = nookGenreFromGenres(genres)
    const cue = deck.choose(`genre:${genre}`, nookGenreVariants[genre])
    respond({ ...cue, selection }, enrich ? selection : undefined)
  }, [deck, respond])
  function interact(action: Interaction) {
    respond(deck.choose(action, nookInteractionVariants[action]))
  }
  return { ...conversation, respond, reactToGenres, interact }
}

export default function NookCompanion({ reaction, speech, interact, paused = false, busy = false }: {
  reaction: NookReaction; speech: string; interact: (action: Interaction) => void; paused?: boolean; busy?: boolean
}) {
  const stage = useRef<HTMLDivElement>(null)
  const hint = useId()
  const tap = useRef({ time: 0, x: 0, y: 0 })
  const [visited, setVisited] = useState(false)
  const movement = useRef({ x: 0, y: 0, distance: 0, lastPet: 0, entered: false })
  const reduce = useReducedMotion()
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisited(true); observer.disconnect() }
    }, { rootMargin: '160px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return <div className={n.companion}>
    <div className={n.bubble} role="status" aria-live="polite" aria-atomic="true"><AnimatePresence mode="wait" initial={false}><motion.p key={speech} initial={{ opacity: 0, y: reduce ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -4 }} transition={{ duration: reduce ? 0 : .13 }}>{speech}</motion.p></AnimatePresence></div>
    <div ref={stage} className={n.stage}>
      <span className={n.ground} aria-hidden="true" />
      <button type="button" className={n.pet} aria-label="Interact with Nook" aria-describedby={hint} disabled={paused}
        onPointerDown={event => {
          if (event.button !== 0 || paused) return
          const now = performance.now(), last = tap.current
          const twice = last.time > 0 && now - last.time < 340 && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 30
          tap.current = { time: twice ? 0 : now, x: event.clientX, y: event.clientY }
          movement.current.lastPet = now
          interact(twice ? 'five' : 'pet')
        }} onClick={event => { if (event.detail === 0) interact('pet') }}
        onPointerEnter={event => { movement.current = { ...movement.current, x: event.clientX, y: event.clientY, distance: 0, entered: true } }}
        onPointerLeave={() => { movement.current.entered = false }}
        onPointerMove={event => {
          if (event.pointerType !== 'mouse' || paused || !movement.current.entered) return
          const m = movement.current, now = performance.now()
          m.distance += Math.hypot(event.clientX - m.x, event.clientY - m.y); m.x = event.clientX; m.y = event.clientY
          if (m.distance > 110 && now - m.lastPet > 1800) { m.lastPet = now; m.distance = 0; interact('pet') }
        }}>
        {visited ? <NookAvatar reaction={reaction} paused={paused} idleEnabled={!busy} /> : <NookIcon size={170} />}
      </button>
    </div>
    <div className={n.interactions} aria-label="Play with Nook">
      <button type="button" onClick={() => interact('trick')} disabled={paused}><Sparkles size={14} /> Do a trick</button>
    </div>
    <p id={hint} className={n.interactionHint}>Tap to pet · Double tap for a little joy</p>
    <NookWardrobe />
  </div>
}
