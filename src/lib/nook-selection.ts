import type { SupabaseClient } from '@supabase/supabase-js'

export type NookKind = 'all' | 'movie' | 'tv' | 'anime'
export type NookTitle = { tmdb_id: number; media_type: Exclude<NookKind, 'all'>; title: string; poster_path: string | null }

// The pool stays in its picker session. No cross-account/localStorage cache.
export async function loadNookTitles(client: SupabaseClient, userId: string, signal: AbortSignal): Promise<NookTitle[]> {
  const pool: NookTitle[] = []
  for (let offset = 0; ; offset += 500) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const { data, error } = await client.from('watchlist')
      .select('tmdb_id,media_type,title,poster_path').eq('user_id', userId).eq('watch_status', 'planned')
      .order('id').range(offset, offset + 499).abortSignal(signal)
    if (error) throw error
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    pool.push(...(data || []))
    if (!data || data.length < 500) return pool
  }
}

export const nookTitleKey = (item: NookTitle) => `${item.media_type}:${item.tmdb_id}`

export function pickNookTitle(pool: NookTitle[], kind: NookKind, seen: readonly string[], random = Math.random): NookTitle | null {
  const matches = pool.filter(item => kind === 'all' || item.media_type === kind)
  if (!matches.length) return null
  const fresh = matches.filter(item => !seen.includes(nookTitleKey(item)))
  // Once everything has been shown, avoid an immediate repeat when possible.
  const candidates = fresh.length ? fresh : matches.filter(item => nookTitleKey(item) !== seen.at(-1))
  const available = candidates.length ? candidates : matches
  return available[Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)))]
}

export function nookPoster(item: NookTitle): string | null {
  const path = item.poster_path
  if (!path) return null
  if (item.media_type === 'anime') {
    try { const url = new URL(path); return url.protocol === 'https:' && url.hostname === 's4.anilist.co' ? url.href : null } catch { return null }
  }
  return /^\/[a-zA-Z0-9._/-]+$/.test(path) ? `https://image.tmdb.org/t/p/w342${path}` : null
}

export function nookAllowed(pathname: string) {
  return pathname !== '/' && !/^\/(watch|login)(\/|$)/.test(pathname)
}
