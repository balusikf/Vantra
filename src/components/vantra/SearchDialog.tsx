'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Bookmark, Search, X } from 'lucide-react'
import { animeTile, tmdbTile, type MediaTile } from '@/lib/media-presentation'
import { fetchMedia, MediaRequestError } from '@/lib/client-media-cache'
import { catalogUrl } from '@/lib/catalog-request'
import { lockBodyScroll } from '@/lib/body-scroll-lock'
import type { TMDBMedia } from '@/lib/tmdb'
import type { AniListMedia } from '@/lib/anilist'
import type { ActiveSection } from './Navigation'
import s from './vantra.module.css'

type Scope = 'all' | 'movie' | 'tv' | 'anime'
const scopes = [{ value: 'all', label: 'Movies & series' }, { value: 'movie', label: 'Movies' }, { value: 'tv', label: 'Series' }, { value: 'anime', label: 'Anime' }] as const

function SearchPanel({ active, onClose, returnFocus }: { active: ActiveSection; onClose: () => void; returnFocus: () => void }) {
  const [scope, setScope] = useState<Scope>(active === 'home' || !active ? 'all' : active)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<MediaTile[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [failureMessage, setFailureMessage] = useState('')
  const [retry, setRetry] = useState(0)
  const [pending, startTransition] = useTransition()
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const navigating = useRef(false)
  const reduce = useReducedMotion()
  const router = useRouter()
  const trimmed = query.trim().replace(/\s+/g, ' ')

  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    input.current?.focus({ preventScroll: true })
    const unlock = lockBodyScroll()
    return () => { element.close(); unlock(); if (!navigating.current) returnFocus() }
  }, [returnFocus])

  useEffect(() => {
    if (trimmed.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const data = await fetchMedia<{ results: (AniListMedia | TMDBMedia)[] }>(catalogUrl(scope, trimmed, 'trending', 1), controller.signal)
        if (!controller.signal.aborted) setItems(scope === 'anime' ? (data.results as AniListMedia[]).slice(0, 6).map(animeTile) : (data.results as TMDBMedia[]).filter(item => item.media_type !== 'person').slice(0, 6).map(item => tmdbTile(item, scope === 'tv' ? 'tv' : 'movie')))
      } catch (error) { if (!controller.signal.aborted) { setFailed(true); setFailureMessage(error instanceof MediaRequestError ? error.message : '') } }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [trimmed, scope, retry])

  function change(value: string, nextScope = scope) {
    setQuery(value)
    if (value.trim().replace(/\s+/g, ' ') === trimmed && nextScope === scope) return
    setScope(nextScope); if (nextScope !== scope || value.trim().length < 2) setItems([])
    setFailed(false); setLoading(value.trim().length >= 2)
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!trimmed || pending) return
    const params = new URLSearchParams({ search: trimmed })
    if (scope === 'movie' || scope === 'tv') params.set('type', scope)
    navigating.current = true
    startTransition(() => { router.push(`${scope === 'anime' ? '/anime' : '/browse'}?${params}`); onClose() })
  }
  function navigate() { navigating.current = true; onClose() }

  return <motion.dialog ref={dialog} className={s.searchDialog} aria-labelledby="search-heading" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }} initial={{ opacity: 0, y: reduce ? 0 : -12, scale: reduce ? 1 : .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduce ? 0 : -8, scale: reduce ? 1 : .99 }} transition={{ duration: reduce ? 0 : .18, ease: [.2, .8, .2, 1] }}>
    <div className={s.searchDialogInner}>
      <div className={s.searchHeading}><span id="search-heading">Find your next story<span>.</span></span><button onClick={onClose} aria-label="Close search"><X size={20} /></button></div>
      <form onSubmit={submit} className={s.globalSearchField}><Search size={22} /><input ref={input} autoFocus enterKeyHint="search" autoCapitalize="none" spellCheck={false} aria-label="Search titles" value={query} onChange={event => change(event.target.value)} placeholder="A title you love. A world to discover." autoComplete="off" maxLength={120} />{query && <button type="button" onClick={() => change('')} aria-label="Clear search"><X size={17} /></button>}<button type="submit" aria-label="Search all results" disabled={!trimmed || pending}><ArrowRight size={21} /></button></form>
      <div className={s.searchScopes} aria-label="Search in">{scopes.map(item => <button key={item.value} aria-pressed={scope === item.value} onClick={() => change(query, item.value)}>{item.label}</button>)}</div>
      <div className={s.searchResults} aria-live="polite" aria-busy={loading}>
        {loading && items.length > 0 && <p className={s.searchUpdating} role="status">Updating results…</p>}
        {trimmed.length < 2 ? <div className={s.searchInvitation}><span className={s.searchOrb}><Search size={26} strokeWidth={1.3} /></span><h2>A good story is one search away.</h2><p>Search movies and series, or switch to the anime collection.</p><Link href="/library" onNavigate={navigate}><Bookmark size={14} /> Or revisit your library <ArrowUpRight size={14} /></Link></div> : loading && items.length === 0 ? <div className={s.suggestionGrid} aria-label="Searching">{Array.from({ length: 6 }, (_, index) => <div key={index} className={s.suggestionSkeleton}><i /><span /></div>)}</div> : failed ? <div className={s.searchInvitation}><h2>A brief intermission.</h2><p>{failureMessage || (scope === 'anime' ? 'The anime provider is temporarily unavailable.' : 'Search is temporarily unavailable. Try again in a moment.')}</p><button className={s.secondary} onClick={() => { setFailed(false); setLoading(true); setRetry(value => value + 1) }}>Try again</button></div> : items.length ? <div className={s.suggestionGrid} data-updating={loading}>{items.map(item => <Link key={item.id} href={item.href} className={s.suggestion} onNavigate={navigate}>{item.poster ? <Image src={item.poster} alt="" width={42} height={63} /> : <span className={s.suggestionNoImage}><Search size={18} /></span>}<span><strong>{item.title}</strong><small>{item.kind}{item.year ? ` · ${item.year}` : ''}</small></span><ArrowUpRight size={15} /></Link>)}</div> : <div className={s.searchInvitation}><h2>No stories found.</h2><p>Try another title, or search in a different collection.</p></div>}
      </div>
      <div className={s.searchBottom}><span><kbd>esc</kbd> to close</span>{trimmed && <button onClick={submit} disabled={pending}>See all results <ArrowRight size={15} /></button>}</div>
    </div>
  </motion.dialog>
}

export default function SearchDialog({ active, open, onOpen, onClose, returnFocus }: { active: ActiveSection; open: boolean; onOpen: () => void; onClose: () => void; returnFocus: () => void }) {
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const typing = target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName)
      if ((event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !typing)) { event.preventDefault(); onOpen() }
    }
    window.addEventListener('keydown', keyboard)
    window.addEventListener('popstate', onClose)
    return () => { window.removeEventListener('keydown', keyboard); window.removeEventListener('popstate', onClose) }
  }, [onOpen, onClose])
  return <AnimatePresence>{open && <SearchPanel active={active} onClose={onClose} returnFocus={returnFocus} />}</AnimatePresence>
}
