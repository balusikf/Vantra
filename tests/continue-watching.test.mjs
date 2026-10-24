import test from 'node:test'
import assert from 'node:assert/strict'
import { parseContinueCandidates, resolveContinueTV, resolveContinueAnime, resolveContinueMovie } from '../src/lib/continue-watching.ts'

const now = Date.parse('2026-10-24T12:00:00Z')
const candidate = (overrides = {}) => ({ saved_id: 'saved', id: 42, kind: 'tv', title: 'A story', poster: null, status: 'watching', completed_at: null, marked_count: 0, history_season: null, history_episode: null, seasons: [], ...overrides })
const season = (n, count, date = '2026-01-01') => ({ season_number: n, episode_count: count, air_date: date })
const episodes = (count, date = '2026-01-01') => ({ episodes: Array.from({ length: count }, (_, i) => ({ episode_number: i + 1, name: `Chapter ${i + 1}`, air_date: date })) })
const mark = (season, count, first_unwatched, ranges) => ({ season, count, first_unwatched, ranges })

test('next episode follows the first actual gap rather than the last opened or highest marked episode', async () => {
  const item = candidate({ marked_count: 2, history_season: 1, history_episode: 5, seasons: [mark(1, 2, 2, [[1, 1], [3, 3]])] })
  const result = await resolveContinueTV(item, { seasons: [season(1, 5)] }, async () => episodes(5), now)
  assert.equal(result.state, 'next'); assert.equal(result.episode, 2)
  assert.equal(result.play, '/watch/tv/42?season=1&episode=2')
})

test('a complete season advances to the next season without reading already-covered episodes', async () => {
  const calls = [], item = candidate({ marked_count: 10, seasons: [mark(1, 10, 11, [[1, 10]])] })
  const result = await resolveContinueTV(item, { seasons: [season(0, 5), season(1, 10), season(2, 8)] }, async n => { calls.push(n); return episodes(8) }, now)
  assert.deepEqual(calls, [2]); assert.equal(result.season, 2); assert.equal(result.episode, 1)
})

test('future seasons and unknown episode air dates never produce a playable link', async () => {
  const item = candidate({ marked_count: 1, seasons: [mark(1, 1, 2, [[1, 1]])] })
  const future = await resolveContinueTV(item, { seasons: [season(1, 1), season(2, 8, '2027-01-01')] }, async () => { throw Error('Future season must not be loaded') }, now)
  assert.equal(future.state, 'upcoming'); assert.equal(future.play, null)
  const unknown = await resolveContinueTV(candidate(), { seasons: [season(1, 1)] }, async () => ({ episodes: [{ episode_number: 1, air_date: null }] }), now)
  assert.equal(unknown.state, 'unknown'); assert.equal(unknown.play, null)
})

test('a finished series is caught up and a declared-completed title is never reset to episode one', async () => {
  const complete = candidate({ status: 'completed', completed_at: '2026-10-22T12:00:00Z' })
  const result = await resolveContinueTV(complete, { seasons: [season(1, 10)], last_episode_to_air: { air_date: '2022-09-13' } }, async () => { throw Error('Old completed episodes need no request') }, now)
  assert.equal(result.state, 'caught_up'); assert.equal(result.play, null)
  const marked = candidate({ marked_count: 10, seasons: [mark(1, 10, 11, [[1, 10]])] })
  assert.equal((await resolveContinueTV(marked, { status: 'Ended', seasons: [season(1, 10)] }, async () => episodes(10), now)).state, 'caught_up')
})

test('completed titles use only newly released, unmarked episodes, including marks beyond earlier holes', async () => {
  const item = candidate({ status: 'completed', completed_at: '2026-10-01T12:00:00Z', marked_count: 2, seasons: [mark(1, 2, 2, [[1, 1], [3, 3]])] })
  const result = await resolveContinueTV(item, { seasons: [season(1, 4)], last_episode_to_air: { air_date: '2026-10-24' } }, async () => ({ episodes: [{ episode_number: 1, air_date: '2026-01-01' }, { episode_number: 2, air_date: '2026-01-02' }, { episode_number: 3, air_date: '2026-10-20' }, { episode_number: 4, air_date: '2026-10-24' }] }), now)
  assert.equal(result.episode, 4)
})

