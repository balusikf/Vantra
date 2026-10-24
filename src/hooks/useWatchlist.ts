import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { removeSavedTitle } from '@/lib/library-delete'
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
  const [reviewRemoval, setReviewRemoval] = useState(false)
  const [revision,setRevision]=useState(0)
  useEffect(()=>{
    const changed=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.id===tmdbId&&detail?.kind===mediaType)setRevision(value=>value+1)}
    window.addEventListener('vantra-library-change',changed)
    return ()=>window.removeEventListener('vantra-library-change',changed)
  },[tmdbId,mediaType])

  useEffect(() => {
    const controller = new AbortController()
    if (accountLoading) return () => controller.abort()
    const checkWatchlist = async () => {
      setLoading(true)
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
        if (!controller.signal.aborted) setError('Could not load your watchlist. Please reload and try again.')
      } finally {
        if (!controller.signal.aborted) { setLoading(false); setLoadedFor(selection) }
      }
    }
    void checkWatchlist()
    return () => controller.abort()
  }, [tmdbId, mediaType, revision, userId, accountLoading, selection])

  const toggleWatchlist = async (title: string, posterPath: string, reviewConfirmed = false) => {
    if (busy.current || loading || accountLoading || loadedFor !== selection) return
    busy.current = true
    setPending(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) throw new Error('Sign in required')
      if (isInWatchlist) {
        const result = await removeSavedTitle(supabase, user.id, { tmdb_id: tmdbId, media_type: mediaType }, reviewConfirmed)
        if (result.needsConfirmation) { setReviewRemoval(true); return }
        setReviewRemoval(false)
        setIsInWatchlist(false)
      } else {
        const { error: insertError } = await supabase.from('watchlist').insert({
          user_id: user.id, tmdb_id: tmdbId, media_type: mediaType, title, poster_path: posterPath,
        })
        // A duplicate means this title was already added in another tab.
        if (insertError && insertError.code !== '23505') throw insertError
        setIsInWatchlist(true)
      }
      window.dispatchEvent(new CustomEvent('vantra-tracking-reload',{detail:{id:tmdbId,kind:mediaType}}))
    } catch {
      setError('Could not update your watchlist. Please try again.')
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return { isInWatchlist: loadedFor === selection && isInWatchlist, loading: loading || accountLoading || loadedFor !== selection, pending, error, toggleWatchlist, reviewRemoval, cancelReviewRemoval: () => setReviewRemoval(false) }
}
