import test from 'node:test'
import assert from 'node:assert/strict'
import { discoveryGenres, discoveryKinds, discoveryLanes, discoveryUrl, drawDiscoveryChoice, discoveryReleaseAllowed, tmdbDiscoveryPath, animeDiscoveryVariables, tmdbDiscoveryTitles, animeDiscoveryTitles } from '../src/lib/nook-discovery.ts'
import { validateMediaParams } from '../src/lib/api-policy.ts'

const now = new Date('2026-10-24T12:00:00Z')

test('mixed discovery covers every collection and kind before cycling, without immediate repeats', () => {
  for (const options of [discoveryLanes, discoveryKinds('all', '')]) {
    let used = [], last
    for (let cycle = 0; cycle < 3; cycle++) {
      const values = []
      for (let i = 0; i < options.length; i++) {
        const next = drawDiscoveryChoice(options, used, () => 0)
        assert.notEqual(next.value, last)
        values.push(next.value); used = next.used; last = next.value
      }
      assert.equal(new Set(values).size, options.length)
    }
  }
  assert.equal(drawDiscoveryChoice([7], [7]).value, 7)
  assert.throws(() => drawDiscoveryChoice([], []))
})

test('explicit genres only draw from catalogues that support that genre', () => {
  assert.deepEqual(discoveryKinds('all', 'horror'), ['movie', 'anime'])
  assert.deepEqual(discoveryKinds('all', 'sports'), ['anime'])
  assert.ok(Object.hasOwn(discoveryGenres('all'), 'sports'))
  assert.ok(!Object.hasOwn(discoveryGenres('tv'), 'sports'))
})

test('discovery URLs preserve category, media identity and sampled pages, with strict API validation', () => {
  for (const kind of ['movie', 'tv', 'anime']) for (const lane of discoveryLanes) {
    for (const genre of ['', ...Object.keys(discoveryGenres(kind))]) {
      const url = new URL(discoveryUrl(kind, lane, genre, 7), 'http://vantra.local')
      assert.equal(url.searchParams.get('page'), '7')
      assert.equal(url.searchParams.get('collection'), lane)
      assert.doesNotThrow(() => validateMediaParams(kind === 'anime' ? 'anilist' : 'tmdb', url.searchParams))
    }
  }
  for (const extra of ['collection=mixed', 'collection=anything', 'collection=recent&collection=older', 'collection=older&page=11', 'collection=older&page=0', 'collection=older&sort=popular', 'collection=older&year=2020', 'collection=older&query=hello', 'collection=older&url=https://evil.example', 'collection=older&genre=sports']) {
    assert.throws(() => validateMediaParams('tmdb', new URLSearchParams(`type=nook-discover&mediaType=tv&${extra}`)))
  }
  assert.throws(() => validateMediaParams('anilist', new URLSearchParams('type=nook-discover&collection=older&mediaType=movie')))
  assert.throws(() => validateMediaParams('stream', new URLSearchParams('type=nook-discover&collection=older&id=1')))
})

test('recent and older feeds use separate date windows and exclude future or invalid dates', () => {
  assert.equal(discoveryReleaseAllowed('2026-10-24', 'recent', now), true)
  assert.equal(discoveryReleaseAllowed('2025-01-01', 'recent', now), false)
  assert.equal(discoveryReleaseAllowed('1996-01-01', 'older', now), true)
  assert.equal(discoveryReleaseAllowed('2020-01-01', 'older', now), false)
  for (const lane of discoveryLanes) for (const date of ['2027-01-01', '2026-02-31', null]) assert.equal(discoveryReleaseAllowed(date, lane, now), false)
  const recent = new URL(tmdbDiscoveryPath('movie', 'recent', 'comedy', now), 'https://api.themoviedb.org')
  assert.equal(recent.searchParams.get('primary_release_date.gte'), '2025-10-24')
  assert.equal(recent.searchParams.get('with_genres'), '35')
  const older = new URL(tmdbDiscoveryPath('tv', 'older', '', now), 'https://api.themoviedb.org')
  assert.equal(older.searchParams.get('first_air_date.lte'), '2016-10-24')
  assert.equal(new URL(tmdbDiscoveryPath('movie', 'trending', '', now), 'https://api.themoviedb.org').pathname, '/trending/movie/week')
})

test('less-mainstream feeds bound audience size instead of recycling the global popularity chart', () => {
  const path = new URL(tmdbDiscoveryPath('movie', 'less-known', '', now), 'https://api.themoviedb.org')
  assert.equal(path.searchParams.get('vote_count.lte'), '1000')
  assert.equal(path.searchParams.get('vote_average.gte'), '6')
  assert.equal(path.searchParams.get('sort_by'), 'vote_average.desc')
  const variables = animeDiscoveryVariables('less-known', 'scifi', 6, now)
  assert.equal(variables.audienceMin, 500); assert.equal(variables.audienceMax, 50000)
  assert.equal(variables.genre, 'Sci-Fi'); assert.equal(variables.page, 6)
  assert.equal(animeDiscoveryVariables('recent', '', 1, now).after, 20251024)
  assert.equal(animeDiscoveryVariables('older', '', 1, now).before, 20161024)
})

test('returned suggestions retain real genres, year and IDs while filtering adult, future and mismatched rows', () => {
  const movie = { id: 1, title: 'A smaller film', poster_path: '/poster.jpg', release_date: '2010-01-01', genre_ids: [35], vote_average: 7, vote_count: 200 }
  const rows = [movie, { ...movie, id: 2, release_date: '2027-01-01' }, { ...movie, id: 3, adult: true }, { ...movie, id: 4, vote_count: 100000 }, { ...movie, id: 5, genre_ids: [28] }]
  const picks = tmdbDiscoveryTitles(rows, 'movie', 'less-known', 'comedy', now)
  assert.deepEqual(picks.map(item => item.tmdb_id), [1])
  assert.deepEqual(picks[0].genres, ['Comedy']); assert.equal(picks[0].year, 2010)
  const anime = { id: 100, title: { english: 'A smaller anime', romaji: 'Anime' }, coverImage: { large: 'https://s4.anilist.co/a.jpg' }, genres: ['Sci-Fi'], status: 'FINISHED', startDate: { year: 2010, month: 1, day: 1 }, popularity: 10000, averageScore: 75 }
  const animePicks = animeDiscoveryTitles([anime, { ...anime, id: 101, popularity: 200000 }, { ...anime, id: 102, status: 'NOT_YET_RELEASED' }, { ...anime, id: 103, isAdult: true }], 'less-known', 'scifi', now)
  assert.equal(animePicks.length, 1); assert.equal(animePicks[0].tmdb_id, 100)
  assert.equal(animePicks[0].media_type, 'anime'); assert.equal(animePicks[0].collection, 'less-known')
})
