import { NextRequest } from 'next/server'
import { apiJson, authorizeMediaApi } from '@/lib/media-api'
import { validateMediaParams } from '@/lib/api-policy'
import { isMediaType, parseInteger } from '@/lib/watch-metadata'
import { getStreamProviders } from '@/lib/stream-providers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  try { validateMediaParams('stream', searchParams) }
  catch (error) { return apiJson({ error: (error as Error).message }, 400) }
  const denied = await authorizeMediaApi()
  if (denied) return denied
  const tmdbId = searchParams.get('id')
  const type = searchParams.get('type')
  const season = searchParams.get('season')
  const episode = searchParams.get('episode')
  const anilistId = searchParams.get('anilistId')

  const id = parseInteger(tmdbId)
  const seasonNumber = parseInteger(season ?? '1', 0)
  const episodeNumber = parseInteger(episode ?? '1')
  const anilistNumber = anilistId === null ? undefined : parseInteger(anilistId)
  if (anilistNumber === null || id === null || !isMediaType(type) || seasonNumber === null || episodeNumber === null) {
    return apiJson({ error: 'Invalid media, season or episode' }, 400)
  }

  const urls = getStreamProviders(type, id, seasonNumber, episodeNumber, anilistNumber)

  return apiJson({ providers: urls, primary: urls[0] })
}
