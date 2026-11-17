import assert from 'node:assert/strict'
import test from 'node:test'
import { createAnimeEpisodeGuide, parseGuideEpisode } from '../src/lib/anime-episode-guide.ts'
import { validateMediaParams } from '../src/lib/api-policy.ts'

const anime = { id: 21, idMal: 21, title: { romaji: 'ONE PIECE', english: 'One Piece' } }
const row = { episode_number: 50, is_filler: true, is_recap: false, title: 'Usopp vs. Daddy', duration: 25, aired: '2000-11-29T00:00:00Z', url: 'https://myanimelist.net/anime/21/One_Piece/episode/50', thumbnail: 'https://image.tmdb.org/t/p/w780/episode.jpg', description: 'An episode description.' }

test('guide retains explicit filler/recap flags and only trusted image paths', () => {
  assert.deepEqual(parseGuideEpisode(row, 21, 49, 72), { number: 50, filler: true, recap: false, title: 'Usopp vs. Daddy', overview: 'An episode description.', runtime: 25, date: '2000-11-29', still: '/episode.jpg' })
  const unknown = parseGuideEpisode({ ...row, is_filler: null, is_recap: undefined, thumbnail: 'https://evil.test/episode.jpg', duration: -1 }, 21, 49, 72)
  assert.equal(unknown.filler, null)
  assert.equal(unknown.recap, null)
  assert.equal(unknown.still, null)
  assert.equal(unknown.runtime, null)
  assert.equal(parseGuideEpisode({ ...row, url: 'https://myanimelist.net/anime/20/Naruto/episode/50' }, 21, 49, 72), null)
  assert.equal(parseGuideEpisode(row, 21, 1, 24), null)
})

test('guide requires the exact AniList identity before requesting an episode range', async () => {
  const calls = []
  const get = createAnimeEpisodeGuide(async (url, options) => {
    calls.push(url)
    assert.equal(options.credentials, 'omit')
    assert.equal(options.redirect, 'error')
    if (url.includes('/search?')) return Response.json({ results: [{ anilist_id: 141902, anime_id: 'one-piece-film-red' }, { anilist_id: 21, anime_id: 'one-piece-xamk74' }] })
    return Response.json({ data: [row, { ...row, episode_number: 1 }] })
  })
  const result = await get(anime, 3)
  assert.equal(result.available, true)
  assert.equal(result.episodes.length, 1)
  assert.equal(result.episodes[0].number, 50)
  assert.equal(result.sourceUrl, 'https://reanime.cz/anime/one-piece-xamk74')
  assert.equal(calls[1], 'https://reanime.cz/api/v1/anime/one-piece-xamk74/episodes?limit=24&offset=48')
  await get(anime, 3)
  assert.equal(calls.length, 2)
})

test('similarly named anime, malformed slugs and missing mappings never produce filler labels', async () => {
  for (const result of [{ anilist_id: 999, anime_id: 'one-piece-xamk74' }, { anilist_id: 21, anime_id: '../another-anime' }, { anilist_id: '21', anime_id: 'one-piece-xamk74' }]) {
    let calls = 0
    const get = createAnimeEpisodeGuide(async () => { calls++; return Response.json({ results: [result] }) })
    assert.deepEqual(await get(anime), { available: false, episodes: [], sourceUrl: null })
    assert.equal(calls, 1)
  }
})

test('guide outages fail softly, back off and recover without blocking playback', async () => {
  let clock = 0
  let calls = 0
  const get = createAnimeEpisodeGuide(async () => { calls++; throw new Error('Unavailable') }, () => clock)
  assert.equal((await get(anime)).available, false)
  assert.equal((await get(anime, 2)).available, false)
  assert.equal(calls, 1)
  clock = 15001
  await get(anime)
  assert.equal(calls, 2)
})

test('episode guide validates IDs, page bounds and rejects unrelated query parameters', async () => {
  const get = createAnimeEpisodeGuide(async () => assert.fail('Unexpected upstream request'))
  for (const page of [0, -1, 1.2, 501, NaN]) assert.equal((await get(anime, page)).available, false)
  assert.equal((await get({ ...anime, idMal: null })).available, false)
  validateMediaParams('anilist', new URLSearchParams('type=episode-guide&id=21&page=3'))
  for (const query of ['type=episode-guide', 'type=episode-guide&id=21&page=501', 'type=episode-guide&id=21&query=Naruto', 'type=episode-guide&id=21&page=1&page=2']) {
    assert.throws(() => validateMediaParams('anilist', new URLSearchParams(query)))
  }
})
