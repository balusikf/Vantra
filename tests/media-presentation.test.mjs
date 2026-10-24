import test from 'node:test'
import assert from 'node:assert/strict'
import { animeTile, hasAired, mergeTiles, tmdbTile } from '../src/lib/media-presentation.ts'

test('movie and series cards keep distinct identities during pagination', () => {
  const base = { id: 42, title: 'A story', poster_path: null, vote_count: 10, vote_average: 8, release_date: '2026-01-02' }
  const movie = tmdbTile({ ...base, media_type: 'movie' })
  const show = tmdbTile({ ...base, media_type: 'tv' })
  assert.equal(movie.href, '/movie/42')
  assert.equal(show.href, '/tv/42')
  assert.equal(mergeTiles([movie], [show]).length, 2)
})

test('anime poster links preserve AniList identity rather than substituting MAL', () => {
  const anime = animeTile({ id: 42, idMal: 7, title: { english: 'A story', romaji: 'Monogatari' }, coverImage: { large: 'https://s4.anilist.co/poster.jpg' }, startDate: { year: 2026 }, averageScore: 85 })
  assert.equal(anime.href, '/anime/42')
  assert.equal(anime.id, 'anime:42')
  assert.equal(anime.rating, 8.5)
})

test('pagination removes duplicates within and across provider pages', () => {
  const a = { id: 'movie:1' }, b = { id: 'movie:2' }
  assert.deepEqual(mergeTiles([a], [a, b, b]), [a, b])
})

test('unconfirmed and future episodes do not get play links', () => {
  assert.equal(hasAired(null, '2026-10-21'), false)
  assert.equal(hasAired('2026-10-22', '2026-10-21'), false)
  assert.equal(hasAired('2026-10-21', '2026-10-21'), true)
  assert.equal(hasAired('2025-10-21', '2026-10-21'), true)
})
