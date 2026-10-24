import type { SupabaseClient } from '@supabase/supabase-js'

// Keep the ownership filter on both the mutation and its confirmation query.
// RLS can reject a DELETE by affecting zero rows without returning an error.
export async function deleteOwnedLibraryRows(
  client: SupabaseClient,
  table: 'watchlist' | 'watch_history',
  userId: string,
  match: Record<string, string | number> = {},
) {
  if (!userId) throw new Error('Sign in required')
  let deletion = client.from(table).delete().eq('user_id', userId)
  for (const [column, value] of Object.entries(match)) deletion = deletion.eq(column, value)
  const { error } = await deletion
  if (error) throw error

  let verification = client.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId)
  for (const [column, value] of Object.entries(match)) verification = verification.eq(column, value)
  const result = await verification
  if (result.error) throw result.error
  if (result.count !== 0) throw new Error('Could not confirm deletion. Please reload your collection and try again.')
}

// Check for a private review before removing a saved title from any page.
export async function removeSavedTitle(client: SupabaseClient, userId: string, match: { id: string } | { tmdb_id: number; media_type: string }, reviewConfirmed = false) {
  if (!userId || !match || !Object.keys(match).length) throw new Error('Sign in and select a saved title first.')
  let check = client.from('watchlist').select('id, personal_rating, personal_note').eq('user_id', userId)
  for (const [key, value] of Object.entries(match)) check = check.eq(key, value)
  const { data, error } = await check.maybeSingle()
  if (error) throw new Error('Could not check your private review. Please try again.')
  if (data && (data.personal_rating != null || !!data.personal_note?.trim()) && !reviewConfirmed) return { needsConfirmation: true }
  await deleteOwnedLibraryRows(client, 'watchlist', userId, match)
  return { needsConfirmation: false }
}