test('history alone resumes that exact episode, including specials, and does not mark or advance it', async () => {
  const item = candidate({ history_season: 0, history_episode: 3 })
  const result = await resolveContinueTV(item, { seasons: [season(0, 4), season(1, 10)] }, async n => { assert.equal(n, 0); return episodes(4) }, now)
  assert.equal(result.state, 'resume'); assert.equal(result.play, '/watch/tv/42?season=0&episode=3')
  assert.equal(item.marked_count, 0)
})

test('uncertain episode numbering and scan limits remain honest, instead of inventing a next episode', async () => {
  const missing = await resolveContinueTV(candidate({ marked_count: 1, seasons: [mark(1, 1, 2, [[1, 1]])] }), { seasons: [season(1, 3)] }, async () => ({ episodes: [{ episode_number: 1, air_date: '2026-01-01' }, { episode_number: 3, air_date: '2026-01-03' }] }), now)
  assert.equal(missing.state, 'unknown'); assert.equal(missing.play, null)
  const result = await resolveContinueTV(candidate({ status: 'completed', completed_at: '2025-01-01T00:00:00Z' }), { seasons: [season(1, 1), season(2, 1)] }, async () => episodes(1, '2024-01-01'), now, 1)
  assert.equal(result.state, 'unknown')
})

test('anime keeps AniList identity separate from its MAL playback ID and blocks future episodes', () => {
  const item = candidate({ id: 100, kind: 'anime', marked_count: 3, seasons: [mark(0, 3, 4, [[1, 3]])] })
  const anime = { idMal: 200, status: 'RELEASING', episodes: 12, startDate: { year: 2026 } }
  const data = { nextAiringEpisode: { episode: 4, airingAt: Math.floor(now / 1000) + 86400 }, airingSchedule: { nodes: [] } }
  const waiting = resolveContinueAnime(item, anime, data, now)
  assert.equal(waiting.play, null); assert.equal(waiting.state, 'upcoming')
  const aired = resolveContinueAnime(item, { ...anime, status: 'FINISHED' }, { ...data, nextAiringEpisode: null }, now)
  assert.equal(aired.play, '/watch/anime/200?episode=4&anilistId=100')
  assert.equal(resolveContinueAnime(item, { ...anime, idMal: null }, data, now).play, null)
})

test('anime history resumes without advancing, while a partial completed airing history stays uncertain', () => {
  const anime = { idMal: 200, status: 'FINISHED', episodes: 100, startDate: { year: 2026 } }
  const data = { nextAiringEpisode: null, airingSchedule: { nodes: [] } }
  assert.equal(resolveContinueAnime(candidate({ kind: 'anime', history_episode: 3 }), anime, data, now).episode, 3)
  const item = candidate({ kind: 'anime', status: 'completed', completed_at: '2026-01-01T00:00:00Z', marked_count: 1, seasons: [mark(0, 1, 1, [[100, 100]])] })
  assert.equal(resolveContinueAnime(item, anime, { ...data, partial: true, airingSchedule: { nodes: [{ episode: 100, airingAt: now / 1000 - 100 }] } }, now).state, 'unknown')
})

test('movies require a released date and candidate batches reject oversized or malformed input', () => {
  assert.equal(resolveContinueMovie(candidate({ kind: 'movie' }), '2027-01-01', now).play, null)
  assert.equal(resolveContinueMovie(candidate({ kind: 'movie' }), '2026-01-01', now).play, '/watch/movie/42')
  assert.equal(resolveContinueMovie(candidate({ kind: 'movie' }), null, now).play, null)
  assert.deepEqual(parseContinueCandidates({ items: [] }), [])
  assert.throws(() => parseContinueCandidates({ items: Array.from({ length: 7 }, () => candidate()) }))
  assert.throws(() => parseContinueCandidates({ items: [candidate({ id: -1 })] }))
})
