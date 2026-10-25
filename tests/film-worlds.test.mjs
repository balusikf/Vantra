import test from 'node:test'
import assert from 'node:assert/strict'
import { filmWorlds } from '../src/data/film-worlds.ts'
import { filmWorldForCollection, loadRelatedFilmWorld } from '../src/lib/film-worlds.ts'
import { presentFilmCollection } from '../src/lib/film-collection.ts'
import { validateMediaParams } from '../src/lib/api-policy.ts'

const collection = id => presentFilmCollection({ id, name: `Collection ${id}`, parts: [
  { id: 11, title: 'Later', release_date: '2020-02-01', poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg' },
  { id: 12, title: 'Earlier', release_date: '2010-02-01' },
  { id: 13, title: 'Undated' },
] })

test('verified film worlds have unique bounded identities, descriptions and source links', () => {
  const worlds = new Set(), members = new Set()
  for (const world of filmWorlds) {
    assert.ok(!worlds.has(world.id)); worlds.add(world.id)
    assert.ok(world.name && world.description && world.sources.length)
    assert.ok(world.collections.length >= 2 && world.collections.length <= 5)
    for (const source of world.sources) assert.equal(new URL(source).protocol, 'https:')
    for (const member of world.collections) {
      assert.ok(Number.isSafeInteger(member.id) && member.id > 0 && member.id <= 2147483647)
      assert.ok(!members.has(member.id)); members.add(member.id)
      assert.ok(member.description)
      assert.equal(filmWorldForCollection(member.id), world)
    }
  }
})

test('connections work in both directions, exclude the current collection and perform only bounded sibling lookups', async () => {
  for (const world of filmWorlds) for (const source of world.collections) {
    const calls = []
    const result = await loadRelatedFilmWorld(source.id, async id => { calls.push(id); return collection(id) })
    const expected = world.collections.filter(member => member.id !== source.id).map(member => member.id)
    assert.deepEqual(calls, expected)
    assert.deepEqual(result.collections.map(value => value.id), expected)
    assert.ok(calls.length <= 4)
    assert.deepEqual(Object.keys(result.world).sort(), ['description', 'id', 'name'])
    assert.equal(result.unavailable, 0)
  }
})

test('related cards use public metadata, known release years and first-film artwork as a fallback', async () => {
  const result = await loadRelatedFilmWorld(1241, async id => ({ ...collection(id), privateNotes: 'do not expose' }))
  const card = result.collections[0]
  assert.equal(card.id, 435259); assert.equal(card.filmCount, 3)
  assert.equal(card.firstYear, '2010'); assert.equal(card.lastYear, '2020')
  assert.equal(card.poster_path, '/poster.jpg'); assert.equal(card.backdrop_path, '/backdrop.jpg')
  assert.ok(card.description.includes('Newt Scamander'))
  assert.equal('parts' in card, false); assert.equal('privateNotes' in card, false)
  const empty = await loadRelatedFilmWorld(1241, async id => presentFilmCollection({ id, parts: [] }))
  assert.equal(empty.collections[0].firstYear, ''); assert.equal(empty.collections[0].poster_path, null)
})

test('unknown and invalid collections make no upstream calls and invent no universe', async () => {
  for (const id of [10, 0, -1, 2147483648, NaN, '1241']) {
    let called = false
    assert.equal(filmWorldForCollection(id), null)
    assert.deepEqual(await loadRelatedFilmWorld(id, async () => { called = true; throw Error() }), { world: null, collections: [], unavailable: 0 })
    assert.equal(called, false)
  }
})

test('partial failures preserve successful siblings and wrong upstream identities count as unavailable', async () => {
  const partial = await loadRelatedFilmWorld(313086, async id => {
    if (id === 402074) throw Error('Unavailable')
    return collection(id)
  })
  assert.equal(partial.world.id, 'conjuring-universe')
  assert.equal(partial.unavailable, 1)
  assert.deepEqual(partial.collections.map(value => value.id), [968052])
  const failed = await loadRelatedFilmWorld(313086, async () => collection(123))
  assert.equal(failed.unavailable, 2); assert.deepEqual(failed.collections, [])
})

test('film-world API accepts only a bounded collection ID, with no arbitrary options or other API backend', () => {
  assert.doesNotThrow(() => validateMediaParams('tmdb', new URLSearchParams('type=collection-world&id=1241')))
  for (const extra of ['', 'id=0', 'id=-1', 'id=2147483648', 'id=1&id=2', 'id=1241&page=1', 'id=1241&url=https://tracker.example', 'id=1241&query=film', 'id=1241&genre=comedy']) {
    assert.throws(() => validateMediaParams('tmdb', new URLSearchParams(`type=collection-world&${extra}`)))
  }
  assert.throws(() => validateMediaParams('anilist', new URLSearchParams('type=collection-world&id=1241')))
})
