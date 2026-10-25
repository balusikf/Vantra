import { catalogGenres, genreOptions } from './catalog-filters.ts'
import type { NookKind, NookTitle } from './nook-selection.ts'

export const discoveryCollections = [
  { id: 'mixed', label: 'Mix it up', hint: 'Rotate through trending, new, older and less mainstream titles.' },
  { id: 'trending', label: 'Trending now', hint: 'Titles getting attention right now.' },
  { id: 'recent', label: 'New releases', hint: 'Movies, series and anime first released in the past year.' },
  { id: 'older', label: 'Older picks', hint: 'Explore titles released at least ten years ago.' },
  { id: 'less-known', label: 'Less mainstream', hint: 'Rated titles with smaller audiences, beyond the biggest hits.' },
] as const
export type DiscoveryCollection = typeof discoveryCollections[number]['id']
export type DiscoveryLane = Exclude<DiscoveryCollection, 'mixed'>
export const discoveryLanes: DiscoveryLane[] = ['trending', 'recent', 'older', 'less-known']
export type DiscoveryKind = Exclude<NookKind, 'all'>
export type DiscoveryTitle = NookTitle & { genres: string[]; year: number; collection: DiscoveryLane }
export type DiscoveryPage = { results: DiscoveryTitle[]; totalPages: number }

export function discoveryGenres(kind: NookKind): Record<string, [string, string]> {
  return kind === 'all' ? { ...catalogGenres.anime, ...catalogGenres.tv, ...catalogGenres.movie } : genreOptions(kind)
}
export function discoveryKinds(kind: NookKind, genre: string): DiscoveryKind[] {
  return (kind === 'all' ? ['movie', 'tv', 'anime'] as const : [kind]).filter(value => !genre || Object.hasOwn(genreOptions(value), genre))
}

// Each shuffle cycle covers every option; a new cycle avoids an immediate repeat.
export function drawDiscoveryChoice<T>(options: readonly T[], used: readonly T[], random = Math.random): { value: T; used: T[] } {
  if (!options.length) throw new Error('No discovery options.')
  const fresh = options.filter(value => !used.includes(value))
  const candidates = fresh.length ? fresh : options.filter(value => value !== used.at(-1))
  const available = candidates.length ? candidates : options
  const value = available[Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)))]
  return { value, used: fresh.length ? [...used, value] : [value] }
}

export function discoveryUrl(kind: DiscoveryKind, collection: DiscoveryLane, genre: string, page: number): string {
  const params = new URLSearchParams({ type: 'nook-discover', collection, page: String(page) })
  if (kind !== 'anime') params.set('mediaType', kind)
  if (genre) params.set('genre', genre)
  return `/api/${kind === 'anime' ? 'anilist' : 'tmdb'}?${params}`
}

export function discoveryDates(now = new Date()) {
  const before = new Date(now), recent = new Date(now), older = new Date(now)
  before.setUTCDate(before.getUTCDate() + 1)
  recent.setUTCFullYear(recent.getUTCFullYear() - 1)
  older.setUTCFullYear(older.getUTCFullYear() - 10)
  const iso = (value: Date) => value.toISOString().slice(0, 10)
  return { today: iso(now), before: iso(before), recent: iso(recent), older: iso(older) }
}

export function discoveryReleaseAllowed(date: string | null | undefined, lane: DiscoveryLane, now = new Date()) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const stamp = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== date) return false
  const bounds = discoveryDates(now)
  return date <= bounds.today && (lane !== 'recent' || date >= bounds.recent) && (lane !== 'older' || date <= bounds.older)
}

