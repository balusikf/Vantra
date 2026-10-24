'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAccount } from '@/components/vantra/AccountProvider'
import { pendingSeasonEpisodes } from '@/lib/season-tracking'
import { parseEpisodeTrackingState } from '@/lib/episode-tracking-state'

export function useEpisodeTracking({ id, kind, season, maxEpisode, title, poster }: { id: number; kind: 'tv' | 'anime'; season: number; maxEpisode: number; title: string; poster: string }) {
  const { user } = useAccount()
  const userId = user?.id
  const [seen, setSeen] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [seasonCounts, setSeasonCounts] = useState<Record<number,number>>({})
  const [undo, setUndo] = useState<{ season: number; episodes: number[] } | null>(null)
  const savedId = useRef<string | null>(null)
  const mutation = useRef(false)
  const generation = useRef(0)
  useEffect(() => {
    const token = ++generation.current, controller = new AbortController()
    savedId.current = null
    async function load() {
      setLoading(true); setBusy(null); setError(null); setSeen(new Set()); setUndo(null); setSeasonCounts({})
      if (!userId) { setSeasonCounts({}); setLoading(false); return }
      try {
        const result = await createClient().rpc('episode_tracking_state', { target_id:id, target_kind:kind, target_season:season, max_episode:maxEpisode }).abortSignal(controller.signal)
        if (result.error) throw result.error
        if (controller.signal.aborted) return
        const state = parseEpisodeTrackingState(result.data,maxEpisode)
        savedId.current = state.watchlistId
        setSeen(state.seen); setSeasonCounts(state.seasonCounts)
      } catch { if (!controller.signal.aborted) setError('Your watched episodes could not be loaded. Please try again.') }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => { controller.abort(); generation.current = token + 1 }
  }, [userId, id, kind, season, maxEpisode, revision])
  useEffect(()=>{
    const changed=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.id===id&&detail?.kind===kind)setRevision(value=>value+1)}
    window.addEventListener('vantra-tracking-reload',changed)
    return ()=>window.removeEventListener('vantra-tracking-reload',changed)
  },[id,kind])
  const toggle = useCallback(async (episode: number) => {
    if (!user || loading || error || mutation.current) return
    mutation.current = true; setBusy(episode); setUndo(null); const token = generation.current
    try {
      const client = createClient()
      let watchlistId = savedId.current
      if (!watchlistId) {
        const inserted = await client.from('watchlist').insert({ user_id: user.id, tmdb_id: id, media_type: kind, title, poster_path: poster, watch_status: 'watching' }).select('id').single()
        if (inserted.error && inserted.error.code !== '23505') throw inserted.error
        if (inserted.data) watchlistId = inserted.data.id
        else {
          const existing = await client.from('watchlist').select('id').eq('user_id', user.id).eq('tmdb_id', id).eq('media_type', kind).single()
          if (existing.error) throw existing.error
          watchlistId = existing.data.id
        }
        savedId.current = watchlistId
        window.dispatchEvent(new CustomEvent('vantra-library-change', { detail: { id, kind } }))
      }
      const marked = seen.has(episode)
      const result = marked ? await client.from('watched_episodes').delete().eq('user_id', user.id).eq('watchlist_id', watchlistId).eq('season', season).eq('episode', episode)
        : await client.from('watched_episodes').upsert({ user_id: user.id, watchlist_id: watchlistId, season, episode }, { onConflict: 'watchlist_id,season,episode', ignoreDuplicates: true })
      if (result.error) throw result.error
      if (token === generation.current) {
        const next = new Set(seen); if (marked) next.delete(episode); else next.add(episode)
        setSeen(next); setSeasonCounts(previous=>({...previous,[season]:Math.max(0,(previous[season]||0)+(marked?-1:1))}))
      }
    } catch { if (token === generation.current) setError('Could not save your watched episode. Please reload and try again.') }
    finally { mutation.current = false; if (token === generation.current) setBusy(null) }
  }, [user, loading, error, id, kind, title, poster, seen, season])
  const markSeason = useCallback(async (released: number[]) => {
    if (!user || loading || error || mutation.current) return
    mutation.current=true; setBusy(-1); const token=generation.current
    try {
      const episodes=pendingSeasonEpisodes(released,seen)
      if(!episodes.length)return
      const client=createClient()
      let watchlistId=savedId.current
      if(!watchlistId) {
        const inserted=await client.from('watchlist').insert({user_id:user.id,tmdb_id:id,media_type:kind,title,poster_path:poster,watch_status:'watching'}).select('id').single()
        if(inserted.error && inserted.error.code!=='23505')throw inserted.error
        if(inserted.data)watchlistId=inserted.data.id
        else { const existing=await client.from('watchlist').select('id').eq('user_id',user.id).eq('tmdb_id',id).eq('media_type',kind).single();if(existing.error)throw existing.error;watchlistId=existing.data.id }
        savedId.current=watchlistId
        window.dispatchEvent(new CustomEvent('vantra-library-change',{detail:{id,kind}}))
      }
      const result=await client.from('watched_episodes').upsert(episodes.map(episode=>({user_id:user.id,watchlist_id:watchlistId,season,episode})),{onConflict:'watchlist_id,season,episode',ignoreDuplicates:true}).select('episode')
      if(result.error)throw result.error
      if(token===generation.current) {
        const next=new Set([...seen,...episodes]);setSeen(next)
        setUndo({season,episodes:(result.data || []).map(row=>row.episode)})
        setSeasonCounts(previous=>({...previous,[season]:(previous[season]||0)+(result.data?.length||0)}))
      }
    } catch { if(token===generation.current)setError('Could not mark this season. Reload your watched marks before trying again.') }
    finally {mutation.current=false;if(token===generation.current)setBusy(null)}
  },[user,loading,error,seen,id,kind,title,poster,season])
  const undoSeason = useCallback(async () => {
    if(!user || !undo || undo.season!==season || mutation.current || !savedId.current)return
    mutation.current=true;setBusy(-1);const token=generation.current
    try {
      const result=await createClient().from('watched_episodes').delete().eq('user_id',user.id).eq('watchlist_id',savedId.current).eq('season',season).in('episode',undo.episodes)
      if(result.error)throw result.error
      if(token===generation.current) {
        const next=new Set(seen);undo.episodes.forEach(episode=>next.delete(episode));setSeen(next);setUndo(null);setSeasonCounts(previous=>({...previous,[season]:Math.max(0,(previous[season]||0)-undo.episodes.length)}))
      }
    }catch{if(token===generation.current)setError('Could not undo the season marks. Reload and try again.')}
    finally{mutation.current=false;if(token===generation.current)setBusy(null)}
  },[user,undo,season,seen])
  return { seen, seasonCounts, loading, busy, error, toggle, markSeason, undoSeason, canUndo: !!undo?.episodes.length && undo.season===season, retry: () => setRevision(value => value + 1) }
}
