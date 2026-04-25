const ANILIST_API = 'https://graphql.anilist.co'

// Helper funkcia pre AniList GraphQL requesty
async function anilistFetch(query: string, variables?: object) {
  const res = await fetch(ANILIST_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 3600 }
  })
  if (!res.ok) throw new Error('AniList fetch failed')
  const data = await res.json()
  return data.data
}

// Trending anime
export async function getTrendingAnime() {
  const query = `
    query {
      Page(page: 1, perPage: 20) {
        media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
          id
          title { romaji english }
          coverImage { large }
          bannerImage
          description
          averageScore
          episodes
          status
          startDate { year }
          genres
        }
      }
    }
  `
  const data = await anilistFetch(query)
  return data.Page.media
}

// Populárne anime
export async function getPopularAnime() {
  const query = `
    query {
      Page(page: 1, perPage: 20) {
        media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          id
          title { romaji english }
          coverImage { large }
          bannerImage
          description
          averageScore
          episodes
          status
          startDate { year }
          genres
        }
      }
    }
  `
  const data = await anilistFetch(query)
  return data.Page.media
}

// Top rated anime
export async function getTopRatedAnime() {
  const query = `
    query {
      Page(page: 1, perPage: 20) {
        media(sort: SCORE_DESC, type: ANIME, isAdult: false) {
          id
          title { romaji english }
          coverImage { large }
          bannerImage
          description
          averageScore
          episodes
          status
          startDate { year }
          genres
        }
      }
    }
  `
  const data = await anilistFetch(query)
  return data.Page.media
}

// Vyhľadávanie anime
export async function searchAnime(query: string) {
  const gqlQuery = `
    query($search: String) {
      Page(page: 1, perPage: 20) {
        media(search: $search, type: ANIME, isAdult: false) {
          id
          title { romaji english }
          coverImage { large }
          bannerImage
          description
          averageScore
          episodes
          status
          startDate { year }
          genres
        }
      }
    }
  `
  const data = await anilistFetch(gqlQuery, { search: query })
  return data.Page.media
}

// Detail anime
export async function getAnimeDetail(id: number) {
  const query = `
    query($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        idMal
        title { romaji english }
        coverImage { large extraLarge }
        bannerImage
        description
        averageScore
        episodes
        status
        startDate { year }
        genres
        studios { nodes { name } }
        trailer { id site }
      }
    }
  `
  const data = await anilistFetch(query, { id })
  return data.Media
}

// AniList typ
export interface AniListMedia {
  id: number
  title: { romaji: string; english: string | null }
  coverImage: { large: string; extraLarge?: string }
  bannerImage: string | null
  description: string | null
  averageScore: number | null
  episodes: number | null
  status: string
  startDate: { year: number | null }
  genres: string[]

  
}
// Detail epizód anime
export async function getAnimeEpisodes(id: number) {
  const query = `
    query($id: Int) {
      Media(id: $id, type: ANIME) {
        episodes
        nextAiringEpisode {
          episode
          airingAt
        }
        airingSchedule {
          nodes {
            episode
            airingAt
          }
        }
        startDate { year month day }
      }
    }
  `
  const data = await anilistFetch(query, { id })
  return data.Media
}