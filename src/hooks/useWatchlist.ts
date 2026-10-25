import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { removeSavedTitle } from '@/lib/library-delete'
import { requireCurrentAccount } from '@/lib/library-mutations'
import { useAccount } from '@/components/vantra/AccountProvider'

export function useWatchlist(tmdbId: number, mediaType: string) {
  const { user, loading: accountLoading } = useAccount()
  const userId = user?.id
  const selection = `${userId || 'guest'}:${mediaType}:${tmdbId}`
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [isInWatchlist, setIsInWatchlist] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const generation = useRef(0)
  const [readFailed, setReadFailed] = useState(false)
  const [reviewRemoval, setReviewRemoval] = useState(false)
  const [revision,setRevision]=useState(0)
  useEffect(()=>{
    const changed=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.id===tmdbId&&detail?.kind===mediaType)setRevision(value=>value+1)}
    window.addEventListener('vantra-library-change',changed)
    return ()=>window.removeEventListener('vantra-library-change',changed)
  },[tmdbId,mediaType])

  useEffect(() => {
    const token = ++generation.current
    const controller = new AbortController()
    if (accountLoading) return () => controller.abort()
    const checkWatchlist = async () => {
      setLoading(true)
      setReviewRemoval(false); setReadFailed(false); setPending(false)
      setIsInWatchlist(false)
      setError(null)
      try {
        const supabase = createClient()
        if (!userId) return
        const { data, error: queryError } = await supabase.from('watchlist')
          .select('id').eq('tmdb_id', tmdbId).eq('media_type', mediaType).eq('user_id', userId).abortSignal(controller.signal)
        if (queryError) throw queryError
        if (!controller.signal.aborted) setIsInWatchlist(Boolean(data?.length))
      } catch {
        if (!controller.signal.aborted) { setReadFailed(true); setError('Could not load your watchlist. Please try again.') }
      } finally {
        if (!controller.signal.aborted) { setLoading(false); setLoadedFor(selection) }
      }
    }
    void checkWatchlist()
    return () => { controller.abort(); generation.current = token + 1 }
  }, [tmdbId, mediaType, revision, userId, accountLoading, selection])

  const toggleWatchlist = async (title: string, posterPath: string, reviewConfirmed = false) => {
    if (busy.current || loading || readFailed || accountLoading || loadedFor !== selection || !userId) return
    const token = generation.current
    const current = () => token === generation.current
    const assertCurrent = () => { if (!current()) throw new DOMException('Selection changed', 'AbortError') }
    busy.current = true
    setPending(true)
    setError(null)
    try {
      const supabase = createClient()
      await requireCurrentAccount(supabase, userId, assertCurrent)
      if (isInWatchlist) {
        const result = await removeSavedTitle(supabase, userId, { tmdb_id: tmdbId, media_type: mediaType }, reviewConfirmed)
        assertCurrent()
        if (result.needsConfirmation) { setReviewRemoval(true); return }
        setReviewRemoval(false)
        setIsInWatchlist(false)
      } else {
        const { error: insertError } = await supabase.from('watchlist').insert({
          user_id: userId, tmdb_id: tmdbId, media_type: mediaType, title, poster_path: posterPath,
        })
        assertCurrent()
        // A duplicate means this title was already added in another tab.
        if (insertError && insertError.code !== '23505') throw insertError
        setIsInWatchlist(true)
      }
      window.dispatchEvent(new CustomEvent('vantra-tracking-reload',{detail:{id:tmdbId,kind:mediaType}}))
    } catch {
      if (current()) setError('Could not update your watchlist. Please reload and try again.')
    } finally {
      busy.current = false
      if (current()) setPending(false)
    }
  }

  return { isInWatchlist: loadedFor === selection && isInWatchlist, loading: loading || accountLoading || loadedFor !== selection, pending, error, readFailed, retry: () => setRevision(value => value + 1), toggleWatchlist, reviewRemoval, cancelReviewRemoval: () => setReviewRemoval(false) }
}
