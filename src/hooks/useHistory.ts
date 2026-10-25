import { createClient } from '@/lib/supabase'
import { useCallback } from 'react'
import { useAccount } from '@/components/vantra/AccountProvider'
import { requireCurrentAccount } from '@/lib/library-mutations'

export function useHistory() {
  const supabase = createClient()
  const { user } = useAccount()
  const userId = user?.id

  const addToHistory = useCallback(async (
    tmdbId: number,
    mediaType: string,
    title: string,
    posterPath: string,
    season?: number,
    episode?: number,
    signal?: AbortSignal,
  ) => {
    if (!userId) return
    const assertCurrent = () => signal?.throwIfAborted()
    await requireCurrentAccount(supabase, userId, assertCurrent)

    const { error } = await supabase.from('watch_history').upsert({
      user_id: userId,
      tmdb_id: tmdbId,
      media_type: mediaType,
      title,
      poster_path: posterPath,
      season,
      episode,
      last_watched: new Date().toISOString(),
    }, {
      onConflict: 'user_id,tmdb_id,media_type'
    })
    if (error) throw error
  }, [supabase, userId])

  return { addToHistory }
}
