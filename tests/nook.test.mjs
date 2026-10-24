import test from 'node:test'
import assert from 'node:assert/strict'
import { loadNookTitles, pickNookTitle, nookTitleKey, nookPoster, nookAllowed } from '../src/lib/nook-selection.ts'

const title = (id, kind = 'movie') => ({ tmdb_id: id, media_type: kind, title: `Story ${id}`, poster_path: null })

test('evening picks respect type and show each planned title before cycling, avoiding immediate repeats', () => {
  const pool = [title(1), title(2), title(1, 'tv'), title(3, 'anime')]
  const seen = []
  for (let i = 0; i < pool.length; i++) {
    const pick = pickNookTitle(pool, 'all', seen, () => 0)
    assert.ok(!seen.includes(nookTitleKey(pick)))
    seen.push(nookTitleKey(pick))
  }
  assert.notEqual(nookTitleKey(pickNookTitle(pool, 'all', seen, () => .999)), seen.at(-1))
  assert.equal(pickNookTitle(pool, 'tv', seen).media_type, 'tv')
  assert.equal(pickNookTitle([title(1)], 'anime', []), null)
})

test('empty pools and single-title pools remain usable', () => {
  assert.equal(pickNookTitle([], 'all', []), null)
  assert.equal(pickNookTitle([title(1)], 'anime', []), null)
  assert.deepEqual(pickNookTitle([title(1)], 'movie', ['movie:1']), title(1))
})

function plannedClient(rows, inspect = () => {}) {
  const calls = []
  return { calls, from(table) {
    const call = { table, filters: [] }; calls.push(call)
    const query = {
      select(fields) { call.fields = fields; return query },
      eq(key, value) { call.filters.push([key, value]); return query },
      order(key) { call.order = key; return query },
      range(from, to) { call.range = [from, to]; return query },
      async abortSignal(signal) { inspect(call, signal); return { data: rows.slice(call.range[0], call.range[1] + 1), error: null } },
    }
    return query
  } }
}

test('planned pool is owner filtered, minimal and complete across the 500-row page boundary', async () => {
  const rows = Array.from({ length: 501 }, (_, i) => title(i + 1))
  const client = plannedClient(rows)
  assert.equal((await loadNookTitles(client, 'owner-a', new AbortController().signal)).length, 501)
  assert.equal(client.calls.length, 2)
  for (const call of client.calls) {
    assert.equal(call.table, 'watchlist')
    assert.deepEqual(call.filters, [['user_id', 'owner-a'], ['watch_status', 'planned']])
    assert.equal(call.fields, 'tmdb_id,media_type,title,poster_path')
    assert.equal(call.order, 'id')
  }
  assert.deepEqual(client.calls[1].range, [500, 999])
})

test('closing before or during a read discards data, and read failures stay failures', async () => {
  const aborted = new AbortController(); aborted.abort()
  const before = plannedClient([title(1)])
  await assert.rejects(loadNookTitles(before, 'owner', aborted.signal), { name: 'AbortError' })
  assert.equal(before.calls.length, 0)
  const during = new AbortController()
  await assert.rejects(loadNookTitles(plannedClient([title(1)], () => during.abort()), 'owner', during.signal), { name: 'AbortError' })
  const failure = new Error('unavailable')
  await assert.rejects(loadNookTitles(plannedClient([], () => { throw failure }), 'owner', new AbortController().signal), failure)
})

test('Nook never mounts on playback, login or the redirect route', () => {
  for (const path of ['/', '/watch', '/watch/tv/42', '/watch/anime/42', '/watch/movie/42', '/login', '/login/reset']) assert.equal(nookAllowed(path), false)
  for (const path of ['/home', '/preview', '/browse', '/library', '/profile', '/anime/42']) assert.equal(nookAllowed(path), true)
})

test('saved posters only use configured image hosts and never arbitrary external URLs', () => {
  assert.equal(nookPoster({ ...title(1), poster_path: '/poster.jpg' }), 'https://image.tmdb.org/t/p/w342/poster.jpg')
  assert.equal(nookPoster({ ...title(1, 'anime'), poster_path: 'https://s4.anilist.co/file/a.jpg' }), 'https://s4.anilist.co/file/a.jpg')
  for (const path of ['https://evil.example/p.jpg', 'https://s4.anilist.co.evil.example/a.jpg', 'javascript:alert(1)']) {
    assert.equal(nookPoster({ ...title(1), poster_path: path }), null)
    assert.equal(nookPoster({ ...title(1, 'anime'), poster_path: path }), null)
  }
})
