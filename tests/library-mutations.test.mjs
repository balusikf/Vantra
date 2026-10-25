import test from 'node:test'
import assert from 'node:assert/strict'
import { requireCurrentAccount, ensureTrackedTitle } from '../src/lib/library-mutations.ts'

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const input = { user_id: 'owner-a', tmdb_id: 123, media_type: 'tv', title: 'A series', poster_path: '/poster.jpg' }
const unchanged = () => {}
function guard(controller) { return () => controller.signal.throwIfAborted() }
function titleClient(inserted, existing) {
  const calls = []
  return { calls, from(table) {
    const call = { table, filters: [] }; calls.push(call)
    return {
      insert(value) { call.insert = value; return this },
      select(value) { call.select = value; return this },
      eq(key, value) { call.filters.push([key, value]); return this },
      single() { return call.insert ? inserted : existing },
    }
  } }
}

test('mutations reject another signed-in account and failed verification before writing', async () => {
  await assert.rejects(requireCurrentAccount({ auth: { getUser: async () => ({ data: { user: { id: 'owner-b' } }, error: null }) } }, 'owner-a', unchanged))
  await assert.rejects(requireCurrentAccount({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }, 'owner-a', unchanged))
  await assert.rejects(requireCurrentAccount({ auth: { getUser: async () => ({ data: { user: { id: 'owner-a' } }, error: Error('offline') }) } }, 'owner-a', unchanged))
  await assert.doesNotReject(requireCurrentAccount({ auth: { getUser: async () => ({ data: { user: { id: 'owner-a' } }, error: null }) } }, 'owner-a', unchanged))
})

test('an abandoned auth check cannot continue a watchlist or history mutation', async () => {
  const response = deferred(), selection = new AbortController()
  let writes = 0
  const work = requireCurrentAccount({ auth: { getUser: () => response.promise } }, 'owner-a', guard(selection)).then(() => { writes++ })
  selection.abort()
  response.resolve({ data: { user: { id: 'owner-a' } }, error: null })
  await assert.rejects(work, { name: 'AbortError' }); assert.equal(writes, 0)
})

test('a delayed title insert from an abandoned selection cannot publish its ID or write episode marks', async () => {
  const response = deferred(), selection = new AbortController()
  const client = titleClient(response.promise)
  let marks = 0, savedId = null
  const work = ensureTrackedTitle(client, input, guard(selection)).then(id => { savedId = id; marks++ })
  selection.abort()
  response.resolve({ data: { id: 'old-saved-title' }, error: null })
  await assert.rejects(work, { name: 'AbortError' })
  assert.equal(marks, 0); assert.equal(savedId, null); assert.equal(client.calls.length, 1)
})

test('concurrent title creation recovers duplicates with an owner- and media-scoped lookup', async () => {
  const client = titleClient({ data: null, error: { code: '23505' } }, { data: { id: 'saved-title' }, error: null })
  assert.equal(await ensureTrackedTitle(client, input, unchanged), 'saved-title')
  assert.equal(client.calls.length, 2)
  assert.equal(client.calls[0].insert.watch_status, 'watching')
  assert.deepEqual(client.calls[1].filters, [['user_id', 'owner-a'], ['tmdb_id', 123], ['media_type', 'tv']])
})

test('an abandoned duplicate lookup and a failed insert never proceed to episode writes', async () => {
  const response = deferred(), selection = new AbortController()
  const client = titleClient({ data: null, error: { code: '23505' } }, response.promise)
  const work = ensureTrackedTitle(client, input, guard(selection))
  await Promise.resolve()
  assert.equal(client.calls.length, 2)
  selection.abort(); response.resolve({ data: { id: 'old-saved-title' }, error: null })
  await assert.rejects(work, { name: 'AbortError' })
  const denied = titleClient({ data: null, error: { code: '42501' } })
  await assert.rejects(ensureTrackedTitle(denied, input, unchanged), { code: '42501' })
  assert.equal(denied.calls.length, 1)
})
