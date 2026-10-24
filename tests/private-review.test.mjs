import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { PRIVATE_NOTE_LIMIT, hasPrivateReview, parsePrivateReview, savePrivateReview } from '../src/lib/private-review.ts'
import { removeSavedTitle } from '../src/lib/library-delete.ts'

function database({ row = { id: 'entry-id', personal_rating: 8, personal_note: 'My own thoughts' }, denied = false, missing = false } = {}) {
  const requests = []
  const client = createClient('https://private-review-test.supabase.co', 'test-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      const method = options.method || 'GET'
      requests.push({ url: new URL(String(url)), method, body: options.body ? JSON.parse(options.body) : null })
      if (denied) return Response.json({ message: 'Denied', code: '42501' }, { status: 403 })
      if (method === 'DELETE') return new Response(null, { status: 204 })
      if (method === 'HEAD') return new Response(null, { headers: { 'content-range': '*/0' } })
      return Response.json(missing ? null : row)
    } },
  })
  return { client, requests }
}
test('private reviews accept an optional 1–10 integer rating and bounded plain-text note', () => {
  assert.deepEqual(parsePrivateReview({ personal_rating: null, personal_note: '  Only a note  ' }), { personal_rating: null, personal_note: 'Only a note' })
  assert.deepEqual(parsePrivateReview({ personal_rating: 10, personal_note: '' }), { personal_rating: 10, personal_note: '' })
  for (const rating of [undefined, 0, 11, 4.5, NaN, Infinity, '8']) assert.throws(() => parsePrivateReview({ personal_rating: rating, personal_note: '' }))
  assert.throws(() => parsePrivateReview({ personal_rating: 1, personal_note: 'x'.repeat(PRIVATE_NOTE_LIMIT + 1) }))
  assert.throws(() => parsePrivateReview({ personal_rating: 1, personal_note: {} }))
  assert.equal(hasPrivateReview({ personal_rating: null, personal_note: ' ' }), false)
  assert.equal(hasPrivateReview({ personal_rating: 1, personal_note: '' }), true)
})
test('saving only writes personal fields, keeps both ownership filters and returns the saved reading', async () => {
  const { client, requests } = database()
  const saved = await savePrivateReview(client, 'owner-id', 'entry-id', { personal_rating: 8, personal_note: 'My own thoughts', rating: 2, vote_average: 2 })
  assert.deepEqual(saved, { personal_rating: 8, personal_note: 'My own thoughts' })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].method, 'PATCH')
  assert.equal(requests[0].url.pathname, '/rest/v1/watchlist')
  assert.equal(requests[0].url.searchParams.get('user_id'), 'eq.owner-id')
  assert.equal(requests[0].url.searchParams.get('id'), 'eq.entry-id')
  assert.deepEqual(requests[0].body, saved)
})
test('missing ownership and invalid input cannot send a review mutation', async () => {
  const { client, requests } = database()
  await assert.rejects(savePrivateReview(client, '', 'entry-id', {}))
  await assert.rejects(savePrivateReview(client, 'owner-id', '', {}))
  await assert.rejects(savePrivateReview(client, 'owner-id', 'entry-id', { personal_rating: 12, personal_note: '' }))
  assert.equal(requests.length, 0)
})
test('denied, zero-row and wrong-row updates never report a saved review', async () => {
  for (const options of [{ denied: true }, { missing: true }, { row: { id: 'wrong-entry', personal_rating: 8, personal_note: '' } }]) {
    await assert.rejects(savePrivateReview(database(options).client, 'owner-id', 'entry-id', { personal_rating: 8, personal_note: '' }), /could not be saved/)
  }
})
test('removing a reviewed title requires confirmation before any delete, including note-only reviews', async () => {
  for (const row of [{ id: 'entry-id', personal_rating: 8, personal_note: '' }, { id: 'entry-id', personal_rating: null, personal_note: 'My note' }]) {
    const { client, requests } = database({ row })
    assert.equal((await removeSavedTitle(client, 'owner-id', { id: 'entry-id' })).needsConfirmation, true)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].method, 'GET')
    assert.equal(requests[0].url.searchParams.get('user_id'), 'eq.owner-id')
    assert.equal(requests[0].url.searchParams.get('id'), 'eq.entry-id')
  }
})
test('confirmed removal checks, deletes and verifies only the requested owner/title', async () => {
  const { client, requests } = database()
  assert.equal((await removeSavedTitle(client, 'owner-id', { tmdb_id: 42, media_type: 'tv' }, true)).needsConfirmation, false)
  assert.deepEqual(requests.map(r => r.method), ['GET', 'DELETE', 'HEAD'])
  for (const { url } of requests) {
    assert.equal(url.searchParams.get('user_id'), 'eq.owner-id')
    assert.equal(url.searchParams.get('tmdb_id'), 'eq.42')
    assert.equal(url.searchParams.get('media_type'), 'eq.tv')
  }
})
test('a failed review preflight cannot fall through to deletion', async () => {
  const { client, requests } = database({ denied: true })
  await assert.rejects(removeSavedTitle(client, 'owner-id', { id: 'entry-id' }, true), /Could not check/)
  assert.deepEqual(requests.map(r => r.method), ['GET'])
})
