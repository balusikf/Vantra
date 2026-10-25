'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, Bookmark, Compass, Film, Shuffle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { loadNookTitles, nookPoster, nookTitleKey, pickNookTitle, type NookKind, type NookTitle } from '@/lib/nook-selection'
import type { NookCue } from '@/lib/nook-personality'
import { cachedMedia, fetchMedia } from '@/lib/client-media-cache'
import n from './nook.module.css'
import NookDiscover from './NookDiscover'

const kinds = [{ id: 'all', label: 'Anything' }, { id: 'movie', label: 'Movie' }, { id: 'tv', label: 'Series' }, { id: 'anime', label: 'Anime' }] as const

function PlannedPicker({ userId, inline = false, active = true, onNavigate, respond, reactToGenres, onBusyChange }: {
  userId: string | null; inline?: boolean; active?: boolean; onNavigate?: () => void
  respond: (cue: NookCue, expectedSelection?: string) => void; reactToGenres: (genres: unknown, selection: string, enrich?: boolean) => void; onBusyChange: (busy: boolean) => void
}) {
  const heading = useId()
  const controller = useRef<AbortController | null>(null)
  const pool = useRef<NookTitle[] | null>(null)
  const loadedAt = useRef(0)
  const seen = useRef<string[]>([])
  const working = useRef(false)
  const [kind, setKind] = useState<NookKind>('all')
  const [result, setResult] = useState<NookTitle | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [failed, setFailed] = useState(false)
  const [brokenPoster, setBrokenPoster] = useState<string | null>(null)
  const reduce = useReducedMotion()

  useEffect(() => () => { controller.current?.abort(); pool.current = null }, [])
  useEffect(() => {
    if (active) return
    controller.current?.abort()
    if (!working.current) return
    working.current = false
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setBusy(false); onBusyChange(false)
      respond({ state: 'idle' })
    })
    return () => { cancelled = true }
  }, [active, onBusyChange, respond])

  async function pick() {
    if (working.current || !userId || !active) return
    controller.current?.abort()
    working.current = true
    const request = new AbortController()
    controller.current = request
    setBusy(true); onBusyChange(true); setFailed(false); setResult(null); setNotice('')
    respond({ state: 'thinking', speech: 'Let me find a story in your Planned list.' })
    try {
      // The homepage can stay open for hours. Refresh only on a requested pick,
      // so statuses changed elsewhere do not stay stale for the whole visit.
      if (!pool.current || performance.now() - loadedAt.current > 60000) {
        pool.current = await loadNookTitles(createClient(), userId, AbortSignal.any([request.signal, AbortSignal.timeout(12000)]))
        loadedAt.current = performance.now()
      }
      if (request.signal.aborted) return
      const next = pickNookTitle(pool.current, kind, seen.current)
      if (next) {
        const matches = pool.current.filter(item => kind === 'all' || item.media_type === kind)
        if (matches.every(item => seen.current.includes(nookTitleKey(item)))) seen.current = seen.current.slice(-1)
        seen.current.push(nookTitleKey(next)); setResult(next)
        const url = next.media_type === 'anime' ? `/api/anilist?type=detail&id=${next.tmdb_id}` : `/api/tmdb?type=${next.media_type === 'movie' ? 'movie-detail' : 'tv-detail'}&id=${next.tmdb_id}`
        const saved = cachedMedia<{ genres?: unknown }>(url)
        const token = crypto.randomUUID()
        if (saved?.genres) reactToGenres(saved.genres, token)
        else respond({ state: 'idle', emotion: 'happy', selection: token, speech: matches.length === 1 ? 'One story waiting. This could be your night.' : 'Found one. Shall we give this story a chance?' })
        // Optional mood enrichment never delays the result. The normal public
        // detail cache is shared with detail/playback; a pat or trick takes priority.
        if (!saved) void fetchMedia<{ genres?: unknown } | null>(url, AbortSignal.any([request.signal, AbortSignal.timeout(4500)]))
          .then(data => { if (data?.genres && !request.signal.aborted) reactToGenres(data.genres, token, true) })
          .catch(() => {})
      } else {
        setNotice(kind === 'all' ? 'Your Planned list is empty. Save a few titles and I’ll help you choose.' : `No ${kind === 'tv' ? 'series' : kind === 'anime' ? 'anime' : 'movies'} in Planned yet. Try another type or add something to your library.`)
        respond({ state: 'egg', speech: 'A good night starts with a few possibilities.' })
      }
    } catch {
      if (!request.signal.aborted) {
        setFailed(true); setNotice('I couldn’t reach your library. Please try again in a moment.')
        respond({ state: 'idle', speech: 'A small intermission. We can try again.' })
      }
    } finally {
      if (controller.current === request) working.current = false
      if (!request.signal.aborted) { setBusy(false); onBusyChange(false) }
    }
  }

  const poster = result && nookPoster(result)
  return <section className={`${n.picker} ${inline ? n.inlinePicker : ''}`} aria-labelledby={inline ? undefined : heading} aria-label={inline ? 'Pick something for tonight' : undefined}>
    {!inline && <div className={n.pickerHeading}><Shuffle size={17} /><div><h3 id={heading}>Tonight, sorted.</h3><p>A surprise from your Planned list.</p></div></div>}
    <div className={n.kinds} aria-label="Choose a title type">{kinds.map(item => <button type="button" key={item.id} aria-pressed={kind === item.id} disabled={busy || !active} onClick={() => { controller.current?.abort(); setKind(item.id); setResult(null); setNotice(''); setFailed(false) }}>{item.label}</button>)}</div>
    {userId ? <button type="button" className={n.primary} disabled={busy || !active} onClick={() => void pick()}><Shuffle size={15} />{busy ? 'Finding your next story…' : failed ? 'Try again' : result ? 'Pick another story' : 'Pick something for tonight'}</button> : <Link href="/login" className={n.primary} onNavigate={onNavigate}>Sign in to pick from your library <ArrowUpRight size={16} /></Link>}
    <div role="status" aria-live="polite" aria-atomic="true" aria-busy={busy}>
      {result && <motion.div key={nookTitleKey(result)} className={n.result} initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .25 }}>
        <Link href={`/${result.media_type}/${result.tmdb_id}`} className={n.resultPoster} onNavigate={onNavigate} aria-label={`More about ${result.title}`}>
          {poster && brokenPoster !== poster ? <Image src={poster} alt="" width={76} height={114} onError={() => setBrokenPoster(poster)} /> : <Film size={25} />}
        </Link>
        <div><p className={n.resultType}>{result.media_type === 'movie' ? 'MOVIE' : result.media_type === 'tv' ? 'SERIES' : 'ANIME'} · YOUR PLANNED LIST</p><h4>{result.title}</h4><Link href={`/${result.media_type}/${result.tmdb_id}`} onNavigate={onNavigate}>Explore this story <ArrowUpRight size={14} /></Link></div>
      </motion.div>}
      {notice && <div className={n.notice}><p>{notice}</p>{!failed && <Link href="/library" onNavigate={onNavigate}><Bookmark size={13} /> Open my library <ArrowUpRight size={13} /></Link>}</div>}
    </div>
  </section>
}

