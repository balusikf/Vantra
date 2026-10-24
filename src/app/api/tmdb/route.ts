import { NextRequest } from 'next/server'
import { apiJson, authorizeMediaApi, catalogError } from '@/lib/media-api'
import { validateMediaParams } from '@/lib/api-policy'
import { parseInteger } from '@/lib/watch-metadata'
import { catalogPage, type ProviderPage } from '@/lib/catalog-page'
import type { TMDBMedia } from '@/lib/tmdb'
import { readCatalogFilters } from '@/lib/catalog-filters'
import {
  getTrending,
  getPopularMovies,
  getPopularTV,
  getTopRatedMovies,
  getTopRatedTV,
  searchMedia,
  getTVDetail,
  getSeasonDetail,
  getMovieDetail,
  getMediaReviews,
  discoverMedia,getPersonDetail,
} from '@/lib/tmdb'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  try { validateMediaParams('tmdb', searchParams) }
  catch (error) { return apiJson({ error: (error as Error).message }, 400) }
  const denied = await authorizeMediaApi()
  if (denied) return denied
  const type = searchParams.get('type')
  const query = searchParams.get('query')
  const mediaType = searchParams.get('mediaType')
  if (mediaType !== null && mediaType !== 'movie' && mediaType !== 'tv') {
    return apiJson({ error: 'Invalid media type' }, 400)
  }
  const id = searchParams.get('id')
  const season = searchParams.get('season')
  const page = parseInteger(searchParams.get('page') ?? '1')
  const pageSize = searchParams.get('pageSize')
  if (pageSize !== null && pageSize !== '18') return apiJson({ error: 'Invalid page size' }, 400)
  if (page === null || page > 500 || (id !== null && parseInteger(id) === null) || (season !== null && parseInteger(season, 0) === null)) {
    return apiJson({ error: 'Invalid id, season or page' }, 400)
  }

  try {
    if (pageSize === '18') {
      if (type === 'search' && !query) return apiJson({ error: 'No query' }, 400)
      const loaders: Record<string, (page: number) => Promise<ProviderPage<TMDBMedia>>> = {
        trending: getTrending, 'popular-movies': getPopularMovies, 'popular-tv': getPopularTV,
        'top-rated-movies': getTopRatedMovies, 'top-rated-tv': getTopRatedTV,
        search: page => searchMedia(query!, page, mediaType || undefined),
        discover: page => discoverMedia(mediaType as 'movie'|'tv',readCatalogFilters(searchParams),searchParams.get('sort')||'popular',page,searchParams.get('released')==='1'),
      }
      if (!type || !Object.hasOwn(loaders, type)) return apiJson({ error: 'Invalid catalog type' }, 400)
      return apiJson(await catalogPage(loaders[type], page))
    }
    let data

    switch (type) {
      case 'discover':
        data=await discoverMedia(mediaType as 'movie'|'tv',readCatalogFilters(searchParams),searchParams.get('sort')||'popular',page,searchParams.get('released')==='1')
        break
      case 'person':
        data=await getPersonDetail(Number(id))
        break
      case 'trending':
        data = await getTrending(page)
        break
      case 'popular-movies':
        data = await getPopularMovies(page)
        break
      case 'popular-tv':
        data = await getPopularTV(page)
        break
      case 'top-rated-movies':
        data = await getTopRatedMovies(page)
        break
      case 'top-rated-tv':
        data = await getTopRatedTV(page)
        break
      case 'search':
        if (!query) return apiJson({ error: 'No query' }, 400)
        data = await searchMedia(query, page, mediaType || undefined)
        break
      case 'movie-detail':
        if (!id) return apiJson({ error: 'No id' }, 400)
        data = await getMovieDetail(parseInt(id))
        break
      case 'tv-detail':
        if (!id) return apiJson({ error: 'No id' }, 400)
        data = await getTVDetail(parseInt(id))
        break
      case 'movie-reviews':
      case 'tv-reviews':
        data = await getMediaReviews(Number(id), type === 'movie-reviews' ? 'movie' : 'tv')
        break
      case 'season-detail':
        if (!id || !season) return apiJson({ error: 'Missing params' }, 400)
        data = await getSeasonDetail(parseInt(id), parseInt(season))
        break
      default:
        return apiJson({ error: 'Invalid type' }, 400)
    }

    return apiJson(data)
  } catch (error) { return catalogError(error) }
}
