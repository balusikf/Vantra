'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import PlaybackControls from '@/components/vantra/PlaybackControls'
import { useHistory } from '@/hooks/useHistory'
import { getHistoryLookup, isMediaType } from '@/lib/watch-metadata'
import { PLAYER_IFRAME_ALLOW } from '@/lib/player-permissions'
import { fetchMedia } from '@/lib/client-media-cache'

const playerPageClass = 'relative h-svh w-full overflow-hidden bg-[#09090b]'

interface Provider {
  name: string
  url: string
}

export default function WatchPage() {
  return <Suspense fallback={<main data-player className={playerPageClass} aria-label="Video playback"><p className="p-4 text-zinc-400">Loading...</p></main>}><WatchContent /></Suspense>
}

function WatchContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const type = params.type as string
  const id = params.id as string
  const season = searchParams.get('season') || '1'
  const episode = searchParams.get('episode') || '1'
  const anilistId = searchParams.get('anilistId')
  return <Playback key={JSON.stringify([type, id, season, episode, anilistId])} type={type} id={id} season={season} episode={episode} anilistId={anilistId} onBack={() => router.back()} />
}

function Playback({ type, id, season, episode, anilistId, onBack }: { type: string; id: string; season: string; episode: string; anilistId: string | null; onBack: () => void }) {
  const { addToHistory } = useHistory()

  const [providers, setProviders] = useState<Provider[]>([])
  const [activeProvider, setActiveProvider] = useState<Provider | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const fetchStream = async () => {
      try {
        if (!isMediaType(type)) throw new Error('Invalid media type')
        const query = new URLSearchParams({ id, type, season, episode })
        if (type === 'anime' && anilistId !== null) query.set('anilistId', anilistId)
        const res = await fetch(`/api/stream?${query}`, { signal: controller.signal })
        if (!res.ok) throw new Error('Could not load sources. Please try again.')
        const data = await res.json()
        if (controller.signal.aborted) return
        setProviders(data.providers || [])
        setActiveProvider(data.primary || null)
        setLoading(false)

        // Save the catalog identity, never a provider's MAL ID as an AniList ID.
        const lookup = getHistoryLookup(type, id, anilistId)
        if (!lookup) return
        try {
          const detail = await fetchMedia<{ title: string | { english: string; romaji: string }; name?: string; poster_path?: string; coverImage?: { large: string } }>(lookup.url, controller.signal)
          if (controller.signal.aborted) return
          await addToHistory(
            lookup.mediaId,
            type,
            typeof detail.title === 'object' ? detail.title.english || detail.title.romaji : detail.title || detail.name || 'Unknown',
            type === 'anime' ? detail.coverImage?.large || '' : detail.poster_path || '',
            type === 'tv' ? Number(season) : undefined,
            type !== 'movie' ? Number(episode) : undefined,
            controller.signal,
          )
        } catch {
          if (!controller.signal.aborted) setHistoryError(true)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Could not load sources. Please try again.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void fetchStream()
    return () => controller.abort()
  }, [id, type, season, episode, anilistId, addToHistory])

  return (
    <main data-player className={playerPageClass} aria-label="Video playback">
      {error && <p role="alert" className="absolute z-2 top-20 left-4 right-4 text-red-400 px-4 py-2 bg-black/80 rounded-lg">{error}</p>}
      {historyError && <p role="status" className="absolute z-2 top-20 left-4 right-4 text-amber-400 px-4 py-2 bg-black/80 rounded-lg">Playback sources loaded, but your history could not be saved.</p>}
      {/* Player */}
      <div className="absolute inset-0">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-lg">Loading...</div>
          </div>
        ) : activeProvider ? (
          <iframe
            key={`${activeProvider.url}:${reloadCount}`}
            title={`${activeProvider.name} video player`}
            src={activeProvider.url}
            className="absolute inset-0 w-full h-full border-0"
            allowFullScreen={true}
            allow={PLAYER_IFRAME_ALLOW}
            referrerPolicy="no-referrer"
            style={{ border: 'none' }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-zinc-400">No stream available</p>
          </div>
        )}
      </div>
      <PlaybackControls providers={providers} activeProvider={activeProvider} onProviderChange={setActiveProvider} onReload={() => setReloadCount(count => count + 1)} onBack={onBack} />
    </main>
  )
}