export type NookPickerProps=Parameters<typeof PlannedPicker>[0]
export default function NookPicker(props:NookPickerProps) {
  const [mode,setMode]=useState<'planned'|'discover'>('planned')
  const id=useId(),reduce=useReducedMotion()
  return <div className={n.taskPicker}>
    <div className={n.tasks} role="group" aria-label="Nook tasks">{([{id:'planned',label:'From my list',icon:Bookmark},{id:'discover',label:'Discover',icon:Compass}] as const).map(task=><button type="button" key={task.id} aria-pressed={mode===task.id} onClick={()=>{if(mode===task.id)return;props.onBusyChange(false);props.respond({state:'idle',speech:task.id==='planned'?'Your Planned list. Let’s find a good night in.':'Choose a category and a genre. Let’s explore the catalogue.'});setMode(task.id)}}><task.icon size={13}/><span>{task.label}</span>{mode===task.id&&<motion.i layoutId={`${id}-task`} transition={{duration:reduce?0:.22}}/>}</button>)}</div>
    <p className={n.taskScope}>{mode==='planned'?'Only titles you saved as Plan to watch.':'New suggestions from the wider catalogue.'}</p>
    <motion.div key={mode} initial={{opacity:0,y:reduce?0:5}} animate={{opacity:1,y:0}} transition={{duration:reduce?0:.18}}>{mode==='planned'?<PlannedPicker {...props}/>:<NookDiscover {...props}/>}</motion.div>
  </div>
}
