import assert from 'node:assert/strict'
import test from 'node:test'
import { nextPlaybackSource } from '../src/lib/playback-recovery.ts'

const sources = ['first', 'second', 'third'].map(name => ({ name, url: `https://${name}.test/embed` }))

test('source recovery advances and wraps without reselecting the broken iframe', () => {
  assert.deepEqual(nextPlaybackSource(sources, sources[0]), sources[1])
  assert.deepEqual(nextPlaybackSource(sources, sources[1]), sources[2])
  assert.deepEqual(nextPlaybackSource(sources, sources[2]), sources[0])
  assert.deepEqual(nextPlaybackSource(sources, null), sources[0])
  assert.deepEqual(nextPlaybackSource(sources, { name: 'old', url: 'https://old.test' }), sources[0])
})

test('recovery has no alternative when sources are absent or all point to the active URL', () => {
  assert.equal(nextPlaybackSource([], null), null)
  assert.equal(nextPlaybackSource([sources[0]], sources[0]), null)
  assert.equal(nextPlaybackSource([sources[0], { ...sources[0], name: 'Duplicate' }], sources[0]), null)
})
