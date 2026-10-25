import test from 'node:test'
import assert from 'node:assert/strict'
import { filmCollectionReference, presentFilmCollection, collectionReleaseState, filmCollectionProgress, loadFilmCollectionStatuses } from '../src/lib/film-collection.ts'
import { validateMediaParams } from '../src/lib/api-policy.ts'

const movie = (id, date, extra = {}) => ({ id, title: `Film ${id}`, release_date: date, poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg', vote_average: 7.5, vote_count: 100, ...extra })
const collection = parts => presentFilmCollection({ id: 100, name: 'A film collection', overview: 'A story', parts })

test('collection films are deduplicated and sorted by release date, with future and unknown dates retained', () => {
  const rows = [movie(4, null), movie(2, '2002-01-01'), movie(3, '2028-01-01'), movie(1, '2001-01-01'), movie(2, '2002-01-01'), movie(5, '2026-02-31'), movie(6, '2000-01-01', { adult: true }), movie(-1, '1999-01-01')]
  const before = JSON.stringify(rows), value = collection(rows)
  assert.deepEqual(value.parts.map(film => film.id), [1, 2, 3, 4, 5])
  assert.equal(value.parts[0].media_type, 'movie')
  assert.equal(value.parts[4].release_date, '')
  assert.equal(JSON.stringify(rows), before)
  assert.equal(collectionReleaseState(value.parts[0], '2026-10-25'), 'released')
  assert.equal(collectionReleaseState(value.parts[2], '2026-10-25'), 'upcoming')
  assert.equal(collectionReleaseState(value.parts[3], '2026-10-25'), 'unknown')
})

test('collection references and artwork reject invalid IDs, unsafe paths and oversized lists', () => {
  assert.equal(filmCollectionReference(null), null)
  for (const id of [0, -1, 1.2, 2147483648, '100']) assert.equal(filmCollectionReference({ id }), null)
  const ref = filmCollectionReference({ id: 100, name: 'Films', poster_path: 'https://tracker.example/a.jpg', backdrop_path: '/../private.jpg' })
  assert.equal(ref.poster_path, null); assert.equal(ref.backdrop_path, null)
  assert.throws(() => collection(Array.from({ length: 201 }, (_, i) => movie(i + 1, '2000-01-01'))))
  assert.throws(() => presentFilmCollection({ id: 100, parts: null }))
  const normalized = collection([movie(1, '2000-01-01', { vote_average: Infinity, vote_count: -1, title: '', original_title: 'Original title' })]).parts[0]
  assert.equal(normalized.title, 'Original title'); assert.equal(normalized.vote_average, 0); assert.equal(normalized.vote_count, 0)
})

test('only manually completed released films count as watched, and the next link follows the first gap', () => {
  const parts = collection([movie(1, '2001-01-01'), movie(2, '2002-01-01'), movie(3, '2003-01-01'), movie(4, '2028-01-01'), movie(5, null)]).parts
  const statuses = new Map([[1, 'completed'], [2, 'watching'], [3, 'completed'], [4, 'completed'], [5, 'completed'], [999, 'completed']])
  const progress = filmCollectionProgress(parts, statuses, '2026-10-25')
  assert.equal(progress.released, 3); assert.equal(progress.watched, 2); assert.equal(progress.next.id, 2)
  assert.equal(filmCollectionProgress(parts, new Map([[1, 'completed'], [2, 'completed'], [3, 'completed']]), '2026-10-25').next, null)
  assert.deepEqual(filmCollectionProgress([], statuses, '2026-10-25'), { released: 0, watched: 0, next: null })
})

test('collection API requests accept only a bounded ID and no arbitrary catalogue options', () => {
  assert.doesNotThrow(() => validateMediaParams('tmdb', new URLSearchParams('type=collection-detail&id=1241')))
  for (const extra of ['', 'id=0', 'id=-1', 'id=2147483648', 'id=1&id=2', 'id=1241&page=1', 'id=1241&url=https://tracker.example', 'id=1241&query=film', 'id=1241&genre=comedy']) assert.throws(() => validateMediaParams('tmdb', new URLSearchParams(`type=collection-detail&${extra}`)))
  assert.throws(() => validateMediaParams('anilist', new URLSearchParams('type=collection-detail&id=1241')))
})

function libraryClient(rows, inspect = () => {}) {
  const calls = []
  return { calls, from(table) {
    const call = { table, filters: [] }; calls.push(call)
    const query = {
      select(fields) { call.fields = fields; return query },
      eq(key, value) { call.filters.push([key, value]); return query },
      in(key, values) { call.ids = [key, values]; return query },
      async abortSignal(signal) {
        inspect(call, signal)
        return { data: rows.filter(row => call.filters.every(([key, value]) => row[key] === value) && call.ids[1].includes(row.tmdb_id)), error: null }
      },
    }
    return query
  } }
}

test('one minimal owner-scoped query covers the whole collection and keeps movie identities separate', async () => {
  const rows = [{ user_id: 'owner-a', tmdb_id: 1, media_type: 'movie', watch_status: 'completed' }, { user_id: 'owner-b', tmdb_id: 2, media_type: 'movie', watch_status: 'completed' }, { user_id: 'owner-a', tmdb_id: 2, media_type: 'tv', watch_status: 'completed' }]
  const client = libraryClient(rows)
  const result = await loadFilmCollectionStatuses(client, 'owner-a', [1, 2, 2, 3], new AbortController().signal)
  assert.deepEqual([...result], [[1, 'completed']])
  assert.equal(client.calls.length, 1)
  assert.equal(client.calls[0].table, 'watchlist'); assert.equal(client.calls[0].fields, 'tmdb_id,watch_status')
  assert.deepEqual(client.calls[0].filters, [['user_id', 'owner-a'], ['media_type', 'movie']])
  assert.deepEqual(client.calls[0].ids, ['tmdb_id', [1, 2, 3]])
})

test('empty collections do not read the database and aborted or failed reads never look like unseen films', async () => {
  const client = libraryClient([]), signal = new AbortController()
  assert.equal((await loadFilmCollectionStatuses(client, 'owner', [], signal.signal)).size, 0)
  assert.equal(client.calls.length, 0)
  signal.abort()
  await assert.rejects(loadFilmCollectionStatuses(client, 'owner', [1], signal.signal), { name: 'AbortError' })
  const during = new AbortController()
  await assert.rejects(loadFilmCollectionStatuses(libraryClient([], () => during.abort()), 'owner', [1], during.signal), { name: 'AbortError' })
  await assert.rejects(loadFilmCollectionStatuses(libraryClient([], () => { throw Error('Unavailable') }), 'owner', [1], new AbortController().signal))
  await assert.rejects(loadFilmCollectionStatuses(client, 'owner', [0], new AbortController().signal))
})
