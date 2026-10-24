'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, Eye, EyeOff, LoaderCircle, MessageCircle, Star } from 'lucide-react'
import { fetchMedia } from '@/lib/client-media-cache'
import { pickMediaReview, reviewReaction, type MediaReview } from '@/lib/media-reviews'
import { nookGenreFromGenres, nookGenreVariants, type NookReaction } from '@/lib/nook-personality'
import { useNook } from './NookProvider'
import NookIcon from './NookIcon'
import s from './nook-reviews.module.css'

const NookAvatar = dynamic(() => import('./NookAvatar'), { ssr: false, loading: () => <NookIcon size={90} /> })
type Entry = { status: 'idle' | 'loading' | 'ready' | 'error'; reviews: MediaReview[]; current: MediaReview | null }

function AuthorRating({ review }: { review: MediaReview }) {
  if (review.stars === null) return <span className={s.unrated}>No author rating</span>
  return <span className={s.rating} aria-label={`Author rated ${Number(review.stars.toFixed(2))} out of 5 stars. Original score: ${review.score} out of ${review.scale}.`}>
    <span className={s.stars} aria-hidden="true">{[0, 1, 2, 3, 4].map(index => <span className={s.star} key={index}><Star size={13} /><span style={{ width: `${Math.max(0, Math.min(1, review.stars! - index)) * 100}%` }}><Star size={13} fill="currentColor" /></span></span>)}</span>
    <span aria-hidden="true">{review.score}/{review.scale}</span>
  </span>
}

export default function NookReviews({ kind, id, genres }: { kind: 'movie' | 'tv' | 'anime'; id: number; genres: string[] }) {
  const root = useRef<HTMLElement>(null)
  const contentId = useId()
  const seen = useRef<string[]>([])
  const [nearby, setNearby] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [pat, setPat] = useState(false)
  const [serial, setSerial] = useState(0)
  const [entry, setEntry] = useState<Entry>({ status: 'idle', reviews: [], current: null })
  const reduce = useReducedMotion()
  const nook = useNook()
  const genreCue = nookGenreVariants[nookGenreFromGenres(genres)][0]
  const url = kind === 'anime' ? `/api/anilist?type=reviews&id=${id}` : `/api/tmdb?type=${kind}-reviews&id=${id}`
  const review = revealed ? entry.current : null
  const cue = useMemo(() => review ? reviewReaction(review.stars) : genreCue, [review, genreCue])
  const reaction = useMemo<NookReaction>(() => ({ ...cue, state: 'idle', serial, gesture: pat ? 'pat' : cue.gesture }), [cue, serial, pat])

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(item => item.isIntersecting)) { setNearby(true); observer.disconnect() }
    }, { rootMargin: '120px' })
    if (root.current) observer.observe(root.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!revealed) return
    const controller = new AbortController()
    async function load() {
      setEntry({ status: 'loading', reviews: [], current: null })
      try {
        const reviews = await fetchMedia<MediaReview[]>(url, AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]))
        if (controller.signal.aborted) return
        const current = pickMediaReview(reviews, seen.current)
        if (current) seen.current = [current.id]
        setPat(false); setSerial(value => value + 1)
        setEntry({ status: 'ready', reviews, current })
      } catch {
        if (!controller.signal.aborted) setEntry({ status: 'error', reviews: [], current: null })
      }
    }
    void load()
    return () => controller.abort()
  }, [revealed, retry, url])

  function nextReview() {
    const next = pickMediaReview(entry.reviews, seen.current)
    if (!next) return
    if (seen.current.length >= entry.reviews.length) seen.current = []
    seen.current.push(next.id)
    setPat(false); setSerial(value => value + 1)
    setEntry(previous => ({ ...previous, current: next }))
  }

  return <aside ref={root} className={s.corner} aria-label="Nook’s community review corner" data-nook-reviews="">
    <div className={s.stage}>
      <span className={s.ground} aria-hidden="true" />
      <button className={s.pet} type="button" aria-label="Pat Nook" onClick={() => { setPat(true); setSerial(value => value + 1) }}>
        {nearby ? <NookAvatar reaction={reaction} paused={nook.open} idleEnabled={false} holdEmotion /> : <NookIcon size={90} />}
      </button>
      <span className={s.name}>NOOK</span>
    </div>
    <div className={s.bubble}>
      {!review && <p className={s.eyebrow}><MessageCircle size={11} /> A LITTLE PERSPECTIVE</p>}
      <div id={contentId} aria-live="polite" aria-atomic="true" aria-busy={revealed && entry.status === 'loading'}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={review ? `${review.source}:${review.id}` : revealed ? entry.status : 'genre'} initial={{ opacity: 0, y: reduce ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -4 }} transition={{ duration: reduce ? 0 : .16 }}>
            {review ? <>
              <p className={s.verdict}>{cue.speech}</p>
              <blockquote className={s.excerpt}>{review.excerpt}</blockquote>
              <div className={s.attribution}><span className={s.author}>{review.author}</span><AuthorRating review={review} /></div>
            </> : <>
              <p className={s.intro}>{revealed && entry.status === 'ready' ? 'No community reviews here yet. I’ll keep you company instead.' : cue.speech}</p>
              {revealed && entry.status === 'loading' && <p className={s.notice}><LoaderCircle className={s.spinner} size={12} /> Finding a few perspectives…</p>}
              {revealed && entry.status === 'error' && <p className={s.notice}>Reviews are taking a break. Your story is still ready.</p>}
            </>}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className={s.actions}>
        {!revealed ? <button type="button" aria-expanded={false} aria-controls={contentId} onClick={() => { setPat(false); setSerial(value => value + 1); setRevealed(true) }}><Eye size={13} /> What do viewers think? <ArrowRight size={12} /></button> : <>
          {review && <a className={s.source} href={review.url} target="_blank" rel="noopener noreferrer" aria-label={`Read full review on ${review.source}`}>{review.source} {review.source === 'AniList' ? 'summary' : 'excerpt'} <ArrowUpRight size={11} /></a>}
          {review && entry.reviews.length > 1 && <button type="button" onClick={nextReview}>Next review <ArrowRight size={13} /></button>}
          {revealed && entry.status === 'error' && <button type="button" onClick={() => setRetry(value => value + 1)}>Try again <ArrowRight size={13} /></button>}
          <button className={s.hide} type="button" aria-label="Hide reviews" aria-expanded={true} aria-controls={contentId} onClick={() => { setPat(false); setSerial(value => value + 1); setRevealed(false) }}><EyeOff size={12} /> Hide</button>
        </>}
      </div>
      {!revealed && <p className={s.spoilers}>Community reviews may contain spoilers.</p>}
    </div>
  </aside>
}
