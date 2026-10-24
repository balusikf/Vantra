import test from 'node:test'
import assert from 'node:assert/strict'
import { createCapacityReader, parseLiveCapacity } from '../src/lib/usage-capacity.ts'

const now = Date.parse('2026-10-24T12:00:00Z')
const reading = { databaseBytes: 27_000_000, storageBytes: 0, observedAt: '2026-10-24T11:59:00Z' }
test('live capacity validates both sizes, keeps zero distinct from unavailable and rejects fake future observations', () => {
  assert.deepEqual(parseLiveCapacity(reading, now), reading)
  assert.equal(parseLiveCapacity({ ...reading, storageBytes: null }, now).storageBytes, null)
  for (const storageBytes of [undefined, -1, Infinity, .5, '100', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => parseLiveCapacity({ ...reading, storageBytes }, now))
  assert.throws(() => parseLiveCapacity({ ...reading, observedAt: 'tomorrow' }, now))
  assert.throws(() => parseLiveCapacity({ ...reading, observedAt: '2026-10-25T12:00:00Z' }, now))
})
test('capacity cache coalesces simultaneous reads and refreshes only after expiry', async () => {
  let time = 0, calls = 0
  const read = createCapacityReader(60_000, () => time)
  const load = async () => { calls++; return { ...reading, databaseBytes: calls } }
  const [a,b] = await Promise.all([read(load), read(load)])
  assert.equal(calls,1); assert.equal(a,b)
  time = 59_999; assert.equal((await read(load)).databaseBytes,1)
  time = 60_000; assert.equal((await read(load)).databaseBytes,2)
})
test('failed refreshes are not relabelled as fresh or cached as successes', async () => {
  const read = createCapacityReader()
  await assert.rejects(read(async () => { throw new Error('offline') }))
  assert.deepEqual(await read(async () => reading),reading)
})
