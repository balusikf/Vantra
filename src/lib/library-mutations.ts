import type { SupabaseClient } from '@supabase/supabase-js'

// A session may change while an auth check or an insert is in flight. Every
// continuation must still belong to the account and selection that started it.
export async function requireCurrentAccount(client: SupabaseClient, userId: string, assertCurrent: () => void) {
  assertCurrent()
  const { data: { user }, error } = await client.auth.getUser()
  assertCurrent()
  if (error || !userId || user?.id !== userId) throw new Error('Your account changed. Reload before trying again.')
}

export async function ensureTrackedTitle(client: SupabaseClient, input: {
  user_id: string; tmdb_id: number; media_type: 'tv' | 'anime'; title: string; poster_path: string
}, assertCurrent: () => void): Promise<string> {
  assertCurrent()
  const inserted = await client.from('watchlist').insert({ ...input, watch_status: 'watching' }).select('id').single()
  assertCurrent()
  if (inserted.error && inserted.error.code !== '23505') throw inserted.error
  if (inserted.data?.id) return inserted.data.id
  const existing = await client.from('watchlist').select('id').eq('user_id', input.user_id)
    .eq('tmdb_id', input.tmdb_id).eq('media_type', input.media_type).single()
  assertCurrent()
  if (existing.error || !existing.data?.id) throw existing.error || new Error('Saved title unavailable.')
  return existing.data.id
}
