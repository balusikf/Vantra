import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { deleteOwnedLibraryRows } from '../src/lib/library-delete.ts'

function database({ remaining = 0, denied = false, verificationFails = false } = {}) {
  const requests = []
  const client = createClient('https://library-test.supabase.co', 'test-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      requests.push({ url: new URL(String(url)), method: options.method })
      if (options.method === 'DELETE') return denied ? Response.json({ message: 'Denied', code: '42501' }, { status: 403 }) : new Response(null, { status: 204 })
      assert.equal(options.method, 'HEAD')
      return new Response(null, { status: verificationFails ? 403 : 200, headers: { 'content-range': `*/${remaining}` } })
    } },
  })
  return { client, requests }
}

test('watchlist deletion and verification both retain owner and title filters', async () => {
  const { client, requests } = database()
  await deleteOwnedLibraryRows(client, 'watchlist', 'owner-id', { tmdb_id: 42, media_type: 'movie' })
  assert.deepEqual(requests.map(request => request.method), ['DELETE', 'HEAD'])
  for (const { url } of requests) {
    assert.equal(url.pathname, '/rest/v1/watchlist')
    assert.equal(url.searchParams.get('user_id'), 'eq.owner-id')
    assert.equal(url.searchParams.get('tmdb_id'), 'eq.42')
    assert.equal(url.searchParams.get('media_type'), 'eq.movie')
  }
})
test('clearing history deletes and checks only the signed-in owner’s history', async () => {
  const { client, requests } = database()
  await deleteOwnedLibraryRows(client, 'watch_history', 'owner-id')
  for (const { url } of requests) {
    assert.equal(url.pathname, '/rest/v1/watch_history')
    assert.equal(url.searchParams.get('user_id'), 'eq.owner-id')
  }
})
test('a silent zero-row or partial deletion cannot produce success while rows remain', async () => {
  const { client } = database({ remaining: 1 })
  await assert.rejects(deleteOwnedLibraryRows(client, 'watch_history', 'owner-id'), /confirm deletion/)
})
test('permission errors and failed confirmation queries propagate to the UI', async () => {
  const denied = database({ denied: true })
  await assert.rejects(deleteOwnedLibraryRows(denied.client, 'watchlist', 'owner-id', { id: 'saved-id' }))
  assert.equal(denied.requests.length, 1)
  const failed = database({ verificationFails: true })
  await assert.rejects(deleteOwnedLibraryRows(failed.client, 'watch_history', 'owner-id'))
})
test('missing ownership never sends a deletion request', async () => {
  const { client, requests } = database()
  await assert.rejects(deleteOwnedLibraryRows(client, 'watch_history', ''), /Sign in/)
  assert.equal(requests.length, 0)
})
