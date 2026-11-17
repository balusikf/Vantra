import assert from 'node:assert/strict'
import test from 'node:test'
import { createAnimeStreamResolver } from '../src/lib/anime-stream-provider.ts'

const server = (file, name = 'HD-2', type = 'sub') => ({
  serverName: name,
  dataType: type,
  dataLink: `https://flixcloud.cc/e/${file}?v=2`,
})
const reply = servers => Response.json({ success: true, servers })

test('FlixCloud resolves the exact AniList, MAL and episode without forwarding credentials', async () => {
  const calls = []
  const resolve = createAnimeStreamResolver(async (url, options) => {
    calls.push({ url, options })
    return reply([server('episode-seven')])
  })
  assert.deepEqual(await resolve(52991, 7, 154587), {
    name: 'FlixCloud',
    url: 'https://flixcloud.cc/e/episode-seven?v=2&autoPlay=false',
    tags: ['ANIME', 'ADS'],
  })
  assert.equal(calls[0].url, 'https://reanime.cz/api/flix/154587/7?mal=52991')
  assert.equal(calls[0].options.credentials, 'omit')
  assert.equal(calls[0].options.redirect, 'error')
  assert.deepEqual(calls[0].options.headers, { Accept: 'application/json' })
  assert.ok(calls[0].options.signal instanceof AbortSignal)
})

test('MAL-only lookups never assume an AniList ID and different episodes stay separate', async () => {
  const calls = []
  const resolve = createAnimeStreamResolver(async url => {
    calls.push(url)
    return reply([server(`episode-${new URL(url).pathname.split('/').at(-1)}`)])
  })
  assert.match((await resolve(21, 1)).url, /episode-1\?/)
  assert.match((await resolve(21, 2)).url, /episode-2\?/)
  assert.deepEqual(calls, [
    'https://reanime.cz/api/flix/0/1?mal=21',
    'https://reanime.cz/api/flix/0/2?mal=21',
  ])
})

test('rejects foreign origins, credentials, malformed files and injected embed parameters', async () => {
  const badUrls = [
    'https://flixcloud.cc.evil.test/e/abcdef',
    'https://evil.test/e/abcdef',
    'http://flixcloud.cc/e/abcdef',
    'https://user:password@flixcloud.cc/e/abcdef',
    'https://flixcloud.cc:444/e/abcdef',
    'javascript:alert(1)',
    'https://flixcloud.cc/login',
    'https://flixcloud.cc/e/a%2fb',
  ]
  for (const dataLink of badUrls) {
    const resolve = createAnimeStreamResolver(async () => reply([{ ...server('abcdef'), dataLink }]))
    assert.equal(await resolve(21, 1, 21), null, dataLink)
  }
  const resolve = createAnimeStreamResolver(async () => reply([{
    ...server('abcdef'), dataLink: 'https://flixcloud.cc/e/abcdef?v=3&autoPlay=true&redirect=https://evil.test/#tracking',
  }]))
  assert.equal((await resolve(21, 1, 21)).url, 'https://flixcloud.cc/e/abcdef?v=2&autoPlay=false')
})

test('chooses HD-2 sub with built-in audio controls and falls back to HD-1', async () => {
  const resolve = createAnimeStreamResolver(async () => reply([
    server('english-dub', 'HD-2', 'dub'), server('hd-one', 'HD-1'), server('hd-two'),
  ]))
  assert.match((await resolve(21, 1)).url, /hd-two\?v=2/)
  const hd1 = createAnimeStreamResolver(async () => reply([server('hd-one', 'HD-1')]))
  assert.match((await hd1(21, 1)).url, /hd-one\?v=1/)
})

test('coalesces concurrent requests and caches results without mixing anime identities', async () => {
  let calls = 0
  let clock = 0
  const resolve = createAnimeStreamResolver(async () => {
    calls++
    return reply([server('cached-file')])
  }, () => clock)
  const results = await Promise.all(Array.from({ length: 8 }, () => resolve(21, 1, 21)))
  assert.equal(calls, 1)
  assert.ok(results.every(item => item.url === results[0].url))
  await resolve(21, 1, 21)
  assert.equal(calls, 1)
  await resolve(21, 1, 22)
  assert.equal(calls, 2)
  clock = 600001
  await resolve(21, 1, 21)
  assert.equal(calls, 3)
})

test('missing episodes are briefly cached and never become an incorrect source', async () => {
  let calls = 0
  let clock = 0
  const resolve = createAnimeStreamResolver(async () => {
    calls++
    return reply([])
  }, () => clock)
  assert.equal(await resolve(21, 9999), null)
  assert.equal(await resolve(21, 9999), null)
  assert.equal(calls, 1)
  clock = 60001
  assert.equal(await resolve(21, 9999), null)
  assert.equal(calls, 2)
})

test('outages, HTML challenges and oversized replies omit FlixCloud and back off', async () => {
  for (const failure of [
    () => { throw new Error('offline') },
    () => new Response('rate limited', { status: 429 }),
    () => new Response('<html>challenge</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{invalid', { headers: { 'content-type': 'application/json' } }),
    () => Response.json({ success: true, servers: [], padding: 'x'.repeat(65536) }),
  ]) {
    let calls = 0
    let clock = 0
    const resolve = createAnimeStreamResolver(async () => { calls++; return failure() }, () => clock)
    assert.equal(await resolve(21, 1), null)
    assert.equal(await resolve(21, 2), null)
    assert.equal(calls, 1)
    clock = 15001
    assert.equal(await resolve(21, 2), null)
    assert.equal(calls, 2)
  }
})

test('invalid catalog identifiers cannot trigger an upstream request', async () => {
  const resolve = createAnimeStreamResolver(async () => { assert.fail('Unexpected request') })
  for (const id of [0, -1, 1.5, NaN, Infinity, '21', 2147483648]) {
    assert.equal(await resolve(id, 1), null)
    assert.equal(await resolve(21, 1, id), null)
    assert.equal(await resolve(21, id), null)
  }
  assert.equal(await resolve(21, 100001), null)
})
