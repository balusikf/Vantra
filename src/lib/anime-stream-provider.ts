import type { StreamProvider } from './stream-providers'

const SOURCE_ORIGIN = 'https://reanime.cz'
const EMBED_ORIGIN = 'https://flixcloud.cc'
const MAX_RESPONSE_BYTES = 64 * 1024

// Re:ANIME's public watch-page resolver maps catalog IDs to FlixCloud file IDs.
// This is an unofficial integration; keep the other anime providers as fallbacks.
// Only public episode metadata is requested. No VANTRA credentials are forwarded.
async function readSourceResponse(response: Response): Promise<unknown> {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Anime source unavailable')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Empty anime source response')
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_RESPONSE_BYTES) throw new Error('Anime source response too large')
      text += decoder.decode(chunk.value, { stream: true })
    }
    return JSON.parse(text + decoder.decode())
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

function parseProvider(data: unknown): StreamProvider | null {
  if (!data || typeof data !== 'object' || !('success' in data) || data.success !== true ||
    !('servers' in data) || !Array.isArray(data.servers)) return null

  // Prefer HD-2's selectable audio/subtitles, then HD-1. Never follow arbitrary
  // URLs or copy tracking/query parameters supplied by the upstream response.
  for (const serverName of ['HD-2', 'HD-1']) {
    for (const server of data.servers.slice(0, 32)) {
      if (!server || server.serverName !== serverName || server.dataType !== 'sub' || typeof server.dataLink !== 'string') continue
      try {
        const source = new URL(server.dataLink)
        if (source.origin !== EMBED_ORIGIN || source.username || source.password ||
          !/^\/e\/[a-zA-Z0-9_-]{6,64}$/.test(source.pathname)) continue
        const url = new URL(source.pathname, EMBED_ORIGIN)
        url.searchParams.set('v', serverName === 'HD-2' ? '2' : '1')
        url.searchParams.set('autoPlay', 'false')
        return { name: 'FlixCloud', url: url.toString(), tags: ['ANIME', 'ADS'] }
      } catch {
        // A malformed source must not prevent another valid source from loading.
      }
    }
  }
  return null
}

export function createAnimeStreamResolver(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { expires: number; provider: StreamProvider | null }>()
  const pending = new Map<string, Promise<StreamProvider | null>>()
  let retryAt = 0

  return async function resolve(malId: number, episode: number, anilistId?: number): Promise<StreamProvider | null> {
    const validId = (id: number) => Number.isSafeInteger(id) && id > 0 && id <= 2147483647
    if (!validId(malId) || !validId(episode) || episode > 100000 ||
      (anilistId !== undefined && !validId(anilistId))) return null

    const key = `${anilistId ?? 0}:${malId}:${episode}`
    const saved = cache.get(key)
    if (saved && saved.expires > now()) return saved.provider
    cache.delete(key)
    const existing = pending.get(key)
    if (existing) return existing
    if (now() < retryAt || pending.size >= 16) return null

    const work = (async () => {
      try {
        const url = new URL(`/api/flix/${anilistId ?? 0}/${episode}`, SOURCE_ORIGIN)
        url.searchParams.set('mal', String(malId))
        const response = await fetcher(url.toString(), {
          headers: { Accept: 'application/json' },
          credentials: 'omit',
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(3000),
        })
        const provider = parseProvider(await readSourceResponse(response))
        if (cache.size >= 512) cache.delete(cache.keys().next().value!)
        cache.set(key, { provider, expires: now() + (provider ? 10 * 60_000 : 60_000) })
        return provider
      } catch {
        // Provider outages must not take down the existing source selector.
        retryAt = now() + 15_000
        return null
      }
    })()
    pending.set(key, work)
    try {
      return await work
    } finally {
      pending.delete(key)
    }
  }
}

export const resolveAnimeStreamProvider = createAnimeStreamResolver()
