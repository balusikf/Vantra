import { NextRequest } from 'next/server'
import { apiJson, authorizeMediaApi, catalogError } from '@/lib/media-api'
import { validateMediaParams } from '@/lib/api-policy'
import { getAnimeArtwork, getAnimeEpisodePreviews } from '@/lib/anime-artwork'
import { parseInteger } from '@/lib/watch-metadata'
import { readCatalogFilters } from '@/lib/catalog-filters'
import { getAnimeCatalog, getAnimeDetail, getAnimeEpisodes, getAnimeReviews, getTrendingAnime, getPopularAnime, getTopRatedAnime, searchAnime, getNookDiscoverAnime } from '@/lib/anilist'
import type { DiscoveryLane } from '@/lib/nook-discovery'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  try { validateMediaParams('anilist', searchParams) }
  catch (error) { return apiJson({ error: (error as Error).message }, 400) }
  const denied = await authorizeMediaApi()
  if (denied) return denied
  const type = searchParams.get('type')
  const id = searchParams.get('id')
  const query = searchParams.get('query')
  const page = parseInteger(searchParams.get('page') ?? '1')
  const sort = searchParams.get('sort') ?? 'trending'
  if (page === null || page > 500 || !['trending', 'popular', 'top-rated'].includes(sort)) {
    return apiJson({ error: 'Invalid page or sort' }, 400)
  }
  if (id !== null && parseInteger(id) === null) {
    return apiJson({ error: 'Invalid id' }, 400)
  }

  try {
    let data

    switch (type) {
      case 'nook-discover':
        data = await getNookDiscoverAnime(searchParams.get('collection') as DiscoveryLane, searchParams.get('genre') || '', page)
        break
      case 'catalog':
        data = await getAnimeCatalog(page, sort as 'trending' | 'popular' | 'top-rated', query || undefined,readCatalogFilters(searchParams),searchParams.get('released')==='1')
        break
      case 'trending':
        data = await getTrendingAnime()
        break
      case 'popular':
        data = await getPopularAnime()
        break
      case 'top-rated':
        data = await getTopRatedAnime()
        break
      case 'detail':
        if (!id) return apiJson({ error: 'No id' }, 400)
        {
          const [anime, artwork] = await Promise.all([getAnimeDetail(Number(id)), getAnimeArtwork(Number(id))])
          data = anime ? { ...anime, artwork } : null
        }
        break
      case 'reviews':
        data = await getAnimeReviews(Number(id))
        break
      case 'episodes':
        if (!id) return apiJson({ error: 'No id' }, 400)
        {
          const [episodes, anime] = await Promise.all([getAnimeEpisodes(Number(id)), getAnimeDetail(Number(id))])
          data = { ...episodes, previews: anime ? await getAnimeEpisodePreviews(anime) : [] }
        }
        break
      case 'search':
        if (!query) return apiJson({ error: 'No query' }, 400)
        data = await searchAnime(query)
        break
      default:
        return apiJson({ error: 'Invalid type' }, 400)
    }

    return apiJson(data)
  } catch (error) {
    return catalogError(error)
  }
}
