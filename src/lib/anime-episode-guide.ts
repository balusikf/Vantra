import { ANIME_EPISODE_PAGE_SIZE } from './anime-artwork-policy.ts'

export interface AnimeGuideEpisode {
  number: number
  filler: boolean | null
  recap: boolean | null
  title: string | null
  overview: string | null
  runtime: number | null
  date: string | null
  still: string | null
}
export interface AnimeEpisodeGuide {
  available: boolean
  episodes: AnimeGuideEpisode[]
  sourceUrl: string | null
}
interface AnimeIdentity { id: number; idMal: number | null; title: { romaji: string; english: string | null } }
const emptyGuide = (): AnimeEpisodeGuide => ({ available: false, episodes: [], sourceUrl: null })
const ORIGIN = 'https://reanime.cz'
export const GUIDE_PAGE_SIZE = ANIME_EPISODE_PAGE_SIZE

function cleanText(value: unknown, max: number): string | null {
  return typeof value === 'string' ? value.trim().slice(0, max) || null : null
}

export function parseGuideEpisode(row: unknown, malId: number, first: number, last: number): AnimeGuideEpisode | null {
  if (!row || typeof row !== 'object') return null
  const item = row as Record<string, unknown>
  const number = item.episode_number
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < first || number > last) return null
  // A returned MAL link must agree with the requested catalog identity.
  if (typeof item.url === 'string' && !item.url.startsWith(`https://myanimelist.net/anime/${malId}/`)) return null
  let still: string | null = null
  if (typeof item.thumbnail === 'string') {
    try {
      const image = new URL(item.thumbnail)
      const match = image.pathname.match(/^\/t\/p\/w(?:300|500|780|1280)(\/[a-zA-Z0-9_.-]+\.(?:jpg|png|webp))$/)
      if (image.origin === 'https://image.tmdb.org' && !image.username && !image.password && match) still = match[1]
    } catch {}
  }
  const aired = typeof item.aired === 'string' ? item.aired.slice(0, 10) : ''
  return {
    number,
    filler: typeof item.is_filler === 'boolean' ? item.is_filler : null,
    recap: typeof item.is_recap === 'boolean' ? item.is_recap : null,
    title: cleanText(item.title, 220),
    overview: cleanText(item.description, 5000),
    runtime: typeof item.duration === 'number' && Number.isFinite(item.duration) && item.duration > 0 && item.duration <= 300 ? item.duration : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(aired) && Number.isFinite(Date.parse(aired)) ? aired : null,
    still,
  }
}

export function createAnimeEpisodeGuide(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { expires: number; data: unknown }>()
  const pending = new Map<string, Promise<unknown>>()
  let retryAt = 0

  async function read(url: URL): Promise<unknown> {
    const key = url.toString()
    const saved = cache.get(key)
    if (saved && saved.expires > now()) return saved.data
    cache.delete(key)
    if (pending.has(key)) return pending.get(key)!
    if (now() < retryAt || pending.size >= 8) throw new Error('Episode guide unavailable')
    const work = (async () => {
      try {
        const response = await fetcher(key, {
          headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error',
          signal: AbortSignal.timeout(4000), cache: 'no-store',
        })
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Episode guide unavailable')
        const reader = response.body?.getReader()
        if (!reader) throw new Error('Empty episode guide')
        let text = ''
        let length = 0
        const decoder = new TextDecoder()
        try {
          while (true) {
            const chunk = await reader.read()
            if (chunk.done) break
            length += chunk.value.byteLength
            if (length > 256 * 1024) throw new Error('Episode guide too large')
            text += decoder.decode(chunk.value, { stream: true })
          }
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
        const data: unknown = JSON.parse(text + decoder.decode())
        if (cache.size >= 128) cache.delete(cache.keys().next().value!)
        cache.set(key, { data, expires: now() + 6 * 60 * 60_000 })
        return data
      } catch (error) { retryAt = now() + 15_000; throw error }
    })()
    pending.set(key, work)
    try { return await work } finally { pending.delete(key) }
  }

  return async function getGuide(anime: AnimeIdentity, page = 1): Promise<AnimeEpisodeGuide> {
    if (!Number.isSafeInteger(anime.id) || anime.id < 1 || !anime.idMal || !Number.isSafeInteger(anime.idMal) || anime.idMal < 1 ||
      !Number.isSafeInteger(page) || page < 1 || page > 500) return emptyGuide()
    try {
      const query = new URL('/api/v1/search', ORIGIN)
      query.searchParams.set('limit', '3')
      query.searchParams.set('q', (anime.title.romaji || anime.title.english || '').slice(0, 120))
      const search = await read(query) as { results?: { anilist_id?: number; anime_id?: string }[] }
      // Never match just by title: remakes and different cours share names.
      const match = Array.isArray(search?.results) ? search.results.slice(0, 3).find(item => item?.anilist_id === anime.id) : undefined
      if (!match?.anime_id || !/^[a-z0-9][a-z0-9-]{0,140}$/.test(match.anime_id)) return emptyGuide()
      const url = new URL(`/api/v1/anime/${match.anime_id}/episodes`, ORIGIN)
      const first = (page - 1) * GUIDE_PAGE_SIZE + 1
      url.searchParams.set('limit', String(GUIDE_PAGE_SIZE))
      url.searchParams.set('offset', String(first - 1))
      const result = await read(url) as { data?: unknown[] }
      if (!Array.isArray(result?.data)) return emptyGuide()
      const episodes = result.data.slice(0, GUIDE_PAGE_SIZE).map(row => parseGuideEpisode(row, anime.idMal!, first, first + GUIDE_PAGE_SIZE - 1)).filter((row): row is AnimeGuideEpisode => row !== null)
      return { available: episodes.length > 0, episodes, sourceUrl: `${ORIGIN}/anime/${match.anime_id}` }
    } catch { return emptyGuide() }
  }
}

export const getAnimeEpisodeGuide = createAnimeEpisodeGuide()
