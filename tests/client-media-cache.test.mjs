import test from 'node:test'
import assert from 'node:assert/strict'
import { cachedMedia, fetchMedia, MediaRequestError } from '../src/lib/client-media-cache.ts'
import { catalogUrl } from '../src/lib/catalog-request.ts'

test('equivalent URLs share one request and cancelling one reader preserves the other', async () => {
  const original = globalThis.fetch
  let release
  let calls = 0
  let upstream
  globalThis.fetch = async (_url, { signal }) => { calls++; upstream = signal; return new Promise(resolve => { release = () => resolve(Response.json({ id: 42 })) }) }
  try {
    const a = new AbortController()
    const b = new AbortController()
    const first = fetchMedia('/api/tmdb?type=test-cache&id=42', a.signal)
    const second = fetchMedia('/api/tmdb?id=42&type=test-cache', b.signal)
    a.abort()
    await assert.rejects(first, { name: 'AbortError' })
    assert.equal(upstream.aborted, false)
    release()
    assert.deepEqual(await second, { id: 42 })
    assert.deepEqual(cachedMedia('/api/tmdb?type=test-cache&id=42'), { id: 42 })
    assert.deepEqual(await fetchMedia('/api/tmdb?id=42&type=test-cache'), { id: 42 })
    assert.equal(calls, 1)
  } finally { globalThis.fetch = original }
})

test('abandoned requests are cancelled when their last reader leaves', async () => {
  const original = globalThis.fetch
  let upstream
  globalThis.fetch = async (_url, { signal }) => {
    upstream = signal
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))
  }
  try {
    const controller = new AbortController()
    const request = fetchMedia('/api/tmdb?type=test-abandoned', controller.signal)
    controller.abort()
    await assert.rejects(request, { name: 'AbortError' })
    assert.equal(upstream.aborted, true)
    assert.equal(cachedMedia('/api/tmdb?type=test-abandoned'), undefined)
  } finally { globalThis.fetch = original }
})

test('failures are not cached and can be retried immediately', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => ++calls === 1 ? new Response(null, { status: 503 }) : Response.json({ results: [] })
  try {
    await assert.rejects(fetchMedia('/api/anilist?type=test-retry'))
    assert.deepEqual(await fetchMedia('/api/anilist?type=test-retry'), { results: [] })
    assert.equal(calls, 2)
  } finally { globalThis.fetch = original }
})

test('account, library and external URLs cannot enter the shared catalog cache or send a request', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; return Response.json({ private: true }) }
  try {
    for (const url of ['/api/account/usage', '/library', '//example.com/api/tmdb', 'https://example.com/api/tmdb', '/api/tmdb/../account/usage']) {
      assert.throws(() => cachedMedia(url), /catalog/)
      await assert.rejects(fetchMedia(url), /catalog/)
    }
    assert.equal(calls, 0)
  } finally { globalThis.fetch = original }
})

test('detail then playback reuse one metadata request; anime suggestions reuse full-result cache', async () => {
 const original=globalThis.fetch; let calls=0
 globalThis.fetch=async()=>{calls++;return Response.json({id:98765,results:[]})}
 try {
  await fetchMedia('/api/tmdb?type=movie-detail&id=98765')
  await fetchMedia('/api/tmdb?type=movie-detail&id=98765')
  assert.equal(calls,1)
  await fetchMedia(catalogUrl('anime','cache-measurement','trending',1))
  await fetchMedia(catalogUrl('anime','cache-measurement','popular',1))
  assert.equal(calls,2)
 } finally {globalThis.fetch=original}
})

test('Retry-After prevents repeated requests but leaves successful cached pages readable', async () => {
 const original=globalThis.fetch, originalNow=Date.now; let now=originalNow(),calls=0
 Date.now=()=>now
 globalThis.fetch=async()=>{calls++;return calls===1?Response.json({ok:true}):new Response(null,{status:503,headers:{'Retry-After':'15'}})}
 try {
  await fetchMedia('/api/anilist?type=test-warm-before-outage')
  await assert.rejects(fetchMedia('/api/anilist?type=test-outage'),MediaRequestError)
  for(let i=0;i<9;i++)await assert.rejects(fetchMedia('/api/anilist?type=test-outage'),{retryAfter:15})
  assert.deepEqual(cachedMedia('/api/anilist?type=test-outage'),undefined)
  assert.deepEqual(await fetchMedia('/api/anilist?type=test-warm-before-outage'),{ok:true})
  assert.equal(calls,2)
  now+=15001;globalThis.fetch=async()=>{calls++;return Response.json({recovered:true})}
  assert.deepEqual(await fetchMedia('/api/anilist?type=test-outage'),{recovered:true});assert.equal(calls,3)
 } finally {Date.now=originalNow;globalThis.fetch=original}
})
