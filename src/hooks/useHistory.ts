import { createClient } from '@/lib/supabase'
import { useCallback } from 'react'

export function useHistory() {
  const supabase = createClient()

  const addToHistory = useCallback(async (
    tmdbId: number,
    mediaType: string,
    title: string,
    posterPath: string,
    season?: number,
    episode?: number
  ) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('watch_history').upsert({
      user_id: user.id,
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
  }, [supabase])

  return { addToHistory }
}
