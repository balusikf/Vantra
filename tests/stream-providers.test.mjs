import assert from 'node:assert/strict'
import test from 'node:test'
import { getStreamProviders } from '../src/lib/stream-providers.ts'

test('movie sources preserve the working MultiEmbed primary and documented TMDB routes', () => {
  assert.deepEqual(getStreamProviders('movie', 786892), [
    { name: 'MultiEmbed', url: 'https://multiembed.mov/?video_id=786892&tmdb=1' },
    { name: 'VidCore', url: 'https://vidcore.io/movie/786892?theme=e50914&autoPlay=false' },
    { name: 'VidNest', url: 'https://vidnest.fun/movie/786892' },
    { name: 'VidFast', url: 'https://vidfast.vc/movie/786892?theme=e50914&autoPlay=false' },
    { name: 'VidLink', url: 'https://vidlink.pro/movie/786892' },
    { name: 'AutoEmbed', url: 'https://autoembed.co/movie/tmdb/786892' },
  ])
})

test('TV URLs retain the exact season and episode across all sources, including specials', () => {
  assert.deepEqual(getStreamProviders('tv', 94997, 2, 3).map(source => source.url), [
    'https://multiembed.mov/?video_id=94997&tmdb=1&s=2&e=3',
    'https://vidcore.io/tv/94997/2/3?theme=e50914&autoPlay=false',
    'https://vidnest.fun/tv/94997/2/3',
    'https://vidfast.vc/tv/94997/2/3?theme=e50914&autoPlay=false',
    'https://vidlink.pro/tv/94997/2/3',
    'https://autoembed.co/tv/tmdb/94997-2-3',
  ])
  assert.match(getStreamProviders('tv', 94997, 0, 2)[0].url, /&s=0&e=2$/)
})

test('anime uses MAL / requested episode / sub instead of the old malformed VidLink route', () => {
  assert.deepEqual(getStreamProviders('anime', 40748, 1, 7), [
    { name: 'VidLink', url: 'https://vidlink.pro/anime/40748/7/sub' },
  ])
})

test('anime never sends a MAL identifier to the undocumented MultiEmbed or AutoEmbed routes', () => {
  for (const episode of [1, 2, 12]) {
    const sources = getStreamProviders('anime', 40748, 1, episode)
    assert.equal(sources.some(source => source.name === 'MultiEmbed' || source.name === 'AutoEmbed'), false)
    assert.equal(new URL(sources[0].url).pathname, `/anime/40748/${episode}/sub`)
  }
})

test('invalid identifiers and episode values cannot become upstream URLs', () => {
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1?url=elsewhere']) {
    assert.throws(() => getStreamProviders('movie', id), /Invalid media/)
  }
  for (const [type, season, episode] of [['person', 1, 1], ['tv', -1, 1], ['tv', 1.5, 1], ['anime', 1, 0], ['anime', 1, NaN]]) {
    assert.throws(() => getStreamProviders(type, 1, season, episode), /Invalid media/)
  }
})


test('anime keeps AniList and MAL identities separate for the requested episode', () => {
  assert.deepEqual(getStreamProviders('anime', 52991, 1, 7, 154587), [
    { name: 'VidNest', url: 'https://vidnest.fun/anime/154587/7/sub' },
    { name: 'VidLink', url: 'https://vidlink.pro/anime/52991/7/sub' },
  ])
  assert.deepEqual(getStreamProviders('anime', 52991).map(source => source.name), ['VidLink'])
})

test('invalid AniList identifiers cannot reach VidNest', () => {
  for (const anilistId of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '154587', null]) {
    assert.throws(() => getStreamProviders('anime', 52991, 1, 1, anilistId), /Invalid media/)
  }
})

test('an optional anime mapping cannot replace a movie or TV identifier', () => {
  for (const type of ['movie', 'tv']) {
    assert.deepEqual(getStreamProviders(type, 94997, 1, 2, 154587), getStreamProviders(type, 94997, 1, 2))
  }
})