export function tmdbDiscoveryPath(kind: 'movie' | 'tv', lane: DiscoveryLane, genre: string, now = new Date()) {
  if (lane === 'trending') return `/trending/${kind}/week?language=en-US`
  const dates = discoveryDates(now), date = kind === 'movie' ? 'primary_release_date' : 'first_air_date'
  const params = new URLSearchParams({ language: 'en-US', include_adult: 'false', sort_by: lane === 'recent' ? 'popularity.desc' : 'vote_average.desc' })
  if (kind === 'movie') params.set('include_video', 'false')
  params.set(`${date}.lte`, lane === 'older' ? dates.older : dates.today)
  if (genre) params.set('with_genres', genreOptions(kind)[genre][1])
  if (lane === 'recent') params.set(`${date}.gte`, dates.recent)
  params.set('vote_count.gte', lane === 'recent' ? (kind === 'movie' ? '20' : '5') : (kind === 'movie' ? '50' : '20'))
  if (lane === 'less-known') {
    params.set('vote_count.lte', kind === 'movie' ? '1000' : '300')
    params.set('vote_average.gte', '6')
  }
  return `/discover/${kind}?${params}`
}

export function animeDiscoveryVariables(lane: DiscoveryLane, genre: string, page: number, now = new Date()) {
  const dates = discoveryDates(now), fuzzy = (date: string) => Number(date.replaceAll('-', ''))
  return {
    page, genre: genre ? genreOptions('anime')[genre][1] : undefined,
    sort: [lane === 'trending' || lane === 'recent' ? 'TRENDING_DESC' : 'SCORE_DESC'],
    after: lane === 'recent' ? fuzzy(dates.recent) : undefined,
    before: fuzzy(lane === 'older' ? dates.older : dates.before),
    score: lane === 'less-known' || lane === 'older' ? 60 : undefined,
    audienceMin: lane === 'less-known' ? 500 : undefined,
    audienceMax: lane === 'less-known' ? 50000 : undefined,
  }
}

type MovieRow = { id: number; title?: string; name?: string; poster_path: string | null; release_date?: string; first_air_date?: string; genre_ids?: number[]; adult?: boolean; vote_count: number; vote_average: number }
export function tmdbDiscoveryTitles(rows: MovieRow[], kind: 'movie' | 'tv', lane: DiscoveryLane, genre: string, now = new Date()): DiscoveryTitle[] {
  const genres = genreOptions(kind), selected = genre ? Number(genres[genre][1]) : null
  return rows.filter(row => Number.isSafeInteger(row.id) && row.id > 0 && !row.adult && discoveryReleaseAllowed(kind === 'movie' ? row.release_date : row.first_air_date, lane, now)
    && (!selected || row.genre_ids?.includes(selected))
    && (lane !== 'less-known' || row.vote_average >= 6 && row.vote_count >= (kind === 'movie' ? 50 : 20) && row.vote_count <= (kind === 'movie' ? 1000 : 300)))
    .map(row => ({ tmdb_id: row.id, media_type: kind, title: row.title || row.name || 'Untitled', poster_path: row.poster_path, year: Number((kind === 'movie' ? row.release_date : row.first_air_date)!.slice(0, 4)), collection: lane,
      genres: Object.values(genres).filter(([, id]) => row.genre_ids?.includes(Number(id))).map(([label]) => label) }))
}

type AnimeRow = { id: number; title: { english: string | null; romaji: string }; coverImage: { large: string; extraLarge?: string }; genres: string[]; status: string; isAdult?: boolean; startDate: { year: number | null; month?: number | null; day?: number | null }; popularity: number; averageScore: number | null }
export function animeDiscoveryTitles(rows: AnimeRow[], lane: DiscoveryLane, genre: string, now = new Date()): DiscoveryTitle[] {
  return rows.filter(row => {
    const { year, month, day } = row.startDate
    const date = year && month && day ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null
    return Number.isSafeInteger(row.id) && row.id > 0 && !row.isAdult && row.status !== 'NOT_YET_RELEASED' && discoveryReleaseAllowed(date, lane, now)
      && (!genre || row.genres.includes(genreOptions('anime')[genre][1]))
      && (lane !== 'less-known' || row.popularity >= 500 && row.popularity <= 50000 && (row.averageScore || 0) >= 60)
  }).map(row => ({ tmdb_id: row.id, media_type: 'anime', title: row.title.english || row.title.romaji, poster_path: row.coverImage.extraLarge || row.coverImage.large, genres: row.genres, year: row.startDate.year!, collection: lane }))
}
