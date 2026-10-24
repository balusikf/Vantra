import assert from 'node:assert/strict'
import test from 'node:test'
import { getHistoryLookup, parseInteger, isMediaType } from '../src/lib/watch-metadata.ts'

test('anime history uses AniList identity while the stream keeps its distinct MAL identity', () => {
  assert.deepEqual(getHistoryLookup('anime', '40748', '113415'), { mediaId: 113415, url: '/api/anilist?type=detail&id=113415' })
})
test('missing anime mapping must not save a MAL ID as an unrelated catalog title', () => {
  assert.equal(getHistoryLookup('anime', '40748', null), null)
  assert.equal(getHistoryLookup('anime', '40748', 'null'), null)
})
test('movies and series preserve TMDB identity and use the correct detail endpoint', () => {
  assert.deepEqual(getHistoryLookup('movie', '550', null), { mediaId: 550, url: '/api/tmdb?type=movie-detail&id=550' })
  assert.deepEqual(getHistoryLookup('tv', '95557', null), { mediaId: 95557, url: '/api/tmdb?type=tv-detail&id=95557' })
})
test('malformed identifiers and episodes are rejected rather than partially parsed', () => {
  for (const input of [null, '', 'null', 'NaN', '1abc', '1.5', '-1', '0', '9007199254740992']) assert.equal(parseInteger(input), null, String(input))
  assert.equal(parseInteger('1'), 1)
  assert.equal(parseInteger('0', 0), 0)
})
test('only supported media types may select a provider path', () => {
  for (const type of ['movie','tv','anime']) assert.equal(isMediaType(type), true)
  for (const type of [null, '', 'person', 'anything']) assert.equal(isMediaType(type), false)
})
